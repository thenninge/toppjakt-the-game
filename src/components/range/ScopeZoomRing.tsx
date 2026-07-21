"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { clampScopeZoom } from "@/lib/range/precision";
import type { ScopeSpec } from "@/lib/optics/spec";

type ScopeZoomRingProps = {
  scope: Pick<ScopeSpec, "minZoom" | "maxZoom">;
  zoom: number;
  onChange: (zoom: number) => void;
  disabled?: boolean;
};

/** Clock hours → degrees from 12 o'clock, clockwise. */
const ARC_START_DEG = 8 * 30; // 240° — lower-left (min zoom)
const ARC_END_DEG = 4 * 30; // 120° — lower-right (max zoom)
/** Clockwise over the top: 8 → 9 → 12 → 3 → 4 (= 240° of arc). */
const ARC_SPAN_DEG = 240;

function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d < 0) d += 360;
  return d;
}

/** Clockwise distance from `from` to `to` in [0, 360). */
function clockwiseDelta(from: number, to: number): number {
  return normalizeDeg(to - from);
}

/** Screen angle from 12 o'clock, clockwise (degrees). */
function pointerClockDeg(
  clientX: number,
  clientY: number,
  cx: number,
  cy: number,
): number {
  const dx = clientX - cx;
  const dy = clientY - cy;
  return normalizeDeg((Math.atan2(dx, -dy) * 180) / Math.PI);
}

/** Clamp to the upper arc 8→12→4 (clockwise). */
function clampToZoomArc(deg: number): number {
  const d = normalizeDeg(deg);
  const fromStart = clockwiseDelta(ARC_START_DEG, d);
  if (fromStart <= ARC_SPAN_DEG) return d;
  // Outside (bottom gap): nearer endpoint wins
  const pastEnd = fromStart - ARC_SPAN_DEG;
  const beforeStart = 360 - fromStart;
  return pastEnd <= beforeStart ? ARC_END_DEG : ARC_START_DEG;
}

function zoomToArcDeg(
  zoom: number,
  minZoom: number,
  maxZoom: number,
): number {
  const span = Math.max(0.01, maxZoom - minZoom);
  const t = Math.min(1, Math.max(0, (zoom - minZoom) / span));
  // t=0 → 8 o'clock, t=1 → 4 o'clock, clockwise over 12
  return normalizeDeg(ARC_START_DEG + t * ARC_SPAN_DEG);
}

function arcDegToZoom(
  deg: number,
  minZoom: number,
  maxZoom: number,
): number {
  const clamped = clampToZoomArc(deg);
  const t = clockwiseDelta(ARC_START_DEG, clamped) / ARC_SPAN_DEG;
  return clampScopeZoom(minZoom + t * (maxZoom - minZoom), {
    minZoom,
    maxZoom,
  });
}

function knobStyle(deg: number): { left: string; top: string } {
  const rad = (deg * Math.PI) / 180;
  // 50% = center; 50% radius puts knob center on the scope rim
  const x = 50 + 50 * Math.sin(rad);
  const y = 50 - 50 * Math.cos(rad);
  return { left: `${x}%`, top: `${y}%` };
}

/**
 * Magnification ring along the upper scope rim (8 → 12 → 4 o'clock),
 * like a real ocular power ring.
 */
export function ScopeZoomRing({
  scope,
  zoom,
  onChange,
  disabled = false,
}: ScopeZoomRingProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);

  const deg = zoomToArcDeg(zoom, scope.minZoom, scope.maxZoom);
  const pos = knobStyle(deg);

  function setFromPointer(clientX: number, clientY: number) {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const clockDeg = pointerClockDeg(clientX, clientY, cx, cy);
    onChange(arcDegToZoom(clockDeg, scope.minZoom, scope.maxZoom));
  }

  function onKnobPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
    setFromPointer(e.clientX, e.clientY);
  }

  function onKnobPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current || disabled) return;
    setFromPointer(e.clientX, e.clientY);
  }

  function endDrag(e: PointerEvent<HTMLButtonElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  useEffect(() => {
    if (!dragging) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        draggingRef.current = false;
        setDragging(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dragging]);

  // Arc track ticks for affordance (optional visual guide)
  const trackSamples = 9;
  const trackDots = Array.from({ length: trackSamples }, (_, i) => {
    const t = i / (trackSamples - 1);
    const d = normalizeDeg(ARC_START_DEG + t * ARC_SPAN_DEG);
    return { key: i, style: knobStyle(d) };
  });

  return (
    <div
      ref={rootRef}
      className={
        disabled ? "scope-zoom-ring is-disabled" : "scope-zoom-ring"
      }
      aria-hidden={disabled}
    >
      <div className="scope-zoom-track" aria-hidden>
        {trackDots.map((dot) => (
          <span
            key={dot.key}
            className="scope-zoom-tick"
            style={dot.style}
          />
        ))}
      </div>
      <button
        type="button"
        className={
          dragging ? "scope-zoom-knob is-dragging" : "scope-zoom-knob"
        }
        style={pos}
        disabled={disabled}
        aria-label={`Zoom ${zoom.toFixed(1)} ganger`}
        aria-valuemin={scope.minZoom}
        aria-valuemax={scope.maxZoom}
        aria-valuenow={Number(zoom.toFixed(1))}
        aria-valuetext={`${zoom.toFixed(1)}×`}
        onPointerDown={onKnobPointerDown}
        onPointerMove={onKnobPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span className="scope-zoom-knob-value">{zoom.toFixed(1)}×</span>
      </button>
    </div>
  );
}
