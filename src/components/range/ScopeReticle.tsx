"use client";

import type { ScopeSpec } from "@/lib/optics/spec";
import {
  getReticleDef,
  reticleDisplaySizePx,
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
  const def = getReticleDef(scope.reticleId);
  if (!def) {
    return <GenericReticle />;
  }

  const { width, height } = reticleDisplaySizePx(
    scope,
    zoom,
    imgScale,
    def,
  );

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
          marginLeft: `${-width / 2}px`,
          marginTop: `${-height / 2}px`,
        }}
      />
    </div>
  );
}
