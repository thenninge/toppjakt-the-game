/**
 * Optics specs for LRF binoculars/monoculars and riflescopes.
 */

import type { ScopeTubeDiameterMm } from "@/lib/mount/spec";

export type ScopeClickUnit = "MRAD" | "MOA";

/** First focal plane — reticle scales with magnification. */
export type ScopeFocalPlane = "FFP" | "SFP";

/** Medium glass (Element etc.) — baseline scope-circle diameter. */
export const SCOPE_FOV_DIAMETER_STANDARD = 1;
/**
 * Premium apparent FOV diameter vs medium (Kahles / SB / NF / ZCO / Razor).
 * +15 % circle → more milliradians visible at the same zoom.
 */
export const SCOPE_FOV_DIAMETER_PREMIUM = 1.15;

export type ScopeSpec = {
  /**
   * Main tube outer diameter (mm). Mounts must match exactly —
   * 25.4 = 1", then 30 / 34 / 35 (Mark 5HD) / 36 (ZCO) mm.
   */
  tubeDiameterMm: ScopeTubeDiameterMm;
  minZoom: number;
  maxZoom: number;
  /** FFP = reticle grows with zoom; SFP = fixed reticle (default). */
  focalPlane?: ScopeFocalPlane;
  /** Key into `RETICLES` (range/reticles.ts). */
  reticleId?: string;
  clickUnit: ScopeClickUnit;
  /**
   * Symmetric turret click-size error (± percent of nominal).
   * 0 = exact 0.1 mil / ¼ MOA; 10 = each dialed click may realize ±10%.
   * Applied to player dials (saved + session), not factory cold-bore base.
   */
  clickErrorPercent: number;
  /**
   * Residual aiming error (MOA) after dialing turrets back to mechanical zero.
   * Lower = better zero retention. Premium (ZCO/Kahles/NF/SB/Zeiss/Element) ≈ 0.025–0.11;
   * Leupold Mark 5 keeps ~0.12; budget ~0.5–1.2+.
   */
  zeroRetentionInaccuracy: number;
  /**
   * Scope-circle diameter multiplier vs medium glass (Element = 1).
   * Premium (ZCO/Kahles/NF/SB/Razor) = {@link SCOPE_FOV_DIAMETER_PREMIUM}.
   * At in-game 27×, premium circle shows ±7.2 mrad centre→edge (real ZCO).
   */
  fovDiameterScale?: number;
};

export function scopeFovDiameterScale(
  scope: Pick<ScopeSpec, "fovDiameterScale"> | null | undefined,
): number {
  const s = scope?.fovDiameterScale;
  if (s != null && Number.isFinite(s) && s > 0) return s;
  return SCOPE_FOV_DIAMETER_STANDARD;
}

/**
 * Scale dialed mm-at-100 m by this scope's click error band.
 * `clickErrorPercent` 10 → multiply by U(0.9, 1.1).
 */
export function applyScopeClickError(
  dialedMmAt100: number,
  clickErrorPercent: number,
  random: () => number = Math.random,
): number {
  if (!Number.isFinite(dialedMmAt100) || dialedMmAt100 === 0) {
    return dialedMmAt100;
  }
  const err = Math.max(0, clickErrorPercent) / 100;
  if (err <= 0) return dialedMmAt100;
  return dialedMmAt100 * (1 + (random() * 2 - 1) * err);
}

/**
 * Stable click-size scale for one tracking-test axis (or similar).
 * Perfect scopes (0%) → 1. Cheap ±10% → one roll in [0.9, 1.1] kept for the session.
 */
export function rollScopeClickScale(
  clickErrorPercent: number,
  random: () => number = Math.random,
): number {
  const err = Math.max(0, clickErrorPercent) / 100;
  if (err <= 0) return 1;
  return 1 + (random() * 2 - 1) * err;
}

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
   * Premium (Sig / Leupold / Vortex / …) ≈ 1; Biltema ≈ 5; Jula ≈ 10.
   * Reason to upgrade: a 3% miss at 300 m is ~±9 m hold error.
   */
  rangeErrorPercent: number;
  /**
   * Optical magnification (e.g. 10 for 10x42 binos).
   * Omit or 1 for laser-only handheld rangefinders.
   */
  magnification?: number;
  /**
   * Clear circular aperture % override (dorulleffekt).
   * When set, replaces the price-tier default from {@link opticAperturePercent}.
   */
  aperturePercent?: number;
};

