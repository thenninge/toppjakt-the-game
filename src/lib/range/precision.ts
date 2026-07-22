/**
 * Shooting range — precision, groups, and weapon calm.
 *
 * 1 MOA ≈ 29.4 mm extreme spread at 100 m (see ammo/spec).
 */

import type { AmmoSpec } from "@/lib/ammo/spec";
import type { BipodSpec } from "@/lib/bipod/spec";
import type { RifleSpec } from "@/lib/rifle/spec";
import { rollAmmoAffinity } from "@/lib/rifle/spec";
import type { ScopeSpec } from "@/lib/optics/spec";
import type { StockSpec } from "@/lib/stock/spec";
import { suppressorWeaponCalmGrams } from "@/lib/suppressor/spec";
import {
  MM_PER_MOA_AT_100M,
  combinedDispersionMoa,
  moaToMmAtDistance,
  sampleShotFromPoa,
  type DispersionInput,
} from "@/lib/ballistics/dispersion";

export { MM_PER_MOA_AT_100M };
export {
  DISPERSION_MOA_SIGMA_LEVEL,
  combinedDispersionMoa,
  dispersionSigmaMoa,
  moaToMmAtDistance,
  sampleShotFromPoa,
} from "@/lib/ballistics/dispersion";

export const RANGE_DISTANCE_M = 100;
/** Selectable CBA distances on the indoor/outdoor range. */
export const RANGE_DISTANCES_M = [100, 200, 300, 400] as const;
export type RangeDistanceM = (typeof RANGE_DISTANCES_M)[number];

export const SHOTS_PER_SERIES = 5;

/**
 * CBA detail image calibration (cba-detail.png, 949×1024).
 *
 * Physical: each corner of the large aim diamond is 10 mm from bullseye
 * (tip-to-tip through center = 20 mm). Grid squares = 10×10 mm.
 * Center ring ≈ 6 mm Ø (sanity check).
 *
 * Pixels (measured on the asset): bullseye is NOT at image center.
 * Diamond tip ≈ 115 px from bullseye (diagonal flats × √2 / N–S tips).
 */
export const CBA_IMAGE_NATIVE_WIDTH = 949;
export const CBA_IMAGE_NATIVE_HEIGHT = 1024;
/** Bullseye (diamond/cross origin) in native image pixels. */
export const CBA_BULLSEYE_X_PX = 487;
export const CBA_BULLSEYE_Y_PX = 538;
export const CBA_GRID_MM = 10;
/** Center → diamond corner (N/E/S/W tip). */
export const CBA_DIAMOND_CENTER_TO_TIP_MM = 10;
export const CBA_DIAMOND_CENTER_TO_TIP_PX = 115;
export const CBA_CENTER_DOT_DIAMETER_MM = 6;

/**
 * Image CSS scale at 1× optical — tuned so a typical 8–12× view shows the
 * diamond as a small aim point in the scope circle (not a full-screen poster).
 * Apparent size ∝ zoom (see scopeImageScale).
 */
export const SCOPE_IMAGE_SCALE_PER_ZOOM = 0.012;

export type ShotImpact = {
  /** mm right of bullseye (target coords). */
  xMm: number;
  /** mm below bullseye (target coords, +down). */
  yMm: number;
  /** Hole diameter on paper (mm) — bullet caliber. */
  diameterMm: number;
};

export type GroupMeasurement = {
  widthMm: number;
  heightMm: number;
  /** Center-to-center extreme spread (classic group size). */
  extremeSpreadMm: number;
  groupMoa: number;
  /** Average distance of shots from group center. */
  meanRadiusMm: number;
  meanRadiusMoa: number;
  /** Group center (POI) relative to bullseye: +x right, +y low. */
  poiXMm: number;
  poiYMm: number;
  shotCount: number;
};

export type RangePrecisionInput = DispersionInput;

/** Combined N-σ envelope MOA (rifle + ammo×affinity + stock). */
export function effectiveGroupMoa(input: RangePrecisionInput): number {
  return combinedDispersionMoa(input);
}

