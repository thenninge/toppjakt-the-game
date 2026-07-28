"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  formatKestrelLcd,
  type BallisticHoldSolution,
  type KestrelDisplayMode,
  type KestrelLcdCopy,
} from "@/lib/ballistics/solver";
import type { ScopeClickUnit } from "@/lib/optics/spec";

const KESTREL_RANGE_MIN_M = 10;
const KESTREL_RANGE_MAX_M = 1500;

type KestrelFasitViewProps = {
  /** Starting / LRF distance — range arrows adjust from here. */
  baseDistanceM: number;
  /** Recompute elev/wind for the active Kestrel range. */
  solveHold: (distanceM: number) => BallisticHoldSolution;
  shotBearingDeg: number;
  windFromDeg: number;
  windSpeedMs: number;
  /** Compact = tighter HUD; still shows device + zoom. */
  compact?: boolean;
  clickUnit?: ScopeClickUnit;
};

function KestrelLcdLines({ lcd }: { lcd: KestrelLcdCopy }) {
  return (
    <>
      <p className="kestrel-lcd-line kestrel-lcd-e">{lcd.elevLine}</p>
      <p className="kestrel-lcd-line kestrel-lcd-w">{lcd.windLine}</p>
      <hr className="kestrel-lcd-rule" />
      <p className="kestrel-lcd-line kestrel-lcd-tgt">{lcd.tgtLine}</p>
      <p className="kestrel-lcd-line kestrel-lcd-wind">{lcd.windEnvLine}</p>
    </>
  );
}

function KestrelBirdMark() {
  return (
    <svg
      className="kestrel-zoom-bird"
      viewBox="0 0 24 16"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M2 10c2.5-1.2 4.2-3.8 5.2-6.2.3 1.8 1.2 3.4 2.6 4.5 1.1.9 2.5 1.4 4 1.5-1.4.4-2.6 1.2-3.4 2.3-.5.7-.8 1.5-.9 2.4H8.2c.1-1.2.5-2.3 1.2-3.2.8-1.1 2-1.9 3.4-2.3C10.5 8.2 8.2 7 6.5 5.2 5.2 7.8 3.6 9.5 1.5 10.2L2 10zm14.5-1.2c1.8-.2 3.4.4 4.5 1.5-.9-.1-1.8 0-2.6.4-.9.4-1.6 1.1-2 1.9-.2-.8-.2-1.6.1-2.4.3-.6.8-1.1 1.5-1.4.5-.2 1-.3 1.5-.3-.8 0-1.6.1-2.3.4-.7.3-1.3.7-1.7 1.3z"
      />
    </svg>
  );
}

function clampKestrelRangeM(n: number): number {
  if (!Number.isFinite(n)) return KESTREL_RANGE_MIN_M;
  return Math.max(
    KESTREL_RANGE_MIN_M,
    Math.min(KESTREL_RANGE_MAX_M, Math.round(n)),
  );
}

/**
 * Hold pointer: first step immediate, then accelerate (faster ticks).
 */
function useAcceleratingHold(
  step: () => boolean,
  disabled: boolean,
) {
  const stepRef = useRef(step);
  stepRef.current = step;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const timersRef = useRef<{ delay?: number; timeout?: number }>({});
  const holdingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const startedAtRef = useRef(0);

  function intervalMsForHold(heldMs: number): number {
    if (heldMs < 600) return 140;
    if (heldMs < 1400) return 70;
    if (heldMs < 2800) return 40;
    return 22;
  }

  function clear() {
    if (timersRef.current.delay != null) {
      window.clearTimeout(timersRef.current.delay);
    }
    if (timersRef.current.timeout != null) {
      window.clearTimeout(timersRef.current.timeout);
    }
    timersRef.current = {};
    holdingRef.current = false;
    const el = buttonRef.current;
    const pid = pointerIdRef.current;
    if (el && pid != null && el.hasPointerCapture(pid)) {
      try {
        el.releasePointerCapture(pid);
      } catch {
        /* already released */
      }
    }
    pointerIdRef.current = null;
  }

  function scheduleNext() {
    if (!holdingRef.current) return;
    const held = performance.now() - startedAtRef.current;
    timersRef.current.timeout = window.setTimeout(() => {
      if (!holdingRef.current) return;
      if (!stepRef.current()) {
        clear();
        return;
      }
      scheduleNext();
    }, intervalMsForHold(held));
  }

  function start() {
    if (disabledRef.current) return;
    clear();
    holdingRef.current = true;
    startedAtRef.current = performance.now();
    if (!stepRef.current()) {
      clear();
      return;
    }
    timersRef.current.delay = window.setTimeout(() => {
      scheduleNext();
    }, 320);
  }

  useEffect(() => () => clear(), []);

  return {
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      buttonRef.current = e.currentTarget;
      pointerIdRef.current = e.pointerId;
      e.currentTarget.setPointerCapture(e.pointerId);
      start();
    },
    onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (!holdingRef.current) return;
      if (e.pointerType === "mouse" && e.buttons === 0) clear();
    },
    onPointerUp: () => clear(),
    onPointerCancel: () => clear(),
    onLostPointerCapture: () => clear(),
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
  };
}

/**
 * In-game Kestrel 5700 AB solution screen — fasit for elev + windage.
 * Full device on the left; enlarged LCD panel on the right for readability.
 */
