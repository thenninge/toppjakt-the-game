"use client";

import {
  angularMmAtDistance,
  formatZeroAxisMm,
  getRifleRoundCount,
  resolvePlayerItem,
  type ShotLogEntry,
} from "@/lib/player";
import {
  BARREL_WEAR_END_SHOTS,
  BARREL_WEAR_START_SHOTS,
  barrelWearLabelNb,
  barrelWearMoaScale,
} from "@/lib/rifle/barrelWear";
import { LocationNav } from "@/components/town/LocationNav";
import { isRifleItem } from "@/lib/shop/types";

type ShotLogViewProps = {
  entries: ShotLogEntry[];
  /** Lifetime shots per rifle barrel. */
  rifleRoundCounts?: Record<string, number>;
  onBack: () => void;
  /** Where the user came from — used for back button label. */
  backLabel?: string;
  /** Skip LocationNav when nested under Shotlog/Dope tabs. */
  embedded?: boolean;
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

type RifleWearRow = {
  rifleId: string;
  label: string;
  rounds: number;
  scale: number;
  status: string;
};

function rifleWearRows(
  counts: Record<string, number>,
  entries: ShotLogEntry[],
): RifleWearRow[] {
  const ids = new Set<string>([
    ...Object.keys(counts),
    ...entries.map((e) => e.rifleId),
  ]);
  const rows: RifleWearRow[] = [];
  for (const rifleId of ids) {
    const item = resolvePlayerItem(rifleId);
    if (item && !isRifleItem(item)) continue;
    const rounds = getRifleRoundCount(counts, rifleId);
    const label = item
      ? `${item.brand} ${item.name}`
      : entries.find((e) => e.rifleId === rifleId)?.rifleLabel ?? rifleId;
    rows.push({
      rifleId,
      label,
      rounds,
      scale: barrelWearMoaScale(rounds),
      status: barrelWearLabelNb(rounds),
    });
  }
  rows.sort((a, b) => b.rounds - a.rounds || a.label.localeCompare(b.label));
  return rows;
}

export function ShotLogView({
  entries,
  rifleRoundCounts = {},
  onBack,
  backLabel = "← Tilbake",
  embedded = false,
}: ShotLogViewProps) {
  const comboCount = uniqueCombos(entries);
  const wearRows = rifleWearRows(rifleRoundCounts, entries);

  return (
    <div className={embedded ? "shot-log shot-log--embedded" : "shot-log"}>
      {embedded ? null : (
        <LocationNav
          onBackToTown={onBack}
          backLabel={backLabel}
          hint="Alle målte serier fra skytebanen — ammo, spredning og zero."
        />
      )}

      <header className="shop-header">
        {embedded ? null : (
          <p className="intro-line intro-gift">Shotlog</p>
        )}
        <p className="shop-row-note">
          {entries.length === 0
            ? "Ingen serier logget ennå. Mål en serie på skytebanen."
            : `${entries.length} serie${entries.length === 1 ? "" : "r"} · ${comboCount} våpen/ammo-kombo${comboCount === 1 ? "" : "er"}`}
        </p>
      </header>

      {wearRows.length > 0 ? (
        <section className="shot-log-barrels" aria-label="Skudd pr våpen">
          <h3 className="shot-log-barrels-title">Skudd pr våpen (pipe)</h3>
          <p className="shop-row-note">
            Presisjon: frisk til {BARREL_WEAR_START_SHOTS} skudd, deretter opp
            mot 2× rifle-MOA ved {BARREL_WEAR_END_SHOTS}. Bytt pipe hos CB
            Customs eller kjøp nytt våpen.
          </p>
          <ul className="shot-log-barrel-list">
            {wearRows.map((row) => (
              <li key={row.rifleId} className="shot-log-barrel-row">
                <span className="shot-log-barrel-label">{row.label}</span>
                <span className="shot-log-barrel-count">
                  {row.rounds} skudd · {row.scale.toFixed(2)}×
                </span>
                <span className="shop-row-note">{row.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
            const rifleRounds = getRifleRoundCount(
              rifleRoundCounts,
              entry.rifleId,
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
                  {" · pipe "}
                  {rifleRounds} skudd
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
                {entry.chronoV0Mps && entry.chronoV0Mps.length > 0 ? (
                  <div>
                    <dt>Chrono (Xero)</dt>
                    <dd>
                      {entry.chronoV0Mps
                        .map((v) => `${v.toFixed(0)}`)
                        .join(" · ")}{" "}
                      m/s
                      {entry.chronoTemperatureC != null
                        ? ` · ${entry.chronoTemperatureC.toFixed(0)}°C`
                        : ""}
                      {" · snitt "}
                      {(
                        entry.chronoV0Mps.reduce((a, b) => a + b, 0) /
                        entry.chronoV0Mps.length
                      ).toFixed(0)}{" "}
                      m/s
                    </dd>
                  </div>
                ) : null}
              </dl>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
