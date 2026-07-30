"use client";

import type { CSSProperties } from "react";
import type { ScopeSpec } from "@/lib/optics/spec";
import {
  RETICLE_ETCH_BLACK_FILTER,
  reticleIlluminationCssFilter,
  type ReticleIllumColor,
} from "@/lib/optics/spec";
import {
  getReticleDef,
  normalizeReticleIllumination,
  reticleCropMaskStyle,
  reticleCropRadiiPx,
  reticleDisplaySizePx,
  reticleHiResCropRMils,
  reticleHiResDiskClipPath,
  reticleHiResOpacity,
  reticleIlluminationClipPaths,
  reticleImageCropClipPath,
  reticleOpticalCenter,
  resolveReticleForZoom,
  type ReticleDef,
  type ReticleHiResLayer,
  type ReticleIllumination,
  type ReticleImageCrop,
} from "@/lib/range/reticles";

type ScopeReticleProps = {
  scope: ScopeSpec;
  zoom: number;
  /** Optic zoom scale (`opticReticleImgScale` / `scopeImageScale` @ 100 m). */
  imgScale: number;
  /**
   * Reticle illumination intensity 0–1.
   * 0 = black etched, 1 = full colour in illuminated zones.
   * Strokes outside illum regions stay black even if the PNG is red.
   */
  illumination?: number;
  /** Illumination colour (default red). */
  illuminationColor?: ReticleIllumColor;
  /**
   * Override catalog {@code imageRotationDeg} (CSS degrees, clockwise).
   * Used by Admin → Scopes for live calibration.
   */
  rotationDeg?: number;
  /**
   * Override catalog optical centre in native image pixels.
   * Used by Admin → Scopes for live calibration.
   */
  opticalCenterPx?: { x: number; y: number };
  /**
   * Override catalog {@code centerTo1MilPx} (hash spacing).
   * Used by Admin → Scopes hashmark calibration.
   */
  centerTo1MilPx?: number;
  /**
   * Override catalog {@link ReticleDef.illumination} (Admin live cal).
   * Pass `null` / empty to force whole-reticle illumination.
   */
  illuminationDef?: ReticleIllumination | null;
  /** Override catalog circular crop (Admin live cal). */
  imageCropDef?: ReticleImageCrop | null;
  /** Override catalog hi-res overlay (Admin live cal). */
  hiResDef?: ReticleHiResLayer | null;
  /**
   * Admin hash/centre cal — show only one layer so helper rings align to
   * that asset’s {@code centerTo1MilPx}.
   */
  calibrateLayer?: "base" | "hiRes" | null;
  /**
   * When soloing a layer: if true, show the full asset (no hole / disk clip)
   * for hashmark spacing. If false, keep ring/disk crops for seam judgment.
   */
  calibrateFullAsset?: boolean;
  /** Override PNG src (Admin upload preview / cache-bust). */
  srcOverride?: string;
  /** Override native size when srcOverride is a new asset. */
  nativeSizeOverride?: { width: number; height: number };
};

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function GenericReticle({
  illumination = 0,
  color = "red",
}: {
  illumination?: number;
  color?: ReticleIllumColor;
}) {
  const i = clamp01(illumination);
  const lit =
    color === "green"
      ? { r: 17 + (61 - 17) * i, g: 17 + (207 - 17) * i, b: 17 + (74 - 17) * i }
      : { r: 17 + (220 - 17) * i, g: 17 + (36 - 17) * i, b: 17 + (36 - 17) * i };
  const css = `rgb(${Math.round(lit.r)}, ${Math.round(lit.g)}, ${Math.round(lit.b)})`;
  return (
    <div className="scope-reticle" aria-hidden>
      <span className="scope-reticle-h" style={{ background: css }} />
      <span className="scope-reticle-v" style={{ background: css }} />
      <span className="scope-reticle-dot" style={{ background: css }} />
    </div>
  );
}

