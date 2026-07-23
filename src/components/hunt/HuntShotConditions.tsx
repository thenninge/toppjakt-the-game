"use client";

import {
  formatWindCompass,
  formatWindSpeed,
} from "@/lib/weather/spec";
import { compassLabelFromDeg } from "@/lib/aware/ettersok";
import {
  formatDopeElevationClicks,
  formatDopeWindageClicks,
  nearestDopeEntry,
  type DopeCardEntry,
} from "@/lib/player";
import type { AmmoSpec } from "@/lib/ammo/spec";
import { LapuaBallisticsApp } from "@/components/hunt/LapuaBallisticsApp";
import { POWDER_TEMP_REFERENCE_C } from "@/lib/ballistics/powderTemp";

export type HuntRangeSource = "lrf" | "estimated" | "range";

type HuntShotConditionsProps = {
  rangeM: number;
  rangeSource: HuntRangeSource;
  shotBearingDeg: number;
  windFromDeg: number;
  windSpeedMs: number;
  /** Live air temperature (°C) — shown in Enviro; Lapua prefills Temp dial. */
  temperatureC?: number;
  /** When false, remind player to compute windage themselves. */
  hasKestrel?: boolean;
  dopeCard?: DopeCardEntry[];
  ammoId?: string | null;
  rifleId?: string | null;
  /** Active ammo for the ballistics app (required for App panel). */
  ammo?: Pick<AmmoSpec, "v0" | "bc" | "bcModel" | "caliber"> | null;
  ammoLabel?: string;
  /**
   * Apply nearest DOPE line to scope turrets.
   * Hidden/disabled when Kestrel AB is already dialing.
   */
  onUseDope?: (entry: DopeCardEntry) => void;
  /** When true, Use DOPE is unavailable (Kestrel AB owns the dials). */
  dopeDialDisabled?: boolean;
};

/**
 * Enviro/App split: live field + DOPE (left) · ballistics phone app (right).
 */