export type ThermalSpec = {
  /**
   * Sensor quality proxy — higher = blockier image (poorer resolution).
   * Budget handheld ≈ 6 (live chunky pixels); premium ≈ 3 / Habrok ≈ 2
   * (baked thermal landscape for WH/BH/outline only — Fusion stays day+rim).
   */
  pixelFactor: number;
  /** Digital / optical zoom factor for panning FOV (fixed zoom units). */
  magnification: number;
  /**
   * Real→game time multiplier while spotting in thermal (also drains battery).
   * Budget ≈ 20×; premium Condor ≈ 30×; Habrok ≈ 24× (20% slower drain than Condor).
   */
  timeFactor?: number;
  /** Built-in laser rangefinder (e.g. Condor CQ35 LRF / Habrok). */
  hasIntegratedLrf?: boolean;
  /** Symmetric LRF error band when {@link hasIntegratedLrf}. */
  rangeErrorPercent?: number;
  /**
   * Thermal binocular (Habrok): replaces separate binos + thermal in kit.
   * Variable zoom + outline / fusion display modes.
   */
  isThermalBinocular?: boolean;
  /** Variable zoom range (Habrok 5–22×). */
  minZoom?: number;
  maxZoom?: number;
  /** Outline mode: red edge around heat signatures. */
  hasOutlineMode?: boolean;
  /** Fusion mode: day-optic image + thermal red outline. */
  hasFusionMode?: boolean;
};

/** Habrok / thermal-bino: green band needs zoom above this. */
export const HABROK_GREEN_MIN_ZOOM = 10;
/** Habrok / thermal-bino: yellow band needs zoom above this. */
export const HABROK_YELLOW_MIN_ZOOM = 15;

/**
 * Clear circular aperture as % of half the shorter frame edge
 * (`radial-gradient` closest-side). Higher price → thinner black bezel
 * → more of the spotting image visible at the same magnification.
 *
 * Spec magnification is measured through this aperture (see SpotView zoom).
 *
 *   0–7 000 kr  → 65 % (budsjett)
 *   7–15 000 kr → 75 % (mid)
 *   over 15 000 → 95 % (premium)
 */
export function opticAperturePercent(priceNok: number): number {
  const p = Number.isFinite(priceNok) ? Math.max(0, priceNok) : 0;
  if (p <= 7000) return 65;
  if (p <= 15000) return 75;
  return 95;
}

/** Price-tier aperture, or explicit LRF override when set. */
export function resolveOpticAperturePercent(
  priceNok: number,
  override?: number | null,
): number {
  if (override != null && Number.isFinite(override) && override > 0) {
    return Math.min(100, Math.max(1, override));
  }
  return opticAperturePercent(priceNok);
}

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

/**
 * Clear-aperture radius in frame % (0–100 scale) for one axis.
 * Matches CSS `radial-gradient(circle closest-side)` with
 * {@link opticAperturePercent} as % of that radius.
 */
export function opticApertureRadiusPct(
  aperturePercent: number,
  axis: "x" | "y",
  frameWidth: number,
  frameHeight: number,
): number {
  const a = Math.min(100, Math.max(1, aperturePercent)) / 100;
  const w = Math.max(1, frameWidth);
  const h = Math.max(1, frameHeight);
  const closest = Math.min(w, h);
  if (axis === "x") return ((a * closest) / 2 / w) * 100;
  return ((a * closest) / 2 / h) * 100;
}

/**
 * Pan limits so the *circular* aperture edge can reach the landscape edge
 * (not the rectangular frame). With full aperture (r=50) this is [0, 100].
 */
export function opticPanRange(
  zoom: number,
  apertureRadiusPct: number,
): { min: number; max: number } {
  const z = Math.max(1, zoom);
  const r = Math.min(50, Math.max(0, apertureRadiusPct));
  if (z <= 1.001) return { min: 0, max: 100 };
  return {
    min: (r - 50) / (z - 1),
    max: (100 * z - 50 - r) / (z - 1),
  };
}

export function clampOpticPan(
  n: number,
  zoom: number,
  apertureRadiusPct: number,
): number {
  const { min, max } = opticPanRange(zoom, apertureRadiusPct);
  return Math.max(min, Math.min(max, n));
}

/** Landscape % under the optic centre (lens 50,50) for current pan/zoom. */
export function landscapeAtLensCenter(
  pan: number,
  zoom: number,
): number {
  const z = Math.max(1, zoom);
  return (50 - (1 - z) * pan) / z;
}
