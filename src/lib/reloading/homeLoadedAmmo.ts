/**
 * Home-loaded ammo lots — created by «Lad ammo» in Laderommet.
 * Each lot is a shootable inventory ammo id: ammo-home-…
 */

import type { SpentBrassKey } from "@/lib/reloading/brass";
import {
  brassBrandSlugFromShopBrand,
  spentBrassItemId,
} from "@/lib/reloading/brass";
import type { LoadDevRow } from "@/lib/reloading/loadDevTable";
import { deriveFromCol } from "@/lib/reloading/loadDevTable";
import {
  estimateLoadPlanFromDevRow,
  parseBulletWeightGrains,
} from "@/lib/reloading/loadPhysics";
import { getShopItem } from "@/lib/shop/catalog";
import type { AmmoShopItem, ShopItem } from "@/lib/shop/types";
import { LOAD_CALIBER_OPTIONS } from "@/lib/reloading/components";

export const HOME_LOAD_AMMO_PREFIX = "ammo-home-";

export type HomeLoadedLot = {
  id: string;
  caliberKey: SpentBrassKey;
  caliberLabel: string;
  powderItemId: string;
  powderLabel: string;
  powderGrains: number;
  bulletItemId: string;
  bulletLabel: string;
  primerItemId: string;
  primerLabel: string;
  brassItemId: string | null;
  brassLabel: string | null;
  colMm: number;
  seatingDepthThou: number;
  /** Original batch size when loaded. */
  roundsLoaded: number;
  /** Live remaining cartridges (mirrors inventory qty). */
  roundsRemaining: number;
  estimatedV0Mps: number;
  pressurePct: number;
  overpressurePct: number;
  kaboomChance: number;
  loadedAtMs: number;
  loadDevRowId: string | null;
  measuredV0Mps: number | null;
  measuredV0HighMps: number | null;
  measuredV0LowMps: number | null;
  measuredV0StdevMps: number | null;
  measuredGroupMoa: number | null;
  measuredEsMm: number | null;
  measuredAtMs: number | null;
  measuredSeriesId: string | null;
};

export function isHomeLoadAmmoId(id: string): boolean {
  return id.startsWith(HOME_LOAD_AMMO_PREFIX);
}

