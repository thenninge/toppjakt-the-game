"use client";

import { isZeissVictoryLrf } from "@/components/hunt/lrf/ZeissVictoryLrfHud";
import {
  isSigKilo3000Bdx,
  SIG_KILO3000_BDX_ID,
} from "@/components/hunt/SigBdxBallisticsApp";
import type { ScopeClickUnit } from "@/lib/optics/spec";

export type SigKiloPhase =
  | "off"
  | "status"
  | "range"
  | "elev"
  | "wind";

export type SigElevDir = "up" | "down";
export type SigWindDir = "left" | "right";

export type SigSauerKilo3000LrfHudProps = {
  phase: SigKiloPhase;
  rangeM?: number | null;
  /** Signed incline degrees (+ = uphill / aim up, − = downhill). */
  inclineDeg?: number | null;
  /** Hold in scope angular units (MRAD or MOA) — not clicks. */
  elevAngular?: number | null;
  elevDir?: SigElevDir | null;
  windAngular?: number | null;
  windDir?: SigWindDir | null;
  /** Kestrel linked → ABX; onboard ABU otherwise. */
  hasKestrel?: boolean;
  /** Rifle scope click unit — drives MOA vs MRAD label + hold scale. */
  clickUnit?: ScopeClickUnit;
  className?: string;
};

/** Delay after 2nd F before first range readout. */
export const SIG_KILO_ACQUIRE_MS = 150;
/** Each phase (range / elev / wind) duration. */
export const SIG_KILO_PHASE_MS = 1500;
/** Full range→elev→wind loops before blank. */
export const SIG_KILO_CYCLES = 5;
/** Splash (status) auto-off if F is not pressed again. */
export const SIG_KILO_STATUS_TIMEOUT_MS = 30_000;

export { SIG_KILO3000_BDX_ID };

/** True only for the Sig Sauer KILO3000 BDX SKU. */
export function isSigKilo3000Lrf(
  meta: { id?: string | null } | null | undefined,
): boolean {
  return isSigKilo3000Bdx(meta);
}

/**
 * @deprecated Other AB LRFs use {@link usesGenericSigStyleLrfHud}.
 * Prefer {@link isSigKilo3000Lrf} for the realistic KILO HUD.
 */
export function usesSigStyleBallisticLrfHud(
  meta: {
    id?: string | null;
    brand?: string | null;
    hasOnboardBallistics?: boolean;
  } | null | undefined,
  opts?: { hasKestrel?: boolean },
): boolean {
  if (!meta) return false;
  if (isZeissVictoryLrf(meta)) return false;
  if (isSigKilo3000Lrf(meta)) return true;
  if (meta.hasOnboardBallistics === false) return false;
  if (meta.hasOnboardBallistics) return true;
  return !!opts?.hasKestrel;
}

function formatAngular(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  const v = Math.max(0, Math.min(99.9, Math.abs(n)));
  return v.toFixed(1);
}

function formatRange(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "----";
  const v = Math.max(0, Math.min(9999.9, Math.abs(n)));
  return v.toFixed(1);
}

function formatIncline(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  const rounded = Math.round(n);
  if (rounded === 0) return "0°";
  return `${rounded}°`;
}

/** Shafted arrow (head + tail) — matches KILO OLED better than tip-only glyphs. */
function SigKiloArrow({
  dir,
}: {
  dir: SigElevDir | SigWindDir;
}) {
  const vertical = dir === "up" || dir === "down";
  return (
    <svg
      className={`sig-kilo-arrow sig-kilo-arrow--${dir}`}
      viewBox={vertical ? "0 0 12 18" : "0 0 18 12"}
      width={vertical ? 12 : 18}
      height={vertical ? 18 : 12}
      aria-hidden
    >
      {dir === "up" ? (
        <>
          <polygon points="6,1 11,8 1,8" fill="currentColor" />
          <rect x="4.5" y="7" width="3" height="10" fill="currentColor" />
        </>
      ) : null}
      {dir === "down" ? (
        <>
          <rect x="4.5" y="1" width="3" height="10" fill="currentColor" />
          <polygon points="6,17 11,10 1,10" fill="currentColor" />
        </>
      ) : null}
      {dir === "left" ? (
        <>
          <polygon points="1,6 8,1 8,11" fill="currentColor" />
          <rect x="7" y="4.5" width="10" height="3" fill="currentColor" />
        </>
      ) : null}
      {dir === "right" ? (
        <>
          <rect x="1" y="4.5" width="10" height="3" fill="currentColor" />
          <polygon points="17,6 10,1 10,11" fill="currentColor" />
        </>
      ) : null}
    </svg>
  );
}

