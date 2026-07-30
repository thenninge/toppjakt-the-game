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
import type { RealLoadProfile } from "@/lib/ballistics/realLoad";
import { LapuaBallisticsApp } from "@/components/hunt/LapuaBallisticsApp";
import {
  isSigKilo3000Bdx,
  SigBdxBallisticsApp,
} from "@/components/hunt/SigBdxBallisticsApp";
import {
  ElRangeBallisticsApp,
  isSwarovskiElRange,
} from "@/components/hunt/ElRangeBallisticsApp";
import { ZeissVictoryEnviroPanel } from "@/components/hunt/lrf/ZeissVictoryEnviroPanel";
import { isZeissVictoryLrf } from "@/components/hunt/lrf/ZeissVictoryLrfHud";
import { POWDER_TEMP_REFERENCE_C } from "@/lib/ballistics/powderTemp";
import type { ScopeClickUnit } from "@/lib/optics/spec";

export type HuntRangeSource = "lrf" | "estimated" | "range";

type HuntShotConditionsProps = {
  rangeM: number;
  rangeSource: HuntRangeSource;
  shotBearingDeg: number;
  windFromDeg: number;
  windSpeedMs: number;
  /** Live air temperature (°C) — shown in Enviro; Lapua prefills Temp dial. */
  temperatureC?: number;
  /** Forecast / værmelding temp — EL Range atmosphere. */
  forecastTemperatureC?: number;
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
  /** Equipped scope click unit for DOPE / app readouts. */
  clickUnit?: ScopeClickUnit;
  /** Equipped LRF — Zeiss Victory / Sig BDX replace Lapua with device UI. */
  lrfId?: string | null;
  lrfBrand?: string | null;
  lrfLabel?: string | null;
  /** Absolute elev clicks for current range (Victory display). */
  lrfElevClicks?: number | null;
  /**
   * Shooting range: always Lapua in App-tab (LRF device UIs stay for hunt).
   */
  forceLapuaApp?: boolean;
  /**
   * CB Real drop table — Lapua elev follows the same table as range impacts.
   */
  realDropTable?: RealLoadProfile | null;
};

/**
 * Enviro/App split: live field + DOPE (left) · LRF / BDX / Lapua (right).
 */
export function HuntShotConditions({
  rangeM,
  rangeSource,
  shotBearingDeg,
  windFromDeg,
  windSpeedMs,
  temperatureC = POWDER_TEMP_REFERENCE_C,
  forecastTemperatureC,
  hasKestrel = false,
  dopeCard = [],
  ammoId = null,
  rifleId = null,
  ammo = null,
  ammoLabel = "Ammo",
  onUseDope,
  dopeDialDisabled = false,
  clickUnit = "MRAD",
  lrfId = null,
  lrfBrand = null,
  lrfLabel = null,
  lrfElevClicks = null,
  forceLapuaApp = false,
  realDropTable = null,
}: HuntShotConditionsProps) {
  const tempC = Number.isFinite(temperatureC)
    ? temperatureC
    : POWDER_TEMP_REFERENCE_C;
  const forecastTempC = Number.isFinite(forecastTemperatureC)
    ? (forecastTemperatureC as number)
    : tempC;
  const bearing = ((Math.round(shotBearingDeg) % 360) + 360) % 360;
  const windFrom = ((Math.round(windFromDeg) % 360) + 360) % 360;
  const shotCompass = compassLabelFromDeg(bearing);
  const windCompass = formatWindCompass(windFrom);
  const useZeissLrf =
    !forceLapuaApp && isZeissVictoryLrf({ id: lrfId, brand: lrfBrand });
  const useSigBdx =
    !forceLapuaApp && !useZeissLrf && isSigKilo3000Bdx({ id: lrfId });
  const useElRange =
    !forceLapuaApp &&
    !useZeissLrf &&
    !useSigBdx &&
    isSwarovskiElRange({ id: lrfId });

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
            {forceLapuaApp
              ? "Uten Kestrel: App starter blank — knote range/vind/temp selv. Skriv DOPE fra skudd."
              : useZeissLrf
              ? "Zeiss Victory RF: avstand → elev-klikk i LRF-displayet."
              : useSigBdx
                ? "Sig BDX: range fra LRF. Mål enviro med Kestrel i Aware for auto vind/temp, eller still manuelt (huskes). Tid går ×5 her; fuglen blir nervøs."
                : useElRange
                  ? "EL Range: temp/trykk/fukt fra værmelding. Sett vindstyrke og crosswind angle selv. Tid går ×5 her; fuglen blir nervøs."
                  : "Uten Kestrel: App starter blank — knote range/vind/temp selv. Tid går ×5 her; fuglen blir nervøs."}
          </p>
        ) : forceLapuaApp ? (
          <p className="hunt-shot-cond-hint">
            Kestrel: App prefyller live. Nøyaktig dropp i hold-kortet over.
          </p>
        ) : useSigBdx ? (
          <p className="hunt-shot-cond-hint">
            Sig BDX: range fra LRF. Kestrel-måling fyller vind, vindretning og
            temp (dV/dT).
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
                    {formatDopeElevationClicks(e.elevationClicks, clickUnit)}
                  </span>
                  {e.windageClicks !== 0 ? (
                    <span className="hunt-dope-wind" title="Windage">
                      {formatDopeWindageClicks(e.windageClicks, clickUnit)}
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
        {useZeissLrf ? (
          <ZeissVictoryEnviroPanel
            rangeM={rangeM}
            elevClicks={lrfElevClicks}
            label={lrfLabel ?? "Zeiss Victory RF"}
          />
        ) : useSigBdx && ammo ? (
          <SigBdxBallisticsApp
            ammo={ammo}
            ammoLabel={ammoLabel}
            initialRangeM={rangeM}
            shotBearingDeg={shotBearingDeg}
            liveWindSpeedMs={windSpeedMs}
            liveWindFromDeg={windFromDeg}
            liveTemperatureC={tempC}
            autoPrefill={hasKestrel}
            rifleId={rifleId}
          />
        ) : useElRange && ammo ? (
          <ElRangeBallisticsApp
            ammo={ammo}
            ammoLabel={ammoLabel}
            initialRangeM={rangeM}
            shotBearingDeg={shotBearingDeg}
            forecastTemperatureC={forecastTempC}
          />
        ) : ammo ? (
          <LapuaBallisticsApp
            ammo={ammo}
            ammoLabel={ammoLabel}
            initialRangeM={rangeM}
            liveWindSpeedMs={windSpeedMs}
            liveWindFromDeg={windFromDeg}
            liveTemperatureC={tempC}
            shotBearingDeg={shotBearingDeg}
            autoPrefill={hasKestrel}
            clickUnit={clickUnit}
            realDropTable={realDropTable}
          />
        ) : (
          <p className="hunt-dope-empty">Velg ammo for å bruke appen.</p>
        )}
      </div>
    </div>
  );
}
