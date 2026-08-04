/**
 * Pack / sekk mass — kit gear + harvested carcasses → felt load for fatigue.
 *
 * Comfort:
 *   Chestrig: feltFraction = (10 − comfort) / 9 → 10 = 0 %, 1 = 100 % of optic grams.
 *   Backpack: always feels load; 10 = 75 % felt (25 % lighter), 1 = 100 % felt
 *             on non-optic kit + carcasses.
 *
 * Rifle catalog weight includes factory barrel + factory stock. When those are
 * replaced (CB custom pipe / aftermarket stock), subtract the factory share so
 * totals do not double-count.
 */

import type { GameCarcass } from "@/lib/hunt/carcass";
import { carcassesWeightGrams } from "@/lib/hunt/carcass";
import {
  DEFAULT_CARRY,
  scoreToBackpackFeltFraction,
  scoreToFeltFraction,
  scoreToOpticsRaiseTransitionSec,
  scoreToQuickReleaseNerve,
  type CarrySpec,
} from "@/lib/carry/spec";
import {
  BOLT_FLUTING_WEIGHT_G,
  FLUTING_WEIGHT_G,
  STOCK_SLIM_FRACTION,
  estimatedFactoryBarrelGrams,
  estimatedFactoryStockGrams,
  type CustomsMods,
} from "@/lib/customs/spec";
import type { InstalledCustomBarrel } from "@/lib/customs/customBarrel";
import {
  isBackpackItem,
  isCamoItem,
  isChestrigItem,
  isLrfItem,
  isRifleItem,
  isStockItem,
  isThermalItem,
  type ShopItem,
} from "@/lib/shop/types";
import { isBodyWornCamo } from "@/lib/camo/spec";
import { formatWeightKg } from "@/lib/shop/weights";

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

function customBarrelForRifle(
  rifle: ShopItem,
  customBarrels: Record<string, InstalledCustomBarrel>,
): InstalledCustomBarrel | undefined {
  return customBarrels[rifle.id];
}

/** Kit carry grams (replacements + CB fluting / stock slim). Body-worn camo excluded. */
export function kitWeightGrams(
  kitItems: ShopItem[],
  customsMods: CustomsMods,
  customBarrels: Record<string, InstalledCustomBarrel> = {},
): number {
  let sum = 0;
  for (const item of kitItems) {
    sum += itemCarryWeightGrams(item, customsMods, kitItems, customBarrels);
  }
  const rifle = kitItems.find(isRifleItem);
  const barrel = rifle ? customBarrelForRifle(rifle, customBarrels) : undefined;
  if (barrel) sum += barrel.weightGrams;
  return Math.max(0, sum);
}

/**
 * Carry weight for one kit item after replacements + CB fluting / stock slim.
 * Body-worn apparel → 0 (worn, not in sekk).
 * Custom pipe mass is not on the rifle row — add via {@link kitWeightGrams} / Current rig pipe line.
 */
export function itemCarryWeightGrams(
  item: ShopItem,
  mods: CustomsMods,
  kitItems: ShopItem[],
  customBarrels: Record<string, InstalledCustomBarrel> = {},
): number {
  if (isCamoItem(item) && isBodyWornCamo(item.camo)) return 0;

  let g = item.weightGrams;
  if (isRifleItem(item)) {
    const hasStock = kitItems.some(isStockItem);
    const custom = customBarrelForRifle(item, customBarrels);
    if (hasStock) {
      g = Math.max(0, g - estimatedFactoryStockGrams(item.weightGrams));
    }
    if (custom) {
      g = Math.max(0, g - estimatedFactoryBarrelGrams(item.weightGrams));
    } else if (mods.fluting) {
      // Factory-pipe fluting only — custom blanks carry their own mass on the pipe line.
      g = Math.max(0, g - FLUTING_WEIGHT_G);
    }
    if (mods.boltFluting) {
      g = Math.max(0, g - BOLT_FLUTING_WEIGHT_G);
    }
    if (mods.stockSlim && !hasStock) {
      const est = Math.round(
        estimatedFactoryStockGrams(item.weightGrams) * STOCK_SLIM_FRACTION,
      );
      g = Math.max(0, g - est);
    }
    return g;
  }
  if (isStockItem(item) && mods.stockSlim) {
    return Math.max(0, Math.round(g * (1 - STOCK_SLIM_FRACTION)));
  }
  return g;
}

/** Short note when displayed carry weight differs from catalog. */
export function itemCarryWeightNote(
  item: ShopItem,
  mods: CustomsMods,
  kitItems: ShopItem[],
  customBarrels: Record<string, InstalledCustomBarrel> = {},
): string | null {
  if (isCamoItem(item) && isBodyWornCamo(item.camo)) {
    return `katalog ${formatWeightKg(item.weightGrams)} · på kroppen`;
  }
  const carry = itemCarryWeightGrams(item, mods, kitItems, customBarrels);
  if (carry === item.weightGrams) return null;
  const parts: string[] = [`katalog ${formatWeightKg(item.weightGrams)}`];
  if (isRifleItem(item)) {
    if (kitItems.some(isStockItem)) parts.push("− fabrikkstokk");
    if (customBarrelForRifle(item, customBarrels)) {
      parts.push("− fabrikpipe");
    } else if (mods.fluting) {
      parts.push("fluting");
    }
    if (mods.boltFluting) parts.push("bolt fluting");
    if (mods.stockSlim && !kitItems.some(isStockItem)) {
      parts.push("slank stokk (estimert)");
    }
  } else if (isStockItem(item) && mods.stockSlim) {
    parts.push("slank stokk");
  }
  return parts.join(" · ");
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
 * Black-veil duration when raising binos/thermal.
 * Chestrig QR 10 → 0.5 s, QR 1 → 2 s. No chestrig → treated as QR 1.
 */
export function chestrigOpticsRaiseTransitionSec(kitItems: ShopItem[]): number {
  const chest = chestrigFromKit(kitItems);
  return scoreToOpticsRaiseTransitionSec(chest?.quickRelease ?? 1);
}

/**
 * Bird-nerve bump when deploying the rifle (Aware «Deploy gun»).
 * Same QR scale as chestrig optics: 10 → 0 %, 1 → +10 %.
 * No backpack → treated as QR 1.
 */
export function backpackRifleRaiseNerve(kitItems: ShopItem[]): number {
  const hasRifle = kitItems.some(isRifleItem);
  if (!hasRifle) return 0;
  const pack = backpackFromKit(kitItems);
  return scoreToQuickReleaseNerve(pack?.quickRelease ?? 1);
}

/**
 * Absolute bird-nerve bump on unspotted birds when the rifle is mounted
 * back into the pack (Aware «Mount gun» / auto-mount on cell change / Track).
 */
export const MOUNT_GUN_UNSPOTTED_NERVE = 0.3;

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
  customBarrels?: Record<string, InstalledCustomBarrel>;
}): PackLoad {
  const customBarrels = input.customBarrels ?? {};
  const kitGrams = kitWeightGrams(
    input.kitItems,
    input.customsMods,
    customBarrels,
  );
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
