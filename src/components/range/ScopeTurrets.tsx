"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SetStateAction,
} from "react";
import { flushSync } from "react-dom";
import {
  clickSizeMmAt100,
  clickUnitLabel,
  formatClickStepHint,
  mmAt100ToAngular,
  mmAt100ToScopeClicks,
} from "@/lib/optics/clicks";
import {
  DEFAULT_CLICKS_PER_REV_MOA,
  DEFAULT_CLICKS_PER_REV_MRAD,
  type ScopeClickUnit,
} from "@/lib/optics/spec";
import {
  playTurretClick,
  startTurretBurst,
  stopTurretBurst,
} from "@/lib/range/turretAudio";

/**
 * Apply a turret mm nudge via React setState; returns whether the value
 * actually changed (false at zero-stop / travel end — skip click SFX).
 * Uses flushSync so the moved flag is reliable under React 19 batching.
 */
export function turretNudgeMoved(
  setMm: Dispatch<SetStateAction<number>>,
  nextFromPrev: (prev: number) => number,
): boolean {
  let moved = false;
  flushSync(() => {
    setMm((prev) => {
      const next = nextFromPrev(prev);
      moved = next !== prev;
      return next;
    });
  });
  return moved;
}

/** Field HUD tabs — Shooter dials + optional Enviro / Chrono / Kestrel. */
export type ScopeHudTab = "shooter" | "enviro" | "chrono" | "kestrel";

type TurretView = "overhead" | "shooter";

const VIEW_STORAGE_KEY = "toppjakt-scope-hud-tab";

type ScopeTurretsProps = {
  /** Session dial mm-at-100 m (+x = right, +y = down). */
  sessionZeroXMm: number;
  sessionZeroYMm: number;
  /**
   * Apply one click of travel. Return {@code false} when clamped at an
   * end-stop so click SFX is skipped.
   */
  onNudge: (axis: "x" | "y", deltaMm: number) => boolean | void;
  disabled?: boolean;
  /** Equipped scope click unit — drives step size and readouts. */
  clickUnit?: ScopeClickUnit;
  /** Elevation drum clicks per revolution (dual-row face wrap). */
  elevationClicksPerRev?: number;
  /** Windage drum clicks per revolution (R↔L wrap labels). */
  windageClicksPerRev?: number;
  /** Optional actions under/ beside the turrets (save zero, abort, …). */
  actions?: ReactNode;
  /**
   * Enviro tab content (range, wind, DOPE…). When set, shows an Enviro tab
   * — switch away from turrets to read field data.
   */
  enviroPanel?: ReactNode;
  /**
   * Chrono tab (Xero / True Ballistic). Pass when a chronograph is in kit.
   */
  chronoPanel?: ReactNode;
  /**
   * Kestrel / Vindmåler tab content. Only pass when a wind meter is in kit.
   */
  kestrelPanel?: ReactNode;
  /** Tab label — «Kestrel» or «Vindmåler». */
  meterTabLabel?: string;
  /** Fires when the active HUD tab changes (e.g. Enviro time pressure). */
  onHudTabChange?: (tab: ScopeHudTab) => void;
  /**
   * When true, hide sidebar elevation/windage dials (tube layout owns them).
   * Tabs / Enviro / Kestrel still work.
   */
  hideShooterDials?: boolean;
};

function angularLabel(mmAt100: number, unit: ScopeClickUnit): string {
  if (Math.abs(mmAt100) < 0.05) return "0.0";
  const n = mmAt100ToAngular(mmAt100, unit);
  return unit === "MOA" ? n.toFixed(2) : n.toFixed(1);
}

function angularDir(
  mmAt100: number,
  unit: ScopeClickUnit,
  pos: string,
  neg: string,
): string {
  const u = clickUnitLabel(unit);
  if (Math.abs(mmAt100) < 0.05) return u;
  return `${u} ${mmAt100 < 0 ? neg : pos}`;
}

function clickLabel(clicks: number, pos: string, neg: string): string {
  if (clicks === 0) return "0 klikk";
  return `${Math.abs(clicks)} klikk ${clicks < 0 ? neg : pos}`;
}

/** Visual rotation of the overhead turret cap (deg). */
function capRotationDeg(clicks: number): number {
  return clicks * 18;
}

