"use client";

import { useState } from "react";
import {
  type DopeCardEntry,
  type ShotLogEntry,
} from "@/lib/player";
import { LocationNav } from "@/components/town/LocationNav";
import { ShotLogView } from "@/components/town/ShotLogView";
import { DopeCardView } from "@/components/town/DopeCardView";

type Tab = "shotlog" | "dope";

type ShotLogDopeViewProps = {
  shotLog: ShotLogEntry[];
  dopeCard: DopeCardEntry[];
  onUpdateDope: (
    id: string,
    patch: Partial<
      Pick<
        DopeCardEntry,
        "distanceM" | "elevationClicks" | "windageClicks" | "ammoLabel"
      >
    >,
  ) => void;
  onRemoveDope: (id: string) => void;
  onBack: () => void;
  /** Open on DOPE tab when coming from range «Se/edit DOPE». */
  initialTab?: Tab;
};

/**
 * Home — Shotlog and DOPE on one page with tabs.
 */
export function ShotLogDopeView({
  shotLog,
  dopeCard,
  onUpdateDope,
  onRemoveDope,
  onBack,
  initialTab = "shotlog",
}: ShotLogDopeViewProps) {
  const [tab, setTab] = useState<Tab>(initialTab);

  return (
    <div className="shot-log-dope">
      <LocationNav
        onBackToTown={onBack}
        backLabel="← Tilbake til hjem"
        hint="Målte serier og felt-DOPE — bytt fane under."
      />

      <header className="shop-header">
        <p className="intro-line intro-gift">Shotlog / Dope</p>
        <p className="shop-row-note">
          {shotLog.length} serie{shotLog.length === 1 ? "" : "r"} ·{" "}
          {dopeCard.length} DOPE-linje{dopeCard.length === 1 ? "" : "r"}
        </p>
      </header>

      <div
        className="home-data-tabs"
        role="tablist"
        aria-label="Shotlog eller DOPE"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "shotlog"}
          className={
            tab === "shotlog"
              ? "home-data-tab is-active"
              : "home-data-tab"
          }
          onClick={() => setTab("shotlog")}
        >
          Shotlog ({shotLog.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "dope"}
          className={
            tab === "dope" ? "home-data-tab is-active" : "home-data-tab"
          }
          onClick={() => setTab("dope")}
        >
          DOPE ({dopeCard.length})
        </button>
      </div>

      {tab === "shotlog" ? (
        <ShotLogView
          entries={shotLog}
          onBack={onBack}
          embedded
        />
      ) : (
        <DopeCardView
          entries={dopeCard}
          onUpdate={onUpdateDope}
          onRemove={onRemoveDope}
          onBack={onBack}
          embedded
        />
      )}
    </div>
  );
}