export function affinityKey(rifleId: string, ammoId: string): string {
  return `${rifleId}::${ammoId}`;
}

export function ensureAmmoAffinity(
  map: Record<string, number>,
  rifleId: string,
  ammoId: string,
  random: () => number = Math.random,
): { affinity: number; map: Record<string, number>; rolled: boolean } {
  const key = affinityKey(rifleId, ammoId);
  if (map[key] != null) {
    return { affinity: map[key], map, rolled: false };
  }
  const affinity = rollAmmoAffinity(random);
  return { affinity, map: { ...map, [key]: affinity }, rolled: true };
}

/**
 * Sample impact offset from POA at range distance (angular Gaussian + v0).
 * Prefer sampleShotFromPoa when you already have POA in mm.
 */
export function sampleShotScatterMm(
  input: RangePrecisionInput,
  distanceM: number = RANGE_DISTANCE_M,
  random: () => number = Math.random,
): ShotImpact {
  const shot = sampleShotFromPoa({ xMm: 0, yMm: 0 }, input, distanceM, random);
  return {
    xMm: shot.xMm,
    yMm: shot.yMm,
    diameterMm: caliberBulletDiameterMm(input.ammo.caliber),
  };
}

/**
 * Bullet hole diameter on paper from caliber string.
 * "6,5×55" → 6.5 mm; ".308" → 0.308×25.4 mm; ".22 LR" → ~5.6 mm.
 */
export function caliberBulletDiameterMm(caliber: string): number {
  const s = caliber.trim().toLowerCase().replace(/,/g, ".");
  const metricPair = s.match(/^(\d+(?:\.\d+)?)\s*[x×]/);
  if (metricPair) return parseFloat(metricPair[1]);
  const metricName = s.match(/^(\d+(?:\.\d+)?)\s+/);
  if (metricName) return parseFloat(metricName[1]);
  const imperial = s.match(/^\.(\d+)/);
  if (imperial) {
    const inches = parseFloat(`0.${imperial[1]}`);
    return inches * 25.4;
  }
  return 6.5;
}

export function cbaPxPerMm(imageWidthPx: number): number {
  const scale = imageWidthPx / CBA_IMAGE_NATIVE_WIDTH;
  return (CBA_DIAMOND_CENTER_TO_TIP_PX * scale) / CBA_DIAMOND_CENTER_TO_TIP_MM;
}

export function mmToPx(mm: number, imageWidthPx: number): number {
  return mm * cbaPxPerMm(imageWidthPx);
}

/**
 * Offset from image center (50%/50%) to bullseye, in the given image pixel space.
 * Aim mm=0 and impact mm=0 are relative to bullseye, not the PNG midpoint.
 */
export function cbaBullseyeOffsetFromImageCenterPx(
  imageWidthPx: number,
  imageHeightPx: number = imageWidthPx * (CBA_IMAGE_NATIVE_HEIGHT / CBA_IMAGE_NATIVE_WIDTH),
): { x: number; y: number } {
  const sx = imageWidthPx / CBA_IMAGE_NATIVE_WIDTH;
  const sy = imageHeightPx / CBA_IMAGE_NATIVE_HEIGHT;
  return {
    x: (CBA_BULLSEYE_X_PX - CBA_IMAGE_NATIVE_WIDTH / 2) * sx,
    y: (CBA_BULLSEYE_Y_PX - CBA_IMAGE_NATIVE_HEIGHT / 2) * sy,
  };
}

/** Bullseye position in image pixel coords for the given rendered size. */
export function cbaBullseyePx(
  imageWidthPx: number,
  imageHeightPx: number = imageWidthPx * (CBA_IMAGE_NATIVE_HEIGHT / CBA_IMAGE_NATIVE_WIDTH),
): { x: number; y: number } {
  const o = cbaBullseyeOffsetFromImageCenterPx(imageWidthPx, imageHeightPx);
  return {
    x: imageWidthPx / 2 + o.x,
    y: imageHeightPx / 2 + o.y,
  };
}

