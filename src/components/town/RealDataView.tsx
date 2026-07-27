"use client";

import { useMemo, useState } from "react";
import type { InventoryEntry } from "@/lib/player";
import {
  canEnableRealDataSimulation,
  convertRealDropsUnit,
  createEmptyRealLoad,
  emptyRealDrops,
  REAL_DROP_UNIT_LABEL,
  REAL_DROP_UNITS,
  realLoadIsCompleteEnough,
  roundDropValue,
  type RealDropUnit,
  type RealLoadProfile,
} from "@/lib/ballistics/realLoad";
import { getShopItem } from "@/lib/shop/catalog";
import { isRifleItem, type ShopItem } from "@/lib/shop/types";

type RealDataViewProps = {
  inventory: InventoryEntry[];
  kit: string[];
  profiles: RealLoadProfile[];
  useRealDataInSimulation: boolean;
  onSaveProfile: (profile: RealLoadProfile) => void;
  onRemoveProfile: (id: string) => void;
  onSetUseRealData: (enabled: boolean) => void;
  embedded?: boolean;
};

function ownedRifles(inventory: InventoryEntry[]): ShopItem[] {
  const out: ShopItem[] = [];
  for (const entry of inventory) {
    const item = getShopItem(entry.itemId);
    if (item && isRifleItem(item)) out.push(item);
  }
  return out;
}

function rifleLabel(item: ShopItem): string {
  return `${item.brand} ${item.name}`;
}

/**
 * Home — enter real-world ballistic data for simulator / procedure training.
 */