function readStoredTab(allowed: ScopeHudTab[]): ScopeHudTab {
  if (typeof window === "undefined") return "shooter";
  try {
    const v =
      window.localStorage.getItem(VIEW_STORAGE_KEY) ??
      window.localStorage.getItem("toppjakt-scope-turret-view");
    // Legacy "overhead" (Oversikt) → Shooter.
    const normalized = v === "overhead" ? "shooter" : v;
    if (
      normalized === "shooter" ||
      normalized === "enviro" ||
      normalized === "chrono" ||
      normalized === "kestrel"
    ) {
      if (allowed.includes(normalized)) return normalized;
    }
  } catch {
    /* ignore */
  }
  return "shooter";
}

function useHoldRepeat(action: () => boolean, disabled: boolean) {
  const actionRef = useRef(action);
  actionRef.current = action;
  const timersRef = useRef<{ delay?: number; interval?: number }>({});
  const holdingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  function start() {
    if (disabled) return;
    clear();
    holdingRef.current = true;
    const moved = actionRef.current();
    if (!moved) return;
    playTurretClick();
    timersRef.current.delay = window.setTimeout(() => {
      startTurretBurst();
      timersRef.current.interval = window.setInterval(() => {
        if (!actionRef.current()) {
          stopTurretBurst();
          if (timersRef.current.interval != null) {
            window.clearInterval(timersRef.current.interval);
            timersRef.current.interval = undefined;
          }
        }
      }, 70);
    }, 380);
  }

  function clear() {
    stopTurretBurst();
    if (timersRef.current.delay != null) {
      window.clearTimeout(timersRef.current.delay);
    }
    if (timersRef.current.interval != null) {
      window.clearInterval(timersRef.current.interval);
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
      // Same sticky-mouse guard as scope aim / turret drag.
      if (e.pointerType === "mouse" && e.buttons === 0) {
        clear();
      }
    },
    onPointerUp: () => clear(),
    onPointerCancel: () => clear(),
    onLostPointerCapture: () => clear(),
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  };
}

/** Tick width in px — must match CSS `.scope-turret-shooter-tick` size. */
const SHOOTER_TICK_PX_ELEV = 14;
/** Tighter vertical windage hashes (ZCO-style density). */
const SHOOTER_TICK_PX_WIND = 6;
/** How many click-ticks visible on each side of the index (elevation). */
const SHOOTER_HALF_SPAN_ELEV = 8;
/** Windage: fill ~11.5rem drum at 6px/tick (31 marks ≈ 186px). */
const SHOOTER_HALF_SPAN_WIND = 15;
/**
 * Knurl scroll per full turret revolution (px) — matches illumination
 * (`--illum-t * -48px` over full travel).
 */
const KNURL_SHIFT_PER_REV_PX = 48;

type TurretDialProps = {
  title: string;
  axisHint: string;
  kind: "elevation" | "windage";
  view: TurretView;
  /** Raw session clicks (+x R, +y D). */
  clicks: number;
  /**
   * Drum face clicks for shooter view: elevation uses UP-positive (−y),
   * windage uses R-positive (+x).
   */
  faceClicks: number;
  milValue: string;
  milSuffix: string;
  clickText: string;
  disabled?: boolean;
  onNeg: () => boolean;
  onPos: () => boolean;
  /** Called with delta in face-clicks when dragging the shooter drum. */
  onFaceDelta: (deltaClicks: number) => boolean;
  negAria: string;
  posAria: string;
  negMark: string;
  posMark: string;
  /** Fixed base legend under the index (e.g. UP →). Omit to hide. */
  baseLegend?: string;
  /** Hide U/D / L/R hold buttons (drag drum only). */
  hideClickButtons?: boolean;
  /** e.g. "0.1 mil / klikk · …" or "0.25 MOA / klikk · …" */
  stepHint: string;
  clickUnit: ScopeClickUnit;
  /** Clicks in one full turret revolution for this axis (face labels). */
  clicksPerRev: number;
};

