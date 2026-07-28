"use client";

import {
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  bubbleOffsetFromCantDeg,
  CANT_NUDGE_DEG,
  CANT_UI_MAX_DEG,
  clampCantDeg,
  nudgeCantDeg,
} from "@/lib/range/cant";

type UlfBubbleLevelProps = {
  /** Rifle cant (deg). Positive = tip right / clockwise from rear. */
  cantDeg: number;
  onCantChange: (cantDeg: number) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * Ulf-style rail vial — dark housing, blue fluid, air bubble.
 * Drag left/right to tip the rifle; bubble sits opposite the high side.
 */
export function UlfBubbleLevel({
  cantDeg,
  onCantChange,
  disabled = false,
  className,
}: UlfBubbleLevelProps) {
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startCant: number;
  } | null>(null);
  const offset = bubbleOffsetFromCantDeg(cantDeg);
  /*
   * translateX % is relative to the bubble width (~0.78rem). Vial usable
   * width ≈ 4.9rem → max center travel ≈ (4.9 − 0.78) / 2 ≈ 2.06rem ≈ 264%.
   * Use ~255 so the light field reaches the blue ends without hard clipping.
   */
  const bubblePct = offset * 255;

  function endDrag(el: HTMLElement, pointerId: number) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== pointerId) return;
    dragRef.current = null;
    if (el.hasPointerCapture(pointerId)) {
      try {
        el.releasePointerCapture(pointerId);
      } catch {
        /* already released */
      }
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startCant: cantDeg,
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || disabled) return;
    if (e.pointerType === "mouse" && e.buttons === 0) {
      endDrag(e.currentTarget, e.pointerId);
      return;
    }
    const dx = e.clientX - drag.startX;
    /* Drag right → tip rifle right (positive cant). ~40 px ≈ full UI range. */
    const delta = (dx / 40) * CANT_UI_MAX_DEG;
    onCantChange(nudgeCantDeg(drag.startCant, delta));
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    endDrag(e.currentTarget, e.pointerId);
  }

  function tip(dir: -1 | 1) {
    if (disabled) return;
    onCantChange(nudgeCantDeg(cantDeg, dir * CANT_NUDGE_DEG));
  }

  const leveled = Math.abs(clampCantDeg(cantDeg)) < 0.2;

  return (
    <div
      className={
        [
          "bubble-level bubble-level--ulf",
          leveled ? "is-level" : "",
          disabled ? "is-disabled" : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")
      }
      role="slider"
      aria-label="Bubble level — cant"
      aria-valuemin={-CANT_UI_MAX_DEG}
      aria-valuemax={CANT_UI_MAX_DEG}
      aria-valuenow={Math.round(cantDeg * 10) / 10}
      aria-valuetext={
        leveled
          ? "i vater"
          : cantDeg > 0
            ? `tippet ${cantDeg.toFixed(1)}° høyre`
            : `tippet ${Math.abs(cantDeg).toFixed(1)}° venstre`
      }
      aria-disabled={disabled || undefined}
    >
      <button
        type="button"
        className="bubble-level-tip bubble-level-tip--left"
        disabled={disabled}
        aria-label="Tipp våpenet CCW (Q)"
        onClick={() => tip(-1)}
      />
      <div
        className="bubble-level-ulf-rail"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        onContextMenu={(ev) => ev.preventDefault()}
      >
        <div className="bubble-level-ulf-vial">
          <span className="bubble-level-ulf-mark bubble-level-ulf-mark--left" />
          <span className="bubble-level-ulf-mark bubble-level-ulf-mark--right" />
          <span
            className="bubble-level-ulf-bubble"
            style={{ transform: `translateX(${bubblePct}%)` }}
          />
        </div>
      </div>
      <button
        type="button"
        className="bubble-level-tip bubble-level-tip--right"
        disabled={disabled}
        aria-label="Tipp våpenet CW (E)"
        onClick={() => tip(1)}
      />
    </div>
  );
}
