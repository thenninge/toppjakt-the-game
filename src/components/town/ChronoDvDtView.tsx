"use client";

import type { ShotLogEntry } from "@/lib/player";
import {
  DVDT_TABLE_TEMPS_C,
  formatDvDt,
  formatV0Mps,
  groupChronoDvDtByAmmo,
  predictV0AtTempC,
  shortAmmoLabel,
  type ChronoDvDtAmmoGroup,
  type ChronoDvDtPoint,
} from "@/lib/shotlog/chronoDvDt";
import { ExpandableSection } from "@/components/ui/ExpandableSection";

type ChronoDvDtViewProps = {
  entries: ShotLogEntry[];
  /** Skip nested LocationNav when under Shotlog/Dope tabs. */
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

function formatTempC(tempC: number): string {
  const sign = tempC > 0 ? "+" : "";
  return `${sign}${tempC}°C`;
}

function sourceLabel(source: ChronoDvDtPoint["source"]): string {
  return source === "field" ? "Felt" : "Bane";
}

function V0TempTable({ groups }: { groups: ChronoDvDtAmmoGroup[] }) {
  return (
    <div className="chrono-dvdt-table-wrap">
      <table className="chrono-dvdt-table">
        <caption className="chrono-dvdt-table-caption">
          Predikert v₀ (m/s) fra Xero — −20 °C til +20 °C
        </caption>
        <thead>
          <tr>
            <th scope="col">Temp</th>
            {groups.map((g) => (
              <th
                key={g.ammoId}
                scope="col"
                title={`${g.ammoLabel} · ${
                  g.tableFromMeasured ? "målt" : "katalog-ankret"
                } ${formatDvDt(g.tableDvDt)}`}
              >
                {shortAmmoLabel(g.ammoLabel)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DVDT_TABLE_TEMPS_C.map((tempC) => (
            <tr key={tempC}>
              <th scope="row">{formatTempC(tempC)}</th>
              {groups.map((g) => (
                <td key={g.ammoId}>
                  {formatV0Mps(predictV0AtTempC(g, tempC))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">dV/dT</th>
            {groups.map((g) => (
              <td
                key={g.ammoId}
                title={
                  g.tableFromMeasured
                    ? `Målt OLS · katalog ${formatDvDt(g.catalogDvDt)}`
                    : `Katalog-ankret (én temp) · katalog ${formatDvDt(g.catalogDvDt)}`
                }
              >
                {formatDvDt(g.tableDvDt)}
                <span className="chrono-dvdt-table-src">
                  {g.tableFromMeasured ? "målt" : "kat."}
                </span>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      <p className="shop-row-note chrono-dvdt-table-note">
        Målt = OLS fra Xero ved ≥2 temperaturer. Kat. = katalog-dV/dT ankret på
        dine chrono-punkter.
      </p>
    </div>
  );
}

function GroupDetail({ group }: { group: ChronoDvDtAmmoGroup }) {
  const needMoreTemps = group.measuredDvDt == null;
  return (
    <div className="chrono-dvdt-card">
      <div className="chrono-dvdt-card-top">
        <p className="chrono-dvdt-ammo">{group.ammoLabel}</p>
        <p className="shop-row-note">
          {group.points.length} måling
          {group.points.length === 1 ? "" : "er"} · {group.rangeCount} bane ·{" "}
          {group.fieldCount} felt · {group.distinctTemps} temperatur
          {group.distinctTemps === 1 ? "" : "er"}
        </p>
      </div>

      <dl className="chrono-dvdt-summary">
        <div>
          <dt>Katalog dV/dT</dt>
          <dd>{formatDvDt(group.catalogDvDt)}</dd>
        </div>
        <div>
          <dt>Målt dV/dT</dt>
          <dd
            title={
              needMoreTemps
                ? "Trenger minst to ulike temperaturer"
                : group.fitRmseMps != null
                  ? `RMSE ${group.fitRmseMps.toFixed(1)} m/s`
                  : undefined
            }
          >
            {needMoreTemps ? (
              <span className="chrono-dvdt-pending">
                Trenger ≥2 temperaturer
              </span>
            ) : (
              formatDvDt(group.measuredDvDt)
            )}
          </dd>
        </div>
        {!needMoreTemps && group.measuredDvDt != null ? (
          <div>
            <dt>vs katalog</dt>
            <dd>
              {formatDvDt(group.measuredDvDt - group.catalogDvDt)}
              {group.fitRmseMps != null
                ? ` · RMSE ${group.fitRmseMps.toFixed(1)} m/s`
                : ""}
            </dd>
          </div>
        ) : null}
      </dl>

      <ul className="chrono-dvdt-points">
        {group.points.map((p) => (
          <li key={p.entryId} className="chrono-dvdt-point">
            <span className="chrono-dvdt-when">{formatWhen(p.atMs)}</span>
            <span
              className={
                p.source === "field"
                  ? "chrono-dvdt-tag is-field"
                  : "chrono-dvdt-tag is-range"
              }
            >
              {sourceLabel(p.source)}
            </span>
            <span>
              {p.temperatureC.toFixed(0)}°C · {p.meanV0Mps.toFixed(0)} m/s
              {p.shotCount > 1 ? ` (n=${p.shotCount})` : ""}
            </span>
            <span className="shop-row-note chrono-dvdt-rifle">
              {p.rifleLabel}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Home — Xero chrono overview: v0 table (−20…+20 °C) + expandable måledata.
 */
export function ChronoDvDtView({
  entries,
  embedded = false,
}: ChronoDvDtViewProps) {
  const groups = groupChronoDvDtByAmmo(entries);
  const pointCount = groups.reduce((n, g) => n + g.points.length, 0);
  const measuredCount = groups.filter((g) => g.tableFromMeasured).length;

  return (
    <div
      className={
        embedded ? "chrono-dvdt chrono-dvdt--embedded" : "chrono-dvdt"
      }
    >
      <header className="shop-header">
        {embedded ? null : (
          <p className="intro-line intro-gift">dV/dT (Xero)</p>
        )}
        <p className="shop-row-note">
          {pointCount === 0
            ? "Ingen chrono-målinger ennå. Pakk Garmin Xero, mål serie på banen — eller sett opp Chrono i felt."
            : `${pointCount} Xero-måling${pointCount === 1 ? "" : "er"} · ${groups.length} ammo · ${measuredCount} med målt dV/dT`}
        </p>
      </header>

      {groups.length === 0 ? (
        <p className="shop-row-note">
          Når du har målinger, får du en v₀-tabell (−20…+20 °C). Med minst to
          temperaturer estimeres dV/dT fra Xero.
        </p>
      ) : (
        <>
          <V0TempTable groups={groups} />

          <ExpandableSection
            title="Måledata"
            summary={`${pointCount} punkt · ${groups.length} ammo · katalog vs målt dV/dT`}
          >
            <ul className="chrono-dvdt-list">
              {groups.map((g) => (
                <li key={g.ammoId}>
                  <GroupDetail group={g} />
                </li>
              ))}
            </ul>
          </ExpandableSection>
        </>
      )}
    </div>
  );
}
