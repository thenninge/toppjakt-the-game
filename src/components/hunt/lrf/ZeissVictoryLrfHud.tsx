"use client";

export type ZeissVictoryLrfPhase = "idle" | "range" | "elev" | "done";

export type ZeissVictoryLrfHudProps = {
  phase: ZeissVictoryLrfPhase;
  /** Distance shown during `range` phase. */
  rangeM?: number | null;
  /** Absolute elevation clicks shown during `elev` phase. */
  elevClicks?: number | null;
  bluetooth?: boolean;
  className?: string;
};

/** Delay after LRF press before distance appears. */
export const ZEISS_VICTORY_ACQUIRE_MS = 400;
/** Seconds each Victory readout stays lit. */
export const ZEISS_VICTORY_PHASE_MS = 3000;

export function isZeissVictoryLrf(meta: {
  id?: string | null;
  brand?: string | null;
} | null | undefined): boolean {
  if (!meta) return false;
  if (meta.brand === "Zeiss") return true;
  return !!meta.id?.startsWith("lrf-zeiss-victory");
}

function formatDigits(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  const v = Math.max(0, Math.min(9999, Math.round(Math.abs(n))));
  return String(v);
}

/**
 * Zeiss Victory RF internal HUD — red OLED-style readout:
 * center ring + stem, digits, M (meters), Bluetooth.
 */
export function ZeissVictoryLrfHud({
  phase,
  rangeM = null,
  elevClicks = null,
  bluetooth = true,
  className,
}: ZeissVictoryLrfHudProps) {
  const showRange = phase === "range";
  const showElev = phase === "elev";
  const digits = showRange
    ? formatDigits(rangeM)
    : showElev
      ? formatDigits(elevClicks)
      : "";
  const metersLit = showRange;

  return (
    <div
      className={
        className
          ? `zeiss-victory-hud ${className}`
          : "zeiss-victory-hud"
      }
      aria-hidden
    >
      <div className="zeiss-victory-reticle">
        <span className="zeiss-victory-reticle-ring" />
      </div>

      <span
        className={
          bluetooth
            ? "zeiss-victory-icon zeiss-victory-bt is-on"
            : "zeiss-victory-icon zeiss-victory-bt"
        }
        title="Bluetooth"
      >
        <svg viewBox="0 0 24 24" width="1em" height="1em" aria-hidden>
          <path
            fill="currentColor"
            d="M12 2.5v7.2l4.4-3.3 1.2 1.6L13.4 12l4.2 3.9-1.2 1.6-4.4-3.3V21.5l-1.8-1.5v-5.3L5.8 17.9 4.6 16.3 9.2 12 4.6 7.7l1.2-1.6 4.4 3.3V4L12 2.5z"
          />
        </svg>
      </span>

      <span
        className={
          metersLit
            ? "zeiss-victory-unit zeiss-victory-unit-m is-on"
            : "zeiss-victory-unit zeiss-victory-unit-m"
        }
      >
        M
      </span>

      {digits ? (
        <span className="zeiss-victory-digits" data-phase={phase}>
          {digits}
        </span>
      ) : null}
    </div>
  );
}
