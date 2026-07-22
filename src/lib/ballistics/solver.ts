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
 * Sea-level density ratio from temperature (ICAO-ish).
 * Cooler air → denser → more drop / wind effect.
 */
export function densityRatioFromTempC(tempC: number): number {
  return 288.15 / (273.15 + tempC);
}

/**
 * Lateral wind drift on paper (mm, +right) for a crosswind (m/s, +from left).
 *
 * Uses aerodynamic lag time: the bullet only “feels” wind for
 * (TOF − distance/v0), not the full TOF.
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

/** Marker position on Aware cell stage (hunter at 50,50). */
export function birdMarkerOnAwareMap(
  distanceM: number,
  bearingDeg: number,
): { x: number; y: number } {
  // Same geometry as impactFromShot / skuddpar dial (450 m → 42 % radius).
  const maxM = 450;
  const radiusPct = 42;
  const pct =
    Math.min(radiusPct, (Math.max(0, distanceM) / maxM) * radiusPct);
  const rad = ((bearingDeg - 90) * Math.PI) / 180;
  return {
    x: 50 + Math.cos(rad) * pct,
    y: 50 + Math.sin(rad) * pct,
  };
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

/**
 * Kestrel 5700 AB LCD lines (matches Applied Ballistics solution screen).
 * Clicks are 0.1 mil → mils = |clicks| / 10.
 */
export type KestrelLcdCopy = {
  elevLine: string;
  windLine: string;
  tgtLine: string;
  windEnvLine: string;
};

/** Wind direction as clock face relative to shot (12 = headwind). */
export function formatWindClockFacing(
  windFromDeg: number,
  shotBearingDeg: number,
): string {
  let rel = ((windFromDeg - shotBearingDeg) % 360 + 360) % 360;
  const totalMin = (rel / 360) * 12 * 60;
  let h = Math.floor(totalMin / 60) % 12;
  let m = Math.round((totalMin % 60) / 30) * 30;
  if (m === 60) {
    m = 0;
    h = (h + 1) % 12;
  }
  if (h === 0) h = 12;
  return m === 0 ? `${h}:00` : `${h}:${String(m).padStart(2, "0")}`;
}

export function formatKestrelLcd(
  solution: BallisticHoldSolution,
  opts: {
    shotBearingDeg: number;
    windFromDeg: number;
    windSpeedMs: number;
  },
): KestrelLcdCopy {
  const eMil = Math.abs(solution.elevationClicks) / 10;
  const wMil = Math.abs(solution.windageClicks) / 10;
  // Wind1 / Wind2 bracket (±~25% like dual-wind AB display)
  const w1 = wMil;
  const w2 = wMil * 1.4;
  const eDir =
    Math.abs(solution.elevationClicks) < 0.05
      ? ""
      : solution.elevationClicks < 0
        ? "U"
        : "D";
  const wDir =
    Math.abs(solution.windageClicks) < 0.05
      ? ""
      : solution.windageClicks < 0
        ? "L"
        : "R";

  const elevLine =
    Math.abs(solution.elevationClicks) < 0.05
      ? "E  0.00 MIL"
      : `E  ${eMil.toFixed(2)}${eDir} MIL`;
  const windLine =
    Math.abs(solution.windageClicks) < 0.05
      ? "W  0.00"
      : `W  ${w1.toFixed(2)}/${w2.toFixed(2)}${wDir}`;

  const bearing = Math.round(((opts.shotBearingDeg % 360) + 360) % 360);
  const distM = Math.round(solution.distanceM);
  const clock = formatWindClockFacing(opts.windFromDeg, opts.shotBearingDeg);
  const windMs = opts.windSpeedMs.toFixed(1);

  return {
    elevLine,
    windLine,
    tgtLine: `Tgt...  ${String(bearing).padStart(3, "0")}°  ${distM}m`,
    windEnvLine: `Wind... ${clock}  ${windMs}m/s`,
  };
}
