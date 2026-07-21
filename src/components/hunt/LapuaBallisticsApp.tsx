"use client";

import { useMemo, useState } from "react";
import type { AmmoSpec } from "@/lib/ammo/spec";
import {
  exactBallisticHold,
  formatWindClockFacing,
} from "@/lib/ballistics/solver";
import { crosswindMs } from "@/lib/weather/spec";

type LapuaBallisticsAppProps = {
  ammo: Pick<AmmoSpec, "v0" | "bc" | "bcModel">;
  ammoLabel: string;
  /** Suggested starting range (LRF / Aware). */
  initialRangeM: number;
  /** Live wind — prefill only; player dials the app. */
  liveWindSpeedMs: number;
  liveWindFromDeg: number;
  shotBearingDeg: number;
  densityRatio?: number;
};

const RANGE_VALUES = Array.from({ length: 41 }, (_, i) => 50 + i * 10); // 50–450
const WIND_VALUES = Array.from({ length: 21 }, (_, i) => i); // 0–20 m/s
const ANGLE_VALUES = [-15, -10, -5, 0, 5, 10, 15];
/** Clock faces for wind direction relative to shot (Lapua-style). */
const WIND_CLOCKS = [
  "12:00",
  "1:30",
  "3:00",
  "4:30",
  "6:00",
  "7:30",
  "9:00",
  "10:30",
] as const;

function snapTo(values: number[], n: number): number {
  return values.reduce((best, v) =>
    Math.abs(v - n) < Math.abs(best - n) ? v : best,
  );
}

function clockToRelativeDeg(clock: string): number {
  const [hs, ms] = clock.split(":").map(Number);
  const hours = (hs % 12) + (ms === 30 ? 0.5 : 0);
  return (hours / 12) * 360;
}

function nearestClock(
  windFromDeg: number,
  shotBearingDeg: number,
): (typeof WIND_CLOCKS)[number] {
  const label = formatWindClockFacing(windFromDeg, shotBearingDeg);
  // Map "12:00" / "3:00" style to our set (half-hours only).
  const normalized =
    label.includes(":30") || label.endsWith(":00")
      ? label.replace(/^12:/, "12:")
      : label;
  const match = WIND_CLOCKS.find((c) => c === normalized);
  if (match) return match;
  // Fallback: pick closest by relative angle.
  const rel = ((windFromDeg - shotBearingDeg) % 360 + 360) % 360;
  return WIND_CLOCKS.reduce((best, c) => {
    const d = Math.abs(clockToRelativeDeg(c) - rel);
    const bd = Math.abs(clockToRelativeDeg(best) - rel);
    return d < bd ? c : best;
  });
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

/**
 * Phone-style ballistics app (Lapua-inspired): dial range + wind → elev / windage mrad.
 * Player must set the inputs; solution drives what they dial on the turrets.
 */
export function LapuaBallisticsApp({
  ammo,
  ammoLabel,
  initialRangeM,
  liveWindSpeedMs,
  liveWindFromDeg,
  shotBearingDeg,
  densityRatio = 1,
}: LapuaBallisticsAppProps) {
  const [rangeM, setRangeM] = useState(() =>
    snapTo(RANGE_VALUES, Math.round(initialRangeM)),
  );
  const [windSpeed, setWindSpeed] = useState(() =>
    snapTo(WIND_VALUES, Math.round(liveWindSpeedMs)),
  );
  const [angleDeg, setAngleDeg] = useState(0);
  const [windClock, setWindClock] = useState(() =>
    nearestClock(liveWindFromDeg, shotBearingDeg),
  );

  const windFromDeg =
    ((shotBearingDeg + clockToRelativeDeg(windClock)) % 360 + 360) % 360;

  const hold = useMemo(() => {
    const cw = crosswindMs(windSpeed, windFromDeg, shotBearingDeg);
    // Angle: mild cosine range correction (rifleman's rule-ish).
    const effectiveRange = rangeM * Math.cos((angleDeg * Math.PI) / 180);
    return exactBallisticHold(ammo, Math.max(50, effectiveRange), cw, {
      densityRatio,
    });
  }, [ammo, rangeM, windSpeed, windFromDeg, shotBearingDeg, angleDeg, densityRatio]);

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

  return (
    <div className="lapua-app" aria-label="Ballistics-app">
      <header className="lapua-app-header">
        <span className="lapua-app-brand">Ballistics</span>
        <span className="lapua-app-ammo" title={ammoLabel}>
          {ammoLabel}
        </span>
      </header>

      <div className="lapua-app-inputs">
        <div className="lapua-wind-dir">
          <span className="lapua-wind-dir-label">Wind Direction</span>
          <select
            className="lapua-wind-dir-select"
            value={windClock}
            onChange={(e) =>
              setWindClock(e.target.value as (typeof WIND_CLOCKS)[number])
            }
            aria-label="Vindretning (klokke)"
          >
            {WIND_CLOCKS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="lapua-wheels">
          <WheelColumn
            label="Range"
            unit="m"
            values={RANGE_VALUES}
            value={rangeM}
            onChange={setRangeM}
          />
          <WheelColumn
            label="Wind"
            unit="m/s"
            values={WIND_VALUES}
            value={windSpeed}
            onChange={setWindSpeed}
          />
          <WheelColumn
            label="Angle"
            unit="deg"
            values={ANGLE_VALUES}
            value={angleDeg}
            onChange={setAngleDeg}
          />
        </div>
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

      <p className="lapua-app-hint">
        Still Range + Wind her, dial tårnene etter mrad — DOPE kan avvike litt
        over ~200 m.
      </p>
    </div>
  );
}
