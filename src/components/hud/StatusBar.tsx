"use client";

type StatusBarProps = {
  musicEnabled: boolean;
  onMusicToggle: () => void;
  hunterStatusEnabled: boolean;
  onHunterStatusToggle: () => void;
};

export function StatusBar({
  musicEnabled,
  onMusicToggle,
  hunterStatusEnabled,
  onHunterStatusToggle,
}: StatusBarProps) {
  return (
    <header className="status-bar" aria-label="Status">
      <span className="status-bar-label">Cold Bore Toppjakt</span>
      <div className="status-bar-actions">
        <button
          type="button"
          className={
            hunterStatusEnabled
              ? "status-bar-btn is-active"
              : "status-bar-btn"
          }
          onClick={onHunterStatusToggle}
          aria-pressed={hunterStatusEnabled}
        >
          Hunter: {hunterStatusEnabled ? "On" : "Off"}
        </button>
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
