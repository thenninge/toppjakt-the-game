/**
 * Optics specs for LRF binoculars/monoculars and riflescopes.
 */

export type ScopeClickUnit = "MRAD" | "MOA";

/** First focal plane — reticle scales with magnification. */
export type ScopeFocalPlane = "FFP" | "SFP";

export type ScopeSpec = {
  minZoom: number;
  maxZoom: number;
  /** FFP = reticle grows with zoom; SFP = fixed reticle (default). */
  focalPlane?: ScopeFocalPlane;
  /** Key into `RETICLES` (range/reticles.ts). */
  reticleId?: string;
  clickUnit: ScopeClickUnit;
  /**
   * How true each turret click tracks the nominal click value.
   * 1.0 = perfect tracking; 0.9 ≈ 10% average click-size error.
   * Engine: realizedClick ≈ nominalClick * clickAccuracyFactor (± noise later).
   */
  clickAccuracyFactor: number;
  /**
   * Residual aiming error (MOA) after dialing turrets back to mechanical zero.
   * Lower = better zero retention. Premium ~0.05–0.12; budget ~0.5–1.2+.
   */
  zeroRetentionInaccuracy: number;
};

export type LrfSpec = {
  /**
   * True if the unit has onboard ballistic solver / holds
   * (enough that a separate Kestrel is optional, not required).
   *
   * Onboard AB still typically uses **weather forecast** (not local
   * anemometer): larger ±% than Kestrel, and windage is usually
   * full-value (assumes wind from 90°) — not true crosswind.
   */
  hasOnboardBallistics: boolean;
  /** Short label, e.g. "BDX + AB Ultralite", "Applied Ballistics". */
  ballisticSystem?: string;
  /**
   * Symmetric range-measurement error band as percent of true distance.
   * Engine samples uniformly in ±rangeErrorPercent.
   * Premium (Sig / Leupold / Vortex / …) ≈ 1; Biltema / Jula ≈ 3.
   * Reason to upgrade: a 3% miss at 300 m is ~±9 m hold error.
   */
  rangeErrorPercent: number;
};

/**
 * Apply LRF ranging error: displayed distance ∈ true × (1 ± rangeErrorPercent/100).
 */
export function measureDistanceWithLrf(
  trueDistanceM: number,
  lrf: Pick<LrfSpec, "rangeErrorPercent">,
  random: () => number = Math.random,
): number {
  const frac = (random() * 2 - 1) * (lrf.rangeErrorPercent / 100);
  return trueDistanceM * (1 + frac);
}
