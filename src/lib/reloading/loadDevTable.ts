/**
 * Load development table — ladder of test charges with measured v0 / group.
 *
 * Player fills: shots, powder, charge, bullet, primer, COL.
 * Seating depth + friflukt (jump off lands) are derived from COL.
 * v0 and samling (group MOA) stay empty until measured at the range.
 */

import type { SpentBrassKey } from "@/lib/reloading/brass";
import {
  colFromSeatingDepth,
  seatingFromColMm,
} from "@/lib/reloading/loadPhysics";
import type { LoadBenchRecipe } from "@/lib/reloading/recipe";
import { DEFAULT_SEATING_DEPTH_THOU } from "@/lib/reloading/recipe";

export type LoadDevRow = {
  id: string;
  /** Rounds loaded for this charge step. */
  shotsLoaded: number;
  powderItemId: string | null;
  powderGrains: number;
  bulletItemId: string | null;
  primerItemId: string | null;
  /** Player-set cartridge overall length (mm). */
  colMm: number;
  /** Mean chrono v0 (m/s) after range series — null until measured. */
  measuredV0Mps: number | null;
  /** Chrono high / low / sample SD (m/s) — null until measured. */
  measuredV0HighMps: number | null;
  measuredV0LowMps: number | null;
  measuredV0StdevMps: number | null;
  /** Group extreme spread as MOA — null until measured. */
  measuredGroupMoa: number | null;
  measuredEsMm: number | null;
  measuredAtMs: number | null;
  measuredSeriesId: string | null;
};

export type LoadDevTable = {
  rows: LoadDevRow[];
  /** Row armed for live-fire / range write-back. */
  activeRowId: string | null;
};

export type LoadDevDerived = {
  seatingDepthThou: number;
  /** Jump off lands (thou) — same as seating depth in our model. */
  frifluktThou: number;
  colIn: number;
  jamColIn: number;
  saamiMaxColIn: number;
};

export type V0PlateauNode = {
  rowId: string;
  powderGrains: number;
  v0Mps: number;
  /** Absolute Δv0 / Δgrains vs previous measured step. */
  slopeMpsPerGr: number;
};

const MAX_LOAD_DEV_ROWS = 24;

