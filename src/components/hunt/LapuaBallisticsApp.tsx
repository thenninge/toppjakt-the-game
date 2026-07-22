"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { AmmoSpec } from "@/lib/ammo/spec";
import {
  densityRatioFromTempC,
  exactBallisticHold,
  formatWindClockFacing,
} from "@/lib/ballistics/solver";
import {
  muzzleVelocityAtPowderTempC,
  powderTempDvDtMpsPerC,
  POWDER_TEMP_REFERENCE_C,
} from "@/lib/ballistics/powderTemp";
import { crosswindMs, MAX_WIND_SPEED_MS } from "@/lib/weather/spec";

type LapuaBallisticsAppProps = {
  ammo: Pick<AmmoSpec, "v0" | "bc" | "bcModel" | "caliber">;
  ammoLabel: string;
  /** Suggested starting range (LRF / Aware). */
  initialRangeM: number;
  /** Live wind — prefill only; player dials the app. */
  liveWindSpeedMs: number;
  liveWindFromDeg: number;
  /** Live air / powder temp — prefill only; player must dial Temp. */
  liveTemperatureC: number;
  shotBearingDeg: number;
};

const RANGE_VALUES = Array.from({ length: 41 }, (_, i) => 50 + i * 10); // 50–450
/** Match hunt wind band — birds rarely sit above ~5 m/s. */
const WIND_VALUES = Array.from(
  { length: MAX_WIND_SPEED_MS + 1 },
  (_, i) => i,
); // 0–5 m/s
const TEMP_MIN_C = -25;
const TEMP_MAX_C = 30;
/** Cosmetic incline wheel only — not used in game ballistics. */
const ANGLE_VALUES = [-15, -10, -5, 0, 5, 10, 15];
/** Snap wind arrow to Lapua-style half-hour clock faces (45°). */
const WIND_SNAP_DEG = 45;

function snapTo(values: number[], n: number): number {
  return values.reduce((best, v) =>
    Math.abs(v - n) < Math.abs(best - n) ? v : best,
  );
}

function clampTempC(n: number): number {
  const t = Math.round(Number.isFinite(n) ? n : POWDER_TEMP_REFERENCE_C);
  return Math.min(TEMP_MAX_C, Math.max(TEMP_MIN_C, t));
}

/** Relative wind-from vs shot: 0° = 12 o'clock (headwind), clockwise. */
function relativeWindDeg(windFromDeg: number, shotBearingDeg: number): number {
  return ((windFromDeg - shotBearingDeg) % 360 + 360) % 360;
}

function snapWindRelDeg(deg: number): number {
  const n = ((Math.round(deg / WIND_SNAP_DEG) * WIND_SNAP_DEG) % 360 + 360) % 360;
  return n;
}

/** Pointer angle: 0 at top, clockwise (matches clock face). */
function pointerAngleDeg(
  el: HTMLElement,
  clientX: number,
  clientY: number,
): number {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const rad = Math.atan2(clientX - cx, cy - clientY);
  let deg = (rad * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function WheelColumn({
  label,
  unit,
  values,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  values: number[];
  value: number;
  onChange: (n: number) => void;
}) {
  const idx = Math.max(0, values.indexOf(value));
  const window = [-2, -1, 0, 1, 2].map((d) => {
    const i = idx + d;
    if (i < 0 || i >= values.length) return null;
    return { d, v: values[i]! };
  });

  return (
    <div className="lapua-wheel">
      <span className="lapua-wheel-label">
        {label}
        <small>{unit}</small>
      </span>
      <div className="lapua-wheel-track" role="listbox" aria-label={label}>
        {window.map((row, slot) =>
          row == null ? (
            <span key={`pad-${label}-${slot}`} className="lapua-wheel-item is-empty" />
          ) : (
            <button
              key={`${label}-${row.v}`}
              type="button"
              role="option"
              aria-selected={row.d === 0}
              className={
                row.d === 0
                  ? "lapua-wheel-item is-selected"
                  : "lapua-wheel-item"
              }
              onClick={() => onChange(row.v)}
            >
              {row.v}
            </button>
          ),
        )}
      </div>
      <div className="lapua-wheel-nudge">
        <button
          type="button"
          className="lapua-nudge"
          disabled={idx <= 0}
          onClick={() => onChange(values[idx - 1]!)}
          aria-label={`${label} ned`}
        >
          ▲
        </button>
        <button
          type="button"
          className="lapua-nudge"
          disabled={idx >= values.length - 1}
          onClick={() => onChange(values[idx + 1]!)}
          aria-label={`${label} opp`}
        >
          ▼
        </button>
      </div>
    </div>
  );
}

/** Compact temp dial bottom-right of the circle. */
function TempStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="lapua-temp-stepper" aria-label="Temperatur (krut)">
      <span className="lapua-temp-label">Temp</span>
      <div className="lapua-temp-controls">
        <button
          type="button"
          className="lapua-temp-btn"
          disabled={value >= TEMP_MAX_C}
          onClick={() => onChange(clampTempC(value + 1))}
          aria-label="Temp opp"
        >
          ▲
        </button>
        <span className="lapua-temp-value" aria-live="polite">
          {value}
          <small>°C</small>
        </span>
        <button
          type="button"
          className="lapua-temp-btn"
          disabled={value <= TEMP_MIN_C}
          onClick={() => onChange(clampTempC(value - 1))}
          aria-label="Temp ned"
        >
          ▼
        </button>
      </div>
    </div>
  );
}