function OverheadDrum({
  clicks,
  milValue,
  milSuffix,
  clickText,
  clickUnit,
}: {
  clicks: number;
  milValue: string;
  milSuffix: string;
  clickText: string;
  clickUnit: ScopeClickUnit;
}) {
  const rot = capRotationDeg(clicks);
  /* MRAD: major every 5 (0.5 mil). MOA: major every 4 (1 MOA), semi every 2. */
  const majorEvery = clickUnit === "MOA" ? 4 : 5;
  const semiEvery = clickUnit === "MOA" ? 2 : 0;
  return (
    <div className="scope-turret-drum" aria-hidden>
      <div className="scope-turret-drum-rim">
        {Array.from({ length: 20 }, (_, i) => {
          const isMajor = i % majorEvery === 0;
          const isSemi = !isMajor && semiEvery > 0 && i % semiEvery === 0;
          return (
            <span
              key={i}
              className={
                isMajor
                  ? "scope-turret-hash scope-turret-hash--major"
                  : isSemi
                    ? "scope-turret-hash scope-turret-hash--semi"
                    : "scope-turret-hash"
              }
              style={{
                transform: `rotate(${i * 18}deg) translateY(-2.55rem)`,
              }}
            />
          );
        })}
      </div>
      <div
        className="scope-turret-cap"
        style={{ transform: `rotate(${rot}deg)` }}
      >
        <span className="scope-turret-cap-knurl" />
        <span className="scope-turret-cap-index" />
      </div>
      <div className="scope-turret-readout" aria-live="polite">
        <span className="scope-turret-mil">
          {milValue}
          <small> {milSuffix}</small>
        </span>
        <span className="scope-turret-clicks">{clickText}</span>
      </div>
    </div>
  );
}

/**
 * Drum face markings by click unit:
 * - MRAD: semi every 5 (0.5 mil), numbered every 10 (1 mil)
 * - MOA:  semi every 2 (0.5 MOA), numbered every 4 (1 MOA)
 * Windage: one-rev wrap — R up to half-turn, then L descending back to 0
 *   (e.g. 150 clk/rev → …6R 7R | 7L 6L…).
 * Elevation: dual rows — primary wraps per rev, upper = primary + units/rev.
 */
function clicksPerMajorUnit(unit: ScopeClickUnit): number {
  return unit === "MOA" ? 4 : 10;
}

function formatFaceUnit(units: number): string {
  if (Number.isInteger(units)) return String(units);
  const t = Math.round(units * 100) / 100;
  return String(t);
}

/**
 * Windage drum label for a face-click position, wrapped to one revolution.
 * R-positive face: 0 → …R → half → …L → 0.
 */
export function windageWrapLabel(
  faceClicks: number,
  clicksPerRev: number,
  unit: ScopeClickUnit,
): string {
  const rev = Math.max(4, Math.round(clicksPerRev));
  const major = clicksPerMajorUnit(unit);
  const half = rev / 2;
  const pos = ((Math.round(faceClicks) % rev) + rev) % rev;
  if (pos === 0) return "0";
  if (pos <= half) {
    return `${formatFaceUnit(pos / major)}R`;
  }
  const fromZeroL = rev - pos;
  return `${formatFaceUnit(fromZeroL / major)}L`;
}

function shooterTickMarks(
  tick: number,
  unit: ScopeClickUnit,
  kind: "elevation" | "windage" = "elevation",
  clicksPerRev: number = unit === "MOA"
    ? DEFAULT_CLICKS_PER_REV_MOA
    : DEFAULT_CLICKS_PER_REV_MRAD,
): { isMajor: boolean; isSemi: boolean; label: string; rev2: string } {
  const majorEvery = clicksPerMajorUnit(unit);
  const semiEvery = unit === "MOA" ? 2 : 5;
  const isMajor = tick % majorEvery === 0;
  const isSemi = !isMajor && tick % semiEvery === 0;
  let label = "";
  let rev2 = "";
  if (!isMajor) return { isMajor, isSemi, label, rev2 };

  if (kind === "windage") {
    label = windageWrapLabel(tick, clicksPerRev, unit);
    return { isMajor, isSemi, label, rev2 };
  }

  const unitsPerRev = Math.max(1, Math.round(clicksPerRev / majorEvery));
  const unitVal = Math.trunc(tick / majorEvery);
  const primary = ((unitVal % unitsPerRev) + unitsPerRev) % unitsPerRev;
  label = String(primary);
  rev2 = String(primary + unitsPerRev);
  return { isMajor, isSemi, label, rev2 };
}

