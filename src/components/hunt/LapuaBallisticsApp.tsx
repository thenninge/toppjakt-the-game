"use client";

import {
  useCallback,
  useEffect,
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
import {
  dropMmToDialYMmAt100,
} from "@/lib/ballistics/holdHint";
import {
  interpolateRealDropCm,
  type RealLoadProfile,
} from "@/lib/ballistics/realLoad";
import {
  EditableRangeMeters,
  APP_RANGE_MAX_M,
  APP_RANGE_MIN_M,
} from "@/components/hunt/EditableRangeMeters";
import {
  clampLapuaRangeM,
  hasLapuaAppSettings,
  LAPUA_RANGE_MAX_M,
  LAPUA_RANGE_MIN_M,
  LAPUA_RANGE_STEP_M,
  loadLapuaAppSettings,
  saveLapuaAppSettings,
} from "@/lib/hunt/lapuaAppSettings";
import { ZERO_CLICK_MM } from "@/lib/player";
import { crosswindMs, MAX_WIND_SPEED_MS } from "@/lib/weather/spec";
import {
  clickUnitSuffix,
  mmAt100ToAngular,
  mmAt100ToScopeClicks,
} from "@/lib/optics/clicks";
import type { ScopeClickUnit } from "@/lib/optics/spec";

type LapuaBallisticsAppProps = {
  ammo: Pick<AmmoSpec, "v0" | "bc" | "bcModel" | "caliber">;
  ammoLabel: string;
  /** Suggested starting range (LRF / Aware). */
  initialRangeM: number;
  /** Live wind — used only when {@link autoPrefill} (Kestrel / Zeiss LRF). */
  liveWindSpeedMs: number;
  liveWindFromDeg: number;
  /** Live air / powder temp — used only when {@link autoPrefill}. */
  liveTemperatureC: number;
  shotBearingDeg: number;
  /**
   * When true (Kestrel or Zeiss Victory RF), dials start from live range/wind/temp
   * so elev/wind clicks match onboard LRF / Enviro.
   */
  autoPrefill?: boolean;
  /**
   * When true, a new LRF/Aware range ({@link initialRangeM}) overwrites the
   * range dial (same pattern as Sig BDX).
   */
  syncRangeFromLrf?: boolean;
  /** Optional brand line under header (e.g. Zeiss Victory RF). */
  subtitle?: string;
  /** Equipped scope click unit — MOA scopes show ¼-MOA clicks. */
  clickUnit?: ScopeClickUnit;
  /**
   * CB Real drop table — when filled, elevation matches the same table
   * that drives range impacts (physics windage still from dials).
   */
  realDropTable?: RealLoadProfile | null;
};

const RANGE_VALUES = Array.from(
  {
    length:
      Math.floor((LAPUA_RANGE_MAX_M - LAPUA_RANGE_MIN_M) / LAPUA_RANGE_STEP_M) +
      1,
  },
  (_, i) => LAPUA_RANGE_MIN_M + i * LAPUA_RANGE_STEP_M,
); // 50–1000 m
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

function nearestIndex(values: number[], value: number): number {
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (Math.abs(values[i]! - value) < Math.abs(values[best]! - value)) {
      best = i;
    }
  }
  return best;
}

