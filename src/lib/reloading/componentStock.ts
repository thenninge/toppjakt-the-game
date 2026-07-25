/**
 * Reloading component stock — pieces for brass/primer/bullet,
 * grains for open powder (boxes open on demand).
 */

import {
  isBrassItem,
  isBulletItem,
  isPowderItem,
  isPrimerItem,
} from "@/lib/reloading/components";
import { getShopItem } from "@/lib/shop/catalog";
import type { InventoryEntry } from "@/lib/player";
import type { ShopItem } from "@/lib/shop/types";

/** Grains per purchased powder box from unitLabel. */
export function powderGrainsPerBox(item: ShopItem): number {
  const label = (item.unitLabel ?? "").toLowerCase();
  if (/1\s*kg/.test(label)) return 15432; // 1000 g ≈ 15432 gr
  if (/1\s*lb/.test(label)) return 7000;
  const m = label.match(/(\d+(?:[.,]\d+)?)\s*kg/);
  if (m) {
    const kg = Number.parseFloat(m[1]!.replace(",", "."));
    if (Number.isFinite(kg) && kg > 0) return Math.round(kg * 15432);
  }
  return 7000;
}

/** Pieces per purchased primer / bullet / brass box. */
export function reloadingPiecesPerPurchase(item: ShopItem): number {
  const match = item.unitLabel?.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : 100;
}

export function normalizePowderOpenGrains(
  raw: unknown,
): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) {
      out[id] = Math.round(v * 10) / 10;
    }
  }
  return out;
}

/**
 * Expand legacy box-qty inventory to pieces for primers/bullets/brass.
 * Heuristic: qty ≤ 10 and pack ≥ 50 → treat as unopened boxes.
 */
export function migrateReloadingInventoryPieces(
  inventory: InventoryEntry[],
): InventoryEntry[] {
  return inventory.map((e) => {
    const item = getShopItem(e.itemId);
    if (!item || item.category !== "reloading") return e;
    if (isPowderItem(item)) return e;
    if (!isPrimerItem(item) && !isBulletItem(item) && !isBrassItem(item)) {
      return e;
    }
    const pack = reloadingPiecesPerPurchase(item);
    if (e.qty > 0 && e.qty <= 10 && pack >= 50) {
      return { ...e, qty: e.qty * pack };
    }
    return e;
  });
}

export type ComponentStockSnapshot = {
  brassPieces: { itemId: string; label: string; qty: number }[];
  primerPieces: { itemId: string; label: string; qty: number }[];
  bulletPieces: { itemId: string; label: string; qty: number }[];
  powder: {
    itemId: string;
    label: string;
    openGrains: number;
    unopenedBoxes: number;
    totalGrainsApprox: number;
  }[];
};

export function snapshotComponentStock(
  inventory: InventoryEntry[],
  powderOpenGrains: Record<string, number>,
): ComponentStockSnapshot {
  const brassPieces: ComponentStockSnapshot["brassPieces"] = [];
  const primerPieces: ComponentStockSnapshot["primerPieces"] = [];
  const bulletPieces: ComponentStockSnapshot["bulletPieces"] = [];
  const powder: ComponentStockSnapshot["powder"] = [];

  for (const e of inventory) {
    if (e.qty <= 0) continue;
    const item = getShopItem(e.itemId);
    if (!item || item.category !== "reloading") continue;
    const label = `${item.brand} ${item.name}`;
    if (isPowderItem(item)) {
      const open = powderOpenGrains[e.itemId] ?? 0;
      const perBox = powderGrainsPerBox(item);
      powder.push({
        itemId: e.itemId,
        label,
        openGrains: open,
        unopenedBoxes: e.qty,
        totalGrainsApprox: open + e.qty * perBox,
      });
      continue;
    }
    if (isBrassItem(item)) {
      brassPieces.push({ itemId: e.itemId, label, qty: e.qty });
    } else if (isPrimerItem(item)) {
      primerPieces.push({ itemId: e.itemId, label, qty: e.qty });
    } else if (isBulletItem(item)) {
      bulletPieces.push({ itemId: e.itemId, label, qty: e.qty });
    }
  }

  // Powder with only open grains (boxes already emptied)
  for (const [itemId, open] of Object.entries(powderOpenGrains)) {
    if (open <= 0) continue;
    if (powder.some((p) => p.itemId === itemId)) continue;
    const item = getShopItem(itemId);
    if (!item || !isPowderItem(item)) continue;
    powder.push({
      itemId,
      label: `${item.brand} ${item.name}`,
      openGrains: open,
      unopenedBoxes: 0,
      totalGrainsApprox: open,
    });
  }

  const byLabel = <T extends { label: string }>(a: T, b: T) =>
    a.label.localeCompare(b.label, "nb");
  brassPieces.sort(byLabel);
  primerPieces.sort(byLabel);
  bulletPieces.sort(byLabel);
  powder.sort(byLabel);
  return { brassPieces, primerPieces, bulletPieces, powder };
}

export function formatGrains(gr: number): string {
  if (gr >= 1000) return `${(gr / 15432).toFixed(2)} kg (~${Math.round(gr)} gr)`;
  return `${Math.round(gr)} gr`;
}

/** Inventory qty to add when buying one reloading pack (pieces or 1 powder box). */
export function purchaseQtyForReloadingItem(item: ShopItem): number {
  if (item.category !== "reloading") return 1;
  if (isPowderItem(item)) return 1;
  if (isPrimerItem(item) || isBulletItem(item) || isBrassItem(item)) {
    return reloadingPiecesPerPurchase(item);
  }
  return 1;
}
