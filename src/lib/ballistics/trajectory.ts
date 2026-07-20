/**
 * Point-mass trajectory: drop (and later wind/spin) from ammo BC + v0.
 *
 * Uses numerical integration with standard G1/G7 drag functions (not vacuum
 * ½gt² — that ignores BC). Sea-level ICAO atmosphere for the range.
 *
 * Defaults: scope height 50 mm, zero 100 m, twist 1:8" (RH) for spin drift.
 */

import type { AmmoSpec, BallisticModel } from "@/lib/ammo/spec";

export const DEFAULT_SCOPE_HEIGHT_M = 0.05;
/** Mechanical / saved zero distance for the range (m). */
export const DEFAULT_ZERO_DISTANCE_M = 100;
/** Rifle twist as inches per turn (1:8 → 8). Right-hand twist. */
export const DEFAULT_TWIST_INCHES = 8;

const G = 9.80665;
const SOUND_MPS = 340.29;
const RHO_ICAO = 1.22501;

/**
 * Standard G1 drag *function* values vs Mach (Ingalls / public JBM-style).
 * These are the tabulated f(M) used with imperial BC (lb/in²), not raw Cd.
 */
const G1_DRAG: [number, number][] = [
  [0.0, 0.2629],
  [0.05, 0.2558],
  [0.1, 0.2487],
  [0.15, 0.2413],
  [0.2, 0.2344],
  [0.25, 0.2278],
  [0.3, 0.2214],
  [0.35, 0.2155],
  [0.4, 0.2104],
  [0.45, 0.2061],
  [0.5, 0.2032],
  [0.55, 0.202],
  [0.6, 0.2034],
  [0.7, 0.2165],
  [0.8, 0.2591],
  [0.875, 0.303],
  [0.9, 0.3283],
  [0.925, 0.3548],
  [0.95, 0.381],
  [0.975, 0.4063],
  [1.0, 0.4334],
  [1.05, 0.486],
  [1.1, 0.518],
  [1.15, 0.541],
  [1.2, 0.555],
  [1.25, 0.565],
  [1.3, 0.57],
  [1.35, 0.572],
  [1.4, 0.571],
  [1.45, 0.569],
  [1.5, 0.566],
  [1.6, 0.56],
  [1.7, 0.553],
  [1.8, 0.547],
  [1.9, 0.541],
  [2.0, 0.536],
  [2.2, 0.528],
  [2.5, 0.522],
  [3.0, 0.52],
  [4.0, 0.52],
];

/** Compact G7 drag function vs Mach. */
const G7_DRAG: [number, number][] = [
  [0.0, 0.1198],
  [0.05, 0.1197],
  [0.1, 0.1196],
  [0.15, 0.1194],
  [0.2, 0.1193],
  [0.25, 0.1194],
  [0.3, 0.1194],
  [0.35, 0.1194],
  [0.4, 0.1193],
  [0.45, 0.1193],
  [0.5, 0.1194],
  [0.55, 0.1193],
  [0.6, 0.1194],
  [0.65, 0.1197],
  [0.7, 0.1202],
  [0.8, 0.1247],
  [0.9, 0.1408],
  [1.0, 0.1905],
  [1.05, 0.212],
  [1.1, 0.237],
  [1.15, 0.251],
  [1.2, 0.258],
  [1.25, 0.261],
  [1.3, 0.262],
  [1.4, 0.261],
  [1.5, 0.259],
  [1.6, 0.256],
  [1.8, 0.251],
  [2.0, 0.247],
  [2.2, 0.243],
  [2.5, 0.24],
  [3.0, 0.237],
  [4.0, 0.235],
];

function lerpDrag(table: [number, number][], mach: number): number {
  if (mach <= table[0]![0]) return table[0]![1];
  for (let i = 1; i < table.length; i++) {
    const [m1, c1] = table[i]!;
    if (mach <= m1) {
      const [m0, c0] = table[i - 1]!;
      const t = (mach - m0) / (m1 - m0);
      return c0 + t * (c1 - c0);
    }
  }
  return table[table.length - 1]![1];
}

function dragFunction(mach: number, model: BallisticModel): number {
  return lerpDrag(model === "G7" ? G7_DRAG : G1_DRAG, mach);
}

/**
 * Drag deceleration (m/s²) for velocity magnitude.
 * Catalog BC is imperial (lb/in²) → SI kg/m² via ×703.22.
 * Table values are treated as Cd of the standard projectile (G1/G7).
 */
function dragAccelMps2(
  speedMps: number,
  bc: number,
  model: BallisticModel,
  densityRatio = 1,
): number {
  const bcSi = Math.max(0.05, bc) * 703.2187;
  const cd = dragFunction(speedMps / SOUND_MPS, model);
  const rho = RHO_ICAO * densityRatio;
  return (0.5 * rho * cd * speedMps * speedMps) / bcSi;
}

export type TrajectoryOptions = {
  scopeHeightM?: number;
  zeroDistanceM?: number;
  /** Inches per turn (1:8 → 8). */
  twistInches?: number;
  /** Atmosphere density / ICAO sea level. */
  densityRatio?: number;
};

export type TrajectorySample = {
  distanceM: number;
  /** Drop from muzzle/bore axis, +down (m). */
  dropFromBoreM: number;
  /** Drop below line of sight (zeroed), +down (m). */
  dropBelowLosM: number;
  /** Same in mm for target plane. */
  dropBelowLosMm: number;
  timeOfFlightS: number;
  velocityMps: number;
  /** Spin drift +right for RH twist (mm). Small at ≤400 m. */
  spinDriftMm: number;
};

type FlightState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
};

