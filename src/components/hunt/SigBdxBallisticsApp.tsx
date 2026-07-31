"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AmmoSpec } from "@/lib/ammo/spec";
import {
  densityRatioFromTempC,
  exactBallisticHold,
} from "@/lib/ballistics/solver";
import {
  ammoAtPowderTemp,
  muzzleVelocityAtPowderTempC,
  powderTempDvDtMpsPerC,
  POWDER_TEMP_REFERENCE_C,
} from "@/lib/ballistics/powderTemp";
import { sampleTrajectory } from "@/lib/ballistics/trajectory";
import {
  EditableRangeMeters,
  APP_RANGE_MAX_M,
  APP_RANGE_MIN_M,
  clampAppRangeM,
} from "@/components/hunt/EditableRangeMeters";
import {
  loadSigBdxAppSettings,
  saveSigBdxAppSettings,
} from "@/lib/hunt/sigBdxAppSettings";
import { mmAt100ToAngular } from "@/lib/optics/clicks";
import { crosswindMs, MAX_WIND_SPEED_MS } from "@/lib/weather/spec";
import { getShopItem } from "@/lib/shop/catalog";

export const SIG_KILO3000_BDX_ID = "lrf-sig-kilo3000-bdx-10x42";

/** Enviro/App uses the Sig BDX phone UI when this LRF is equipped. */
export function isSigKilo3000Bdx(
  meta: { id?: string | null } | null | undefined,
): boolean {
  return meta?.id === SIG_KILO3000_BDX_ID;
}

type SigBdxBallisticsAppProps = {
  ammo: Pick<AmmoSpec, "v0" | "bc" | "bcModel" | "caliber">;
  ammoLabel: string;
  /**
   * LRF range from Sig KILO — auto-fills the app. Player can type a manual
   * override; a new LRF reading (changed {@link initialRangeM}) replaces it.
   */
  initialRangeM: number;
  shotBearingDeg: number;
  /** Live wind — used when {@link autoPrefill} (Kestrel measured). */
  liveWindSpeedMs?: number;
  liveWindFromDeg?: number;
  /** Live air / powder temp — used when {@link autoPrefill}. */
  liveTemperatureC?: number;
  /**
   * When true (Kestrel measured in Aware / on range), wind + temp + clock
   * start from live values. Without Kestrel the player sets them manually.
   */
  autoPrefill?: boolean;
  rifleId?: string | null;
  /** Cosmetic device serial in header. */
  deviceSerial?: string;
};

const TEMP_MIN_C = -25;
const TEMP_MAX_C = 30;
const WIND_STEP_MS = 0.1;
const CLOCK_HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;

function clampTempC(n: number): number {
  const t = Math.round(Number.isFinite(n) ? n : 0);
  return Math.min(TEMP_MAX_C, Math.max(TEMP_MIN_C, t));
}

function clampWindMs(n: number): number {
  const v = Number.isFinite(n) ? n : 0;
  return Math.min(MAX_WIND_SPEED_MS, Math.max(0, Math.round(v * 10) / 10));
}

function snapHourDeg(deg: number): number {
  const n = ((Math.round(deg / 30) * 30) % 360 + 360) % 360;
  return n;
}

/** Clock hour (1–12) for wind-from angle. */
function hourFromRelDeg(relDeg: number): number {
  const h = Math.round(snapHourDeg(relDeg) / 30) % 12;
  return h === 0 ? 12 : h;
}

function relDegFromHour(hour: number): number {
  const h = ((Math.round(hour) % 12) + 12) % 12;
  return h * 30;
}

function bulletMassKgFromLabel(label: string): number {
  const m = label.match(/(\d+)\s*gr/i);
  const grains = m ? Number(m[1]) : 130;
  return (Math.max(1, grains) * 0.06479891) / 1000;
}

function gunDisplayName(rifleId: string | null | undefined): string {
  if (!rifleId) return "Insert Gun name";
  const item = getShopItem(rifleId);
  if (!item) return "Insert Gun name";
  return `${item.brand} ${item.name}`;
}

