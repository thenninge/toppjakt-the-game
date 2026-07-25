"use client";

import { useMemo } from "react";
import { getShopItem } from "@/lib/shop/catalog";
import {
  deriveFromCol,
  type LoadDevRow,
  type LoadDevTable,
} from "@/lib/reloading/loadDevTable";
import {
  estimateLoadPlanFromDevRow,
  formatKaboomChancePct,
  parseBulletWeightGrains,
  type ArmedLoadPlan,
} from "@/lib/reloading/loadPhysics";
import type { SpentBrassKey } from "@/lib/reloading/brass";
import { LOAD_CALIBER_OPTIONS } from "@/lib/reloading/components";
import { computeChronoSeriesStats } from "@/lib/ballistics/kestrelProfile";

type LiveSeriesStats = {
  shotCount: number;
  shotsNeeded: number;
  meanV0Mps: number | null;
  highV0Mps: number | null;
  lowV0Mps: number | null;
  stdevV0Mps: number | null;
  /** Preliminary group MOA when ≥2 shots (optional). */
  groupMoa: number | null;
};

type RangeLoadTestBoardProps = {
  caliberKey: SpentBrassKey;
  brassItemId: string | null;
  loadDevTable: LoadDevTable;
  armedLoadPlan: ArmedLoadPlan | null;
  hasChronograph: boolean;
  live: LiveSeriesStats | null;
  onArmRow: (row: LoadDevRow) => void;
  onDisarm: () => void;
};

function shortName(itemId: string | null): string {
  if (!itemId) return "—";
  const item = getShopItem(itemId);
  if (!item) return "—";
  return item.name.length > 16 ? `${item.name.slice(0, 14)}…` : item.name;
}

function bulletShort(itemId: string | null): string {
  if (!itemId) return "—";
  const item = getShopItem(itemId);
  if (!item) return "—";
  const gr = parseBulletWeightGrains(item);
  const name =
    item.name.length > 12 ? `${item.name.slice(0, 10)}…` : item.name;
  return gr != null ? `${name} ${gr}gr` : name;
}

/**
 * Load-test lane board — running overview of ladeplan charges + live series.
 */
