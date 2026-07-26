/**
 * Carry systems (chestrigs & backpacks) — Score10 player language.
 *
 * All scores are 1–10; higher is always better (never 0 / never null).
 *
 * Chestrig:
 * | Score            | Meaning                                                      |
 * |------------------|--------------------------------------------------------------|
 * | carryComfort     | Fraction of optic (LRF/thermal) weight felt on Body          |
 * | quickRelease     | Bird-nerve when raising binos (10 = 0 %, 1 = +10 %)          |
 *
 * Backpack:
 * | carryComfort     | Felt pack load: 10 = 25% lighter (75% felt), 1 = full weight |
 * | quickRelease     | Bird-nerve when presenting rifle (10 = 0 %, 1 = +10 %)       |
 *
 * Comfort felt fraction: (10 − score) / 9 → 10 = 0 %, 1 = 100 %.
 */

import type { Score10 } from "@/lib/shop/score";
import { clampScore10 } from "@/lib/shop/score";

export type CarrySpec = {
  /** 1–10. Higher = less of that load's weight felt on Body. */
  carryComfort: Score10;
  /**
   * 1–10. Higher = less bird-nerve when deploying that carry's gear
   * (chestrig → optics, backpack → rifle).
   */
  quickRelease: Score10;
};

/** Bare-bones carry when player has no pack/chestrig. */
export const DEFAULT_CARRY: CarrySpec = {
  carryComfort: 2,
  quickRelease: 3,
};

/**
 * QR → additive bird nerve.
 * 10 → 0, 1 → 0.10 (10 %).
 */
export function scoreToQuickReleaseNerve(quickRelease: Score10): number {
  return ((10 - clampScore10(quickRelease)) / 9) * 0.1;
}

/**
 * Comfort → fraction of that load's grams felt on Body (chestrig / optics).
 * 10 → 0 (no drain), 1 → 1 (full weight).
 */
export function scoreToFeltFraction(carryComfort: Score10): number {
  return (10 - clampScore10(carryComfort)) / 9;
}

/**
 * Backpack comfort → felt fraction of non-optic kit + carcasses.
 * Always feels some load: 10 → 0.75 (25 % lighter), 1 → 1.0 (full weight).
 */
export function scoreToBackpackFeltFraction(carryComfort: Score10): number {
  return 0.75 + scoreToFeltFraction(carryComfort) * 0.25;
}

/** @deprecated Prefer {@link scoreToFeltFraction}. */
export function scoreToOpticFeltFraction(carryComfort: Score10): number {
  return scoreToFeltFraction(carryComfort);
}

/**
 * @deprecated Old backpack curve (10 → 0.65×). Prefer {@link scoreToFeltFraction}.
 */
export function scoreToWeightPenaltyFactor(carryComfort: Score10): number {
  return 1.05 - clampScore10(carryComfort) * 0.04;
}

/**
 * Combine equipped carry pieces of the same kind.
 * Best (highest) score wins per axis.
 */
export function combineCarrySpecs(pieces: CarrySpec[]): CarrySpec {
  if (pieces.length === 0) return { ...DEFAULT_CARRY };
  return {
    carryComfort: Math.max(...pieces.map((p) => p.carryComfort)),
    quickRelease: Math.max(...pieces.map((p) => p.quickRelease)),
  };
}
