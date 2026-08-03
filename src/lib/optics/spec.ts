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

/** Default max elevation UP clicks when a scope omits `elevationUpClicks`. */
export const DEFAULT_ELEVATION_UP_CLICKS = 200;

/** MRAD turret: 0.1 mil/click → 15 mil/rev = 150 clicks (ZCO-class). */
export const DEFAULT_CLICKS_PER_REV_MRAD = 150;
/** MOA turret: ¼ MOA/click → 20 MOA/rev = 80 clicks (common NF). */
export const DEFAULT_CLICKS_PER_REV_MOA = 80;

export type ScopeSpec = {
  /**
   * Main tube outer diameter (mm). Mounts must match exactly —
   * 25.4 = 1", then 30 / 34 / 35 (Mark 5HD) / 36 (ZCO) mm.
   */
  tubeDiameterMm: ScopeTubeDiameterMm;
  minZoom: number;
  maxZoom: number;
  /**
   * When true and Triggercam/Scopemate is in the active kit, zoom is limited to
   * {@link triggercamMinZoom}–{@link triggercamMaxZoom} (ocular clearance).
   * Omit / false → full engraved range even with a shot-cam packed.
   */
  triggercamZoomRestrict?: boolean;
  /**
   * Lower zoom with Triggercam zoom restrict active.
   * Omit → {@link scopeTriggercamMinZoomDefault} (typically maxZoom − 3).
   */
  triggercamMinZoom?: number;
  /**
   * Upper zoom with Triggercam zoom restrict active.
   * Omit → scope {@link maxZoom}.
   */
  triggercamMaxZoom?: number;
  /** FFP = reticle grows with zoom; SFP = fixed reticle (default). */
  focalPlane?: ScopeFocalPlane;
  /** Key into `RETICLES` (range/reticles.ts). */
  reticleId?: string;
  clickUnit: ScopeClickUnit;
  /**
   * Elevation lower face-click limit (zero-stop). UP-positive face scale.
   * Optional — omit = no zero-stop (down travel matches upper magnitude).
   * Absolute mechanical stop only — NOT per-revolution face wrap.
   *
   * Signed clicks below / at zero, e.g. `-5`, `-50`, or `0` (hard zero).
   * Legacy positive values (`5`) are treated as `−5`.
   */
  zeroStop?: number;
  /**
   * Elevation upper face-click limit from mechanical zero (multi-rev OK).
   * Omit → {@link DEFAULT_ELEVATION_UP_CLICKS}. ZCO 5-27 ≈ 350 (35 mrad).
   */
  elevationUpClicks?: number;
  /**
   * Clicks per full elevation turret revolution (drum face wrap / dual-row).
   * Omit → {@link DEFAULT_CLICKS_PER_REV_MRAD} or {@link DEFAULT_CLICKS_PER_REV_MOA}.
   */
  elevationClicksPerRev?: number;
  /**
   * Clicks per full windage turret revolution (R↔L wrap labels on drum).
   * Omit → same default as elevation for the click unit.
   */
  windageClicksPerRev?: number;
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
   * Extra image-scale multiplier at {@link maxZoom} (FOV fine-tune).
   * 1 = default shared FOV; >1 = narrower FOV (more magnification feel).
   * Interpolated with {@link minZoomMagCal} across the zoom range.
   * Omit → {@link SCOPE_ZOOM_MAG_CAL} / 1.
   */
  zoomMagCal?: number;
  /**
   * Extra image-scale at {@link minZoom} — how low power “feels” in the glass.
   * Interpolated toward {@link zoomMagCal} as zoom increases.
   * Omit → same as {@link zoomMagCal} (single-point FOV cal).
   */
  minZoomMagCal?: number;
  /**
   * When true, holding F (focus) applies {@link focusZoomMultiplier} to
   * reticle + target/landscape — perceived zoom while settling the shot.
   * Omit / false → no focus zoom (game default off until admin enables).
   */
  focusZoomEnabled?: boolean;
  /**
   * Extra optic scale while focus (F) is held. 1 = no boost, default 2, max 5.
   * Only used when {@link focusZoomEnabled} is true.
   */
  focusZoomMultiplier?: number;
  /**
   * Scope-glass diameter scale while focus immersion is active.
   * 1 = unchanged; default 1.25 (+25%). Glass draws over elev/wind/para/illum drums.
   * Only used when {@link focusZoomEnabled} is true and F is held.
   */
  focusViewportScale?: number;
  /**
   * Scope-circle diameter multiplier vs medium glass (Element = 1).
   * Premium (ZCO/Kahles/NF/SB/Razor) = {@link SCOPE_FOV_DIAMETER_PREMIUM}.
   * At in-game 27×, premium circle shows ±7.2 mrad centre→edge (real ZCO).
   */
  fovDiameterScale?: number;
  /**
   * Reticle illumination colours this optic supports.
   * Omit / `["red"]` = unipolar red drum (0→1).
   * `["red","green"]` (ZCO) = bipolar drum (−1 green ↔ 0 ↔ +1 red).
   */
  illuminationColors?: ReticleIllumColor[];
};

