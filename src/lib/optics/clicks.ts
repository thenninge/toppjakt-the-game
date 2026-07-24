/**
 * Scope turret click sizes — MRAD (0.1 mil) vs MOA (¼ MOA).
 *
 * Engine storage stays mm-at-100 m. UI / DOPE / apps convert via click unit
 * on the equipped scope (`ScopeSpec.clickUnit`).
 */

import { MM_PER_MOA_AT_100M } from "@/lib/ballistics/dispersion";
import type { ScopeClickUnit } from "@/lib/optics/spec";

/** 0.1 mil ≈ 10 mm @ 100 m. */
export const MRAD_CLICK_MM_AT_100 = 10;

/** 0.25 MOA @ 100 m (¼-MOA turrets). */
export const MOA_CLICK_MM_AT_100 = MM_PER_MOA_AT_100M / 4;

/**
 * Shooting-range paper scale when a MOA scope is equipped.
 * Printed 1 cm grid → 7.27 mm ≈ ¼ MOA, so one click lines up with one square.
 */
export const MOA_RANGE_TARGET_SCALE = 0.727;

/** Angular step per click in the unit's native measure (0.1 mil or 0.25 MOA). */
export function clickStepNative(unit: ScopeClickUnit): number {
  return unit === "MOA" ? 0.25 : 0.1;
}

export function clickSizeMmAt100(unit: ScopeClickUnit = "MRAD"): number {
  return unit === "MOA" ? MOA_CLICK_MM_AT_100 : MRAD_CLICK_MM_AT_100;
}

/** Short label for readouts: "MIL" / "MOA". */
export function clickUnitLabel(unit: ScopeClickUnit): string {
  return unit === "MOA" ? "MOA" : "MIL";
}

/** Lowercase unit for app small-print: "mrad" / "moa". */
export function clickUnitSuffix(unit: ScopeClickUnit): string {
  return unit === "MOA" ? "moa" : "mrad";
}

export function mmAt100ToScopeClicks(
  mmAt100: number,
  unit: ScopeClickUnit = "MRAD",
): number {
  const size = clickSizeMmAt100(unit);
  return Math.round(mmAt100 / size);
}

export function scopeClicksToMmAt100(
  clicks: number,
  unit: ScopeClickUnit = "MRAD",
): number {
  return Math.round(clicks) * clickSizeMmAt100(unit);
}

/**
 * Absolute angular magnitude in native units (mils or MOA) from mm-at-100.
 * MRAD: |mm|/100 → mils; MOA: |mm|/MM_PER_MOA.
 */
export function mmAt100ToAngular(
  mmAt100: number,
  unit: ScopeClickUnit,
): number {
  if (unit === "MOA") return Math.abs(mmAt100) / MM_PER_MOA_AT_100M;
  return Math.abs(mmAt100) / 100;
}

/**
 * Convert legacy DOPE / hold clicks (always 0.1 mil) → display clicks for unit.
 */
export function milClicksToScopeClicks(
  milClicks: number,
  unit: ScopeClickUnit,
): number {
  if (unit === "MRAD") return Math.round(milClicks);
  return mmAt100ToScopeClicks(milClicks * MRAD_CLICK_MM_AT_100, "MOA");
}

export function formatClickStepHint(unit: ScopeClickUnit): string {
  return unit === "MOA"
    ? "0.25 MOA / klikk · dra trommelen eller hold knapp"
    : "0.1 mil / klikk · dra trommelen eller hold knapp";
}
