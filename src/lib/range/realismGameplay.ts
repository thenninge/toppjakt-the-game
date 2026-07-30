/**
 * Per-realism gameplay modifiers (not admin feature toggles).
 *
 * Low = assisted hunt. Medium = default. High = full tube/cant challenge.
 */

import type { GameRealism } from "@/lib/optics/turretStyle";

export function realismLevelKey(
  realism: GameRealism | null | undefined,
): GameRealism {
  if (realism === "high" || realism === "low") return realism;
  return "medium";
}

/** Weapon angular envelope multiplier (catalog MOA stack). */
export function realismDispersionMult(
  realism: GameRealism | null | undefined,
): number {
  return realism === "low" ? 0.5 : 1;
}

/** Bird-nerve build rate multiplier in Aware / Shoot / Spot. */
export function realismNerveRateMult(
  realism: GameRealism | null | undefined,
): number {
  return realism === "low" ? 0.5 : 1;
}

/** Ettersøk find-chance multiplier before the random roll. */
export function realismEttersokFindMult(
  realism: GameRealism | null | undefined,
): number {
  return realism === "low" ? 2 : 1;
}

/** Low: turrets track LRF range + wind automatically. */
export function realismAutoTurretDial(
  realism: GameRealism | null | undefined,
): boolean {
  return realism === "low";
}

/** Low: skuddpar saved on shot without Triggercam / camcorder. */
export function realismAutoSkuddpar(
  realism: GameRealism | null | undefined,
): boolean {
  return realism === "low";
}

/** Visual scope recoil kick — High is 10× Medium/Low. */
export function realismRecoilKickMult(
  realism: GameRealism | null | undefined,
): number {
  return realismLevelKey(realism) === "high" ? 10 : 1;
}
