"use client";

import { useEffect, useMemo, useState } from "react";
import type { AmmoSpec } from "@/lib/ammo/spec";
import {
  densityRatioFromTempC,
  exactBallisticHold,
} from "@/lib/ballistics/solver";
import { SWAROVSKI_EL_RANGE_ID } from "@/lib/aware/ettersok";
import {
  loadElRangeAppSettings,
  saveElRangeAppSettings,
} from "@/lib/hunt/elRangeAppSettings";
import { mmAt100ToAngular } from "@/lib/optics/clicks";
import {
  crosswindMs,
  forecastAtmosphereExtras,
  MAX_WIND_SPEED_MS,
} from "@/lib/weather/spec";

/** Enviro/App uses the Swarovski EL Range UI when this LRF is equipped. */
export function isSwarovskiElRange(
  meta: { id?: string | null } | null | undefined,
): boolean {
  return meta?.id === SWAROVSKI_EL_RANGE_ID;
}

type ElRangeBallisticsAppProps = {
  ammo: Pick<AmmoSpec, "v0" | "bc" | "bcModel" | "caliber">;
  ammoLabel: string;
  /** LRF measured range. */
  initialRangeM: number;
  shotBearingDeg: number;
  /** Forecast / værmelding temperature (not live). */
  forecastTemperatureC: number;
};

type WindUnit = "ms" | "mph";

const MS_TO_MPH = 2.23693629;

function clampWindMs(n: number): number {
  const v = Number.isFinite(n) ? n : 0;
  return Math.min(MAX_WIND_SPEED_MS, Math.max(0, Math.round(v * 10) / 10));
}

function clampAngle(n: number): number {
  return ((Math.round(Number.isFinite(n) ? n : 90) % 360) + 360) % 360;
}

function rangeFromLrf(m: number): number {
  if (!Number.isFinite(m) || m < 50) return 50;
  return Math.round(m);
}

/**
 * Swarovski EL Range companion app — forecast atm (temp/RH/pressure) +
 * player wind speed & crosswind angle (relative to shot).
 */
