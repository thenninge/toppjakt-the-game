"use client";

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import {
  PARALLAX_MARKS_M,
  parallaxDialIndexFromFocusM,
  parallaxDialIndexFromRailT,
  parallaxFocusFromDialIndex,
  parallaxRailTFromDialIndex,
  parallaxSlotLabel,
} from "@/lib/range/parallaxFocus";

/**
 * Full near→∞ travel in px.
 * Tuned so engraved marks span ~80% of a visual turret turn
 * (was ~40% at 184px against an 11.5rem / 184px drum).
 */
const PARA_TRAVEL_PX = 368;

type ParallaxTurretProps = {
  /** Focus distance in meters; Infinity = ∞. */
  focusM: number;
  onChange: (focusM: number) => void;
  disabled?: boolean;
};

/**
 * Compact parallax drum — scrolls under a fixed index.
 * Index sits on the scope-ring side and points left at the marks (ZCO-style).
 * Hashmarks: 25·30·40·50·100·150·200·300·400·500·600·800·1000·∞
 */
export function ParallaxTurret({
  focusM,
  onChange,
  disabled = false,
}: ParallaxTurretProps) {
  const faceIndex = parallaxDialIndexFromFocusM(focusM);
  const faceT = parallaxRailTFromDialIndex(faceIndex);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const cylinderRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startT: number;
  } | null>(null);

  const slots = PARALLAX_MARKS_M.length + 1;

  function endDrag(el?: HTMLDivElement | null, pointerId?: number) {
    const drag = dragRef.current;
    if (!drag) return;
    if (pointerId != null && drag.pointerId !== pointerId) return;
    dragRef.current = null;
    const target = el ?? cylinderRef.current;
    if (target && target.hasPointerCapture(drag.pointerId)) {
      try {
        target.releasePointerCapture(drag.pointerId);
      } catch {
        /* already released */
      }
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      startT: faceT,
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId || disabled) return;
    if (e.pointerType === "mouse" && e.buttons === 0) {
      endDrag(e.currentTarget, e.pointerId);
      return;
    }
    const delta = e.clientY - drag.startY;
    /* Surface follows finger: drag down → nearer (lower T). */
    const nextT = Math.min(1, Math.max(0, drag.startT - delta / PARA_TRAVEL_PX));
    const nextIdx = parallaxDialIndexFromRailT(nextT);
    onChangeRef.current(parallaxFocusFromDialIndex(nextIdx));
  }

  return (
    <div
      className={
        disabled
          ? "scope-turret scope-turret--parallax scope-turret--compact is-disabled"
          : "scope-turret scope-turret--parallax scope-turret--compact"
      }
      aria-label="Parallax fokus"
    >
      <div
        className="scope-turret-shooter scope-turret-shooter--vertical parallax-drum"
        aria-hidden
      >
        <div className="scope-turret-shooter-main parallax-drum-main">
          <div className="scope-turret-shooter-knurl" />
          <div
            ref={cylinderRef}
            className="scope-turret-shooter-cylinder parallax-drum-cylinder"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => endDrag(e.currentTarget, e.pointerId)}
            onPointerCancel={(e) => endDrag(e.currentTarget, e.pointerId)}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse" && e.buttons === 0) {
                endDrag(e.currentTarget, dragRef.current?.pointerId);
              }
            }}
            onLostPointerCapture={() => endDrag()}
            onContextMenu={(ev) => ev.preventDefault()}
            role="presentation"
          >
            <div className="scope-turret-shooter-shade scope-turret-shooter-shade--a" />
            <div className="scope-turret-shooter-shade scope-turret-shooter-shade--b" />
            <div className="parallax-drum-band">
              {Array.from({ length: slots }, (_, slot) => {
                const t = parallaxRailTFromDialIndex(slot);
                const y = (t - faceT) * PARA_TRAVEL_PX;
                const label = parallaxSlotLabel(slot);
                return (
                  <div
                    key={slot}
                    className="parallax-drum-mark"
                    style={{ transform: `translateY(calc(-50% + ${y}px))` }}
                  >
                    <span className="parallax-drum-num">{label}</span>
                    <span className="parallax-drum-hash" />
                  </div>
                );
              })}
            </div>
          </div>
          {/* Index on scope-ring side, pointing left at the marks. */}
          <div className="scope-turret-shooter-base parallax-index-base">
            <span className="scope-turret-shooter-index parallax-index" />
          </div>
        </div>
      </div>
    </div>
  );
}
