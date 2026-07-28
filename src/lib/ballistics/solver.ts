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
import {
  ammoAtPowderTemp,
  POWDER_TEMP_REFERENCE_C,
} from "@/lib/ballistics/powderTemp";
import { ZERO_CLICK_MM } from "@/lib/player";
import { mmAt100ToAngular } from "@/lib/optics/clicks";
import type { ScopeClickUnit } from "@/lib/optics/spec";
import {
  cantCompensatedDialMm,
  cantedDropWindageMm,
  clampCantDeg,
} from "@/lib/range/cant";
import {
  AWARE_MAP_MAX_M,
  pointFromBearingDistance,
  type CellPoint,
} from "@/lib/aware/cellGeometry";

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

/**
 * Bird / aim seat on the Aware map.
 * Defaults: origin map centre (50,50), Finnskogen scale — prefer passing
 * the active cell stand + map.awareMapMaxM so green-bracket (etc.) ranges land correctly.
 */
export function birdMarkerOnAwareMap(
  distanceM: number,
  bearingDeg: number,
  opts?: { origin?: CellPoint; maxM?: number },
): CellPoint {
  return pointFromBearingDistance(
    opts?.origin ?? { x: 50, y: 50 },
    distanceM,
    bearingDeg,
    opts?.maxM ?? AWARE_MAP_MAX_M,
  );
}

