"use client";

import {
  formatKestrelLcd,
  type BallisticHoldSolution,
  type KestrelLcdCopy,
} from "@/lib/ballistics/solver";

type KestrelFasitViewProps = {
  hold: BallisticHoldSolution;
  shotBearingDeg: number;
  windFromDeg: number;
  windSpeedMs: number;
  /** Compact = tighter HUD; still shows device + zoom. */
  compact?: boolean;
};

function KestrelLcdLines({ lcd }: { lcd: KestrelLcdCopy }) {
  return (
    <>
      <p className="kestrel-lcd-line kestrel-lcd-e">{lcd.elevLine}</p>
      <p className="kestrel-lcd-line kestrel-lcd-w">{lcd.windLine}</p>
      <hr className="kestrel-lcd-rule" />
      <p className="kestrel-lcd-line kestrel-lcd-tgt">{lcd.tgtLine}</p>
      <p className="kestrel-lcd-line kestrel-lcd-wind">{lcd.windEnvLine}</p>
    </>
  );
}

function KestrelBirdMark() {
  return (
    <svg
      className="kestrel-zoom-bird"
      viewBox="0 0 24 16"
      aria-hidden
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M2 10c2.5-1.2 4.2-3.8 5.2-6.2.3 1.8 1.2 3.4 2.6 4.5 1.1.9 2.5 1.4 4 1.5-1.4.4-2.6 1.2-3.4 2.3-.5.7-.8 1.5-.9 2.4H8.2c.1-1.2.5-2.3 1.2-3.2.8-1.1 2-1.9 3.4-2.3C10.5 8.2 8.2 7 6.5 5.2 5.2 7.8 3.6 9.5 1.5 10.2L2 10zm14.5-1.2c1.8-.2 3.4.4 4.5 1.5-.9-.1-1.8 0-2.6.4-.9.4-1.6 1.1-2 1.9-.2-.8-.2-1.6.1-2.4.3-.6.8-1.1 1.5-1.4.5-.2 1-.3 1.5-.3-.8 0-1.6.1-2.3.4-.7.3-1.3.7-1.7 1.3z"
      />
    </svg>
  );
}

/**
 * In-game Kestrel 5700 AB solution screen — fasit for elev + windage.
 * Full device on the left; enlarged LCD panel on the right for readability.
 */
export function KestrelFasitView({
  hold,
  shotBearingDeg,
  windFromDeg,
  windSpeedMs,
  compact = false,
}: KestrelFasitViewProps) {
  const lcd = formatKestrelLcd(hold, {
    shotBearingDeg,
    windFromDeg,
    windSpeedMs,
  });

  return (
    <div
      className={
        compact ? "kestrel-fasit kestrel-fasit-compact" : "kestrel-fasit"
      }
      role="img"
      aria-label={`Kestrel fasit: ${lcd.elevLine}, ${lcd.windLine}`}
    >
      <div className="kestrel-fasit-device-wrap">
        <img
          className="kestrel-fasit-device"
          src="/images/gear/kestrel-5700.png"
          alt="Kestrel 5700 Elite"
          draggable={false}
        />
        <div className="kestrel-fasit-lcd" aria-hidden>
          <KestrelLcdLines lcd={lcd} />
        </div>
      </div>

      <aside className="kestrel-fasit-zoom" aria-label="Kestrel-skjerm (forstørret)">
        <div className="kestrel-zoom-bezel">
          <header className="kestrel-zoom-header">
            <KestrelBirdMark />
            <span className="kestrel-zoom-brand">Kestrel</span>
          </header>
          <div className="kestrel-zoom-lcd">
            <KestrelLcdLines lcd={lcd} />
          </div>
          <footer className="kestrel-zoom-footer">BALLISTICS</footer>
        </div>
      </aside>
    </div>
  );
}
