/**
 * Felt recoil — post-shot muzzle jump / how hard it is to stay in the glass.
 *
 * Lower = softer. Soft recoil lets the hunter track a fleeing bird through the
 * scope for a better ettersøk cue even without Triggercam / camcorder.
 *
 * Physics (free-recoil velocity from impulse / shouldered mass):
 *   impulse  = m_bullet × v0
 *   v_free   = impulse / m_weapon
 *   Recoil   = (v_free / REF) / (effectiveCalm × recoilDamping)
 *
 * - effectiveCalm: weapon calm × BODY fatigue calm (same stack as wobble)
 * - recoilDamping: suppressor dB damping × CB rear gear (bagrider / cheek / buttpad)
 *
 * Reference load (felt ≈ 1.0 at calm=1, damping=1):
 *   140 gr @ 820 m/s in a 3.5 kg shouldered rifle.
 */

import {
  customsRecoilDampingMultiplier,
  type CustomsMods,
} from "@/lib/customs/spec";
import {
  fatigueCalmFactor,
  type ShooterFatigueInput,
} from "@/lib/range/precision";
import { suppressorRecoilDamping } from "@/lib/suppressor/spec";

/** Felt recoil with calm=1, damping=1, reference impulse/mass. */
export const BASE_FELT_RECOIL = 1;

/** Grains → kg (avoirdupois). */
export const GRAINS_TO_KG = 0.00006479891;

/** Reference bullet / v0 / shouldered mass → free-recoil ≈ 2.14 m/s. */
export const REF_BULLET_WEIGHT_GRAINS = 140;
export const REF_V0_MPS = 820;
export const REF_WEAPON_WEIGHT_KG = 3.5;

export const REF_FREE_RECOIL_MPS =
  (REF_BULLET_WEIGHT_GRAINS * GRAINS_TO_KG * REF_V0_MPS) /
  REF_WEAPON_WEIGHT_KG;

/**
 * Recoil soft enough to keep a continuous bearing in the scope
 * (not only an 8-point compass snap).
 */
export const SCOPE_OBSERVE_RECOIL_MAX = 0.55;
/**
 * Recoil soft enough to also estimate land distance through the scope
 * (coarser than camcorder).
 */
export const SCOPE_DISTANCE_RECOIL_MAX = 0.35;

/**
 * Combined recoil-damping multiplier (≥ 1).
 * Suppressors scale with |dB|; CB rear work multiplies on top.
 */
export function computeRecoilDamping(opts: {
  soundReductionDb?: number | null;
  customsMods?: CustomsMods | null;
}): number {
  const can =
    opts.soundReductionDb != null && Number.isFinite(opts.soundReductionDb)
      ? suppressorRecoilDamping(opts.soundReductionDb)
      : 1;
  const customs = opts.customsMods
    ? customsRecoilDampingMultiplier(opts.customsMods)
    : 1;
  return Math.max(1, can * customs);
}

/**
 * Shouldered mass for free-recoil (rifle + glass + mount + can + bipod when out).
 */
export function shoulderedWeaponWeightKg(parts: {
  rifleGrams: number;
  scopeGrams?: number;
  mountGrams?: number;
  suppressorGrams?: number;
  bipodGrams?: number;
  /** e.g. CB pipe − factory barrel share. */
  extraGrams?: number;
}): number {
  const g =
    Math.max(0, parts.rifleGrams) +
    Math.max(0, parts.scopeGrams ?? 0) +
    Math.max(0, parts.mountGrams ?? 0) +
    Math.max(0, parts.suppressorGrams ?? 0) +
    Math.max(0, parts.bipodGrams ?? 0) +
    (Number.isFinite(parts.extraGrams) ? (parts.extraGrams as number) : 0);
  return Math.max(0.5, g / 1000);
}