function scaleIlluminationToAsset(
  illum: ReticleIllumination | undefined,
  from: Pick<ReticleDef, "nativeWidth" | "nativeHeight" | "centerTo1MilPx">,
  to: Pick<ReticleDef, "nativeWidth" | "nativeHeight" | "centerTo1MilPx">,
): ReticleIllumination | undefined {
  if (!illum) return undefined;
  const sx = to.nativeWidth / Math.max(1, from.nativeWidth);
  const sy = to.nativeHeight / Math.max(1, from.nativeHeight);
  const scaleRegion = (
    r: import("@/lib/range/reticles").ReticleIlluminationRegion,
  ): import("@/lib/range/reticles").ReticleIlluminationRegion => {
    if (r.shape === "circleMils") return r;
    if (r.shape === "circle") {
      return {
        shape: "circle",
        r: r.r * sx,
        ...(r.cx != null ? { cx: r.cx * sx } : null),
        ...(r.cy != null ? { cy: r.cy * sy } : null),
      };
    }
    return {
      shape: "rect",
      x: r.x * sx,
      y: r.y * sy,
      w: r.w * sx,
      h: r.h * sy,
    };
  };
  const regions = (
    illum.regions?.length
      ? illum.regions
      : illum.region
        ? [illum.region]
        : []
  ).map(scaleRegion);
  return normalizeReticleIllumination({
    maskSrc: illum.maskSrc,
    ...(regions.length === 1
      ? { region: regions[0] }
      : regions.length > 1
        ? { regions }
        : null),
  });
}

function reticleImgStyle(
  def: ReticleDef,
  optical: { x: number; y: number },
  scale: number,
  rot: number,
  extra?: CSSProperties,
): CSSProperties {
  return {
    width: `${def.nativeWidth * scale}px`,
    height: `${def.nativeHeight * scale}px`,
    marginLeft: `${-optical.x * scale}px`,
    marginTop: `${-optical.y * scale}px`,
    ...(rot !== 0
      ? {
          transform: `rotate(${rot}deg)`,
          transformOrigin: `${optical.x * scale}px ${optical.y * scale}px`,
        }
      : null),
    ...extra,
  };
}

