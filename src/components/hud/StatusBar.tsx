"use client";

type StatusBarProps = {
  musicEnabled: boolean;
  onMusicToggle: () => void;
};

export function StatusBar({ musicEnabled, onMusicToggle }: StatusBarProps) {
  return (
    <header className="status-bar" aria-label="Status">
      <span className="status-bar-label">Cold Bore Toppjakt</span>
      <div className="status-bar-actions">
        <button
          type="button"
          className={
            musicEnabled
              ? "status-bar-btn is-active"
              : "status-bar-btn"
          }
          onClick={onMusicToggle}
          aria-pressed={musicEnabled}
        >
          Music: {musicEnabled ? "On" : "Off"}
        </button>
      </div>
    </header>
  );
}
