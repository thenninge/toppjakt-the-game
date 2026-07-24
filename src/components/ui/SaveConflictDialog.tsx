"use client";

import type { PlayerSaveV1 } from "@/lib/playerSave";

type SaveConflictDialogProps = {
  local: PlayerSaveV1;
  cloud: PlayerSaveV1;
  onChooseCloud: () => void;
  onChooseLocal: () => void;
  onCancelLogin: () => void;
};

function summarize(save: PlayerSaveV1): string {
  const s = save.stats;
  const when = new Date(save.savedAtMs).toLocaleString("nb-NO", {
    dateStyle: "short",
    timeStyle: "short",
  });
  return `${s.name || "?"} · ${s.balance.toLocaleString("nb-NO")} kr · kit ${s.kit.length} · ${when}`;
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
            Du har progress både lokalt og i skyen. Velg hvilken som skal gjelde
            — eller avbryt innloggingen og fortsett uten sky.
          </p>
          <p className="shop-row-note">
            <strong>Lokal:</strong> {summarize(local)}
          </p>
          <p className="shop-row-note">
            <strong>Sky:</strong> {summarize(cloud)}
          </p>
        </div>
        <div className="game-confirm-actions game-confirm-actions-stack">
          <button type="button" className="intro-button" onClick={onChooseCloud}>
            Last inn inventory fra sky
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={onChooseLocal}
          >
            Overskriv sky med lokalt inventory
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