/** Bullet momentum (N·s = kg·m/s). */
export function recoilImpulseNs(
  bulletWeightGrains: number,
  v0Mps: number,
): number {
  const m = Math.max(1, bulletWeightGrains) * GRAINS_TO_KG;
  const v = Math.max(50, v0Mps);
  return m * v;
}

/** Free-recoil velocity (m/s) — impulse / weapon mass. */
export function freeRecoilMps(
  bulletWeightGrains: number,
  v0Mps: number,
  weaponWeightKg: number,
): number {
  const mass = Math.max(0.5, weaponWeightKg);
  return recoilImpulseNs(bulletWeightGrains, v0Mps) / mass;
}

/**
 * Impulse factor vs reference (1.0 = 140 gr @ 820 in 3.5 kg).
 * Heavy bullet / fast v0 / light gun → > 1.
 */
export function recoilImpulseFactor(opts: {
  bulletWeightGrains: number;
  v0Mps: number;
  weaponWeightKg: number;
}): number {
  const v = freeRecoilMps(
    opts.bulletWeightGrains,
    opts.v0Mps,
    opts.weaponWeightKg,
  );
  return v / REF_FREE_RECOIL_MPS;
}

/**
 * Felt recoil (lower = softer). Always ≥ ~0.08 so UI/animation stay sane.
 * Pass ammo v0 + grains + shouldered kg for impulse; omit → factor 1 (legacy).
 */
export function computeFeltRecoil(opts: {
  weaponCalm: number;
  recoilDamping: number;
  fatigue?: ShooterFatigueInput;
  bulletWeightGrains?: number | null;
  v0Mps?: number | null;
  weaponWeightKg?: number | null;
}): number {
  const calmRaw =
    Number.isFinite(opts.weaponCalm) && opts.weaponCalm > 0
      ? opts.weaponCalm
      : 1;
  const calm = Math.max(
    0.2,
    calmRaw * fatigueCalmFactor(opts.fatigue ?? {}),
  );
  const damping =
    Number.isFinite(opts.recoilDamping) && opts.recoilDamping > 0
      ? opts.recoilDamping
      : 1;
  const hasImpulse =
    opts.bulletWeightGrains != null &&
    Number.isFinite(opts.bulletWeightGrains) &&
    opts.v0Mps != null &&
    Number.isFinite(opts.v0Mps) &&
    opts.weaponWeightKg != null &&
    Number.isFinite(opts.weaponWeightKg);
  const impulse = hasImpulse
    ? recoilImpulseFactor({
        bulletWeightGrains: opts.bulletWeightGrains!,
        v0Mps: opts.v0Mps!,
        weaponWeightKg: opts.weaponWeightKg!,
      })
    : 1;
  const raw = (BASE_FELT_RECOIL * impulse) / (calm * damping);
  return Math.min(2.2, Math.max(0.08, raw));
}

/**
 * Direction error σ (degrees) from scope observation alone.
 * Recoil 1.0 → 30° (naked). Recoil 0.35 → ~10°. Recoil 0.15 → ~5°.
 */
export function directionErrorSigmaFromRecoil(feltRecoil: number): number {
  const r = Math.min(1.2, Math.max(0.1, feltRecoil));
  const t = (r - 0.15) / 0.85;
  return Math.min(30, Math.max(5, 5 + t * 25));
}

/** Fractional land-distance noise when estimating from the scope. */
export function scopeLandDistanceErrorFrac(feltRecoil: number): number {
  // Softer → tighter. Floor ~0.14 (still worse than camcorder ±12%).
  return Math.min(0.35, Math.max(0.14, 0.12 + feltRecoil * 0.45));
}

/** CSS kick scale: 1 = hard kick, soft setups ~0.25–0.5. */
export function recoilKickScale(feltRecoil: number): number {
  return Math.min(1.6, Math.max(0.18, feltRecoil));
}

export function formatFeltRecoil(feltRecoil: number): string {
  return feltRecoil.toFixed(2);
}