function ShooterDrum({
  faceClicks,
  clickUnit,
  clicksPerRev,
  baseLegend,
  kind = "elevation",
  disabled,
  onFaceDelta,
  /** horizontal = top elevation turret; vertical = side windage turret */
  orientation,
  /**
   * +1 = lower face values on the start side (left / top).
   * -1 = reverse scale (elevation: higher UP to the left;
   *      windage: scroll down = R).
   */
  scaleDir,
}: {
  faceClicks: number;
  clickUnit: ScopeClickUnit;
  clicksPerRev: number;
  baseLegend?: string;
  kind?: "elevation" | "windage";
  disabled?: boolean;
  onFaceDelta: (deltaClicks: number) => boolean;
  orientation: "horizontal" | "vertical";
  scaleDir: 1 | -1;
}) {
  const dragRef = useRef<{
    pointerId: number;
    start: number;
    lastEmitted: number;
  } | null>(null);
  const cylinderRef = useRef<HTMLDivElement>(null);

  const halfSpan =
    orientation === "vertical" || kind === "elevation"
      ? SHOOTER_HALF_SPAN_WIND
      : SHOOTER_HALF_SPAN_ELEV;
  const ticks = Array.from({ length: halfSpan * 2 + 1 }, (_, i) => {
    const offset = i - halfSpan;
    return faceClicks + offset * scaleDir;
  });

  function endDrag(el?: HTMLDivElement | null, pointerId?: number) {
    const drag = dragRef.current;
    if (!drag) return;
    if (pointerId != null && drag.pointerId !== pointerId) return;
    dragRef.current = null;
    const target = el ?? cylinderRef.current;
    if (target && target.hasPointerCapture(drag.pointerId)) {
      try {
        target.releasePointerCapture(drag.pointerId);
      } catch {
        /* already released */
      }
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = orientation === "vertical" ? e.clientY : e.clientX;
    dragRef.current = { pointerId: e.pointerId, start, lastEmitted: 0 };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || disabled) return;
    // Trackpad/mouse can drop button-up outside the element — stop if no buttons.
    if (e.pointerType === "mouse" && e.buttons === 0) {
      endDrag(e.currentTarget, e.pointerId);
      return;
    }
    const pos = orientation === "vertical" ? e.clientY : e.clientX;
    const delta = pos - drag.start;
    /* Dragging the drum with the finger: surface follows pointer.
       scaleDir flips which way face value changes for a given drag. */
    const tickPx =
      orientation === "vertical" || kind === "elevation"
        ? SHOOTER_TICK_PX_WIND
        : SHOOTER_TICK_PX_ELEV;
    const clicksMoved = Math.trunc((-delta * scaleDir) / tickPx);
    if (clicksMoved !== drag.lastEmitted) {
      const step = clicksMoved - drag.lastEmitted;
      /* One SFX per hashmark — apply click-by-click so end-stop can cut short. */
      if (step !== 0) {
        const dir = step > 0 ? 1 : -1;
        for (let i = 0; i < Math.abs(step); i++) {
          if (!onFaceDelta(dir)) break;
          playTurretClick();
        }
      }
      drag.lastEmitted = clicksMoved;
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    endDrag(e.currentTarget, e.pointerId);
  }

  function onPointerLeave(e: ReactPointerEvent<HTMLDivElement>) {
    // Only end if buttons already up (leave while held uses capture move).
    if (e.pointerType === "mouse" && e.buttons === 0) {
      endDrag(e.currentTarget, dragRef.current?.pointerId);
    }
  }

  function tickClass(tick: number): string {
    const { isMajor, isSemi } = shooterTickMarks(
      tick,
      clickUnit,
      kind,
      clicksPerRev,
    );
    const isCurrent = tick === faceClicks;
    const parts = ["scope-turret-shooter-tick"];
    if (isMajor) parts.push("is-major");
    else if (isSemi) parts.push("is-semi");
    if (isCurrent) parts.push("is-current");
    return parts.join(" ");
  }

  const rootClass =
    orientation === "vertical"
      ? "scope-turret-shooter scope-turret-shooter--vertical"
      : "scope-turret-shooter scope-turret-shooter--horizontal";

  /* Same sense as illumination: higher face → negative knurl shift. */
  const knurlShiftPx =
    -(faceClicks / Math.max(4, clicksPerRev)) * KNURL_SHIFT_PER_REV_PX;

  const knurlStyle = {
    ["--knurl-shift" as string]: String(knurlShiftPx),
  } as CSSProperties;

  const base = (
    <div className="scope-turret-shooter-base">
      <span className="scope-turret-shooter-index" />
      {baseLegend ? (
        <span className="scope-turret-shooter-legend">
          {baseLegend}
          {kind === "elevation" ? (
            <span className="scope-turret-shooter-legend-arrow" aria-hidden />
          ) : null}
        </span>
      ) : null}
    </div>
  );

  return (
    <div className={rootClass} aria-hidden style={knurlStyle}>
      {orientation === "horizontal" ? (
        <div className="scope-turret-shooter-knurl" />
      ) : null}
      <div className="scope-turret-shooter-main">
        {orientation === "vertical" ? base : null}
        <div
          ref={cylinderRef}
          className="scope-turret-shooter-cylinder"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerLeave}
          onLostPointerCapture={onPointerUp}
          onContextMenu={(ev) => ev.preventDefault()}
          role="presentation"
        >
          <div className="scope-turret-shooter-shade scope-turret-shooter-shade--a" />
          <div className="scope-turret-shooter-shade scope-turret-shooter-shade--b" />
          <div className="scope-turret-shooter-band">
            {ticks.map((tick) => {
              const marks = shooterTickMarks(
                tick,
                clickUnit,
                kind,
                clicksPerRev,
              );
              /* Only engraved majors/semis — no boxed “current click” readout. */
              const label = marks.label;
              return (
                <div key={`${orientation}-${tick}`} className={tickClass(tick)}>
                  {marks.rev2 ? (
                    <span className="scope-turret-shooter-rev2">{marks.rev2}</span>
                  ) : null}
                  {label ? (
                    <span className="scope-turret-shooter-num">{label}</span>
                  ) : null}
                  <span className="scope-turret-shooter-hash" />
                </div>
              );
            })}
          </div>
        </div>
        {/* Index base inside main (like windage) so tube layout can sit flush on hashes. */}
        {orientation === "horizontal" ? base : null}
        {orientation === "vertical" ? (
          <div className="scope-turret-shooter-knurl" />
        ) : null}
      </div>
    </div>
  );
}

