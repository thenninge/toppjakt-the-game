"use client";

type GameConfirmDialogProps = {
  title: string;
  /** Body text — use `\n` for line breaks. */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Emphasize confirm as a destructive action. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * In-game modal confirm (replaces window.confirm / system dialogs).
 */
export function GameConfirmDialog({
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Avbryt",
  danger = false,
  onConfirm,
  onCancel,
}: GameConfirmDialogProps) {
  const lines = message.split("\n").filter((l) => l.length > 0);
  return (
    <div
      className="game-confirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-confirm-title"
      onClick={onCancel}
    >
      <div
        className="game-confirm-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="game-confirm-title" className="intro-line intro-gift">
          {title}
        </p>
        <div className="game-confirm-body">
          {lines.map((line, i) => (
            <p key={i} className="shop-row-note">
              {line}
            </p>
          ))}
        </div>
        <div className="game-confirm-actions">
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              danger ? "intro-button game-confirm-danger" : "intro-button"
            }
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
