/**
 * Hold-over contract: FFP reticle scales with *optic zoom only*
 * ({@link opticReticleImgScale} / {@link scopeImageScale} @ 100 m).
 * Target/bird CSS scale is separate (distance, true-angular ×0.1, subject)
 * so 1 mil on glass ≈ `distanceM` mm on the target plane when paper uses
 * {@link RANGE_TRUE_ANGULAR_TARGET_SCALE}. Dial clicks stay true 0.1 mil
 * via player.ts ZERO_CLICK_MM.
 *
 * {@link ffpReticleImageScale} maps each asset’s `centerTo1MilPx` onto the
 * CBA diamond tip in native px.
 *
 * ZCO MPCT3 ({@code zco527b.png}): full tree, FFP. In-game 27× (premium FOV)
 * ≈7.2 mrad centre→edge (real ZCO @ 27×).
 *
 * Measure `centerTo1MilPx` on the native PNG (center → 1.0 mil hash on
 * MRAD scopes, or center → 1.0 MOA hash on MOA scopes — same field name).
 * Optional `opticalCenterX/Y` if the crosshair is not at the image midpoint.
 */

import type { ScopeSpec } from "@/lib/optics/spec";
import {
  CBA_DIAMOND_CENTER_TO_TIP_PX,
  RETICLE_SUBTENSION_CAL,
  scopeImageScale,
} from "@/lib/range/precision";

/**
 * Which etched strokes light up (red overlay). Omit = whole PNG.
 *
 * - {@link ReticleIllumination.maskSrc}: stroke-accurate alpha/luminance mask
 *   (same framing as the reticle PNG; white/opaque = lights).
 * - {@link ReticleIllumination.region}: quick circle / rect clip (native px or
 *   mils from optical centre). Combined as mask ∩ region when both set.
 */
export type ReticleIlluminationRegion =
  | {
      shape: "circle";
      /** Native px; omit → optical centre. */
      cx?: number;
      cy?: number;
      /** Radius in native image pixels. */
      r: number;
    }
  | {
      shape: "rect";
      /** Top-left + size in native image pixels. */
      x: number;
      y: number;
      w: number;
      h: number;
    }
  | {
      /** Circle on optical crosshair; radius in mils (× {@code centerTo1MilPx}). */
      shape: "circleMils";
      rMils: number;
    };

export type ReticleIllumination = {
  maskSrc?: string;
  region?: ReticleIlluminationRegion;
};

export type ReticleDef = {
  id: string;
  label: string;
  src: string;
  nativeWidth: number;
  nativeHeight: number;
  /** Reticle center → first major MRAD/MIL hash (measured on native asset). */
  centerTo1MilPx: number;
  /**
   * Crosshair / floating-dot position in native pixels.
   * Defaults to image midpoint when omitted.
   */
  opticalCenterX?: number;
  opticalCenterY?: number;
  /** Clockwise image rotation in degrees (CSS `rotate`), around optical centre. */
  imageRotationDeg?: number;
  /** Partial illumination — see {@link ReticleIllumination}. */
  illumination?: ReticleIllumination;
  /**
   * Optional sharper / illuminated asset at scope {@code maxZoom}
   * (same subtension contract via its own {@code centerTo1MilPx}).
   */
  maxZoom?: {
    src: string;
    nativeWidth: number;
    nativeHeight: number;
    centerTo1MilPx: number;
    opticalCenterX?: number;
    opticalCenterY?: number;
  };
};

