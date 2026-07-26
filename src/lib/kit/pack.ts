/**
 * Pack / sekk mass — kit gear + harvested carcasses → felt load for fatigue.
 *
 * Comfort:
 *   Chestrig: feltFraction = (10 − comfort) / 9 → 10 = 0 %, 1 = 100 % of optic grams.
 *   Backpack: always feels load; 10 = 75 % felt (25 % lighter), 1 = 100 % felt
 *             on non-optic kit + carcasses.
 */

import type { GameCarcass } from "@/lib/hunt/carcass";
import { carcassesWeightGrams } from "@/lib/hunt/carcass";
import {
  DEFAULT_CARRY,
  scoreToBackpackFeltFraction,
  scoreToFeltFraction,
  scoreToQuickReleaseNerve,
  type CarrySpec,
} from "@/lib/carry/spec";
import {
  customsWeightReductionGrams,
  type CustomsMods,
} from "@/lib/customs/spec";
import {
  isBackpackItem,
  isChestrigItem,
  isLrfItem,
  isRifleItem,
  isStockItem,
  isThermalItem,
  type ShopItem,
} from "@/lib/shop/types";

export type PackLoad = {
  /** Equipped kit after customs weight cuts (g). */
  kitGrams: number;
  /** LRF + thermal grams (subset of kit). */
  opticGrams: number;
  /** Sum of bird carcasses in the bag (g). */
  carcassGrams: number;
  /** kit + carcass. */
  totalGrams: number;
  /** Felt kg after chestrig/backpack comfort (used for fatigue / speed). */
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

export function opticWeightGrams(kitItems: ShopItem[]): number {
  return kitItems
    .filter((i) => isLrfItem(i) || isThermalItem(i))
    .reduce((sum, item) => sum + item.weightGrams, 0);
}

export function chestrigFromKit(kitItems: ShopItem[]): CarrySpec | null {
  const item = kitItems.find(isChestrigItem);
  return item ? { ...item.carry } : null;
}

export function backpackFromKit(kitItems: ShopItem[]): CarrySpec | null {
  const item = kitItems.find(isBackpackItem);
  return item ? { ...item.carry } : null;
}

/**
 * Bird-nerve bump when raising binos/thermal.
 * Chestrig QR 10 → 0, QR 1 → +10 %. No chestrig → treated as QR 1.
 * No LRF/thermal in kit → 0.
 */
export function chestrigOpticsRaiseNerve(kitItems: ShopItem[]): number {
  const hasOptics = kitItems.some((i) => isLrfItem(i) || isThermalItem(i));
  if (!hasOptics) return 0;
  const chest = chestrigFromKit(kitItems);
  return scoreToQuickReleaseNerve(chest?.quickRelease ?? 1);
}

/**
 * Bird-nerve bump when presenting the rifle (Klar til skudd).
 * Backpack QR 10 → 0, QR 1 → +10 %. No backpack → treated as QR 1.
 */
export function backpackRifleRaiseNerve(kitItems: ShopItem[]): number {
  const hasRifle = kitItems.some(isRifleItem);
  if (!hasRifle) return 0;
  const pack = backpackFromKit(kitItems);
  return scoreToQuickReleaseNerve(pack?.quickRelease ?? 1);
}

/** @deprecated Prefer backpackFromKit / chestrigFromKit. */
export function carryFromKit(kitItems: ShopItem[]): CarrySpec {
  const bp = backpackFromKit(kitItems);
  const chest = chestrigFromKit(kitItems);
  if (bp && chest) {
    return {
      carryComfort: Math.max(bp.carryComfort, chest.carryComfort),
      quickRelease: Math.max(bp.quickRelease, chest.quickRelease),
    };
  }
  return bp ?? chest ?? { ...DEFAULT_CARRY };
}

export function feltKgFromGrams(
  grams: number,
  carryComfort: CarrySpec["carryComfort"],
): number {
  return (Math.max(0, grams) / 1000) * scoreToFeltFraction(carryComfort);
}

export function backpackFeltKgFromGrams(
  grams: number,
  carryComfort: CarrySpec["carryComfort"],
): number {
  return (Math.max(0, grams) / 1000) * scoreToBackpackFeltFraction(carryComfort);
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
  const kitGrams = kitWeightGrams(input.kitItems, input.customsMods);
  const opticGrams = Math.min(kitGrams, opticWeightGrams(input.kitItems));
  const nonOpticKitGrams = Math.max(0, kitGrams - opticGrams);
  const carcassGrams = carcassesWeightGrams(input.carcasses);

  const chest = chestrigFromKit(input.kitItems);
  const backpack = backpackFromKit(input.kitItems);

  // No chestrig → full optic weight felt (comfort 1).
  const opticFeltKg =
    (opticGrams / 1000) * scoreToFeltFraction(chest?.carryComfort ?? 1);

  // No backpack → full non-optic + carcass felt (comfort 1). Gate usually requires a pack.
  const packComfort = backpack?.carryComfort ?? 1;
  const nonOpticFeltKg = backpackFeltKgFromGrams(nonOpticKitGrams, packComfort);
  const carcassFeltKg = backpackFeltKgFromGrams(carcassGrams, packComfort);

  const kitFeltKg = nonOpticFeltKg + opticFeltKg;
  const totalFeltKg = kitFeltKg + carcassFeltKg;
  const totalGrams = kitGrams + carcassGrams;

  return {
    kitGrams,
    opticGrams,
    carcassGrams,
    totalGrams,
    kitFeltKg,
    totalFeltKg,
    fatigueLoadFactor: fatigueLoadFactorFromFelt(kitFeltKg, totalFeltKg),
  };
}
