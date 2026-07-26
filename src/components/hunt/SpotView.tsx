"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode } from "react";
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
  resolveOpticAperturePercent,
  opticApertureRadiusPct,
  HABROK_GREEN_MIN_ZOOM,
  HABROK_YELLOW_MIN_ZOOM,
  type LrfSpec,
  type ScopeClickUnit,
} from "@/lib/optics/spec";
import { mmAt100ToAngular } from "@/lib/optics/clicks";
import { compassLabelFromDeg } from "@/lib/aware/ettersok";
import { bearingFromSpotFrame } from "@/lib/hunt/spotCompass";
import { formatHuntClock } from "@/lib/hunt/travel";
import { ThermalCanvas, type ThermalPolarity } from "@/components/hunt/ThermalCanvas";
import {
  ZeissVictoryLrfHud,
  ZEISS_VICTORY_ACQUIRE_MS,
  ZEISS_VICTORY_PHASE_MS,
  isZeissVictoryLrf,
  type ZeissVictoryLrfPhase,
} from "@/components/hunt/lrf/ZeissVictoryLrfHud";
import {
  SigSauerKilo3000LrfHud,
  isSigKilo3000Lrf,
  scheduleSigKiloSequence,
  SIG_KILO_STATUS_TIMEOUT_MS,
  type SigElevDir,
  type SigKiloPhase,
  type SigWindDir,
} from "@/components/hunt/lrf/SigSauerKilo3000LrfHud";
import {
  GenericSigStyleLrfHud,
  scheduleGenericSigLrfSequence,
  usesGenericSigStyleLrfHud,
  type GenericSigLrfPhase,
} from "@/components/hunt/lrf/GenericSigStyleLrfHud";

export type SpotMode = "eyes" | "binos" | "thermal";

export type BirdObservedInfo = {
  placement: BirdVisualPlacement;
  measuredDistanceM: number;
  gameSeconds: number;
  /** True when distance came from LRF lock (not eyes estimate). */
  rangeSource: "lrf" | "estimated";
};

/** LRF identity + error model passed into Spot. */
export type SpotLrfMeta = Pick<LrfSpec, "rangeErrorPercent"> & {
  hasOnboardBallistics?: boolean;
  id?: string;
  brand?: string;
};

