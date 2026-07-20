/**
 * Misc kit effects — simple two-knob model (for now).
 *
 * Every shop item already has weightGrams. Misc items ALSO declare
 * enduranceGrams: a placeholder “comfort / stamina / coffee” credit
 * expressed in grams-equivalent.
 *
 * Working idea (NOT final engine math):
 *   feltWeightContribution ≈ weightGrams - enduranceGrams
 *
 * Example: Termos 380 g weight + 2000 endurance → net −1620 g felt
 * (you carry the thermos, but it lets you go farther / stay sharper).
 *
 * Everything purchased feeds total gameplay of:
 *   - what ground you can cover
 *   - what the kit weighs (felt + raw)
 *   - what it costs (NOK)
 *
 * Expand with more factor types later; keep misc on these two knobs now.
 */

export type MiscSpec = {
  /**
   * Endurance credit in grams-equivalent.
   * Higher = more offset against felt carry weight / fatigue.
   * 0 = pure dead weight (e.g. soft case in the truck).
   */
  enduranceGrams: number;
};

/** Placeholder net contribution to felt load (can be negative = net help). */
export function miscFeltWeightGrams(
  weightGrams: number,
  misc: MiscSpec,
): number {
  return weightGrams - misc.enduranceGrams;
}
