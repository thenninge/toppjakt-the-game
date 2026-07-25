"use client";

import { useMemo, useState } from "react";
import {
  formatKaboomChancePct,
} from "@/lib/reloading/loadPhysics";
import {
  formatLoadBookWhen,
  loadDevRowFromBookEntry,
  removeLoadBookEntry,
  type LoadBookEntry,
} from "@/lib/reloading/loadBook";
import type { SpentBrassKey } from "@/lib/reloading/brass";
import { LOAD_CALIBER_OPTIONS } from "@/lib/reloading/components";
import type { LoadDevRow } from "@/lib/reloading/loadDevTable";

type LadebokViewProps = {
  book: LoadBookEntry[];
  onChangeBook: (next: LoadBookEntry[]) => void;
  onRestoreToPlan: (row: LoadDevRow, caliberKey: SpentBrassKey) => void;
};

/**
 * Browse archived home loads — filter by caliber, restore to ladeplanen.
 */
export function LadebokView({
  book,
  onChangeBook,
  onRestoreToPlan,
}: LadebokViewProps) {
  const [caliberFilter, setCaliberFilter] = useState<SpentBrassKey | "all">(
    "all",
  );

  const filtered = useMemo(() => {
    const list =
      caliberFilter === "all"
        ? book
        : book.filter((e) => e.caliberKey === caliberFilter);
    return [...list].sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  }, [book, caliberFilter]);

  return (
    <section className="ladebok" aria-label="Ladebok">
      <p className="intro-line intro-gift">Ladebok</p>
      <p className="shop-row-note">
        Alle ladninger du tester eller lagrer fra ladeplanen havner her — slå opp
        gamle oppskrifter senere.
      </p>

      <label className="sheriff-field ladebok-filter">
        Kaliber
        <select
          className="intro-input"
          value={caliberFilter}
          onChange={(e) => {
            const v = e.target.value;
            setCaliberFilter(v === "all" ? "all" : (v as SpentBrassKey));
          }}
        >
          <option value="all">Alle ({book.length})</option>
          {LOAD_CALIBER_OPTIONS.map((o) => {
            const n = book.filter((e) => e.caliberKey === o.key).length;
            return (
              <option key={o.key} value={o.key}>
                {o.label} ({n})
              </option>
            );
          })}
        </select>
      </label>

      {filtered.length === 0 ? (
        <p className="shop-row-note">
          Tom ladebok. Test en rad i ladeplanen (eller lagre rad) for å fylle
          boka.
        </p>
      ) : (
        <ul className="ladebok-list">
          {filtered.map((entry) => (
            <li key={entry.id} className="ladebok-card">
              <div className="ladebok-card-top">
                <span className="ladebok-when">
                  {formatLoadBookWhen(entry.updatedAtMs)}
                </span>
                <span className="ladebok-caliber">{entry.caliberLabel}</span>
              </div>
              <p className="ladebok-recipe">
                {entry.powderLabel} · {entry.powderGrains.toFixed(1)} gr ·{" "}
                {entry.bulletLabel}
              </p>
              <p className="shop-row-note">
                Primer {entry.primerLabel}
                {entry.brassLabel ? ` · hylse ${entry.brassLabel}` : ""} · COL{" "}
                {entry.colMm.toFixed(1)} mm · seat {entry.seatingDepthThou} ·
                friflukt {entry.frifluktThou} · n={entry.shotsLoaded}
              </p>
              <dl className="ladebok-stats">
                <div>
                  <dt>Est. v₀</dt>
                  <dd>
                    {entry.estimatedV0Mps != null
                      ? `${entry.estimatedV0Mps} m/s`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Trykk</dt>
                  <dd
                    className={
                      entry.estimatedPressurePct != null &&
                      entry.estimatedPressurePct > 105
                        ? "laderommet-plan-danger"
                        : entry.estimatedPressurePct != null &&
                            entry.estimatedPressurePct > 100
                          ? "laderommet-plan-warn"
                          : undefined
                    }
                  >
                    {entry.estimatedPressurePct != null
                      ? `${entry.estimatedPressurePct.toFixed(1)} %`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Spreng</dt>
                  <dd
                    className={
                      entry.kaboomChance > 0
                        ? "laderommet-plan-danger"
                        : undefined
                    }
                  >
                    {formatKaboomChancePct(entry.kaboomChance)}
                  </dd>
                </div>
                <div>
                  <dt>Målt v₀</dt>
                  <dd>
                    {entry.measuredV0Mps != null
                      ? `${entry.measuredV0Mps.toFixed(1)} m/s`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Min / max</dt>
                  <dd>
                    {entry.measuredV0LowMps != null &&
                    entry.measuredV0HighMps != null
                      ? `${entry.measuredV0LowMps.toFixed(0)}–${entry.measuredV0HighMps.toFixed(0)}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>SD</dt>
                  <dd>
                    {entry.measuredV0StdevMps != null
                      ? `${entry.measuredV0StdevMps.toFixed(2)}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Samling</dt>
                  <dd>
                    {entry.measuredGroupMoa != null
                      ? `${entry.measuredGroupMoa.toFixed(2)}″`
                      : "—"}
                  </dd>
                </div>
              </dl>
              <div className="ladebok-card-actions">
                <button
                  type="button"
                  className="intro-button"
                  onClick={() =>
                    onRestoreToPlan(
                      loadDevRowFromBookEntry(entry),
                      entry.caliberKey,
                    )
                  }
                >
                  Hent til ladeplan
                </button>
                <button
                  type="button"
                  className="intro-button sheriff-secondary"
                  onClick={() =>
                    onChangeBook(removeLoadBookEntry(book, entry.id))
                  }
                >
                  Slett
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
