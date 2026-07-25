/**
 * Laderommet load-plan physics — estimated pressure, v0, COL, kaboom risk.
 *
 * Pressure is % of a game «max book» load (100% = SAAMI-ish ceiling).
 * Over 100% is allowed; over 5% overpressure risks detonating the rifle.
 */

import type { SpentBrassKey } from "@/lib/reloading/brass";
import type { LoadBenchRecipe } from "@/lib/reloading/recipe";
import type { ShopItem } from "@/lib/shop/types";

/** Reference charge (gr) that lands ~100% pressure at 20 thou jump. */
const REF_CHARGE_GR: Record<SpentBrassKey, number> = {
  "308": 44.0,
  "65cm": 41.5,
  "65x55": 45.0,
  "3006": 55.0,
  "223": 24.0,
  "300blk": 16.5,
};

/** Typical factory-ish v0 (m/s) at reference charge. */
const REF_V0_MPS: Record<SpentBrassKey, number> = {
  "308": 820,
  "65cm": 830,
  "65x55": 800,
  "3006": 850,
  "223": 900,
  "300blk": 620,
};

/**
 * Approximate jam / touch-lands COL (inches) for a typical match bullet.
 * COL = jamCol − seatingDepthThou/1000.
 */
const JAM_COL_IN: Record<SpentBrassKey, number> = {
  "308": 2.85,
  "65cm": 2.875,
  "65x55": 3.2,
  "3006": 3.4,
  "223": 2.35,
  "300blk": 2.2,
};

/** SAAMI-ish max COL for display context (inches). */
const SAAMI_MAX_COL_IN: Record<SpentBrassKey, number> = {
  "308": 2.81,
  "65cm": 2.825,
  "65x55": 3.15,
  "3006": 3.34,
  "223": 2.26,
  "300blk": 2.26,
};

/** Powder burn-rate pressure multiplier (faster → more pressure). */
const POWDER_PRESSURE_MULT: Record<string, number> = {
  "reload-hodgdon-h4895": 1.06,
  "reload-hodgdon-varget": 1.04,
  "reload-viht-n140": 1.02,
  "reload-norma-203b": 1.01,
  "reload-viht-n150": 1.0,
  "reload-hodgdon-h4350": 0.97,
  "reload-viht-n160": 0.95,
  "reload-norma-mrp": 0.94,
  "reload-viht-n540": 1.05,
};

const POWDER_V0_MULT: Record<string, number> = {
  "reload-hodgdon-h4895": 1.02,
  "reload-hodgdon-varget": 1.01,
  "reload-viht-n140": 1.0,
  "reload-norma-203b": 1.0,
  "reload-viht-n150": 0.99,
  "reload-hodgdon-h4350": 0.98,
  "reload-viht-n160": 0.97,
  "reload-norma-mrp": 0.96,
  "reload-viht-n540": 1.03,
};

export type LoadPlanEstimate = {
  /** Estimated peak pressure vs game max book load. */
  pressurePct: number;
  /** pressurePct − 100, floored at 0. */
  overpressurePct: number;
  /** Estimated muzzle velocity (m/s). */
  v0Mps: number;
  /** Cartridge overall length (mm). */
  colMm: number;
  /** Cartridge overall length (inches). */
  colIn: number;
  /** Jam / touch COL (inches) used as seating reference. */
  jamColIn: number;
  /** SAAMI max COL (inches) for context. */
  saamiMaxColIn: number;
  /**
   * Per-shot kaboom probability (0–1).
   * 0 when overpressure ≤ 5%.
   */
  kaboomChance: number;
  /** True when pressurePct > 100. */
  isOverpressure: boolean;
  /** Incomplete recipe — estimates are provisional. */
  incomplete: boolean;
};