export type BallisticHoldSolution = {
  distanceM: number;
  /** World-frame drop below LOS (mm, +down). */
  dropMm: number;
  /** World-frame lateral POI (mm, +right): spin + wind. */
  windageMm: number;
  spinDriftMm: number;
  windDriftMm: number;
  timeOfFlightS: number;
  /**
   * Drop / windage on scope axes under {@link cantDeg}.
   * Equal to world values when the rifle is level.
   */
  scopeDropMm: number;
  scopeWindageMm: number;
  /** Rifle cant used for scope components / optional dial compensate (deg). */
  cantDeg: number;
  /**
   * Turret dial from perfect zero, mm-at-100 m.
   * +x = right dial, +y = down dial (same as session zero storage).
   * To cancel drop/wind, dial the opposite of POI.
   * Devices assume a level rifle unless `cantCompensate` was set.
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
 *
 * Pass `cantDeg` to get scope-frame drop/windage (reticle axes). Dials stay
 * level-rifle unless `cantCompensate: true` (player bubble-level gameplay).
 */
export function exactBallisticHold(
  ammo: Pick<AmmoSpec, "v0" | "bc" | "bcModel"> & { caliber?: string },
  distanceM: number,
  crosswindMs: number,
  opts?: TrajectoryOptions & {
    powderTempC?: number;
    /** Override catalog dV/dT (e.g. Kestrel-calibrated). */
    dvDtMpsPerC?: number | null;
    /**
     * Rifle cant (deg, +CW from rear). Fills scopeDropMm / scopeWindageMm.
     * Does not change device dials unless `cantCompensate` is true.
     */
    cantDeg?: number;
    /**
     * When true with `cantDeg`, dials cancel world drop/wind on a canted
     * rifle (cheat / debug — real meters do not know cant).
     */
    cantCompensate?: boolean;
  },
): BallisticHoldSolution {
  const powderTempC = opts?.powderTempC ?? POWDER_TEMP_REFERENCE_C;
  const ammoEff = ammoAtPowderTemp(ammo, powderTempC, opts?.dvDtMpsPerC);
  const traj = sampleTrajectory(ammoEff, distanceM, opts);
  const wDrift = windDriftMm(
    crosswindMs,
    traj.timeOfFlightS,
    distanceM,
    ammoEff.v0,
  );
  const windageMm = traj.spinDriftMm + wDrift;
  const dropMm = traj.dropBelowLosMm;
  const cantDeg = clampCantDeg(opts?.cantDeg ?? 0);
  const scope = cantedDropWindageMm(windageMm, dropMm, cantDeg);
  const scale = 100 / Math.max(1, distanceM);
  let dialXMmAt100: number;
  let dialYMmAt100: number;
  if (opts?.cantCompensate && Math.abs(cantDeg) >= 0.05) {
    const dial = cantCompensatedDialMm(windageMm, dropMm, cantDeg);
    dialXMmAt100 = dial.xMm * scale;
    dialYMmAt100 = dial.yMm * scale;
  } else {
    // Cancel POI: dial opposite direction (level-rifle device solution).
    dialXMmAt100 = -windageMm * scale;
    dialYMmAt100 = -dropMm * scale;
  }
  return {
    distanceM,
    dropMm,
    windageMm,
    spinDriftMm: traj.spinDriftMm,
    windDriftMm: wDrift,
    timeOfFlightS: traj.timeOfFlightS,
    scopeDropMm: scope.dropMm,
    scopeWindageMm: scope.windageMm,
    cantDeg,
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
 *
 * Display modes:
 * - MIL / MOA: angular units (2 decimals)
 * - CLICK_MIL: 0.1 mil clicks = mil×10 (1 decimal)
 * - CLICK_MOA: 0.25 MOA clicks = moa×4 (1 decimal)
 */
export type KestrelLcdCopy = {
  elevLine: string;
  windLine: string;
  tgtLine: string;
  windEnvLine: string;
};

export type KestrelDisplayMode = "MIL" | "MOA" | "CLICK_MIL" | "CLICK_MOA";

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

function formatKestrelAxisValue(
  mmAt100: number,
  mode: KestrelDisplayMode,
): { abs: number; digits: string; unitLabel: string } {
  const mils = mmAt100ToAngular(mmAt100, "MRAD");
  const moa = mmAt100ToAngular(mmAt100, "MOA");
  if (mode === "CLICK_MIL") {
    const clicks = mils * 10;
    return { abs: clicks, digits: clicks.toFixed(1), unitLabel: "CLK" };
  }
  if (mode === "CLICK_MOA") {
    const clicks = moa * 4;
    return { abs: clicks, digits: clicks.toFixed(1), unitLabel: "CLK" };
  }
  if (mode === "MOA") {
    return { abs: moa, digits: moa.toFixed(2), unitLabel: "MOA" };
  }
  return { abs: mils, digits: mils.toFixed(2), unitLabel: "MIL" };
}

export function formatKestrelLcd(
  solution: BallisticHoldSolution,
  opts: {
    shotBearingDeg: number;
    windFromDeg: number;
    windSpeedMs: number;
    /** Equipped scope click unit — default display mode when unset. */
    clickUnit?: ScopeClickUnit;
    /** How elev/wind are labeled on the LCD. */
    displayMode?: KestrelDisplayMode;
  },
): KestrelLcdCopy {
  const scopeUnit = opts.clickUnit ?? "MRAD";
  const mode =
    opts.displayMode ?? (scopeUnit === "MOA" ? "MOA" : "MIL");
  const eFmt = formatKestrelAxisValue(solution.dialYMmAt100, mode);
  const wFmt = formatKestrelAxisValue(solution.dialXMmAt100, mode);
  // Wind1 / Wind2 bracket (±~25% like dual-wind AB display)
  const w1 = wFmt.abs;
  const w2 = wFmt.abs * 1.4;
  const clickMode = mode === "CLICK_MIL" || mode === "CLICK_MOA";
  const w2Digits = clickMode ? w2.toFixed(1) : w2.toFixed(2);
  const eDir =
    Math.abs(solution.dialYMmAt100) < 0.05
      ? ""
      : solution.dialYMmAt100 < 0
        ? "U"
        : "D";
  const wDir =
    Math.abs(solution.dialXMmAt100) < 0.05
      ? ""
      : solution.dialXMmAt100 < 0
        ? "L"
        : "R";

  const zeroDigits = clickMode ? "0.0" : "0.00";
  const elevLine =
    Math.abs(solution.dialYMmAt100) < 0.05
      ? `E  ${zeroDigits} ${eFmt.unitLabel}`
      : `E  ${eFmt.digits}${eDir} ${eFmt.unitLabel}`;
  const windLine =
    Math.abs(solution.dialXMmAt100) < 0.05
      ? `W  ${zeroDigits}`
      : `W  ${wFmt.digits}/${w2Digits}${wDir}`;

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
