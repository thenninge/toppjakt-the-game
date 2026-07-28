"use client";

import type { CSSProperties, ReactNode } from "react";

type ScopeFocusZoomProps = {
  /** Content magnification while focus (F) is held. 1 = none. */
  scale: number;
  children: ReactNode;
};

/**
 * Smooth focus-zoom layer for reticle + world (same timing as glass grow).
 * Keep vignette outside so the eye-cup edge does not scale.
 */
export function ScopeFocusZoom({ scale, children }: ScopeFocusZoomProps) {
  const s = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return (
    <div
      className="scope-focus-zoom"
      style={
        {
          ["--focus-zoom-scale" as string]: s,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
