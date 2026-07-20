"use client";

import {
  formatKestrelLcd,
  type BallisticHoldSolution,
} from "@/lib/ballistics/solver";

type KestrelFasitViewProps = {
  hold: BallisticHoldSolution;
  shotBearingDeg: number;
  windFromDeg: number;
  windSpeedMs: number;
  /** Compact = Aware sidebar; full = shoot HUD. */
  compact?: boolean;
};

/**
 * In-game Kestrel 5700 AB solution screen — fasit for elev + windage.
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
      className={compact ? "kestrel-fasit kestrel-fasit-compact" : "kestrel-fasit"}
      role="img"
      aria-label={`Kestrel fasit: ${lcd.elevLine}, ${lcd.windLine}`}
    >
      <img
        className="kestrel-fasit-device"
        src="/images/gear/kestrel-5700.png"
        alt="Kestrel 5700 Elite"
        draggable={false}
      />
      <div className="kestrel-fasit-lcd" aria-hidden>
        <p className="kestrel-lcd-line kestrel-lcd-e">{lcd.elevLine}</p>
        <p className="kestrel-lcd-line kestrel-lcd-w">{lcd.windLine}</p>
        <hr className="kestrel-lcd-rule" />
        <p className="kestrel-lcd-line kestrel-lcd-tgt">{lcd.tgtLine}</p>
        <p className="kestrel-lcd-line kestrel-lcd-wind">{lcd.windEnvLine}</p>
      </div>
    </div>
  );
}
