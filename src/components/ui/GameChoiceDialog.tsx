"use client";

export type GameChoiceOption = {
  id: string;
  label: string;
  /** Optional secondary line under the label. */
  note?: string;
};

type GameChoiceDialogProps = {
  title: string;
  /** Short hint above the list. */
  message?: string;
  choices: GameChoiceOption[];
  selectedId?: string | null;
  /** Allow clearing the current pick. */
  allowClear?: boolean;
  clearLabel?: string;
  emptyLabel?: string;
  onChoose: (id: string | null) => void;
  onCancel: () => void;
};

/**
 * In-game modal picker (list of options) — same look as GameConfirmDialog.
 */
export function GameChoiceDialog({
  title,
  message,
  choices,
  selectedId = null,
  allowClear = true,
  clearLabel = "Ingen / nullstill",
  emptyLabel = "Ingen alternativer i inventory.",
  onChoose,
  onCancel,
}: GameChoiceDialogProps) {
  return (
    <div
      className="game-confirm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-choice-title"
      onClick={onCancel}
    >
      <div
        className="game-confirm-panel game-choice-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="game-choice-title" className="intro-line intro-gift">
          {title}
        </p>
        {message ? (
          <div className="game-confirm-body">
            <p className="shop-row-note">{message}</p>
          </div>
        ) : null}

        <div className="game-confirm-actions game-confirm-actions-stack game-choice-list">
          {choices.length === 0 ? (
            <p className="shop-row-note">{emptyLabel}</p>
          ) : (
            choices.map((c) => {
              const selected = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  className={
                    selected
                      ? "intro-button game-choice-selected"
                      : "intro-button sheriff-secondary"
                  }
                  onClick={() => onChoose(c.id)}
                >
                  <span className="game-choice-label">{c.label}</span>
                  {c.note ? (
                    <span className="game-choice-note">{c.note}</span>
                  ) : null}
                </button>
              );
            })
          )}
          {allowClear ? (
            <button
              type="button"
              className="intro-button sheriff-secondary"
              onClick={() => onChoose(null)}
            >
              {clearLabel}
            </button>
          ) : null}
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={onCancel}
          >
            Avbryt
          </button>
        </div>
      </div>
    </div>
  );
}
