"use client";

type LocationNavProps = {
  onBackToTown: () => void;
  /** Optional secondary label under the button row. */
  hint?: string;
};

/** Sticky escape hatch — always reachable even in long shop lists. */
export function LocationNav({ onBackToTown, hint }: LocationNavProps) {
  return (
    <div className="location-nav">
      <button
        type="button"
        className="intro-button location-nav-back"
        onClick={onBackToTown}
      >
        ← Tilbake til byen
      </button>
      {hint ? <p className="location-nav-hint">{hint}</p> : null}
    </div>
  );
}
