"use client";

import type { ScopeSpec } from "@/lib/optics/spec";
import {
  getReticleDef,
  reticleDisplaySizePx,
  reticleOpticalCenter,
  resolveReticleForZoom,
} from "@/lib/range/reticles";

type ScopeReticleProps = {
  scope: ScopeSpec;
  zoom: number;
  /** Target world scale (`scopeImageScale`). */
  imgScale: number;
};

function GenericReticle() {
  return (
    <div className="scope-reticle" aria-hidden>
      <span className="scope-reticle-h" />
      <span className="scope-reticle-v" />
      <span className="scope-reticle-dot" />
    </div>
  );
}

export function ScopeReticle({ scope, zoom, imgScale }: ScopeReticleProps) {
  const base = getReticleDef(scope.reticleId);
  if (!base) {
    return <GenericReticle />;
  }

  const def = resolveReticleForZoom(base, zoom, scope.maxZoom);
  const { width, height, scale } = reticleDisplaySizePx(
    scope,
    zoom,
    imgScale,
    def,
  );
  const optical = reticleOpticalCenter(def);
  const rot = def.imageRotationDeg ?? 0;

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
        style={{
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
        }}
      />
    </div>
  );
}
