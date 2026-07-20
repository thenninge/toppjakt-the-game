/**
 * Shot dispersion — angular + v0 part of the ballistics engine.
 *
 * Full long-range hit probability also needs wind, scope clicks, LRF error,
 * atmosphere, zero state, and vital geometry. That contract lives in
 * `errorBudget.ts` (hjørnestein) and GAME_DESIGN.md → Ballistikkmotor.
 *
 * ## POA → POI (this module)
 * Point of aim = reticle when the shot breaks.
 * Point of impact = POA + angular Gaussian scatter + v0 vertical.
 *
 * ## Angular envelope (catalog MOA)
 * Rifle `averageBestAccuracyMoa` and ammo `maxAchievableMoa` are **additive**.
 * Example: rifle 0.5 MOA + ammo 0.3 MOA → 0.8 MOA envelope.
 *
 * That envelope is defined as **N σ** of a Gaussian (default N = 2).
 * So σ = combinedMoa / DISPERSION_MOA_SIGMA_LEVEL.
 * Most shots land well inside the envelope; outliers still occur (Gaussian tails).
 *
 * Change `DISPERSION_MOA_SIGMA_LEVEL` to 1 or 3 to retune without rewriting callers.
 *
 * ## Affinity
 * Per player×rifle×ammo factor scales the **ammo** contribution
 * (cheap ammo can still group well in some rifles).
 *
 * ## v0 variation
 * Separate from angular group. Sampled per shot; vertical effect grows with distance
 * (small at 100 m, critical for hunt P(hit) at long range).
 */

import type { AmmoSpec } from "@/lib/ammo/spec";
import type { RifleSpec } from "@/lib/rifle/spec";
import type { StockSpec } from "@/lib/stock/spec";
import { applyStockMoaDelta } from "@/lib/stock/spec";
import {
  sampleTrajectory,
  DEFAULT_SCOPE_HEIGHT_M,
  DEFAULT_TWIST_INCHES,
  DEFAULT_ZERO_DISTANCE_M,
} from "@/lib/ballistics/trajectory";

/** 1 MOA ≈ 29.4 mm at 100 m. */
export const MM_PER_MOA_AT_100M = 29.4;

/**
 * Catalog MOA ratings describe this many standard deviations.
 * 2 = ~95% of one-axis mass inside ±MOA (each axis independently).
 */
export const DISPERSION_MOA_SIGMA_LEVEL: 1 | 2 | 3 = 2;

/** Fallback 1σ muzzle-velocity SD (m/s) when ammo has no explicit field. */
export const DEFAULT_V0_SIGMA_MPS = 5;

export type DispersionInput = {
  rifle: RifleSpec;
  ammo: AmmoSpec;
  stock?: StockSpec | null;
  /** player×rifle×ammo; 1 = typical, <1 lucky ammo match, >1 poor match. */
  affinity: number;
};

/**
 * Combined angular envelope in MOA (the N-σ figure from catalog terms).
 * rifle + (ammo × affinity) + stock delta.
 */
export function combinedDispersionMoa(input: DispersionInput): number {
  const ammoMoa = Math.max(0, input.ammo.maxAchievableMoa) * input.affinity;
  let moa = Math.max(0, input.rifle.averageBestAccuracyMoa) + ammoMoa;
  if (input.stock) {
    moa = applyStockMoaDelta(moa, input.stock);
  }
  return Math.max(0.05, moa);
}

/** 1σ angular dispersion (MOA) from the combined N-σ envelope. */
export function dispersionSigmaMoa(combinedEnvelopeMoa: number): number {
  return combinedEnvelopeMoa / DISPERSION_MOA_SIGMA_LEVEL;
}

export function moaToMmAtDistance(moa: number, distanceM: number): number {
  return moa * MM_PER_MOA_AT_100M * (distanceM / 100);
}

function boxMuller(random: () => number): { z0: number; z1: number } {
  let u = 0;
  let v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  const mag = Math.sqrt(-2 * Math.log(u));
  return {
    z0: mag * Math.cos(2 * Math.PI * v),
    z1: mag * Math.sin(2 * Math.PI * v),
  };
}