/**
 * Phone-style ballistics app (Lapua-inspired):
 * dial range + wind speed + powder temp; wind dir = red arrow on ring.
 */
export function LapuaBallisticsApp({
  ammo,
  ammoLabel,
  initialRangeM,
  liveWindSpeedMs,
  liveWindFromDeg,
  liveTemperatureC,
  shotBearingDeg,
}: LapuaBallisticsAppProps) {
  const dialRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const [rangeM, setRangeM] = useState(() =>
    snapTo(RANGE_VALUES, Math.round(initialRangeM)),
  );
  const [windSpeed, setWindSpeed] = useState(() =>
    snapTo(WIND_VALUES, Math.round(liveWindSpeedMs)),
  );
  const [tempC, setTempC] = useState(() => clampTempC(liveTemperatureC));
  /** Cosmetic only — incline wheel, not used for hold. */
  const [angleDeg, setAngleDeg] = useState(0);
  const [windRelDeg, setWindRelDeg] = useState(() =>
    snapWindRelDeg(relativeWindDeg(liveWindFromDeg, shotBearingDeg)),
  );

  const windFromDeg =
    ((shotBearingDeg + windRelDeg) % 360 + 360) % 360;

  const hold = useMemo(() => {
    const cw = crosswindMs(windSpeed, windFromDeg, shotBearingDeg);
    return exactBallisticHold(ammo, Math.max(50, rangeM), cw, {
      densityRatio: densityRatioFromTempC(tempC),
      powderTempC: tempC,
    });
  }, [ammo, rangeM, windSpeed, windFromDeg, shotBearingDeg, tempC]);

  const v0AtTemp = muzzleVelocityAtPowderTempC(ammo.v0, tempC, ammo.caliber);
  const dvdt = powderTempDvDtMpsPerC(ammo.caliber);
  const windClock = formatWindClockFacing(windFromDeg, shotBearingDeg);

  const elevMrad = Math.abs(hold.elevationClicks) / 10;
  const windMrad = Math.abs(hold.windageClicks) / 10;
  const elevDir =
    Math.abs(hold.elevationClicks) < 0.05
      ? "—"
      : hold.elevationClicks < 0
        ? "UP"
        : "DOWN";
  const windDir =
    Math.abs(hold.windageClicks) < 0.05
      ? "—"
      : hold.windageClicks < 0
        ? "LEFT"
        : "RIGHT";

  const elevClicks = Math.round(Math.abs(hold.elevationClicks));
  const windClicks = Math.round(Math.abs(hold.windageClicks));

  const setWindFromPointer = useCallback((clientX: number, clientY: number) => {
    const el = dialRef.current;
    if (!el) return;
    setWindRelDeg(snapWindRelDeg(pointerAngleDeg(el, clientX, clientY)));
  }, []);

  const onArrowPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setWindFromPointer(e.clientX, e.clientY);
  };

  const onArrowPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    setWindFromPointer(e.clientX, e.clientY);
  };

  const onArrowPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  /** Click/drag on the ring rim (not the wheels) to place the arrow. */
  const onDialPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".lapua-wheels")) return;
    e.preventDefault();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setWindFromPointer(e.clientX, e.clientY);
  };

  const onDialPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    setWindFromPointer(e.clientX, e.clientY);
  };

  const onDialPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div className="lapua-app" aria-label="Ballistics-app">
      <header className="lapua-app-header">
        <span className="lapua-app-brand">Ballistics</span>
        <span className="lapua-app-ammo" title={ammoLabel}>
          {ammoLabel}
        </span>
      </header>

      <div className="lapua-dial-wrap">
        <div
          className="lapua-wind-clock"
          title="Relativ vindretning (klokke)"
        >
          <span className="lapua-wind-clock-value">{windClock}</span>
          <span className="lapua-wind-clock-label">Vindretning</span>
        </div>

        <div
          ref={dialRef}
          className="lapua-app-inputs"
          onPointerDown={onDialPointerDown}
          onPointerMove={onDialPointerMove}
          onPointerUp={onDialPointerUp}
          onPointerCancel={onDialPointerUp}
          role="slider"
          aria-label="Vindretning rundt sirkelen"
          aria-valuemin={0}
          aria-valuemax={360}
          aria-valuenow={windRelDeg}
          aria-valuetext={`${windClock} (${Math.round(windRelDeg)}°)`}
          tabIndex={0}
        >
          <span className="lapua-shot-marker" title="Skyteretning (12)" aria-hidden>
            ⌖
          </span>

          <div
            className="lapua-wind-arrow"
            style={{ transform: `rotate(${windRelDeg}deg)` }}
            aria-hidden
          >
            <button
              type="button"
              className="lapua-wind-arrow-grip"
              aria-label={`Dra vindpil — ${windClock}`}
              onPointerDown={onArrowPointerDown}
              onPointerMove={onArrowPointerMove}
              onPointerUp={onArrowPointerUp}
              onPointerCancel={onArrowPointerUp}
            />
          </div>

          <div
            className="lapua-wheels"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <WheelColumn
              label="Avstand"
              unit="m"
              values={RANGE_VALUES}
              value={rangeM}
              onChange={setRangeM}
            />
            <WheelColumn
              label="Vind"
              unit="m/s"
              values={WIND_VALUES}
              value={windSpeed}
              onChange={setWindSpeed}
            />
            <WheelColumn
              label="Vinkel"
              unit="deg"
              values={ANGLE_VALUES}
              value={angleDeg}
              onChange={setAngleDeg}
            />
          </div>
        </div>

        <TempStepper value={tempC} onChange={setTempC} />
      </div>

      <div className="lapua-app-results">
        <div className="lapua-result lapua-result-elev">
          <span className="lapua-result-value">
            {elevMrad < 0.05 ? "0" : elevMrad.toFixed(1)}{" "}
            <small>mrad</small>
          </span>
          <span
            className={
              elevDir === "UP"
                ? "lapua-result-dir is-up"
                : elevDir === "DOWN"
                  ? "lapua-result-dir is-down"
                  : "lapua-result-dir"
            }
          >
            {elevDir}
          </span>
          <span className="lapua-result-clicks">
            {elevClicks === 0 ? "0 klikk" : `${elevClicks} klikk`}
          </span>
        </div>
        <div className="lapua-result lapua-result-wind">
          <span className="lapua-result-value">
            {windMrad < 0.05 ? "0" : windMrad.toFixed(1)}{" "}
            <small>mrad</small>
          </span>
          <span
            className={
              windDir === "LEFT"
                ? "lapua-result-dir is-left"
                : windDir === "RIGHT"
                  ? "lapua-result-dir is-right"
                  : "lapua-result-dir"
            }
          >
            {windDir}
          </span>
          <span className="lapua-result-clicks">
            {windClicks === 0 ? "0 klikk" : `${windClicks} klikk`}
          </span>
        </div>
      </div>

      <p className="lapua-app-meta">
        v0 {Math.round(v0AtTemp)} m/s @ {tempC}°C · dV/dT {dvdt} m/s/°C · ref{" "}
        {POWDER_TEMP_REFERENCE_C}°C = {ammo.v0} m/s
      </p>

      <p className="lapua-app-hint">
        Dra rød pil rundt sirkelen = vindretning · Temp nede til høyre · Vinkel
        (deg) er kun UI.
      </p>
    </div>
  );
}
