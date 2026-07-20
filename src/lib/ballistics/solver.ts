/**
 * Onboard ballistic holds (BDX / AB + Kestrel) for hunt LRF.
 *
 * With premium LRF ballistics + local wind meter, the player gets an exact
 * solution relative to a perfect 100 m zero (no base-zero error in the hold).
 */

import type { AmmoSpec } from "@/lib/ammo/spec";
import {
  sampleTrajectory,
  type TrajectoryOptions,
} from "@/lib/ballistics/trajectory";
import { ZERO_CLICK_MM } from "@/lib/player";

/**
 * Lateral wind drift on paper (mm, +right) for a crosswind (m/s, +from left).
 *
 * Uses aerodynamic lag time: the bullet only “feels” wind for
 * (TOF − distance/v0), not the full TOF. The old `wind×TOF×1.5` model
 * produced metres of drift and blew past the turret clamp.
 */
export function windDriftMm(
  crosswindMs: number,
  timeOfFlightS: number,
  distanceM: number,
  v0Mps: number,
): number {
  if (timeOfFlightS <= 0 || crosswindMs === 0) return 0;
  const vacuumTof = distanceM / Math.max(50, v0Mps);
  const lagS = Math.max(0, timeOfFlightS - vacuumTof);
  return crosswindMs * lagS * 1000;
}

export type BallisticHoldSolution = {
  distanceM: number;
  /** Drop below LOS (mm, +down). */
  dropMm: number;
  /** Total lateral POI (mm, +right): spin + wind. */
  windageMm: number;
  spinDriftMm: number;
  windDriftMm: number;
  timeOfFlightS: number;
  /**
   * Turret dial from perfect zero, mm-at-100 m.
   * +x = right dial, +y = down dial (same as session zero storage).
   * To cancel drop/wind, dial the opposite of POI.
   */
  dialXMmAt100: number;
  dialYMmAt100: number;
  /** 0.1 mil clicks (signed: +R / +D). */
  windageClicks: number;
  elevationClicks: number;
};

/**
 * Exact hold for `distanceM` assuming a perfect 100 m zero.
 * Dial values cancel drop + spin + crosswind so POA on vitals = POI.
 */
export function exactBallisticHold(
  ammo: Pick<AmmoSpec, "v0" | "bc" | "bcModel">,
  distanceM: number,
  crosswindMs: number,
  opts?: TrajectoryOptions,
): BallisticHoldSolution {
  const traj = sampleTrajectory(ammo, distanceM, opts);
  const wDrift = windDriftMm(
    crosswindMs,
    traj.timeOfFlightS,
    distanceM,
    ammo.v0,
  );
  const windageMm = traj.spinDriftMm + wDrift;
  const dropMm = traj.dropBelowLosMm;
  const scale = 100 / Math.max(1, distanceM);
  // Cancel POI: dial opposite direction.
  const dialXMmAt100 = -windageMm * scale;
  const dialYMmAt100 = -dropMm * scale;
  return {
    distanceM,
    dropMm,
    windageMm,
    spinDriftMm: traj.spinDriftMm,
    windDriftMm: wDrift,
    timeOfFlightS: traj.timeOfFlightS,
    dialXMmAt100,
    dialYMmAt100,
    windageClicks: dialXMmAt100 / ZERO_CLICK_MM,
    elevationClicks: dialYMmAt100 / ZERO_CLICK_MM,
  };
}

export function formatHoldClicks(solution: BallisticHoldSolution): string {
  const e = solution.elevationClicks;
  const w = solution.windageClicks;
  const elev =
    Math.abs(e) < 0.05
      ? "elev 0"
      : `elev ${Math.abs(Math.round(e))} ${e < 0 ? "U" : "D"}`;
  const wind =
    Math.abs(w) < 0.05
      ? "wind 0"
      : `wind ${Math.abs(Math.round(w))} ${w < 0 ? "L" : "R"}`;
  return `${elev} · ${wind}`;
}
