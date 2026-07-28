"use client";

import type { CSSProperties } from "react";
import type { ScopeSpec } from "@/lib/optics/spec";
import {
  getReticleDef,
  reticleDisplaySizePx,
  reticleOpticalCenter,
  resolveReticleForZoom,
  type ReticleDef,
} from "@/lib/range/reticles";

type ScopeReticleProps = {
  scope: ScopeSpec;
  zoom: number;
  /** Optic zoom scale (`opticReticleImgScale` / `scopeImageScale` @ 100 m). */
  imgScale: number;
  /**
   * Reticle illumination 0–1.
   * 0 = black etched, 1 = full red. Whole reticle for now —
   * later we can mask which strokes light up.
   */
  illumination?: number;
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
};

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

/** Maps black PNG pixels toward illuminated red. */
const ILLUM_RED_FILTER =
  "brightness(0) saturate(100%) invert(18%) sepia(98%) saturate(6500%) hue-rotate(350deg) brightness(1.05)";

function GenericReticle({ illumination = 0 }: { illumination?: number }) {
  const i = clamp01(illumination);
  const r = Math.round(17 + (220 - 17) * i);
  const g = Math.round(17 + (36 - 17) * i);
  const b = Math.round(17 + (36 - 17) * i);
  const color = `rgb(${r}, ${g}, ${b})`;
  return (
    <div className="scope-reticle" aria-hidden>
      <span className="scope-reticle-h" style={{ background: color }} />
      <span className="scope-reticle-v" style={{ background: color }} />
      <span className="scope-reticle-dot" style={{ background: color }} />
    </div>
  );
}

export function ScopeReticle({
  scope,
  zoom,
  imgScale,
  illumination = 0,
  rotationDeg,
  opticalCenterPx,
  centerTo1MilPx,
}: ScopeReticleProps) {
  const base = getReticleDef(scope.reticleId);
  if (!base) {
    return <GenericReticle illumination={illumination} />;
  }

  const resolved = resolveReticleForZoom(base, zoom, scope.maxZoom);
  const def: ReticleDef =
    centerTo1MilPx != null &&
    Number.isFinite(centerTo1MilPx) &&
    centerTo1MilPx > 0
      ? { ...resolved, centerTo1MilPx }
      : resolved;
  const { width, height, scale } = reticleDisplaySizePx(
    scope,
    zoom,
    imgScale,
    def,
  );
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

  const imgStyle: CSSProperties = {
    width: `${width}px`,
    height: `${height}px`,
    // Pin optical crosshair (not image midpoint) to POA.
    marginLeft: `${-optical.x * scale}px`,
    marginTop: `${-optical.y * scale}px`,
    ...(rot !== 0
      ? {
          transform: `rotate(${rot}deg)`,
          transformOrigin: `${optical.x * scale}px ${optical.y * scale}px`,
        }
      : null),
  };

  return (
    <div className="scope-reticle scope-reticle--image" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="scope-reticle-img"
        src={def.src}
        alt=""
        draggable={false}
        width={def.nativeWidth}
        height={def.nativeHeight}
        style={imgStyle}
      />
      {i > 0.01 ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="scope-reticle-img scope-reticle-img--illum"
          src={def.src}
          alt=""
          draggable={false}
          width={def.nativeWidth}
          height={def.nativeHeight}
          style={{
            ...imgStyle,
            opacity: i,
            filter: ILLUM_RED_FILTER,
          }}
        />
      ) : null}
    </div>
  );
}
