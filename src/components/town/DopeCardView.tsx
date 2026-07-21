"use client";

import { useState } from "react";
import {
  formatDopeElevationClicks,
  formatDopeWindageClicks,
  type DopeCardEntry,
} from "@/lib/player";
import { LocationNav } from "@/components/town/LocationNav";

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
}: DopeCardViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const sorted = [...entries].sort((a, b) => {
    const ammo = a.ammoLabel.localeCompare(b.ammoLabel, "nb");
    if (ammo !== 0) return ammo;
    return a.distanceM - b.distanceM;
  });

  return (
    <div className="dope-card-home">
      <LocationNav
        onBackToTown={onBack}
        backLabel={backLabel}
        hint="DOPE fra skytebanen — rediger avstand og klikk, eller slett linjer."
      />

      <header className="shop-header">
        <p className="intro-line intro-gift">DOPE-kort</p>
        <p className="shop-row-note">
          {entries.length === 0
            ? "Ingen linjer ennå. Bruk «Add to DOPE» på skytebanen."
            : `${entries.length} linje${entries.length === 1 ? "" : "r"} · synlig i jakt (Enviro/App)`}
        </p>
      </header>

      {sorted.length === 0 ? null : (
        <ul className="dope-card-list">
          {sorted.map((entry) => {
            const editing = editingId === entry.id;
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
                    </p>
                    <div className="dope-card-row-actions">
                      <button
                        type="button"
                        className="intro-button sheriff-secondary"
                        onClick={() => setEditingId(entry.id)}
                      >
                        Rediger
                      </button>
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
