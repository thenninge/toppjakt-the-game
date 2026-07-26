/**
 * Suppressor mass + sound reduction.
 *
 * Weight is the primary suppressor attribute for carry / calm:
 *
 *   kitWeight      += suppressor.weightGrams          // 1×
 *   weaponCalmMass += suppressor.weightGrams * 2      // 2× leverage
 *
 * Example: 300 g can → +300 g total kit, +600 g toward how calmly the
 * rifle sits when shooting.
 *
 * Sound reduction (dB, negative) drives post-shot bird flush for
 * ordinary supersonic ammo. Subsonic + suppressor stays silent (0 % flush).
 *
 * Flush scale (linear):
 *   0 dB  → 100 % flush
 *  −40 dB →  65 % flush
 *   flushChance = 1 + soundReductionDb * (0.35 / 40)
 */

export type SuppressorSpec = {
  /**
   * Peak sound reduction in dB (negative). More negative = quieter.
   * Typical hunting cans ≈ −20…−38; budget ≈ −18…−22.
   */
  soundReductionDb: number;
};

/** Forward-mass leverage for how calmly the rifle sits. */
export const SUPPRESSOR_CALM_WEIGHT_FACTOR = 2;

/** Contribution to total kit / carry weight (raw grams). */
export function suppressorKitWeightGrams(weightGrams: number): number {
  return weightGrams;
}

/**
 * Contribution to weapon calm mass (forward-weighted grams).
 * Higher calm mass → rifle sits quieter for the shot.
 */
export function suppressorWeaponCalmGrams(weightGrams: number): number {
  return weightGrams * SUPPRESSOR_CALM_WEIGHT_FACTOR;
}

/** Reference attenuation (as positive dB) for {@link SUPPRESSOR_FLUSH_AT_REF_DB}. */
export const SUPPRESSOR_FLUSH_REF_ATTENUATION_DB = 40;
/** Flush chance at −40 dB reduction. */
export const SUPPRESSOR_FLUSH_AT_REF_DB = 0.65;

/**
 * Chance that a non-silent (supersonic) shot flushes birds in the cell.
 * 0 dB → 1.0, −40 dB → 0.65.
 */
export function suppressorShotFlushChance(soundReductionDb: number): number {
  if (!Number.isFinite(soundReductionDb)) return 1;
  const dropPerDb =
    (1 - SUPPRESSOR_FLUSH_AT_REF_DB) / SUPPRESSOR_FLUSH_REF_ATTENUATION_DB;
  return Math.min(1, Math.max(0, 1 + soundReductionDb * dropPerDb));
}

/** Stay chance = 1 − flush chance for a suppressed supersonic shot. */
export function suppressorShotStayChance(soundReductionDb: number): number {
  return 1 - suppressorShotFlushChance(soundReductionDb);
}
