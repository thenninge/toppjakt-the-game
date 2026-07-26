/**
 * Placement-guide color bands ↔ distance brackets ↔ eyes visibility.
 *
 *   Rød    110–170 m  — synlig med bare øyne
 *   Lilla  180–230 m  — synlig med bare øyne
 *   Grønn  240–300 m  — krever kikkert/termisk
 *   Gul    300–500 m  — krever kikkert/termisk
 */

export type SpotColorBand = "rød" | "lilla" | "grønn" | "gul";

/** Infer guide color from a distance bracket (uses max, then mid). */
export function spotColorBandFromBracket(
  distanceMinM: number,
  distanceMaxM: number,
): SpotColorBand {
  const hi = Math.max(distanceMinM, distanceMaxM);
  const mid = (distanceMinM + distanceMaxM) / 2;
  if (hi <= 170 || mid <= 170) return "rød";
  if (hi <= 230 || mid <= 230) return "lilla";
  if (hi <= 300 || mid <= 300) return "grønn";
  return "gul";
}

/** Rød/lilla = eyes; grønn/gul = optics. */
export function defaultEyesVisibleForBracket(
  distanceMinM: number,
  distanceMaxM: number,
): boolean {
  const band = spotColorBandFromBracket(distanceMinM, distanceMaxM);
  return band === "rød" || band === "lilla";
}

/**
 * Explicit flag wins; otherwise derive from distance bracket.
 * Do not default omitted flags to `true` — that marked far (binos) seats
 * as eyes-band while the ≤230 m gate still hid them in eyes mode.
 */
export function resolveEyesVisible(
  eyesVisible: boolean | undefined,
  distanceMinM: number,
  distanceMaxM: number,
): boolean {
  if (typeof eyesVisible === "boolean") return eyesVisible;
  return defaultEyesVisibleForBracket(distanceMinM, distanceMaxM);
}
