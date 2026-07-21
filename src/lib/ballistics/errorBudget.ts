/**
 * # Ballistikkmotor — hjørnestein
 *
 * Hit probability on a hunting target at distance is **never** only the
 * 100 m group from rifle + ammo. The engine must stack every material
 * uncertainty that moves the point of impact relative to the intended
 * vital zone.
 *
 * Shared for: shooting range, zeroing, and the coming hunt simulator.
 *
 * ## Error budget (must all participate in long-range P(hit))
 *
 * 1. **POA** — Where the reticle actually was when the shot broke
 *    (shooter wobble, focus/breath, bipod/can calm, BODY/MIND fatigue,
 *    trigger timing).
 * 2. **Angular dispersion** — Gaussian rifle + ammo (+ stock, affinity).
 *    Catalog MOA = N σ (default 2). See `dispersion.ts`.
 * 3. **v0 variation** — Per-shot muzzle velocity SD → drop / TOF error
 *    (small at 100 m, critical at long range).
 * 4. **Wind** — True live crosswind vs what the player *believes*
 *    (Kestrel local reading vs LRF/AB forecast + full-value windage).
 * 5. **Scope click / dial error** — `clickAccuracyFactor`,
 *    `zeroRetentionInaccuracy`, wrong hold / wrong turret math.
 * 6. **Range error** — LRF `rangeErrorPercent` → wrong drop/wind hold.
 * 7. **Atmosphere** — Temp, pressure/altitude, humidity (BC path).
 * 8. **Zero state** — Cold bore vs warm, last verified zero, cant.
 * 9. **Ammo BC / drag model** — G1/G7 + true vs assumed BC.
 * 10. **Target geometry / ethics** — Vital zone size vs miss/body;
 *     not a loot roll — geometry after the ballistic miss distance.
 *
 * ## Principle
 *
 * Sample (or integrate) the full miss vector in the target plane, then
 * test against vital / body / miss regions. Do **not** collapse this into
 * a single `accuracy * distance` fudge factor.
 *
 * Implementation grows here over time; this file is the contract.
 */

import type { AmmoSpec } from "@/lib/ammo/spec";
import type { LrfSpec, ScopeSpec } from "@/lib/optics/spec";
import type { BallisticsSpec } from "@/lib/ballistics/spec";
import type { RifleSpec } from "@/lib/rifle/spec";
import type { StockSpec } from "@/lib/stock/spec";

/**
 * Everything that can shift POI at distance.
 * Fields are filled as subsystems come online; hunt P(hit) should
 * eventually consume the full stack.
 */
export type BallisticErrorBudget = {
  /** True distance to target (m). */
  trueDistanceM: number;
  /** Distance the player/solver believes (m) — after LRF error. */
  believedDistanceM: number;

  /** Rifle / ammo / stock / affinity angular envelope (N σ MOA). */
  angularEnvelopeMoa: number;
  rifle: RifleSpec;
  ammo: AmmoSpec;
  stock?: StockSpec | null;
  ammoAffinity: number;

  /** Realized muzzle velocity this shot (m/s), after v0 SD sample. */
  realizedV0?: number;

  /** True local wind vs believed wind (m/s, direction deg). */
  trueCrosswindMps?: number;
  believedCrosswindMps?: number;

  scope?: ScopeSpec | null;
  lrf?: LrfSpec | null;
  weatherMeter?: BallisticsSpec | null;

  /** Shooter: POA offset from intended aim when shot breaks (mm or MOA). */
  poaErrorMoa?: { x: number; y: number };
};

/**
 * Result of one fired shot in the target plane (hunt or range).
 * Downstream: classify vs vital/body/miss geometry.
 */
export type BallisticImpactResult = {
  /** Miss from intended POA before shooter wobble, in target plane. */
  missFromPoaMm: { x: number; y: number };
  /** Final impact relative to intended aim point (mm, +x right, +y down). */
  impactFromAimMm: { x: number; y: number };
  /** Which error sources contributed (for debug / UI later). */
  contributions: Partial<{
    angularMm: { x: number; y: number };
    v0Mm: { x: number; y: number };
    windMm: { x: number; y: number };
    rangeHoldMm: { x: number; y: number };
    clickMm: { x: number; y: number };
    poaMm: { x: number; y: number };
  }>;
};

/** Checklist for hunt long-range hit probability — keep in sync with GAME_DESIGN. */
export const BALLISTIC_ENGINE_CORNERSTONE = [
  "poa_reticle_at_break",
  "angular_dispersion_rifle_ammo_stock_affinity",
  "v0_variation",
  "wind_true_vs_believed",
  "scope_click_and_zero_retention",
  "range_measurement_error",
  "atmosphere_bc_path",
  "zero_state_cold_bore_cant",
  "target_vital_geometry",
] as const;

export type BallisticCornerstoneId =
  (typeof BALLISTIC_ENGINE_CORNERSTONE)[number];