/**
 * Sig Sauer KILO3000 BDX HUD — red OLED:
 * 1 status → 2 range+incline → 3 elev → 4 wind (×5) → off.
 */
export function SigSauerKilo3000LrfHud({
  phase,
  rangeM = null,
  inclineDeg = null,
  elevAngular = null,
  elevDir = null,
  windAngular = null,
  windDir = null,
  hasKestrel = false,
  clickUnit = "MRAD",
  className,
}: SigSauerKilo3000LrfHudProps) {
  if (phase === "off") return null;

  const showStatus = phase === "status";
  const showRange = phase === "range";
  const showElev = phase === "elev";
  const showWind = phase === "wind";
  const abMode = hasKestrel ? "ABX" : "ABU";

  return (
    <div
      className={className ? `sig-kilo-hud ${className}` : "sig-kilo-hud"}
      aria-hidden
    >
      <div className="sig-kilo-reticle">
        <span className="sig-kilo-reticle-ring" />
      </div>

      {showStatus ? (
        <>
          <span className="sig-kilo-top-blank" aria-hidden>
            ----
          </span>
          <span className="sig-kilo-label sig-kilo-label--last">LAST</span>
          <div className="sig-kilo-right-stack">
            <span className="sig-kilo-label">{abMode}</span>
            <span className="sig-kilo-battery" title="Battery" />
            <span className="sig-kilo-label sig-kilo-label--unit-dist">M</span>
          </div>
          <span className="sig-kilo-bottom-blank" aria-hidden>
            ----
          </span>
        </>
      ) : null}

      {showRange ? (
        <>
          <span className="sig-kilo-incline">{formatIncline(inclineDeg)}</span>
          <div className="sig-kilo-range-block">
            <span className="sig-kilo-digits sig-kilo-range">
              {formatRange(rangeM)}
            </span>
          </div>
        </>
      ) : null}

      {showElev || showWind ? (
        <>
          <div className="sig-kilo-hold-above">
            <SigKiloArrow
              dir={
                showElev
                  ? elevDir === "down"
                    ? "down"
                    : "up"
                  : windDir === "left"
                    ? "left"
                    : "right"
              }
            />
            <span className="sig-kilo-digits sig-kilo-hold-num">
              {formatAngular(showElev ? elevAngular : windAngular)}
            </span>
          </div>
          {/* Fixed slot — same coords for elev and wind (elev layout). */}
          <span className="sig-kilo-label sig-kilo-label--ang-unit">
            {clickUnit}
          </span>
        </>
      ) : null}
    </div>
  );
}

/**
 * After 2nd F: acquire delay, then 5× (range → elev → wind), then off.
 * Always cycles elev + wind (0.0 when no ballistic solution).
 */
export function scheduleSigKiloSequence(
  setPhase: (p: SigKiloPhase) => void,
  pushTimer: (id: number) => void,
): void {
  const acquire = SIG_KILO_ACQUIRE_MS;
  const step = SIG_KILO_PHASE_MS;
  const phases: SigKiloPhase[] = ["range", "elev", "wind"];
  const cycleLen = phases.length * step;

  for (let c = 0; c < SIG_KILO_CYCLES; c++) {
    for (let i = 0; i < phases.length; i++) {
      const at = acquire + c * cycleLen + i * step;
      const p = phases[i]!;
      pushTimer(window.setTimeout(() => setPhase(p), at));
    }
  }
  pushTimer(
    window.setTimeout(
      () => setPhase("off"),
      acquire + SIG_KILO_CYCLES * cycleLen,
    ),
  );
}