export function parseBulletWeightGrains(bullet: ShopItem | null): number | null {
  if (!bullet) return null;
  const m = /(\d+(?:[.,]\d+)?)\s*gr/i.exec(`${bullet.name} ${bullet.note ?? ""}`);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * COL from seating depth: jam COL minus jump (thou → inches).
 */
export function colFromSeatingDepth(
  caliberKey: SpentBrassKey,
  seatingDepthThou: number,
): { colIn: number; colMm: number; jamColIn: number; saamiMaxColIn: number } {
  const jamColIn = JAM_COL_IN[caliberKey];
  const jumpIn = Math.max(0, seatingDepthThou) / 1000;
  const colIn = Math.round((jamColIn - jumpIn) * 1000) / 1000;
  return {
    jamColIn,
    saamiMaxColIn: SAAMI_MAX_COL_IN[caliberKey],
    colIn,
    colMm: Math.round(colIn * 25.4 * 10) / 10,
  };
}

/**
 * Seating / friflukt from player-set COL (mm).
 * Friflukt = jump off lands (thou) = jam − COL.
 */
export function seatingFromColMm(
  caliberKey: SpentBrassKey,
  colMm: number,
): {
  seatingDepthThou: number;
  colIn: number;
  colMm: number;
  jamColIn: number;
  saamiMaxColIn: number;
} {
  const jamColIn = JAM_COL_IN[caliberKey];
  const saamiMaxColIn = SAAMI_MAX_COL_IN[caliberKey];
  const colIn = Math.max(0.5, colMm / 25.4);
  const jumpIn = Math.max(0, jamColIn - colIn);
  const seatingDepthThou = Math.round(jumpIn * 1000);
  return {
    jamColIn,
    saamiMaxColIn,
    colIn: Math.round(colIn * 1000) / 1000,
    colMm: Math.round(colMm * 10) / 10,
    seatingDepthThou: Math.max(0, Math.min(200, seatingDepthThou)),
  };
}

/**
 * Kaboom chance from overpressure amount (pressure% − 100).
 * ≤5% over: 0. Above 5%: 3% + 2% per each extra 1% over 5.
 */
export function kaboomChanceFromOverpressure(overpressurePct: number): number {
  if (!(overpressurePct > 5)) return 0;
  const chance = 0.03 + 0.02 * (overpressurePct - 5);
  return Math.max(0, Math.min(0.95, chance));
}

export function estimateLoadPlan(
  recipe: LoadBenchRecipe,
  opts?: { powder?: ShopItem | null; bullet?: ShopItem | null },
): LoadPlanEstimate {
  const col = colFromSeatingDepth(recipe.caliberKey, recipe.seatingDepthThou);
  const incomplete = !recipe.powderItemId || !recipe.bulletItemId;

  const refCharge = REF_CHARGE_GR[recipe.caliberKey];
  const charge = Math.max(0.1, recipe.powderGrains);
  const chargeRatio = charge / refCharge;

  // Seating closer to lands raises pressure (20 thou = neutral).
  const seatingFactor = 1 + ((20 - recipe.seatingDepthThou) / 100) * 0.35;
  const powderMult =
    (opts?.powder && POWDER_PRESSURE_MULT[opts.powder.id]) || 1;
  const bulletGr = parseBulletWeightGrains(opts?.bullet ?? null);
  const typicalGr =
    recipe.caliberKey === "223" || recipe.caliberKey === "300blk"
      ? 55
      : recipe.caliberKey === "65cm" || recipe.caliberKey === "65x55"
        ? 140
        : 168;
  const bulletFactor =
    bulletGr != null ? 0.92 + 0.08 * (bulletGr / typicalGr) : 1;

  let pressurePct =
    100 *
    Math.pow(chargeRatio, 2.15) *
    Math.max(0.75, seatingFactor) *
    powderMult *
    bulletFactor;
  pressurePct = Math.round(pressurePct * 10) / 10;

  const overpressurePct = Math.max(0, Math.round((pressurePct - 100) * 10) / 10);

  const v0Powder = (opts?.powder && POWDER_V0_MULT[opts.powder.id]) || 1;
  const v0Seating = 1 + ((recipe.seatingDepthThou - 20) / 1000) * 0.4;
  let v0Mps =
    REF_V0_MPS[recipe.caliberKey] *
    Math.pow(chargeRatio, 0.55) *
    v0Powder *
    Math.max(0.92, v0Seating);
  if (bulletGr != null) {
    v0Mps *= Math.sqrt(typicalGr / bulletGr);
  }
  /** Estimated only — rounded whole m/s; display as (v0). */
  v0Mps = Math.round(v0Mps);

  return {
    pressurePct,
    overpressurePct,
    v0Mps,
    colMm: col.colMm,
    colIn: col.colIn,
    jamColIn: col.jamColIn,
    saamiMaxColIn: col.saamiMaxColIn,
    kaboomChance: kaboomChanceFromOverpressure(overpressurePct),
    isOverpressure: pressurePct > 100,
    incomplete,
  };
}

/** Estimate pressure/kaboom for a load-dev table row (COL → seating). */
export function estimateLoadPlanFromDevRow(
  caliberKey: SpentBrassKey,
  row: {
    powderItemId: string | null;
    powderGrains: number;
    bulletItemId: string | null;
    primerItemId: string | null;
    colMm: number;
  },
  opts?: { powder?: ShopItem | null; bullet?: ShopItem | null },
): LoadPlanEstimate {
  const seating = seatingFromColMm(caliberKey, row.colMm);
  const recipe: LoadBenchRecipe = {
    caliberKey,
    sizingDieId: null,
    seatingDieId: null,
    brassItemId: null,
    primerItemId: row.primerItemId,
    powderItemId: row.powderItemId,
    powderGrains: row.powderGrains,
    bulletItemId: row.bulletItemId,
    seatingDepthThou: seating.seatingDepthThou,
    annealing: false,
  };
  const est = estimateLoadPlan(recipe, opts);
  return {
    ...est,
    colMm: seating.colMm,
    colIn: seating.colIn,
    jamColIn: seating.jamColIn,
    saamiMaxColIn: seating.saamiMaxColIn,
  };
}

export function formatKaboomChancePct(chance: number): string {
  if (chance <= 0) return "0 %";
  return `${(chance * 100).toFixed(1)} %`;
}

/** Estimated muzzle velocity for UI — whole m/s in parentheses. */
export function formatEstimatedV0Mps(v0Mps: number): string {
  return `(${Math.round(v0Mps)})`;
}

/** Snapshot armed for live fire kaboom checks + load-dev write-back. */
export type ArmedLoadPlan = {
  caliberKey: SpentBrassKey;
  pressurePct: number;
  overpressurePct: number;
  kaboomChance: number;
  /** Estimated v0 — measured v0 comes from chrono on the load-dev row. */
  v0Mps: number;
  powderGrains: number;
  seatingDepthThou: number;
  colMm: number;
  armedAtMs: number;
  /** Load-dev table row currently under test (range write-back). */
  loadDevRowId?: string | null;
  /** Home-loaded lot under test (preferred write-back target). */
  homeLotId?: string | null;
};

export function normalizeArmedLoadPlan(raw: unknown): ArmedLoadPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const keys = new Set([
    "308",
    "65cm",
    "65x55",
    "3006",
    "223",
    "300blk",
  ]);
  if (typeof o.caliberKey !== "string" || !keys.has(o.caliberKey)) return null;
  const num = (v: unknown, fb: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fb;
  const overpressurePct = Math.max(0, num(o.overpressurePct, 0));
  return {
    caliberKey: o.caliberKey as SpentBrassKey,
    pressurePct: Math.max(0, num(o.pressurePct, 100)),
    overpressurePct,
    kaboomChance: kaboomChanceFromOverpressure(overpressurePct),
    v0Mps: Math.max(0, Math.round(num(o.v0Mps, 0))),
    powderGrains: Math.max(0, num(o.powderGrains, 0)),
    seatingDepthThou: Math.max(0, Math.round(num(o.seatingDepthThou, 20))),
    colMm: Math.max(0, num(o.colMm, 0)),
    armedAtMs: Math.max(0, num(o.armedAtMs, Date.now())),
    loadDevRowId:
      typeof o.loadDevRowId === "string" && o.loadDevRowId
        ? o.loadDevRowId
        : null,
    homeLotId:
      typeof o.homeLotId === "string" && o.homeLotId ? o.homeLotId : null,
  };
}
