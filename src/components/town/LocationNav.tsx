"use client";

type LocationNavProps = {
  onBackToTown: () => void;
  /** Button label (default: back to town). */
  backLabel?: string;
  /** Optional secondary label under the button row. */
  hint?: string;
};

/** Sticky escape hatch — always reachable even in long shop lists. */
export function LocationNav({
  onBackToTown,
  backLabel = "← Tilbake til byen",
  hint,
}: LocationNavProps) {
  return (
    <div className="location-nav">
      <button
        type="button"
        className="intro-button location-nav-back"
        onClick={onBackToTown}
      >
        {backLabel}
      </button>
      {hint ? <p className="location-nav-hint">{hint}</p> : null}
    </div>
  );
}