function emptyGroup(shotCount: number, poi?: ShotImpact): GroupMeasurement {
  return {
    widthMm: 0,
    heightMm: 0,
    extremeSpreadMm: 0,
    groupMoa: 0,
    meanRadiusMm: 0,
    meanRadiusMoa: 0,
    poiXMm: poi?.xMm ?? 0,
    poiYMm: poi?.yMm ?? 0,
    shotCount,
  };
}

export function measureGroup(
  shots: ShotImpact[],
  distanceM: number = RANGE_DISTANCE_M,
): GroupMeasurement | null {
  if (shots.length === 0) return null;
  if (shots.length === 1) return emptyGroup(1, shots[0]);

  const xs = shots.map((s) => s.xMm);
  const ys = shots.map((s) => s.yMm);
  const widthMm = Math.max(...xs) - Math.min(...xs);
  const heightMm = Math.max(...ys) - Math.min(...ys);
  const poiXMm = xs.reduce((a, b) => a + b, 0) / xs.length;
  const poiYMm = ys.reduce((a, b) => a + b, 0) / ys.length;

  let extremeSpreadMm = 0;
  for (let i = 0; i < shots.length; i++) {
    for (let j = i + 1; j < shots.length; j++) {
      const dx = shots[i].xMm - shots[j].xMm;
      const dy = shots[i].yMm - shots[j].yMm;
      extremeSpreadMm = Math.max(extremeSpreadMm, Math.hypot(dx, dy));
    }
  }

  const meanRadiusMm =
    shots.reduce(
      (sum, s) => sum + Math.hypot(s.xMm - poiXMm, s.yMm - poiYMm),
      0,
    ) / shots.length;

  const mmPerMoa = MM_PER_MOA_AT_100M * (distanceM / 100);

  return {
    widthMm,
    heightMm,
    extremeSpreadMm,
    groupMoa: extremeSpreadMm / mmPerMoa,
    meanRadiusMm,
    meanRadiusMoa: meanRadiusMm / mmPerMoa,
    poiXMm,
    poiYMm,
    shotCount: shots.length,
  };
}

/** e.g. "2mm Left, 3mm Low" */
export function formatPoiOffset(poiXMm: number, poiYMm: number): string {
  const ax = Math.abs(poiXMm);
  const ay = Math.abs(poiYMm);
  const horiz =
    ax < 0.05 ? "0mm" : `${ax.toFixed(0)}mm ${poiXMm < 0 ? "Left" : "Right"}`;
  const vert =
    ay < 0.05 ? "0mm" : `${ay.toFixed(0)}mm ${poiYMm < 0 ? "High" : "Low"}`;
  if (ax < 0.05 && ay < 0.05) return "on center";
  if (ax < 0.05) return vert;
  if (ay < 0.05) return horiz;
  return `${horiz}, ${vert}`;
}

export type WeaponCalmInput = {
  hasBipod: boolean;
  bipod?: BipodSpec | null;
  suppressorWeightGrams?: number;
};

/**
 * Calm factor — higher = less wobble.
 * Baseline 1 without bipod; bipod ≈ 3× (tunable), quality adds a bit;
 * can forward-mass softens further.
 */
export function computeWeaponCalmFactor(input: WeaponCalmInput): number {
  let calm = 1;
  if (input.hasBipod) {
    calm *= 3;
    if (input.bipod) {
      // Score10 1–10 → slight extra (Accu-Tac vs plastic).
      calm *= 0.85 + input.bipod.weaponCalm * 0.03;
    }
  }
  if (input.suppressorWeightGrams && input.suppressorWeightGrams > 0) {
    const calmMass = suppressorWeaponCalmGrams(input.suppressorWeightGrams);
    calm *= 1 + calmMass / 4000;
  }
  return calm;
}

/** Peak wobble amplitude in mm on target at calm=1 (no bipod). */
export const BASE_WOBBLE_MM = 18;

