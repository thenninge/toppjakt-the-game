/**
 * Aggregate Garmin Xero chrono points from shotlog → measured dV/dT.
 */

import { powderTempDvDtMpsPerC } from "@/lib/ballistics/powderTemp";
import type { ShotLogEntry } from "@/lib/player";
import { getShopItem } from "@/lib/shop/catalog";
import { isAmmoItem } from "@/lib/shop/types";

export type ChronoSource = "range" | "field";

/** Primary dV/dT card table: −20 °C … +20 °C in 5 °C steps. */
export const DVDT_TABLE_TEMPS_C = [
  -20, -15, -10, -5, 0, 5, 10, 15, 20,
] as const;

export type ChronoDvDtPoint = {
  entryId: string;
  atMs: number;
  rifleId: string;
  rifleLabel: string;
  ammoId: string;
  ammoLabel: string;
  temperatureC: number;
  /** Mean of chronoV0Mps for this log row. */
  meanV0Mps: number;
  shotCount: number;
  source: ChronoSource;
};

export type ChronoDvDtAmmoGroup = {
  ammoId: string;
  ammoLabel: string;
  caliber: string | null;
  /** Catalog / model slope (m/s per °C). */
  catalogDvDt: number;
  points: ChronoDvDtPoint[];
  /** Distinct temperature samples used for the fit. */
  distinctTemps: number;
  rangeCount: number;
  fieldCount: number;
  /**
   * Ordinary least-squares slope v0 ~ T (m/s per °C).
   * null until ≥2 distinct temperatures.
   */
  measuredDvDt: number | null;
  /** OLS intercept (v0 at 0 °C) when measured fit exists. */
  fitIntercept: number | null;
  /** Mean residual of fit (m/s), when measured. */
  fitRmseMps: number | null;
  /**
   * Effective slope used for the v0 table: measured if available,
   * otherwise catalog dV/dT anchored on chrono points.
   */
  tableDvDt: number;
  /** True when table uses measured OLS; false when catalog-anchored. */
  tableFromMeasured: boolean;
};

export function chronoSourceOf(entry: ShotLogEntry): ChronoSource {
  if (entry.chronoSource === "range" || entry.chronoSource === "field") {
    return entry.chronoSource;
  }
  return entry.id.startsWith("hunt-") ? "field" : "range";
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Flatten shotlog rows that have usable Xero v0 + temperature. */
export function extractChronoPoints(entries: ShotLogEntry[]): ChronoDvDtPoint[] {
  const out: ChronoDvDtPoint[] = [];
  for (const entry of entries) {
    const v0s = entry.chronoV0Mps?.filter((v) => Number.isFinite(v));
    const T = entry.chronoTemperatureC;
    if (!v0s || v0s.length === 0 || T == null || !Number.isFinite(T)) continue;
    out.push({
      entryId: entry.id,
      atMs: entry.atMs,
      rifleId: entry.rifleId,
      rifleLabel: entry.rifleLabel,
      ammoId: entry.ammoId,
      ammoLabel: entry.ammoLabel,
      temperatureC: T,
      meanV0Mps: mean(v0s),
      shotCount: v0s.length,
      source: chronoSourceOf(entry),
    });
  }
  out.sort((a, b) => b.atMs - a.atMs);
  return out;
}

/**
 * Linear regression of y ~ x (ordinary least squares).
 * Returns null if fewer than 2 points or zero x-spread.
 */
export function linearSlope(
  xs: number[],
  ys: number[],
): { slope: number; intercept: number; rmse: number } | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  let sumX = 0;
  let sumY = 0;
  let sumXX = 0;
  let sumXY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i]!;
    sumY += ys[i]!;
    sumXX += xs[i]! * xs[i]!;
    sumXY += xs[i]! * ys[i]!;
  }
  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  let sse = 0;
  for (let i = 0; i < n; i++) {
    const err = ys[i]! - (intercept + slope * xs[i]!);
    sse += err * err;
  }
  return { slope, intercept, rmse: Math.sqrt(sse / n) };
}

function ammoCaliber(ammoId: string): string | null {
  const item = getShopItem(ammoId);
  if (!item || !isAmmoItem(item)) return null;
  return item.ammo.caliber;
}

/**
 * Predicted muzzle velocity (°C → m/s) for the ammo's chrono model.
 * Measured OLS when available; else catalog slope through the mean chrono point.
 */
export function predictV0AtTempC(
  group: ChronoDvDtAmmoGroup,
  temperatureC: number,
): number | null {
  if (group.points.length === 0) return null;
  if (
    group.tableFromMeasured &&
    group.fitIntercept != null &&
    group.measuredDvDt != null
  ) {
    return group.fitIntercept + group.measuredDvDt * temperatureC;
  }
  const T0 = mean(group.points.map((p) => p.temperatureC));
  const V0 = mean(group.points.map((p) => p.meanV0Mps));
  return V0 + group.tableDvDt * (temperatureC - T0);
}

/** Group chrono points by ammo and estimate measured dV/dT. */
export function groupChronoDvDtByAmmo(
  entries: ShotLogEntry[],
): ChronoDvDtAmmoGroup[] {
  const points = extractChronoPoints(entries);
  const byAmmo = new Map<string, ChronoDvDtPoint[]>();
  for (const p of points) {
    const list = byAmmo.get(p.ammoId) ?? [];
    list.push(p);
    byAmmo.set(p.ammoId, list);
  }

  const groups: ChronoDvDtAmmoGroup[] = [];
  for (const [ammoId, ammoPoints] of byAmmo) {
    const caliber = ammoCaliber(ammoId);
    const catalogDvDt = powderTempDvDtMpsPerC(caliber);
    const temps = new Set(
      ammoPoints.map((p) => Math.round(p.temperatureC * 10) / 10),
    );
    const fit = linearSlope(
      ammoPoints.map((p) => p.temperatureC),
      ammoPoints.map((p) => p.meanV0Mps),
    );
    const measured = fit != null;
    groups.push({
      ammoId,
      ammoLabel: ammoPoints[0]!.ammoLabel,
      caliber,
      catalogDvDt,
      points: ammoPoints,
      distinctTemps: temps.size,
      rangeCount: ammoPoints.filter((p) => p.source === "range").length,
      fieldCount: ammoPoints.filter((p) => p.source === "field").length,
      measuredDvDt: fit?.slope ?? null,
      fitIntercept: fit?.intercept ?? null,
      fitRmseMps: fit?.rmse ?? null,
      tableDvDt: measured ? fit.slope : catalogDvDt,
      tableFromMeasured: measured,
    });
  }

  groups.sort(
    (a, b) =>
      b.points.length - a.points.length ||
      a.ammoLabel.localeCompare(b.ammoLabel, "nb"),
  );
  return groups;
}

export function formatDvDt(slope: number | null): string {
  if (slope == null || !Number.isFinite(slope)) return "—";
  const abs = Math.abs(slope);
  const digits = abs >= 10 ? 1 : 2;
  const sign = slope > 0 ? "+" : "";
  return `${sign}${slope.toFixed(digits)} m/s/°C`;
}

export function formatV0Mps(v0: number | null): string {
  if (v0 == null || !Number.isFinite(v0)) return "—";
  return `${Math.round(v0)}`;
}

/** Short ammo label for table headers (brand + name without long caliber). */
export function shortAmmoLabel(label: string): string {
  const cut = label.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return cut.length > 28 ? `${cut.slice(0, 26)}…` : cut;
}
