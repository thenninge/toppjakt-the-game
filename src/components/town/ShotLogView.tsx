"use client";

import {
  angularMmAtDistance,
  formatZeroAxisMm,
  type ShotLogEntry,
} from "@/lib/player";
import { LocationNav } from "@/components/town/LocationNav";

type ShotLogViewProps = {
  entries: ShotLogEntry[];
  onBack: () => void;
  /** Where the user came from — used for back button label. */
  backLabel?: string;
};

function formatWhen(atMs: number): string {
  try {
    return new Date(atMs).toLocaleString("nb-NO", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function uniqueCombos(entries: ShotLogEntry[]): number {
  const keys = new Set(
    entries.map((e) => `${e.rifleId}::${e.scopeId}::${e.ammoId}`),
  );
  return keys.size;
}

export function ShotLogView({
  entries,
  onBack,
  backLabel = "← Tilbake",
}: ShotLogViewProps) {
  const comboCount = uniqueCombos(entries);

  return (
    <div className="shot-log">
      <LocationNav
        onBackToTown={onBack}
        backLabel={backLabel}
        hint="Alle målte serier fra skytebanen — ammo, spredning og zero."
      />

      <header className="shop-header">
        <p className="intro-line intro-gift">Shotlog</p>
        <p className="shop-row-note">
          {entries.length === 0
            ? "Ingen serier logget ennå. Mål en serie på skytebanen."
            : `${entries.length} serie${entries.length === 1 ? "" : "r"} · ${comboCount} våpen/ammo-kombo${comboCount === 1 ? "" : "er"}`}
        </p>
      </header>

      {entries.length === 0 ? null : (
        <ul className="shot-log-list">
          {entries.map((entry) => {
            const paperX = angularMmAtDistance(
              entry.zeroXMm,
              entry.distanceM,
            );
            const paperY = angularMmAtDistance(
              entry.zeroYMm,
              entry.distanceM,
            );
            return (
              <li key={entry.id} className="shot-log-row">
                <div className="shot-log-row-top">
                  <span className="shot-log-when">{formatWhen(entry.atMs)}</span>
                  <span className="shot-log-distance">
                    {entry.distanceM} m · {entry.shotCount} skudd
                  </span>
                </div>
                <p className="shot-log-kit">
                  {entry.rifleLabel}
                  {" · "}
                  {entry.scopeLabel}
                </p>
                <p className="shot-log-ammo">{entry.ammoLabel}</p>
                <dl className="shot-log-stats">
                  <div>
                    <dt>Spredning</dt>
                    <dd>
                      {entry.extremeSpreadMm.toFixed(0)} mm ·{" "}
                      {entry.groupMoa.toFixed(2)} MOA
                    </dd>
                  </div>
                  <div>
                    <dt>Mean radius</dt>
                    <dd>{entry.meanRadiusMm.toFixed(1)} mm</dd>
                  </div>
                  <div>
                    <dt>POI</dt>
                    <dd>
                      {entry.poiXMm >= 0 ? "+" : ""}
                      {entry.poiXMm.toFixed(0)} mm side ·{" "}
                      {entry.poiYMm >= 0 ? "+" : ""}
                      {entry.poiYMm.toFixed(0)} mm hoyde
                    </dd>
                  </div>
                  <div>
                    <dt>Zero (effektiv)</dt>
                    <dd>
                      {formatZeroAxisMm(entry.zeroXMm, "windage")} /{" "}
                      {formatZeroAxisMm(entry.zeroYMm, "elevation")}
                      {" · "}
                      {paperX.toFixed(0)}/{paperY.toFixed(0)} mm på blink @{" "}
                      {entry.distanceM} m
                    </dd>
                  </div>
                  <div>
                    <dt>Lagret / sesjon</dt>
                    <dd>
                      lagret {entry.savedZeroXMm.toFixed(0)}/
                      {entry.savedZeroYMm.toFixed(0)} mm @100 m · sesjon{" "}
                      {entry.sessionZeroXMm.toFixed(0)}/
                      {entry.sessionZeroYMm.toFixed(0)} mm @100 m
                    </dd>
                  </div>
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
