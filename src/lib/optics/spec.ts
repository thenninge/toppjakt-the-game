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
  /**
   * Optical magnification (e.g. 10 for 10x42 binos).
   * Omit or 1 for laser-only handheld rangefinders.
   */
  magnification?: number;
};

export type ThermalSpec = {
  /**
   * Sensor quality proxy — higher = blockier image (poorer resolution).
   * Budget handheld ≈ 6; premium scope-class ≈ 3–4.
   */
  pixelFactor: number;
  /** Digital / optical zoom factor for panning FOV. */
  magnification: number;
  /**
   * Real→game time multiplier while spotting in thermal (also drains battery).
   * Budget ≈ 20×; premium ≈ 30× (burns clock faster — observe efficiently).
   */
  timeFactor?: number;
  /** Built-in laser rangefinder (e.g. Condor CQ35 LRF). */
  hasIntegratedLrf?: boolean;
  /** Symmetric LRF error band when {@link hasIntegratedLrf}. */
  rangeErrorPercent?: number;
};

/** Resolve optical zoom for spotting (name like 10x42 if spec omits it). */
export function lrfOpticalMagnification(item: {
  name: string;
  note?: string;
  lrf: Pick<LrfSpec, "magnification">;
}): number {
  if (item.lrf.magnification != null && item.lrf.magnification > 0) {
    return item.lrf.magnification;
  }
  const m = `${item.name} ${item.note ?? ""}`.match(/(\d+)\s*[x×]\s*\d+/i);
  if (m) return Number(m[1]);
  return 1;
}

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

/**
 * Where a landscape %-point sits inside the bino lens (0–100 lens %).
 * Matches CSS world: size zoom×100%, left/top (1−zoom)×pan%.
 */
export function landscapePointInLens(
  landscapeX: number,
  landscapeY: number,
  pan: { x: number; y: number },
  zoom: number,
): { x: number; y: number } {
  return {
    x: (1 - zoom) * pan.x + landscapeX * zoom,
    y: (1 - zoom) * pan.y + landscapeY * zoom,
  };
}
