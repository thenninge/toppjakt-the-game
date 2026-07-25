/**
 * Classify hjemmelading inventory + die quality for Laderommet.
 */

import { spentBrassKeyForCaliber, type SpentBrassKey } from "@/lib/reloading/brass";
import type { ShopItem } from "@/lib/shop/types";

export function isDieSetItem(item: ShopItem): boolean {
  if (item.category !== "reloading") return false;
  const id = item.id;
  return (
    id.includes("-dies-") ||
    id.includes("bushing") ||
    /\bdie\b/i.test(item.name)
  );
}

export function isPrimerItem(item: ShopItem): boolean {
  if (item.category !== "reloading") return false;
  if (isBrassItem(item) || isDieSetItem(item) || isPowderItem(item)) {
    return false;
  }
  return (
    item.id.startsWith("reload-cci-") ||
    item.id.startsWith("reload-federal-") ||
    /primer|tennhette|br2|gm210/i.test(`${item.id} ${item.name}`)
  ) && !/pocket|hand.?prim|seater|brush|cleaner/i.test(item.id);
}

export function isPowderItem(item: ShopItem): boolean {
  if (item.category !== "reloading") return false;
  // Only powder SKUs — not funnel / scale / dispenser / brass.
  if (
    item.id.includes("brass") ||
    item.id.includes("spent") ||
    /funnel|scale|charge|dispenser|trakt|vekt/i.test(`${item.id} ${item.name}`)
  ) {
    return false;
  }
  return (
    item.id === "reload-norma-203b" ||
    item.id === "reload-norma-mrp" ||
    item.id.startsWith("reload-viht-") ||
    item.id.startsWith("reload-hodgdon-")
  );
}

export function isBulletItem(item: ShopItem): boolean {
  if (item.category !== "reloading") return false;
  if (
    isDieSetItem(item) ||
    isPowderItem(item) ||
    isPrimerItem(item) ||
    isBrassItem(item)
  ) {
    return false;
  }
  return /scenar|matchking|eld-?m|eld-?x|berger|lock.?base|vld/i.test(
    `${item.id} ${item.name}`,
  );
}

export function isNewBrassItem(item: ShopItem): boolean {
  if (item.category !== "reloading") return false;
  return (
    item.id.includes("-brass-") &&
    !item.id.includes("spent-brass") &&
    !item.id.startsWith("reload-spent-")
  );
}

export function isSpentBrassShopItem(item: ShopItem): boolean {
  return item.category === "reloading" && item.id.includes("spent-brass");
}

export function isBrassItem(item: ShopItem): boolean {
  return isNewBrassItem(item) || isSpentBrassShopItem(item);
}

/** 1–10 quality from catalog price (pricier dies score higher). */
export function dieQualityScore(priceNok: number): number {
  if (!(priceNok > 0)) return 1;
  // Lee ~690 → ~3, RCBS ~1190 → ~5, Forster ~2890 → ~9
  const score = 1 + (priceNok / 3200) * 9;
  return Math.max(1, Math.min(10, Math.round(score * 10) / 10));
}

export function dieSetCaliberKey(item: ShopItem): SpentBrassKey | null {
  return spentBrassKeyForCaliber(item.caliber);
}

export function brassItemCaliberKey(item: ShopItem): SpentBrassKey | null {
  return spentBrassKeyForCaliber(item.caliber);
}

export function bulletFitsCaliber(
  item: ShopItem,
  caliberKey: SpentBrassKey,
): boolean {
  const key = spentBrassKeyForCaliber(item.caliber);
  if (key === caliberKey) return true;
  // .30-06 / .308 often share .308 bullets in this catalog
  if (
    (caliberKey === "3006" || caliberKey === "308") &&
    (key === "308" || key === "3006")
  ) {
    return true;
  }
  // 6.5 CM / 6.5×55 share 6.5 bullets
  if (
    (caliberKey === "65cm" || caliberKey === "65x55") &&
    (key === "65cm" || key === "65x55")
  ) {
    return true;
  }
  // Multi-caliber labels like "6,5 Creedmoor / 6,5×55" already map via spentBrassKey
  // which returns first match — handle dual labels:
  const raw = (item.caliber ?? "").toLowerCase();
  if (caliberKey === "65cm" || caliberKey === "65x55") {
    if (raw.includes("6,5") || raw.includes("6.5") || raw.includes("creedmoor")) {
      return true;
    }
  }
  if (caliberKey === "308" || caliberKey === "3006") {
    if (raw.includes("308") || raw.includes("30-06")) return true;
  }
  return false;
}

export const LOAD_CALIBER_OPTIONS: {
  key: SpentBrassKey;
  label: string;
  defaultPowderGrains: number;
}[] = [
  { key: "308", label: ".308 Win", defaultPowderGrains: 44.0 },
  { key: "65cm", label: "6,5 Creedmoor", defaultPowderGrains: 41.5 },
  { key: "65x55", label: "6,5×55", defaultPowderGrains: 45.0 },
  { key: "3006", label: ".30-06", defaultPowderGrains: 55.0 },
  { key: "223", label: ".223 Rem", defaultPowderGrains: 24.0 },
  { key: "300blk", label: ".300 BLK", defaultPowderGrains: 16.5 },
];
