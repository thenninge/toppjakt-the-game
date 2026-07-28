"use client";

export const CHAPTER_TITLE = "The Quest for Cold Bore's Treasure";

type AmigaChapterIntroProps = {
  onContinue: () => void;
};

/**
 * Amiga-era title card after the loading splash — Workbench chrome + pixel portrait.
 * Stays until the player clicks (no auto-advance).
 */
export function AmigaChapterIntro({ onContinue }: AmigaChapterIntroProps) {
  return (
    <div
      className="amiga-chapter"
      role="dialog"
      aria-labelledby="amiga-chapter-title"
      aria-describedby="amiga-chapter-chapter"
    >
      <button
        type="button"
        className="amiga-chapter-hit"
        onClick={onContinue}
        aria-label="Continue"
      />
      <div className="amiga-chapter-window" aria-hidden={false}>
        <div className="amiga-chapter-titlebar">
          <span className="amiga-chapter-gadget" aria-hidden />
          <span className="amiga-chapter-titlebar-text">
            Cold Bore Toppjakt
          </span>
          <span className="amiga-chapter-gadget amiga-chapter-gadget-depth" aria-hidden />
        </div>
        <div className="amiga-chapter-body">
          <div className="amiga-chapter-portrait-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/intro/amiga-hunter.png"
              alt=""
              className="amiga-chapter-portrait"
              width={512}
              height={512}
              draggable={false}
            />
            <div className="amiga-chapter-scanlines" aria-hidden />
          </div>
          <div className="amiga-chapter-copy">
            <p id="amiga-chapter-title" className="amiga-chapter-game">
              Cold Bore Toppjakt
            </p>
            <p id="amiga-chapter-chapter" className="amiga-chapter-line">
              Chapter: {CHAPTER_TITLE}
            </p>
            <p className="amiga-chapter-copyright">
              (c) Parabox Productions - 2026
            </p>
            <p className="amiga-chapter-click">Click to continue</p>
          </div>
        </div>
      </div>
    </div>
  );
}
