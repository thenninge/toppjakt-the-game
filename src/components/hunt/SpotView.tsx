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
  type BirdVisualPlacement,
} from "@/lib/hunt/birds";
import {
  measureDistanceWithLrf,
  opticAperturePercent,
  type LrfSpec,
} from "@/lib/optics/spec";
import { compassLabelFromDeg } from "@/lib/aware/ettersok";
import { bearingFromSpotFrame } from "@/lib/hunt/spotCompass";
import { formatHuntClock } from "@/lib/hunt/travel";
import { ThermalCanvas } from "@/components/hunt/ThermalCanvas";

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
  /** Integrated LRF on thermal unit (Condor CQ35). */
  thermalLrfSpec?: Pick<LrfSpec, "rangeErrorPercent"> | null;
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

/** Minimum click/tap target as % of spot frame (sprites can be ~1% wide). */
const BIRD_HIT_MIN_PCT = 4.5;

function BirdOverlay({
  placement,
  onSelect,
}: {
  placement: BirdVisualPlacement;
  /** Click / activate → same path as a successful LRF lock. */
  onSelect?: (placement: BirdVisualPlacement) => void;
}) {
  const selectable = !!onSelect;
  const hitPct = Math.max(placement.widthPct, BIRD_HIT_MIN_PCT);
  const spriteScale = (placement.widthPct / hitPct) * 100;
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
          width: `${placement.widthPct}%`,
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

function clampPan(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * Same landscape frame for eyes and binos (identical placement %).
 * Binos = circular crop + real optic zoom; pan 0–100 covers the full eyes view.
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
  /** Birds only after landscape — otherwise sprites pop in first and spoil the spot. */
  const [landscapeReady, setLandscapeReady] = useState(false);
  const zoom = mode === "thermal" ? thermalZoom : binoZoom;
  const timeFactor = spotTimeFactor(mode, thermalFactor);
  const [lookedGameSec, setLookedGameSec] = useState(0);
  const lookedRef = useRef(0);
  const modeRef = useRef<SpotMode>(mode);
  modeRef.current = mode;
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
      if (!cancelled) setLandscapeReady(true);
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
          modeRef.current = hasBinos ? "binos" : "eyes";
          setMode(modeRef.current);
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
      const next = {
        x: clampPan(panRef.current.x + dx),
        y: clampPan(panRef.current.y + dy),
      };
      panRef.current = next;
      setPan(next);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDone({ mode: modeRef.current, gameSeconds: lookedRef.current });
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
          const next = {
            x: clampPan(panRef.current.x + dx),
            y: clampPan(panRef.current.y + dy),
          };
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
    setMode(targetMode);
    setLrfReading(null);
  }

  function enterBinos() {
    enterOpticMode("binos");
  }

  function enterThermal() {
    if (thermalBatteryGameSec <= 0) return;
    enterOpticMode("thermal");
  }

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
    const nextX = clampPan(drag.origX - dx * sensX * 1.15);
    const nextY = clampPan(drag.origY - dy * sensY * 1.15);
    const next = { x: nextX, y: nextY };
    panRef.current = next;
    setPan(next);
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  }

  function fireLrf(activeLrf: Pick<LrfSpec, "rangeErrorPercent"> | null) {
    if (!landscapeReady) return;
    const visible = birdPlacements.filter((p) =>
      visibleInSpotMode(p.distanceM, mode),
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

  const lookedMin = Math.floor(lookedGameSec / 60);
  const lookedSec = Math.floor(lookedGameSec % 60);

  const visibleBirds = birdPlacements.filter((p) =>
    visibleInSpotMode(p.distanceM, mode),
  );
  /** Never mount bird sprites until the landscape has painted. */
  const birdsOnFrame = landscapeReady ? visibleBirds : [];

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

  const modeTitle =
    mode === "binos"
      ? `Kikkert ${binoZoom}×${binosLabel ? ` — ${binosLabel}` : ""}`
      : mode === "thermal"
        ? `Termisk ${thermalZoom}×${thermalLabel ? ` — ${thermalLabel}` : ""}`
        : "Spotting med øynene";

  const isOpticMode = mode === "binos" || mode === "thermal";
  const opticAperture =
    mode === "thermal"
      ? opticAperturePercent(thermalPriceNok)
      : opticAperturePercent(binosPriceNok);
  const opticFrameStyle = {
    "--optic-aperture": opticAperture,
  } as CSSProperties;

  /**
   * Live look direction: optic centre = pan.x in landscape %;
   * eyes = full frame centre (same as sticky view bearing).
   */
  const lookXPct = isOpticMode ? pan.x : 50;
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
        <div>
          <p className="intro-line intro-gift">{modeTitle}</p>
          <p className="shop-row-note">
            Kl {formatHuntClock(clockMinutes)} · sett i{" "}
            {lookedMin > 0 ? `${lookedMin} min ` : ""}
            {lookedSec} s spilltid · tid ×{timeFactor}
            {isOpticMode ? " · piltaster / dra for å speide" : ""}
            {hasThermal
              ? ` · batteri ${battMin} min (${battPct}%)`
              : ""}
            {lrfReading ? ` · LRF ${lrfReading}` : ""}
          </p>
        </div>
        <div className="spot-view-actions">
          {mode === "eyes" && hasBinos ? (
            <button type="button" className="intro-button" onClick={enterBinos}>
              Use binos
            </button>
          ) : null}
          {mode === "eyes" && hasThermal ? (
            <button
              type="button"
              className="intro-button"
              onClick={enterThermal}
              disabled={thermalBatteryGameSec <= 0}
              title={
                thermalBatteryGameSec <= 0
                  ? "Batteri tomt"
                  : `Batteri ${battMin} min igjen`
              }
            >
              Use thermal
            </button>
          ) : null}
          {mode === "binos" && hasThermal ? (
            <button
              type="button"
              className="intro-button"
              onClick={enterThermal}
              disabled={thermalBatteryGameSec <= 0}
              title={
                thermalBatteryGameSec <= 0
                  ? "Batteri tomt"
                  : `Batteri ${battMin} min igjen`
              }
            >
              Use thermal
            </button>
          ) : null}
          {mode === "thermal" && hasBinos ? (
            <button type="button" className="intro-button" onClick={enterBinos}>
              Use binos
            </button>
          ) : null}
          {isOpticMode ? (
            <button
              type="button"
              className="intro-button"
              onClick={() => {
                setMode("eyes");
                setLrfReading(null);
              }}
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

      <div
        className={
          mode === "binos"
            ? "spot-eyes-frame spot-binos-frame"
            : mode === "thermal"
              ? "spot-eyes-frame spot-thermal-frame"
              : "spot-eyes-frame spot-eyes-frame-clickable"
        }
        style={isOpticMode ? opticFrameStyle : undefined}
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
            <ThermalCanvas
              imageSrc={imageSrc}
              birdPlacements={birdsOnFrame}
              pan={pan}
              zoom={zoom}
              pixelFactor={thermalPixelFactor}
              className="spot-thermal-canvas"
              onLandscapeReady={() => setLandscapeReady(true)}
            />
            <div className="spot-thermal-scanlines" aria-hidden />
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
        </p>
      ) : null}
      {mode === "binos" ? (
        <p className="spot-binos-hint">
          {showLrf
            ? "Sirkulært syn · piltaster / dra · sikt med rød sirkel og trykk F / Space / LRF"
            : "Sirkulært syn · piltaster / dra · klikk på fuglen for å låse (ingen LRF)"}
          {binosPriceNok > 0
            ? ` · blender ${opticAperture}% (dyrere = tynnere ramme)`
            : ""}
        </p>
      ) : null}
      {mode === "thermal" ? (
        <p className="spot-binos-hint">
          Sirkulært termisk syn · piltaster / dra · grå silhuett = varm fugl
          {showLrf ? " · LRF integrert" : ""}
          {thermalPriceNok > 0
            ? ` · blender ${opticAperture}% (dyrere = tynnere ramme)`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
