"use client";

import { useMemo } from "react";
import { getShopItem } from "@/lib/shop/catalog";
import { deriveFromCol } from "@/lib/reloading/loadDevTable";
import {
  formatEstimatedV0Mps,
  formatKaboomChancePct,
  parseBulletWeightGrains,
  type ArmedLoadPlan,
} from "@/lib/reloading/loadPhysics";
import type { HomeLoadedLot } from "@/lib/reloading/homeLoadedAmmo";
import type { SpentBrassKey } from "@/lib/reloading/brass";
import { LOAD_CALIBER_OPTIONS } from "@/lib/reloading/components";
import { computeChronoSeriesStats } from "@/lib/ballistics/kestrelProfile";

type LiveSeriesStats = {
  shotCount: number;
  /** @deprecated Open series — no fixed shot target. */
  shotsNeeded?: number;
  meanV0Mps: number | null;
  highV0Mps: number | null;
  lowV0Mps: number | null;
  stdevV0Mps: number | null;
  /** Preliminary group MOA when ≥2 shots (optional). */
  groupMoa: number | null;
};

type RangeLoadTestBoardProps = {
  caliberKey: SpentBrassKey;
  homeLoadedLots: HomeLoadedLot[];
  armedLoadPlan: ArmedLoadPlan | null;
  hasChronograph: boolean;
  live: LiveSeriesStats | null;
  onArmLot: (lot: HomeLoadedLot) => void;
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
 * Load-test lane board — hjemmeladde partier + live serie.
 */
export function RangeLoadTestBoard({
  caliberKey,
  homeLoadedLots,
  armedLoadPlan,
  hasChronograph,
  live,
  onArmLot,
  onDisarm,
}: RangeLoadTestBoardProps) {
  const caliberLabel =
    LOAD_CALIBER_OPTIONS.find((o) => o.key === caliberKey)?.label ?? caliberKey;

  const lots = useMemo(
    () =>
      [...homeLoadedLots]
        .filter((l) => l.caliberKey === caliberKey)
        .sort((a, b) => a.powderGrains - b.powderGrains || b.loadedAtMs - a.loadedAtMs),
    [homeLoadedLots, caliberKey],
  );

  const activeId = armedLoadPlan?.homeLotId ?? null;

  if (lots.length === 0) {
    return (
      <section className="range-load-test" aria-label="Load test">
        <p className="intro-line intro-gift">Load test</p>
        <p className="shop-row-note">
          Ingen hjemmeladd ammo for {caliberLabel}. Gå til Hjem → Laderommet,
          lag ladeplan og trykk «Lad ammo» — deretter kommer partiene hit.
        </p>
      </section>
    );
  }

  return (
    <section className="range-load-test" aria-label="Load test">
      <header className="range-load-test-head">
        <p className="intro-line intro-gift">Load test · {caliberLabel}</p>
        <p className="shop-row-note">
          Velg parti → skyt serie @ 100 m (CBA) → mål. Tallene (v₀ / samling /
          ES) lagres på hver linje og blir værende når du bytter ammo. Igjen =
          uskutt. Skutte hylser går tilbake til laderommet
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
              {live.shotCount} skudd
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
          Velg «Test» på et parti under. Patroner telles ned når du skyter.
        </p>
      )}

      <div className="range-load-test-table-wrap">
        <table className="range-load-test-table">
          <thead>
            <tr>
              <th scope="col">Igjen</th>
              <th scope="col">gr</th>
              <th scope="col">Krutt</th>
              <th scope="col">Kule</th>
              <th scope="col">COL</th>
              <th scope="col" title="Estimert v₀ — (hele m/s)">
                (v₀)
              </th>
              <th scope="col">Trykk</th>
              <th scope="col">Avg v₀</th>
              <th scope="col">Min</th>
              <th scope="col">Max</th>
              <th scope="col">SD</th>
              <th scope="col" title="Kun etter målt serie">
                Samling
              </th>
              <th scope="col" title="Kun etter målt serie">
                ES
              </th>
              <th scope="col"> </th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => {
              const derived = deriveFromCol(caliberKey, lot.colMm);
              const isActive = activeId === lot.id;
              const empty = lot.roundsRemaining <= 0;
              const liveOnRow =
                isActive && live && live.shotCount > 0 ? live : null;

              return (
                <tr
                  key={lot.id}
                  className={isActive ? "is-active-load" : undefined}
                >
                  <td className="range-load-test-gr">
                    <strong>{lot.roundsRemaining}</strong>
                    <span className="range-load-test-sub">
                      /{lot.roundsLoaded}
                    </span>
                  </td>
                  <td className="range-load-test-gr">
                    {lot.powderGrains.toFixed(1)}
                  </td>
                  <td>{shortName(lot.powderItemId)}</td>
                  <td>{bulletShort(lot.bulletItemId)}</td>
                  <td>
                    {lot.colMm.toFixed(1)}
                    <span className="range-load-test-sub">
                      {" "}
                      · {derived.frifluktThou} jump
                    </span>
                  </td>
                  <td title="Estimert v₀">
                    {formatEstimatedV0Mps(lot.estimatedV0Mps)}
                  </td>
                  <td
                    className={
                      lot.pressurePct > 105
                        ? "laderommet-plan-danger"
                        : lot.overpressurePct > 0
                          ? "laderommet-plan-warn"
                          : undefined
                    }
                  >
                    {lot.pressurePct.toFixed(0)}%
                  </td>
                  <td className="range-load-test-measured">
                    {lot.measuredV0Mps != null ? (
                      <strong>{lot.measuredV0Mps.toFixed(1)}</strong>
                    ) : liveOnRow?.meanV0Mps != null ? (
                      <span className="range-load-test-live">
                        ~{liveOnRow.meanV0Mps.toFixed(1)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="range-load-test-measured">
                    {lot.measuredV0LowMps != null
                      ? lot.measuredV0LowMps.toFixed(1)
                      : liveOnRow?.lowV0Mps != null
                        ? `~${liveOnRow.lowV0Mps.toFixed(0)}`
                        : "—"}
                  </td>
                  <td className="range-load-test-measured">
                    {lot.measuredV0HighMps != null
                      ? lot.measuredV0HighMps.toFixed(1)
                      : liveOnRow?.highV0Mps != null
                        ? `~${liveOnRow.highV0Mps.toFixed(0)}`
                        : "—"}
                  </td>
                  <td className="range-load-test-measured">
                    {lot.measuredV0StdevMps != null ? (
                      <strong>{lot.measuredV0StdevMps.toFixed(2)}</strong>
                    ) : liveOnRow?.stdevV0Mps != null ? (
                      <span className="range-load-test-live">
                        ~{liveOnRow.stdevV0Mps.toFixed(2)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="range-load-test-measured">
                    {lot.measuredGroupMoa != null ? (
                      <strong>{lot.measuredGroupMoa.toFixed(2)}″</strong>
                    ) : liveOnRow?.groupMoa != null ? (
                      <span className="range-load-test-live">
                        ~{liveOnRow.groupMoa.toFixed(2)}″
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="range-load-test-measured">
                    {lot.measuredEsMm != null
                      ? `${lot.measuredEsMm.toFixed(1)}`
                      : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="intro-button"
                      disabled={empty || isActive}
                      onClick={() => onArmLot(lot)}
                    >
                      {isActive ? "Aktiv" : empty ? "Tom" : "Test"}
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
