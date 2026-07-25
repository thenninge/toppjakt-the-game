/**
 * Laderommet bench recipe — component choices for a home load.
 */

import type { SpentBrassKey } from "@/lib/reloading/brass";

export type LoadBenchRecipe = {
  /** Active caliber filter for the bench. */
  caliberKey: SpentBrassKey;
  /** Owned die-set item id used as sizing die. */
  sizingDieId: string | null;
  /** Owned die-set item id used as seating die. */
  seatingDieId: string | null;
  /** New or spent brass inventory item id. */
  brassItemId: string | null;
  primerItemId: string | null;
  powderItemId: string | null;
  /** Charge weight (grains). */
  powderGrains: number;
  bulletItemId: string | null;
  /**
   * Seating depth as thousandths of an inch off the lands (0 = jam / touch).
   * Typical hunting/match: 10–40 thou.
   */
  seatingDepthThou: number;
  /** Annealing — UI exists but disabled for now. */
  annealing: boolean;
};

export const DEFAULT_SEATING_DEPTH_THOU = 20;

export function createDefaultLoadBenchRecipe(
  caliberKey: SpentBrassKey = "308",
  defaultPowderGrains = 44,
): LoadBenchRecipe {
  return {
    caliberKey,
    sizingDieId: null,
    seatingDieId: null,
    brassItemId: null,
    primerItemId: null,
    powderItemId: null,
    powderGrains: defaultPowderGrains,
    bulletItemId: null,
    seatingDepthThou: DEFAULT_SEATING_DEPTH_THOU,
    annealing: false,
  };
}

export function normalizeLoadBenchRecipe(raw: unknown): LoadBenchRecipe | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const caliberKey = typeof r.caliberKey === "string" ? r.caliberKey : "308";
  const validKeys = new Set([
    "308",
    "65cm",
    "65x55",
    "3006",
    "223",
    "300blk",
  ]);
  const key = (
    validKeys.has(caliberKey) ? caliberKey : "308"
  ) as SpentBrassKey;
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;
  const idOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    caliberKey: key,
    sizingDieId: idOrNull(r.sizingDieId),
    seatingDieId: idOrNull(r.seatingDieId),
    brassItemId: idOrNull(r.brassItemId),
    primerItemId: idOrNull(r.primerItemId),
    powderItemId: idOrNull(r.powderItemId),
    powderGrains: Math.max(0, Math.min(120, num(r.powderGrains, 44))),
    bulletItemId: idOrNull(r.bulletItemId),
    seatingDepthThou: Math.max(
      0,
      Math.min(120, Math.round(num(r.seatingDepthThou, DEFAULT_SEATING_DEPTH_THOU))),
    ),
    annealing: false,
  };
}
