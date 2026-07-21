"use client";

import {
  formatWindCompass,
  formatWindSpeed,
} from "@/lib/weather/spec";
import { compassLabelFromDeg } from "@/lib/aware/ettersok";
import {
  formatDopeElevationClicks,
  formatDopeWindageClicks,
  type DopeCardEntry,
} from "@/lib/player";
import type { AmmoSpec } from "@/lib/ammo/spec";
import { LapuaBallisticsApp } from "@/components/hunt/LapuaBallisticsApp";

export type HuntRangeSource = "lrf" | "estimated";

type HuntShotConditionsProps = {
  rangeM: number;
  rangeSource: HuntRangeSource;
  shotBearingDeg: number;
  windFromDeg: number;
  windSpeedMs: number;
  densityRatio?: number;
  /** When false, remind player to compute windage themselves. */
  hasKestrel?: boolean;
  dopeCard?: DopeCardEntry[];
  ammoId?: string | null;
  rifleId?: string | null;
  /** Active ammo for the ballistics app (required for App panel). */
  ammo?: Pick<AmmoSpec, "v0" | "bc" | "bcModel"> | null;
  ammoLabel?: string;
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
  densityRatio = 1,
  hasKestrel = false,
  dopeCard = [],
  ammoId = null,
  rifleId = null,
  ammo = null,
  ammoLabel = "Ammo",
}: HuntShotConditionsProps) {
  const bearing = ((Math.round(shotBearingDeg) % 360) + 360) % 360;
  const windFrom = ((Math.round(windFromDeg) % 360) + 360) % 360;
  const shotCompass = compassLabelFromDeg(bearing);
  const windCompass = formatWindCompass(windFrom);

  const dopeRows = dopeCard
    .filter((e) => (rifleId ? e.rifleId === rifleId : true))
    .filter((e) => (ammoId ? e.ammoId === ammoId : true))
    .slice()
    .sort((a, b) => a.distanceM - b.distanceM);

  const nearestId =
    dopeRows.length > 0
      ? dopeRows.reduce((best, e) =>
          Math.abs(e.distanceM - rangeM) < Math.abs(best.distanceM - rangeM)
            ? e
            : best,
        ).id
      : null;

  return (
    <div className="hunt-enviro-app" aria-label="Enviro og ballistics-app">
      <aside className="hunt-shot-conditions hunt-enviro-col" aria-label="Enviro">
        <p className="hunt-shot-conditions-title">Enviro</p>

        <div className="hunt-shot-cond">
          <span className="hunt-shot-cond-label">Range</span>
          <span className="hunt-shot-cond-value">
            {Math.round(rangeM)} m
            <small>
              {rangeSource === "lrf" ? "LRF" : "Aware estimat"}
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

        {!hasKestrel ? (
          <p className="hunt-shot-cond-hint">
            Bruk App til høyre: sett range + vind, dial tårnene.
          </p>
        ) : (
          <p className="hunt-shot-cond-hint">
            App = estimat · Kestrel-fanen = fasit.
          </p>
        )}

        <div className="hunt-shot-cond hunt-shot-cond-dope">
          <span className="hunt-shot-cond-label">DOPE</span>
          {dopeRows.length === 0 ? (
            <p className="hunt-dope-empty">
              Ingen linjer — «Add to DOPE» på banen.
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
            shotBearingDeg={shotBearingDeg}
            densityRatio={densityRatio}
          />
        ) : (
          <p className="hunt-dope-empty">Velg ammo for å bruke appen.</p>
        )}
      </div>
    </div>
  );
}