export const RETICLES: Record<string, ReticleDef> = {
  "nightforce-mil-r": {
    id: "nightforce-mil-r",
    label: "MIL-R",
    src: "/range/reticles/nightforce-mil-r.png",
    nativeWidth: 742,
    nativeHeight: 741,
    centerTo1MilPx: 43,
  },
  /**
   * Nightforce MOA tree (nf_moa.png, 1279×1280).
   * Admin hash rings (clickUnit=MOA): `centerTo1MilPx` = native px → 1 MOA.
   * NX8 4-32 MOA FOV: {@code zoomMagCal: 0.235}, {@code minZoomMagCal: 0.1}
   * (catalog). Native ≈ 15.1 px/MOA (10 MOA @ 151 px); value below is the
   * paper-aligned subtension used with MOA range scale.
   */
  nf_moa: {
    id: "nf_moa",
    label: "MOA",
    src: "/range/reticles/nf_moa.png",
    nativeWidth: 1279,
    nativeHeight: 1280,
    centerTo1MilPx: 151 / 40,
  },
  /**
   * ZCO 5-27 MPCT3-style mil tree ({@code zco527b.png}).
   * CALIBRATED reference reticle — see `.cursor/skills/scope-reticle-calibration`.
   * Full Christmas-tree hold grid; ~55.5 px/mil.
       * Optical centre: −2.47 klikk X / +0.85 klikk Y (1 klikk = 0.1 mil) + 0.42° CW.
   * FOV: ±7.2 mrad @ 27× (shared {@code SCOPE_FOV_CAL_HALF_MRAD}). Hold-over: CAL=1.
   *
   * Illumination (optional): clip centre-only with
   * `{ region: { shape: "circleMils", rMils: 1.5 } }`, or a stroke mask PNG via
   * `{ maskSrc: "/range/reticles/zco527b-illum-mask.png" }`.
   */
  "zco-527-mpct": {
    id: "zco-527-mpct",
    label: "MPCT",
    src: "/range/reticles/zco527b.png",
    nativeWidth: 1792,
    nativeHeight: 1780,
    centerTo1MilPx: 55.5,
    /** 967 − 10.32×0.1×55.5 — shift reticle 10.32 clicks right on glass. */
    opticalCenterX: 909.724,
    /** 865 + 5.35×0.1×55.5 — shift reticle 5.35 clicks up on glass. */
    opticalCenterY: 894.6925,
    /** CSS positive = clockwise. */
    imageRotationDeg: 0.42,
    illumination: {
      region: { shape: "rect", x: 458, y: 415, w: 899, h: 1254 },
    },
  },
  /**
   * Kahles SKMR-style mil tree (kahles.png, 1200²).
   * Native hash pitch ≈ 26 px between marks; initial 1 mil read as 131 px
   * was ~5× too small vs CBA/target — ÷5, then ×1.02 visual bump → ÷1.02.
   */
  kahles: {
    id: "kahles",
    label: "SKMR",
    src: "/range/reticles/kahles.png",
    nativeWidth: 1200,
    nativeHeight: 1200,
    centerTo1MilPx: 131 / 5 / 1.02,
  },
  /**
   * Schmidt & Bender mil tree (sb.png, 500²).
   * 0.5 mil ticks ≈ 10 px → 1 mil ≈ 20 px; ×1.12 so 1 cm on reticle
   * matches 1 cm on the CBA blink at 100 m.
   */
  sb: {
    id: "sb",
    label: "P4F",
    src: "/range/reticles/sb.png",
    nativeWidth: 500,
    nativeHeight: 500,
    centerTo1MilPx: 20 / 1.12,
  },
};

export function getReticleDef(id: string | undefined): ReticleDef | null {
  if (!id) return null;
  return RETICLES[id] ?? null;
}

/** Within this of maxZoom → use {@link ReticleDef.maxZoom} asset if present. */
export const RETICLE_MAX_ZOOM_EPS = 0.05;

/**
 * Resolve display asset: sharper max-zoom PNG when at (or essentially at) max.
 */
export function resolveReticleForZoom(
  def: ReticleDef,
  zoom: number,
  maxZoom: number,
): ReticleDef {
  const hi = def.maxZoom;
  if (!hi || zoom < maxZoom - RETICLE_MAX_ZOOM_EPS) return def;
  return {
    ...def,
    src: hi.src,
    nativeWidth: hi.nativeWidth,
    nativeHeight: hi.nativeHeight,
    centerTo1MilPx: hi.centerTo1MilPx,
    opticalCenterX: hi.opticalCenterX,
    opticalCenterY: hi.opticalCenterY,
  };
}

export function reticleOpticalCenter(reticle: ReticleDef): {
  x: number;
  y: number;
} {
  return {
    x: reticle.opticalCenterX ?? reticle.nativeWidth / 2,
    y: reticle.opticalCenterY ?? reticle.nativeHeight / 2,
  };
}

/**
 * CSS {@code clip-path} for the illuminated overlay, in display pixels
 * ({@code scale} = CSS px per native px). Undefined = no region clip.
 */
export function reticleIlluminationClipPath(
  reticle: ReticleDef,
  optical: { x: number; y: number },
  scale: number,
): string | undefined {
  const region = reticle.illumination?.region;
  if (!region || !(scale > 0)) return undefined;

  if (region.shape === "circle" || region.shape === "circleMils") {
    const cx =
      region.shape === "circle" && region.cx != null
        ? region.cx
        : optical.x;
    const cy =
      region.shape === "circle" && region.cy != null
        ? region.cy
        : optical.y;
    const rNative =
      region.shape === "circleMils"
        ? region.rMils * reticle.centerTo1MilPx
        : region.r;
    if (!(rNative > 0)) return undefined;
    return `circle(${rNative * scale}px at ${cx * scale}px ${cy * scale}px)`;
  }

  const { x, y, w, h } = region;
  if (!(w > 0) || !(h > 0)) return undefined;
  const x0 = x * scale;
  const y0 = y * scale;
  const x1 = (x + w) * scale;
  const y1 = (y + h) * scale;
  return `polygon(${x0}px ${y0}px, ${x1}px ${y0}px, ${x1}px ${y1}px, ${x0}px ${y1}px)`;
}

