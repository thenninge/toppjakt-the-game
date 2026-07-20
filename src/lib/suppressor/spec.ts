/**
 * Suppressor mass — carry vs weapon calm.
 *
 * Weight is the primary suppressor attribute for gameplay.
 * A can on the muzzle is far forward, so the same grams stabilize the
 * rifle more than they cost in kit carry:
 *
 *   kitWeight      += suppressor.weightGrams          // 1×
 *   weaponCalmMass += suppressor.weightGrams * 2      // 2× leverage
 *
 * Example: 300 g can → +300 g total kit, +600 g toward how calmly the
 * rifle sits when shooting.
 */

/** Forward-mass leverage for how calmly the rifle sits. */
export const SUPPRESSOR_CALM_WEIGHT_FACTOR = 2;

/** Contribution to total kit / carry weight (raw grams). */
export function suppressorKitWeightGrams(weightGrams: number): number {
  return weightGrams;
}

/**
 * Contribution to weapon calm mass (forward-weighted grams).
 * Higher calm mass → rifle sits quieter for the shot (engine TBD).
 */
export function suppressorWeaponCalmGrams(weightGrams: number): number {
  return weightGrams * SUPPRESSOR_CALM_WEIGHT_FACTOR;
}