function newId(): string {
  return `ld-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createEmptyLoadDevTable(): LoadDevTable {
  return { rows: [], activeRowId: null };
}

export function deriveFromCol(
  caliberKey: SpentBrassKey,
  colMm: number,
): LoadDevDerived {
  const s = seatingFromColMm(caliberKey, colMm);
  return {
    seatingDepthThou: s.seatingDepthThou,
    frifluktThou: s.seatingDepthThou,
    colIn: s.colIn,
    jamColIn: s.jamColIn,
    saamiMaxColIn: s.saamiMaxColIn,
  };
}

export function defaultColMmForCaliber(caliberKey: SpentBrassKey): number {
  return colFromSeatingDepth(caliberKey, DEFAULT_SEATING_DEPTH_THOU).colMm;
}

export function createLoadDevRowFromRecipe(
  recipe: LoadBenchRecipe,
  opts?: { powderGrains?: number; shotsLoaded?: number },
): LoadDevRow {
  const grains = opts?.powderGrains ?? recipe.powderGrains;
  const colMm =
    recipe.seatingDepthThou != null
      ? colFromSeatingDepth(recipe.caliberKey, recipe.seatingDepthThou).colMm
      : defaultColMmForCaliber(recipe.caliberKey);
  return {
    id: newId(),
    shotsLoaded: opts?.shotsLoaded ?? 5,
    powderItemId: recipe.powderItemId,
    powderGrains: Math.round(grains * 10) / 10,
    bulletItemId: recipe.bulletItemId,
    primerItemId: recipe.primerItemId,
    colMm,
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

export function normalizeLoadDevTable(raw: unknown): LoadDevTable {
  if (!raw || typeof raw !== "object") return createEmptyLoadDevTable();
  const o = raw as Record<string, unknown>;
  const rowsRaw = Array.isArray(o.rows) ? o.rows : [];
  const rows: LoadDevRow[] = [];
  for (const entry of rowsRaw) {
    if (!entry || typeof entry !== "object") continue;
    const r = entry as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : newId();
    const num = (v: unknown, fb: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fb;
    const idOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
    const numOrNull = (v: unknown) =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    rows.push({
      id,
      shotsLoaded: Math.max(1, Math.min(50, Math.round(num(r.shotsLoaded, 5)))),
      powderItemId: idOrNull(r.powderItemId),
      powderGrains: Math.max(0, Math.min(120, num(r.powderGrains, 40))),
      bulletItemId: idOrNull(r.bulletItemId),
      primerItemId: idOrNull(r.primerItemId),
      colMm: Math.max(20, Math.min(120, num(r.colMm, 70))),
      measuredV0Mps: numOrNull(r.measuredV0Mps),
      measuredV0HighMps: numOrNull(r.measuredV0HighMps),
      measuredV0LowMps: numOrNull(r.measuredV0LowMps),
      measuredV0StdevMps: numOrNull(r.measuredV0StdevMps),
      measuredGroupMoa: numOrNull(r.measuredGroupMoa),
      measuredEsMm: numOrNull(r.measuredEsMm),
      measuredAtMs: numOrNull(r.measuredAtMs),
      measuredSeriesId: idOrNull(r.measuredSeriesId),
    });
    if (rows.length >= MAX_LOAD_DEV_ROWS) break;
  }
  const activeRowId =
    typeof o.activeRowId === "string" &&
    rows.some((r) => r.id === o.activeRowId)
      ? o.activeRowId
      : null;
  return { rows, activeRowId };
}

export function upsertLoadDevRow(
  table: LoadDevTable,
  row: LoadDevRow,
): LoadDevTable {
  const idx = table.rows.findIndex((r) => r.id === row.id);
  if (idx < 0) {
    if (table.rows.length >= MAX_LOAD_DEV_ROWS) return table;
    return { ...table, rows: [...table.rows, row] };
  }
  const rows = table.rows.slice();
  rows[idx] = row;
  return { ...table, rows };
}

export function removeLoadDevRow(
  table: LoadDevTable,
  rowId: string,
): LoadDevTable {
  const rows = table.rows.filter((r) => r.id !== rowId);
  return {
    rows,
    activeRowId: table.activeRowId === rowId ? null : table.activeRowId,
  };
}

export function patchLoadDevRow(
  table: LoadDevTable,
  rowId: string,
  patch: Partial<LoadDevRow>,
): LoadDevTable {
  const rows = table.rows.map((r) =>
    r.id === rowId ? { ...r, ...patch, id: r.id } : r,
  );
  return { ...table, rows };
}

export function setActiveLoadDevRow(
  table: LoadDevTable,
  rowId: string | null,
): LoadDevTable {
  if (rowId != null && !table.rows.some((r) => r.id === rowId)) {
    return { ...table, activeRowId: null };
  }
  return { ...table, activeRowId: rowId };
}

export function applyMeasuredSeriesToLoadDevRow(
  table: LoadDevTable,
  rowId: string,
  measured: {
    meanV0Mps: number | null;
    highV0Mps?: number | null;
    lowV0Mps?: number | null;
    stdevV0Mps?: number | null;
    groupMoa: number;
    extremeSpreadMm: number;
    seriesId: string;
  },
): LoadDevTable {
  return patchLoadDevRow(table, rowId, {
    measuredV0Mps:
      measured.meanV0Mps != null && Number.isFinite(measured.meanV0Mps)
        ? Math.round(measured.meanV0Mps * 10) / 10
        : null,
    measuredV0HighMps:
      measured.highV0Mps != null && Number.isFinite(measured.highV0Mps)
        ? Math.round(measured.highV0Mps * 10) / 10
        : null,
    measuredV0LowMps:
      measured.lowV0Mps != null && Number.isFinite(measured.lowV0Mps)
        ? Math.round(measured.lowV0Mps * 10) / 10
        : null,
    measuredV0StdevMps:
      measured.stdevV0Mps != null && Number.isFinite(measured.stdevV0Mps)
        ? Math.round(measured.stdevV0Mps * 100) / 100
        : null,
    measuredGroupMoa: Math.round(measured.groupMoa * 100) / 100,
    measuredEsMm: Math.round(measured.extremeSpreadMm * 10) / 10,
    measuredAtMs: Date.now(),
    measuredSeriesId: measured.seriesId,
  });
}

/**
 * Measured v0 points sorted by charge. Plateau nodes: steps where
 * |Δv0 / Δgr| is low (often a good accuracy node).
 */
export function findV0PlateauNodes(
  rows: readonly LoadDevRow[],
  opts?: { maxSlopeMpsPerGr?: number },
): V0PlateauNode[] {
  const maxSlope = opts?.maxSlopeMpsPerGr ?? 8;
  const measured = rows
    .filter(
      (r) =>
        r.measuredV0Mps != null &&
        Number.isFinite(r.measuredV0Mps) &&
        r.powderGrains > 0,
    )
    .map((r) => ({
      rowId: r.id,
      powderGrains: r.powderGrains,
      v0Mps: r.measuredV0Mps!,
    }))
    .sort((a, b) => a.powderGrains - b.powderGrains);

  const nodes: V0PlateauNode[] = [];
  for (let i = 1; i < measured.length; i++) {
    const prev = measured[i - 1]!;
    const cur = measured[i]!;
    const dGr = cur.powderGrains - prev.powderGrains;
    if (dGr < 0.05) continue;
    const slope = Math.abs((cur.v0Mps - prev.v0Mps) / dGr);
    if (slope <= maxSlope) {
      nodes.push({
        rowId: cur.rowId,
        powderGrains: cur.powderGrains,
        v0Mps: cur.v0Mps,
        slopeMpsPerGr: Math.round(slope * 10) / 10,
      });
    }
  }
  return nodes;
}

export function measuredV0Series(
  rows: readonly LoadDevRow[],
): { powderGrains: number; v0Mps: number; rowId: string }[] {
  return rows
    .filter((r) => r.measuredV0Mps != null && Number.isFinite(r.measuredV0Mps))
    .map((r) => ({
      rowId: r.id,
      powderGrains: r.powderGrains,
      v0Mps: r.measuredV0Mps!,
    }))
    .sort((a, b) => a.powderGrains - b.powderGrains);
}
