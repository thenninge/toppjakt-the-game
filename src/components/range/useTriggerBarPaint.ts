"use client";

import { useRef } from "react";

/**
 * Imperative trigger-bar painter — avoids React setState every rAF frame
 * (which caused lag/jumps in Hunt shoot mode).
 */
export function useTriggerBarPaint() {
  const fillRef = useRef<HTMLDivElement>(null);

  function paintTriggerProgress(progress01: number) {
    const el = fillRef.current;
    if (!el) return;
    const p = Math.min(1, Math.max(0, progress01));
    el.style.transform = `scaleX(${p})`;
  }

  function resetTriggerProgress() {
    paintTriggerProgress(0);
  }

  return { fillRef, paintTriggerProgress, resetTriggerProgress };
}