function newLotId(): string {
  return `${HOME_LOAD_AMMO_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function itemLabel(itemId: string | null): string {
  if (!itemId) return "—";
  const item = getShopItem(itemId);
  if (!item) return "—";
  return `${item.brand} ${item.name}`;
}

function bulletLabel(itemId: string): string {
  const item = getShopItem(itemId);
  if (!item) return "—";
  const gr = parseBulletWeightGrains(item);
  const base = `${item.brand} ${item.name}`;
  return gr != null ? `${base} · ${gr} gr` : base;
}

function caliberLabel(key: SpentBrassKey): string {
  return LOAD_CALIBER_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

function caliberDisplay(key: SpentBrassKey): string {
  return caliberLabel(key);
}

/** Synthetic catalog ammo so range/kit can resolve the lot as ShopItem. */
export function shopItemFromHomeLot(lot: HomeLoadedLot): AmmoShopItem {
  const bullet = getShopItem(lot.bulletItemId);
  const bulletGr = parseBulletWeightGrains(bullet ?? null) ?? 140;
  const caliber = caliberDisplay(lot.caliberKey);
  return {
    id: lot.id,
    category: "ammo",
    brand: "Hjemmeladd",
    name: `${lot.powderGrains.toFixed(1)} gr · ${shortName(lot.bulletItemId)}`,
    priceNok: 0,
    caliber,
    unitLabel: `${lot.roundsRemaining} stk`,
    note: `Hjemmeladd · ${lot.powderLabel} · COL ${lot.colMm.toFixed(1)} mm`,
    ammo: {
      caliber,
      projectileType: "OTM",
      v0: lot.measuredV0Mps ?? lot.estimatedV0Mps,
      bulletWeightGrains: bulletGr,
      bc: 0.5,
      bcModel: "G7",
      damageFactor: 0.25,
      maxAchievableMoa: 0.35,
      v0SigmaMps: 4,
    },
    weightGrams: Math.round(12 + bulletGr * 0.065),
  };
}

function shortName(itemId: string): string {
  const item = getShopItem(itemId);
  if (!item) return "kule";
  return item.name.length > 18 ? `${item.name.slice(0, 16)}…` : item.name;
}

export function resolveHomeLoadItem(
  id: string,
  lots: readonly HomeLoadedLot[],
): ShopItem | undefined {
  if (!isHomeLoadAmmoId(id)) return undefined;
  const lot = lots.find((l) => l.id === id);
  return lot ? shopItemFromHomeLot(lot) : undefined;
}

export function spentBrassItemIdForHomeLot(
  lot: HomeLoadedLot,
): string | null {
  // Rimfire / .22 — no brass recovery in our model.
  if (lot.caliberKey === "223" && /22\s*lr/i.test(lot.caliberLabel)) {
    return null;
  }
  if (lot.caliberKey === "223") {
    // .223 still gets brass
  }
  let brand = "other" as ReturnType<typeof brassBrandSlugFromShopBrand>;
  if (lot.brassItemId) {
    const brass = getShopItem(lot.brassItemId);
    brand = brassBrandSlugFromShopBrand(brass?.brand);
  }
  try {
    return spentBrassItemId(lot.caliberKey, brand);
  } catch {
    return null;
  }
}

export function buildHomeLotFromRow(
  caliberKey: SpentBrassKey,
  row: LoadDevRow,
  brassItemId: string | null,
): HomeLoadedLot | null {
  if (
    !row.powderItemId ||
    !row.bulletItemId ||
    !row.primerItemId ||
    row.shotsLoaded < 1
  ) {
    return null;
  }
  const powder = getShopItem(row.powderItemId);
  const bullet = getShopItem(row.bulletItemId);
  if (!powder || !bullet) return null;
  const est = estimateLoadPlanFromDevRow(caliberKey, row, { powder, bullet });
  const derived = deriveFromCol(caliberKey, row.colMm);
  const n = Math.max(1, Math.min(50, Math.round(row.shotsLoaded)));
  return {
    id: newLotId(),
    caliberKey,
    caliberLabel: caliberLabel(caliberKey),
    powderItemId: row.powderItemId,
    powderLabel: itemLabel(row.powderItemId),
    powderGrains: row.powderGrains,
    bulletItemId: row.bulletItemId,
    bulletLabel: bulletLabel(row.bulletItemId),
    primerItemId: row.primerItemId,
    primerLabel: itemLabel(row.primerItemId),
    brassItemId,
    brassLabel: brassItemId ? itemLabel(brassItemId) : null,
    colMm: row.colMm,
    seatingDepthThou: derived.seatingDepthThou,
    roundsLoaded: n,
    roundsRemaining: n,
    estimatedV0Mps: Math.round(est.v0Mps),
    pressurePct: est.pressurePct,
    overpressurePct: est.overpressurePct,
    kaboomChance: est.kaboomChance,
    loadedAtMs: Date.now(),
    loadDevRowId: row.id,
    measuredV0Mps: null,
    measuredV0HighMps: null,
    measuredV0LowMps: null,
    measuredV0StdevMps: null,
    measuredGroupMoa: null,
    measuredEsMm: null,
    measuredAtMs: null,
    measuredSeriesId: null,
  };
}

export function normalizeHomeLoadedLots(raw: unknown): HomeLoadedLot[] {
  if (!Array.isArray(raw)) return [];
  const keys = new Set([
    "308",
    "65cm",
    "65x55",
    "3006",
    "223",
    "300blk",
  ]);
  const out: HomeLoadedLot[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    if (typeof o.caliberKey !== "string" || !keys.has(o.caliberKey)) continue;
    if (typeof o.id !== "string" || !isHomeLoadAmmoId(o.id)) continue;
    const num = (v: unknown, fb: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fb;
    const numOrNull = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    const str = (v: unknown, fb = "—") =>
      typeof v === "string" && v ? v : fb;
    const idOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
    const roundsLoaded = Math.max(1, Math.round(num(o.roundsLoaded, 1)));
    const roundsRemaining = Math.max(
      0,
      Math.min(roundsLoaded, Math.round(num(o.roundsRemaining, roundsLoaded))),
    );
    out.push({
      id: o.id,
      caliberKey: o.caliberKey as SpentBrassKey,
      caliberLabel: str(o.caliberLabel, o.caliberKey),
      powderItemId: str(o.powderItemId, ""),
      powderLabel: str(o.powderLabel),
      powderGrains: Math.max(0, num(o.powderGrains, 40)),
      bulletItemId: str(o.bulletItemId, ""),
      bulletLabel: str(o.bulletLabel),
      primerItemId: str(o.primerItemId, ""),
      primerLabel: str(o.primerLabel),
      brassItemId: idOrNull(o.brassItemId),
      brassLabel: idOrNull(o.brassLabel),
      colMm: Math.max(20, num(o.colMm, 70)),
      seatingDepthThou: Math.max(0, Math.round(num(o.seatingDepthThou, 20))),
      roundsLoaded,
      roundsRemaining,
      estimatedV0Mps: Math.round(num(o.estimatedV0Mps, 0)),
      pressurePct: Math.max(0, num(o.pressurePct, 100)),
      overpressurePct: Math.max(0, num(o.overpressurePct, 0)),
      kaboomChance: Math.max(0, Math.min(0.95, num(o.kaboomChance, 0))),
      loadedAtMs: Math.max(0, num(o.loadedAtMs, Date.now())),
      loadDevRowId: idOrNull(o.loadDevRowId),
      measuredV0Mps: numOrNull(o.measuredV0Mps),
      measuredV0HighMps: numOrNull(o.measuredV0HighMps),
      measuredV0LowMps: numOrNull(o.measuredV0LowMps),
      measuredV0StdevMps: numOrNull(o.measuredV0StdevMps),
      measuredGroupMoa: numOrNull(o.measuredGroupMoa),
      measuredEsMm: numOrNull(o.measuredEsMm),
      measuredAtMs: numOrNull(o.measuredAtMs),
      measuredSeriesId: idOrNull(o.measuredSeriesId),
    });
  }
  return out;
}

export function patchHomeLoadedLot(
  lots: HomeLoadedLot[],
  lotId: string,
  patch: Partial<HomeLoadedLot>,
): HomeLoadedLot[] {
  return lots.map((l) => (l.id === lotId ? { ...l, ...patch, id: l.id } : l));
}

/** Measured / chrono write-back onto a hjemmeladd lot (persists across ammo switches). */
export type HomeLotMeasurePatch = {
  meanV0Mps: number | null;
  highV0Mps: number | null;
  lowV0Mps: number | null;
  stdevV0Mps: number | null;
  groupMoa: number | null;
  extremeSpreadMm: number | null;
  seriesId: string | null;
};

export function measurePatchForHomeLot(
  measure: HomeLotMeasurePatch,
): Partial<HomeLoadedLot> {
  const round1 = (v: number | null) =>
    v != null && Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
  const round2 = (v: number | null) =>
    v != null && Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  return {
    measuredV0Mps: round1(measure.meanV0Mps),
    measuredV0HighMps: round1(measure.highV0Mps),
    measuredV0LowMps: round1(measure.lowV0Mps),
    measuredV0StdevMps: round2(measure.stdevV0Mps),
    measuredGroupMoa: round2(measure.groupMoa),
    measuredEsMm: round1(measure.extremeSpreadMm),
    measuredAtMs: Date.now(),
    measuredSeriesId: measure.seriesId,
  };
}
