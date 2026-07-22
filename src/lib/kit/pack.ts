/**
 * Pack / sekk mass — kit gear + harvested carcasses → felt load for fatigue.
 */

import type { GameCarcass } from "@/lib/hunt/carcass";
import { carcassesWeightGrams } from "@/lib/hunt/carcass";
import {
  combineCarrySpecs,
  DEFAULT_CARRY,
  scoreToWeightPenaltyFactor,
  type CarrySpec,
} from "@/lib/carry/spec";
import {
  customsWeightReductionGrams,
  type CustomsMods,
} from "@/lib/customs/spec";
import {
  isCarryItem,
  isRifleItem,
  isStockItem,
  type ShopItem,
} from "@/lib/shop/types";

export type PackLoad = {
  /** Equipped kit after customs weight cuts (g). */
  kitGrams: number;
  /** Sum of bird carcasses in the bag (g). */
  carcassGrams: number;
  /** kit + carcass. */
  totalGrams: number;
  /** Felt kg after carry comfort (used for fatigue / speed). */
  kitFeltKg: number;
  totalFeltKg: number;
  /** Physical fatigue multiplier vs kit-only baseline (≥ 1). */
  fatigueLoadFactor: number;
};

/** Kit carry grams (customs fluting / stock slim applied). */
export function kitWeightGrams(
  kitItems: ShopItem[],
  customsMods: CustomsMods,
): number {
  const raw = kitItems.reduce((sum, item) => sum + item.weightGrams, 0);
  const rifle = kitItems.find(isRifleItem);
  const stock = kitItems.find(isStockItem);
  const cut = customsWeightReductionGrams(customsMods, {
    rifleWeightGrams: rifle?.weightGrams ?? 3500,
    stockWeightGrams: stock?.weightGrams ?? null,
  });
  return Math.max(0, raw - cut);
}

export function carryFromKit(kitItems: ShopItem[]): CarrySpec {
  const pieces = kitItems.filter(isCarryItem).map((i) => i.carry);
  return pieces.length > 0 ? combineCarrySpecs(pieces) : { ...DEFAULT_CARRY };
}

export function feltKgFromGrams(
  grams: number,
  carryComfort: CarrySpec["carryComfort"],
): number {
  return (Math.max(0, grams) / 1000) * scoreToWeightPenaltyFactor(carryComfort);
}

/**
 * Carcasses make the bag heavier than the kit alone.
 * Fatigue uses totalFelt / kitFelt so empty bag keeps today's baseline.
 */
export function fatigueLoadFactorFromFelt(
  kitFeltKg: number,
  totalFeltKg: number,
): number {
  const base = Math.max(0.35, kitFeltKg);
  return Math.max(1, totalFeltKg / base);
}

export function computePackLoad(input: {
  kitItems: ShopItem[];
  customsMods: CustomsMods;
  carcasses: Pick<GameCarcass, "weightKg">[];
}): PackLoad {
  const carry = carryFromKit(input.kitItems);
  const kitGrams = kitWeightGrams(input.kitItems, input.customsMods);
  const carcassGrams = carcassesWeightGrams(input.carcasses);
  const totalGrams = kitGrams + carcassGrams;
  const kitFeltKg = feltKgFromGrams(kitGrams, carry.carryComfort);
  const totalFeltKg = feltKgFromGrams(totalGrams, carry.carryComfort);
  return {
    kitGrams,
    carcassGrams,
    totalGrams,
    kitFeltKg,
    totalFeltKg,
    fatigueLoadFactor: fatigueLoadFactorFromFelt(kitFeltKg, totalFeltKg),
  };
}
