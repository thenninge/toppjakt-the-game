/**
 * Scope reticle assets and FFP/SFP display scaling.
 *
 * Zeroing visual calibration: CBA diamond tip (10 mm) aligns with the first
 * major hash so subtensions stay readable in the scope circle (≈10× true).
 * Tracking lane uses {@link trackingReticleImgScale} so 1 mil = 100 mm on the
 * 1 cm grid. Turret clicks remain true 0.1 mil (10 mm @ 100 m); see
 * player.ts ZERO_CLICK_MM.
 *
 * Measure `centerTo1MilPx` on the native PNG (center → 1.0 mil hash).
 * Optional `opticalCenterX/Y` if the crosshair is not at the image midpoint.
 */

import type { ScopeSpec } from "@/lib/optics/spec";
import {
  CBA_DIAMOND_CENTER_TO_TIP_PX,
  scopeImageScale,
} from "@/lib/range/precision";

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
   * Native: ~15.1 px/MOA (10 MOA label @ 151 px from centre).
   * Divided by 4 so 1 MOA ≈ 4 squares on MOA-scaled paper
   * (1 cm ≈ ¼ MOA); diamond-calibration would otherwise put 1 MOA on 1 square.
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
   * ZCO 5-27 MPCT-style mil tree (zco27.png).
   * Asset measure ≈ 13 px/mil; range fine-tune is the midpoint of
   * ×20/17 and ×20/18 (=×10/9). Crosshair slightly left of geometric center.
   */
  "zco-527-mpct": {
    id: "zco-527-mpct",
    label: "MPCT",
    src: "/range/reticles/zco27.png",
    nativeWidth: 531,
    nativeHeight: 469,
    centerTo1MilPx: 13 / ((20 / 17 + 20 / 18) / 2),
    opticalCenterX: 263,
    opticalCenterY: 235,
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
 * Uniform image scale for an FFP reticle at the current target zoom.
 * Sized so the first major hash matches the CBA diamond tip (readable FOV).
 */
export function ffpReticleImageScale(
  imgScale: number,
  reticle: ReticleDef,
): number {
  const milToDiamond =
    CBA_DIAMOND_CENTER_TO_TIP_PX / reticle.centerTo1MilPx;
  return imgScale * milToDiamond;
}

/**
 * `imgScale` for {@link ScopeReticle} on the tracking lane so labeled mils are
 * true against the 1 cm grid (1 mil hash = 100 mm = 10 squares).
 *
 * Zeroing keeps the CBA “readable” calibration (1 mil hash ≈ 10 mm diamond).
 * Tracking undoes that 10× exaggeration relative to paper.
 */
export function trackingReticleImgScale(
  zoomScale: number,
  target: { pxPerMm: number; visualScale: number },
): number {
  const mmPerMilOnPaper = 100;
  const paperMilScreenPx =
    mmPerMilOnPaper * target.pxPerMm * target.visualScale * zoomScale;
  // ffpReticleImageScale: 1 mil screen px = CBA_DIAMOND * imgScale
  return paperMilScreenPx / CBA_DIAMOND_CENTER_TO_TIP_PX;
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
