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
 * ## Mirage
 * Optional `mirageFactor` widens the per-shot envelope:
 * base × (1 + factor × U(0, 0.25)). At factor 2 (full heat), up to +50 % MOA.
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
import { ammoAtPowderTemp } from "@/lib/ballistics/powderTemp";
import { applyMirageToDispersionMoa } from "@/lib/range/mirage";

/** 1 MOA ≈ 29.4 mm at 100 m. */
export const MM_PER_MOA_AT_100M = 29.4;

/**
 * Catalog MOA ratings describe this many standard deviations.
 * 2 = ~95% of one-axis mass inside ±MOA (each axis independently).
 */
export const DISPERSION_MOA_SIGMA_LEVEL: 1 | 2 | 3 = 2;

/**
 * Typical extreme-spread / 1σ for a 5-shot 2D Gaussian group.
 * Used so CB Real loads «Avg MOA» (measured ES) maps to engine envelope.
 */
export const FIVE_SHOT_ES_OVER_SIGMA = 3.1;

/** Measured 5-shot ES (MOA) → engine N-σ envelope. */
export function groupEsMoaToEnvelopeMoa(groupEsMoa: number): number {
  return Math.max(
    0.05,
    (groupEsMoa * DISPERSION_MOA_SIGMA_LEVEL) / FIVE_SHOT_ES_OVER_SIGMA,
  );
}

/** Fallback 1σ muzzle-velocity SD (m/s) when ammo has no explicit field. */
export const DEFAULT_V0_SIGMA_MPS = 5;

export type DispersionInput = {
  rifle: RifleSpec;
  ammo: AmmoSpec;
  stock?: StockSpec | null;
  /** player×rifle×ammo; 1 = typical, <1 lucky ammo match, >1 poor match. */
  affinity: number;
  /** Negative = tighter (CB Customs bedding / søylebedding). */
  customsMoaDelta?: number;
  /**
   * Multiplier on the combined envelope (mental fatigue: 1 = fresh, 2 = exhausted).
   * Applied after rifle+ammo+stock+customs (+ barrel wear on rifle).
   */
  dispersionScale?: number;
  /**
   * Barrel wear multiplier on rifle MOA only (1 = fresh … 2 = worn out).
   * See `barrelWearMoaScale`.
   */
  barrelWearScale?: number;
  /**
   * Live mirage strength (0…~2.4). Per shot, widens envelope by up to
   * +25 % × factor (see {@link applyMirageToDispersionMoa}).
   */
  mirageFactor?: number;
  /**
   * Pipe length vs factory reference — scales nominal muzzle velocity (1 = factory).
   */
  barrelV0Factor?: number;
};

/**
 * Combined angular envelope in MOA (the N-σ figure from catalog terms).
 * (rifle × barrelWear) + (ammo × affinity) + stock delta + customs bedding,
 * then optional {@link DispersionInput.dispersionScale} (e.g. MIND fatigue).
 */