export function KestrelFasitView({
  baseDistanceM,
  solveHold,
  shotBearingDeg,
  windFromDeg,
  windSpeedMs,
  compact = false,
  clickUnit = "MRAD",
}: KestrelFasitViewProps) {
  const defaultMode: KestrelDisplayMode =
    clickUnit === "MOA" ? "CLICK_MOA" : "CLICK_MIL";
  const [displayMode, setDisplayMode] =
    useState<KestrelDisplayMode>(defaultMode);
  const [rangeM, setRangeM] = useState(() =>
    clampKestrelRangeM(baseDistanceM),
  );

  useEffect(() => {
    setRangeM(clampKestrelRangeM(baseDistanceM));
  }, [baseDistanceM]);

  useEffect(() => {
    setDisplayMode(clickUnit === "MOA" ? "CLICK_MOA" : "CLICK_MIL");
  }, [clickUnit]);

  const hold = solveHold(rangeM);
  const lcd = formatKestrelLcd(hold, {
    shotBearingDeg,
    windFromDeg,
    windSpeedMs,
    clickUnit,
    displayMode,
  });

  const rangeRef = useRef(rangeM);
  rangeRef.current = rangeM;

  const nudgeRange = (delta: number) => {
    const prev = rangeRef.current;
    const next = clampKestrelRangeM(prev + delta);
    if (next === prev) return false;
    rangeRef.current = next;
    setRangeM(next);
    return true;
  };

  const leftHold = useAcceleratingHold(
    () => nudgeRange(-1),
    rangeM <= KESTREL_RANGE_MIN_M,
  );
  const rightHold = useAcceleratingHold(
    () => nudgeRange(1),
    rangeM >= KESTREL_RANGE_MAX_M,
  );

  const milModes: { id: KestrelDisplayMode; label: string; title: string }[] = [
    {
      id: "MIL",
      label: "MIL",
      title: "Vis elevation/windage i MIL",
    },
    {
      id: "CLICK_MIL",
      label: "Click Mil",
      title: "Klikk i MIL (0.1 mil = MIL×10)",
    },
  ];
  const moaModes: { id: KestrelDisplayMode; label: string; title: string }[] = [
    {
      id: "MOA",
      label: "MOA",
      title: "Vis elevation/windage i MOA",
    },
    {
      id: "CLICK_MOA",
      label: "Click MOA",
      title: "Klikk i MOA (0.25 MOA = MOA×4)",
    },
  ];

  function unitButton(mode: {
    id: KestrelDisplayMode;
    label: string;
    title: string;
  }) {
    return (
      <button
        key={mode.id}
        type="button"
        className={
          displayMode === mode.id
            ? "kestrel-unit-btn is-active"
            : "kestrel-unit-btn"
        }
        aria-pressed={displayMode === mode.id}
        onClick={() => setDisplayMode(mode.id)}
        title={mode.title}
      >
        {mode.label}
      </button>
    );
  }

  return (
    <div
      className={
        compact ? "kestrel-fasit kestrel-fasit-compact" : "kestrel-fasit"
      }
      role="group"
      aria-label={`Kestrel fasit: ${lcd.elevLine}, ${lcd.windLine}`}
    >
      <div className="kestrel-fasit-device-wrap">
        <img
          className="kestrel-fasit-device"
          src="/images/gear/kestrel-5700.png"
          alt="Kestrel 5700 Elite"
          draggable={false}
        />
        <div className="kestrel-fasit-lcd" aria-hidden>
          <KestrelLcdLines lcd={lcd} />
        </div>
      </div>

      <aside
        className="kestrel-fasit-zoom"
        aria-label="Kestrel-skjerm (forstørret)"
      >
        <div className="kestrel-unit-toggle" role="group" aria-label="Enhet">
          <div className="kestrel-unit-col" role="group" aria-label="MIL">
            {milModes.map(unitButton)}
          </div>
          <div className="kestrel-unit-col" role="group" aria-label="MOA">
            {moaModes.map(unitButton)}
          </div>
        </div>
        <div className="kestrel-zoom-bezel">
          <header className="kestrel-zoom-header">
            <KestrelBirdMark />
            <span className="kestrel-zoom-brand">Kestrel</span>
          </header>
          <div className="kestrel-zoom-lcd">
            <KestrelLcdLines lcd={lcd} />
          </div>
          <footer className="kestrel-zoom-footer">BALLISTICS</footer>
        </div>
        <div
          className="kestrel-range-nudge"
          role="group"
          aria-label="Ballistic range"
        >
          <button
            type="button"
            className="kestrel-range-btn"
            disabled={rangeM <= KESTREL_RANGE_MIN_M}
            aria-label="Reduser range 1 m"
            title="−1 m (hold for raskere)"
            {...leftHold}
          >
            ◀
          </button>
          <span className="kestrel-range-readout" aria-live="polite">
            {rangeM} m
          </span>
          <button
            type="button"
            className="kestrel-range-btn"
            disabled={rangeM >= KESTREL_RANGE_MAX_M}
            aria-label="Øk range 1 m"
            title="+1 m (hold for raskere)"
            {...rightHold}
          >
            ▶
          </button>
        </div>
      </aside>
    </div>
  );
}