/** Onboard LRF hold for Sig (MRAD) / Zeiss (clicks). */
export type SpotLrfHoldSolution = {
  elevClicksAbs: number;
  elevMrad: number;
  elevDir: SigElevDir;
  windMrad: number;
  windDir: SigWindDir;
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
  lrfSpec?: SpotLrfMeta | null;
  /** Thermal zoom when equipped. */
  thermalMagnification?: number;
  /** Thermal sensor block size — higher = poorer resolution. */
  thermalPixelFactor?: number;
  /** Real→game time while in thermal (battery drains at same rate). */
  thermalTimeFactor?: number;
  /** Integrated LRF on thermal unit (Condor CQ35 / Habrok). */
  thermalLrfSpec?: SpotLrfMeta | null;
  /** Habrok-class: thermal binocular replaces separate binos. */
  isThermalBinocular?: boolean;
  thermalMinZoom?: number;
  thermalMaxZoom?: number;
  hasThermalOutline?: boolean;
  hasThermalFusion?: boolean;
  /** Shop price of equipped binos — drives circular bezel thickness. */
  binosPriceNok?: number;
  /** Optional LRF aperture override (e.g. Jula stronger dorul). */
  binosAperturePercent?: number | null;
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
  /** Kestrel in kit — enables Sig-style HUD on non-AB LRFs via BDX link. */
  hasKestrel?: boolean;
  /** Equipped rifle scope click unit — Sig HUD MOA vs MRAD. */
  scopeClickUnit?: ScopeClickUnit;
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
  /**
   * Onboard LRF solution (elev/wind). Null when kit cannot solve.
   */
  solveLrfHold?: (
    distanceM: number,
    shotBearingDeg: number,
  ) => SpotLrfHoldSolution | null;
  /**
   * @deprecated Prefer solveLrfHold — kept for elev-click only callers.
   */
  solveElevClicks?: (
    distanceM: number,
    shotBearingDeg: number,
  ) => number | null;
  /** LRF Engage / eyes lock — parent enters Aware. */
  onBirdObserved: (info: BirdObservedInfo) => void;
  /**
   * Sticky Engage after «Til spotting» from Aware — reopen the same
   * encounter without a new LRF (player may re-range first).
   */
  onResumeEngage?: () => void;
  /** Show Engage as active even without a fresh LRF lock. */
  engageResumeActive?: boolean;
  /** Open Aware overview (skuddpar / stand) without leaving hunt. */
  onOpenAware?: () => void;
  /**
   * Optional: called when LRF locks a bird (before Engage).
   * Admin uses this to select a perch without leaving Spot.
   */
  onBirdRanged?: (info: BirdObservedInfo) => void;
  onDone: (info: { mode: SpotMode; gameSeconds: number }) => void;
  /**
   * Extreme-caution auto-spot: open already in binos, pan on the bird,
   * ready for F / Space LRF.
   */
  initialMode?: SpotMode;
  initialPan?: { x: number; y: number };
  /** Optional controls rendered under the landscape frame (admin, etc.). */
  belowFrame?: React.ReactNode;
  /** Admin: paint perch ids on birds. */
  showPerchLabels?: boolean;
  /**
   * Admin: in eyes mode, show/hide by eyesVisible flag only (ignore distance
   * gate) so calibration of the checkbox is visible immediately.
   */
  adminEyesFlagPreview?: boolean;
  /**
   * Scene editor: F/Space (and LRF button) reports landscape % under reticle
   * even with no bird — for placing/moving perches.
   */
  onPlacePoint?: (pt: { x: number; y: number }) => void;
  /** Extra nodes inside the landscape world (perch draft markers, etc.). */
  worldOverlay?: React.ReactNode;
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
 * Floor for drawn sprite width (% of landscape). Kept modest so far birds
 * under binos zoom are not inflated. LRF / distance still use true widthPct.
 */
const BIRD_SPRITE_MIN_PCT = 0.5;

/**
 * Visual-only shrink vs angular size.
 * Scope-admin scales feed widthPct (Gun looks right). Spotting binos/thermal
 * need extra shrink — same angular % feels larger in the circular FOV.
 * Eyes −15%; binos / thermal −45%.
 */
const SPOT_BIRD_VISUAL_SCALE_EYES = 0.85;
const SPOT_BIRD_VISUAL_SCALE_OPTIC = 0.55;

function BirdOverlay({
  placement,
  onSelect,
  visualScale = 1,
  showPerchLabel = false,
}: {
  placement: BirdVisualPlacement;
  /** Click / activate → same path as a successful LRF lock. */
  onSelect?: (placement: BirdVisualPlacement) => void;
  /** Multiplier on drawn width only (not LRF geometry). */
  visualScale?: number;
  /** Admin: show stable perch id near the bird. */
  showPerchLabel?: boolean;
}) {
  const selectable = !!onSelect;
  const scale = Number.isFinite(visualScale) && visualScale > 0 ? visualScale : 1;
  const drawPct = Math.max(
    placement.widthPct * scale,
    BIRD_SPRITE_MIN_PCT * scale,
  );
  const hitPct = Math.max(drawPct, BIRD_HIT_MIN_PCT);
  const spriteScale = (drawPct / hitPct) * 100;
  const flip = placement.flip ? " scaleX(-1)" : "";
  const perchLabel =
    showPerchLabel && placement.perchId ? (
      <span className="spot-perch-id" aria-hidden>
        {placement.perchId}
      </span>
    ) : null;

  if (!selectable) {
    return (
      <>
        {perchLabel ? (
          <span
            className="spot-perch-id-anchor"
            style={{
              left: `${placement.x}%`,
              top: `${placement.y}%`,
            }}
          >
            {perchLabel}
          </span>
        ) : null}
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
      </>
    );
  }

  return (
    <button
      type="button"
      className="spot-bird-hit"
      aria-label={`Perch ${placement.perchId ?? "?"} · ca. ${placement.distanceM} m — klikk for å låse`}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(placement);
      }}
      style={{
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        width: `${hitPct}%`,
        height: `${hitPct}%`,
        transform: "translate(-50%, -50%)",
      }}
    >
      {perchLabel}
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
  binosAperturePercent = null,
  thermalPriceNok = 0,
  clockMinutes,
  hasBinos,
  hasThermal = false,
  hasLrf = false,
  hasKestrel = false,
  scopeClickUnit = "MRAD",
  binosLabel,
  thermalLabel,
  thermalBatteryGameSec = 0,
  thermalBatteryMaxGameSec = 60 * 60,
  onThermalBatteryDrain,
  onGameSeconds,
  solveLrfHold,
  solveElevClicks,
  onBirdObserved,
  onResumeEngage,
  engageResumeActive = false,
  onOpenAware,
  onBirdRanged,
  onDone,
  initialMode = "eyes",
  initialPan,
  belowFrame,
  showPerchLabels = false,
  adminEyesFlagPreview = false,
  onPlacePoint,
  worldOverlay,
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
      ? resolveOpticAperturePercent(thermalPriceNok || binosPriceNok)
      : resolveOpticAperturePercent(binosPriceNok, binosAperturePercent);
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
  const [zeissPhase, setZeissPhase] = useState<ZeissVictoryLrfPhase>("idle");
  const [zeissRangeM, setZeissRangeM] = useState<number | null>(null);
  const [zeissElevClicks, setZeissElevClicks] = useState<number | null>(null);
  const [sigPhase, setSigPhase] = useState<SigKiloPhase>("off");
  const [genericSigPhase, setGenericSigPhase] =
    useState<GenericSigLrfPhase>("idle");
  const [sigRangeM, setSigRangeM] = useState<number | null>(null);
  const [sigInclineDeg, setSigInclineDeg] = useState<number | null>(null);
  const [sigElevAngular, setSigElevAngular] = useState<number | null>(null);
  const [sigElevMrad, setSigElevMrad] = useState<number | null>(null);
  const [sigElevDir, setSigElevDir] = useState<SigElevDir | null>(null);
  const [sigWindAngular, setSigWindAngular] = useState<number | null>(null);
  const [sigWindMrad, setSigWindMrad] = useState<number | null>(null);
  const [sigWindDir, setSigWindDir] = useState<SigWindDir | null>(null);
  const [rangedBird, setRangedBird] = useState<BirdObservedInfo | null>(null);
  const lrfTimersRef = useRef<number[]>([]);
  const fireLrfRef = useRef<(
    activeLrf: SpotLrfMeta | null,
  ) => void>(() => {});
  const activeLrfRef = useRef<SpotLrfMeta | null>(null);
  const engageRef = useRef<() => void>(() => {});
  const canEngageRef = useRef(false);
  const sigPhaseRef = useRef<SigKiloPhase>("off");
  sigPhaseRef.current = sigPhase;
  const onPlacePointRef = useRef(onPlacePoint);
  onPlacePointRef.current = onPlacePoint;
  const placeModeRef = useRef(!!onPlacePoint);
  placeModeRef.current = !!onPlacePoint;

  function clearLrfTimers() {
    for (const id of lrfTimersRef.current) window.clearTimeout(id);
    lrfTimersRef.current = [];
  }

  function resetLrfHud() {
    clearLrfTimers();
    setLrfReading(null);
    setZeissPhase("idle");
    setZeissRangeM(null);
    setZeissElevClicks(null);
    setSigPhase("off");
    setGenericSigPhase("idle");
    setSigRangeM(null);
    setSigInclineDeg(null);
    setSigElevAngular(null);
    setSigElevMrad(null);
    setSigElevDir(null);
    setSigWindAngular(null);
    setSigWindMrad(null);
    setSigWindDir(null);
  }

  function startZeissSequence(rangeM: number, elevClicks: number | null) {
    clearLrfTimers();
    setLrfReading(null);
    setSigPhase("off");
    setGenericSigPhase("idle");
    setZeissRangeM(rangeM);
    setZeissElevClicks(elevClicks);
    setZeissPhase("idle");
    lrfTimersRef.current.push(
      window.setTimeout(() => {
        setZeissPhase("range");
      }, ZEISS_VICTORY_ACQUIRE_MS),
    );
    lrfTimersRef.current.push(
      window.setTimeout(() => {
        setZeissPhase(elevClicks == null ? "done" : "elev");
      }, ZEISS_VICTORY_ACQUIRE_MS + ZEISS_VICTORY_PHASE_MS),
    );
    if (elevClicks != null) {
      lrfTimersRef.current.push(
        window.setTimeout(() => {
          setZeissPhase("done");
        }, ZEISS_VICTORY_ACQUIRE_MS + ZEISS_VICTORY_PHASE_MS * 2),
      );
    }
  }

  /** Realistic KILO3000 OLED cycle (status already shown). */
  function startKilo3000Sequence(
    rangeM: number,
    inclineDeg: number,
    hold: SpotLrfHoldSolution | null,
  ) {
    clearLrfTimers();
    setLrfReading(null);
    setZeissPhase("idle");
    setGenericSigPhase("idle");
    setSigRangeM(rangeM);
    setSigInclineDeg(inclineDeg);
    const elevAng =
      hold != null
        ? mmAt100ToAngular(hold.elevMrad * 100, scopeClickUnit)
        : null;
    const windAng =
      hold != null
        ? mmAt100ToAngular(hold.windMrad * 100, scopeClickUnit)
        : null;
    setSigElevAngular(elevAng ?? 0);
    setSigElevDir(hold?.elevDir ?? "up");
    setSigWindAngular(windAng ?? 0);
    setSigWindDir(hold?.windDir ?? "right");
    scheduleSigKiloSequence(setSigPhase, (id) => {
      lrfTimersRef.current.push(id);
    });
  }

  /** Legacy Sig-style HUD for Geovid / other AB LRFs. */
  function startGenericSigSequence(
    rangeM: number,
    inclineDeg: number,
    hold: SpotLrfHoldSolution | null,
  ) {
    clearLrfTimers();
    setLrfReading(null);
    setZeissPhase("idle");
    setSigPhase("off");
    setSigRangeM(rangeM);
    setSigInclineDeg(inclineDeg);
    setSigElevMrad(hold?.elevMrad ?? null);
    setSigElevDir(hold?.elevDir ?? null);
    setSigWindMrad(hold?.windMrad ?? null);
    setSigWindDir(hold?.windDir ?? null);
    scheduleGenericSigLrfSequence(
      setGenericSigPhase,
      (id) => {
        lrfTimersRef.current.push(id);
      },
      { skipElev: !hold, skipWind: !hold },
    );
  }

  useEffect(() => () => clearLrfTimers(), []);

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
          setZeissPhase("idle");
          setZeissRangeM(null);
          setZeissElevClicks(null);
          setSigPhase("off");
          setGenericSigPhase("idle");
          setRangedBird(null);
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
      if ((e.key === "e" || e.key === "E") && !e.repeat) {
        if (!canEngageRef.current) return;
        e.preventDefault();
        engageRef.current();
        return;
      }

      const optic =
        modeRef.current === "binos" || modeRef.current === "thermal";
      const lrfKey =
        e.key === "f" ||
        e.key === "F" ||
        e.key === " " ||
        e.code === "Space";
      // Scene editor: F places at lens/frame centre even in eyes mode.
      if (lrfKey && placeModeRef.current) {
        e.preventDefault();
        if (e.repeat) return;
        if (optic) {
          fireLrfRef.current(activeLrfRef.current);
        } else {
          onPlacePointRef.current?.({ x: 50, y: 50 });
        }
        return;
      }
      if (!optic) return;

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
    resetLrfHud();
    setRangedBird(null);
  }

  function leaveToEyes() {
    modeRef.current = "eyes";
    setMode("eyes");
    resetLrfHud();
    setRangedBird(null);
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

  function fireLrf(activeLrf: SpotLrfMeta | null) {
    if (!landscapeReady) return;
    const zeiss = isZeissVictoryLrf(activeLrf);
    const kilo3000 = isSigKilo3000Lrf(activeLrf);
    const genericSig = usesGenericSigStyleLrfHud(activeLrf, {
      hasKestrel,
      isSigKilo3000: kilo3000,
    });

    /**
     * Sig KILO3000 only: 1st F → status HUD; 2nd F → range + elev/wind cycle.
     * Place-mode (admin) skips status and measures immediately.
     */
    if (
      kilo3000 &&
      !placeModeRef.current &&
      sigPhaseRef.current === "off"
    ) {
      clearLrfTimers();
      setLrfReading(null);
      setZeissPhase("idle");
      setGenericSigPhase("idle");
      setSigRangeM(null);
      setSigInclineDeg(null);
      setSigElevAngular(null);
      setSigElevDir(null);
      setSigWindAngular(null);
      setSigWindDir(null);
      setSigPhase("status");
      lrfTimersRef.current.push(
        window.setTimeout(() => {
          if (sigPhaseRef.current === "status") {
            setSigPhase("off");
          }
        }, SIG_KILO_STATUS_TIMEOUT_MS),
      );
      return;
    }

    const visible = birdPlacements.filter((p) =>
      visibleInSpotMode(p.distanceM, mode, {
        habrokZoom: habrokZoomGate,
        eyesVisible: p.eyesVisible,
        adminEyesFlagPreview,
      }),
    );
    const hit = findBirdUnderLrfReticle(visible, pan, zoom);
    const lookX = landscapeAtLensCenter(pan.x, zoom);
    const lookY = landscapeAtLensCenter(pan.y, zoom);
    onPlacePoint?.({
      x: Math.round(lookX * 10) / 10,
      y: Math.round(lookY * 10) / 10,
    });
    const bearing = ((Math.round(
      bearingFromSpotFrame(viewBearingDeg, lookX),
    ) % 360) + 360) % 360;
    /* Cosmetic incline from look angle (up = positive). */
    const inclineDeg = Math.max(
      -25,
      Math.min(25, Math.round((45 - lookY) * 0.4)),
    );

    function resolveHold(distanceM: number): SpotLrfHoldSolution | null {
      if (!activeLrf) return null;
      const canSolve =
        !!activeLrf.hasOnboardBallistics || hasKestrel;
      if (!canSolve) return null;
      if (solveLrfHold) return solveLrfHold(distanceM, bearing);
      if (solveElevClicks) {
        const elev = solveElevClicks(distanceM, bearing);
        if (elev == null) return null;
        return {
          elevClicksAbs: elev,
          elevMrad: elev / 10,
          elevDir: "up",
          windMrad: 0,
          windDir: "right",
        };
      }
      return null;
    }

    function playHud(
      measured: number,
      hold: SpotLrfHoldSolution | null,
    ) {
      if (zeiss) {
        startZeissSequence(measured, hold?.elevClicksAbs ?? null);
      } else if (kilo3000) {
        startKilo3000Sequence(measured, inclineDeg, hold);
      } else if (genericSig) {
        startGenericSigSequence(measured, inclineDeg, hold);
      } else {
        resetLrfHud();
        setLrfReading(`${Math.round(measured)} m`);
      }
    }

    if (hit && activeLrf) {
      const measured =
        Math.round(measureDistanceWithLrf(hit.distanceM, activeLrf) * 10) / 10;
      const hold = resolveHold(measured);
      const contact: BirdObservedInfo = {
        placement: hit,
        measuredDistanceM: measured,
        gameSeconds: lookedRef.current,
        rangeSource: "lrf",
      };
      setRangedBird(contact);
      onBirdRanged?.(contact);
      playHud(measured, hold);
      return;
    }

    const terrain = 80 + Math.floor(Math.random() * 420) + Math.random();
    const terrainRounded = Math.round(terrain * 10) / 10;
    const hold = resolveHold(terrainRounded);
    playHud(terrainRounded, hold);
  }

  /** Eyes / non-LRF bird lock → Aware immediately. */
  function observeBird(
    placement: BirdVisualPlacement,
    ranging: SpotLrfMeta | null,
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

  function engageRangedBird() {
    if (rangedBird) {
      onBirdObserved(rangedBird);
      return;
    }
    onResumeEngage?.();
  }

  const showEngage = !!rangedBird || !!engageResumeActive;
  engageRef.current = engageRangedBird;
  canEngageRef.current = showEngage;

  const lookedClock = formatSpotLookedClock(lookedGameSec);
  const shortBinos = shortSpotOpticLabel(binosLabel);
  const shortThermal = shortSpotOpticLabel(thermalLabel);

  const visibleBirds = birdPlacements
    .filter((p) =>
      visibleInSpotMode(p.distanceM, mode, {
        habrokZoom: habrokZoomGate,
        eyesVisible: p.eyesVisible,
        adminEyesFlagPreview,
      }),
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

  const activeLrf: SpotLrfMeta | null =
    mode === "thermal" && thermalLrfSpec
      ? thermalLrfSpec
      : mode === "binos" && hasLrf
        ? lrfSpec
        : null;
  const showLrf = !!activeLrf;
  const showZeissHud = showLrf && isZeissVictoryLrf(activeLrf);
  const isKilo3000Hud = showLrf && isSigKilo3000Lrf(activeLrf);
  const showGenericSigHud =
    showLrf &&
    usesGenericSigStyleLrfHud(activeLrf, {
      hasKestrel,
      isSigKilo3000: isKilo3000Hud,
    });
  /** KILO OLED only while awake — off = bare binos, ingen LRF-ring. */
  const showKiloHud = isKilo3000Hud && sigPhase !== "off";
  /** Generic LRF ring — budget LRF without AB HUD. */
  const showGenericLrfReticle =
    showLrf && !showZeissHud && !isKilo3000Hud && !showGenericSigHud;
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
    if (onPlacePoint && mode === "eyes") {
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;
      onPlacePoint({
        x: Math.round(xPct * 10) / 10,
        y: Math.round(yPct * 10) / 10,
      });
      return;
    }
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
  const birdVisualScale = isOpticMode
    ? SPOT_BIRD_VISUAL_SCALE_OPTIC
    : SPOT_BIRD_VISUAL_SCALE_EYES;
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
                  ? "Habrok dagoptikk (B/T)"
                  : "Habrok Fusion (B/T)"
                : "Termisk (T)"}
            </button>
          ) : null}
          {mode === "eyes" && hasBinos && !isThermalBinocular ? (
            <button type="button" className="intro-button" onClick={toggleBinos}>
              Kikkert (B)
            </button>
          ) : null}
          {mode === "eyes" ? (
            <>
              {onOpenAware ? (
                <button
                  type="button"
                  className="intro-button"
                  onClick={() => onOpenAware()}
                  title="Aware — skuddpar og siste stand"
                >
                  Aware
                </button>
              ) : null}
              <button
                type="button"
                className="intro-button"
                onClick={() =>
                  onDone({ mode, gameSeconds: lookedRef.current })
                }
              >
                Done
              </button>
            </>
          ) : null}
        </div>
      </header>

      {isOpticMode ? (
        <div className="spot-optic-bar">
          <div
            className="spot-optic-toolbar"
            role="toolbar"
            aria-label="Optikk-kontroller"
          >
            {hasThermal && !habrokBatteryDead ? (
              <>
                <button
                  type="button"
                  className={
                    mode === "thermal" &&
                    (thermalPolarity === "wh" || thermalPolarity === "bh")
                      ? "intro-button"
                      : "intro-button sheriff-secondary"
                  }
                  title={
                    thermalPolarity === "bh"
                      ? "Black-hot — trykk for white-hot"
                      : "White-hot — trykk for black-hot"
                  }
                  onClick={() => {
                    if (mode === "thermal" && thermalPolarity === "wh") {
                      setThermalPolarity("bh");
                    } else if (mode === "thermal" && thermalPolarity === "bh") {
                      setThermalPolarity("wh");
                    } else {
                      setThermalPolarity("wh");
                      enterOpticMode("thermal");
                    }
                  }}
                >
                  {mode === "thermal" &&
                  (thermalPolarity === "wh" || thermalPolarity === "bh")
                    ? thermalPolarity === "bh"
                      ? "BH"
                      : "WH"
                    : "WH/BH"}
                </button>
                {isThermalBinocular && hasThermalOutline ? (
                  <button
                    type="button"
                    className={
                      mode === "thermal" && thermalPolarity === "outline"
                        ? "intro-button"
                        : "intro-button sheriff-secondary"
                    }
                    onClick={() => {
                      setThermalPolarity("outline");
                      enterOpticMode("thermal");
                    }}
                  >
                    Outline
                  </button>
                ) : null}
                {isThermalBinocular && hasThermalFusion ? (
                  <button
                    type="button"
                    className={
                      mode === "thermal" && thermalPolarity === "fusion"
                        ? "intro-button"
                        : "intro-button sheriff-secondary"
                    }
                    onClick={() => {
                      setThermalPolarity("fusion");
                      enterOpticMode("thermal");
                    }}
                  >
                    Fusion
                  </button>
                ) : null}
                <button
                  type="button"
                  className={
                    mode !== "thermal"
                      ? "intro-button"
                      : "intro-button sheriff-secondary"
                  }
                  title="Slå av termisk — sparer batteri (dagoptikk)"
                  onClick={() => {
                    if (isThermalBinocular) {
                      enterOpticMode("binos");
                    } else {
                      leaveToEyes();
                    }
                  }}
                >
                  OFF
                </button>
              </>
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
            {showEngage ? (
              <button
                type="button"
                className={
                  engageResumeActive && !rangedBird
                    ? "intro-button spot-engage-btn is-active"
                    : "intro-button spot-engage-btn"
                }
                onClick={engageRangedBird}
                title={
                  rangedBird
                    ? "E — gå til Aware med ranged fugl"
                    : "E — tilbake til Aware (samme engagement)"
                }
              >
                Engage
              </button>
            ) : null}
            {onOpenAware ? (
              <button
                type="button"
                className="intro-button"
                onClick={() => {
                  onOpenAware();
                }}
                title="Aware — skuddpar og siste stand"
              >
                Aware
              </button>
            ) : null}
            <button
              type="button"
              className="intro-button"
              onClick={() =>
                onDone({ mode, gameSeconds: lookedRef.current })
              }
            >
              Done
            </button>
          </div>

          {isThermalBinocular ? (
            <div className="spot-habrok-zoom">
              <label className="spot-habrok-zoom-label" htmlFor="habrok-zoom">
                Zoom {Math.round(habrokZoom)}×
                <span className="shop-row-note">
                  {" "}
                  ({habrokMin}–{habrokMax}× · termisk/outline: grønn &gt;
                  {HABROK_GREEN_MIN_ZOOM}× · gul &gt;{HABROK_YELLOW_MIN_ZOOM}× ·
                  Fusion: alle fugler)
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
                  visualScale={birdVisualScale}
                  showPerchLabel={showPerchLabels}
                  onSelect={birdClickEnabled ? onBirdClick : undefined}
                />
              ))}
              {worldOverlay}
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
                  visualScale={birdVisualScale}
                  showPerchLabel={showPerchLabels}
                  onSelect={birdClickEnabled ? onBirdClick : undefined}
                />
              ))}
              {worldOverlay}
            </div>
            <div className="spot-optic-vignette" aria-hidden />
            {showZeissHud ? (
              <ZeissVictoryLrfHud
                phase={zeissPhase}
                rangeM={zeissRangeM}
                elevClicks={zeissElevClicks}
              />
            ) : showKiloHud ? (
              <SigSauerKilo3000LrfHud
                phase={sigPhase}
                rangeM={sigRangeM}
                inclineDeg={sigInclineDeg}
                elevAngular={sigElevAngular}
                elevDir={sigElevDir}
                windAngular={sigWindAngular}
                windDir={sigWindDir}
                hasKestrel={hasKestrel}
                clickUnit={scopeClickUnit}
              />
            ) : showGenericSigHud ? (
              <GenericSigStyleLrfHud
                phase={genericSigPhase}
                rangeM={sigRangeM}
                inclineDeg={sigInclineDeg}
                elevMrad={sigElevMrad}
                elevDir={sigElevDir}
                windMrad={sigWindMrad}
                windDir={sigWindDir}
              />
            ) : showGenericLrfReticle ? (
              <span className="spot-lrf-reticle" aria-hidden />
            ) : null}
            {!showZeissHud &&
            !showKiloHud &&
            !showGenericSigHud &&
            showGenericLrfReticle &&
            lrfReading ? (
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
                    visualScale={birdVisualScale}
                    showPerchLabel={showPerchLabels}
                    onSelect={undefined}
                  />
                ))}
                {worldOverlay}
              </div>
            ) : null}
            <ThermalCanvas
              imageSrc={imageSrc}
              birdPlacements={
                thermalPolarity === "fusion" ? fusionOutlineBirds : birdsOnFrame
              }
              birdVisualScale={birdVisualScale}
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
            {showZeissHud ? (
              <ZeissVictoryLrfHud
                phase={zeissPhase}
                rangeM={zeissRangeM}
                elevClicks={zeissElevClicks}
              />
            ) : showKiloHud ? (
              <SigSauerKilo3000LrfHud
                phase={sigPhase}
                rangeM={sigRangeM}
                inclineDeg={sigInclineDeg}
                elevAngular={sigElevAngular}
                elevDir={sigElevDir}
                windAngular={sigWindAngular}
                windDir={sigWindDir}
                hasKestrel={hasKestrel}
                clickUnit={scopeClickUnit}
              />
            ) : showGenericSigHud ? (
              <GenericSigStyleLrfHud
                phase={genericSigPhase}
                rangeM={sigRangeM}
                inclineDeg={sigInclineDeg}
                elevMrad={sigElevMrad}
                elevDir={sigElevDir}
                windMrad={sigWindMrad}
                windDir={sigWindDir}
              />
            ) : showGenericLrfReticle ? (
              <span className="spot-lrf-reticle" aria-hidden />
            ) : null}
            {!showZeissHud &&
            !showKiloHud &&
            !showGenericSigHud &&
            showGenericLrfReticle &&
            lrfReading ? (
              <span className="spot-lrf-readout">{lrfReading}</span>
            ) : null}
          </>
        )}
      </div>
      {belowFrame}
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
              ? "Sirkulært syn · piltaster / dra · LRF på fugl → Engage (E) · F / Space / LRF"
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