function WheelColumn({
  label,
  unit,
  values,
  value,
  onChange,
  allowTypeIn = false,
}: {
  label: string;
  unit: string;
  values: number[];
  value: number;
  onChange: (n: number) => void;
  /** Selected value can be tapped to type a number (range dial). */
  allowTypeIn?: boolean;
}) {
  const idx = nearestIndex(values, value);
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
          ) : row.d === 0 && allowTypeIn ? (
            <EditableRangeMeters
              key={`${label}-edit`}
              valueM={value}
              onChange={(m) => onChange(clampLapuaRangeM(m))}
              minM={APP_RANGE_MIN_M}
              maxM={APP_RANGE_MAX_M}
              decimals={0}
              className="lapua-wheel-item is-selected lapua-wheel-range-edit"
              inputClassName="app-range-input lapua-range-input"
              ariaLabel={`${label} — trykk for å taste inn`}
            />
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
          disabled={idx >= values.length - 1}
          onClick={() => onChange(values[idx + 1]!)}
          aria-label={`${label} opp`}
        >
          ▲
        </button>
        <button
          type="button"
          className="lapua-nudge"
          disabled={idx <= 0}
          onClick={() => onChange(values[idx - 1]!)}
          aria-label={`${label} ned`}
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
  autoPrefill = false,
  syncRangeFromLrf = false,
  subtitle,
  clickUnit = "MRAD",
  realDropTable = null,
}: LapuaBallisticsAppProps) {
  const dialRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const lastLrfRangeRef = useRef(clampLapuaRangeM(Math.round(initialRangeM)));

  const [rangeM, setRangeM] = useState(() => {
    if (autoPrefill || syncRangeFromLrf) {
      return clampLapuaRangeM(Math.round(initialRangeM));
    }
    if (hasLapuaAppSettings()) {
      return clampLapuaRangeM(loadLapuaAppSettings().rangeM);
    }
    return clampLapuaRangeM(200);
  });
  const [windSpeed, setWindSpeed] = useState(() =>
    autoPrefill
      ? snapTo(WIND_VALUES, Math.round(liveWindSpeedMs))
      : 0,
  );
  const [tempC, setTempC] = useState(() =>
    autoPrefill
      ? clampTempC(liveTemperatureC)
      : 0,
  );
  /** Cosmetic only — incline wheel, not used for hold. */
  const [angleDeg, setAngleDeg] = useState(0);
  const [windRelDeg, setWindRelDeg] = useState(() =>
    autoPrefill
      ? snapWindRelDeg(relativeWindDeg(liveWindFromDeg, shotBearingDeg))
      : 0,
  );

  useEffect(() => {
    saveLapuaAppSettings({ rangeM });
  }, [rangeM]);

  /** New LRF reading → update range dial (Zeiss / range sync). */
  useEffect(() => {
    if (!syncRangeFromLrf && !autoPrefill) return;
    const next = clampLapuaRangeM(Math.round(initialRangeM));
    if (next === lastLrfRangeRef.current) return;
    lastLrfRangeRef.current = next;
    setRangeM(next);
  }, [initialRangeM, syncRangeFromLrf, autoPrefill]);

  const windFromDeg =
    ((shotBearingDeg + windRelDeg) % 360 + 360) % 360;

  const hold = useMemo(() => {
    const cw = crosswindMs(windSpeed, windFromDeg, shotBearingDeg);
    const physics = exactBallisticHold(ammo, Math.max(50, rangeM), cw, {
      densityRatio: densityRatioFromTempC(tempC),
      powderTempC: tempC,
    });
    // CB Real table drives range paper — keep elev klikk on the same numbers.
    if (realDropTable) {
      const tableCm = interpolateRealDropCm(realDropTable, rangeM);
      if (tableCm != null) {
        const dropMm = tableCm * 10;
        const dialYMmAt100 = dropMmToDialYMmAt100(dropMm, rangeM);
        return {
          ...physics,
          dropMm,
          dialYMmAt100,
          elevationClicks: dialYMmAt100 / ZERO_CLICK_MM,
        };
      }
    }
    return physics;
  }, [
    ammo,
    rangeM,
    windSpeed,
    windFromDeg,
    shotBearingDeg,
    tempC,
    realDropTable,
  ]);

  const v0AtTemp = muzzleVelocityAtPowderTempC(ammo.v0, tempC, ammo.caliber);
  const dvdt = powderTempDvDtMpsPerC(ammo.caliber);
  const windClock = formatWindClockFacing(windFromDeg, shotBearingDeg);

  const elevAng = mmAt100ToAngular(hold.dialYMmAt100, clickUnit);
  const windAng = mmAt100ToAngular(hold.dialXMmAt100, clickUnit);
  const unitSuffix = clickUnitSuffix(clickUnit);
  const elevDir =
    Math.abs(hold.dialYMmAt100) < 0.05
      ? "—"
      : hold.dialYMmAt100 < 0
        ? "UP"
        : "DOWN";
  const windDir =
    Math.abs(hold.dialXMmAt100) < 0.05
      ? "—"
      : hold.dialXMmAt100 < 0
        ? "LEFT"
        : "RIGHT";

  const elevClicks = Math.abs(mmAt100ToScopeClicks(hold.dialYMmAt100, clickUnit));
  const windClicks = Math.abs(mmAt100ToScopeClicks(hold.dialXMmAt100, clickUnit));
  const angDigits = clickUnit === "MOA" ? 2 : 1;

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
        {subtitle ? (
          <span className="lapua-app-subtitle">{subtitle}</span>
        ) : null}
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
              allowTypeIn
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
            {elevAng < 0.05 ? "0" : elevAng.toFixed(angDigits)}{" "}
            <small>{unitSuffix}</small>
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
            {windAng < 0.05 ? "0" : windAng.toFixed(angDigits)}{" "}
            <small>{unitSuffix}</small>
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
        {autoPrefill
          ? syncRangeFromLrf
            ? `Zeiss/LRF-prefill · range oppdateres fra LRF. Samme ${unitSuffix}-klikk som LRF-displayet når vind/temp matcher.`
            : `Kestrel-prefill · juster ved behov, dial tårnene etter ${unitSuffix}.`
          : realDropTable
            ? `Ingen Kestrel-prefill — still Range/Wind/Temp. Elev følger CB Real drop-tabell (samme som treff); vind fra dialene.`
            : `Ingen auto-data — still Range + Wind + Temp selv (kopier Enviro), deretter dial tårnene (${unitSuffix}).`}
      </p>
    </div>
  );
}
