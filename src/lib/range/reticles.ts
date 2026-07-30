/**
 * Hold-over contract: FFP reticle scales with *optic zoom only*
 * ({@link opticReticleImgScale} / {@link scopeImageScale} @ 100 m).
 * Target/bird CSS scale is separate (distance, true-angular ×0.1, subject)
 * so 1 mil on glass ≈ `distanceM` mm on the target plane when paper uses
 * {@link RANGE_TRUE_ANGULAR_TARGET_SCALE}. Dial clicks stay true 0.1 mil
 * via player.ts ZERO_CLICK_MM.
 *
 * {@link ffpReticleImageScale} maps each asset’s `centerTo1MilPx` onto the
 * CBA diamond tip (1 mil angular). For MOA scopes, that tip is scaled by
 * {@link MM_PER_MOA_AT_100M}/100 so 1 MOA hash ↔ 1 MOA on the bird/world.
 *
 * ZCO MPCT3X ({@code zco527b.png}): full tree, FFP. In-game 27× (premium FOV)
 * ≈7.2 mrad centre→edge (real ZCO @ 27×).
 *
 * Measure `centerTo1MilPx` on the native PNG (center → 1.0 mil hash on
 * MRAD scopes, or center → 1.0 MOA hash on MOA scopes — same field name).
 * Optional `opticalCenterX/Y` if the crosshair is not at the image midpoint.
 */

import type { ScopeClickUnit, ScopeSpec } from "@/lib/optics/spec";
import { MM_PER_MOA_AT_100M } from "@/lib/ballistics/dispersion";
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
 * - {@link ReticleIllumination.regions}: one or more circle / rect clips
 *   (native px or mils from optical centre). Union of all regions.
 * - Legacy {@link ReticleIllumination.region}: single clip (still supported).
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
  /** @deprecated Prefer {@link regions}. Still read/written for older packs. */
  region?: ReticleIlluminationRegion;
  /** Multiple illuminated fields (union). */
  regions?: ReticleIlluminationRegion[];
};

/**
 * Circular crop of the reticle PNG.
 *
 * - Outer radius: keep inside, discard outside (scope-ring chrome).
 * - Optional {@code rInner} / {@code rInnerMils}: discard *inside* too (hole)
 *   so a {@link ReticleHiResLayer} can sit in the centre. Prefer mils so the
 *   hole matches across layers with different {@code centerTo1MilPx}.
 */
export type ReticleImageCrop =
  | {
      shape: "circle";
      /** Native px; omit → optical centre. */
      cx?: number;
      cy?: number;
      /** Outer radius (native px). */
      r: number;
      /** Inner hole radius (native px); omit → solid disk. */
      rInner?: number;
    }
  | {
      shape: "circleMils";
      /** Outer radius in mils (× {@link ReticleDef.centerTo1MilPx}). */
      rMils: number;
      /**
       * Inner hole in mils — base layer becomes a ring; hi-res fills the hole.
       * Same mil value on both layers → automatic alignment.
       */
      rInnerMils?: number;
    };

/**
 * High-res / narrow-FOV layer stacked on the base PNG.
 * Has its own hash pitch + optical centre. When the base crop has an inner
 * hole ({@code rInnerMils}), this layer is clipped to that radius (or its own
 * {@code cropRMils}) and placed in the hole.
 */
export type ReticleHiResLayer = {
  src: string;
  nativeWidth: number;
  nativeHeight: number;
  /** Native px centre → 1 mil/MOA on *this* asset. */
  centerTo1MilPx: number;
  opticalCenterX?: number;
  opticalCenterY?: number;
  /**
   * Outer crop radius in mils for this layer (disk). Defaults to the base
   * crop’s {@code rInnerMils} when compositing a ring+disk pair.
   */
  cropRMils?: number;
  /**
   * Fraction of scope maxZoom where overlay opacity starts rising.
   * Default {@link RETICLE_HIRES_FADE_FROM}.
   */
  fadeFromZoomFrac?: number;
  /**
   * Fraction of maxZoom where overlay is fully opaque.
   * Default {@link RETICLE_HIRES_FADE_TO}.
   */
  fadeToZoomFrac?: number;
};