export function HuntShotConditions({
  rangeM,
  rangeSource,
  shotBearingDeg,
  windFromDeg,
  windSpeedMs,
  temperatureC = POWDER_TEMP_REFERENCE_C,
  hasKestrel = false,
  dopeCard = [],
  ammoId = null,
  rifleId = null,
  ammo = null,
  ammoLabel = "Ammo",
  onUseDope,
  dopeDialDisabled = false,
}: HuntShotConditionsProps) {
  const tempC = Number.isFinite(temperatureC)
    ? temperatureC
    : POWDER_TEMP_REFERENCE_C;
  const bearing = ((Math.round(shotBearingDeg) % 360) + 360) % 360;
  const windFrom = ((Math.round(windFromDeg) % 360) + 360) % 360;
  const shotCompass = compassLabelFromDeg(bearing);
  const windCompass = formatWindCompass(windFrom);

  const nearest =
    rifleId && ammoId
      ? nearestDopeEntry(dopeCard, {
          rifleId,
          ammoId,
          distanceM: rangeM,
        })
      : null;

  const dopeRows = dopeCard
    .filter((e) => (rifleId ? e.rifleId === rifleId : true))
    .filter((e) => (ammoId ? e.ammoId === ammoId : true))
    .slice()
    .sort((a, b) => a.distanceM - b.distanceM);

  const nearestId = nearest?.id ?? null;

  return (
    <div className="hunt-enviro-app" aria-label="Enviro og ballistics-app">
      <aside className="hunt-shot-conditions hunt-enviro-col" aria-label="Enviro">
        <p className="hunt-shot-conditions-title">Enviro</p>

        <div className="hunt-shot-cond">
          <span className="hunt-shot-cond-label">Range</span>
          <span className="hunt-shot-cond-value">
            {Math.round(rangeM)} m
            <small>
              {rangeSource === "lrf"
                ? "LRF"
                : rangeSource === "range"
                  ? "Bane"
                  : "Aware estimat"}
            </small>
          </span>
        </div>

        <div className="hunt-shot-cond">
          <span className="hunt-shot-cond-label">Direction</span>
          <div className="hunt-shot-cond-dir">
            <span
              className="hunt-shot-compass"
              style={{ transform: `rotate(${bearing}deg)` }}
              aria-hidden
              title={`Skyteretning ${bearing}°`}
            />
            <span className="hunt-shot-cond-value">
              {bearing}°
              <small>{shotCompass}</small>
            </span>
          </div>
        </div>

        <div className="hunt-shot-cond">
          <span className="hunt-shot-cond-label">Wind</span>
          <div className="hunt-shot-cond-dir">
            <span
              className="hunt-shot-wind-arrow"
              style={{ transform: `rotate(${windFrom + 180}deg)` }}
              aria-hidden
              title={`Vind fra ${windCompass}`}
            />
            <span className="hunt-shot-cond-value">
              {formatWindSpeed(windSpeedMs)}
              <small>fra {windCompass}</small>
            </span>
          </div>
        </div>

        <div className="hunt-shot-cond">
          <span className="hunt-shot-cond-label">Temp</span>
          <span className="hunt-shot-cond-value">
            {tempC.toFixed(1)}°C
            <small>
              {hasKestrel ? "Kestrel / dV/dT" : "still inn i App"}
            </small>
          </span>
        </div>

        {!hasKestrel ? (
          <p className="hunt-shot-cond-hint">
            Uten Kestrel: App starter blank — knote range/vind/temp selv.
            Tid går ×5 her; fuglen blir nervøs.
          </p>
        ) : (
          <p className="hunt-shot-cond-hint">
            Kestrel: App prefyller live. Ellers bruk Kestrel-fanen for fasit.
          </p>
        )}

        <div className="hunt-shot-cond hunt-shot-cond-dope">
          <span className="hunt-shot-cond-label">DOPE</span>
          {dopeRows.length === 0 ? (
            <p className="hunt-dope-empty">
              Ingen linjer — treff i jakt lagres automatisk, eller «Add to DOPE»
              på banen.
            </p>
          ) : (
            <ul className="hunt-dope-list">
              {dopeRows.map((e) => (
                <li
                  key={e.id}
                  className={
                    e.id === nearestId
                      ? "hunt-dope-row is-nearest"
                      : "hunt-dope-row"
                  }
                >
                  <span className="hunt-dope-dist">{e.distanceM} m</span>
                  <span className="hunt-dope-elev" title="Elevation">
                    {formatDopeElevationClicks(e.elevationClicks)}
                  </span>
                  {e.windageClicks !== 0 ? (
                    <span className="hunt-dope-wind" title="Windage">
                      {formatDopeWindageClicks(e.windageClicks)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {dopeRows[0] ? (
            <p className="hunt-dope-ammo">{dopeRows[0].ammoLabel}</p>
          ) : null}
          {onUseDope ? (
            <button
              type="button"
              className="intro-button hunt-dope-use-btn"
              disabled={!nearest || dopeDialDisabled}
              title={
                dopeDialDisabled
                  ? "Kestrel AB dialer allerede — Use DOPE er for manuell hold"
                  : nearest
                    ? `Still kikkerten etter DOPE @ ${nearest.distanceM} m`
                    : "Ingen DOPE-linje for denne ammoen"
              }
              onClick={() => {
                if (!nearest || dopeDialDisabled) return;
                onUseDope(nearest);
              }}
            >
              {dopeDialDisabled
                ? "Use DOPE (Kestrel aktiv)"
                : nearest
                  ? `Use DOPE (${nearest.distanceM} m)`
                  : "Use DOPE"}
            </button>
          ) : null}
        </div>
      </aside>

      <div className="hunt-enviro-app-col" aria-label="Ballistics App">
        {ammo ? (
          <LapuaBallisticsApp
            ammo={ammo}
            ammoLabel={ammoLabel}
            initialRangeM={rangeM}
            liveWindSpeedMs={windSpeedMs}
            liveWindFromDeg={windFromDeg}
            liveTemperatureC={tempC}
            shotBearingDeg={shotBearingDeg}
            autoPrefill={hasKestrel}
          />
        ) : (
          <p className="hunt-dope-empty">Velg ammo for å bruke appen.</p>
        )}
      </div>
    </div>
  );
}
