"use client";

import { useRef } from "react";

/**
 * Imperative focus-bar painter.
 * Vertical bar: starts full, empties top → bottom (fill anchored at bottom).
 */
export function useFocusBarPaint() {
  const fillRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  function paintFocusProgress(progress01: number) {
    const el = fillRef.current;
    if (!el) return;
    const p = Math.min(1, Math.max(0, progress01));
    el.style.top = "auto";
    el.style.bottom = "0";
    el.style.height = `${p * 100}%`;
    el.style.transform = "none";
  }

  function setFocusBarFatigued(fatigued: boolean) {
    const bar = barRef.current;
    if (!bar) return;
    bar.classList.toggle("is-fatigued", fatigued);
  }

  function resetFocusProgress() {
    paintFocusProgress(0);
    setFocusBarFatigued(false);
  }

  return {
    focusFillRef: fillRef,
    focusBarRef: barRef,
    paintFocusProgress,
    setFocusBarFatigued,
    resetFocusProgress,
  };
}
