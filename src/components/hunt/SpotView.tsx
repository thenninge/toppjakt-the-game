"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from "react";
import {
  DEFAULT_BINOS_MAGNIFICATION,
  SPOT_TIME_FACTOR_BINOS,
  SPOT_TIME_FACTOR_EYES,
  SPOT_TIME_FACTOR_THERMAL,
} from "@/lib/hunt/images";
import {
  findBirdUnderLrfReticle,
  visibleInSpotMode,
  visibleWithHabrokZoom,
  type BirdVisualPlacement,
} from "@/lib/hunt/birds";
import {
  clampOpticPan,
  landscapeAtLensCenter,
  measureDistanceWithLrf,
  opticAperturePercent,
  opticApertureRadiusPct,
  HABROK_GREEN_MIN_ZOOM,
  HABROK_YELLOW_MIN_ZOOM,
  type LrfSpec,
} from "@/lib/optics/spec";
import { compassLabelFromDeg } from "@/lib/aware/ettersok";
import { bearingFromSpotFrame } from "@/lib/hunt/spotCompass";
import { formatHuntClock } from "@/lib/hunt/travel";
import { ThermalCanvas, type ThermalPolarity } from "@/components/hunt/ThermalCanvas";

export type SpotMode = "eyes" | "binos" | "thermal";

export type BirdObservedInfo = {
  placement: BirdVisualPlacement;
  measuredDistanceM: number;
  gameSeconds: number;
  /** True when distance came from LRF lock (not eyes estimate). */
  rangeSource: "lrf" | "estimated";
};

type SpotViewProps = {
  /** Same landscape for eyes and binos for the whole session. */
  imageSrc: string;
  /** Birds present in this cell, already placed in the landscape. */
  birdPlacements?: BirdVisualPlacement[];
  /**
   * Compass degrees the landscape faces (0 = N). Standard gear —
   * always shown so the player can orient søk / skuddpar.
   */
  viewBearingDeg: number;
  /** Optical magnification of equipped binos (e.g. 10). */
  magnification?: number;
  /** LRF error model — required to range a bird. */
  lrfSpec?: Pick<LrfSpec, "rangeErrorPercent"> | null;
  /** Thermal zoom when equipped. */
  thermalMagnification?: number;
  /** Thermal sensor block size — higher = poorer resolution. */
  thermalPixelFactor?: number;
  /** Real→game time while in thermal (battery drains at same rate). */
  thermalTimeFactor?: number;
  /** Integrated LRF on thermal unit (Condor CQ35 / Habrok). */
  thermalLrfSpec?: Pick<LrfSpec, "rangeErrorPercent"> | null;
  /** Habrok-class: thermal binocular replaces separate binos. */
  isThermalBinocular?: boolean;
  thermalMinZoom?: number;
  thermalMaxZoom?: number;
  hasThermalOutline?: boolean;
  hasThermalFusion?: boolean;
  /** Shop price of equipped binos — drives circular bezel thickness. */
  binosPriceNok?: number;
  /** Shop price of equipped thermal — drives circular bezel thickness. */
  thermalPriceNok?: number;
  /** Absolute hunt clock in minutes (for HUD). */
  clockMinutes: number;
  /** Player has binoculars in kit. */
  hasBinos: boolean;
  /** Player has thermal spotter in kit. */
  hasThermal?: boolean;
  /** Equipped binos have a laser rangefinder. */
  hasLrf?: boolean;
  /** Label for HUD, e.g. brand + name. */
  binosLabel?: string | null;
  thermalLabel?: string | null;
  /** Remaining thermal battery in game-seconds. */
  thermalBatteryGameSec?: number;
  /** Full thermal battery capacity (game-seconds). */
  thermalBatteryMaxGameSec?: number;
  /** Drain battery by thermal game-seconds; return remaining. */
  onThermalBatteryDrain?: (gameSeconds: number) => number;
  /** Called with game-seconds elapsed while looking. */
  onGameSeconds: (seconds: number) => void;
  /** LRF locked a bird — parent enters shoot mode. */
  onBirdObserved: (info: BirdObservedInfo) => void;
  onDone: (info: { mode: SpotMode; gameSeconds: number }) => void;
  /**
   * Extreme-caution auto-spot: open already in binos, pan on the bird,
   * ready for F / Space LRF.
   */
  initialMode?: SpotMode;
  initialPan?: { x: number; y: number };
};

/** Single arrow tap — landscape % step. */
const OPTIC_PAN_TAP_PCT = 0.675;
/** Hold longer than this before continuous pan. */
const OPTIC_PAN_HOLD_MS = 160;
/** Continuous pan speed after hold starts (% / s). */
const OPTIC_PAN_HOLD_SPEED = 14;
/** Extra speed per second of holding (% / s²). */
const OPTIC_PAN_HOLD_ACCEL = 28;
const OPTIC_PAN_HOLD_MAX = 48;

type PanKeys = {
  up: number | null;
  down: number | null;
  left: number | null;
  right: number | null;
};

