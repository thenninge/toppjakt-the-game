/**
 * Rifle cant (roll) — tip left/right of the bore/scope axis.
 *
 * Positive cantDeg = clockwise when looking toward the target from behind
 * the rifle (shooter's view). The bubble then drifts to the left (high side).
 *
 * Elevation dial / aim offsets live in the scope frame; gravity drop is world
 * down. Cant rotates scope-frame vectors into the world before impact.
 *
 * High realism: cant is always active when the feature flag is on — bubble
 * level only measures/displays it. Without bubble, adjust by feel (Q/E).
 */

import type { GameRealism } from "@/lib/optics/turretStyle";
import {
  getRealismParams,
  realismFeatureEnabled,
} from "@/lib/range/realismControls";

/** Soft max |cant| for UI + roll (deg). Full bubble travel at ± this. */
export const CANT_UI_MAX_DEG = 8;

/** Typical entry roll amplitude (deg, 1σ-ish half-range). */
export const CANT_ENTRY_SPREAD_DEG = 3.2;

function cantUiMaxDeg(): number {
  return getRealismParams().cantUiMaxDeg;
}

function cantEntrySpreadDeg(): number {
  return getRealismParams().cantEntrySpreadDeg;
}

/**
 * Cant challenge: Admin Realism «cant» for the active level.
 * Bubble level is optional HUD — see {@link showBubbleLevelHud}.
 */
export function isCantGameplayActive(
  realism: GameRealism | null | undefined,
): boolean {
  return realismFeatureEnabled(realism, "cant");
}

/** Bubble HUD when cant is on and a bubble level is in kit. */
export function showBubbleLevelHud(
  realism: GameRealism | null | undefined,
  hasBubbleLevel: boolean,
): boolean {
  return isCantGameplayActive(realism) && hasBubbleLevel;
}

/** Entry / series cant — 0 when gameplay is inactive. */
export function initialCantDeg(
  realism: GameRealism | null | undefined,
  random: () => number = Math.random,
): number {
  if (!isCantGameplayActive(realism)) return 0;
  return rollEntryCantDeg(random);
}

/** Ballistics / impact cant — forced 0 when inactive. */
export function effectiveCantDeg(
  realism: GameRealism | null | undefined,
  cantDeg: number,
): number {
  if (!isCantGameplayActive(realism)) return 0;
  return clampCantDeg(cantDeg);
}

export function clampCantDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  const max = cantUiMaxDeg();
  return Math.max(-max, Math.min(max, deg));
}

/** Random cant when entering a scope lane / hunt shot. */
export function rollEntryCantDeg(random: () => number = Math.random): number {
  // Triangle-ish around 0 so pure vertical is rare but possible.
  const u = random() * 2 - 1;
  const v = random() * 2 - 1;
  return clampCantDeg(((u + v) / 2) * cantEntrySpreadDeg() * 1.6);
}

/**
 * Bubble travel along the vial (−1 … +1).
 * Q / CCW (negative cant) → bubble right (+).
 * E / CW (positive cant) → bubble left (−).
 */
export function bubbleOffsetFromCantDeg(cantDeg: number): number {
  const max = cantUiMaxDeg();
  const t = max > 0 ? clampCantDeg(cantDeg) / max : 0;
  return Math.max(-1, Math.min(1, -t));
}

/** Nudge cant toward level by one small step (deg). */
export const CANT_NUDGE_DEG = 0.35;

/** Hold Q/E rotation speed (deg/s). */
export const CANT_KEY_DEG_PER_SEC = 4.5;

export function nudgeCantTowardLevel(cantDeg: number): number {
  const c = clampCantDeg(cantDeg);
  if (Math.abs(c) < CANT_NUDGE_DEG * 0.55) return 0;
  return clampCantDeg(c - Math.sign(c) * CANT_NUDGE_DEG);
}

export function nudgeCantDeg(cantDeg: number, deltaDeg: number): number {
  return clampCantDeg(cantDeg + deltaDeg);
}

/**
 * Rotate a scope-frame offset (mm, +x right, +y down on glass) into world
 * target-plane coords under rifle cant.
 */
export function rotateScopeMmByCant(
  xMm: number,
  yMm: number,
  cantDeg: number,
): { xMm: number; yMm: number } {
  const rad = (clampCantDeg(cantDeg) * Math.PI) / 180;
  if (Math.abs(rad) < 1e-6) return { xMm, yMm };
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    xMm: xMm * c - yMm * s,
    yMm: xMm * s + yMm * c,
  };
}

