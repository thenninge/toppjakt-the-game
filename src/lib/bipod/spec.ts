/**
 * Bipods / tofot — kit weight up, weapon calm up (when deployed).
 *
 * Score10: higher is always better.
 * - weaponCalm: how quietly the rifle sits with the pod down
 *   (expensive + heavy → higher calm — Accu-Tac FC / RRS beat Game-On plastic)
 * - deploySpeed: fold/deploy faffe on the hunt
 * - tracking: pan / cant on uneven ground
 *
 * Kit carry always pays full weightGrams. Calm only applies when the bipod
 * is actually supporting the shot (prone / rest).
 *
 * Future (Shooting Range — not built yet): loaner “generisk tofot” /
 * “sandsekk” only if the player does not already own them or have them
 * in kit — try → get hooked → buy more at XXL.
 */

import type { Score10 } from "@/lib/shop/score";

export type BipodSpec = {
  /**
   * 1–10. Higher = calmer rifle when deployed.
   * Primary bipod payoff — never a null factor.
   */
  weaponCalm: Score10;
  /** 1–10. Higher = faster deploy / fold. */
  deploySpeed: Score10;
  /** 1–10. Higher = better pan/cant on uneven ground. */
  tracking: Score10;
};

/**
 * Weapon-calm mass when the bipod is deployed.
 * Heavier pods with high weaponCalm add a lot of “settled” mass to the shot.
 */
export function bipodWeaponCalmGrams(
  weightGrams: number,
  bipod: BipodSpec,
): number {
  const leverage = 0.75 + bipod.weaponCalm * 0.4;
  return Math.round(weightGrams * leverage);
}
