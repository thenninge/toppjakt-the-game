/**
 * Hunt shoot rest: backpack as shooting rest, or deployed bipod.
 * Chosen in Aware before Klar til skudd — gates weapon calm in HuntShootView.
 */

import type { BipodSpec } from "@/lib/bipod/spec";
import type { Score10 } from "@/lib/shop/score";

/** Radio choice in Aware → passed into the shoot scene. */
export type HuntShootRest = "none" | "backpack" | "bipod" | "bagrider";

/**
 * Effective weaponCalm Score10 for backpack rest — double the best bipod (10).
 * Feeds the same calm formula as a deployed bipod.
 */
export const BAG_REST_WEAPON_CALM = 20;

/** Absolute bird-nerve bump when choosing backpack rest (+25 %). */
export const BAG_REST_NERVE = 0.25;

/** Absolute bird-nerve when choosing CB bagrider rest (+10 %). */
export const BAGRIDER_REST_NERVE = 0.1;

/**
 * Calm multiplier for bagrider rest vs the backpack/bipod base
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

/** Nerve cost for the current rest choice (0 if none). */
export function shootRestNerve(
  rest: HuntShootRest,
  bipodWeaponCalm?: number,
): number {
  if (rest === "backpack") return BAG_REST_NERVE;
  if (rest === "bipod") return bipodDeployNerve(bipodWeaponCalm ?? 5);
  if (rest === "bagrider") return BAGRIDER_REST_NERVE;
  return 0;
}

/**
 * Which front/bag rest bagrider calm is measured against.
 * Prefers backpack (rear bag + pack), else bipod.
 */
export function bagriderCalmBaseRest(
  hasBackpack: boolean,
  hasBipod: boolean,
): "backpack" | "bipod" | null {
  if (hasBackpack) return "backpack";
  if (hasBipod) return "bipod";
  return null;
}

/** Short rest label for UI status lines. */
export function shootRestLabelNb(rest: HuntShootRest): string {
  if (rest === "backpack") return "sekk";
  if (rest === "bipod") return "bipod";
  if (rest === "bagrider") return "bagrider";
  return "ingen";
}

/** True when the rest contributes bipod/bag weapon calm. */
export function restProvidesWeaponCalm(rest: HuntShootRest): boolean {
  return rest === "backpack" || rest === "bipod" || rest === "bagrider";
}

/**
 * Bipod-spec fed into {@link computeWeaponCalmFactor} for the chosen rest.
 * Bagrider uses backpack base when available, else kit bipod — then ×1.2
 * is applied separately via {@link BAGRIDER_REST_CALM_MULT}.
 */
export function bipodSpecForShootRest(
  rest: HuntShootRest,
  opts: {
    hasBackpack: boolean;
    kitBipod?: BipodSpec | null;
  },
): BipodSpec | null {
  if (rest === "backpack") return BAG_REST_BIPOD_SPEC;
  if (rest === "bipod") return opts.kitBipod ?? null;
  if (rest === "bagrider") {
    if (opts.hasBackpack) return BAG_REST_BIPOD_SPEC;
    return opts.kitBipod ?? null;
  }
  return null;
}
