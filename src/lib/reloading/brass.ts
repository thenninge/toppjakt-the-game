/**
 * Spent brass from fired rounds → hjemmelading inventory.
 *
 * Centerfire shots grant one once-fired case tagged with the *ammo brand*
 * (Lapua factory ammo → Lapua hylser). Rimfire yields nothing.
 */

import { getShopItem } from "@/lib/shop/catalog";
import { isAmmoItem } from "@/lib/shop/types";
import {
  BRASS_BRANDS,
  LEGACY_SPENT_BRASS_ITEM_IDS,
  SPENT_BRASS_CALIBERS,
  spentBrassItemId,
  type BrassBrandSlug,
  type SpentBrassKey,
} from "@/lib/reloading/spentBrassData";

export type { BrassBrandSlug, SpentBrassKey };
export {
  BRASS_BRANDS,
  LEGACY_SPENT_BRASS_ITEM_IDS,
  SPENT_BRASS_CALIBERS,
  spentBrassItemId,
};
export { brandedSpentBrassCatalogDrafts } from "@/lib/reloading/spentBrassData";

export function brassBrandSlugFromShopBrand(
  brand: string | undefined | null,
): BrassBrandSlug {
  if (!brand) return "other";
  const b = brand.toLowerCase();
  if (b.includes("lapua")) return "lapua";
  if (b.includes("norma")) return "norma";
  if (b.includes("federal")) return "federal";
  if (b.includes("hornady")) return "hornady";
  if (b.includes("sako")) return "sako";
  if (b.includes("remington")) return "remington";
  return "other";
}

export function brassBrandLabel(slug: BrassBrandSlug): string {
  return BRASS_BRANDS.find((b) => b.slug === slug)?.label ?? "Annet";
}

/**
 * Map ammo / die caliber label → spent brass key.
 */
export function spentBrassKeyForCaliber(
  caliber: string | undefined | null,
): SpentBrassKey | null {
  if (!caliber) return null;
  const c = caliber
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/×/g, "x")
    .replace(/\s+/g, "");

  if (/\.22|22lr|17hmr|\.17/.test(c)) return null;
  if (
    c.includes("300blk") ||
    c.includes(".300black") ||
    c.includes("300blackout")
  ) {
    return "300blk";
  }
  if (c.includes("308")) return "308";
  if (c.includes("30-06") || c.includes("3006") || c.includes(".30-06")) {
    return "3006";
  }
  if (c.includes("223") || c.includes("5.56")) return "223";
  if (c.includes("creedmoor") || c.includes("6.5cm") || c.includes("65cm")) {
    return "65cm";
  }
  if (
    c.includes("6.5x55") ||
    c.includes("65x55") ||
    c.includes("6.5x55se") ||
    c.includes("swedish")
  ) {
    return "65x55";
  }
  return null;
}

/** Resolve spent brass catalog id from an ammo shop item id. */
export function spentBrassItemIdForAmmo(ammoId: string): string | null {
  const item = getShopItem(ammoId);
  if (!item || !isAmmoItem(item)) return null;
  const key = spentBrassKeyForCaliber(item.ammo.caliber);
  if (!key) return null;
  const brand = brassBrandSlugFromShopBrand(item.brand);
  return spentBrassItemId(key, brand);
}

export function isSpentBrassItemId(itemId: string): boolean {
  if (itemId.startsWith("reload-spent-brass-")) return true;
  return Object.values(LEGACY_SPENT_BRASS_ITEM_IDS).includes(itemId);
}

export function parseSpentBrassItemId(itemId: string): {
  caliberKey: SpentBrassKey;
  brand: BrassBrandSlug;
} | null {
  const branded = /^reload-spent-brass-([a-z0-9]+)-([a-z]+)$/.exec(itemId);
  if (branded) {
    const caliberKey = branded[1] as SpentBrassKey;
    const brand = branded[2] as BrassBrandSlug;
    if (caliberKey in LEGACY_SPENT_BRASS_ITEM_IDS) {
      return { caliberKey, brand };
    }
  }
  for (const [key, id] of Object.entries(LEGACY_SPENT_BRASS_ITEM_IDS)) {
    if (id === itemId) {
      return { caliberKey: key as SpentBrassKey, brand: "other" };
    }
  }
  return null;
}
