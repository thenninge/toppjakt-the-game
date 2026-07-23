"use client";

import { LocationNav } from "@/components/town/LocationNav";

type LaderommetViewProps = {
  onBack: () => void;
};

/**
 * Home — load development room (locked / waiting on parts).
 * See HOME_LOAD_DEVELOPMENT.md.
 */
export function LaderommetView({ onBack }: LaderommetViewProps) {
  return (
    <div className="laderommet">
      <LocationNav
        onBackToTown={onBack}
        backLabel="← Tilbake til hjem"
        hint="Laderommet er ikke klart ennå."
      />

      <header className="shop-header">
        <p className="intro-line intro-gift">Laderommet</p>
        <p className="intro-line">
          Venter på Post Nord skal komme med delene.
        </p>
      </header>

      <button type="button" className="intro-button" onClick={onBack}>
        Tilbake
      </button>
    </div>
  );
}