function TurretDial({
  title,
  axisHint,
  kind,
  view,
  clicks,
  faceClicks,
  milValue,
  milSuffix,
  clickText,
  disabled = false,
  onNeg,
  onPos,
  onFaceDelta,
  negAria,
  posAria,
  negMark,
  posMark,
  baseLegend,
  hideClickButtons = false,
  stepHint,
  clickUnit,
  clicksPerRev,
}: TurretDialProps) {
  const negHold = useHoldRepeat(onNeg, !!disabled);
  const posHold = useHoldRepeat(onPos, !!disabled);

  return (
    <div
      className={
        disabled
          ? `scope-turret scope-turret--${kind} scope-turret-view--${view} is-disabled`
          : `scope-turret scope-turret--${kind} scope-turret-view--${view}`
      }
      aria-label={title}
    >
      <div className="scope-turret-head">
        <p className="scope-turret-title">{title}</p>
        <p className="scope-turret-axis">{axisHint}</p>
      </div>

      <div className="scope-turret-body">
        {view === "shooter" ? (
          <>
            <ShooterDrum
              faceClicks={faceClicks}
              clickUnit={clickUnit}
              clicksPerRev={clicksPerRev}
              baseLegend={baseLegend}
              kind={kind}
              disabled={disabled}
              onFaceDelta={onFaceDelta}
              orientation={kind === "windage" ? "vertical" : "horizontal"}
              scaleDir={-1}
            />
            {!hideClickButtons ? (
              <div className="scope-turret-click-row">
                <button
                  type="button"
                  className="scope-turret-click scope-turret-click--neg"
                  disabled={disabled}
                  aria-label={negAria}
                  {...negHold}
                >
                  <span aria-hidden>{negMark}</span>
                </button>
                <button
                  type="button"
                  className="scope-turret-click scope-turret-click--pos"
                  disabled={disabled}
                  aria-label={posAria}
                  {...posHold}
                >
                  <span aria-hidden>{posMark}</span>
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <button
              type="button"
              className="scope-turret-click scope-turret-click--neg"
              disabled={disabled}
              aria-label={negAria}
              {...negHold}
            >
              <span aria-hidden>{negMark}</span>
            </button>
            <OverheadDrum
              clicks={clicks}
              milValue={milValue}
              milSuffix={milSuffix}
              clickText={clickText}
              clickUnit={clickUnit}
            />
            <button
              type="button"
              className="scope-turret-click scope-turret-click--pos"
              disabled={disabled}
              aria-label={posAria}
              {...posHold}
            >
              <span aria-hidden>{posMark}</span>
            </button>
          </>
        )}
      </div>

      <p className="scope-turret-readout-line" aria-live="polite">
        <span className="scope-turret-mil">
          {milValue}
          <small> {milSuffix}</small>
        </span>
        <span className="scope-turret-clicks">{clickText}</span>
      </p>
      <p className="scope-turret-step">
        {view === "shooter"
          ? stepHint
          : stepHint.replace("dra trommelen eller hold knapp", "hold for rask dial")}
      </p>
    </div>
  );
}

/**
 * Scope elevation (top turret) + windage (side turret) — dials follow click unit.
 * Tabs: Shooter; optional Enviro / Chrono / Kestrel for field apps.
 */
export function ScopeTurrets({
  sessionZeroXMm,
  sessionZeroYMm,
  onNudge,
  disabled = false,
  clickUnit = "MRAD",
  elevationClicksPerRev,
  windageClicksPerRev,
  actions,
  enviroPanel,
  chronoPanel,
  kestrelPanel,
  meterTabLabel = "Kestrel",
  onHudTabChange,
  hideShooterDials = false,
}: ScopeTurretsProps) {
  const hasEnviro = enviroPanel != null;
  const hasChrono = chronoPanel != null;
  const hasKestrel = kestrelPanel != null;
  const allowedTabs: ScopeHudTab[] = [
    "shooter",
    ...(hasEnviro ? (["enviro"] as const) : []),
    ...(hasChrono ? (["chrono"] as const) : []),
    ...(hasKestrel ? (["kestrel"] as const) : []),
  ];

  const [tab, setTab] = useState<ScopeHudTab>("shooter");
  const clickMm = clickSizeMmAt100(clickUnit);
  const stepHint = formatClickStepHint(clickUnit);
  const elevRev =
    elevationClicksPerRev != null && elevationClicksPerRev >= 4
      ? Math.round(elevationClicksPerRev)
      : clickUnit === "MOA"
        ? DEFAULT_CLICKS_PER_REV_MOA
        : DEFAULT_CLICKS_PER_REV_MRAD;
  const windRev =
    windageClicksPerRev != null && windageClicksPerRev >= 4
      ? Math.round(windageClicksPerRev)
      : elevRev;

  useEffect(() => {
    setTab(readStoredTab(allowedTabs));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- allowedTabs derived from panels
  }, [hasEnviro, hasChrono, hasKestrel]);

  useEffect(() => {
    onHudTabChange?.(tab);
  }, [tab, onHudTabChange]);

  function setAndStoreTab(next: ScopeHudTab) {
    setTab(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const windClicks = mmAt100ToScopeClicks(sessionZeroXMm, clickUnit);
  const elevClicks = mmAt100ToScopeClicks(sessionZeroYMm, clickUnit);
  /* Face: elevation UP-positive, windage R-positive. */
  const elevFace = -elevClicks;
  const windFace = windClicks;

  const turretView: TurretView = "shooter";
  const showTurrets = tab === "shooter" && !hideShooterDials;
  const showEnviro = tab === "enviro" && hasEnviro;
  const showChrono = tab === "chrono" && hasChrono;
  const showKestrel = tab === "kestrel" && hasKestrel;

  return (
    <div
      className={
        showTurrets
          ? "scope-turrets"
          : "scope-turrets scope-turrets--app"
      }
    >
      <div className="scope-turrets-view-toggle" role="tablist" aria-label="Skyte-HUD">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "shooter"}
          className={
            tab === "shooter"
              ? "scope-turrets-view-btn is-active"
              : "scope-turrets-view-btn"
          }
          disabled={disabled}
          onClick={() => setAndStoreTab("shooter")}
        >
          Shooter
        </button>
        {hasEnviro ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "enviro"}
            className={
              tab === "enviro"
                ? "scope-turrets-view-btn is-active"
                : "scope-turrets-view-btn"
            }
            disabled={disabled}
            onClick={() => setAndStoreTab("enviro")}
          >
            Enviro/App
          </button>
        ) : null}
        {hasChrono ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "chrono"}
            className={
              tab === "chrono"
                ? "scope-turrets-view-btn is-active"
                : "scope-turrets-view-btn"
            }
            disabled={disabled}
            onClick={() => setAndStoreTab("chrono")}
          >
            Chrono
          </button>
        ) : null}
        {hasKestrel ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "kestrel"}
            className={
              tab === "kestrel"
                ? "scope-turrets-view-btn is-active"
                : "scope-turrets-view-btn"
            }
            disabled={disabled}
            onClick={() => setAndStoreTab("kestrel")}
          >
            {meterTabLabel}
          </button>
        ) : null}
      </div>

      {showTurrets ? (
        <>
          <TurretDial
            title="Elevation"
            axisHint="Topptårn"
            kind="elevation"
            view={turretView}
            clicks={elevClicks}
            faceClicks={elevFace}
            milValue={angularLabel(sessionZeroYMm, clickUnit)}
            milSuffix={angularDir(sessionZeroYMm, clickUnit, "D", "U")}
            clickText={clickLabel(elevClicks, "ned", "opp")}
            disabled={disabled}
            stepHint={stepHint}
            clickUnit={clickUnit}
            clicksPerRev={elevRev}
            onNeg={() => reportTurretMoved(onNudge("y", -clickMm))}
            onPos={() => reportTurretMoved(onNudge("y", clickMm))}
            onFaceDelta={(d) => {
              /* face UP+ → session y − */
              if (d === 0) return false;
              return reportTurretMoved(onNudge("y", -d * clickMm));
            }}
            negAria="Elevation opp (ett klikk)"
            posAria="Elevation ned (ett klikk)"
            negMark="▲ U"
            posMark="▼ D"
            baseLegend="UP"
          />
          <TurretDial
            title="Windage"
            axisHint="Sidetårn"
            kind="windage"
            view={turretView}
            clicks={windClicks}
            faceClicks={windFace}
            milValue={angularLabel(sessionZeroXMm, clickUnit)}
            milSuffix={angularDir(sessionZeroXMm, clickUnit, "R", "L")}
            clickText={clickLabel(windClicks, "høyre", "venstre")}
            disabled={disabled}
            stepHint={stepHint}
            clickUnit={clickUnit}
            clicksPerRev={windRev}
            onNeg={() => reportTurretMoved(onNudge("x", -clickMm))}
            onPos={() => reportTurretMoved(onNudge("x", clickMm))}
            onFaceDelta={(d) => {
              if (d === 0) return false;
              return reportTurretMoved(onNudge("x", d * clickMm));
            }}
            negAria="Windage venstre (ett klikk)"
            posAria="Windage høyre (ett klikk)"
            negMark="◀"
            posMark="▶"
          />
        </>
      ) : null}

      {showEnviro ? (
        <div className="scope-turrets-app-panel" role="tabpanel">
          {enviroPanel}
        </div>
      ) : null}

      {showChrono ? (
        <div
          className="scope-turrets-app-panel scope-turrets-app-panel--chrono"
          role="tabpanel"
        >
          {chronoPanel}
        </div>
      ) : null}

      {showKestrel ? (
        <div className="scope-turrets-app-panel scope-turrets-app-panel--kestrel" role="tabpanel">
          {kestrelPanel}
        </div>
      ) : null}

      {actions ? <div className="scope-turrets-actions">{actions}</div> : null}
    </div>
  );
}

