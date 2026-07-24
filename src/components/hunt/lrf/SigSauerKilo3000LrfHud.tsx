"use client";

import { isZeissVictoryLrf } from "@/components/hunt/lrf/ZeissVictoryLrfHud";

export type SigKiloPhase = "idle" | "range" | "elev" | "wind" | "done";

export type SigElevDir = "up" | "down";
export type SigWindDir = "left" | "right";

export type SigSauerKilo3000LrfHudProps = {
  phase: SigKiloPhase;
  rangeM?: number | null;
  /** Signed incline degrees (+ = uphill / aim up, − = downhill). */
  inclineDeg?: number | null;
  elevMrad?: number | null;
  elevDir?: SigElevDir | null;
  windMrad?: number | null;
  windDir?: SigWindDir | null;
  className?: string;
};

/** Delay after LRF press before first readout. */
export const SIG_KILO_ACQUIRE_MS = 200;
/** Each phase (range / elev / wind) duration. */
export const SIG_KILO_PHASE_MS = 2000;
/** Full range→elev→wind loops before blank. */
export const SIG_KILO_CYCLES = 2;

/**
 * Sig-style MRAD hold HUD (KILO3000 layout).
 * Used for Sig, Leica Geovid, and other onboard-AB / Kestrel-linked LRFs.
 * Zeiss Victory keeps its own display.
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
  if (meta.hasOnboardBallistics) return true;
  return !!opts?.hasKestrel;
}

/** @deprecated Prefer {@link usesSigStyleBallisticLrfHud}. */
export function isSigKilo3000Lrf(meta: {
  id?: string | null;
  brand?: string | null;
  hasOnboardBallistics?: boolean;
} | null | undefined): boolean {
  return usesSigStyleBallisticLrfHud(meta);
}

function formatMrad(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  const v = Math.max(0, Math.min(99.9, Math.abs(n)));
  return v.toFixed(1);
}

function formatRange(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return String(Math.max(0, Math.min(9999, Math.round(Math.abs(n)))));
}

/**
 * Sig Sauer KILO3000 BDX HUD — red OLED:
 * reticle; range+incline; elev MRAD + ↑/↓; wind MRAD + ←/→.
 */
export function SigSauerKilo3000LrfHud({
  phase,
  rangeM = null,
  inclineDeg = null,
  elevMrad = null,
  elevDir = null,
  windMrad = null,
  windDir = null,
  className,
}: SigSauerKilo3000LrfHudProps) {
  const showRange = phase === "range";
  const showElev = phase === "elev";
  const showWind = phase === "wind";

  const inclineAbs =
    inclineDeg != null && Number.isFinite(inclineDeg)
      ? Math.abs(Math.round(inclineDeg))
      : 0;
  const inclineUp = (inclineDeg ?? 0) >= 0;

  return (
    <div
      className={
        className
          ? `sig-kilo-hud ${className}`
          : "sig-kilo-hud"
      }
      aria-hidden
    >
      <div className="sig-kilo-reticle">
        <span className="sig-kilo-reticle-ring" />
      </div>

      {showRange ? (
        <div className="sig-kilo-range-block">
          <span className="sig-kilo-digits sig-kilo-range">{formatRange(rangeM)}</span>
          <span className="sig-kilo-unit">m</span>
          <span className="sig-kilo-incline">
            <span className="sig-kilo-arrow" aria-hidden>
              {inclineUp ? "▲" : "▼"}
            </span>
            <span className="sig-kilo-digits sig-kilo-incline-num">
              {inclineAbs}°
            </span>
          </span>
        </div>
      ) : null}

      {showElev ? (
        <div className="sig-kilo-hold-block">
          <span className="sig-kilo-arrow sig-kilo-arrow--elev" aria-hidden>
            {elevDir === "down" ? "▼" : "▲"}
          </span>
          <span className="sig-kilo-hold-value">
            <span className="sig-kilo-digits">{formatMrad(elevMrad)}</span>
            <span className="sig-kilo-unit">MRAD</span>
          </span>
        </div>
      ) : null}

      {showWind ? (
        <div className="sig-kilo-hold-block">
          <span className="sig-kilo-arrow sig-kilo-arrow--wind" aria-hidden>
            {windDir === "left" ? "◀" : "▶"}
          </span>
          <span className="sig-kilo-hold-value">
            <span className="sig-kilo-digits">{formatMrad(windMrad)}</span>
            <span className="sig-kilo-unit">MRAD</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Schedule timeouts for acquire + 2× (range → elev → wind). */
export function scheduleSigKiloSequence(
  setPhase: (p: SigKiloPhase) => void,
  pushTimer: (id: number) => void,
  opts?: { skipWind?: boolean; skipElev?: boolean },
): void {
  const acquire = SIG_KILO_ACQUIRE_MS;
  const step = SIG_KILO_PHASE_MS;
  const hasElev = !opts?.skipElev;
  const hasWind = !opts?.skipWind && hasElev;
  const phases: SigKiloPhase[] = ["range"];
  if (hasElev) phases.push("elev");
  if (hasWind) phases.push("wind");
  const cycleLen = phases.length * step;

  setPhase("idle");
  for (let c = 0; c < SIG_KILO_CYCLES; c++) {
    for (let i = 0; i < phases.length; i++) {
      const at = acquire + c * cycleLen + i * step;
      const p = phases[i]!;
      pushTimer(window.setTimeout(() => setPhase(p), at));
    }
  }
  pushTimer(
    window.setTimeout(
      () => setPhase("done"),
      acquire + SIG_KILO_CYCLES * cycleLen,
    ),
  );
}