/** Hold F: calm × this while breath window is open. */
export const FOCUS_CALM_MULT = 3;
/** Clean focus window after pressing F (ms). */
export const FOCUS_HOLD_MS = 8000;
/**
 * After FOCUS_HOLD_MS while still holding F: calm multiplier (worse than baseline).
 * Release F and press again to reset the window.
 */
export const FOCUS_FATIGUE_CALM_MULT = 0.65;

/**
 * Trigger bar length (real-time ms). Player holds Space; fill runs 0→1 over this.
 * @deprecated Prefer {@link TRIGGER_BAR_MS}. Kept as alias for old call sites.
 */
export const TRIGGER_DELAY_MAX_MS = 3000;

/** Full trigger-bar travel time (hold Space). */
export const TRIGGER_BAR_MS = 3000;
/** Random release mark when F is pressed — inclusive range. */
export const TRIGGER_TARGET_MIN_MS = 500;
export const TRIGGER_TARGET_MAX_MS = 2500;
/** |release − mark| within this → perfect break (no extra POA error). */
export const TRIGGER_PERFECT_BAND_MS = 100;

/** Roll the invisible “break” mark shown on the trigger bar when focus starts. */
export function rollTriggerTargetMs(
  random: () => number = Math.random,
): number {
  return (
    TRIGGER_TARGET_MIN_MS +
    random() * (TRIGGER_TARGET_MAX_MS - TRIGGER_TARGET_MIN_MS)
  );
}

/**
 * Trigger-pull quality → extra POA error factor.
 * 0 = perfect release (rifle+ammo max precision only).
 * 1 = worst release (extra miss = full combined envelope mm at distance).
 */
export function triggerPullErrorFactor(
  releaseElapsedMs: number,
  targetMs: number,
): number {
  const err = Math.abs(releaseElapsedMs - targetMs);
  if (err <= TRIGGER_PERFECT_BAND_MS) return 0;
  const maxErr = Math.max(targetMs, TRIGGER_BAR_MS - targetMs);
  const span = Math.max(1, maxErr - TRIGGER_PERFECT_BAND_MS);
  return clamp01((err - TRIGGER_PERFECT_BAND_MS) / span);
}

/**
 * Extra POA offset from a bad trigger break.
 * Magnitude = errorFactor × combinedDispersionMoa envelope in mm at distance.
 * Direction is random on the target plane.
 */
export function triggerPullOffsetMm(
  errorFactor: number,
  envelopeMoa: number,
  distanceM: number,
  random: () => number = Math.random,
): { xMm: number; yMm: number; envelopeMm: number } {
  const envelopeMm = moaToMmAtDistance(Math.max(0, envelopeMoa), distanceM);
  if (errorFactor <= 0 || envelopeMm <= 0) {
    return { xMm: 0, yMm: 0, envelopeMm };
  }
  const mag = errorFactor * envelopeMm;
  const angle = random() * Math.PI * 2;
  return {
    xMm: Math.cos(angle) * mag,
    yMm: Math.sin(angle) * mag,
    envelopeMm,
  };
}

/**
 * How hard physical fatigue (BODY empty → 1) cuts hold steadiness.
 * At 1.0 physical fatigue, calm is multiplied by (1 − this) → −50% calm.
 */
export const PHYSICAL_FATIGUE_CALM_PENALTY = 0.5;
/**
 * @deprecated Mental fatigue no longer cuts calm — it widens MOA instead.
 * Kept so old docs/callers don't break; {@link fatigueCalmFactor} ignores MIND.
 */
export const MENTAL_FATIGUE_CALM_PENALTY = 0;
/** Floor so wobble never explodes if BODY is empty and gear calm is low. */
export const FATIGUE_CALM_FLOOR = 0.2;
/**
 * At 1.0 mental fatigue (MIND empty), rifle+ammo envelope is scaled by this
 * (e.g. 0.4 MOA setup → 0.8 MOA). Linear from 1 at fresh MIND.
 */
