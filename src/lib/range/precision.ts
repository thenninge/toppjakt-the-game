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
  sampleShotFromPoa,
  type DispersionInput,
} from "@/lib/ballistics/dispersion";

export { MM_PER_MOA_AT_100M };
export {
  DISPERSION_MOA_SIGMA_LEVEL,
  combinedDispersionMoa,
  dispersionSigmaMoa,
  sampleShotFromPoa,
} from "@/lib/ballistics/dispersion";

export const RANGE_DISTANCE_M = 100;
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

export function measureGroup(shots: ShotImpact[]): GroupMeasurement | null {
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

  return {
    widthMm,
    heightMm,
    extremeSpreadMm,
    groupMoa: extremeSpreadMm / MM_PER_MOA_AT_100M,
    meanRadiusMm,
    meanRadiusMoa: meanRadiusMm / MM_PER_MOA_AT_100M,
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
/** Space held → shot fires after uniform random delay in [0, this] ms. */
export const TRIGGER_DELAY_MAX_MS = 1000;

export function wobbleAmplitudeMm(calmFactor: number): number {
  return BASE_WOBBLE_MM / Math.max(0.35, calmFactor);
}

/** Effective calm including breath/focus state. */
export function effectiveCalmWithFocus(
  weaponCalm: number,
  focus: { held: boolean; startedAtMs: number },
  nowMs: number,
): number {
  if (!focus.held) return weaponCalm;
  const elapsed = nowMs - focus.startedAtMs;
  if (elapsed < FOCUS_HOLD_MS) return weaponCalm * FOCUS_CALM_MULT;
  return weaponCalm * FOCUS_FATIGUE_CALM_MULT;
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
 */
export function scopeImageScale(
  zoom: number,
  _scope?: Pick<ScopeSpec, "minZoom" | "maxZoom">,
): number {
  return Math.max(0.008, SCOPE_IMAGE_SCALE_PER_ZOOM * zoom);
}