export function ScopeReticle({
  scope,
  zoom,
  imgScale,
  illumination = 0,
  illuminationColor = "red",
  rotationDeg,
  opticalCenterPx,
  centerTo1MilPx,
  illuminationDef,
  imageCropDef,
  hiResDef,
  calibrateLayer = null,
  calibrateFullAsset = false,
  srcOverride,
  nativeSizeOverride,
}: ScopeReticleProps) {
  const base = getReticleDef(scope.reticleId);
  const hasUploadPreview =
    !!srcOverride &&
    !!nativeSizeOverride &&
    nativeSizeOverride.width > 0 &&
    nativeSizeOverride.height > 0;

  if (!base && !hasUploadPreview) {
    return (
      <GenericReticle
        illumination={illumination}
        color={illuminationColor}
      />
    );
  }

  const resolved = base
    ? resolveReticleForZoom(base, zoom, scope.maxZoom)
    : ({
        id: scope.reticleId ?? "upload",
        label: "Upload",
        src: srcOverride!,
        nativeWidth: nativeSizeOverride!.width,
        nativeHeight: nativeSizeOverride!.height,
        centerTo1MilPx:
          centerTo1MilPx && centerTo1MilPx > 0
            ? centerTo1MilPx
            : Math.min(
                nativeSizeOverride!.width,
                nativeSizeOverride!.height,
              ) / 20,
      } satisfies ReticleDef);

  let def: ReticleDef =
    centerTo1MilPx != null &&
    Number.isFinite(centerTo1MilPx) &&
    centerTo1MilPx > 0
      ? { ...resolved, centerTo1MilPx }
      : resolved;
  if (srcOverride) {
    def = {
      ...def,
      src: srcOverride,
      ...(nativeSizeOverride &&
      nativeSizeOverride.width > 0 &&
      nativeSizeOverride.height > 0
        ? {
            nativeWidth: nativeSizeOverride.width,
            nativeHeight: nativeSizeOverride.height,
          }
        : null),
    };
  }
  if (illuminationDef !== undefined) {
    const next = normalizeReticleIllumination(illuminationDef);
    def = { ...def, illumination: next };
  }
  if (imageCropDef !== undefined) {
    def = {
      ...def,
      imageCrop: imageCropDef ?? undefined,
    };
  }
  if (hiResDef !== undefined) {
    def = {
      ...def,
      hiRes: hiResDef ?? undefined,
    };
  } else if (base?.hiRes) {
    def = { ...def, hiRes: base.hiRes };
  }

  const { scale } = reticleDisplaySizePx(scope, zoom, imgScale, def);
  const catalogOptical = reticleOpticalCenter(def);
  const optical =
    opticalCenterPx &&
    Number.isFinite(opticalCenterPx.x) &&
    Number.isFinite(opticalCenterPx.y)
      ? opticalCenterPx
      : catalogOptical;
  const rot =
    rotationDeg != null && Number.isFinite(rotationDeg)
      ? rotationDeg
      : (def.imageRotationDeg ?? 0);
  const i = clamp01(illumination);
  const colorFilter = reticleIlluminationCssFilter(illuminationColor);

  const soloBase = calibrateLayer === "base";
  const soloHi = calibrateLayer === "hiRes";
  const cropRadii = reticleCropRadiiPx(def.imageCrop, def, optical, scale);
  /** Hash-cal full-asset solo strips the hole so outer hashes stay visible. */
  const stripHole = soloBase && calibrateFullAsset;
  const hasAnnulus =
    cropRadii?.inner != null && !stripHole && !soloHi;

  let wrapperCropClip: string | undefined;
  let baseCropMask: Record<string, string> | null;
  if (soloHi) {
    wrapperCropClip = undefined;
    baseCropMask = null;
  } else if (soloBase && calibrateFullAsset) {
    wrapperCropClip = cropRadii
      ? `circle(${cropRadii.outer}px at calc(50% + ${cropRadii.atX}px) calc(50% + ${cropRadii.atY}px))`
      : reticleImageCropClipPath(def, optical, scale);
    baseCropMask = null;
  } else if (hasAnnulus) {
    wrapperCropClip = undefined;
    baseCropMask = reticleCropMaskStyle(
      def.imageCrop,
      def,
      optical,
      scale,
    );
  } else {
    wrapperCropClip = reticleImageCropClipPath(def, optical, scale);
    baseCropMask = reticleCropMaskStyle(
      def.imageCrop,
      def,
      optical,
      scale,
    );
  }

  const imgStyle = reticleImgStyle(def, optical, scale, rot, {
    filter: RETICLE_ETCH_BLACK_FILTER,
    ...baseCropMask,
  });
  const illumClips = reticleIlluminationClipPaths(def, optical, scale);
  const illumMaskSrc = def.illumination?.maskSrc;

  const hi = def.hiRes;
  const hiCropRMils = reticleHiResCropRMils(def.imageCrop, hi);
  const ringComposite = hasAnnulus && !!hi && hiCropRMils != null;
  /**
   * Ring+disk: show inner layer whenever compositing (fade still applies).
   * Solo modes force one layer for Admin hash / centre cal.
   */
  const hiOpacity = soloHi
    ? 1
    : soloBase
      ? 0
      : ringComposite
        ? Math.max(reticleHiResOpacity(zoom, scope.maxZoom, hi), 0.35)
        : reticleHiResOpacity(zoom, scope.maxZoom, hi);

  let hiLayer: {
    def: ReticleDef;
    optical: { x: number; y: number };
    scale: number;
    style: CSSProperties;
    illumClips: string[];
    diskClip: string | undefined;
  } | null = null;
  if (hi && hiOpacity > 0.01) {
    const hiDef: ReticleDef = {
      ...def,
      src: hi.src,
      nativeWidth: hi.nativeWidth,
      nativeHeight: hi.nativeHeight,
      centerTo1MilPx: hi.centerTo1MilPx,
      opticalCenterX: hi.opticalCenterX,
      opticalCenterY: hi.opticalCenterY,
      illumination: scaleIlluminationToAsset(def.illumination, def, {
        nativeWidth: hi.nativeWidth,
        nativeHeight: hi.nativeHeight,
        centerTo1MilPx: hi.centerTo1MilPx,
      }),
    };
    const hiSize = reticleDisplaySizePx(scope, zoom, imgScale, hiDef);
    const hiOptical = reticleOpticalCenter(hiDef);
    const diskClip =
      soloHi && calibrateFullAsset
        ? undefined
        : hiCropRMils == null
          ? undefined
          : reticleHiResDiskClipPath(
              hiCropRMils,
              hiDef,
              hiOptical,
              hiSize.scale,
            );
    hiLayer = {
      def: hiDef,
      optical: hiOptical,
      scale: hiSize.scale,
      style: reticleImgStyle(hiDef, hiOptical, hiSize.scale, rot, {
        opacity: hiOpacity,
        filter: RETICLE_ETCH_BLACK_FILTER,
        ...(diskClip ? { clipPath: diskClip } : null),
      }),
      illumClips: reticleIlluminationClipPaths(
        hiDef,
        hiOptical,
        hiSize.scale,
      ),
      diskClip,
    };
  }

  const maskStyle: CSSProperties | null = illumMaskSrc
    ? {
        WebkitMaskImage: `url(${illumMaskSrc})`,
        maskImage: `url(${illumMaskSrc})`,
        WebkitMaskSize: "100% 100%",
        maskSize: "100% 100%",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }
    : null;

  function illumOverlay(
    src: string,
    layerDef: ReticleDef,
    layerOptical: { x: number; y: number },
    layerScale: number,
    layerStyle: CSSProperties,
    clip: string | undefined,
    key: string,
    opacity: number,
    extraMask?: CSSProperties | null,
  ) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={key}
        className="scope-reticle-img scope-reticle-img--illum"
        src={src}
        alt=""
        draggable={false}
        width={layerDef.nativeWidth}
        height={layerDef.nativeHeight}
        style={{
          ...layerStyle,
          opacity,
          filter: colorFilter,
          ...(clip ? { clipPath: clip } : null),
          ...maskStyle,
          ...extraMask,
        }}
      />
    );
  }

  return (
    <div
      className="scope-reticle scope-reticle--image"
      aria-hidden
      style={wrapperCropClip ? { clipPath: wrapperCropClip } : undefined}
    >
      {/* Outer / base layer (full disk or ring with hole). */}
      {!soloHi ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="scope-reticle-img"
          src={def.src}
          alt=""
          draggable={false}
          width={def.nativeWidth}
          height={def.nativeHeight}
          style={imgStyle}
        />
      ) : null}
      {!soloHi && i > 0.01
        ? illumClips.length > 0
          ? illumClips.map((clip, idx) =>
              illumOverlay(
                def.src,
                def,
                optical,
                scale,
                imgStyle,
                clip,
                `illum-${idx}`,
                i,
                baseCropMask,
              ),
            )
          : illumOverlay(
              def.src,
              def,
              optical,
              scale,
              imgStyle,
              undefined,
              "illum-whole",
              i,
              baseCropMask,
            )
        : null}

      {/* Inner / hi-res layer — disk in the hole (or fade overlay). */}
      {hiLayer ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="scope-reticle-img scope-reticle-img--hires"
          src={hiLayer.def.src}
          alt=""
          draggable={false}
          width={hiLayer.def.nativeWidth}
          height={hiLayer.def.nativeHeight}
          style={hiLayer.style}
        />
      ) : null}
      {i > 0.01 && hiLayer && hiOpacity > 0.01
        ? (hiLayer.illumClips.length > 0
            ? hiLayer.illumClips
            : [undefined]
          ).map((clip, idx) =>
            illumOverlay(
              hiLayer!.def.src,
              hiLayer!.def,
              hiLayer!.optical,
              hiLayer!.scale,
              hiLayer!.style,
              clip ?? hiLayer!.diskClip,
              `illum-hi-${idx}`,
              i * hiOpacity,
              null,
            ),
          )
        : null}
    </div>
  );
}
