/**
 * Ladebok — persistent archive of home loads for lookup.
 * Auto-updated when testing / measuring; also manual save from ladeplanen.
 */

import type { SpentBrassKey } from "@/lib/reloading/brass";
import { LOAD_CALIBER_OPTIONS } from "@/lib/reloading/components";
import {
  deriveFromCol,
  type LoadDevRow,
} from "@/lib/reloading/loadDevTable";
import {
  estimateLoadPlanFromDevRow,
  parseBulletWeightGrains,
} from "@/lib/reloading/loadPhysics";
import { getShopItem } from "@/lib/shop/catalog";

export const MAX_LOAD_BOOK_ENTRIES = 200;

export type LoadBookEntry = {
  id: string;
  atMs: number;
  updatedAtMs: number;
  caliberKey: SpentBrassKey;
  caliberLabel: string;
  /** Link to current ladeplan-rad when still present. */
  loadDevRowId: string | null;
  shotsLoaded: number;
  powderItemId: string | null;
  powderLabel: string;
  powderGrains: number;
  bulletItemId: string | null;
  bulletLabel: string;
  primerItemId: string | null;
  primerLabel: string;
  brassItemId: string | null;
  brassLabel: string | null;
  colMm: number;
  seatingDepthThou: number;
  frifluktThou: number;
  estimatedV0Mps: number | null;
  estimatedPressurePct: number | null;
  kaboomChance: number;
  measuredV0Mps: number | null;
  measuredV0HighMps: number | null;
  measuredV0LowMps: number | null;
  measuredV0StdevMps: number | null;
  measuredGroupMoa: number | null;
  measuredEsMm: number | null;
  measuredSeriesId: string | null;
};

