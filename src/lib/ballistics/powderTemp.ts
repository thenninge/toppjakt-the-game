/**
 * Powder temperature → muzzle velocity (dV/dT).
 *
 * Catalog `ammo.v0` is defined at {@link POWDER_TEMP_REFERENCE_C} (15 °C).
 * Cooler powder → lower v0 → more drop.
 */

import type { AmmoSpec } from "@/lib/ammo/spec";

/** Catalog muzzle velocities are referenced at this powder temp (°C). */
export const POWDER_TEMP_REFERENCE_C = 15;

/** Centerfire / most ammo: ~1 m/s per °C (800 @ 15 °C → 785 @ 0 °C). */
export const DVDT_CENTERFIRE_MPS_PER_C = 1;

/**
 * .22 LR: steeper (~2 m/s per °C).
 * e.g. 360 @ 15 °C → 350 @ 10 °C → 340 @ 0 °C → 330 @ −5 °C.
 */
export const DVDT_22LR_MPS_PER_C = 2;

export function isRimfire22Lr(caliber: string | undefined | null): boolean {
  if (!caliber) return false;
  return /\.?\s*22\s*lr/i.test(caliber);
}

/** dV/dT slope for this cartridge (m/s per °C). */
export function powderTempDvDtMpsPerC(
  caliber: string | undefined | null,
): number {
  return isRimfire22Lr(caliber) ? DVDT_22LR_MPS_PER_C : DVDT_CENTERFIRE_MPS_PER_C;
}

/**
 * Realized muzzle velocity at powder temperature `powderTempC`.
 * `catalogV0` is the ammo's listed v0 at 15 °C.
 */
export function muzzleVelocityAtPowderTempC(
  catalogV0: number,
  powderTempC: number,
  caliber?: string | null,
): number {
  if (!Number.isFinite(catalogV0)) return 50;
  const t = Number.isFinite(powderTempC)
    ? powderTempC
    : POWDER_TEMP_REFERENCE_C;
  const dvdt = powderTempDvDtMpsPerC(caliber);
  return Math.max(50, catalogV0 + (t - POWDER_TEMP_REFERENCE_C) * dvdt);
}

/** Copy ammo with v0 adjusted for powder temperature. */
export function ammoAtPowderTemp<
  T extends Pick<AmmoSpec, "v0"> & { caliber?: string },
>(ammo: T, powderTempC: number): T {
  return {
    ...ammo,
    v0: muzzleVelocityAtPowderTempC(ammo.v0, powderTempC, ammo.caliber),
  };
}