/**
 * Integrate horizontal muzzle launch (bore along +x) out to `maxDistanceM`.
 * Returns drop-from-bore curve samples; LOS zero applied separately.
 */
function integrateHorizontal(
  v0: number,
  bc: number,
  model: BallisticModel,
  maxDistanceM: number,
  densityRatio: number,
): FlightState[] {
  const samples: FlightState[] = [];
  let s: FlightState = { x: 0, y: 0, vx: v0, vy: 0, t: 0 };
  samples.push({ ...s });

  const dt = 0.001;
  const maxT = 5;
  while (s.x < maxDistanceM && s.t < maxT && s.vx > 30) {
    const speed = Math.hypot(s.vx, s.vy);
    const aDrag = dragAccelMps2(speed, bc, model, densityRatio);
    const ax = -aDrag * (s.vx / speed);
    const ay = -aDrag * (s.vy / speed) - G;
    // RK2 / midpoint
    const midVx = s.vx + ax * (dt / 2);
    const midVy = s.vy + ay * (dt / 2);
    const midSpeed = Math.hypot(midVx, midVy);
    const aDrag2 = dragAccelMps2(midSpeed, bc, model, densityRatio);
    const ax2 = -aDrag2 * (midVx / midSpeed);
    const ay2 = -aDrag2 * (midVy / midSpeed) - G;

    s = {
      x: s.x + midVx * dt,
      y: s.y + midVy * dt,
      vx: s.vx + ax2 * dt,
      vy: s.vy + ay2 * dt,
      t: s.t + dt,
    };
    samples.push({ ...s });
  }
  return samples;
}

function interpAtDistance(
  samples: FlightState[],
  distanceM: number,
): FlightState {
  if (samples.length === 0) {
    return { x: 0, y: 0, vx: 0, vy: 0, t: 0 };
  }
  if (distanceM <= 0) return { ...samples[0]! };
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1]!;
    const b = samples[i]!;
    if (b.x >= distanceM) {
      const span = b.x - a.x;
      const u = span > 1e-9 ? (distanceM - a.x) / span : 0;
      return {
        x: distanceM,
        y: a.y + (b.y - a.y) * u,
        vx: a.vx + (b.vx - a.vx) * u,
        vy: a.vy + (b.vy - a.vy) * u,
        t: a.t + (b.t - a.t) * u,
      };
    }
  }
  return { ...samples[samples.length - 1]! };
}

/**
 * Drop from bore axis at distance (m, +down) for horizontal launch.
 * `y` in integrator is up, so drop = -y.
 */
function dropFromBoreM(samples: FlightState[], distanceM: number): number {
  return -interpAtDistance(samples, distanceM).y;
}

/**
 * Classic small-angle LOS drop (+down, meters) for a rifle zeroed at Z:
 *   drop_LOS(x) = h(1 − x/Z) + drop(x) − drop(Z)·(x/Z)
 */
export function dropBelowLosMeters(
  dropAtX: number,
  dropAtZero: number,
  distanceM: number,
  zeroDistanceM: number,
  scopeHeightM: number,
): number {
  if (distanceM <= 0) return 0;
  const z = Math.max(1, zeroDistanceM);
  return (
    scopeHeightM * (1 - distanceM / z) +
    dropAtX -
    dropAtZero * (distanceM / z)
  );
}

/**
 * Approximate spin drift (mm, +right) for RH twist — Miller-style toy model.
 * Kept small; full gyroscopic model can replace later.
 */
export function spinDriftMmApprox(
  timeOfFlightS: number,
  twistInches: number,
): number {
  if (timeOfFlightS <= 0) return 0;
  // Faster twist (smaller inches) → slightly more drift; scale vs 1:10.
  const twistFac = 10 / Math.max(4, twistInches);
  const inches = 1.25 * twistFac * Math.pow(Math.max(0, timeOfFlightS), 1.83);
  return inches * 25.4;
}

export function sampleTrajectory(
  ammo: Pick<AmmoSpec, "v0" | "bc" | "bcModel">,
  distanceM: number,
  opts: TrajectoryOptions = {},
): TrajectorySample {
  const scopeHeightM = opts.scopeHeightM ?? DEFAULT_SCOPE_HEIGHT_M;
  const zeroDistanceM = opts.zeroDistanceM ?? DEFAULT_ZERO_DISTANCE_M;
  const twistInches = opts.twistInches ?? DEFAULT_TWIST_INCHES;
  const densityRatio = opts.densityRatio ?? 1;
  const v0 = Math.max(50, ammo.v0);
  const maxX = Math.max(distanceM, zeroDistanceM) + 25;

  const samples = integrateHorizontal(
    v0,
    ammo.bc,
    ammo.bcModel,
    maxX,
    densityRatio,
  );
  const atX = interpAtDistance(samples, distanceM);
  const dropX = dropFromBoreM(samples, distanceM);
  const dropZ = dropFromBoreM(samples, zeroDistanceM);
  const dropLos = dropBelowLosMeters(
    dropX,
    dropZ,
    distanceM,
    zeroDistanceM,
    scopeHeightM,
  );

  return {
    distanceM,
    dropFromBoreM: dropX,
    dropBelowLosM: dropLos,
    dropBelowLosMm: dropLos * 1000,
    timeOfFlightS: atX.t,
    velocityMps: Math.hypot(atX.vx, atX.vy),
    spinDriftMm: spinDriftMmApprox(atX.t, twistInches),
  };
}

/** Convenience: drop below LOS in mm (+down) for target impacts. */
export function dropBelowLosMm(
  ammo: Pick<AmmoSpec, "v0" | "bc" | "bcModel">,
  distanceM: number,
  opts?: TrajectoryOptions,
): number {
  return sampleTrajectory(ammo, distanceM, opts).dropBelowLosMm;
}