/** Stable key for dirty-check / bake compare. `"whole"` = no clip/mask. */
export function reticleIlluminationKey(
  illum: ReticleIllumination | null | undefined,
): string {
  if (!illum) return "whole";
  const mask = illum.maskSrc?.trim() || "";
  const region = illum.region;
  if (!mask && !region) return "whole";
  return JSON.stringify({
    maskSrc: mask || undefined,
    region: region ?? undefined,
  });
}

/** Drop empty illumination (whole reticle). */
export function normalizeReticleIllumination(
  illum: ReticleIllumination | null | undefined,
): ReticleIllumination | undefined {
  if (!illum) return undefined;
  const maskSrc = illum.maskSrc?.trim() || undefined;
  const region = illum.region;
  if (!maskSrc && !region) return undefined;
  return {
    ...(maskSrc ? { maskSrc } : null),
    ...(region ? { region } : null),
  };
}

/**
 * Live hold-over fine-tune — see {@link RETICLE_SUBTENSION_CAL} in precision.ts.
 */

/**
 * `imgScale` for {@link ScopeReticle} so one major hash (1 mil / calibrated
 * unit) spans `mmPerUnit` on the target after {@link ffpReticleImageScale}.
 *
 * Use `mmPerUnit = distanceM` for MRAD (1 mil at D m = D mm). For MOA
 * reticles use `MM_PER_MOA_AT_100M * (distanceM / 100)`.
 * `targetCssScale` must be the same scale applied to the target/bird world.
 */
export function angularReticleImgScale(opts: {
  mmPerUnit: number;
  pxPerMm: number;
  targetCssScale: number;
}): number {
  const unitScreenPx =
    Math.max(0, opts.mmPerUnit) *
    Math.max(1e-9, opts.pxPerMm) *
    Math.max(0, opts.targetCssScale);
  return unitScreenPx / CBA_DIAMOND_CENTER_TO_TIP_PX;
}

/**
 * Uniform image scale for an FFP reticle at the current target zoom.
 * Maps `centerTo1MilPx` → CBA diamond tip; pair with {@link angularReticleImgScale}.
 * Applies {@link RETICLE_SUBTENSION_CAL} so hashes match dialed drop.
 */
export function ffpReticleImageScale(
  imgScale: number,
  reticle: ReticleDef,
): number {
  const milToDiamond =
    CBA_DIAMOND_CENTER_TO_TIP_PX / reticle.centerTo1MilPx;
  return imgScale * milToDiamond * RETICLE_SUBTENSION_CAL;
}

/**
 * Tracking lane: true mils vs 1 cm grid (1 mil = 100 mm = 10 squares @ 100 m).
 */
export function trackingReticleImgScale(
  zoomScale: number,
  target: { pxPerMm: number; visualScale: number },
): number {
  return angularReticleImgScale({
    mmPerUnit: 100,
    pxPerMm: target.pxPerMm,
    targetCssScale: target.visualScale * zoomScale,
  });
}

/**
 * SFP reticle stays the same apparent size — calibrated at max magnification.
 */
export function sfpReticleImageScale(
  scope: Pick<ScopeSpec, "minZoom" | "maxZoom">,
  reticle: ReticleDef,
): number {
  const refImgScale = scopeImageScale(scope.maxZoom);
  return ffpReticleImageScale(refImgScale, reticle);
}

export function reticleImageScale(
  scope: ScopeSpec,
  zoom: number,
  imgScale: number,
  reticle: ReticleDef,
): number {
  if (scope.focalPlane === "FFP") {
    return ffpReticleImageScale(imgScale, reticle);
  }
  return sfpReticleImageScale(scope, reticle);
}

export function reticleDisplaySizePx(
  scope: ScopeSpec,
  zoom: number,
  imgScale: number,
  reticle: ReticleDef,
): { width: number; height: number; scale: number } {
  const scale = reticleImageScale(scope, zoom, imgScale, reticle);
  return {
    scale,
    width: reticle.nativeWidth * scale,
    height: reticle.nativeHeight * scale,
  };
}
