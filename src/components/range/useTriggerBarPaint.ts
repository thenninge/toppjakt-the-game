"use client";

import { useRef } from "react";

/**
 * Imperative trigger-bar painter.
 * Vertical bar: fills bottom → top as Space is held (fill anchored at bottom).
 */
export function useTriggerBarPaint() {
  const fillRef = useRef<HTMLDivElement>(null);

  function paintTriggerProgress(progress01: number) {
    const el = fillRef.current;
    if (!el) return;
    const p = Math.min(1, Math.max(0, progress01));
    el.style.top = "auto";
    el.style.bottom = "0";
    el.style.height = `${p * 100}%`;
    el.style.transform = "none";
  }

  function resetTriggerProgress() {
    paintTriggerProgress(0);
  }

  return { fillRef, paintTriggerProgress, resetTriggerProgress };
}
