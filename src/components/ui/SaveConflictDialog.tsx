"use client";

import {
  birdsPerKm,
  formatBirdsPerKm,
  formatLifetimeDistance,
  totalBirdsHarvested,
  type PlayerSaveV1,
} from "@/lib/playerSave";

type SaveConflictDialogProps = {
  local: PlayerSaveV1;
  cloud: PlayerSaveV1;
  onChooseCloud: () => void;
  onChooseLocal: () => void;
  onCancelLogin: () => void;
};

function totalBarrelShots(save: PlayerSaveV1): number {
  const counts = save.stats.rifleRoundCounts ?? {};
  return Object.values(counts).reduce(
    (sum, n) => sum + (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0),
    0,
  );
}

function summarize(save: PlayerSaveV1): string {
  const s = save.stats;
  const when = new Date(save.savedAtMs).toLocaleString("nb-NO", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const birds = totalBirdsHarvested(s);
  const km = formatLifetimeDistance(s.lifetimeDistanceM);
  const rate = formatBirdsPerKm(birdsPerKm(s));
  const shots = totalBarrelShots(save);
  const maxR = s.maxRange > 0 ? `${s.maxRange} m` : "—";
  const realN = Array.isArray(s.realLoadProfiles) ? s.realLoadProfiles.length : 0;
  return (
    `${s.name || "?"} · ${s.balance.toLocaleString("nb-NO")} kr · kit ${s.kit.length}\n` +
    `${km} gått · ${birds} fugl · ${rate}/km · ${shots} pipeskudd · max ${maxR}\n` +
    `Real data: ${realN} våpen` +
    (s.useRealDataInSimulation ? " · CB Real på" : "") +
    `\n${when}`
  );
}

/**
 * When both localStorage and cloud have a hunter save — user must pick.
 */
export function SaveConflictDialog({
  local,
  cloud,
  onChooseCloud,
  onChooseLocal,
  onCancelLogin,
}: SaveConflictDialogProps) {
  return (
    <div
      className="game-confirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-conflict-title"
    >
      <div className="game-confirm-panel" onClick={(e) => e.stopPropagation()}>
        <p id="save-conflict-title" className="intro-line intro-gift">
          To saves funnet
        </p>
        <div className="game-confirm-body">
          <p className="shop-row-note">
            Du har progress både lokalt og i skyen. Velg hvilken save som skal
            gjelde for inventar/penger/kit — livstids-km, fugl, max range,
            pipeskudd og Real data merges alltid (nyeste/høyeste vinner).
          </p>
          <p className="shop-row-note" style={{ whiteSpace: "pre-line" }}>
            <strong>Lokal:</strong>
            {"\n"}
            {summarize(local)}
          </p>
          <p className="shop-row-note" style={{ whiteSpace: "pre-line" }}>
            <strong>Sky:</strong>
            {"\n"}
            {summarize(cloud)}
          </p>
        </div>
        <div className="game-confirm-actions game-confirm-actions-stack">
          <button type="button" className="intro-button" onClick={onChooseCloud}>
            Last inn hele save fra sky
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={onChooseLocal}
          >
            Overskriv sky med lokal save
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={onCancelLogin}
          >
            Avbryt innlogging
          </button>
        </div>
      </div>
    </div>
  );
}
