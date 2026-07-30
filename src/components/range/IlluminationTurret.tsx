"use client";

import {
  useId,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  reticleIllumColorHex,
  type ReticleIllumColor,
} from "@/lib/optics/spec";

/** Full OFF→ON travel in px (stepless). Bipolar uses 2× this for −1…+1. */
const ILLUM_TRAVEL_PX = 220;

type IlluminationTurretProps = {
  /**
   * Unipolar: 0…1 (off→full).
   * Bipolar (red+green): −1…+1 (full green ↔ off ↔ full red).
   */
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /**
   * When true, drum travels both ways: up = red, down = green.
   * Sun icons are tinted to match.
   */
  bipolar?: boolean;
};

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v));
}

function clampSigned(v: number) {
  return Math.min(1, Math.max(-1, v));
}

function IllumSunIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle cx="12" cy="12" r="3.6" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="1.4" x2="12" y2="4.8" />
        <line x1="12" y1="19.2" x2="12" y2="22.6" />
        <line x1="1.4" y1="12" x2="4.8" y2="12" />
        <line x1="19.2" y1="12" x2="22.6" y2="12" />
        <line x1="4.4" y1="4.4" x2="6.9" y2="6.9" />
        <line x1="17.1" y1="17.1" x2="19.6" y2="19.6" />
        <line x1="4.4" y1="19.6" x2="6.9" y2="17.1" />
        <line x1="17.1" y1="6.9" x2="19.6" y2="4.4" />
      </g>
    </svg>
  );
}

/** Half-sun for 50% — left half disk + rays on the lit side. */
function IllumHalfSunIcon({
  size = 13,
  clipId,
}: {
  size?: number;
  clipId: string;
}) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width="12" height="24" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <circle cx="12" cy="12" r="3.4" fill="currentColor" />
      </g>
      <line
        x1="12"
        y1="8.6"
        x2="12"
        y2="15.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <line x1="12" y1="1.6" x2="12" y2="4.8" />
        <line x1="12" y1="19.2" x2="12" y2="22.4" />
        <line x1="1.6" y1="12" x2="4.8" y2="12" />
        <line x1="4.5" y1="4.5" x2="6.9" y2="6.9" />
        <line x1="4.5" y1="19.5" x2="6.9" y2="17.1" />
      </g>
    </svg>
  );
}

function sunStyle(color: ReticleIllumColor, strong: boolean): CSSProperties {
  const hex = reticleIllumColorHex(color);
  return {
    color: hex,
    filter: strong
      ? `drop-shadow(0 0 3px ${hex}aa) drop-shadow(0 1px 1px rgba(0,0,0,0.9))`
      : `drop-shadow(0 1px 1px rgba(0,0,0,0.85))`,
    opacity: strong ? 1 : 0.92,
  };
}

/**
 * Compact outer illumination tower — sits left of the parallax knurl
 * (ZCO-style). Unipolar: stepless 0→1 black→colour. Bipolar: −1 green ↔
 * 0 ↔ +1 red; sun icons tinted to match.
 */
export function IlluminationTurret({
  value,
  onChange,
  disabled = false,
  bipolar = false,
}: IlluminationTurretProps) {
  const t = bipolar ? clampSigned(value) : clamp01(value);
  const halfClipId = useId().replace(/:/g, "");
  const halfClipIdGreen = `${halfClipId}-g`;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const faceRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    startT: number;
  } | null>(null);

  function endDrag(el?: HTMLDivElement | null, pointerId?: number) {
    const drag = dragRef.current;
    if (!drag) return;
    if (pointerId != null && drag.pointerId !== pointerId) return;
    dragRef.current = null;
    const target = el ?? faceRef.current;
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
      startT: t,
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
    /* Drag up → higher T (red / brighter). Drag down → lower T (green when bipolar). */
    const nextT = bipolar
      ? clampSigned(drag.startT - delta / ILLUM_TRAVEL_PX)
      : clamp01(drag.startT - delta / ILLUM_TRAVEL_PX);
    onChangeRef.current(nextT);
  }

  const markOffY = (0 - t) * ILLUM_TRAVEL_PX;
  const markHalfY = (0.5 - t) * ILLUM_TRAVEL_PX;
  const markMaxY = (1 - t) * ILLUM_TRAVEL_PX;
  const markHalfGreenY = (-0.5 - t) * ILLUM_TRAVEL_PX;
  const markMaxGreenY = (-1 - t) * ILLUM_TRAVEL_PX;

  const title =
    Math.abs(t) < 0.02
      ? "Illumination OFF"
      : bipolar
        ? t > 0
          ? `Illumination red ${(t * 100).toFixed(0)}%`
          : `Illumination green ${((-t) * 100).toFixed(0)}%`
        : `Illumination ${(t * 100).toFixed(0)}%`;

  return (
    <div
      className={
        disabled
          ? "scope-turret scope-turret--illum scope-turret--compact is-disabled"
          : bipolar
            ? "scope-turret scope-turret--illum scope-turret--compact scope-turret--illum-bipolar"
            : "scope-turret scope-turret--illum scope-turret--compact"
      }
      aria-label="Reticle illumination"
      style={
        {
          ["--illum-t" as string]: String(t),
        } as CSSProperties
      }
    >
      <div
        className="scope-turret-shooter scope-turret-shooter--vertical illum-drum"
        aria-hidden
      >
        <div className="illum-drum-main">
          <div
            ref={faceRef}
            className="illum-drum-face"
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
            title={title}
          >
            <span className="illum-drum-knurl" />
            <span className="illum-drum-shade illum-drum-shade--a" />
            <span className="illum-drum-shade illum-drum-shade--b" />
            <div className="illum-drum-band">
              {bipolar ? (
                <>
                  <div
                    className="illum-drum-mark illum-drum-mark--max-green"
                    style={{
                      transform: `translateY(calc(-50% + ${markMaxGreenY}px))`,
                    }}
                  >
                    <span
                      className="illum-drum-sun illum-drum-sun--max"
                      style={sunStyle("green", true)}
                    >
                      <IllumSunIcon size={15} />
                    </span>
                  </div>
                  <div
                    className="illum-drum-mark illum-drum-mark--half-green"
                    style={{
                      transform: `translateY(calc(-50% + ${markHalfGreenY}px))`,
                    }}
                  >
                    <span
                      className="illum-drum-sun illum-drum-sun--half"
                      style={sunStyle("green", false)}
                    >
                      <IllumHalfSunIcon clipId={`illum-half-${halfClipIdGreen}`} />
                    </span>
                  </div>
                </>
              ) : null}
              <div
                className="illum-drum-mark illum-drum-mark--off"
                style={{
                  transform: `translateY(calc(-50% + ${markOffY}px))`,
                }}
              >
                <span className="illum-drum-num">0</span>
              </div>
              <div
                className="illum-drum-mark illum-drum-mark--half"
                style={{
                  transform: `translateY(calc(-50% + ${markHalfY}px))`,
                }}
              >
                <span
                  className="illum-drum-sun illum-drum-sun--half"
                  style={sunStyle("red", false)}
                >
                  <IllumHalfSunIcon clipId={`illum-half-${halfClipId}`} />
                </span>
              </div>
              <div
                className="illum-drum-mark illum-drum-mark--max"
                style={{
                  transform: `translateY(calc(-50% + ${markMaxY}px))`,
                }}
              >
                <span
                  className="illum-drum-sun illum-drum-sun--max"
                  style={sunStyle("red", true)}
                >
                  <IllumSunIcon size={15} />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
