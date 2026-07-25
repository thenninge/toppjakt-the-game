"use client";

import { useState } from "react";
import {
  type DopeCardEntry,
  type ShotLogEntry,
} from "@/lib/player";
import { extractChronoPoints } from "@/lib/shotlog/chronoDvDt";
import { LocationNav } from "@/components/town/LocationNav";
import { ShotLogView } from "@/components/town/ShotLogView";
import { DopeCardView } from "@/components/town/DopeCardView";
import { ChronoDvDtView } from "@/components/town/ChronoDvDtView";
import type { KestrelGunProfile } from "@/lib/ballistics/kestrelProfile";

export type ShotLogDopeTab = "shotlog" | "dope" | "dvdt";

type ShotLogDopeViewProps = {
  shotLog: ShotLogEntry[];
  dopeCard: DopeCardEntry[];
  rifleRoundCounts?: Record<string, number>;
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
  /** Open on a specific tab (e.g. DOPE from range). */
  initialTab?: ShotLogDopeTab;
  hasKestrel?: boolean;
  kestrelProfiles?: Record<string, KestrelGunProfile>;
  onUpsertKestrelProfile?: (profile: KestrelGunProfile) => void;
};

/**
 * Home — Shotlog, DOPE and Xero dV/dT on one page with tabs.
 */
export function ShotLogDopeView({
  shotLog,
  dopeCard,
  rifleRoundCounts = {},
  onUpdateDope,
  onRemoveDope,
  onBack,
  initialTab = "shotlog",
  hasKestrel = false,
  kestrelProfiles = {},
  onUpsertKestrelProfile,
}: ShotLogDopeViewProps) {
  const [tab, setTab] = useState<ShotLogDopeTab>(initialTab);
  const chronoCount = extractChronoPoints(shotLog).length;

  return (
    <div className="shot-log-dope">
      <LocationNav
        onBackToTown={onBack}
        backLabel="← Tilbake til hjem"
        hint="Målte serier, felt-DOPE og Xero dV/dT — bytt fane under."
      />

      <header className="shop-header">
        <p className="intro-line intro-gift">Shotlog / Dope / dV/dT</p>
        <p className="shop-row-note">
          {shotLog.length} serie{shotLog.length === 1 ? "" : "r"} ·{" "}
          {dopeCard.length} DOPE-linje{dopeCard.length === 1 ? "" : "r"} ·{" "}
          {chronoCount} chrono
        </p>
      </header>

      <div
        className="home-data-tabs"
        role="tablist"
        aria-label="Shotlog, DOPE eller dV/dT"
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
        <button
          type="button"
          role="tab"
          aria-selected={tab === "dvdt"}
          className={
            tab === "dvdt" ? "home-data-tab is-active" : "home-data-tab"
          }
          onClick={() => setTab("dvdt")}
        >
          dV/dT ({chronoCount})
        </button>
      </div>

      {tab === "shotlog" ? (
        <ShotLogView
          entries={shotLog}
          rifleRoundCounts={rifleRoundCounts}
          onBack={onBack}
          embedded
        />
      ) : tab === "dope" ? (
        <DopeCardView
          entries={dopeCard}
          onUpdate={onUpdateDope}
          onRemove={onRemoveDope}
          onBack={onBack}
          embedded
          hasKestrel={hasKestrel}
          kestrelProfiles={kestrelProfiles}
          onUpsertKestrelProfile={onUpsertKestrelProfile}
        />
      ) : (
        <ChronoDvDtView
          entries={shotLog}
          embedded
          hasKestrel={hasKestrel}
          kestrelProfiles={kestrelProfiles}
          onUpsertKestrelProfile={onUpsertKestrelProfile}
        />
      )}
    </div>
  );
}