export const RETICLE_HIRES_FADE_FROM = 0.4;
export const RETICLE_HIRES_FADE_TO = 0.85;

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
  /** Circular crop — clip scope-ring chrome outside usable glass. */
  imageCrop?: ReticleImageCrop;
  /**
   * High-res FFP overlay (preferred over hard {@link maxZoom} swap).
   */
  hiRes?: ReticleHiResLayer;
  /**
   * Optional sharper / illuminated asset at scope {@code maxZoom}
   * (same subtension contract via its own {@code centerTo1MilPx}).
   * Prefer {@link hiRes} for continuous zoom.
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
   * `centerTo1MilPx` = native px centre → **1 MOA** hash (10 MOA @ 151 px).
   * FFP scale uses MOA angular (29.4 mm @ 100 m), not mil diamond — see
   * {@link ffpReticleImageScale}. NX8 FOV: zoomMagCal / minZoomMagCal in catalog.
   */
  nf_moa: {
    id: "nf_moa",
    label: "MOA",
    src: "/range/reticles/nf_moa.png",
    nativeWidth: 1279,
    nativeHeight: 1280,
    centerTo1MilPx: 151 / 10,
    opticalCenterX: 639.47,
    opticalCenterY: 638.5,
    imageRotationDeg: 0,
    // Illum: H/V wires + hashes only (digits dark) — Admin fasit.
    illumination: {
      regions: [
        { shape: "rect", x: 330, y: 608, w: 632, h: 65 },
        { shape: "rect", x: 602, y: 400, w: 75, h: 870 },
      ],
    },
    imageCrop: {
      shape: "circle",
      r: 625,
    },
  },
  /**
   * ZCO 5-27 MPCT3X mil tree ({@code zco527b.png}).
   * CALIBRATED reference reticle — see `.cursor/skills/scope-reticle-calibration`.
   * Full Christmas-tree hold grid; ~55.5 px/mil.
   * Optical centre: −2.47 klikk X / +0.85 klikk Y (1 klikk = 0.1 mil) + 0.42° CW.
   * FOV: ±7.2 mrad @ 27× (shared {@code SCOPE_FOV_CAL_HALF_MRAD}). Hold-over: CAL=1.
   *
   * Illumination (optional): clip centre-only with
   * `{ region: { shape: "circleMils", rMils: 1.5 } }`, or a stroke mask PNG via
   * `{ maskSrc: "/range/reticles/zco527b-illum-mask.png" }`.
   */
  mpct3x: {
    id: "mpct3x",
    label: "MPCT3X",
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
      regions: [{ shape: "rect", x: 458, y: 415, w: 899, h: 1254 }],
    },
  },
  /**
   * Kahles MSR (Absehen_MSR.png, 1920²) — K624i / K525i / K318i.
   * Hash: 40.9 px → 1 mil (Admin cal). Illuminated centre cross only.
   * imageCrop clips the drawn black scope-ring (~r 900) so only glass
   * interior shows; radius scales with FFP zoom via clip-path.
   * K624i FOV: zoomMagCal 0.955 / minZoomMagCal 0.97 in catalog.
   */
  kahles: {
    id: "kahles",
    label: "MSR",
    src: "/range/reticles/Absehen_MSR.png",
    nativeWidth: 1920,
    nativeHeight: 1920,
    centerTo1MilPx: 40.9,
    opticalCenterX: 960,
    opticalCenterY: 960,
    imageRotationDeg: 0,
    illumination: {
      region: { shape: "rect", x: 915, y: 915, w: 90, h: 89 },
    },
    imageCrop: {
      shape: "circle",
      r: 900,
    },
  },
  /**
   * Element Nexus G1 (APR-style mil tree) — wide (5×) + narrow (20×) assets.
   * Base = wide FOV ring; hiRes = narrow disk in the centre hole.
   * Per-layer {@code centerTo1MilPx} / optical centre; crops in mils so the
   * inner disk fills the outer hole automatically.
   */
  "nexus-g1": {
    id: "nexus-g1",
    label: "Nexus G1",
    src: "/range/reticles/nexus5x.png",
    nativeWidth: 2164,
    nativeHeight: 1426,
    centerTo1MilPx: 27.4,
    opticalCenterX: 1084.98,
    opticalCenterY: 334,
    imageRotationDeg: 0,
    illumination: {
      region: { shape: "rect", x: 1075, y: 158, w: 20, h: 410 },
    },
    imageCrop: {
      shape: "circleMils",
      rMils: 20,
      rInnerMils: 8.5,
    },
    hiRes: {
      src: "/range/reticles/nexus20x.png",
      nativeWidth: 2243,
      nativeHeight: 2001,
      centerTo1MilPx: 121.1,
      opticalCenterX: 1115,
      opticalCenterY: 830,
      cropRMils: 8.5,
      fadeFromZoomFrac: 0.25,
      fadeToZoomFrac: 0.75,
    },
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

/** Resolved illum regions (legacy `region` + `regions`). */
export function reticleIlluminationRegions(
  illum: ReticleIllumination | null | undefined,
): ReticleIlluminationRegion[] {
  if (!illum) return [];
  const list: ReticleIlluminationRegion[] = [];
  if (illum.regions?.length) list.push(...illum.regions);
  else if (illum.region) list.push(illum.region);
  return list;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(1, Math.max(0, v));
}

/**
 * One region → CSS clip-path fragment in display px.
 * Image is pinned so optical centre sits at the parent’s 50%/50% (via
 * `left/top: 50%` + negative margin); pass {@code originMode: "optical"} for
 * crop on the full-bleed wrapper, or {@code "image"} for clips on the img
 * itself (legacy illum — coords relative to img top-left).
 */
export function reticleRegionClipPath(
  region: ReticleIlluminationRegion,
  reticle: Pick<ReticleDef, "centerTo1MilPx">,
  optical: { x: number; y: number },
  scale: number,
  originMode: "image" | "optical" = "image",
): string | undefined {
  if (!(scale > 0)) return undefined;

  if (region.shape === "circle" || region.shape === "circleMils") {
    const cxNative =
      region.shape === "circle" && region.cx != null
        ? region.cx
        : optical.x;
    const cyNative =
      region.shape === "circle" && region.cy != null
        ? region.cy
        : optical.y;
    const rNative =
      region.shape === "circleMils"
        ? region.rMils * reticle.centerTo1MilPx
        : region.r;
    if (!(rNative > 0)) return undefined;
    if (originMode === "optical") {
      /* Wrapper is inset:0; optical centre = 50% 50%. */
      const ox = (cxNative - optical.x) * scale;
      const oy = (cyNative - optical.y) * scale;
      return `circle(${rNative * scale}px at calc(50% + ${ox}px) calc(50% + ${oy}px))`;
    }
    return `circle(${rNative * scale}px at ${cxNative * scale}px ${cyNative * scale}px)`;
  }

  const { x, y, w, h } = region;
  if (!(w > 0) || !(h > 0)) return undefined;
  if (originMode === "optical") {
    const x0 = (x - optical.x) * scale;
    const y0 = (y - optical.y) * scale;
    const x1 = (x + w - optical.x) * scale;
    const y1 = (y + h - optical.y) * scale;
    return `polygon(calc(50% + ${x0}px) calc(50% + ${y0}px), calc(50% + ${x1}px) calc(50% + ${y0}px), calc(50% + ${x1}px) calc(50% + ${y1}px), calc(50% + ${x0}px) calc(50% + ${y1}px))`;
  }
  const x0 = x * scale;
  const y0 = y * scale;
  const x1 = (x + w) * scale;
  const y1 = (y + h) * scale;
  return `polygon(${x0}px ${y0}px, ${x1}px ${y0}px, ${x1}px ${y1}px, ${x0}px ${y1}px)`;
}

/**
 * CSS {@code clip-path} for a single illuminated region on the img element.
 * Prefer {@link reticleIlluminationClipPaths} when multiple regions.
 */
export function reticleIlluminationClipPath(
  reticle: ReticleDef,
  optical: { x: number; y: number },
  scale: number,
): string | undefined {
  const regions = reticleIlluminationRegions(reticle.illumination);
  if (regions.length === 0) return undefined;
  return reticleRegionClipPath(regions[0]!, reticle, optical, scale, "image");
}

/** One clip-path per illuminated region (union via stacked overlays). */
export function reticleIlluminationClipPaths(
  reticle: ReticleDef,
  optical: { x: number; y: number },
  scale: number,
): string[] {
  return reticleIlluminationRegions(reticle.illumination)
    .map((r) => reticleRegionClipPath(r, reticle, optical, scale, "image"))
    .filter((c): c is string => !!c);
}

/** Circular crop clip on the reticle wrapper (optical centre = 50%/50%).
 * Solid disks only — annulus crops use {@link reticleCropMaskStyle} on the img.
 */
export function reticleImageCropClipPath(
  reticle: ReticleDef,
  optical: { x: number; y: number },
  scale: number,
): string | undefined {
  const radii = reticleCropRadiiPx(reticle.imageCrop, reticle, optical, scale);
  if (!radii || radii.inner != null) return undefined;
  return `circle(${radii.outer}px at calc(50% + ${radii.atX}px) calc(50% + ${radii.atY}px))`;
}

/**
 * Resolved outer (+ optional inner hole) radii in display px for a crop def.
 * Coordinates {@code atX/atY} are relative to optical centre (wrapper 50%/50%).
 */
export function reticleCropRadiiPx(
  crop: ReticleImageCrop | null | undefined,
  reticle: Pick<ReticleDef, "centerTo1MilPx">,
  optical: { x: number; y: number },
  scale: number,
): {
  outer: number;
  inner: number | null;
  atX: number;
  atY: number;
  /** Native optical-relative centre of the crop circle, for img-local masks. */
  cxNative: number;
  cyNative: number;
} | null {
  if (!crop || !(scale > 0)) return null;
  const cxNative =
    crop.shape === "circle" && crop.cx != null ? crop.cx : optical.x;
  const cyNative =
    crop.shape === "circle" && crop.cy != null ? crop.cy : optical.y;
  const outerNative =
    crop.shape === "circleMils"
      ? crop.rMils * reticle.centerTo1MilPx
      : crop.r;
  if (!(outerNative > 0)) return null;
  let innerNative: number | null = null;
  if (crop.shape === "circleMils" && crop.rInnerMils != null && crop.rInnerMils > 0) {
    innerNative = crop.rInnerMils * reticle.centerTo1MilPx;
  } else if (crop.shape === "circle" && crop.rInner != null && crop.rInner > 0) {
    innerNative = crop.rInner;
  }
  if (innerNative != null && !(innerNative < outerNative)) {
    innerNative = null;
  }
  return {
    outer: outerNative * scale,
    inner: innerNative != null ? innerNative * scale : null,
    atX: (cxNative - optical.x) * scale,
    atY: (cyNative - optical.y) * scale,
    cxNative,
    cyNative,
  };
}

/**
 * CSS mask for a solid disk or annulus on an {@code <img>} whose optical
 * centre sits at native ({@code cx},{@code cy}) within the image box.
 */
export function reticleCropMaskStyle(
  crop: ReticleImageCrop | null | undefined,
  reticle: Pick<ReticleDef, "centerTo1MilPx">,
  optical: { x: number; y: number },
  scale: number,
): Record<string, string> | null {
  const radii = reticleCropRadiiPx(crop, reticle, optical, scale);
  if (!radii) return null;
  const cx = radii.cxNative * scale;
  const cy = radii.cyNative * scale;
  const outer = radii.outer;
  const inner = radii.inner;
  const grad =
    inner != null && inner > 0
      ? `radial-gradient(circle at ${cx}px ${cy}px, transparent ${Math.max(0, inner - 0.75)}px, #000 ${inner}px, #000 ${outer}px, transparent ${outer + 0.75}px)`
      : `radial-gradient(circle at ${cx}px ${cy}px, #000 ${outer}px, transparent ${outer + 0.75}px)`;
  return {
    WebkitMaskImage: grad,
    maskImage: grad,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskSize: "100% 100%",
    maskSize: "100% 100%",
  };
}

/**
 * Disk clip for the inner (hi-res) layer — outer crop only, in mils.
 * {@code rMils} defaults to the base hole ({@code rInnerMils}) so it fills it.
 */
export function reticleHiResDiskClipPath(
  rMils: number,
  reticle: Pick<ReticleDef, "centerTo1MilPx">,
  optical: { x: number; y: number },
  scale: number,
): string | undefined {
  if (!(rMils > 0) || !(scale > 0)) return undefined;
  return reticleRegionClipPath(
    { shape: "circleMils", rMils },
    reticle,
    optical,
    scale,
    "image",
  );
}

/** Effective inner-layer outer crop in mils (hole fill). */
export function reticleHiResCropRMils(
  baseCrop: ReticleImageCrop | null | undefined,
  hiRes: ReticleHiResLayer | null | undefined,
): number | null {
  if (hiRes?.cropRMils != null && hiRes.cropRMils > 0) {
    return hiRes.cropRMils;
  }
  if (baseCrop?.shape === "circleMils" && baseCrop.rInnerMils != null) {
    return baseCrop.rInnerMils > 0 ? baseCrop.rInnerMils : null;
  }
  return null;
}

/** Hi-res overlay opacity 0–1 from current zoom vs scope max. */
export function reticleHiResOpacity(
  zoom: number,
  maxZoom: number,
  hiRes: ReticleHiResLayer | null | undefined,
): number {
  if (!hiRes || !(maxZoom > 0)) return 0;
  const from = hiRes.fadeFromZoomFrac ?? RETICLE_HIRES_FADE_FROM;
  const to = hiRes.fadeToZoomFrac ?? RETICLE_HIRES_FADE_TO;
  const frac = zoom / maxZoom;
  if (!(to > from)) return frac >= to ? 1 : 0;
  return clamp01((frac - from) / (to - from));
}

/** Stable key for dirty-check / bake compare. `"whole"` = no clip/mask. */
export function reticleIlluminationKey(
  illum: ReticleIllumination | null | undefined,
): string {
  const n = normalizeReticleIllumination(illum ?? undefined);
  if (!n) return "whole";
  return JSON.stringify(n);
}

export function reticleImageCropKey(
  crop: ReticleImageCrop | null | undefined,
): string {
  if (!crop) return "none";
  return JSON.stringify(crop);
}

export function reticleHiResKey(
  hi: ReticleHiResLayer | null | undefined,
): string {
  if (!hi?.src) return "none";
  return JSON.stringify({
    src: hi.src,
    nativeWidth: hi.nativeWidth,
    nativeHeight: hi.nativeHeight,
    centerTo1MilPx: hi.centerTo1MilPx,
    opticalCenterX: hi.opticalCenterX,
    opticalCenterY: hi.opticalCenterY,
    cropRMils: hi.cropRMils,
    fadeFromZoomFrac: hi.fadeFromZoomFrac,
    fadeToZoomFrac: hi.fadeToZoomFrac,
  });
}

/** Drop empty illumination (whole reticle). Prefer `regions` over legacy `region`. */
export function normalizeReticleIllumination(
  illum: ReticleIllumination | null | undefined,
): ReticleIllumination | undefined {
  if (!illum) return undefined;
  const maskSrc = illum.maskSrc?.trim() || undefined;
  const regions = reticleIlluminationRegions(illum).filter((r) => {
    if (r.shape === "circleMils") return r.rMils > 0;
    if (r.shape === "circle") return r.r > 0;
    return r.w > 0 && r.h > 0;
  });
  if (!maskSrc && regions.length === 0) return undefined;
  if (regions.length <= 1) {
    return {
      ...(maskSrc ? { maskSrc } : null),
      ...(regions[0] ? { region: regions[0] } : null),
    };
  }
  return {
    ...(maskSrc ? { maskSrc } : null),
    regions,
  };
}

export function normalizeReticleImageCrop(
  crop: ReticleImageCrop | null | undefined,
): ReticleImageCrop | undefined {
  if (!crop) return undefined;
  if (crop.shape === "circleMils") {
    if (!(crop.rMils > 0)) return undefined;
    const rInner =
      crop.rInnerMils != null &&
      crop.rInnerMils > 0 &&
      crop.rInnerMils < crop.rMils
        ? Math.round(crop.rInnerMils * 1000) / 1000
        : undefined;
    return {
      shape: "circleMils",
      rMils: Math.round(crop.rMils * 1000) / 1000,
      ...(rInner != null ? { rInnerMils: rInner } : null),
    };
  }
  if (!(crop.r > 0)) return undefined;
  const rInner =
    crop.rInner != null && crop.rInner > 0 && crop.rInner < crop.r
      ? Math.round(crop.rInner * 1000) / 1000
      : undefined;
  return {
    shape: "circle",
    r: Math.round(crop.r * 1000) / 1000,
    ...(crop.cx != null ? { cx: Math.round(crop.cx * 1000) / 1000 } : null),
    ...(crop.cy != null ? { cy: Math.round(crop.cy * 1000) / 1000 } : null),
    ...(rInner != null ? { rInner } : null),
  };
}

export function normalizeReticleHiRes(
  hi: ReticleHiResLayer | null | undefined,
): ReticleHiResLayer | undefined {
  if (!hi?.src?.trim()) return undefined;
  if (
    !(hi.nativeWidth > 0) ||
    !(hi.nativeHeight > 0) ||
    !(hi.centerTo1MilPx > 0)
  ) {
    return undefined;
  }
  const out: ReticleHiResLayer = {
    src: hi.src.trim(),
    nativeWidth: Math.round(hi.nativeWidth),
    nativeHeight: Math.round(hi.nativeHeight),
    centerTo1MilPx: Math.round(hi.centerTo1MilPx * 1000) / 1000,
  };
  if (hi.opticalCenterX != null && Number.isFinite(hi.opticalCenterX)) {
    out.opticalCenterX = Math.round(hi.opticalCenterX * 10000) / 10000;
  }
  if (hi.opticalCenterY != null && Number.isFinite(hi.opticalCenterY)) {
    out.opticalCenterY = Math.round(hi.opticalCenterY * 10000) / 10000;
  }
  if (hi.cropRMils != null && Number.isFinite(hi.cropRMils) && hi.cropRMils > 0) {
    out.cropRMils = Math.round(hi.cropRMils * 1000) / 1000;
  }
  if (hi.fadeFromZoomFrac != null && Number.isFinite(hi.fadeFromZoomFrac)) {
    out.fadeFromZoomFrac = Math.round(hi.fadeFromZoomFrac * 1000) / 1000;
  }
  if (hi.fadeToZoomFrac != null && Number.isFinite(hi.fadeToZoomFrac)) {
    out.fadeToZoomFrac = Math.round(hi.fadeToZoomFrac * 1000) / 1000;
  }
  return out;
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
 *
 * Maps `centerTo1MilPx` → one major angular unit on glass:
 * - MRAD: CBA diamond tip = **1 mil** (same as bird {@link birdScopeImageScale})
 * - MOA: that tip × (29.4 mm / 100 mm) = **1 MOA**
 *
 * Applies {@link RETICLE_SUBTENSION_CAL} so hashes match dialed drop.
 */
export function ffpReticleImageScale(
  imgScale: number,
  reticle: ReticleDef,
  clickUnit: ScopeClickUnit = "MRAD",
): number {
  const unitToDiamond =
    CBA_DIAMOND_CENTER_TO_TIP_PX / reticle.centerTo1MilPx;
  const moaVsMil =
    clickUnit === "MOA" ? MM_PER_MOA_AT_100M / 100 : 1;
  return imgScale * unitToDiamond * moaVsMil * RETICLE_SUBTENSION_CAL;
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
  scope: Pick<ScopeSpec, "minZoom" | "maxZoom" | "clickUnit">,
  reticle: ReticleDef,
): number {
  const refImgScale = scopeImageScale(scope.maxZoom);
  const unit = scope.clickUnit === "MOA" ? "MOA" : "MRAD";
  return ffpReticleImageScale(refImgScale, reticle, unit);
}

export function reticleImageScale(
  scope: ScopeSpec,
  zoom: number,
  imgScale: number,
  reticle: ReticleDef,
): number {
  const unit = scope.clickUnit === "MOA" ? "MOA" : "MRAD";
  if (scope.focalPlane === "FFP") {
    return ffpReticleImageScale(imgScale, reticle, unit);
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
