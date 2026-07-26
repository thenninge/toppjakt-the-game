/**
 * Hunt shoot rest: backpack as shooting rest, or deployed bipod.
 * Chosen in Aware before Klar til skudd — gates weapon calm in HuntShootView.
 */

import type { BipodSpec } from "@/lib/bipod/spec";
import type { Score10 } from "@/lib/shop/score";

/** Radio choice in Aware → passed into the shoot scene. */
export type HuntShootRest = "none" | "backpack" | "bipod";

/**
 * Effective weaponCalm Score10 for backpack rest — double the best bipod (10).
 * Feeds the same calm formula as a deployed bipod.
 */
export const BAG_REST_WEAPON_CALM = 20;

/** Absolute bird-nerve bump when choosing backpack rest (+25 %). */
export const BAG_REST_NERVE = 0.25;

/** Synthetic bipod spec so bag rest reuses computeWeaponCalmFactor. */
export const BAG_REST_BIPOD_SPEC: BipodSpec = {
  weaponCalm: BAG_REST_WEAPON_CALM as Score10,
  deploySpeed: 5,
  tracking: 5,
};

/**
 * Bird nerve when deploying a bipod: 15 % at calm 1 → 5 % at calm 10.
 */
export function bipodDeployNerve(weaponCalm: number): number {
  const c = Math.max(1, Math.min(10, Math.round(weaponCalm)));
  return 0.15 - ((c - 1) / 9) * 0.1;
}

/** Nerve cost for the current rest choice (0 if none). */
export function shootRestNerve(
  rest: HuntShootRest,
  bipodWeaponCalm?: number,
): number {
  if (rest === "backpack") return BAG_REST_NERVE;
  if (rest === "bipod") return bipodDeployNerve(bipodWeaponCalm ?? 5);
  return 0;
}