/** Illuminated reticle colour (etched strokes stay black). */
export type ReticleIllumColor = "red" | "green";

export const DEFAULT_ILLUMINATION_COLORS: ReticleIllumColor[] = ["red"];

export function scopeIlluminationColors(
  scope: Pick<ScopeSpec, "illuminationColors"> | null | undefined,
): ReticleIllumColor[] {
  const raw = scope?.illuminationColors;
  if (!raw?.length) return [...DEFAULT_ILLUMINATION_COLORS];
  const out: ReticleIllumColor[] = [];
  for (const c of raw) {
    if ((c === "red" || c === "green") && !out.includes(c)) out.push(c);
  }
  return out.length > 0 ? out : [...DEFAULT_ILLUMINATION_COLORS];
}

/** True when the illum drum supports both red and green (−1…+1). */
export function scopeIlluminationBipolar(
  scope: Pick<ScopeSpec, "illuminationColors"> | null | undefined,
): boolean {
  const c = scopeIlluminationColors(scope);
  return c.includes("red") && c.includes("green");
}

/**
 * Decode signed drum value (−1…+1 or 0…1) → intensity + colour.
 * Positive = red (or sole colour); negative = green when bipolar.
 */
export function decodeReticleIllumination(
  signed: number,
  scope?: Pick<ScopeSpec, "illuminationColors"> | null,
): { intensity: number; color: ReticleIllumColor } {
  const bipolar = scopeIlluminationBipolar(scope);
  const colors = scopeIlluminationColors(scope);
  if (!Number.isFinite(signed) || signed === 0) {
    return { intensity: 0, color: colors[0] ?? "red" };
  }
  if (bipolar) {
    if (signed > 0) {
      return { intensity: Math.min(1, signed), color: "red" };
    }
    return { intensity: Math.min(1, -signed), color: "green" };
  }
  const sole = colors[0] ?? "red";
  return { intensity: Math.min(1, Math.max(0, signed)), color: sole };
}

/** CSS filter that maps black PNG pixels to the illumination colour. */
export function reticleIlluminationCssFilter(color: ReticleIllumColor): string {
  if (color === "green") {
    return "brightness(0) saturate(100%) invert(42%) sepia(93%) saturate(1200%) hue-rotate(78deg) brightness(1.15)";
  }
  return "brightness(0) saturate(100%) invert(18%) sepia(98%) saturate(6500%) hue-rotate(350deg) brightness(1.05)";
}

/** Force etched strokes black regardless of source PNG colour. */
export const RETICLE_ETCH_BLACK_FILTER = "brightness(0)";

/** UI hex for drum sun icons. */
export function reticleIllumColorHex(color: ReticleIllumColor): string {
  return color === "green" ? "#3dcf4a" : "#e82424";
}

function defaultClicksPerRev(unit: ScopeClickUnit): number {
  return unit === "MOA"
    ? DEFAULT_CLICKS_PER_REV_MOA
    : DEFAULT_CLICKS_PER_REV_MRAD;
}

/** Elevation clicks in one full turret revolution (for face labels). */
export function scopeElevationClicksPerRev(
  scope:
    | Pick<ScopeSpec, "clickUnit" | "elevationClicksPerRev">
    | null
    | undefined,
): number {
  const n = scope?.elevationClicksPerRev;
  if (n != null && Number.isFinite(n) && n >= 4) return Math.round(n);
  return defaultClicksPerRev(scope?.clickUnit ?? "MRAD");
}