type ScopeAxisDialProps = {
  sessionZeroMm: number;
  /**
   * Apply mm travel. Return {@code false} at end-stop so click SFX is skipped.
   */
  onNudge: (deltaMm: number) => boolean | void;
  disabled?: boolean;
  clickUnit?: ScopeClickUnit;
  /** Clicks per full revolution for this dial’s drum face. */
  clicksPerRev?: number;
  /** Admin tube: drag-only, no U/D or ◀/▶ buttons. */
  hideClickButtons?: boolean;
};

function reportTurretMoved(result: boolean | void): boolean {
  /* void = treat as moved (legacy); explicit false = end-stop. */
  return result !== false;
}

/** Standalone elevation dial — for tube layout (admin prototype). */
export function ScopeElevationDial({
  sessionZeroMm,
  onNudge,
  disabled = false,
  clickUnit = "MRAD",
  clicksPerRev,
  hideClickButtons = true,
}: ScopeAxisDialProps) {
  const clickMm = clickSizeMmAt100(clickUnit);
  const elevClicks = mmAt100ToScopeClicks(sessionZeroMm, clickUnit);
  const elevFace = -elevClicks;
  const rev =
    clicksPerRev != null && clicksPerRev >= 4
      ? Math.round(clicksPerRev)
      : clickUnit === "MOA"
        ? DEFAULT_CLICKS_PER_REV_MOA
        : DEFAULT_CLICKS_PER_REV_MRAD;
  return (
    <TurretDial
      title="Elevation"
      axisHint="Topptårn"
      kind="elevation"
      view="shooter"
      clicks={elevClicks}
      faceClicks={elevFace}
      milValue={angularLabel(sessionZeroMm, clickUnit)}
      milSuffix={angularDir(sessionZeroMm, clickUnit, "D", "U")}
      clickText={clickLabel(elevClicks, "ned", "opp")}
      disabled={disabled}
      hideClickButtons={hideClickButtons}
      stepHint={formatClickStepHint(clickUnit)}
      clickUnit={clickUnit}
      clicksPerRev={rev}
      onNeg={() => reportTurretMoved(onNudge(-clickMm))}
      onPos={() => reportTurretMoved(onNudge(clickMm))}
      onFaceDelta={(d) => {
        if (d === 0) return false;
        return reportTurretMoved(onNudge(-d * clickMm));
      }}
      negAria="Elevation opp (ett klikk)"
      posAria="Elevation ned (ett klikk)"
      negMark="▲ U"
      posMark="▼ D"
      baseLegend="UP"
    />
  );
}

