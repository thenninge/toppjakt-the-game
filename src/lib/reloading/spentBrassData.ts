/**
 * Spent-brass keys / brands / catalog drafts.
 * Kept free of `@/lib/shop/catalog` imports to avoid init cycles
 * (catalog finalize needs these drafts while brass.ts also needs getShopItem).
 */

import type { CatalogDraft } from "@/lib/shop/types";

export type SpentBrassKey =
  | "308"
  | "65cm"
  | "65x55"
  | "3006"
  | "223"
  | "300blk";

export type BrassBrandSlug =
  | "lapua"
  | "norma"
  | "federal"
  | "hornady"
  | "sako"
  | "remington"
  | "other";

export const SPENT_BRASS_CALIBERS: {
  key: SpentBrassKey;
  label: string;
}[] = [
  { key: "308", label: ".308 Win" },
  { key: "65cm", label: "6,5 Creedmoor" },
  { key: "65x55", label: "6,5×55" },
  { key: "3006", label: ".30-06" },
  { key: "223", label: ".223 Rem" },
  { key: "300blk", label: ".300 BLK" },
];

export const BRASS_BRANDS: { slug: BrassBrandSlug; label: string }[] = [
  { slug: "lapua", label: "Lapua" },
  { slug: "norma", label: "Norma" },
  { slug: "federal", label: "Federal" },
  { slug: "hornady", label: "Hornady" },
  { slug: "sako", label: "Sako" },
  { slug: "remington", label: "Remington" },
  { slug: "other", label: "Annet / ukjent" },
];

/** Legacy unbranded ids (pre brand-tracking). */
export const LEGACY_SPENT_BRASS_ITEM_IDS: Record<SpentBrassKey, string> = {
  "308": "reload-spent-brass-308",
  "65cm": "reload-spent-brass-65cm",
  "65x55": "reload-spent-brass-65x55",
  "3006": "reload-spent-brass-3006",
  "223": "reload-spent-brass-223",
  "300blk": "reload-spent-brass-300blk",
};

export function spentBrassItemId(
  caliberKey: SpentBrassKey,
  brand: BrassBrandSlug,
): string {
  return `reload-spent-brass-${caliberKey}-${brand}`;
}

/** Catalog drafts for branded once-fired brass (price 0 — not sold in XXL). */
export function brandedSpentBrassCatalogDrafts(): CatalogDraft[] {
  const weightByKey: Record<SpentBrassKey, number> = {
    "308": 12,
    "65cm": 11,
    "65x55": 12,
    "3006": 13,
    "223": 8,
    "300blk": 10,
  };
  const out: CatalogDraft[] = [];
  for (const { key, label } of SPENT_BRASS_CALIBERS) {
    for (const { slug, label: brandLabel } of BRASS_BRANDS) {
      out.push({
        id: spentBrassItemId(key, slug),
        category: "reloading",
        brand: brandLabel,
        name: `${label} (brukt)`,
        priceNok: 0,
        caliber: label,
        unitLabel: "stk",
        note: `Once-fired ${brandLabel}-hylse fra skudd. Klar for hjemmelading etter rens.`,
        weightGrams: weightByKey[key],
      });
    }
  }
  return out;
}
