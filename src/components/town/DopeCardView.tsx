"use client";

import { useState } from "react";
import {
  formatDopeElevationClicks,
  formatDopeWindageClicks,
  type DopeCardEntry,
} from "@/lib/player";
import { LocationNav } from "@/components/town/LocationNav";
import { getShopItem } from "@/lib/shop/catalog";
import { isAmmoItem } from "@/lib/shop/types";
import {
  calibrateMvFromDope,
  type KestrelGunProfile,
} from "@/lib/ballistics/kestrelProfile";

type DopeCardViewProps = {
  entries: DopeCardEntry[];
  onUpdate: (
    id: string,
    patch: Partial<
      Pick<
        DopeCardEntry,
        "distanceM" | "elevationClicks" | "windageClicks" | "ammoLabel"
      >
    >,
  ) => void;
  onRemove: (id: string) => void;
  onBack: () => void;
  backLabel?: string;
  /** Skip LocationNav when nested under Shotlog/Dope tabs. */
  embedded?: boolean;
  hasKestrel?: boolean;
  kestrelProfiles?: Record<string, KestrelGunProfile>;
  onUpsertKestrelProfile?: (profile: KestrelGunProfile) => void;
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

/**
 * Home — view / edit DOPE card lines from the range.
 */
export function DopeCardView({
  entries,
  onUpdate,
  onRemove,
  onBack,
  backLabel = "← Tilbake",
  embedded = false,
  hasKestrel = false,
  kestrelProfiles = {},
  onUpsertKestrelProfile,
}: DopeCardViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const sorted = [...entries].sort((a, b) => {
    const ammo = a.ammoLabel.localeCompare(b.ammoLabel, "nb");
    if (ammo !== 0) return ammo;
    return a.distanceM - b.distanceM;
  });

  function calibrateEntry(entry: DopeCardEntry) {
    if (!onUpsertKestrelProfile) return;
    const item = getShopItem(entry.ammoId);
    if (!item || !isAmmoItem(item)) {
      setStatusNote("Finner ikke ammo i katalog for denne DOPE-linjen.");
      return;
    }
    const profile = calibrateMvFromDope({
      ammoId: entry.ammoId,
      ammo: item.ammo,
      distanceM: entry.distanceM,
      elevationClicks: entry.elevationClicks,
      existing: kestrelProfiles[entry.ammoId] ?? null,
    });
    if (!profile) {
      setStatusNote("Klarte ikke å kalibrere MV fra DOPE.");
      return;
    }
    onUpsertKestrelProfile(profile);
    setStatusNote(
      `Kestrel MV kalibrert: ${profile.mvMps.toFixed(1)} m/s @ 15 °C (${entry.ammoLabel} @ ${entry.distanceM} m)`,
    );
  }

  return (
    <div
      className={
        embedded ? "dope-card-home dope-card-home--embedded" : "dope-card-home"
      }
    >
      {embedded ? null : (
        <LocationNav
          onBackToTown={onBack}
          backLabel={backLabel}
          hint="DOPE fra skytebanen — rediger avstand og klikk, eller slett linjer."
        />
      )}

      <header className="shop-header">
        {embedded ? null : (
          <p className="intro-line intro-gift">DOPE-kort</p>
        )}
        <p className="shop-row-note">
          {entries.length === 0
            ? "Ingen linjer ennå. Bruk «Add to DOPE» på skytebanen."
            : `${entries.length} linje${entries.length === 1 ? "" : "r"} · synlig i jakt (Enviro/App)`}
        </p>
        {statusNote ? <p className="shop-row-note">{statusNote}</p> : null}
      </header>

      {sorted.length === 0 ? null : (
        <ul className="dope-card-list">
          {sorted.map((entry) => {
            const editing = editingId === entry.id;
            const existing = kestrelProfiles[entry.ammoId];
            return (
              <li key={entry.id} className="dope-card-row">
                <div className="dope-card-row-top">
                  <span className="dope-card-when">
                    {formatWhen(entry.atMs)}
                  </span>
                  <span className="dope-card-ammo">{entry.ammoLabel}</span>
                </div>

                {editing ? (
                  <div className="dope-card-edit">
                    <label className="shop-filter">
                      Ammo-label
                      <input
                        type="text"
                        value={entry.ammoLabel}
                        onChange={(e) =>
                          onUpdate(entry.id, { ammoLabel: e.target.value })
                        }
                      />
                    </label>
                    <label className="shop-filter">
                      Avstand (m)
                      <input
                        type="number"
                        min={50}
                        max={800}
                        step={10}
                        value={entry.distanceM}
                        onChange={(e) =>
                          onUpdate(entry.id, {
                            distanceM: Number(e.target.value) || entry.distanceM,
                          })
                        }
                      />
                    </label>
                    <label className="shop-filter">
                      Elev (klikk, +D / −U)
                      <input
                        type="number"
                        step={1}
                        value={entry.elevationClicks}
                        onChange={(e) =>
                          onUpdate(entry.id, {
                            elevationClicks: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </label>
                    <label className="shop-filter">
                      Wind (klikk, +R / −L)
                      <input
                        type="number"
                        step={1}
                        value={entry.windageClicks}
                        onChange={(e) =>
                          onUpdate(entry.id, {
                            windageClicks: Number(e.target.value) || 0,
                          })
                        }
                      />
                    </label>
                    <div className="dope-card-edit-actions">
                      <button
                        type="button"
                        className="intro-button"
                        onClick={() => setEditingId(null)}
                      >
                        Ferdig
                      </button>
                      <button
                        type="button"
                        className="intro-button sheriff-secondary"
                        onClick={() => {
                          onRemove(entry.id);
                          setEditingId(null);
                        }}
                      >
                        Slett
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="dope-card-stats">
                      <strong>{entry.distanceM} m</strong>
                      {" · elev "}
                      {formatDopeElevationClicks(entry.elevationClicks)}
                      {entry.windageClicks !== 0 ? (
                        <>
                          {" · wind "}
                          {formatDopeWindageClicks(entry.windageClicks)}
                        </>
                      ) : null}
                      {existing
                        ? ` · Kestrel ${existing.mvMps.toFixed(0)} m/s`
                        : null}
                    </p>
                    <div className="dope-card-row-actions">
                      <button
                        type="button"
                        className="intro-button sheriff-secondary"
                        onClick={() => setEditingId(entry.id)}
                      >
                        Rediger
                      </button>
                      {onUpsertKestrelProfile ? (
                        <button
                          type="button"
                          className="intro-button"
                          disabled={!hasKestrel}
                          title={
                            hasKestrel
                              ? "Finn MV @ 15 °C som matcher DOPE elev"
                              : "Kestrel mangler i inventory/kit"
                          }
                          onClick={() => calibrateEntry(entry)}
                        >
                          Update Kestrel - Calibrate MV
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="intro-button sheriff-secondary"
                        onClick={() => onRemove(entry.id)}
                      >
                        Slett
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