function spotTimeFactor(mode: SpotMode, thermalTimeFactor: number): number {
  if (mode === "binos") return SPOT_TIME_FACTOR_BINOS;
  if (mode === "thermal") {
    return Number.isFinite(thermalTimeFactor) && thermalTimeFactor > 0
      ? thermalTimeFactor
      : SPOT_TIME_FACTOR_THERMAL;
  }
  return SPOT_TIME_FACTOR_EYES;
}

/**
 * Short HUD optic name — one line with margin (drop zoom/BDX/4K fluff).
 * e.g. "Sig Sauer KILO3000 BDX 10x42" → "Sig Sauer KILO3000"
 */
function shortSpotOpticLabel(
  full: string | null | undefined,
  maxChars = 26,
): string {
  if (!full) return "";
  let s = full
    .replace(/\s+\d+\s*[x×]\s*\d+\w*/gi, "")
    .replace(/\s+\b(BDX|LRF|4K|F2|F1|FFP|SFP)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length <= maxChars) return s;
  const parts = s.split(/\s+/).filter(Boolean);
  let out = parts.slice(0, 2).join(" ");
  if (parts.length >= 3) {
    const three = parts.slice(0, 3).join(" ");
    if (three.length <= maxChars) out = three;
  }
  if (out.length > maxChars) {
    return `${out.slice(0, Math.max(1, maxChars - 1))}…`;
  }
  return out;
}

