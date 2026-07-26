"use client";

import { isZeissVictoryLrf } from "@/components/hunt/lrf/ZeissVictoryLrfHud";

export type GenericSigLrfPhase = "idle" | "range" | "elev" | "wind" | "done";

export type SigElevDir = "up" | "down";
export type SigWindDir = "left" | "right";

export type GenericSigStyleLrfHudProps = {
  phase: GenericSigLrfPhase;
  rangeM?: number | null;
  inclineDeg?: number | null;
  elevMrad?: number | null;
  elevDir?: SigElevDir | null;
  windMrad?: number | null;
  windDir?: SigWindDir | null;
  className?: string;
};

/** Delay after LRF press before first readout. */
export const GENERIC_SIG_LRF_ACQUIRE_MS = 200;
/** Each phase (range / elev / wind) duration. */
export const GENERIC_SIG_LRF_PHASE_MS = 2000;
/** Full range→elev→wind loops before blank. */
export const GENERIC_SIG_LRF_CYCLES = 2;

/**
 * Non-Sig / non-Zeiss onboard-AB LRFs (e.g. Geovid) — legacy Sig-style HUD
 * below the reticle. Sig KILO3000 uses {@link SigSauerKilo3000LrfHud}.
 */
export function usesGenericSigStyleLrfHud(
  meta: {
    id?: string | null;
    brand?: string | null;
    hasOnboardBallistics?: boolean;
  } | null | undefined,
  opts?: { hasKestrel?: boolean; isSigKilo3000?: boolean },
): boolean {
  if (!meta) return false;
  if (isZeissVictoryLrf(meta)) return false;
  if (opts?.isSigKilo3000) return false;
  if (meta.hasOnboardBallistics) return true;
  return !!opts?.hasKestrel;
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
 * Legacy Sig-style OLED: reticle; range+incline below; elev/wind MRAD below.
 */
export function GenericSigStyleLrfHud({
  phase,
  rangeM = null,
  inclineDeg = null,
  elevMrad = null,
  elevDir = null,
  windMrad = null,
  windDir = null,
  className,
}: GenericSigStyleLrfHudProps) {
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
          ? `sig-kilo-hud generic-sig-lrf-hud ${className}`
          : "sig-kilo-hud generic-sig-lrf-hud"
      }
      aria-hidden
    >
      <div className="sig-kilo-reticle">
        <span className="sig-kilo-reticle-ring" />
      </div>

      {showRange ? (
        <div className="sig-kilo-range-block">
          <span className="sig-kilo-digits sig-kilo-range">
            {formatRange(rangeM)}
          </span>
          <span className="sig-kilo-unit">m</span>
          <span className="generic-sig-incline">
            <span className="generic-sig-arrow" aria-hidden>
              {inclineUp ? "▲" : "▼"}
            </span>
            <span className="sig-kilo-digits sig-kilo-incline-num">
              {inclineAbs}°
            </span>
          </span>
        </div>
      ) : null}

      {showElev ? (
        <div className="generic-sig-hold-block">
          <span className="generic-sig-arrow" aria-hidden>
            {elevDir === "down" ? "▼" : "▲"}
          </span>
          <span className="generic-sig-hold-value">
            <span className="sig-kilo-digits">{formatMrad(elevMrad)}</span>
            <span className="sig-kilo-unit">MRAD</span>
          </span>
        </div>
      ) : null}

      {showWind ? (
        <div className="generic-sig-hold-block">
          <span className="generic-sig-arrow" aria-hidden>
            {windDir === "left" ? "◀" : "▶"}
          </span>
          <span className="generic-sig-hold-value">
            <span className="sig-kilo-digits">{formatMrad(windMrad)}</span>
            <span className="sig-kilo-unit">MRAD</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Schedule acquire + 2× (range → elev → wind). */
export function scheduleGenericSigLrfSequence(
  setPhase: (p: GenericSigLrfPhase) => void,
  pushTimer: (id: number) => void,
  opts?: { skipWind?: boolean; skipElev?: boolean },
): void {
  const acquire = GENERIC_SIG_LRF_ACQUIRE_MS;
  const step = GENERIC_SIG_LRF_PHASE_MS;
  const hasElev = !opts?.skipElev;
  const hasWind = !opts?.skipWind && hasElev;
  const phases: GenericSigLrfPhase[] = ["range"];
  if (hasElev) phases.push("elev");
  if (hasWind) phases.push("wind");
  const cycleLen = phases.length * step;

  setPhase("idle");
  for (let c = 0; c < GENERIC_SIG_LRF_CYCLES; c++) {
    for (let i = 0; i < phases.length; i++) {
      const at = acquire + c * cycleLen + i * step;
      const p = phases[i]!;
      pushTimer(window.setTimeout(() => setPhase(p), at));
    }
  }
  pushTimer(
    window.setTimeout(
      () => setPhase("done"),
      acquire + GENERIC_SIG_LRF_CYCLES * cycleLen,
    ),
  );
}