export function ElRangeBallisticsApp({
  ammo,
  ammoLabel,
  initialRangeM,
  shotBearingDeg,
  forecastTemperatureC,
}: ElRangeBallisticsAppProps) {
  const [rangeM, setRangeM] = useState(() => rangeFromLrf(initialRangeM));
  const [tempC, setTempC] = useState(forecastTemperatureC);
  const [humidityPct, setHumidityPct] = useState(
    () => forecastAtmosphereExtras(forecastTemperatureC).humidityPct,
  );
  const [pressureHpa, setPressureHpa] = useState(
    () => forecastAtmosphereExtras(forecastTemperatureC).pressureHpa,
  );
  const [windUnit, setWindUnit] = useState<WindUnit>("ms");
  const [windSpeedMs, setWindSpeedMs] = useState(() =>
    clampWindMs(loadElRangeAppSettings().windSpeedMs),
  );
  const [crosswindAngleDeg, setCrosswindAngleDeg] = useState(() =>
    clampAngle(loadElRangeAppSettings().crosswindAngleDeg),
  );
  const [terrainAngleDeg] = useState(0);
  const [appliedNote, setAppliedNote] = useState("");

  useEffect(() => {
    setRangeM(rangeFromLrf(initialRangeM));
  }, [initialRangeM]);

  useEffect(() => {
    const atm = forecastAtmosphereExtras(forecastTemperatureC);
    setTempC(forecastTemperatureC);
    setHumidityPct(atm.humidityPct);
    setPressureHpa(atm.pressureHpa);
  }, [forecastTemperatureC]);

  const windFromDeg =
    ((shotBearingDeg + crosswindAngleDeg) % 360 + 360) % 360;

  function pullForecastWeather() {
    const atm = forecastAtmosphereExtras(forecastTemperatureC);
    setTempC(forecastTemperatureC);
    setHumidityPct(atm.humidityPct);
    setPressureHpa(atm.pressureHpa);
    setAppliedNote("Værmelding oppdatert.");
  }

  const hold = useMemo(() => {
    const cw = crosswindMs(windSpeedMs, windFromDeg, shotBearingDeg);
    return exactBallisticHold(ammo, Math.max(50, rangeM), cw, {
      densityRatio: densityRatioFromTempC(tempC),
      powderTempC: tempC,
    });
  }, [ammo, rangeM, windSpeedMs, windFromDeg, shotBearingDeg, tempC]);

  const elevMils = mmAt100ToAngular(hold.dialYMmAt100, "MRAD");
  const windMils = mmAt100ToAngular(hold.dialXMmAt100, "MRAD");
  const elevUp = hold.dialYMmAt100 >= 0;
  const windLeft = hold.dialXMmAt100 >= 0;

  const windDisplay =
    windUnit === "mph"
      ? `${(windSpeedMs * MS_TO_MPH).toFixed(1)} mph`
      : `${windSpeedMs.toFixed(1)} m/s`;

  function applyValues() {
    saveElRangeAppSettings({
      windSpeedMs,
      crosswindAngleDeg,
    });
    setAppliedNote(
      `Applied · elev ${elevMils.toFixed(2)} MRAD ${elevUp ? "↑" : "↓"} · wind ${windMils.toFixed(2)} MRAD ${windLeft ? "←" : "→"}`,
    );
  }

  function nudgeWind(deltaMs: number) {
    setWindSpeedMs((w) => clampWindMs(w + deltaMs));
  }

  function nudgeAngle(deltaDeg: number) {
    setCrosswindAngleDeg((a) => clampAngle(a + deltaDeg));
  }

  return (
    <div className="el-range-app" aria-label="Swarovski EL Range-app">
      <header className="el-range-header">
        <span className="el-range-brand">EL Range</span>
        <span className="el-range-ammo" title={ammoLabel}>
          {Math.round(rangeM)} m
        </span>
      </header>

      <button
        type="button"
        className="el-range-weather-link"
        onClick={pullForecastWeather}
      >
        Get current weather data ↗
      </button>

      <ul className="el-range-rows" aria-label="Atmosphere from forecast">
        <li className="el-range-row">
          <span className="el-range-label">Temperature</span>
          <span className="el-range-value">
            {tempC.toFixed(0)} °C
            <span className="el-range-edit" aria-hidden>
              ✎
            </span>
          </span>
        </li>
        <li className="el-range-row">
          <span className="el-range-label">Humidity</span>
          <span className="el-range-value">
            {humidityPct} %
            <span className="el-range-edit" aria-hidden>
              ✎
            </span>
          </span>
        </li>
        <li className="el-range-row">
          <span className="el-range-label">
            Air pressure <span className="el-range-info" title="Fra værmelding">ⓘ</span>
          </span>
          <span className="el-range-value">
            {pressureHpa.toFixed(1).replace(".", ",")} hPa
            <span className="el-range-edit" aria-hidden>
              ✎
            </span>
          </span>
        </li>
      </ul>

      <p className="el-range-section">Wind</p>
      <ul className="el-range-rows">
        <li className="el-range-row">
          <span className="el-range-label">Choose unit</span>
          <div className="el-range-unit-toggle" role="group" aria-label="Wind unit">
            <button
              type="button"
              className={
                windUnit === "ms"
                  ? "el-range-unit is-active"
                  : "el-range-unit"
              }
              onClick={() => setWindUnit("ms")}
            >
              m/s
            </button>
            <button
              type="button"
              className={
                windUnit === "mph"
                  ? "el-range-unit is-active"
                  : "el-range-unit"
              }
              onClick={() => setWindUnit("mph")}
            >
              mph
            </button>
          </div>
        </li>
        <li className="el-range-row el-range-row-edit">
          <span className="el-range-label">
            Wind speed <span className="el-range-info" title="Sett selv">ⓘ</span>
          </span>
          <div className="el-range-stepper">
            <button type="button" onClick={() => nudgeWind(-0.1)} aria-label="−">
              −
            </button>
            <span className="el-range-value-plain">{windDisplay}</span>
            <button type="button" onClick={() => nudgeWind(0.1)} aria-label="+">
              +
            </button>
          </div>
        </li>
        <li className="el-range-row el-range-row-edit">
          <span className="el-range-label">Crosswind angle</span>
          <div className="el-range-stepper">
            <button type="button" onClick={() => nudgeAngle(-5)} aria-label="−">
              −
            </button>
            <span className="el-range-value-plain">{crosswindAngleDeg} °</span>
            <button type="button" onClick={() => nudgeAngle(5)} aria-label="+">
              +
            </button>
          </div>
        </li>
      </ul>
      <p className="el-range-hint">
        Crosswind angle = vindretning relativt skyteretning (90° = full sidevind).
      </p>

      <p className="el-range-section">Terrain</p>
      <ul className="el-range-rows">
        <li className="el-range-row">
          <span className="el-range-label">Terrain angle</span>
          <span className="el-range-value">
            {terrainAngleDeg} °
            <span className="el-range-edit" aria-hidden>
              ✎
            </span>
          </span>
        </li>
      </ul>

      <div className="el-range-holds" aria-label="Ballistic hold">
        <span>
          Elev {elevMils.toFixed(2)} {elevUp ? "↑" : "↓"}
        </span>
        <span>
          Wind {windMils.toFixed(2)} {windLeft ? "←" : "→"}
        </span>
        <span>MRAD</span>
      </div>

      <button type="button" className="el-range-apply" onClick={applyValues}>
        Apply new values
      </button>
      {appliedNote ? (
        <p className="el-range-applied">{appliedNote}</p>
      ) : null}
    </div>
  );
}
