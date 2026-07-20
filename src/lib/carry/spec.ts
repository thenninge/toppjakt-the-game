/**
 * Carry systems (chestrigs & backpacks) — Score10 player language.
 *
 * All scores are 1–10; higher is always better (never 0 / never null).
 *
 * | Score            | Meaning                                      |
 * |------------------|----------------------------------------------|
 * | carryComfort     | Walk faster / less fatigue under load        |
 * | quickRelease     | Less time from carry to ready-to-shoot       |
 * | opticsAccess     | Less time to get LRF/binos into observation  |
 *
 * Backpacks lean on comfort + quickRelease; chestrigs on opticsAccess.
 * Engine converts scores → seconds / weight penalty when needed.
 */

import type { Score10 } from "@/lib/shop/score";
import { clampScore10 } from "@/lib/shop/score";

export type CarrySpec = {
  /** 1–10. Higher = faster walking, less fatigue under kit weight. */
  carryComfort: Score10;
  /** 1–10. Higher = quicker rifle presentation (QRR / scabbard). */
  quickRelease: Score10;
  /** 1–10. Higher = quicker LRF / binocular access. */
  opticsAccess: Score10;
};

/** Bare-bones carry when player has no pack/chestrig. */
export const DEFAULT_CARRY: CarrySpec = {
  carryComfort: 2,
  quickRelease: 3,
  opticsAccess: 1,
};

/**
 * Higher score → fewer deploy seconds.
 * 10 ≈ 1.2 s, 5 ≈ 6.2 s, 1 ≈ 10.2 s.
 */
export function scoreToDeploySeconds(score: Score10): number {
  return 11.2 - clampScore10(score);
}

/**
 * Higher carryComfort → lower felt-weight multiplier.
 * 10 → 0.65, 5 → 0.85, 1 → 1.01 (≈ full penalty).
 */
export function scoreToWeightPenaltyFactor(carryComfort: Score10): number {
  return 1.05 - clampScore10(carryComfort) * 0.04;
}

export type CarryEngineTimes = {
  opticsDeploySeconds: number;
  rifleDeploySeconds: number;
  weightPenaltyFactor: number;
};

export function carryToEngine(spec: CarrySpec): CarryEngineTimes {
  return {
    opticsDeploySeconds: scoreToDeploySeconds(spec.opticsAccess),
    rifleDeploySeconds: scoreToDeploySeconds(spec.quickRelease),
    weightPenaltyFactor: scoreToWeightPenaltyFactor(spec.carryComfort),
  };
}

/**
 * Combine equipped carry pieces (chestrig + backpack).
 * Best (highest) score wins per axis — player always wants high scores.
 */
export function combineCarrySpecs(pieces: CarrySpec[]): CarrySpec {
  if (pieces.length === 0) return { ...DEFAULT_CARRY };
  return {
    carryComfort: Math.max(...pieces.map((p) => p.carryComfort)),
    quickRelease: Math.max(...pieces.map((p) => p.quickRelease)),
    opticsAccess: Math.max(...pieces.map((p) => p.opticsAccess)),
  };
}
