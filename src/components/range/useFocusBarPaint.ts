"use client";

import { useRef } from "react";
import { focusBarFillColor } from "@/lib/range/precision";

/**
 * Imperative focus-bar painter.
 * Vertical bar: starts full, empties top → bottom (fill anchored at bottom).
 * Fill colour follows {@link focusBarFillColor} when elapsedMs is passed.
 */
export function useFocusBarPaint() {
  const fillRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  function paintFocusProgress(progress01: number, elapsedMs?: number) {
    const el = fillRef.current;
    if (!el) return;
    const p = Math.min(1, Math.max(0, progress01));
    el.style.top = "auto";
    el.style.bottom = "0";
    el.style.height = `${p * 100}%`;
    el.style.transform = "none";
    if (elapsedMs != null && elapsedMs >= 0) {
      el.style.background = focusBarFillColor(elapsedMs);
      el.style.opacity = "1";
    } else {
      el.style.removeProperty("background");
      el.style.removeProperty("opacity");
    }
  }

  function resetFocusProgress() {
    paintFocusProgress(0);
  }

  return {
    focusFillRef: fillRef,
    focusBarRef: barRef,
    paintFocusProgress,
    resetFocusProgress,
  };
}