export const MENTAL_FATIGUE_DISPERSION_MAX_MULT = 2;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export type ShooterFatigueInput = {
  /** 0 = fresh BODY, 1 = exhausted. */
  physicalFatigue?: number;
  /** 0 = fresh MIND, 1 = exhausted. */
  mentalFatigue?: number;
};

/**
 * Calm multiplier from BODY fatigue (higher fatigue → lower calm → more shake).
 * Fresh → 1. BODY empty → 0.5 (−50% calm). MIND does not affect calm.
 */
export function fatigueCalmFactor(fatigue: ShooterFatigueInput = {}): number {
  const physical = clamp01(fatigue.physicalFatigue ?? 0);
  const physicalMult = 1 - physical * PHYSICAL_FATIGUE_CALM_PENALTY;
  return Math.max(FATIGUE_CALM_FLOOR, physicalMult);
}

/**
 * Angular envelope scale from MIND fatigue.
 * Fresh → 1. MIND empty → {@link MENTAL_FATIGUE_DISPERSION_MAX_MULT} (2×).
 */
export function fatigueDispersionFactor(
  fatigue: ShooterFatigueInput | number = {},
): number {
  const mental =
    typeof fatigue === "number"
      ? clamp01(fatigue)
      : clamp01(fatigue.mentalFatigue ?? 0);
  return 1 + mental * (MENTAL_FATIGUE_DISPERSION_MAX_MULT - 1);
}

export function wobbleAmplitudeMm(
  calmFactor: number,
  distanceM: number = RANGE_DISTANCE_M,
): number {
  const at100 = BASE_WOBBLE_MM / Math.max(0.35, calmFactor);
  return at100 * (distanceM / RANGE_DISTANCE_M);
}

/** Effective calm including breath/focus and optional BODY/MIND fatigue. */
export function effectiveCalmWithFocus(
  weaponCalm: number,
  focus: { held: boolean; startedAtMs: number },
  nowMs: number,
  fatigue?: ShooterFatigueInput,
): number {
  let calm = weaponCalm;
  if (focus.held) {
    const elapsed = nowMs - focus.startedAtMs;
    calm *=
      elapsed < FOCUS_HOLD_MS ? FOCUS_CALM_MULT : FOCUS_FATIGUE_CALM_MULT;
  }
  if (fatigue) {
    calm *= fatigueCalmFactor(fatigue);
  }
  return calm;
}

export type FocusPhase = "idle" | "focused" | "fatigued";

export function focusPhase(
  focus: { held: boolean; startedAtMs: number },
  nowMs: number,
): FocusPhase {
  if (!focus.held) return "idle";
  if (nowMs - focus.startedAtMs < FOCUS_HOLD_MS) return "focused";
  return "fatigued";
}

export function focusRemainingMs(
  focus: { held: boolean; startedAtMs: number },
  nowMs: number,
): number {
  if (!focus.held) return 0;
  return Math.max(0, FOCUS_HOLD_MS - (nowMs - focus.startedAtMs));
}

export type ScopeView = {
  minZoom: number;
  maxZoom: number;
  zoom: number;
};

export function clampScopeZoom(
  zoom: number,
  scope: Pick<ScopeSpec, "minZoom" | "maxZoom">,
): number {
  return Math.min(scope.maxZoom, Math.max(scope.minZoom, zoom));
}

/**
 * CSS scale for the CBA image inside the scope circle.
 * Proportional to optical zoom — min zoom shows more paper; max digs into the diamond.
 * At longer range the target subtends less angle (∝ 100/distance).
 */
export function scopeImageScale(
  zoom: number,
  _scope?: Pick<ScopeSpec, "minZoom" | "maxZoom">,
  distanceM: number = RANGE_DISTANCE_M,
): number {
  const rangeFactor = RANGE_DISTANCE_M / Math.max(1, distanceM);
  return Math.max(0.004, SCOPE_IMAGE_SCALE_PER_ZOOM * zoom * rangeFactor);
}