/** Windage clicks in one full turret revolution (for R/L wrap labels). */
export function scopeWindageClicksPerRev(
  scope:
    | Pick<ScopeSpec, "clickUnit" | "windageClicksPerRev">
    | null
    | undefined,
): number {
  const n = scope?.windageClicksPerRev;
  if (n != null && Number.isFinite(n) && n >= 4) return Math.round(n);
  return defaultClicksPerRev(scope?.clickUnit ?? "MRAD");
}

/**
 * Elevation face-click window (UP-positive face, absolute mechanical).
 * - `max` = upper bound (`elevationUpClicks`)
 * - `min` = zero-stop lower bound (`zeroStop`, e.g. −5 / −50), or `−max` if omitted
 */
export function scopeElevationFaceLimits(
  scope:
    | Pick<ScopeSpec, "zeroStop" | "elevationUpClicks">
    | null
    | undefined,
): { min: number; max: number } {
  const max = scopeElevationUpClicks(scope);
  const raw = scope?.zeroStop;
  let min: number;
  if (raw == null || !Number.isFinite(raw)) {
    min = -max;
  } else {
    const n = Math.round(raw);
    /* Signed lower bound; legacy positive N → −N. */
    min = n > 0 ? -n : n;
  }
  if (min > max) min = max;
  return { min, max };
}

/**
 * @deprecated Prefer {@link scopeElevationFaceLimits}.max
 * Max elevation UP clicks (absolute from mechanical zero).
 */
export function scopeElevationUpClicks(
  scope: Pick<ScopeSpec, "elevationUpClicks"> | null | undefined,
): number {
  const n = scope?.elevationUpClicks;
  if (n == null || !Number.isFinite(n) || n < 0) {
    return DEFAULT_ELEVATION_UP_CLICKS;
  }
  return Math.round(n);
}

/**
 * @deprecated Prefer {@link scopeElevationFaceLimits}.min
 * Zero-stop as positive “clicks down past zero”, or null if none.
 */
export function scopeZeroStopDownClicks(
  scope: Pick<ScopeSpec, "zeroStop" | "elevationUpClicks"> | null | undefined,
): number | null {
  if (scope?.zeroStop == null || !Number.isFinite(scope.zeroStop)) return null;
  const { min } = scopeElevationFaceLimits(scope);
  return Math.max(0, -min);
}

export function scopeFovDiameterScale(
  scope: Pick<ScopeSpec, "fovDiameterScale"> | null | undefined,
): number {
  const s = scope?.fovDiameterScale;
  if (s != null && Number.isFinite(s) && s > 0) return s;
  return SCOPE_FOV_DIAMETER_STANDARD;
}

/** Default focus-zoom boost when enabled and multiplier omitted. */
export const DEFAULT_FOCUS_ZOOM_MULTIPLIER = 2;
export const FOCUS_ZOOM_MULTIPLIER_MIN = 1;
export const FOCUS_ZOOM_MULTIPLIER_MAX = 5;

/** Default glass growth while focus immersion is on (+25%). */
export const DEFAULT_FOCUS_VIEWPORT_SCALE = 1.25;
export const FOCUS_VIEWPORT_SCALE_MIN = 1;
export const FOCUS_VIEWPORT_SCALE_MAX = 1.8;

export function scopeFocusZoomEnabled(
  scope: Pick<ScopeSpec, "focusZoomEnabled"> | null | undefined,
): boolean {
  return scope?.focusZoomEnabled === true;
}

/** Clamped catalog multiplier (1–5). Does not check enabled flag. */
export function scopeFocusZoomMultiplier(
  scope: Pick<ScopeSpec, "focusZoomMultiplier"> | null | undefined,
): number {
  const m = scope?.focusZoomMultiplier;
  if (m != null && Number.isFinite(m)) {
    return Math.min(
      FOCUS_ZOOM_MULTIPLIER_MAX,
      Math.max(FOCUS_ZOOM_MULTIPLIER_MIN, m),
    );
  }
  return DEFAULT_FOCUS_ZOOM_MULTIPLIER;
}

/** Clamped glass diameter scale (1–1.8). Does not check enabled flag. */
export function scopeFocusViewportScale(
  scope: Pick<ScopeSpec, "focusViewportScale"> | null | undefined,
): number {
  const s = scope?.focusViewportScale;
  if (s != null && Number.isFinite(s)) {
    return Math.min(
      FOCUS_VIEWPORT_SCALE_MAX,
      Math.max(FOCUS_VIEWPORT_SCALE_MIN, s),
    );
  }
  return DEFAULT_FOCUS_VIEWPORT_SCALE;
}