/**
 * Inverse of {@link rotateScopeMmByCant}: world target-plane → scope axes.
 * Used to express ballistic drop / windage on the reticle when canted.
 */
export function rotateWorldMmToScope(
  xMm: number,
  yMm: number,
  cantDeg: number,
): { xMm: number; yMm: number } {
  const rad = (clampCantDeg(cantDeg) * Math.PI) / 180;
  if (Math.abs(rad) < 1e-6) return { xMm, yMm };
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    xMm: xMm * c + yMm * s,
    yMm: -xMm * s + yMm * c,
  };
}

/**
 * World-frame ballistic miss (windage +right, drop +down) → scope-frame
 * components on the reticle axes under rifle cant.
 *
 * Pure drop under CW cant gains a rightward windage component on glass;
 * CCW gains leftward. Dials/devices that assume a level rifle ignore this —
 * the bubble level exists so the player keeps these equal to world values.
 */
export function cantedDropWindageMm(
  windageMm: number,
  dropMm: number,
  cantDeg: number,
): { windageMm: number; dropMm: number } {
  const s = rotateWorldMmToScope(windageMm, dropMm, cantDeg);
  return { windageMm: s.xMm, dropMm: s.yMm };
}

/**
 * Scope-frame dial (mm at target) that cancels world drop + windage when the
 * rifle is canted. Level rifle → (−windage, −drop).
 */
export function cantCompensatedDialMm(
  windageMm: number,
  dropMm: number,
  cantDeg: number,
): { xMm: number; yMm: number } {
  return rotateWorldMmToScope(-windageMm, -dropMm, cantDeg);
}

/**
 * Compose POI from scope-frame aim/zero/scatter + world-frame ballistics.
 *
 * - POA, zero, and angular scatter live in the scope frame → rotate with cant.
 * - Drop and windage (spin + crosswind) stay world-frame → not rotated.
 */
export function composeCantedImpactMm(opts: {
  poaXMm: number;
  poaYMm: number;
  zeroXMm: number;
  zeroYMm: number;
  /** Scope-frame angular miss (dispersion), mm. */
  scatterXMm?: number;
  scatterYMm?: number;
  /** World-frame drop below LOS (mm, +down). */
  dropMm: number;
  /** World-frame lateral (mm, +right): spin + wind. */
  windageMm: number;
  cantDeg: number;
}): { xMm: number; yMm: number } {
  const sx = opts.scatterXMm ?? 0;
  const sy = opts.scatterYMm ?? 0;
  const scopeX = opts.poaXMm + opts.zeroXMm + sx;
  const scopeY = opts.poaYMm + opts.zeroYMm + sy;
  const world = rotateScopeMmByCant(scopeX, scopeY, opts.cantDeg);
  return {
    xMm: world.xMm + opts.windageMm,
    yMm: world.yMm + opts.dropMm,
  };
}

/**
 * Apply cant: POA + zero live in scope frame; drop / wind stay world-frame
 * (already baked into `shot` / windMm).
 *
 * Prefer {@link composeCantedImpactMm} when drop/windage are known separately.
 */
export function applyCantToShotImpact(opts: {
  /** Scope-frame POA (aim + wobble + pull). */
  poaXMm: number;
  poaYMm: number;
  /** Scope-frame zero / dial offset. */
  zeroXMm: number;
  zeroYMm: number;
  /** Ballistic sample already includes world drop on y (+ spin on x). */
  shotXMm: number;
  shotYMm: number;
  /** Extra world-frame wind drift (mm, +right). */
  windMm?: number;
  cantDeg: number;
}): { xMm: number; yMm: number } {
  const cant = clampCantDeg(opts.cantDeg);
  const wind = opts.windMm ?? 0;
  if (Math.abs(cant) < 0.05) {
    return {
      xMm: opts.shotXMm + opts.zeroXMm + wind,
      yMm: opts.shotYMm + opts.zeroYMm,
    };
  }

  // shot − poa = scatter + spin + drop (level-rifle sample). Treat the whole
  // delta as world-frame ballistics + scatter (legacy callers).
  const ballX = opts.shotXMm - opts.poaXMm + wind;
  const ballY = opts.shotYMm - opts.poaYMm;
  return composeCantedImpactMm({
    poaXMm: opts.poaXMm,
    poaYMm: opts.poaYMm,
    zeroXMm: opts.zeroXMm,
    zeroYMm: opts.zeroYMm,
    dropMm: ballY,
    windageMm: ballX,
    cantDeg: cant,
  });
}