function newId(): string {
  return `lb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function itemLabel(itemId: string | null): string {
  if (!itemId) return "—";
  const item = getShopItem(itemId);
  if (!item) return "—";
  return `${item.brand} ${item.name}`;
}

function bulletBookLabel(itemId: string | null): string {
  if (!itemId) return "—";
  const item = getShopItem(itemId);
  if (!item) return "—";
  const gr = parseBulletWeightGrains(item);
  const base = `${item.brand} ${item.name}`;
  return gr != null ? `${base} · ${gr} gr` : base;
}

function caliberLabel(key: SpentBrassKey): string {
  return LOAD_CALIBER_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

export function createEmptyLoadBook(): LoadBookEntry[] {
  return [];
}

export function buildLoadBookEntry(opts: {
  caliberKey: SpentBrassKey;
  row: LoadDevRow;
  brassItemId?: string | null;
  existingId?: string | null;
  existingAtMs?: number | null;
}): LoadBookEntry {
  const { caliberKey, row } = opts;
  const derived = deriveFromCol(caliberKey, row.colMm);
  const powder = row.powderItemId ? getShopItem(row.powderItemId) : null;
  const bullet = row.bulletItemId ? getShopItem(row.bulletItemId) : null;
  const est =
    powder && bullet
      ? estimateLoadPlanFromDevRow(caliberKey, row, { powder, bullet })
      : null;
  const now = Date.now();
  return {
    id: opts.existingId || newId(),
    atMs: opts.existingAtMs ?? now,
    updatedAtMs: now,
    caliberKey,
    caliberLabel: caliberLabel(caliberKey),
    loadDevRowId: row.id,
    shotsLoaded: row.shotsLoaded,
    powderItemId: row.powderItemId,
    powderLabel: itemLabel(row.powderItemId),
    powderGrains: row.powderGrains,
    bulletItemId: row.bulletItemId,
    bulletLabel: bulletBookLabel(row.bulletItemId),
    primerItemId: row.primerItemId,
    primerLabel: itemLabel(row.primerItemId),
    brassItemId: opts.brassItemId ?? null,
    brassLabel: opts.brassItemId ? itemLabel(opts.brassItemId) : null,
    colMm: row.colMm,
    seatingDepthThou: derived.seatingDepthThou,
    frifluktThou: derived.frifluktThou,
    estimatedV0Mps: est?.v0Mps ?? null,
    estimatedPressurePct: est?.pressurePct ?? null,
    kaboomChance: est?.kaboomChance ?? 0,
    measuredV0Mps: row.measuredV0Mps,
    measuredV0HighMps: row.measuredV0HighMps,
    measuredV0LowMps: row.measuredV0LowMps,
    measuredV0StdevMps: row.measuredV0StdevMps,
    measuredGroupMoa: row.measuredGroupMoa,
    measuredEsMm: row.measuredEsMm,
    measuredSeriesId: row.measuredSeriesId,
  };
}

/** Upsert by loadDevRowId when set; otherwise append. */
export function upsertLoadBookEntry(
  book: LoadBookEntry[],
  entry: LoadBookEntry,
): LoadBookEntry[] {
  let idx = -1;
  if (entry.loadDevRowId) {
    idx = book.findIndex((e) => e.loadDevRowId === entry.loadDevRowId);
  }
  if (idx < 0) {
    idx = book.findIndex((e) => e.id === entry.id);
  }
  let next: LoadBookEntry[];
  if (idx >= 0) {
    const prev = book[idx]!;
    next = book.slice();
    next[idx] = {
      ...entry,
      id: prev.id,
      atMs: prev.atMs,
      updatedAtMs: Date.now(),
    };
  } else {
    next = [entry, ...book];
  }
  return next.slice(0, MAX_LOAD_BOOK_ENTRIES);
}

export function removeLoadBookEntry(
  book: LoadBookEntry[],
  entryId: string,
): LoadBookEntry[] {
  return book.filter((e) => e.id !== entryId);
}

export function normalizeLoadBook(raw: unknown): LoadBookEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: LoadBookEntry[] = [];
  const keys = new Set([
    "308",
    "65cm",
    "65x55",
    "3006",
    "223",
    "300blk",
  ]);
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    if (typeof o.caliberKey !== "string" || !keys.has(o.caliberKey)) continue;
    const num = (v: unknown, fb: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fb;
    const numOrNull = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    const str = (v: unknown, fb = "—") =>
      typeof v === "string" && v ? v : fb;
    const idOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
    out.push({
      id: typeof o.id === "string" && o.id ? o.id : newId(),
      atMs: Math.max(0, num(o.atMs, Date.now())),
      updatedAtMs: Math.max(0, num(o.updatedAtMs, num(o.atMs, Date.now()))),
      caliberKey: o.caliberKey as SpentBrassKey,
      caliberLabel: str(o.caliberLabel, o.caliberKey),
      loadDevRowId: idOrNull(o.loadDevRowId),
      shotsLoaded: Math.max(1, Math.round(num(o.shotsLoaded, 5))),
      powderItemId: idOrNull(o.powderItemId),
      powderLabel: str(o.powderLabel),
      powderGrains: Math.max(0, num(o.powderGrains, 0)),
      bulletItemId: idOrNull(o.bulletItemId),
      bulletLabel: str(o.bulletLabel),
      primerItemId: idOrNull(o.primerItemId),
      primerLabel: str(o.primerLabel),
      brassItemId: idOrNull(o.brassItemId),
      brassLabel: idOrNull(o.brassLabel),
      colMm: Math.max(20, num(o.colMm, 70)),
      seatingDepthThou: Math.max(0, Math.round(num(o.seatingDepthThou, 20))),
      frifluktThou: Math.max(0, Math.round(num(o.frifluktThou, 20))),
      estimatedV0Mps: numOrNull(o.estimatedV0Mps),
      estimatedPressurePct: numOrNull(o.estimatedPressurePct),
      kaboomChance: Math.max(0, Math.min(0.95, num(o.kaboomChance, 0))),
      measuredV0Mps: numOrNull(o.measuredV0Mps),
      measuredV0HighMps: numOrNull(o.measuredV0HighMps),
      measuredV0LowMps: numOrNull(o.measuredV0LowMps),
      measuredV0StdevMps: numOrNull(o.measuredV0StdevMps),
      measuredGroupMoa: numOrNull(o.measuredGroupMoa),
      measuredEsMm: numOrNull(o.measuredEsMm),
      measuredSeriesId: idOrNull(o.measuredSeriesId),
    });
    if (out.length >= MAX_LOAD_BOOK_ENTRIES) break;
  }
  return out;
}

/** Restore a ladebok entry as a new ladeplan-rad. */
export function loadDevRowFromBookEntry(entry: LoadBookEntry): LoadDevRow {
  return {
    id: `ld-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    shotsLoaded: entry.shotsLoaded,
    powderItemId: entry.powderItemId,
    powderGrains: entry.powderGrains,
    bulletItemId: entry.bulletItemId,
    primerItemId: entry.primerItemId,
    colMm: entry.colMm,
    measuredV0Mps: entry.measuredV0Mps,
    measuredV0HighMps: entry.measuredV0HighMps,
    measuredV0LowMps: entry.measuredV0LowMps,
    measuredV0StdevMps: entry.measuredV0StdevMps,
    measuredGroupMoa: entry.measuredGroupMoa,
    measuredEsMm: entry.measuredEsMm,
    measuredAtMs: entry.measuredV0Mps != null ? entry.updatedAtMs : null,
    measuredSeriesId: entry.measuredSeriesId,
  };
}

export function formatLoadBookWhen(atMs: number): string {
  try {
    return new Date(atMs).toLocaleString("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
