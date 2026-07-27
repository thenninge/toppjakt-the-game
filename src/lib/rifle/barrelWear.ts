/**
 * Barrel wear — rifle precision degrades with round count through the tube.
 *
 * Fresh period depends on pipe material (custom or factory CrMo):
 *   CrMo / carbon / factory  → 300 skudd frisk, deretter ramp til 2× MOA @ +100
 *   Stainless                → 200 skudd frisk, deretter ramp til 2× MOA @ +100
 */

import type {
  BarrelMaterial,
  InstalledCustomBarrel,
} from "@/lib/customs/customBarrel";

export type BarrelWearMaterial = BarrelMaterial | "factory";

/** Shots at full precision — CrMo, carbon, factory pipe. */
export const BARREL_WEAR_START_CRMo = 300;
/** Shots at full precision — stainless custom pipe. */
export const BARREL_WEAR_START_STAINLESS = 200;
/** Linear wear ramp after fresh period (same for all materials). */
export const BARREL_WEAR_RAMP_SHOTS = 100;
export const BARREL_WEAR_MAX_SCALE = 2;

/** @deprecated Use {@link BARREL_WEAR_START_CRMo} / {@link barrelWearStartShots}. */
export const BARREL_WEAR_START_SHOTS = BARREL_WEAR_START_CRMo;
/** @deprecated Use {@link barrelWearEndShots} for material. */
export const BARREL_WEAR_END_SHOTS =
  BARREL_WEAR_START_CRMo + BARREL_WEAR_RAMP_SHOTS;

/** Flat fee to rebarrel the equipped rifle at CB Customs. */
export const BARREL_REPLACE_NOK = 12_000;

export function barrelWearMaterialFromCustom(
  custom: InstalledCustomBarrel | null | undefined,
): BarrelWearMaterial {
  if (!custom) return "factory";
  return custom.material;
}

export function barrelWearStartShots(
  material: BarrelWearMaterial = "factory",
): number {
  if (material === "stainless") return BARREL_WEAR_START_STAINLESS;
  return BARREL_WEAR_START_CRMo;
}

export function barrelWearEndShots(
  material: BarrelWearMaterial = "factory",
): number {
  return barrelWearStartShots(material) + BARREL_WEAR_RAMP_SHOTS;
}

/**
 * Multiplier on rifle `averageBestAccuracyMoa` (1 = fresh, up to 2 = worn out).
 */
export function barrelWearMoaScale(
  roundCount: number,
  material: BarrelWearMaterial = "factory",
): number {
  const n = Math.max(0, Math.floor(Number.isFinite(roundCount) ? roundCount : 0));
  const start = barrelWearStartShots(material);
  const end = barrelWearEndShots(material);
  if (n <= start) return 1;
  if (n >= end) return BARREL_WEAR_MAX_SCALE;
  const t = (n - start) / (end - start);
  return 1 + t * (BARREL_WEAR_MAX_SCALE - 1);
}

export function barrelWearLabelNb(
  roundCount: number,
  material: BarrelWearMaterial = "factory",
): string {
  const n = Math.max(0, Math.floor(roundCount));
  const start = barrelWearStartShots(material);
  const end = barrelWearEndShots(material);
  const scale = barrelWearMoaScale(n, material);
  if (n <= start) {
    return `frisk (${n}/${start})`;
  }
  if (n >= end) {
    return `utslitt (${n} skudd · ${scale.toFixed(1)}× MOA) — bytt pipe hos CB Customs`;
  }
  return `slites (${n} skudd · ${scale.toFixed(2)}× MOA)`;
}

export function isBarrelWornOut(
  roundCount: number,
  material: BarrelWearMaterial = "factory",
): boolean {
  return Math.max(0, Math.floor(roundCount)) >= barrelWearEndShots(material);
}
