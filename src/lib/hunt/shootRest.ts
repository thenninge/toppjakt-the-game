/**
 * Hunt shoot rest: backpack or bipod as front/bag support.
 * CB bagrider is an additive rear bag — only with sekk or bipod active.
 */

import type { BipodSpec } from "@/lib/bipod/spec";
import type { Score10 } from "@/lib/shop/score";

/** Front/bag rest choice in Aware → passed into the shoot scene. */
export type HuntShootRest = "none" | "backpack" | "bipod";

/**
 * Effective weaponCalm Score10 for backpack rest — double the best bipod (10).
 * Feeds the same calm formula as a deployed bipod.
 */
export const BAG_REST_WEAPON_CALM = 20;

/** Absolute bird-nerve bump when choosing backpack rest (+25 %). */
export const BAG_REST_NERVE = 0.25;

/** Absolute bird-nerve when adding CB bagrider on top of sekk/bipod (+10 %). */
export const BAGRIDER_REST_NERVE = 0.1;

/**
 * Calm multiplier for bagrider vs the active backpack/bipod base
 * (50 → 60, not 50+20).
 */
export const BAGRIDER_REST_CALM_MULT = 1.2;

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

/** Nerve cost for the front rest only (0 if none). */
export function shootRestNerve(
  rest: HuntShootRest,
  bipodWeaponCalm?: number,
): number {
  if (rest === "backpack") return BAG_REST_NERVE;
  if (rest === "bipod") return bipodDeployNerve(bipodWeaponCalm ?? 5);
  return 0;
}

/** Front rest + optional bagrider nerve. */
export function shootRestTotalNerve(
  rest: HuntShootRest,
  bagriderActive: boolean,
  bipodWeaponCalm?: number,
): number {
  return (
    shootRestNerve(rest, bipodWeaponCalm) +
    (bagriderActive && rest !== "none" ? BAGRIDER_REST_NERVE : 0)
  );
}

/** Short rest label for UI status lines. */
export function shootRestLabelNb(
  rest: HuntShootRest,
  bagriderActive = false,
): string {
  if (rest === "backpack") {
    return bagriderActive ? "sekk+bagrider" : "sekk";
  }
  if (rest === "bipod") {
    return bagriderActive ? "bipod+bagrider" : "bipod";
  }
  return "ingen";
}

/** True when the front rest contributes bipod/bag weapon calm. */
export function restProvidesWeaponCalm(rest: HuntShootRest): boolean {
  return rest === "backpack" || rest === "bipod";
}

/**
 * Bipod-spec fed into {@link computeWeaponCalmFactor} for the chosen front rest.
 * Apply {@link BAGRIDER_REST_CALM_MULT} separately when bagrider is active.
 */
export function bipodSpecForShootRest(
  rest: HuntShootRest,
  opts: {
    kitBipod?: BipodSpec | null;
  },
): BipodSpec | null {
  if (rest === "backpack") return BAG_REST_BIPOD_SPEC;
  if (rest === "bipod") return opts.kitBipod ?? null;
  return null;
}