/**
 * Effective view scale boost while holding F.
 * Player Settings → Scope zoom on focus is the master for range + hunt:
 * off = never; on = zoom while F (catalog multiplier / default).
 * Admin scope lab passes its own enabled flag as {@link playerEnabled}.
 */
export function scopeFocusZoomBoost(
  scope:
    | Pick<ScopeSpec, "focusZoomEnabled" | "focusZoomMultiplier">
    | null
    | undefined,
  focusHeld: boolean,
  /** Player Settings (or Admin lab toggle). Default true. */
  playerEnabled = true,
): number {
  if (!playerEnabled || !focusHeld) return 1;
  return scopeFocusZoomMultiplier(scope);
}

/**
 * Glass diameter CSS scale while focus immersion is active.
 * Same master switch as {@link scopeFocusZoomBoost} (range + hunt).
 */
export function scopeFocusViewportBoost(
  scope:
    | Pick<
        ScopeSpec,
        "focusZoomEnabled" | "focusViewportScale"
      >
    | null
    | undefined,
  focusHeld: boolean,
  /** Player Settings (or Admin lab toggle). Default true. */
  playerEnabled = true,
): number {
  if (!playerEnabled || !focusHeld) return 1;
  return scopeFocusViewportScale(scope);
}

/** Default Triggercam floor: top 3× of the engraved range (ZCO 27 → 24). */
export function scopeTriggercamMinZoomDefault(
  scope: Pick<ScopeSpec, "minZoom" | "maxZoom">,
): number {
  const lo = scope.minZoom;
  const hi = scope.maxZoom;
  if (!(hi > lo)) return lo;
  return Math.max(lo, Math.round((hi - 3) * 100) / 100);
}

export function scopeTriggercamZoomRestrictEnabled(
  scope: Pick<ScopeSpec, "triggercamZoomRestrict"> | null | undefined,
): boolean {
  return scope?.triggercamZoomRestrict === true;
}

/**
 * Engraved zoom window, optionally narrowed when Triggercam/Scopemate is in kit
 * and {@link ScopeSpec.triggercamZoomRestrict} is on.
 */
export function scopeEffectiveZoomRange(
  scope: Pick<
    ScopeSpec,
    | "minZoom"
    | "maxZoom"
    | "triggercamZoomRestrict"
    | "triggercamMinZoom"
    | "triggercamMaxZoom"
  >,
  shotCamInKit: boolean,
): { minZoom: number; maxZoom: number } {
  const baseMin = scope.minZoom;
  const baseMax = scope.maxZoom;
  if (
    !shotCamInKit ||
    !scopeTriggercamZoomRestrictEnabled(scope) ||
    !(baseMax > baseMin)
  ) {
    return { minZoom: baseMin, maxZoom: baseMax };
  }
  let lo =
    scope.triggercamMinZoom != null && Number.isFinite(scope.triggercamMinZoom)
      ? scope.triggercamMinZoom
      : scopeTriggercamMinZoomDefault(scope);
  let hi =
    scope.triggercamMaxZoom != null && Number.isFinite(scope.triggercamMaxZoom)
      ? scope.triggercamMaxZoom
      : baseMax;
  lo = Math.min(baseMax, Math.max(baseMin, lo));
  hi = Math.min(baseMax, Math.max(baseMin, hi));
  if (lo > hi) {
    const t = lo;
    lo = hi;
    hi = t;
  }
  return { minZoom: lo, maxZoom: hi };
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
   * Budget ≈ 23×; Condor ≈ 15×; Habrok ≈ 12× (lengre batteri enn Condor).
   */
  timeFactor?: number;
  /** Built-in laser rangefinder (e.g. Condor CQ35 LRF / Habrok). */
  hasIntegratedLrf?: boolean;
  /** Symmetric LRF error band when {@link hasIntegratedLrf}. */
  rangeErrorPercent?: number;
  /**
   * Integrated LRF shows elev/wind holds (Habrok). Omit/false = range only
   * (Condor CQ35 LRF) — even with Kestrel in kit.
   */
  integratedLrfHasBallistics?: boolean;
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
