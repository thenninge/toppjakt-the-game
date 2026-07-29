/**
 * Ettersøk — flee observation cues + find chance from track work.
 */

import {
  AWARE_MAP_MAX_M,
  AWARE_METERS_PER_PCT,
  bearingDegFromTo,
  distanceMBetween,
  type CellPoint,
} from "@/lib/aware/cellGeometry";
import type { ShotPair } from "@/lib/aware/types";
import {
  directionErrorSigmaFromRecoil,
  SCOPE_DISTANCE_RECOIL_MAX,
  SCOPE_OBSERVE_RECOIL_MAX,
  scopeLandDistanceErrorFrac,
} from "@/lib/range/recoil";

export type EttersokEstimate = {
  findChance: number;
  found: boolean;
  reason: string;
};

export type FleeObservation = {
  /** Player-facing narrative (direction ± distance). */
  text: string;
  /** Observed flee / land bearing from bird perch (0 = N), with gear error. */
  observedBearingDeg: number;
  /** Compass label for the observed bearing (N, NØ, …). */
  compassLabel: string;
  /**
   * Camcorder / soft-recoil scope: apparent land distance from bird perch (m).
   */
  observedLandDistanceM?: number;
  hasTriggercam: boolean;
  hasCamcorder: boolean;
  /** Cue improved by staying in the glass (low felt recoil). */
  fromScopeRecoil?: boolean;
  /** Felt recoil at the shot (lower = softer). */
  feltRecoil?: number;
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
 * Direction error σ (degrees) for the flee cue.
 * Cams set a floor; soft recoil can match or beat Triggercam alone.
 * Naked hard recoil ±30°, soft scope ~5–15°, Triggercam ±10°,
 * Camcorder ±5°, both ±2.5°.
 */
function directionErrorSigmaDeg(opts: {
  hasTriggercam: boolean;
  hasCamcorder: boolean;
  feltRecoil?: number;
}): number {
  let sigma = 30;
  if (opts.hasCamcorder && opts.hasTriggercam) sigma = 2.5;
  else if (opts.hasCamcorder) sigma = 5;
  else if (opts.hasTriggercam) sigma = 10;

  if (opts.feltRecoil != null && Number.isFinite(opts.feltRecoil)) {
    sigma = Math.min(sigma, directionErrorSigmaFromRecoil(opts.feltRecoil));
  }
  return sigma;
}

/** Snap bearing to nearest 8-point compass (N, NØ, Ø, …). */
function snapToNearestCompassDeg(deg: number): number {
  const d = normalizeDeg(deg);
  return normalizeDeg(Math.round(d / 45) * 45);
}

/** Fractional land-distance noise. Camcorder ±12%; both cams ±6%. */
function distanceErrorFrac(opts: {
  hasCamcorder: boolean;
  hasTriggercam: boolean;
}): number {
  if (opts.hasCamcorder && opts.hasTriggercam) return 0.06;
  if (opts.hasCamcorder) return 0.12;
  return 0.35;
}

/** Absolute max fly-out for body-wound ettersøk (m). */
export const ETTERSOK_BODY_MAX_FLY_M = 250;

/** True fly-out range from the perched bird, by hit zone. */
function flyDistanceRangeM(zone: "vital" | "body"): {
  min: number;
  max: number;
} {
  // Red ring: short ettersøk. Body: near max of max fly radius.
  if (zone === "vital") return { min: 15, max: 80 };
  const max = ETTERSOK_BODY_MAX_FLY_M;
  return { min: Math.round(max * 0.85), max };
}

export type GenerateFleeObservationOpts = {
  /** Bird position at the moment of the shot. */
  birdAtShot: CellPoint;
  /** Hit zone that produced ettersøk (red = vital, else body). */
  hitZone: "vital" | "body";
  hasTriggercam: boolean;
  /** True only if camcorder was deployed before the shot. */
  hasCamcorder: boolean;
  /**
   * Felt recoil at the shot (lower = softer). Soft recoil improves the
   * scope-track cue without cams.
   */
  feltRecoil?: number;
  /** Terrain Aware scale (m per map %). */
  metersPerPct?: number;
  random?: () => number;
};

export type GeneratedFlee = {
  /** True land / search position (cell %). */
  landPos: CellPoint;
  observation: FleeObservation;
};

/**
 * Wounded bird flies off and lands somewhere — player gets a noisy cue.
 * Direction + distance are always relative to where the bird sat.
 * Triggercam / camcorder tighten the cue; soft recoil lets you stay in the
 * scope and track the bird without cam gear.
 */
export function generateFleeObservation(
  opts: GenerateFleeObservationOpts,
): GeneratedFlee {
  const random = opts.random ?? Math.random;
  const mPerPct = opts.metersPerPct ?? AWARE_METERS_PER_PCT;
  const range = flyDistanceRangeM(opts.hitZone);
  const trueFleeBearing = random() * 360;
  const trueFlyDistM = range.min + random() * (range.max - range.min);
  const pct = trueFlyDistM / mPerPct;
  const rad = ((trueFleeBearing - 90) * Math.PI) / 180;
  const landPos: CellPoint = {
    x: clampPct(opts.birdAtShot.x + Math.cos(rad) * pct),
    y: clampPct(opts.birdAtShot.y + Math.sin(rad) * pct),
  };

  // Cue frame: from perched bird → land (not from hunter stand).
  const trueLandBearing = bearingDegFromTo(opts.birdAtShot, landPos);
  const trueLandDistM = distanceMBetween(opts.birdAtShot, landPos, mPerPct);

  const feltRecoil =
    opts.feltRecoil != null && Number.isFinite(opts.feltRecoil)
      ? opts.feltRecoil
      : undefined;
  const fromScopeRecoil =
    feltRecoil != null && feltRecoil <= SCOPE_OBSERVE_RECOIL_MAX;

  const sigma = directionErrorSigmaDeg({
    hasTriggercam: opts.hasTriggercam,
    hasCamcorder: opts.hasCamcorder,
    feltRecoil,
  });
  let observedBearingDeg = normalizeDeg(
    trueLandBearing + randn(random) * sigma,
  );
  // Naked hard recoil: only a coarse compass sector.
  if (!opts.hasTriggercam && !opts.hasCamcorder && !fromScopeRecoil) {
    observedBearingDeg = snapToNearestCompassDeg(observedBearingDeg);
  }
  const compass = compassLabelFromDeg(observedBearingDeg);

  let observedLandDistanceM: number | undefined;
  let text: string;

  const canScopeDistance =
    fromScopeRecoil &&
    feltRecoil != null &&
    feltRecoil <= SCOPE_DISTANCE_RECOIL_MAX;

  if (opts.hasCamcorder) {
    const fracErr = distanceErrorFrac({
      hasCamcorder: true,
      hasTriggercam: opts.hasTriggercam,
    });
    const noisy = trueLandDistM * (1 + randn(random) * fracErr);
    const cap = range.max + 20;
    observedLandDistanceM = Math.max(
      10,
      Math.min(cap, Math.round(noisy / 5) * 5),
    );
    const gearNote =
      opts.hasTriggercam
        ? "Camcorder + Triggercam"
        : "Camcorder";
    text =
      `Fuglen er truffet men kommer seg på vingene. ${gearNote} viser at den ` +
      `dro omtrent mot ${compass} og så ut til å lande ca. ${observedLandDistanceM} m ` +
      `fra der den satt.`;
  } else if (opts.hasTriggercam && canScopeDistance) {
    const fracErr = scopeLandDistanceErrorFrac(feltRecoil!);
    const noisy = trueLandDistM * (1 + randn(random) * fracErr);
    const cap = range.max + 20;
    observedLandDistanceM = Math.max(
      10,
      Math.min(cap, Math.round(noisy / 5) * 5),
    );
    text =
      `Fuglen er truffet men kommer seg på vingene. Triggercam + lav rekyl: du fulgte ` +
      `den i kikkerten mot ${compass} — land ca. ${observedLandDistanceM} m fra der den satt.`;
  } else if (opts.hasTriggercam) {
    text =
      `Fuglen er truffet men kommer seg på vingene. Triggercam tyder på at den ` +
      `dro i retning ${compass} fra der den satt — usikkerheten er liten, men ikke null.`;
  } else if (canScopeDistance) {
    const fracErr = scopeLandDistanceErrorFrac(feltRecoil!);
    const noisy = trueLandDistM * (1 + randn(random) * fracErr);
    const cap = range.max + 20;
    observedLandDistanceM = Math.max(
      10,
      Math.min(cap, Math.round(noisy / 5) * 5),
    );
    text =
      `Fuglen er truffet men kommer seg på vingene. Lav rekyl — du ble i kikkerten og så ` +
      `at den dro mot ${compass} og landet ca. ${observedLandDistanceM} m fra der den satt.`;
  } else if (fromScopeRecoil) {
    text =
      `Fuglen er truffet men kommer seg på vingene. Lav rekyl lot deg følge den i ` +
      `kikkerten — den dro omtrent mot ${compass} fra der den satt.`;
  } else {
    text =
      `Fuglen er truffet men kommer seg på vingene. Det så ut som den dro mot ` +
      `${compass} fra der den satt — bare grovt peilet (nærmeste kompassretning), ta høyde for feil.`;
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
      fromScopeRecoil: fromScopeRecoil || undefined,
      feltRecoil,
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
  findChanceMult = 1,
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
    // Cue is from perched bird (target), not hunter stand.
    const origin = pair.target;
    const cueDistM = cue.observedLandDistanceM;
    const trackBearing = bearingDegFromTo(origin, last);
    const bearingErrorDeg = absAngleDiffDeg(
      cue.observedBearingDeg,
      trackBearing,
    );
    let distM = 0;
    if (cueDistM != null) {
      const along = distanceMBetween(origin, last);
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
      else if (cue.fromScopeRecoil) chance += 0.02;
    }

    if (cover.minDistM > 100 || (cover.bearingErrorDeg ?? 0) > 70) {
      missHint =
        "Sporene ligger feil vei i forhold til der fuglen dro — følg fluktretningen fra der den satt og legg et nytt spor der.";
    } else if (n < 2) {
      missHint =
        "For få søkespor i området — legg flere punkter langs fluktretningen og prøv igjen.";
    } else {
      missHint =
        "Nær, men ikke treff — finjuster sporet rundt der du tror den landet.";
    }
  }

  if (attempts >= 1) chance -= 0.025 * Math.min(4, attempts);

  const mult =
    findChanceMult != null && Number.isFinite(findChanceMult)
      ? Math.max(0.05, findChanceMult)
      : 1;
  chance = Math.max(0.03, Math.min(0.93, chance * mult));
  const found = random() < chance;
  const reason = found
    ? isKill
      ? n === 0
        ? "Du finner treet og plukker fuglen."
        : "Skuddparet leder deg til riktig tre."
      : cover.minDistM < 50
        ? "Søkesporene traff området der fuglen landet."
        : cue?.hasCamcorder || cue?.hasTriggercam || cue?.fromScopeRecoil
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

/**
 * Instant kill inside this range: «Hent ved treet» without cam / saved skuddpar.
 * Longer tree kills still need camcorder, triggercam, EL Range, or a registered pair.
 */
export const CLOSE_RANGE_TREE_HENT_MAX_M = 200;

/** Auto skuddpar distance noise when gear filmed the shot. */
export const TRIGGERCAM_SHOT_PAIR_UNCERTAINTY_M = 30;
export const CAMCORDER_SHOT_PAIR_UNCERTAINTY_M = 10;
/** Camcorder + Triggercam together — half camcorder distance noise. */
export const CAMCORDER_TRIGGERCAM_SHOT_PAIR_UNCERTAINTY_M =
  CAMCORDER_SHOT_PAIR_UNCERTAINTY_M / 2;

/** Swarovski EL Range — exact auto skuddpar (kit LRF, no deploy). */
export const SWAROVSKI_EL_RANGE_ID = "lrf-swarovski-el-range-10x42";

export type VisibleShotPairEstimate = {
  /** Drawn aim point (stand → target). */
  target: CellPoint;
  distanceM: number;
  bearingDeg: number;
  source: "camcorder" | "triggercam" | "el_range";
};

/** Triggercam / camcorder / EL Range can autofill skuddpar. */
export function canAutoSaveShotPair(opts: {
  hasTriggercam: boolean;
  hasCamcorder: boolean;
  hasElRange?: boolean;
}): boolean {
  return opts.hasTriggercam || opts.hasCamcorder || !!opts.hasElRange;
}

/**
 * Auto skuddpar after a real shot.
 * EL Range (in kit): exact bearing + distance.
 * Camcorder ±10 m, triggercam ±30 m, both ±5 m along the true shot bearing.
 * Returns null without gear — player must save skuddpar manually.
 *
 * Ettersøk flee cues still require Triggercam/camcorder separately.
 */
export function estimateVisibleShotPair(opts: {
  stand: CellPoint;
  /** True bird / aim at the moment of the shot. */
  trueAim: CellPoint;
  hasTriggercam: boolean;
  /** Camcorder must have been deployed before the shot. */
  hasCamcorder: boolean;
  /** Swarovski EL Range in kit — exact skuddpar. */
  hasElRange?: boolean;
  metersPerPct?: number;
  /** Cap for dialed skuddpar distance (terrain Aware max). */
  maxDistanceM?: number;
  random?: () => number;
}): VisibleShotPairEstimate | null {
  const random = opts.random ?? Math.random;
  const mPerPct = opts.metersPerPct ?? AWARE_METERS_PER_PCT;
  const maxDist = opts.maxDistanceM ?? AWARE_MAP_MAX_M;
  const trueBearing = bearingDegFromTo(opts.stand, opts.trueAim);
  const trueDist = distanceMBetween(opts.stand, opts.trueAim, mPerPct);

  if (opts.hasElRange) {
    const distanceM = Math.max(
      50,
      Math.min(maxDist, Math.round(trueDist)),
    );
    const bearingDeg = Math.round(normalizeDeg(trueBearing));
    return {
      target: impactFromShot({
        stand: opts.stand,
        bearingDeg,
        distanceM,
        metersPerPct: mPerPct,
      }),
      distanceM,
      bearingDeg,
      source: "el_range",
    };
  }

  if (opts.hasCamcorder) {
    const band =
      opts.hasTriggercam
        ? CAMCORDER_TRIGGERCAM_SHOT_PAIR_UNCERTAINTY_M
        : CAMCORDER_SHOT_PAIR_UNCERTAINTY_M;
    const err = (random() * 2 - 1) * band;
    const distanceM = Math.max(
      50,
      Math.min(maxDist, Math.round(trueDist + err)),
    );
    const bearingDeg = Math.round(normalizeDeg(trueBearing));
    return {
      target: impactFromShot({
        stand: opts.stand,
        bearingDeg,
        distanceM,
        metersPerPct: mPerPct,
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
      Math.min(maxDist, Math.round(trueDist + err)),
    );
    const bearingDeg = Math.round(normalizeDeg(trueBearing));
    return {
      target: impactFromShot({
        stand: opts.stand,
        bearingDeg,
        distanceM,
        metersPerPct: mPerPct,
      }),
      distanceM,
      bearingDeg,
      source: "triggercam",
    };
  }

  return null;
}
