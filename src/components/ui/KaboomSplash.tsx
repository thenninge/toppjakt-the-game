"use client";

type KaboomSplashProps = {
  onDismiss: () => void;
};

/**
 * Overpressure kaboom splash — rifle gone, start over on the setup.
 */
export function KaboomSplash({ onDismiss }: KaboomSplashProps) {
  return (
    <div
      className="kaboom-splash"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kaboom-splash-title"
      onClick={onDismiss}
    >
      <div
        className="kaboom-splash-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="kaboom-splash-img"
          src="/images/rifle-kaboom.png"
          alt="Sprengt rifle — banana peel på pipa"
        />
        <p id="kaboom-splash-title" className="intro-line intro-gift">
          Yabadabadoo.. det var den rifla. Litt mye pepper i suppa, gitt.
        </p>
        <p className="shop-row-note kaboom-splash-sub">
          Du sprengte rifla og må starte på scratch.
        </p>
        <div className="kaboom-splash-actions">
          <button
            type="button"
            className="intro-button game-confirm-danger"
            onClick={onDismiss}
            autoFocus
          >
            Forstått
          </button>
        </div>
      </div>
    </div>
  );
}
