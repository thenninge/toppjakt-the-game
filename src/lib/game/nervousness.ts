import type { CamoTerrain } from "@/lib/camo/spec";

/**
 * Bird nervousness — will it sit or flush?
 *
 * Same family of pressure as bad camo / excess movement: the bird accumulates
 * “nerves” until a flush threshold. Chestrig/pack matter because they cut
 * *faffe time* (getting optics or rifle out) while you are in the danger zone.
 *
 * Conceptual model (tune constants in engine later):
 *
 *   effectiveSpot = birdSpotFactor * terrainMismatchMultiplier
 *
 *   faffePressure = (opticsDeploySeconds + rifleFaffeSecondsThisEncounter)
 *                   * faffeWeight
 *
 *   nervousness ≈
 *       distanceTerm(distanceM)           // closer → higher
 *     + effectiveSpot * spotWeight
 *     + timeInDangerZoneSec * timeWeight
 *     + faffePressure
 *     + movementNoiseTerm                 // already exists via speed/weight
 *
 *   if nervousness >= flushThreshold → bird flies
 *
 * Distance term example: max(0, (dangerRadiusM - distanceM) / dangerRadiusM)
 * Danger zone ≈ spooking radius for species/terrain.
 */

export type NervousnessInputs = {
  distanceM: number;
  dangerRadiusM: number;
  /** Camo birdSpot after snow/no-snow selection (+ optional fine-tune). */
  effectiveBirdSpotFactor: number;
  /** Seconds the player has been inside the bird’s danger zone this contact. */
  timeInDangerZoneSec: number;
  /**
   * Extra seconds of fumbling this encounter (optics draw, rifle from pack, etc.).
   * Comes from carryToEngine(CarrySpec) deploy times when those actions happen in-zone.
   */
  faffeSeconds: number;
  /** Optional: movement/noise contribution already computed elsewhere. */
  movementNoise?: number;
};

export type NervousnessWeights = {
  spotWeight: number;
  timeWeight: number;
  faffeWeight: number;
  movementWeight: number;
  flushThreshold: number;
};

export const DEFAULT_NERVOUSNESS_WEIGHTS: NervousnessWeights = {
  spotWeight: 1.2,
  timeWeight: 0.04,
  faffeWeight: 0.08,
  movementWeight: 1,
  flushThreshold: 1.0,
};

export function distancePressure(
  distanceM: number,
  dangerRadiusM: number,
): number {
  if (dangerRadiusM <= 0) return 1;
  if (distanceM >= dangerRadiusM) return 0;
  return (dangerRadiusM - distanceM) / dangerRadiusM;
}

/**
 * Returns nervousness score and whether the bird flushes.
 * Placeholder formula — expand with species curves later.
 */
export function evaluateNervousness(
  input: NervousnessInputs,
  weights: NervousnessWeights = DEFAULT_NERVOUSNESS_WEIGHTS,
): { nervousness: number; flushes: boolean } {
  const nervousness =
    distancePressure(input.distanceM, input.dangerRadiusM) +
    input.effectiveBirdSpotFactor * weights.spotWeight +
    input.timeInDangerZoneSec * weights.timeWeight +
    input.faffeSeconds * weights.faffeWeight +
    (input.movementNoise ?? 0) * weights.movementWeight;

  return {
    nervousness,
    flushes: nervousness >= weights.flushThreshold,
  };
}

/** Terrain list kept here only for doc cross-links in design. */
export type { CamoTerrain };
