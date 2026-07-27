"use client";

import { useState } from "react";
import {
  type DopeCardEntry,
  type InventoryEntry,
  type ShotLogEntry,
} from "@/lib/player";
import { extractChronoPoints } from "@/lib/shotlog/chronoDvDt";
import { LocationNav } from "@/components/town/LocationNav";
import { ShotLogView } from "@/components/town/ShotLogView";
import { DopeCardView } from "@/components/town/DopeCardView";
import { ChronoDvDtView } from "@/components/town/ChronoDvDtView";
import { RealDataView } from "@/components/town/RealDataView";
import type { InstalledCustomBarrel } from "@/lib/customs/customBarrel";
import type { KestrelGunProfile } from "@/lib/ballistics/kestrelProfile";
import type { RealLoadProfile } from "@/lib/ballistics/realLoad";

export type ShotLogDopeTab = "shotlog" | "dope" | "dvdt" | "real";

type ShotLogDopeViewProps = {
  shotLog: ShotLogEntry[];
  dopeCard: DopeCardEntry[];
  rifleRoundCounts?: Record<string, number>;
  customBarrels?: Record<string, InstalledCustomBarrel>;
  inventory: InventoryEntry[];
  kit: string[];
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
  realLoadProfiles?: RealLoadProfile[];
  useRealDataInSimulation?: boolean;
  onSaveRealLoad?: (profile: RealLoadProfile) => void;
  onRemoveRealLoad?: (id: string) => void;
  onSetUseRealData?: (enabled: boolean) => void;
};

/**
 * Home — Shotlog, DOPE, Xero dV/dT and Real data on one page with tabs.
 */
export function ShotLogDopeView({
  shotLog,
  dopeCard,
  rifleRoundCounts = {},
  customBarrels = {},
  inventory,
  kit,
  onUpdateDope,
  onRemoveDope,
  onBack,
  initialTab = "shotlog",
  hasKestrel = false,
  kestrelProfiles = {},
  onUpsertKestrelProfile,
  realLoadProfiles = [],
  useRealDataInSimulation = false,
  onSaveRealLoad,
  onRemoveRealLoad,
  onSetUseRealData,
}: ShotLogDopeViewProps) {
  const [tab, setTab] = useState<ShotLogDopeTab>(initialTab);
  const chronoCount = extractChronoPoints(shotLog).length;

  return (
    <div className="shot-log-dope">
      <LocationNav
        onBackToTown={onBack}
        backLabel="← Tilbake til hjem"
        hint="Målte serier, felt-DOPE, Xero dV/dT og CB Real loads — bytt fane under."
      />

      <header className="shop-header">
        <p className="intro-line intro-gift">Shotlog / Dope / dV/dT / CB Real</p>
        <p className="shop-row-note">
          {shotLog.length} serie{shotLog.length === 1 ? "" : "r"} ·{" "}
          {dopeCard.length} DOPE-linje{dopeCard.length === 1 ? "" : "r"} ·{" "}
          {chronoCount} chrono · {realLoadProfiles.length} CB Real
        </p>
      </header>

      <div
        className="home-data-tabs"
        role="tablist"
        aria-label="Shotlog, DOPE, dV/dT eller CB Real loads"
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
        <button
          type="button"
          role="tab"
          aria-selected={tab === "real"}
          className={
            tab === "real" ? "home-data-tab is-active" : "home-data-tab"
          }
          onClick={() => setTab("real")}
        >
          CB Real loads ({realLoadProfiles.length})
        </button>
      </div>

      {tab === "shotlog" ? (
        <ShotLogView
          entries={shotLog}
          rifleRoundCounts={rifleRoundCounts}
          customBarrels={customBarrels}
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
      ) : tab === "dvdt" ? (
        <ChronoDvDtView
          entries={shotLog}
          embedded
          hasKestrel={hasKestrel}
          kestrelProfiles={kestrelProfiles}
          onUpsertKestrelProfile={onUpsertKestrelProfile}
        />
      ) : (
        <RealDataView
          inventory={inventory}
          kit={kit}
          profiles={realLoadProfiles}
          useRealDataInSimulation={useRealDataInSimulation}
          onSaveProfile={(p) => onSaveRealLoad?.(p)}
          onRemoveProfile={(id) => onRemoveRealLoad?.(id)}
          onSetUseRealData={(v) => onSetUseRealData?.(v)}
          embedded
        />
      )}
    </div>
  );
}
