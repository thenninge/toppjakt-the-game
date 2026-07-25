"use client";

import {
  chronographKindLabel,
  computeChronoSeriesStats,
  type ChronographKind,
  type KestrelGunProfile,
} from "@/lib/ballistics/kestrelProfile";

type RangeChronoPanelProps = {
  kind: ChronographKind;
  /** Realized v0 from current series shots. */
  velocitiesMps: number[];
  temperatureC: number;
  ammoLabel: string;
  ammoId: string | null;
  /** Catalog / True Ballistic BC when available. */
  bc?: number | null;
  bcModel?: string | null;
  existingProfile?: KestrelGunProfile | null;
  hasKestrel: boolean;
  onUpdateKestrel: () => void;
};

/**
 * Shooting-range Chrono HUD — Xero or True Ballistic live series readout.
 */
export function RangeChronoPanel({
  kind,
  velocitiesMps,
  temperatureC,
  ammoLabel,
  ammoId,
  bc,
  bcModel,
  existingProfile,
  hasKestrel,
  onUpdateKestrel,
}: RangeChronoPanelProps) {
  const stats = computeChronoSeriesStats(velocitiesMps);
  const device = chronographKindLabel(kind);

  return (
    <div className="range-chrono-panel" aria-label={`${device} chrono`}>
      <p className="range-chrono-device">{device}</p>
      <p className="shop-row-note">
        {ammoId ? ammoLabel : "Velg ammo"} · luft {temperatureC.toFixed(0)} °C
      </p>

      {!stats ? (
        <p className="shop-row-note">
          Ingen skudd i serien ennå — skyt for å fylle chrono.
        </p>
      ) : (
        <dl className="range-chrono-stats">
          <div>
            <dt>Skudd</dt>
            <dd>{stats.n}</dd>
          </div>
          <div>
            <dt>v₀ / avg</dt>
            <dd>{stats.meanMps.toFixed(1)} m/s</dd>
          </div>
          <div>
            <dt>Stdev</dt>
            <dd>{stats.stdevMps.toFixed(2)} m/s</dd>
          </div>
          <div>
            <dt>ES</dt>
            <dd>{stats.extremeSpreadMps.toFixed(1)} m/s</dd>
          </div>
          <div>
            <dt>High</dt>
            <dd>{stats.highMps.toFixed(1)} m/s</dd>
          </div>
          <div>
            <dt>Low</dt>
            <dd>{stats.lowMps.toFixed(1)} m/s</dd>
          </div>
          {kind === "true_ballistic" ? (
            <>
              <div>
                <dt>BC{bcModel ? ` (${bcModel})` : ""}</dt>
                <dd>{bc != null ? bc.toFixed(3) : "—"}</dd>
              </div>
              <div>
                <dt>Max</dt>
                <dd>{stats.highMps.toFixed(1)} m/s</dd>
              </div>
              <div>
                <dt>Mean</dt>
                <dd>{stats.meanMps.toFixed(1)} m/s</dd>
              </div>
            </>
          ) : null}
        </dl>
      )}

      {existingProfile ? (
        <p className="shop-row-note">
          Kestrel: {existingProfile.mvMps.toFixed(1)} m/s @ 15 °C
          {existingProfile.dvDtMpsPerC != null
            ? ` · dV/dT ${existingProfile.dvDtMpsPerC.toFixed(2)}`
            : ""}
          {existingProfile.bc != null
            ? ` · BC ${existingProfile.bc.toFixed(3)}`
            : ""}
        </p>
      ) : null}

      <button
        type="button"
        className="intro-button"
        disabled={!hasKestrel || !stats || !ammoId}
        title={
          !hasKestrel
            ? "Kestrel mangler i kit"
            : !stats
              ? "Trenger minst ett chrono-skudd"
              : "Skriv målt MV inn i Kestrel-profilen"
        }
        onClick={onUpdateKestrel}
      >
        Update Kestrel
      </button>
    </div>
  );
}
