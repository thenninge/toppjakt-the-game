/**
 * Ettersøk — flee observation cues + find chance from track work.
 */

import {
  AWARE_METERS_PER_PCT,
  bearingDegFromTo,
  distanceMBetween,
  type CellPoint,
} from "@/lib/aware/cellGeometry";
import type { ShotPair } from "@/lib/aware/types";

export type EttersokEstimate = {
  findChance: number;
  found: boolean;
  reason: string;
};

export type FleeObservation = {
  /** Player-facing narrative (direction ± distance). */
  text: string;
  /** Observed flee / land bearing (0 = N), with gear error baked in. */
  observedBearingDeg: number;
  /** Compass label for the observed bearing (N, NØ, …). */
  compassLabel: string;
  /** Camcorder only: apparent land distance from stand (m). */
  observedLandDistanceM?: number;
  hasTriggercam: boolean;
  hasCamcorder: boolean;
};

const COMPASS_8 = ["N", "NØ", "Ø", "SØ", "S", "SV", "V", "NV"] as const;

export function compassLabelFromDeg(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  const i = Math.round(d / 45) % 8;
  return COMPASS_8[i]!;
}

function clampPct(n: number): number {
  return Math.min(98, Math.max(2, n));
}

function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function randn(random: () => number): number {
  const u = Math.max(1e-9, random());
  const v = Math.max(1e-9, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Direction error σ (degrees) for the naked-eye / Triggercam / Camcorder cue.
 * Camcorder is tightest; Triggercam still much better than eyeball.
 */
function directionErrorSigmaDeg(opts: {
  hasTriggercam: boolean;
  hasCamcorder: boolean;
}): number {
  if (opts.hasCamcorder) return 8;
  if (opts.hasTriggercam) return 18;
  return 55;
}

function distanceErrorFrac(hasCamcorder: boolean): number {
  return hasCamcorder ? 0.12 : 0.35;
}

export type GenerateFleeObservationOpts = {
  stand: CellPoint;
  /** Bird position at the moment of the shot. */
  birdAtShot: CellPoint;
  hasTriggercam: boolean;
  /** True only if camcorder was deployed before the shot. */
  hasCamcorder: boolean;
  random?: () => number;
};

export type GeneratedFlee = {
  /** True land / search position (cell %). */
  landPos: CellPoint;
  observation: FleeObservation;
};

/**
 * Wounded bird flies off and lands somewhere — player gets a noisy cue.
 * Triggercam tightens direction; Camcorder also estimates land distance from stand.
 */
export function generateFleeObservation(
  opts: GenerateFleeObservationOpts,
): GeneratedFlee {
  const random = opts.random ?? Math.random;
  const trueFleeBearing = random() * 360;
  const trueFlyDistM = 45 + random() * 140; // 45–185 m from shot bird
  const pct = trueFlyDistM / AWARE_METERS_PER_PCT;
  const rad = ((trueFleeBearing - 90) * Math.PI) / 180;
  const landPos: CellPoint = {
    x: clampPct(opts.birdAtShot.x + Math.cos(rad) * pct),
    y: clampPct(opts.birdAtShot.y + Math.sin(rad) * pct),
  };

  const trueLandBearing = bearingDegFromTo(opts.stand, landPos);
  const trueLandDistM = distanceMBetween(opts.stand, landPos);

  const sigma = directionErrorSigmaDeg({
    hasTriggercam: opts.hasTriggercam,
    hasCamcorder: opts.hasCamcorder,
  });
  const observedBearingDeg = normalizeDeg(
    trueLandBearing + randn(random) * sigma,
  );
  const compass = compassLabelFromDeg(observedBearingDeg);

  let observedLandDistanceM: number | undefined;
  let text: string;

  if (opts.hasCamcorder) {
    const fracErr = distanceErrorFrac(true);
    const noisy =
      trueLandDistM * (1 + randn(random) * fracErr);
    observedLandDistanceM = Math.max(
      20,
      Math.min(450, Math.round(noisy / 5) * 5),
    );
    text =
      `Fuglen er truffet men kommer seg på vingene. Camcorder viser at den ` +
      `dro omtrent mot ${compass} og så ut til å lande ca. ${observedLandDistanceM} m ` +
      `fra skuddplassen.`;
  } else if (opts.hasTriggercam) {
    text =
      `Fuglen er truffet men kommer seg på vingene. Triggercam tyder på at den ` +
      `dro i retning ${compass} — usikkerheten er liten, men ikke null.`;
  } else {
    text =
      `Fuglen er truffet men kommer seg på vingene. Det så ut som den dro i ` +
      `retning ${compass} — vanskelig å se skikkelig, så ta høyde for feil.`;
  }

  return {
    landPos,
    observation: {
      text,
      observedBearingDeg,
      compassLabel: compass,
      observedLandDistanceM,
      hasTriggercam: opts.hasTriggercam,
      hasCamcorder: opts.hasCamcorder,
    },
  };
}

/**
 * More track points near the impact → better odds.
 * Triggercam / Camcorder improve baseline (better knowledge of where to look).
 * Instant/vital kills still need tree recovery — much easier than wounded search.
 * Failed previous attempts slightly lower chance (bird may have moved / scent cold).
 */
export function estimateEttersokFind(
  pair: ShotPair,
  random: () => number = Math.random,
): EttersokEstimate {
  const isKill =
    pair.resultKind === "instant_kill" || pair.resultKind === "vital_kill";
  const n = pair.trackPoints.length;
  const cue = pair.fleeObservation;
  const attempts = pair.ettersokAttempts ?? 0;
  let chance = isKill ? 0.55 : 0.22;
  if (n >= 1) chance += isKill ? 0.25 : 0.18;
  if (n >= 3) chance += isKill ? 0.12 : 0.2;
  if (n >= 5) chance += isKill ? 0.05 : 0.14;

  if (n > 0) {
    const last = pair.trackPoints[n - 1]!;
    const dx = last.x - pair.impact.x;
    const dy = last.y - pair.impact.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) chance += isKill ? 0.15 : 0.22;
    else if (dist < 18) chance += isKill ? 0.08 : 0.12;
    else if (dist > 35) chance -= isKill ? 0.05 : 0.1;
  } else if (!isKill) {
    chance -= 0.08; // søk uten spor er svakt
  }

  if (pair.resultKind === "ettersok") {
    if (cue?.hasCamcorder) chance += 0.28;
    else if (cue?.hasTriggercam) chance += 0.18;
  }

  if (attempts >= 1) chance -= 0.04 * Math.min(4, attempts);

  chance = Math.max(0.05, Math.min(0.95, chance));
  const found = random() < chance;
  const reason = found
    ? isKill
      ? n === 0
        ? "Du finner treet og plukker fuglen."
        : "Skuddparet leder deg til riktig tre."
      : n === 0
        ? "Heldig — du snubler over fuglen nær skuddplassen."
        : cue?.hasCamcorder || cue?.hasTriggercam
          ? "Opptaket + søkesporene leder deg frem til fuglen."
          : "Søkesporene leder deg frem til fuglen."
    : isKill
      ? "Feil tre / du mistet oversikten — legg nye spor og prøv igjen."
      : n < 2
        ? "For få søkespor i retningen den fløy — legg flere punkter i et nytt spor og prøv igjen."
        : "Du søkte feil område. Det søkesporet ligger på kartet — legg et nytt spor et annet sted.";

  return { findChance: chance, found, reason };
}

/** Cell-local impact estimate from stand + bearing + distance. */
export function impactFromShot(opts: {
  stand: { x: number; y: number };
  bearingDeg: number;
  distanceM: number;
  metersPerPct?: number;
}): { x: number; y: number } {
  const mPerPct = opts.metersPerPct ?? AWARE_METERS_PER_PCT;
  const pct = opts.distanceM / mPerPct;
  const rad = ((opts.bearingDeg - 90) * Math.PI) / 180;
  const x = opts.stand.x + Math.cos(rad) * pct;
  const y = opts.stand.y + Math.sin(rad) * pct;
  return {
    x: Math.max(2, Math.min(98, x)),
    y: Math.max(2, Math.min(98, y)),
  };
}