/** Fixed-width look timer so HUD digits don't reflow the frame. */
function formatSpotLookedClock(totalSec: number): string {
  const m = Math.floor(Math.max(0, totalSec) / 60);
  const s = Math.floor(Math.max(0, totalSec) % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Minimum click/tap target as % of spot frame (sprites can be ~1% wide). */
const BIRD_HIT_MIN_PCT = 4.5;
/**
 * Floor for drawn sprite width (% of landscape). Gul band (~300–500 m) is
 * ~0.45–0.75% by 1/range — easy to lose in the photo / look “behind” it.
 * LRF / distance still use the true placement.widthPct.
 */
const BIRD_SPRITE_MIN_PCT = 0.85;

function BirdOverlay({
  placement,
  onSelect,
}: {
  placement: BirdVisualPlacement;
  /** Click / activate → same path as a successful LRF lock. */
  onSelect?: (placement: BirdVisualPlacement) => void;
}) {
  const selectable = !!onSelect;
  const drawPct = Math.max(placement.widthPct, BIRD_SPRITE_MIN_PCT);
  const hitPct = Math.max(drawPct, BIRD_HIT_MIN_PCT);
  const spriteScale = (drawPct / hitPct) * 100;
  const flip = placement.flip ? " scaleX(-1)" : "";

  if (!selectable) {
    return (
      <img
        src={placement.imageSrc}
        alt=""
        className="spot-bird"
        draggable={false}
        style={{
          left: `${placement.x}%`,
          top: `${placement.y}%`,
          width: `${drawPct}%`,
          transform: `translate(-50%, -50%)${flip}`,
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="spot-bird-hit"
      aria-label={`Fugl ca. ${placement.distanceM} m — klikk for å låse`}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(placement);
      }}
      style={{
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        width: `${hitPct}%`,
        height: `${hitPct}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      <img
        src={placement.imageSrc}
        alt=""
        className="spot-bird spot-bird-in-hit"
        draggable={false}
        style={{
          width: `${spriteScale}%`,
          transform: `translate(-50%, -50%)${flip}`,
        }}
      />
    </button>
  );
}

/** Nearest visible bird within a forgiving radius of a frame click (% coords). */
function findBirdNearPoint(
  placements: BirdVisualPlacement[],
  xPct: number,
  yPct: number,
): BirdVisualPlacement | null {
  let best: BirdVisualPlacement | null = null;
  let bestD2 = Infinity;
  for (const p of placements) {
    const radius = Math.max(p.widthPct / 2, BIRD_HIT_MIN_PCT / 2) * 1.15;
    const dx = p.x - xPct;
    const dy = p.y - yPct;
    const d2 = dx * dx + dy * dy;
    if (d2 <= radius * radius && d2 < bestD2) {
      best = p;
      bestD2 = d2;
    }
  }
  return best;
}

/**
 * Same landscape frame for eyes and binos (identical placement %).
 * Binos = circular crop + real optic zoom; pan is limited by the circular
 * aperture reaching the spotting-image edge (not the rectangular frame).
 * Thermal = pixelated B&W heat map; birds render as muted topp silhouettes.
 */
export function SpotView({
  imageSrc,
  birdPlacements = [],
  viewBearingDeg,
  magnification = DEFAULT_BINOS_MAGNIFICATION,
  lrfSpec = null,
  thermalMagnification = 3,
  thermalPixelFactor = 10,
  thermalTimeFactor = SPOT_TIME_FACTOR_THERMAL,
  thermalLrfSpec = null,
  isThermalBinocular = false,
  thermalMinZoom = 5,
  thermalMaxZoom = 22,
  hasThermalOutline = false,
  hasThermalFusion = false,
  binosPriceNok = 0,
  thermalPriceNok = 0,
  clockMinutes,
  hasBinos,
  hasThermal = false,
  hasLrf = false,
  binosLabel,
  thermalLabel,
  thermalBatteryGameSec = 0,
  thermalBatteryMaxGameSec = 60 * 60,
  onThermalBatteryDrain,
  onGameSeconds,
  onBirdObserved,
  onDone,
  initialMode = "eyes",
  initialPan,
}: SpotViewProps) {
  const binoZoom = Math.max(1, magnification);
  const thermalZoom = Math.max(1, thermalMagnification);
  const thermalFactor =
    Number.isFinite(thermalTimeFactor) && thermalTimeFactor > 0
      ? thermalTimeFactor
      : SPOT_TIME_FACTOR_THERMAL;
  const startMode: SpotMode =
    initialMode === "binos" && hasBinos
      ? "binos"
      : initialMode === "thermal" && hasThermal
        ? "thermal"
        : "eyes";
  const [mode, setMode] = useState<SpotMode>(startMode);
  /** Habrok defaults to Fusion; other thermals start White-hot. */
  const [thermalPolarity, setThermalPolarity] = useState<ThermalPolarity>(() =>
    isThermalBinocular ? "fusion" : "wh",
  );
  const habrokMin = Math.max(1, thermalMinZoom);
  const habrokMax = Math.max(habrokMin, thermalMaxZoom);
  const [habrokZoom, setHabrokZoom] = useState(() =>
    Math.min(
      habrokMax,
      Math.max(habrokMin, thermalMagnification || habrokMin),
    ),
  );
  /** Birds only after landscape — otherwise sprites pop in first and spoil the spot. */
  const [landscapeReady, setLandscapeReady] = useState(false);
  /** Photo aspect (w/h) so the frame does not squash landscapes into one box. */
  const [landAspect, setLandAspect] = useState(1.6);
  /**
   * Spec mag is through the clear circular aperture, not the full frame.
   * Zoom the world by mag×(aperture/100) so the circle shows 1/mag of the eyes view.
   * (Applying mag to the full frame then cropping overstated zoom by ~1/aperture.)
   */
  const opticAperture =
    mode === "thermal" || (mode === "binos" && isThermalBinocular)
      ? opticAperturePercent(thermalPriceNok || binosPriceNok)
      : opticAperturePercent(binosPriceNok);
  const rawMag =
    mode === "thermal"
      ? isThermalBinocular
        ? habrokZoom
        : thermalZoom
      : isThermalBinocular && mode === "binos"
        ? habrokZoom
        : binoZoom;
  const zoom = Math.max(1, rawMag * (opticAperture / 100));
  /** Spec zoom shown on Habrok slider / visibility (not aperture-adjusted). */
  const opticSpecZoom = isThermalBinocular
    ? habrokZoom
    : mode === "thermal"
      ? thermalZoom
      : binoZoom;
  const timeFactor = spotTimeFactor(mode, thermalFactor);
  const [lookedGameSec, setLookedGameSec] = useState(0);
  const lookedRef = useRef(0);
  const modeRef = useRef<SpotMode>(mode);
  modeRef.current = mode;
  const hasBinosRef = useRef(hasBinos);
  hasBinosRef.current = hasBinos;
  const hasThermalRef = useRef(!!hasThermal);
  hasThermalRef.current = !!hasThermal;
  const isHabrokRef = useRef(isThermalBinocular);
  isHabrokRef.current = isThermalBinocular;
  const toggleBinosRef = useRef<() => void>(() => {});
  const toggleThermalRef = useRef<() => void>(() => {});
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const opticApertureRef = useRef(opticAperture);
  opticApertureRef.current = opticAperture;
  const frameRef = useRef<HTMLDivElement>(null);
  const frameSizeRef = useRef({ w: 800, h: 520 });
  const thermalFactorRef = useRef(thermalFactor);
  thermalFactorRef.current = thermalFactor;
  const onGameSecondsRef = useRef(onGameSeconds);
  onGameSecondsRef.current = onGameSeconds;
  const onThermalBatteryDrainRef = useRef(onThermalBatteryDrain);
  onThermalBatteryDrainRef.current = onThermalBatteryDrain;
  const thermalBatteryRef = useRef(thermalBatteryGameSec);
  thermalBatteryRef.current = thermalBatteryGameSec;

  const startPan = {
    x: initialPan?.x ?? 50,
    y: initialPan?.y ?? 50,
  };
  const [pan, setPan] = useState(startPan);
  const panRef = useRef(pan);
  panRef.current = pan;
  const keysRef = useRef<PanKeys>({
    up: null,
    down: null,
    left: null,
    right: null,
  });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  /** Pan stop when the circular aperture hits the landscape edge. */
  function clampPanXY(x: number, y: number): { x: number; y: number } {
    const z = zoomRef.current;
    const ap = opticApertureRef.current;
    const { w, h } = frameSizeRef.current;
    return {
      x: clampOpticPan(x, z, opticApertureRadiusPct(ap, "x", w, h)),
      y: clampOpticPan(y, z, opticApertureRadiusPct(ap, "y", w, h)),
    };
  }

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const sync = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        frameSizeRef.current = { w: rect.width, h: rect.height };
        const next = clampPanXY(panRef.current.x, panRef.current.y);
        if (next.x !== panRef.current.x || next.y !== panRef.current.y) {
          panRef.current = next;
          setPan(next);
        }
      }
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-clamp when zoom / aperture changes (mode switch, price tier).
  useEffect(() => {
    const next = clampPanXY(panRef.current.x, panRef.current.y);
    if (next.x !== panRef.current.x || next.y !== panRef.current.y) {
      panRef.current = next;
      setPan(next);
    }
  }, [zoom, opticAperture]);

  const [lrfReading, setLrfReading] = useState<string | null>(null);
  const fireLrfRef = useRef<(
    activeLrf: Pick<LrfSpec, "rangeErrorPercent"> | null,
  ) => void>(() => {});
  const activeLrfRef = useRef<Pick<LrfSpec, "rangeErrorPercent"> | null>(null);

  // Landscape first — bird <img> tags must not decode before the photo, or they flash alone.
  useEffect(() => {
    let cancelled = false;
    setLandscapeReady(false);
    const img = new Image();
    const markReady = () => {
      if (cancelled) return;
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        setLandAspect(img.naturalWidth / img.naturalHeight);
      }
      setLandscapeReady(true);
    };
    img.addEventListener("load", markReady);
    img.addEventListener("error", markReady);
    img.src = imageSrc;
    if (img.complete && img.naturalWidth > 0) markReady();
    return () => {
      cancelled = true;
      img.removeEventListener("load", markReady);
      img.removeEventListener("error", markReady);
    };
  }, [imageSrc]);

  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const realSec = (now - last) / 1000;
      last = now;
      if (realSec <= 0 || realSec > 2) return;
      const factor = spotTimeFactor(modeRef.current, thermalFactorRef.current);
      if (!Number.isFinite(factor) || factor <= 0) return;
      let gameSec = realSec * factor;
      if (!Number.isFinite(gameSec)) return;
      if (modeRef.current === "thermal" && onThermalBatteryDrainRef.current) {
        const before = thermalBatteryRef.current;
        const left = onThermalBatteryDrainRef.current(gameSec);
        thermalBatteryRef.current = Number.isFinite(left) ? left : 0;
        gameSec = Math.max(0, before - thermalBatteryRef.current);
        if (thermalBatteryRef.current <= 0) {
          // Habrok: fall back to day-optic binos (no WH/BH/outline/fusion).
          if (isHabrokRef.current) {
            modeRef.current = "binos";
            setMode("binos");
          } else {
            modeRef.current = hasBinos ? "binos" : "eyes";
            setMode(modeRef.current);
          }
          setLrfReading(null);
        }
      }
      if (!Number.isFinite(gameSec) || gameSec <= 0) return;
      lookedRef.current += gameSec;
      setLookedGameSec(lookedRef.current);
      onGameSecondsRef.current(gameSec);
    }, 200);
    return () => window.clearInterval(id);
  }, [hasBinos]);

  useEffect(() => {
    function nudge(dx: number, dy: number) {
      const next = clampPanXY(panRef.current.x + dx, panRef.current.y + dy);
      panRef.current = next;
      setPan(next);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDone({ mode: modeRef.current, gameSeconds: lookedRef.current });
        return;
      }

      if ((e.key === "b" || e.key === "B") && !e.repeat) {
        if (!hasBinosRef.current) return;
        e.preventDefault();
        toggleBinosRef.current();
        return;
      }
      if ((e.key === "t" || e.key === "T") && !e.repeat) {
        if (!hasThermalRef.current) return;
        e.preventDefault();
        toggleThermalRef.current();
        return;
      }

      const optic =
        modeRef.current === "binos" || modeRef.current === "thermal";
      if (!optic) return;

      const lrfKey =
        e.key === "f" ||
        e.key === "F" ||
        e.key === " " ||
        e.code === "Space";
      if (lrfKey && activeLrfRef.current) {
        e.preventDefault();
        if (e.repeat) return;
        fireLrfRef.current(activeLrfRef.current);
        return;
      }

      const dir =
        e.key === "ArrowUp"
          ? "up"
          : e.key === "ArrowDown"
            ? "down"
            : e.key === "ArrowLeft"
              ? "left"
              : e.key === "ArrowRight"
                ? "right"
                : null;
      if (!dir) return;
      e.preventDefault();
      if (keysRef.current[dir] != null) return;

      const now = performance.now();
      keysRef.current[dir] = now;
      // Tap = one small step (hold continues in rAF).
      const step = OPTIC_PAN_TAP_PCT;
      if (dir === "up") nudge(0, -step);
      if (dir === "down") nudge(0, step);
      if (dir === "left") nudge(-step, 0);
      if (dir === "right") nudge(step, 0);
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "ArrowUp") keysRef.current.up = null;
      if (e.key === "ArrowDown") keysRef.current.down = null;
      if (e.key === "ArrowLeft") keysRef.current.left = null;
      if (e.key === "ArrowRight") keysRef.current.right = null;
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [onDone]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const optic =
        modeRef.current === "binos" || modeRef.current === "thermal";
      if (optic) {
        const k = keysRef.current;
        let dx = 0;
        let dy = 0;
        const holdSpeed = (since: number | null): number => {
          if (since == null) return 0;
          const held = now - since;
          if (held < OPTIC_PAN_HOLD_MS) return 0;
          const t = (held - OPTIC_PAN_HOLD_MS) / 1000;
          return Math.min(
            OPTIC_PAN_HOLD_MAX,
            OPTIC_PAN_HOLD_SPEED + t * OPTIC_PAN_HOLD_ACCEL,
          );
        };
        dy -= holdSpeed(k.up) * dt;
        dy += holdSpeed(k.down) * dt;
        dx -= holdSpeed(k.left) * dt;
        dx += holdSpeed(k.right) * dt;
        if (dx !== 0 || dy !== 0) {
          const next = clampPanXY(
            panRef.current.x + dx,
            panRef.current.y + dy,
          );
          panRef.current = next;
          setPan(next);
        }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function enterOpticMode(targetMode: "binos" | "thermal") {
    const center = { x: 50, y: 50 };
    panRef.current = center;
    setPan(center);
    modeRef.current = targetMode;
    setMode(targetMode);
    setLrfReading(null);
  }

  function leaveToEyes() {
    modeRef.current = "eyes";
    setMode("eyes");
    setLrfReading(null);
  }

  /** Habrok: B and T both toggle Fusion thermal ↔ eyes (dead battery → day optic). */
  function toggleHabrok() {
    if (thermalBatteryRef.current <= 0) {
      if (modeRef.current === "binos" || modeRef.current === "thermal") {
        leaveToEyes();
        return;
      }
      enterOpticMode("binos");
      return;
    }
    if (modeRef.current === "thermal") {
      leaveToEyes();
      return;
    }
    setThermalPolarity("fusion");
    enterOpticMode("thermal");
  }

  function toggleBinos() {
    if (isThermalBinocular) {
      toggleHabrok();
      return;
    }
    if (!hasBinos) return;
    if (modeRef.current === "binos") {
      leaveToEyes();
      return;
    }
    enterOpticMode("binos");
  }

  function toggleThermal() {
    if (isThermalBinocular) {
      toggleHabrok();
      return;
    }
    if (!hasThermal) return;
    if (modeRef.current === "thermal") {
      leaveToEyes();
      return;
    }
    if (thermalBatteryRef.current <= 0) return;
    enterOpticMode("thermal");
  }

  toggleBinosRef.current = toggleBinos;
  toggleThermalRef.current = toggleThermal;

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (mode !== "binos" && mode !== "thermal") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y,
    };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const sensX = (100 / Math.max(1, rect.width)) / zoom;
    const sensY = (100 / Math.max(1, rect.height)) / zoom;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const nextX = drag.origX - dx * sensX * 1.15;
    const nextY = drag.origY - dy * sensY * 1.15;
    const next = clampPanXY(nextX, nextY);
    panRef.current = next;
    setPan(next);
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  }

  /** Habrok: WH/BH/Outline + dagoptikk gate far birds by zoom. Fusion shows all birds. */
  const habrokZoomGate =
    isThermalBinocular &&
    (mode === "binos" ||
      (mode === "thermal" && thermalPolarity !== "fusion"))
      ? opticSpecZoom
      : null;

  function fireLrf(activeLrf: Pick<LrfSpec, "rangeErrorPercent"> | null) {
    if (!landscapeReady) return;
    const visible = birdPlacements.filter((p) =>
      visibleInSpotMode(p.distanceM, mode, { habrokZoom: habrokZoomGate }),
    );
    const hit = findBirdUnderLrfReticle(visible, pan, zoom);
    if (hit && activeLrf) {
      observeBird(hit, activeLrf);
      return;
    }
    const terrain = 80 + Math.floor(Math.random() * 420);
    setLrfReading(`${terrain} m`);
  }

  /** Lock a spotted bird → Aware / shoot (same entry as LRF hit). */
  function observeBird(
    placement: BirdVisualPlacement,
    ranging: Pick<LrfSpec, "rangeErrorPercent"> | null,
  ) {
    const measured = ranging
      ? Math.round(measureDistanceWithLrf(placement.distanceM, ranging))
      : Math.round(placement.distanceM);
    setLrfReading(`${measured} m`);
    onBirdObserved({
      placement,
      measuredDistanceM: measured,
      gameSeconds: lookedRef.current,
      rangeSource: ranging ? "lrf" : "estimated",
    });
  }

  const lookedClock = formatSpotLookedClock(lookedGameSec);
  const shortBinos = shortSpotOpticLabel(binosLabel);
  const shortThermal = shortSpotOpticLabel(thermalLabel);

  const visibleBirds = birdPlacements
    .filter((p) =>
      visibleInSpotMode(p.distanceM, mode, { habrokZoom: habrokZoomGate }),
    )
    // Far first → nearer sprites paint on top when perches overlap.
    .slice()
    .sort((a, b) => b.distanceM - a.distanceM);
  /** Never mount bird sprites until the landscape has painted. */
  const birdsOnFrame = landscapeReady ? visibleBirds : [];
  /** Fusion: day-optic birds always; red outline only when Habrok zoom rules pass. */
  const fusionOutlineBirds =
    mode === "thermal" && thermalPolarity === "fusion" && isThermalBinocular
      ? birdsOnFrame.filter((p) =>
          visibleWithHabrokZoom(p.distanceM, opticSpecZoom),
        )
      : birdsOnFrame;

  const activeLrf =
    mode === "thermal" && thermalLrfSpec
      ? thermalLrfSpec
      : mode === "binos" && hasLrf
        ? lrfSpec
        : null;
  const showLrf = !!activeLrf;
  fireLrfRef.current = fireLrf;
  activeLrfRef.current = activeLrf;

  /** Eyes always; binos only without LRF reticle. Never with LRF / thermal. */
  const birdClickEnabled =
    landscapeReady &&
    (mode === "eyes" || (mode === "binos" && !showLrf));

  function onBirdClick(placement: BirdVisualPlacement) {
    if (!birdClickEnabled) return;
    observeBird(placement, activeLrf);
  }

  function onFrameClick(e: MouseEvent<HTMLDivElement>) {
    if (!birdClickEnabled || mode !== "eyes") return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const hit = findBirdNearPoint(birdsOnFrame, xPct, yPct);
    if (hit) onBirdClick(hit);
  }

  const habrokBatteryDead =
    isThermalBinocular && thermalBatteryGameSec <= 0;

  const modeTitle =
    mode === "binos"
      ? isThermalBinocular
        ? `Habrok ${Math.round(opticSpecZoom)}×${shortThermal ? ` — ${shortThermal}` : ""}`
        : `Kikkert ${binoZoom}×${shortBinos ? ` — ${shortBinos}` : ""}`
      : mode === "thermal"
        ? `${isThermalBinocular ? "Habrok" : "Termisk"} ${opticSpecZoom.toFixed(isThermalBinocular ? 0 : 1)}×${shortThermal ? ` — ${shortThermal}` : ""}`
        : "Spotting med øynene";
  const modeTitleFull =
    mode === "binos"
      ? isThermalBinocular
        ? `Habrok ${Math.round(opticSpecZoom)}×${thermalLabel ? ` — ${thermalLabel}` : ""}${habrokBatteryDead ? " — batteri tomt, kun dagoptikk" : ""}`
        : `Kikkert ${binoZoom}×${binosLabel ? ` — ${binosLabel}` : ""}`
      : mode === "thermal"
        ? `${isThermalBinocular ? "Habrok" : "Termisk"} ${opticSpecZoom.toFixed(isThermalBinocular ? 0 : 1)}×${thermalLabel ? ` — ${thermalLabel}` : ""}`
        : modeTitle;

  const isOpticMode = mode === "binos" || mode === "thermal";
  const frameStyle = {
    "--spot-ar": String(landAspect),
    ...(isOpticMode ? { "--optic-aperture": String(opticAperture) } : {}),
  } as CSSProperties;

  /**
   * Live look direction: landscape under optic centre (not the pan param).
   */
  const lookXPct = isOpticMode
    ? landscapeAtLensCenter(pan.x, zoom)
    : 50;
  const lookBearingDeg = bearingFromSpotFrame(viewBearingDeg, lookXPct);
  const lookBearing = ((Math.round(lookBearingDeg) % 360) + 360) % 360;
  const lookCompass = compassLabelFromDeg(lookBearing);

  /** Same % coordinate system for eyes / binos / thermal. */
  const worldStyle = {
    width: `${zoom * 100}%`,
    height: `${zoom * 100}%`,
    left: `${(1 - zoom) * pan.x}%`,
    top: `${(1 - zoom) * pan.y}%`,
  } as const;

  /** Eyes = zoom 1, pan irrelevant; still same world box as optics. */
  const eyesWorldStyle = {
    width: "100%",
    height: "100%",
    left: "0%",
    top: "0%",
  } as const;

  const battMin = Math.max(
    0,
    Math.ceil(thermalBatteryGameSec / 60),
  );
  const battPct =
    thermalBatteryMaxGameSec > 0
      ? Math.round((thermalBatteryGameSec / thermalBatteryMaxGameSec) * 100)
      : 0;

  return (
    <div className="spot-view" role="dialog" aria-modal="true" aria-label="Spotting">
      <header className="spot-view-hud">
        <div className="spot-view-hud-text">
          <p
            className="intro-line intro-gift spot-view-hud-title"
            title={modeTitleFull}
          >
            {modeTitle}
          </p>
          {habrokBatteryDead && mode === "binos" ? (
            <p className="shop-row-note spot-view-hud-status">
              Batteri tomt — dagoptikk
            </p>
          ) : null}
          <p className="shop-row-note spot-view-hud-meta">
            Kl {formatHuntClock(clockMinutes)} · sett i {lookedClock}
            {" · tid ×"}
            {timeFactor}
            {isOpticMode ? " · piltaster / dra" : ""}
            {hasThermal
              ? ` · batt ${String(battMin).padStart(2, "0")}m (${String(battPct).padStart(2, "0")}%)`
              : ""}
          </p>
        </div>
        <div className="spot-view-actions">
          {mode === "eyes" && hasThermal ? (
            <button
              type="button"
              className="intro-button"
              onClick={toggleThermal}
              disabled={thermalBatteryGameSec <= 0 && !isThermalBinocular}
              title={
                thermalBatteryGameSec <= 0
                  ? isThermalBinocular
                    ? "Batteri tomt — kun dagoptikk (vanlig kikkert)"
                    : "Batteri tomt"
                  : `Batteri ${battMin} min igjen`
              }
            >
              {isThermalBinocular
                ? thermalBatteryGameSec <= 0
                  ? "Use Habrok dagoptikk (B/T)"
                  : "Use Habrok Fusion (B/T)"
                : "Use thermal (T)"}
            </button>
          ) : null}
          {mode === "eyes" && hasBinos && !isThermalBinocular ? (
            <button type="button" className="intro-button" onClick={toggleBinos}>
              Use binos (B)
            </button>
          ) : null}
          {mode === "binos" && hasThermal && !habrokBatteryDead ? (
            <button
              type="button"
              className="intro-button"
              onClick={toggleThermal}
              disabled={thermalBatteryGameSec <= 0}
              title={
                thermalBatteryGameSec <= 0
                  ? "Batteri tomt"
                  : `Batteri ${battMin} min igjen`
              }
            >
              {isThermalBinocular ? "Use Habrok termisk (T)" : "Use thermal (T)"}
            </button>
          ) : null}
          {mode === "thermal" && hasBinos && !isThermalBinocular ? (
            <button type="button" className="intro-button" onClick={toggleBinos}>
              Use binos (B)
            </button>
          ) : null}
          {mode === "thermal" && isThermalBinocular ? (
            <>
              <button
                type="button"
                className={
                  thermalPolarity === "wh"
                    ? "intro-button"
                    : "intro-button sheriff-secondary"
                }
                onClick={() => setThermalPolarity("wh")}
              >
                WH
              </button>
              <button
                type="button"
                className={
                  thermalPolarity === "bh"
                    ? "intro-button"
                    : "intro-button sheriff-secondary"
                }
                onClick={() => setThermalPolarity("bh")}
              >
                BH
              </button>
              {hasThermalOutline ? (
                <button
                  type="button"
                  className={
                    thermalPolarity === "outline"
                      ? "intro-button"
                      : "intro-button sheriff-secondary"
                  }
                  onClick={() => setThermalPolarity("outline")}
                >
                  Outline
                </button>
              ) : null}
              {hasThermalFusion ? (
                <button
                  type="button"
                  className={
                    thermalPolarity === "fusion"
                      ? "intro-button"
                      : "intro-button sheriff-secondary"
                  }
                  onClick={() => setThermalPolarity("fusion")}
                >
                  Fusion
                </button>
              ) : null}
            </>
          ) : mode === "thermal" ? (
            <button
              type="button"
              className="intro-button sheriff-secondary"
              onClick={() =>
                setThermalPolarity((p) => (p === "wh" ? "bh" : "wh"))
              }
              title={
                thermalPolarity === "wh"
                  ? "White-hot — trykk for black-hot"
                  : "Black-hot — trykk for white-hot"
              }
            >
              {thermalPolarity === "wh" ? "WH" : "BH"}
            </button>
          ) : null}
          {isOpticMode ? (
            <button
              type="button"
              className="intro-button"
              onClick={leaveToEyes}
            >
              Eyes only
            </button>
          ) : null}
          {showLrf ? (
            <button
              type="button"
              className="intro-button spot-lrf-btn"
              onClick={() => fireLrf(activeLrf)}
              title="F eller Space"
            >
              LRF
            </button>
          ) : null}
          <button
            type="button"
            className="intro-button"
            onClick={() =>
              onDone({ mode, gameSeconds: lookedRef.current })
            }
          >
            Done spotting/map
          </button>
        </div>
      </header>

      {isThermalBinocular && (mode === "thermal" || mode === "binos") ? (
        <div className="spot-habrok-zoom">
          <label className="spot-habrok-zoom-label" htmlFor="habrok-zoom">
            Zoom {Math.round(habrokZoom)}×
            <span className="shop-row-note">
              {" "}
              ({habrokMin}–{habrokMax}× · termisk/outline: grønn &gt;
              {HABROK_GREEN_MIN_ZOOM}× · gul &gt;{HABROK_YELLOW_MIN_ZOOM}× ·
              Fusion: alle fugler, outline følger zoom)
              {habrokBatteryDead ? " · ingen termisk" : ""}
            </span>
          </label>
          <input
            id="habrok-zoom"
            type="range"
            className="spot-habrok-zoom-slider"
            min={habrokMin}
            max={habrokMax}
            step={1}
            value={habrokZoom}
            onChange={(e) => setHabrokZoom(Number(e.target.value))}
          />
        </div>
      ) : null}

      <div
        ref={frameRef}
        className={
          mode === "binos"
            ? "spot-eyes-frame spot-binos-frame"
            : mode === "thermal"
              ? "spot-eyes-frame spot-thermal-frame"
              : "spot-eyes-frame spot-eyes-frame-clickable"
        }
        style={frameStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onFrameClick}
      >
        <div
          className="spot-compass"
          role="img"
          aria-label={`Kompass — ser mot ${lookCompass} (${lookBearing}°)`}
        >
          <span className="spot-compass-caption">Ser mot</span>
          <span
            className="spot-compass-needle"
            style={{ transform: `rotate(${lookBearing}deg)` }}
            aria-hidden
          />
          <span className="spot-compass-dir">{lookCompass}</span>
          <span className="spot-compass-deg">{lookBearing}°</span>
        </div>
        {mode === "eyes" ? (
          <>
            <div className="spot-binos-world" style={eyesWorldStyle}>
              <img
                src={imageSrc}
                alt="Landskap"
                className="spot-binos-world-img"
                draggable={false}
                onLoad={() => setLandscapeReady(true)}
              />
              {birdsOnFrame.map((p) => (
                <BirdOverlay
                  key={p.birdId}
                  placement={p}
                  onSelect={birdClickEnabled ? onBirdClick : undefined}
                />
              ))}
            </div>
          </>
        ) : mode === "binos" ? (
          <>
            <div className="spot-binos-world" style={worldStyle}>
              <img
                src={imageSrc}
                alt=""
                className="spot-binos-world-img"
                draggable={false}
                onLoad={() => setLandscapeReady(true)}
              />
              {birdsOnFrame.map((p) => (
                <BirdOverlay
                  key={p.birdId}
                  placement={p}
                  onSelect={birdClickEnabled ? onBirdClick : undefined}
                />
              ))}
            </div>
            <div className="spot-optic-vignette" aria-hidden />
            {showLrf ? (
              <span className="spot-lrf-reticle" aria-hidden />
            ) : null}
            {showLrf && lrfReading ? (
              <span className="spot-lrf-readout">{lrfReading}</span>
            ) : null}
          </>
        ) : (
          <>
            {thermalPolarity === "fusion" ? (
              <div className="spot-binos-world" style={worldStyle}>
                <img
                  src={imageSrc}
                  alt=""
                  className="spot-binos-world-img"
                  draggable={false}
                  onLoad={() => setLandscapeReady(true)}
                />
                {birdsOnFrame.map((p) => (
                  <BirdOverlay
                    key={p.birdId}
                    placement={p}
                    onSelect={undefined}
                  />
                ))}
              </div>
            ) : null}
            <ThermalCanvas
              imageSrc={imageSrc}
              birdPlacements={
                thermalPolarity === "fusion" ? fusionOutlineBirds : birdsOnFrame
              }
              pan={pan}
              zoom={zoom}
              pixelFactor={thermalPixelFactor}
              polarity={
                isThermalBinocular
                  ? thermalPolarity
                  : thermalPolarity === "bh"
                    ? "bh"
                    : "wh"
              }
              className={
                thermalPolarity === "fusion"
                  ? "spot-thermal-canvas spot-thermal-canvas--fusion"
                  : "spot-thermal-canvas"
              }
              onLandscapeReady={() => setLandscapeReady(true)}
            />
            {thermalPolarity !== "fusion" ? (
              <div className="spot-thermal-scanlines" aria-hidden />
            ) : null}
            <div className="spot-optic-vignette" aria-hidden />
            {showLrf ? (
              <span className="spot-lrf-reticle" aria-hidden />
            ) : null}
            {showLrf && lrfReading ? (
              <span className="spot-lrf-readout">{lrfReading}</span>
            ) : null}
          </>
        )}
      </div>
      {mode === "eyes" ? (
        <p className="spot-binos-hint">
          Kompass øverst viser retning — rød/lilla fugl: klikk for å låse
          {isThermalBinocular
            ? thermalBatteryGameSec <= 0
              ? " · B/T = Habrok dagoptikk"
              : " · B/T = Habrok Fusion"
            : null}
          {!isThermalBinocular && hasBinos ? " · B = kikkert" : ""}
          {!isThermalBinocular && hasThermal ? " · T = termisk" : ""}
        </p>
      ) : null}
      {mode === "binos" ? (
        <p className="spot-binos-hint">
          {isThermalBinocular && habrokBatteryDead
            ? "Habrok dagoptikk (batteri tomt) — ingen WH/BH/Outline/Fusion · piltaster / dra"
            : showLrf
              ? "Sirkulært syn · piltaster / dra · sikt med rød sirkel og trykk F / Space / LRF"
              : "Sirkulært syn · piltaster / dra · klikk på fuglen for å låse (ingen LRF)"}
          {isThermalBinocular
            ? habrokBatteryDead
              ? " · T/B = lukk"
              : " · T/B = lukk Habrok"
            : " · B = av kikkert"}
          {hasThermal && !isThermalBinocular ? " · T = termisk" : ""}
          {(binosPriceNok > 0 || (isThermalBinocular && thermalPriceNok > 0))
            ? ` · blender ${opticAperture}%`
            : ""}
        </p>
      ) : null}
      {mode === "thermal" ? (
        <p className="spot-binos-hint">
          Sirkulært termisk syn · piltaster / dra ·{" "}
          {thermalPolarity === "wh"
            ? "WH: varm = hvit"
            : thermalPolarity === "bh"
              ? "BH: varm = svart"
              : thermalPolarity === "outline"
                ? "Outline: termisk + rød kant"
                : "Fusion: alle fugler som kikkert · rød outline først ved zoom (grønn >10× / gul >15×)"}
          {showLrf ? " · LRF integrert" : ""}
          {" · T/B = av"}
          {hasBinos && !isThermalBinocular ? " · B = kikkert" : ""}
          {thermalPriceNok > 0
            ? ` · blender ${opticAperture}% (dyrere = tynnere ramme)`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
