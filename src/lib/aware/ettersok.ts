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

function absAngleDiffDeg(a: number, b: number): number {
  const d = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return d > 180 ? 360 - d : d;
}

/**
 * How well the current draft track covers the true land / tree point.
 * Gear (Triggercam / Camcorder) only helps via the flee *cue* — not a flat
 * find bonus. Wrong-direction tracks must stay unlikely.
 */
function trackCoverageVsImpact(pair: ShotPair): {
  minDistM: number;
  meanDistM: number;
  bearingErrorDeg: number | null;
  pointsNearM: number;
} {
  const impact = pair.impact;
  const points = pair.trackPoints;
  if (points.length === 0) {
    return {
      minDistM: 999,
      meanDistM: 999,
      bearingErrorDeg: null,
      pointsNearM: 0,
    };
  }

  let minDistM = Infinity;
  let sumM = 0;
  let near = 0;
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    const d = distanceMBetween(p, impact);
    minDistM = Math.min(minDistM, d);
    sumM += d;
    if (d < 40) near += 1;
    cx += p.x;
    cy += p.y;
  }
  const n = points.length;
  cx /= n;
  cy /= n;

  const trueBearing = bearingDegFromTo(pair.stand, impact);
  const trackBearing = bearingDegFromTo(pair.stand, { x: cx, y: cy });
  const bearingErrorDeg = absAngleDiffDeg(trueBearing, trackBearing);

  return {
    minDistM,
    meanDistM: sumM / n,
    bearingErrorDeg,
    pointsNearM: near,
  };
}

/**
 * Find chance from track placement vs true land / tree.
 *
 * Wounded ettersøk: Triggercam / Camcorder improve the *direction cue* only.
 * Tracks must still be in the right corridor — but bands are wide enough that
 * following a good camcorder cue (with its inherent noise) usually works.
 * Instant/vital kills still need tree recovery — easier than wounded search.
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
  const cover = trackCoverageVsImpact(pair);

  /** How well the draft track matches the player's observed cue (not truth). */
  let cueAlign: { distM: number; bearingErrorDeg: number } | null = null;
  if (cue && n > 0) {
    const last = pair.trackPoints[n - 1]!;
    const cueDistM = cue.observedLandDistanceM;
    const trackBearing = bearingDegFromTo(pair.stand, last);
    const bearingErrorDeg = absAngleDiffDeg(
      cue.observedBearingDeg,
      trackBearing,
    );
    let distM = 0;
    if (cueDistM != null) {
      const along = distanceMBetween(pair.stand, last);
      distM = Math.abs(along - cueDistM);
    }
    cueAlign = { distM, bearingErrorDeg };
  }

  let chance: number;
  let missHint: string;

  if (isKill) {
    chance = 0.55;
    if (n >= 1) chance += 0.25;
    if (n >= 3) chance += 0.12;
    if (n >= 5) chance += 0.05;
    if (n > 0) {
      if (cover.minDistM < 25) chance += 0.15;
      else if (cover.minDistM < 50) chance += 0.08;
      else if (cover.minDistM > 100) chance -= 0.12;
    }
    missHint =
      "Feil tre / du mistet oversikten — legg nye spor og prøv igjen.";
  } else {
    chance = n === 0 ? 0.05 : 0.1;

    // Wide enough that a camcorder cue (±~20–40 m) still lands in a good band.
    if (cover.minDistM < 20) chance += 0.55;
    else if (cover.minDistM < 40) chance += 0.42;
    else if (cover.minDistM < 65) chance += 0.28;
    else if (cover.minDistM < 95) chance += 0.12;
    else if (cover.minDistM < 130) chance += 0.02;
    else chance -= 0.04;

    chance += Math.min(0.2, cover.pointsNearM * 0.05);

    if (cover.bearingErrorDeg != null) {
      if (cover.bearingErrorDeg > 110) chance *= 0.22;
      else if (cover.bearingErrorDeg > 70) chance *= 0.45;
      else if (cover.bearingErrorDeg > 40) chance *= 0.72;
      else if (cover.bearingErrorDeg < 22) chance += 0.1;
    }

    if (n >= 2 && cover.meanDistM > 120) chance *= 0.55;

    // Reward actually following the gear cue (direction ± distance).
    if (cueAlign && cue) {
      if (cueAlign.bearingErrorDeg < 20) chance += 0.08;
      else if (cueAlign.bearingErrorDeg < 35) chance += 0.04;
      if (cue.observedLandDistanceM != null) {
        if (cueAlign.distM < 25) chance += 0.1;
        else if (cueAlign.distM < 45) chance += 0.05;
      }
      if (cue.hasCamcorder) chance += 0.04;
      else if (cue.hasTriggercam) chance += 0.02;
    }

    if (cover.minDistM > 100 || (cover.bearingErrorDeg ?? 0) > 70) {
      missHint =
        "Sporene ligger feil vei i forhold til der fuglen dro — følg fluktretningen fra skuddplassen og legg et nytt spor der.";
    } else if (n < 2) {
      missHint =
        "For få søkespor i området — legg flere punkter langs fluktretningen og prøv igjen.";
    } else {
      missHint =
        "Nær, men ikke treff — finjuster sporet rundt der du tror den landet.";
    }
  }

  if (attempts >= 1) chance -= 0.025 * Math.min(4, attempts);

  chance = Math.max(0.03, Math.min(0.93, chance));
  const found = random() < chance;
  const reason = found
    ? isKill
      ? n === 0
        ? "Du finner treet og plukker fuglen."
        : "Skuddparet leder deg til riktig tre."
      : cover.minDistM < 50
        ? "Søkesporene traff området der fuglen landet."
        : cue?.hasCamcorder || cue?.hasTriggercam
          ? "Du fant den — sporene fulgte fluktretningen godt nok."
          : "Heldig — du snubler over fuglen nær søkesporet."
    : missHint;

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

