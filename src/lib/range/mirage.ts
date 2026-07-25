/**
 * Heat mirage — midpoint from barrel heat, continuous swing around it.
 *
 * Visible from 25 % heat. Mid ≈ heat × 2 × gear (scale past 1 when hot).
 * continuous(t) ≈ 1 ± 0.3 (slow sines) — no jumps.
 */

export {
  mirageFromBarrelHeat,
  MIRAGE_VISIBLE_FROM_HEAT,
  MIRAGE_HEAT_GAIN,
} from "@/lib/range/barrelHeat";

/** Cap for live mirage strength (heat×2 × swing can exceed 2 slightly). */
export const MIRAGE_STRENGTH_MAX = 2.4;

/** Swing amplitude around midpoint (±30 %). */
export const MIRAGE_SWING = 0.3;

export type MiragePhase = {
  a: number;
  b: number;
  c: number;
};

export function createMiragePhase(): MiragePhase {
  return {
    a: Math.random() * Math.PI * 2,
    b: Math.random() * Math.PI * 2,
    c: Math.random() * Math.PI * 2,
  };
}

/**
 * Continuous factor centered on 1 — slow heat-shimmer (± MIRAGE_SWING).
 * Stays smooth; never snaps.
 */
export function mirageContinuousFactor(
  tSec: number,
  phase: MiragePhase,
): number {
  const unit =
    0.5 * Math.sin(tSec * 0.42 + phase.a) +
    0.32 * Math.sin(tSec * 0.73 + phase.b) +
    0.18 * Math.sin(tSec * 1.15 + phase.c);
  return 1 + MIRAGE_SWING * Math.max(-1, Math.min(1, unit));
}

/**
 * Live mirage strength: midpoint × continuous(t).
 * Can exceed 1 when the pipe is hot (extended bad-mirage scale).
 */
export function mirageStrengthAtTime(
  midpoint: number,
  tSec: number,
  phase: MiragePhase,
): number {
  if (!(midpoint > 1e-4)) return 0;
  return Math.min(
    MIRAGE_STRENGTH_MAX,
    midpoint * mirageContinuousFactor(tSec, phase),
  );
}

/** Extra aim wobble (mm) from mirage shimmer. */
export function mirageWobbleMm(strength: number): number {
  if (strength <= 0) return 0;
  return strength * 6.4;
}

/**
 * Max fractional add to base MOA when mirageFactor = 1.
 * effective = base × (1 + mirageFactor × random() × 0.5)
 * e.g. 0.4 MOA @ factor 1 → up to 0.6 MOA.
 */
export const MIRAGE_MOA_RANDOM_MAX = 0.5;

/**
 * Per-shot MOA envelope with mirage: base + base × factor × U(0, 0.5).
 */
export function applyMirageToDispersionMoa(
  baseMoa: number,
  mirageFactor: number,
  random: () => number = Math.random,
): number {
  const base = Math.max(0, baseMoa);
  const factor = Math.max(0, mirageFactor);
  if (!(base > 0) || !(factor > 0)) return base;
  const u = Math.max(0, Math.min(1, random()));
  return base * (1 + factor * u * MIRAGE_MOA_RANDOM_MAX);
}