export function combinedDispersionMoa(input: DispersionInput): number {
  const scale =
    input.dispersionScale != null && Number.isFinite(input.dispersionScale)
      ? Math.max(1, input.dispersionScale)
      : 1;

  // Real-data measured system group — replaces catalog rifle+ammo stack.
  const override = input.ammo.systemGroupMoaOverride;
  if (
    override != null &&
    Number.isFinite(override) &&
    override > 0
  ) {
    // Mirage still widens in sampleShotFromPoa; fatigue scale applies here.
    return Math.max(0.05, override * scale);
  }

  const wear =
    input.barrelWearScale != null && Number.isFinite(input.barrelWearScale)
      ? Math.max(1, input.barrelWearScale)
      : 1;
  const rifleMoa = Math.max(0, input.rifle.averageBestAccuracyMoa) * wear;
  const ammoMoa = Math.max(0, input.ammo.maxAchievableMoa) * input.affinity;
  let moa = rifleMoa + ammoMoa;
  if (input.stock) {
    moa = applyStockMoaDelta(moa, input.stock);
  }
  if (input.customsMoaDelta) {
    moa += input.customsMoaDelta;
  }
  return Math.max(0.05, moa * scale);
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

/**
 * CB Real loads: Avg = μ, Best = μ − 3σ.
 * Sample one series/shot envelope from N(μ, σ), soft-clamped to ~±3.5σ
 * (e.g. Best 0.3 / Avg 0.45 → σ=0.05 → typically ~0.3…0.6 MOA).
 */
export function sampleRealSystemGroupMoa(
  meanMoa: number,
  bestMoa: number,
  random: () => number = Math.random,
): number {
  const mu = Math.max(0.05, meanMoa);
  const best = Math.min(Math.max(0.05, bestMoa), mu);
  const sigma = Math.max(1e-4, (mu - best) / 3);
  const { z0 } = boxMuller(random);
  const z = Math.max(-3.5, Math.min(3.5, z0));
  return Math.max(0.05, mu + z * sigma);
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

/** Sample realized muzzle velocity for one shot (optional powder temp). */
export function sampleMuzzleVelocity(
  ammo: AmmoSpec,
  random: () => number = Math.random,
  powderTempC: number = 15,
  barrelV0Factor: number = 1,
  dvDtMpsPerC?: number | null,
): { v0: number; deltaV0: number } {
  const base = ammoAtPowderTemp(ammo, powderTempC, dvDtMpsPerC);
  const scale = Number.isFinite(barrelV0Factor) ? Math.max(0.5, barrelV0Factor) : 1;
  const sigma = ammoV0SigmaMps(ammo);
  const { z0 } = boxMuller(random);
  const deltaV0 = z0 * sigma;
  const nominal = base.v0 * scale;
  return { v0: Math.max(50, nominal + deltaV0), deltaV0 };
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
  opts?: {
    densityRatio?: number;
    powderTempC?: number;
    /** Kestrel / calibrated dV/dT — same as exactBallisticHold. */
    dvDtMpsPerC?: number | null;
    /**
     * CB Real loads: reuse one sampled series envelope for all shots in the
     * group (do not re-roll Best/Avg each shot).
     */
    seriesGroupEnvelopeMoa?: number | null;
    /** Skip mirage widening (CB Real loads already include real conditions). */
    skipMirage?: boolean;
  },
): SampledShot {
  const powderTempC = opts?.powderTempC ?? 15;
  const scale =
    input.dispersionScale != null && Number.isFinite(input.dispersionScale)
      ? Math.max(1, input.dispersionScale)
      : 1;
  let envelope: number;
  const mean = input.ammo.systemGroupMoaOverride;
  const best = input.ammo.systemGroupMoaBest;
  if (
    opts?.seriesGroupEnvelopeMoa != null &&
    Number.isFinite(opts.seriesGroupEnvelopeMoa) &&
    opts.seriesGroupEnvelopeMoa > 0
  ) {
    envelope = opts.seriesGroupEnvelopeMoa * scale;
  } else if (
    mean != null &&
    Number.isFinite(mean) &&
    mean > 0 &&
    best != null &&
    Number.isFinite(best) &&
    best > 0
  ) {
    envelope = sampleRealSystemGroupMoa(mean, best, random) * scale;
  } else {
    envelope = combinedDispersionMoa(input);
  }
  if (
    !opts?.skipMirage &&
    input.mirageFactor != null &&
    input.mirageFactor > 0
  ) {
    envelope = applyMirageToDispersionMoa(
      envelope,
      input.mirageFactor,
      random,
    );
  }
  const { xMoa, yMoa } = sampleAngularOffsetMoa(envelope, random);
  const { v0, deltaV0 } = sampleMuzzleVelocity(
    input.ammo,
    random,
    powderTempC,
    input.barrelV0Factor ?? 1,
    opts?.dvDtMpsPerC,
  );
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