/** Standalone windage dial — for tube layout (admin prototype). */
export function ScopeWindageDial({
  sessionZeroMm,
  onNudge,
  disabled = false,
  clickUnit = "MRAD",
  clicksPerRev,
  hideClickButtons = true,
}: ScopeAxisDialProps) {
  const clickMm = clickSizeMmAt100(clickUnit);
  const windClicks = mmAt100ToScopeClicks(sessionZeroMm, clickUnit);
  const windFace = windClicks;
  const rev =
    clicksPerRev != null && clicksPerRev >= 4
      ? Math.round(clicksPerRev)
      : clickUnit === "MOA"
        ? DEFAULT_CLICKS_PER_REV_MOA
        : DEFAULT_CLICKS_PER_REV_MRAD;
  return (
    <TurretDial
      title="Windage"
      axisHint="Sidetårn"
      kind="windage"
      view="shooter"
      clicks={windClicks}
      faceClicks={windFace}
      milValue={angularLabel(sessionZeroMm, clickUnit)}
      milSuffix={angularDir(sessionZeroMm, clickUnit, "R", "L")}
      clickText={clickLabel(windClicks, "høyre", "venstre")}
      disabled={disabled}
      hideClickButtons={hideClickButtons}
      stepHint={formatClickStepHint(clickUnit)}
      clickUnit={clickUnit}
      clicksPerRev={rev}
      onNeg={() => reportTurretMoved(onNudge(-clickMm))}
      onPos={() => reportTurretMoved(onNudge(clickMm))}
      onFaceDelta={(d) => {
        if (d === 0) return false;
        return reportTurretMoved(onNudge(d * clickMm));
      }}
      negAria="Windage venstre (ett klikk)"
      posAria="Windage høyre (ett klikk)"
      negMark="◀"
      posMark="▶"
    />
  );
}