/** Independent Gaussian samples in MOA for horizontal / vertical. */
export function sampleAngularOffsetMoa(
  combinedEnvelopeMoa: number,
  random: () => number = Math.random,
): { xMoa: number; yMoa: number } {
  const sigma = dispersionSigmaMoa(combinedEnvelopeMoa);
  const { z0, z1 } = boxMuller(random);
  return { xMoa: z0 * sigma, yMoa: z1 * sigma };
}

export function ammoV0SigmaMps(ammo: AmmoSpec): number {
  if (ammo.v0SigmaMps != null && ammo.v0SigmaMps > 0) return ammo.v0SigmaMps;
  // Rough: match / OTM tighter than hunting SP / bulk FMJ
  if (ammo.projectileType === "OTM") return 3;
  if (ammo.projectileType === "FMJ") return 7;
  return DEFAULT_V0_SIGMA_MPS;
}

/** Sample realized muzzle velocity for one shot. */
export function sampleMuzzleVelocity(
  ammo: AmmoSpec,
  random: () => number = Math.random,
): { v0: number; deltaV0: number } {
  const sigma = ammoV0SigmaMps(ammo);
  const { z0 } = boxMuller(random);
  const deltaV0 = z0 * sigma;
  return { v0: Math.max(50, ammo.v0 + deltaV0), deltaV0 };
}

/**
 * Vertical impact shift (mm, +down) from Δv0 at distance.
 * Faster than nominal → less drop → negative (higher on target).
 */
export function verticalMissMmFromV0Delta(
  deltaV0: number,
  nominalV0: number,
  distanceM: number,
): number {
  const v = Math.max(50, nominalV0);
  const g = 9.81;
  // d(drop) ≈ −g · d² · Δv / v³  (meters); convert to mm, +down
  const lessDropM = (g * distanceM * distanceM * deltaV0) / (v * v * v);
  return -lessDropM * 1000;
}

export type SampledShot = {
  /** Offset from POA in target mm (+x right, +y down). */
  xMm: number;
  yMm: number;
  /** Angular part only (MOA). */
  xMoa: number;
  yMoa: number;
  /** Realized muzzle velocity this shot. */
  v0: number;
  deltaV0: number;
  /** Ballistic drop below LOS (mm, +down), zeroed at DEFAULT_ZERO_DISTANCE_M. */
  dropBelowLosMm: number;
  /** Spin drift (mm, +right). */
  spinDriftMm: number;
};

/**
 * Full per-shot sample: angular Gaussian + BC/v0 drop + spin drift.
 * `poa` is where the reticle was when the shot broke (mm from bullseye).
 */
export function sampleShotFromPoa(
  poa: { xMm: number; yMm: number },
  input: DispersionInput,
  distanceM: number,
  random: () => number = Math.random,
  opts?: { densityRatio?: number },
): SampledShot {
  const envelope = combinedDispersionMoa(input);
  const { xMoa, yMoa } = sampleAngularOffsetMoa(envelope, random);
  const { v0, deltaV0 } = sampleMuzzleVelocity(input.ammo, random);
  const traj = sampleTrajectory(
    { v0, bc: input.ammo.bc, bcModel: input.ammo.bcModel },
    distanceM,
    {
      scopeHeightM: DEFAULT_SCOPE_HEIGHT_M,
      zeroDistanceM: DEFAULT_ZERO_DISTANCE_M,
      twistInches: DEFAULT_TWIST_INCHES,
      densityRatio: opts?.densityRatio ?? 1,
    },
  );
  return {
    xMm:
      poa.xMm +
      moaToMmAtDistance(xMoa, distanceM) +
      traj.spinDriftMm,
    yMm:
      poa.yMm +
      moaToMmAtDistance(yMoa, distanceM) +
      traj.dropBelowLosMm,
    xMoa,
    yMoa,
    v0,
    deltaV0,
    dropBelowLosMm: traj.dropBelowLosMm,
    spinDriftMm: traj.spinDriftMm,
  };
}
