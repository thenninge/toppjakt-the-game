/**
 * Kit movement — total weight + carry comfort + skis → top speed.
 *
 * Placeholder formula (tune later). Display as km/h for the player.
 */

import type { CarrySpec } from "@/lib/carry/spec";
import {
  DEFAULT_CARRY,
  combineCarrySpecs,
  scoreToWeightPenaltyFactor,
} from "@/lib/carry/spec";
import type { SkiSpec } from "@/lib/ski/spec";

/** Hiking baseline without ski boost (km/h). */
export const BASE_TOP_SPEED_KMH = 5.5;

/** Boots-only defaults when no skis/snowshoes equipped. */
export const BOOTS_ONLY_SKI: SkiSpec = {
  maxSpeed: 3,
  flowPerKg: 2,
  widthMm: 0,
};

export function computeKitTopSpeedKmh(opts: {
  totalWeightGrams: number;
  carryPieces: CarrySpec[];
  ski: SkiSpec | null;
}): number {
  const carry =
    opts.carryPieces.length > 0
      ? combineCarrySpecs(opts.carryPieces)
      : DEFAULT_CARRY;
  const feltKg =
    (opts.totalWeightGrams / 1000) *
    scoreToWeightPenaltyFactor(carry.carryComfort);

  const ski = opts.ski ?? BOOTS_ONLY_SKI;
  const speed = ski.maxSpeed / 10;
  const flow = ski.flowPerKg / 10;
  // Flow matters more as the pack gets heavier.
  const loadRelief = 1 + flow * (feltKg / 28);
  // Width softens the weight penalty (deep-snow / heavy-pack flotation).
  const widthHelp = 1 + Math.min(0.35, ski.widthMm / 400);
  const weightDrag = 1 + feltKg / (20 * widthHelp);

  const kmh =
    BASE_TOP_SPEED_KMH * (0.55 + 0.7 * speed) * loadRelief * widthHelp / weightDrag;

  return Math.round(kmh * 10) / 10;
}

export function formatTopSpeed(kmh: number): string {
  return `${kmh.toFixed(1)} km/t`;
}