export function RealDataView({
  inventory,
  kit,
  profiles,
  useRealDataInSimulation,
  onSaveProfile,
  onRemoveProfile,
  onSetUseRealData,
  embedded = false,
}: RealDataViewProps) {
  const rifles = useMemo(() => ownedRifles(inventory), [inventory]);
  const canEnable = canEnableRealDataSimulation(
    inventory.map((e) => e.itemId),
    kit,
  );

  const [selectedRifleId, setSelectedRifleId] = useState<string>(
    () => profiles[0]?.rifleId ?? rifles[0]?.id ?? "",
  );
  const existing = profiles.find((p) => p.rifleId === selectedRifleId) ?? null;
  const [draft, setDraft] = useState<RealLoadProfile | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [moveTargetId, setMoveTargetId] = useState("");

  const selectedRifle = rifles.find((r) => r.id === selectedRifleId) ?? null;

  const otherRifles = useMemo(
    () => rifles.filter((r) => r.id !== selectedRifleId),
    [rifles, selectedRifleId],
  );

  const editing =
    draft ??
    existing ??
    (selectedRifle
      ? createEmptyRealLoad({
          rifleId: selectedRifle.id,
          rifleLabel: rifleLabel(selectedRifle),
        })
      : null);

  function selectRifle(rifleId: string) {
    setSelectedRifleId(rifleId);
    setDraft(null);
    setNote(null);
    setMoveTargetId("");
  }

  function patchDraft(patch: Partial<RealLoadProfile>) {
    if (!editing) return;
    const rifle = rifles.find((r) => r.id === (patch.rifleId ?? editing.rifleId));
    setDraft({
      ...editing,
      ...patch,
      rifleLabel: rifle ? rifleLabel(rifle) : editing.rifleLabel,
      drops: patch.drops ?? editing.drops,
      updatedAtMs: Date.now(),
    });
  }

  function setDrop(distanceM: number, raw: string) {
    if (!editing) return;
    const trimmed = raw.trim();
    const parsed =
      trimmed === ""
        ? null
        : Number.isFinite(Number(trimmed))
          ? Number(trimmed)
          : null;
    const drops = (editing.drops.length ? editing.drops : emptyRealDrops()).map(
      (row) =>
        row.distanceM === distanceM
          ? {
              ...row,
              value:
                parsed != null
                  ? roundDropValue(parsed, editing.dropUnit)
                  : null,
            }
          : row,
    );
    patchDraft({ drops });
  }

  function setDropUnit(next: RealDropUnit) {
    if (!editing) return;
    if (next === editing.dropUnit) return;
    patchDraft({
      dropUnit: next,
      drops: convertRealDropsUnit(editing.drops, editing.dropUnit, next),
    });
  }

  function dropInputStep(unit: RealDropUnit): string {
    if (unit === "mrad") return "0.01";
    if (unit === "klikk") return "0.1";
    if (unit === "mm") return "1";
    return "0.1";
  }

  function save() {
    if (!editing) return;
    if (!realLoadIsCompleteEnough(editing)) {
      setNote(
        "Fyll inn kule, vekt, BC, v₀ og spredning (Best ≤ Avg MOA) før lagring.",
      );
      return;
    }
    onSaveProfile(editing);
    setDraft(null);
    setNote("Real data lagret.");
  }

  function remove() {
    if (!existing) return;
    onRemoveProfile(existing.id);
    setDraft(null);
    setNote("Real data slettet for dette våpenet.");
  }

  function moveToRifle() {
    if (!editing || !existing) return;
    const target = rifles.find((r) => r.id === moveTargetId);
    if (!target) {
      setNote("Velg våpen å flytte til.");
      return;
    }
    if (profiles.some((p) => p.rifleId === target.id && p.id !== existing.id)) {
      const ok = window.confirm(
        `${rifleLabel(target)} har allerede Real data. Overskriv med denne profilen?`,
      );
      if (!ok) return;
    }
    const moved: RealLoadProfile = {
      ...editing,
      rifleId: target.id,
      rifleLabel: rifleLabel(target),
      updatedAtMs: Date.now(),
    };
    if (!realLoadIsCompleteEnough(moved)) {
      setNote("Fyll inn kule, vekt, BC og v₀ før flytting.");
      return;
    }
    onSaveProfile(moved);
    setSelectedRifleId(target.id);
    setDraft(null);
    setMoveTargetId("");
    setNote(`Flyttet til ${rifleLabel(target)}.`);
  }

  return (
    <div
      className={
        embedded ? "real-data-home real-data-home--embedded" : "real-data-home"
      }
    >
      {!embedded ? (
        <header className="shop-header">
          <p className="intro-line intro-gift">CB Real loads</p>
        </header>
      ) : null}

      <p className="shop-row-note">
        Legg inn ekte ballistikk for ditt våpen — brukes som simulator når du
        skyter CB Customs home loads. Dropp-tabell ved 0 °C, 65 % RH, 1 atm.
        Lagres i jeger-profilen (lokalt med en gang; til sky automatisk når du
        er innlogget med Google).
      </p>

      <label className="real-data-use">
        <input
          type="checkbox"
          checked={useRealDataInSimulation && canEnable}
          disabled={!canEnable}
          onChange={(e) => onSetUseRealData(e.target.checked)}
        />
        <span>
          Use CB Real loads in simulation
          {!canEnable ? (
            <span className="real-data-use-hint">
              {" "}
              — krever LRF med ballistic computer eller Kestrel i eie
            </span>
          ) : (
            <span className="real-data-use-hint">
              {" "}
              — kun CB Customs home-load ammo (dropp-kort + din v₀/BC)
            </span>
          )}
        </span>
      </label>

      {rifles.length === 0 ? (
        <p className="shop-row-note">Du eier ingen rifler ennå.</p>
      ) : (
        <>
          <label className="real-data-field">
            <span>Våpen</span>
            <select
              className="stats-rename-input"
              value={selectedRifleId}
              onChange={(e) => selectRifle(e.target.value)}
            >
              {rifles.map((r) => (
                <option key={r.id} value={r.id}>
                  {rifleLabel(r)}
                  {profiles.some((p) => p.rifleId === r.id) ? " · lagret" : ""}
                </option>
              ))}
            </select>
          </label>

          {editing ? (
            <div className="real-data-form">
              <label className="real-data-field">
                <span>Kule (merke / type)</span>
                <input
                  className="stats-rename-input"
                  placeholder="f.eks. Lapua Scenar"
                  value={editing.bulletLabel}
                  onChange={(e) => patchDraft({ bulletLabel: e.target.value })}
                />
              </label>

              <div className="real-data-grid">
                <label className="real-data-field">
                  <span>Vekt (grains)</span>
                  <input
                    className="stats-rename-input"
                    type="number"
                    min={0}
                    step={0.1}
                    value={editing.weightGrains || ""}
                    onChange={(e) =>
                      patchDraft({
                        weightGrains: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <label className="real-data-field">
                  <span>BC</span>
                  <input
                    className="stats-rename-input"
                    type="number"
                    min={0.05}
                    max={2}
                    step={0.001}
                    value={editing.bc}
                    onChange={(e) =>
                      patchDraft({ bc: Number(e.target.value) || 0 })
                    }
                  />
                </label>
                <label className="real-data-field">
                  <span>BC-modell</span>
                  <select
                    className="stats-rename-input"
                    value={editing.bcModel}
                    onChange={(e) =>
                      patchDraft({
                        bcModel: e.target.value === "G1" ? "G1" : "G7",
                      })
                    }
                  >
                    <option value="G7">G7</option>
                    <option value="G1">G1</option>
                  </select>
                </label>
              </div>

              <div className="real-data-grid">
                <label className="real-data-field">
                  <span>v₀ avg (m/s)</span>
                  <input
                    className="stats-rename-input"
                    type="number"
                    min={50}
                    max={1400}
                    step={0.1}
                    value={editing.v0AvgMps}
                    onChange={(e) =>
                      patchDraft({
                        v0AvgMps: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <label className="real-data-field">
                  <span>v₀ SD (m/s)</span>
                  <input
                    className="stats-rename-input"
                    type="number"
                    min={0}
                    max={50}
                    step={0.01}
                    value={editing.v0SdMps}
                    onChange={(e) =>
                      patchDraft({
                        v0SdMps: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <label className="real-data-field">
                  <span>dV/dT (m/s/°C)</span>
                  <input
                    className="stats-rename-input"
                    type="number"
                    step={0.01}
                    value={editing.dvDtMpsPerC}
                    onChange={(e) =>
                      patchDraft({
                        dvDtMpsPerC: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
              </div>

              <p className="stats-menu-heading">
                Spredning MOA — målt 5-skudds ES
              </p>
              <p className="shop-row-note real-data-drop-hint">
                Oppgi ekstrem spredning (ES) fra 5-skuddsgrupper. Avg = snitt ES,
                Best = typisk beste dag (≈ Avg − 3σ). Motoren skalerer ES →
                envelope (ES ≈ 3.1σ), og sampler én serie-envelope uten ekstra
                wobble/avtrekk. Kun CB Customs home-load ammo.
              </p>
              <div className="real-data-grid real-data-grid-2">
                <label className="real-data-field">
                  <span>Best ES (MOA)</span>
                  <input
                    className="stats-rename-input"
                    type="number"
                    min={0.05}
                    max={10}
                    step={0.01}
                    value={editing.groupMoaBest}
                    onChange={(e) =>
                      patchDraft({
                        groupMoaBest: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
                <label className="real-data-field">
                  <span>Avg ES (MOA)</span>
                  <input
                    className="stats-rename-input"
                    type="number"
                    min={0.05}
                    max={10}
                    step={0.01}
                    value={editing.groupMoaAvg}
                    onChange={(e) =>
                      patchDraft({
                        groupMoaAvg: Number(e.target.value) || 0,
                      })
                    }
                  />
                </label>
              </div>

              <div className="real-data-drop-head">
                <p className="stats-menu-heading">
                  Dropp — 0 °C / 65 % RH / 1 atm
                </p>
                <label className="real-data-field real-data-drop-unit">
                  <span>Enhet</span>
                  <select
                    className="stats-rename-input"
                    value={editing.dropUnit}
                    onChange={(e) =>
                      setDropUnit(e.target.value as RealDropUnit)
                    }
                  >
                    {REAL_DROP_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {REAL_DROP_UNIT_LABEL[u]}
                        {u === "mrad"
                          ? " (Kestrel)"
                          : u === "klikk"
                            ? " (0,1 mil)"
                            : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="shop-row-note real-data-drop-hint">
                {editing.dropUnit === "klikk"
                  ? "Angi elev i tårn-klikk (0,1 mil) pr avstand — 10 klikk = 1 mrad. F.eks. 37,5 @ 500 m."
                  : editing.dropUnit === "mrad"
                    ? "Angi dropp i mrad pr avstand — slik Kestrel / AB viser elev."
                    : editing.dropUnit === "mm"
                      ? "Angi dropp i mm under siktelinjen pr avstand."
                      : "Angi dropp i cm under siktelinjen pr avstand."}
              </p>
              <div className="real-data-drops">
                {(editing.drops.length ? editing.drops : emptyRealDrops()).map(
                  (row) => (
                    <label key={row.distanceM} className="real-data-drop-cell">
                      <span>
                        {row.distanceM} m
                        <span className="real-data-drop-unit-tag">
                          {REAL_DROP_UNIT_LABEL[editing.dropUnit]}
                        </span>
                      </span>
                      <input
                        className="stats-rename-input"
                        type="number"
                        step={dropInputStep(editing.dropUnit)}
                        placeholder="—"
                        value={row.value ?? ""}
                        onChange={(e) =>
                          setDrop(row.distanceM, e.target.value)
                        }
                      />
                    </label>
                  ),
                )}
              </div>

              <div className="real-data-actions">
                <button
                  type="button"
                  className="intro-button"
                  onClick={save}
                >
                  Lagre
                </button>
                {existing ? (
                  <button
                    type="button"
                    className="intro-button intro-button-ghost"
                    onClick={remove}
                  >
                    Slett
                  </button>
                ) : null}
              </div>

              {existing && otherRifles.length > 0 ? (
                <div className="real-data-move">
                  <p className="stats-menu-heading">Flytt til annet våpen</p>
                  <p className="shop-row-note">
                    Feil våpen? Flytt hele profilen (kule, v₀, dropp) uten å
                    taste inn på nytt.
                  </p>
                  <div className="real-data-move-row">
                    <select
                      className="stats-rename-input"
                      value={moveTargetId}
                      onChange={(e) => setMoveTargetId(e.target.value)}
                      aria-label="Flytt til våpen"
                    >
                      <option value="">Velg våpen…</option>
                      {otherRifles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {rifleLabel(r)}
                          {profiles.some((p) => p.rifleId === r.id)
                            ? " · har data"
                            : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="intro-button"
                      disabled={!moveTargetId}
                      onClick={moveToRifle}
                    >
                      Flytt
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      {note ? <p className="shop-row-note">{note}</p> : null}

      {profiles.length > 0 ? (
        <ul className="real-data-list">
          {profiles.map((p) => (
            <li key={p.id}>
              <strong>{p.rifleLabel}</strong> — {p.bulletLabel || "?"} ·{" "}
              {p.weightGrains} gr · {p.bcModel} {p.bc} · v₀ {p.v0AvgMps}±
              {p.v0SdMps} · dV/dT {p.dvDtMpsPerC} · gruppe {p.groupMoaBest}/
              {p.groupMoaAvg} MOA
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