export function RangeLoadTestBoard({
  caliberKey,
  brassItemId: _brassItemId,
  loadDevTable,
  armedLoadPlan,
  hasChronograph,
  live,
  onArmRow,
  onDisarm,
}: RangeLoadTestBoardProps) {
  void _brassItemId;
  const caliberLabel =
    LOAD_CALIBER_OPTIONS.find((o) => o.key === caliberKey)?.label ?? caliberKey;

  const rows = useMemo(
    () =>
      [...loadDevTable.rows].sort((a, b) => a.powderGrains - b.powderGrains),
    [loadDevTable.rows],
  );

  const activeId =
    armedLoadPlan?.loadDevRowId ?? loadDevTable.activeRowId ?? null;

  if (rows.length === 0) {
    return (
      <section className="range-load-test" aria-label="Load test">
        <p className="intro-line intro-gift">Load test</p>
        <p className="shop-row-note">
          Ingen ladninger i ladeplanen ennå. Gå til Hjem → Laderommet, legg til
          rader, deretter kom hit for å måle samling og v₀.
        </p>
      </section>
    );
  }

  return (
    <section className="range-load-test" aria-label="Load test">
      <header className="range-load-test-head">
        <p className="intro-line intro-gift">Load test · {caliberLabel}</p>
        <p className="shop-row-note">
          Velg ladning → skyt serie @ 100 m (CBA) → mål. Oversikten oppdateres
          med samling og v₀ (avg / min / max / SD)
          {hasChronograph ? "" : " — pakk chrono for v₀"}.
        </p>
      </header>

      {armedLoadPlan && activeId ? (
        <p className="range-load-test-active">
          Aktiv: {armedLoadPlan.powderGrains.toFixed(1)} gr · trykk{" "}
          {armedLoadPlan.pressurePct.toFixed(1)} % · spreng{" "}
          <span
            className={
              armedLoadPlan.kaboomChance > 0
                ? "laderommet-plan-danger"
                : undefined
            }
          >
            {formatKaboomChancePct(armedLoadPlan.kaboomChance)}
          </span>
          {live ? (
            <>
              {" · serie "}
              {live.shotCount}/{live.shotsNeeded}
              {live.meanV0Mps != null ? (
                <>
                  {" · live v₀ "}
                  {live.meanV0Mps.toFixed(1)}
                  {live.stdevV0Mps != null
                    ? ` ±${live.stdevV0Mps.toFixed(2)}`
                    : ""}
                  {live.lowV0Mps != null && live.highV0Mps != null
                    ? ` [${live.lowV0Mps.toFixed(0)}–${live.highV0Mps.toFixed(0)}]`
                    : ""}
                </>
              ) : null}
              {live.groupMoa != null
                ? ` · live samling ~${live.groupMoa.toFixed(2)}″`
                : ""}
            </>
          ) : null}
          {" · "}
          <button
            type="button"
            className="intro-button sheriff-secondary range-load-test-disarm"
            onClick={onDisarm}
          >
            Avslutt
          </button>
        </p>
      ) : (
        <p className="shop-row-note">
          Velg «Test» på en rad under for å koble målinger til den laden.
        </p>
      )}

      <div className="range-load-test-table-wrap">
        <table className="range-load-test-table">
          <thead>
            <tr>
              <th scope="col">gr</th>
              <th scope="col">Krutt</th>
              <th scope="col">Kule</th>
              <th scope="col">COL</th>
              <th scope="col">Est.</th>
              <th scope="col">Trykk</th>
              <th scope="col">Avg v₀</th>
              <th scope="col">Min</th>
              <th scope="col">Max</th>
              <th scope="col">SD</th>
              <th scope="col">Samling</th>
              <th scope="col">ES</th>
              <th scope="col"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const powder = row.powderItemId
                ? getShopItem(row.powderItemId)
                : null;
              const bullet = row.bulletItemId
                ? getShopItem(row.bulletItemId)
                : null;
              const est =
                powder && bullet
                  ? estimateLoadPlanFromDevRow(caliberKey, row, {
                      powder,
                      bullet,
                    })
                  : null;
              const derived = deriveFromCol(caliberKey, row.colMm);
              const isActive = activeId === row.id;
              const canArm = !!row.powderItemId && !!row.bulletItemId;
              const liveOnRow =
                isActive && live && live.shotCount > 0 ? live : null;

              return (
                <tr
                  key={row.id}
                  className={isActive ? "is-active-load" : undefined}
                >
                  <td className="range-load-test-gr">
                    {row.powderGrains.toFixed(1)}
                  </td>
                  <td>{shortName(row.powderItemId)}</td>
                  <td>{bulletShort(row.bulletItemId)}</td>
                  <td>
                    {row.colMm.toFixed(1)}
                    <span className="range-load-test-sub">
                      {" "}
                      · {derived.frifluktThou} jump
                    </span>
                  </td>
                  <td>{est ? `${est.v0Mps}` : "—"}</td>
                  <td
                    className={
                      est && est.pressurePct > 105
                        ? "laderommet-plan-danger"
                        : est && est.isOverpressure
                          ? "laderommet-plan-warn"
                          : undefined
                    }
                  >
                    {est ? `${est.pressurePct.toFixed(0)}%` : "—"}
                  </td>
                  <td className="range-load-test-measured">
                    {row.measuredV0Mps != null ? (
                      <strong>{row.measuredV0Mps.toFixed(1)}</strong>
                    ) : liveOnRow?.meanV0Mps != null ? (
                      <span className="range-load-test-live">
                        ~{liveOnRow.meanV0Mps.toFixed(1)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="range-load-test-measured">
                    {row.measuredV0LowMps != null
                      ? row.measuredV0LowMps.toFixed(1)
                      : liveOnRow?.lowV0Mps != null
                        ? `~${liveOnRow.lowV0Mps.toFixed(0)}`
                        : "—"}
                  </td>
                  <td className="range-load-test-measured">
                    {row.measuredV0HighMps != null
                      ? row.measuredV0HighMps.toFixed(1)
                      : liveOnRow?.highV0Mps != null
                        ? `~${liveOnRow.highV0Mps.toFixed(0)}`
                        : "—"}
                  </td>
                  <td className="range-load-test-measured">
                    {row.measuredV0StdevMps != null ? (
                      <strong>{row.measuredV0StdevMps.toFixed(2)}</strong>
                    ) : liveOnRow?.stdevV0Mps != null ? (
                      <span className="range-load-test-live">
                        ~{liveOnRow.stdevV0Mps.toFixed(2)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="range-load-test-measured">
                    {row.measuredGroupMoa != null ? (
                      <strong>{row.measuredGroupMoa.toFixed(2)}″</strong>
                    ) : liveOnRow?.groupMoa != null ? (
                      <span className="range-load-test-live">
                        ~{liveOnRow.groupMoa.toFixed(2)}″
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="range-load-test-measured">
                    {row.measuredEsMm != null
                      ? `${row.measuredEsMm.toFixed(1)}`
                      : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="intro-button"
                      disabled={!canArm || isActive}
                      onClick={() => onArmRow(row)}
                    >
                      {isActive ? "Aktiv" : "Test"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Live chrono stats from current series impacts. */
export function liveChronoMeanMps(
  velocities: (number | null | undefined)[],
): number | null {
  const stats = computeChronoSeriesStats(
    velocities.filter((v): v is number => v != null && Number.isFinite(v)),
  );
  return stats?.meanMps ?? null;
}

export function liveChronoFromShots(
  velocities: (number | null | undefined)[],
): {
  meanV0Mps: number | null;
  highV0Mps: number | null;
  lowV0Mps: number | null;
  stdevV0Mps: number | null;
} {
  const stats = computeChronoSeriesStats(
    velocities.filter((v): v is number => v != null && Number.isFinite(v)),
  );
  if (!stats) {
    return {
      meanV0Mps: null,
      highV0Mps: null,
      lowV0Mps: null,
      stdevV0Mps: null,
    };
  }
  return {
    meanV0Mps: stats.meanMps,
    highV0Mps: stats.highMps,
    lowV0Mps: stats.lowMps,
    stdevV0Mps: stats.stdevMps,
  };
}
