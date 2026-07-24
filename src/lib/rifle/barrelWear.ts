/**
 * Barrel wear — rifle precision degrades with round count through the tube.
 *
 * Real-world barrels often go ~1500+ rounds before clear wear; game pace uses
 * a compressed curve so it matters within a playthrough.
 *
 *   0–300 shots  → 1.0× (fresh)
 *   300–400      → linear ramp to 2.0× MOA on the rifle contribution
 *   400+         → 2.0× until CB Customs replaces the barrel (or new rifle)
 */

export const BARREL_WEAR_START_SHOTS = 300;
export const BARREL_WEAR_END_SHOTS = 400;
export const BARREL_WEAR_MAX_SCALE = 2;

/** Flat fee to rebarrel the equipped rifle at CB Customs. */
export const BARREL_REPLACE_NOK = 12_000;

/**
 * Multiplier on rifle `averageBestAccuracyMoa` (1 = fresh, up to 2 = worn out).
 */
export function barrelWearMoaScale(roundCount: number): number {
  const n = Math.max(0, Math.floor(Number.isFinite(roundCount) ? roundCount : 0));
  if (n <= BARREL_WEAR_START_SHOTS) return 1;
  if (n >= BARREL_WEAR_END_SHOTS) return BARREL_WEAR_MAX_SCALE;
  const t =
    (n - BARREL_WEAR_START_SHOTS) /
    (BARREL_WEAR_END_SHOTS - BARREL_WEAR_START_SHOTS);
  return 1 + t * (BARREL_WEAR_MAX_SCALE - 1);
}

export function barrelWearLabelNb(roundCount: number): string {
  const n = Math.max(0, Math.floor(roundCount));
  const scale = barrelWearMoaScale(n);
  if (n <= BARREL_WEAR_START_SHOTS) {
    return `frisk (${n}/${BARREL_WEAR_START_SHOTS})`;
  }
  if (n >= BARREL_WEAR_END_SHOTS) {
    return `utslitt (${n} skudd · ${scale.toFixed(1)}× MOA) — bytt pipe hos CB Customs`;
  }
  return `slites (${n} skudd · ${scale.toFixed(2)}× MOA)`;
}

export function isBarrelWornOut(roundCount: number): boolean {
  return Math.max(0, Math.floor(roundCount)) >= BARREL_WEAR_END_SHOTS;
}