function rangeFromLrf(m: number): number {
  return clampAppRangeM(m, APP_RANGE_MIN_M, APP_RANGE_MAX_M);
}

/** Relative wind-from vs shot: 0° = 12 o'clock (headwind), clockwise. */
function relativeWindDeg(windFromDeg: number, shotBearingDeg: number): number {
  return ((windFromDeg - shotBearingDeg) % 360 + 360) % 360;
}

/**
 * Sig Sauer BDX companion app (phone UI) — elevation / windage in MILS from
 * LRF range (or manual override); player sets wind ±, clock direction, and
 * temp (dV/dT). New Sig LRF measure overwrites a typed range.
 * With Kestrel autoPrefill, wind + temp come from live measure; otherwise
 * wind/temp/dir persist across engagements via localStorage.
 */
export function SigBdxBallisticsApp({
  ammo,
  ammoLabel,
  initialRangeM,
  shotBearingDeg,
  liveWindSpeedMs = 0,
  liveWindFromDeg = 0,
  liveTemperatureC = 0,
  autoPrefill = false,
  rifleId = null,
  deviceSerial = "K3000BDX-000593",
}: SigBdxBallisticsAppProps) {
  const [rangeM, setRangeM] = useState(() => rangeFromLrf(initialRangeM));
  const lastLrfRangeRef = useRef(rangeFromLrf(initialRangeM));
  const [windSpeed, setWindSpeed] = useState(() => {
    if (autoPrefill) return clampWindMs(liveWindSpeedMs);
    return clampWindMs(loadSigBdxAppSettings().windSpeedMs);
  });
  const [tempC, setTempC] = useState(() => {
    if (autoPrefill) return clampTempC(liveTemperatureC);
    return clampTempC(loadSigBdxAppSettings().tempC);
  });
  const [windRelDeg, setWindRelDeg] = useState(() => {
    if (autoPrefill) {
      return snapHourDeg(relativeWindDeg(liveWindFromDeg, shotBearingDeg));
    }
    return snapHourDeg(loadSigBdxAppSettings().windRelDeg);
  });
  /** Cosmetic incline readout (ABU). */
  const [angleAbu] = useState(0);
  const [altitudeM] = useState(345);

  // New Sig KILO reading overwrites a typed manual range.
  useEffect(() => {
    const next = rangeFromLrf(initialRangeM);
    if (next === lastLrfRangeRef.current) return;
    lastLrfRangeRef.current = next;
    setRangeM(next);
  }, [initialRangeM]);

  useEffect(() => {
    saveSigBdxAppSettings({
      windSpeedMs: windSpeed,
      windRelDeg,
      tempC,
    });
  }, [windSpeed, windRelDeg, tempC]);

  const windFromDeg =
    ((shotBearingDeg + windRelDeg) % 360 + 360) % 360;
  const fromHour = hourFromRelDeg(windRelDeg);
  /** Arrow points where wind blows (opposite of FROM). */
  const windToDeg = (windRelDeg + 180) % 360;

  const hold = useMemo(() => {
    const cw = crosswindMs(windSpeed, windFromDeg, shotBearingDeg);
    return exactBallisticHold(ammo, Math.max(50, rangeM), cw, {
      densityRatio: densityRatioFromTempC(tempC),
      powderTempC: tempC,
    });
  }, [ammo, rangeM, windSpeed, windFromDeg, shotBearingDeg, tempC]);

  const impact = useMemo(() => {
    const ammoEff = ammoAtPowderTemp(ammo, tempC);
    return sampleTrajectory(ammoEff, Math.max(50, rangeM), {
      densityRatio: densityRatioFromTempC(tempC),
    });
  }, [ammo, rangeM, tempC]);

  const elevMils = mmAt100ToAngular(hold.dialYMmAt100, "MRAD");
  const windMils = mmAt100ToAngular(hold.dialXMmAt100, "MRAD");
  const elevUp =
    Math.abs(hold.dialYMmAt100) >= 0.05 && hold.dialYMmAt100 < 0;
  const elevDown =
    Math.abs(hold.dialYMmAt100) >= 0.05 && hold.dialYMmAt100 > 0;
  const windLeft =
    Math.abs(hold.dialXMmAt100) >= 0.05 && hold.dialXMmAt100 < 0;
  const windRight =
    Math.abs(hold.dialXMmAt100) >= 0.05 && hold.dialXMmAt100 > 0;

  const velocityMps = impact.velocityMps;
  const energyJ = 0.5 * bulletMassKgFromLabel(ammoLabel) * velocityMps ** 2;
  const v0AtTemp = muzzleVelocityAtPowderTempC(ammo.v0, tempC, ammo.caliber);
  const dvdt = powderTempDvDtMpsPerC(ammo.caliber);
  const gunName = gunDisplayName(rifleId);

  const nudgeWind = (delta: number) => {
    setWindSpeed((w) => clampWindMs(w + delta));
  };

  const nudgeTemp = (delta: number) => {
    setTempC((t) => clampTempC(t + delta));
  };

  return (
    <div className="sig-bdx-app" aria-label="Sig Sauer BDX-app">
      <header className="sig-bdx-header">
        <span className="sig-bdx-logo" aria-hidden>
          BDX
        </span>
        <span className="sig-bdx-device" title={deviceSerial}>
          {deviceSerial}
        </span>
        <span className="sig-bdx-header-icons" aria-hidden>
          <span className="sig-bdx-hdr-help">?</span>
          <span className="sig-bdx-hdr-gear" />
        </span>
      </header>

      <div className="sig-bdx-holds">
        <div className="sig-bdx-hold">
          <span className="sig-bdx-hold-label">Elevation</span>
          <div className="sig-bdx-hold-row">
            <span className="sig-bdx-hold-value">
              {elevMils < 0.005 ? "0.00" : elevMils.toFixed(2)}
            </span>
            {elevUp ? (
              <span className="sig-bdx-arrow" aria-label="opp">
                ▲
              </span>
            ) : elevDown ? (
              <span className="sig-bdx-arrow" aria-label="ned">
                ▼
              </span>
            ) : (
              <span className="sig-bdx-arrow is-null" aria-hidden>
                ·
              </span>
            )}
            <span className="sig-bdx-hold-unit">MILS</span>
          </div>
        </div>
        <div className="sig-bdx-hold">
          <span className="sig-bdx-hold-label">Windage</span>
          <div className="sig-bdx-hold-row">
            <span className="sig-bdx-hold-value">
              {windMils < 0.005 ? "0.00" : windMils.toFixed(2)}
            </span>
            {windLeft ? (
              <span className="sig-bdx-arrow" aria-label="venstre">
                ◀
              </span>
            ) : windRight ? (
              <span className="sig-bdx-arrow" aria-label="høyre">
                ▶
              </span>
            ) : (
              <span className="sig-bdx-arrow is-null" aria-hidden>
                ·
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="sig-bdx-row sig-bdx-range-row">
        <span className="sig-bdx-muted">Range</span>
        <EditableRangeMeters
          valueM={rangeM}
          onChange={setRangeM}
          minM={APP_RANGE_MIN_M}
          maxM={APP_RANGE_MAX_M}
          decimals={1}
          className="sig-bdx-accent"
          inputClassName="app-range-input sig-bdx-range-input"
          ariaLabel="Range — trykk for å taste inn (overskriver LRF til neste måling)"
        />
        <span className="sig-bdx-angle" title="Inclinometer">
          ∠ {angleAbu.toFixed(1)} ABU
        </span>
      </div>

      <div className="sig-bdx-row sig-bdx-ballistics-row">
        <span>
          <span className="sig-bdx-muted">Velocity</span>{" "}
          <span className="sig-bdx-plain">{Math.round(velocityMps)} m/s</span>
        </span>
        <span>
          <span className="sig-bdx-muted">Energy</span>{" "}
          <span className="sig-bdx-plain">{Math.round(energyJ)} J</span>
        </span>
      </div>

      <section className="sig-bdx-env" aria-label="Environment">
        <p className="sig-bdx-env-title">Environment</p>
        <div className="sig-bdx-env-body">
          <div className="sig-bdx-wind-speed">
            <span className="sig-bdx-accent sig-bdx-wind-readout">
              {windSpeed.toFixed(1)} <small>m/s</small>
            </span>
            <div className="sig-bdx-wind-pill" role="group" aria-label="Vindstyrke">
              <button
                type="button"
                className="sig-bdx-wind-btn"
                aria-label="Vindstyrke opp"
                disabled={windSpeed >= MAX_WIND_SPEED_MS}
                onClick={() => nudgeWind(WIND_STEP_MS)}
              >
                +
              </button>
              <button
                type="button"
                className="sig-bdx-wind-btn"
                aria-label="Vindstyrke ned"
                disabled={windSpeed <= 0}
                onClick={() => nudgeWind(-WIND_STEP_MS)}
              >
                −
              </button>
            </div>
          </div>

          <div
            className="sig-bdx-clock"
            role="group"
            aria-label={`Vind fra kl. ${fromHour}`}
          >
            {CLOCK_HOURS.map((h) => {
              const angle = h === 12 ? 0 : h * 30;
              return (
                <button
                  key={h}
                  type="button"
                  className={
                    h === fromHour
                      ? "sig-bdx-clock-hour is-from"
                      : "sig-bdx-clock-hour"
                  }
                  style={{
                    transform: `rotate(${angle}deg) translateY(-3.05rem) rotate(-${angle}deg)`,
                  }}
                  aria-label={`Vind fra kl. ${h}`}
                  aria-pressed={h === fromHour}
                  onClick={() => setWindRelDeg(relDegFromHour(h))}
                >
                  {h}
                </button>
              );
            })}
            <span
              className="sig-bdx-clock-arrow"
              style={{ transform: `rotate(${windToDeg}deg)` }}
              aria-hidden
            />
            <span className="sig-bdx-clock-hub" aria-hidden />
          </div>
        </div>
      </section>

      <div className="sig-bdx-footer">
        <div className="sig-bdx-footer-row">
          <span className="sig-bdx-muted">Gun</span>
          <span className="sig-bdx-gun" title={gunName}>
            {gunName}
          </span>
          <span className="sig-bdx-crosshair" aria-hidden>
            ⌖
          </span>
        </div>
        <div className="sig-bdx-footer-row sig-bdx-temp-row">
          <span className="sig-bdx-muted">Temperature</span>
          <span className="sig-bdx-icon-circle sig-bdx-icon-temp" aria-hidden />
          <div className="sig-bdx-temp-controls">
            <button
              type="button"
              className="sig-bdx-temp-btn"
              aria-label="Temp ned"
              disabled={tempC <= TEMP_MIN_C}
              onClick={() => nudgeTemp(-1)}
            >
              −
            </button>
            <span className="sig-bdx-plain">
              {tempC} <small>C</small>
            </span>
            <button
              type="button"
              className="sig-bdx-temp-btn"
              aria-label="Temp opp"
              disabled={tempC >= TEMP_MAX_C}
              onClick={() => nudgeTemp(1)}
            >
              +
            </button>
          </div>
        </div>
        <div className="sig-bdx-footer-row">
          <span className="sig-bdx-muted">Altitude</span>
          <span className="sig-bdx-icon-circle sig-bdx-icon-alt" aria-hidden />
          <span className="sig-bdx-plain">
            {altitudeM} <small>m</small>
          </span>
        </div>
      </div>

      <p className="sig-bdx-meta">
        v0 {Math.round(v0AtTemp)} m/s @ {tempC}°C · dV/dT {dvdt} m/s/°C · ref{" "}
        {POWDER_TEMP_REFERENCE_C}°C
      </p>
    </div>
  );
}