/** Manual «Lagre skuddpar» defaults — player must dial in real values. */
export const SHOT_PAIR_MANUAL_DEFAULT_BEARING_DEG = 0;
export const SHOT_PAIR_MANUAL_DEFAULT_DISTANCE_M = 250;

/** Auto skuddpar distance noise when gear filmed the shot. */
export const TRIGGERCAM_SHOT_PAIR_UNCERTAINTY_M = 30;
export const CAMCORDER_SHOT_PAIR_UNCERTAINTY_M = 10;

export type VisibleShotPairEstimate = {
  /** Drawn aim point (stand → target). */
  target: CellPoint;
  distanceM: number;
  bearingDeg: number;
  source: "camcorder" | "triggercam";
};

/** Triggercam in kit, or camcorder deployed before the shot. */
export function canAutoSaveShotPair(opts: {
  hasTriggercam: boolean;
  hasCamcorder: boolean;
}): boolean {
  return opts.hasTriggercam || opts.hasCamcorder;
}

/**
 * Auto skuddpar from camera gear after a real shot.
 * Camcorder ±10 m, triggercam ±30 m along the true shot bearing.
 * Returns null without gear — player must have saved skuddpar manually.
 */
export function estimateVisibleShotPair(opts: {
  stand: CellPoint;
  /** True bird / aim at the moment of the shot. */
  trueAim: CellPoint;
  hasTriggercam: boolean;
  /** Camcorder must have been deployed before the shot. */
  hasCamcorder: boolean;
  random?: () => number;
}): VisibleShotPairEstimate | null {
  const random = opts.random ?? Math.random;
  const trueBearing = bearingDegFromTo(opts.stand, opts.trueAim);
  const trueDist = distanceMBetween(opts.stand, opts.trueAim);

  if (opts.hasCamcorder) {
    const err = (random() * 2 - 1) * CAMCORDER_SHOT_PAIR_UNCERTAINTY_M;
    const distanceM = Math.max(
      50,
      Math.min(450, Math.round(trueDist + err)),
    );
    const bearingDeg = Math.round(normalizeDeg(trueBearing));
    return {
      target: impactFromShot({
        stand: opts.stand,
        bearingDeg,
        distanceM,
      }),
      distanceM,
      bearingDeg,
      source: "camcorder",
    };
  }

  if (opts.hasTriggercam) {
    const err = (random() * 2 - 1) * TRIGGERCAM_SHOT_PAIR_UNCERTAINTY_M;
    const distanceM = Math.max(
      50,
      Math.min(450, Math.round(trueDist + err)),
    );
    const bearingDeg = Math.round(normalizeDeg(trueBearing));
    return {
      target: impactFromShot({
        stand: opts.stand,
        bearingDeg,
        distanceM,
      }),
      distanceM,
      bearingDeg,
      source: "triggercam",
    };
  }

  return null;
}
