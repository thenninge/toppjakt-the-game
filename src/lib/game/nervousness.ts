import type { CamoTerrain } from "@/lib/camo/spec";

/**
 * Bird nervousness — will it sit or flush?
 *
 * Encounter tick is designed so we can plug in a richer model later
 * (camo quality, terrain mismatch, faffe, LOS, wind noise, species curves).
 *
 * Distance bands (current encounter rules):
 * - > 350 m: still → no nerve gain; holding move ≥ 1 s → nerve rises
 * - 80–350 m: closer → faster nerve; movement amplifies
 * - ≤ 80 m: always flush
 */

export type NervousnessInputs = {
  distanceM: number;
  dangerRadiusM: number;
  /** Camo birdSpot after snow/no-snow selection (+ optional fine-tune). Lower = better. */
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

/** Encounter-band constants for Aware stalking. */
export const ENCOUNTER_NERVE = {
  stillSafeDistanceM: 350,
  alwaysFlushDistanceM: 80,
  /** Real seconds of continuous move before long-range nerve starts. */
  moveGraceSec: 1,
  flushThreshold: 1,
  /** Max displayed / accumulated nerve. */
  nerveCap: 1.35,
} as const;

/**
 * Inputs for the per-frame encounter nerve tick.
 * Expand this as the advanced model lands (terrain, species, pack noise…).
 */
export type EncounterNerveContext = {
  distanceM: number;
  /** True while any move key is held this frame. */
  isMoving: boolean;
  /** Continuous real seconds the player has been holding move (0 when still). */
  moveHoldSec: number;
  /**
   * Combined kit camo bird-spot factor (0 ≈ ghost, 1 ≈ blaze orange).
   * Lower = better concealment. Typical kit blends ≈ 0.2–0.7.
   */
  camoBirdSpot: number;
  /** Optional LOS / cover hooks for future tuning. */
  birdSeesPlayer?: number;
  coverFactor?: number;
  losActive?: boolean;
};

export type EncounterNerveTickResult = {
  nerve: number;
  flushes: boolean;
  /** Nerve gain per real second at this instant (for UI / debug). */
  ratePerSec: number;
  /** Why the rate is what it is (stable string keys for UI). */
  reason:
    | "still_safe"
    | "move_grace"
    | "moving_far"
    | "still_close"
    | "moving_close"
    | "always_flush";
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
 * 0 at ≥ stillSafe, 1 at ≤ alwaysFlush — drives “closer = faster nerves”.
 */
export function proximityFactor(
  distanceM: number,
  stillSafeM = ENCOUNTER_NERVE.stillSafeDistanceM,
  flushM = ENCOUNTER_NERVE.alwaysFlushDistanceM,
): number {
  if (distanceM >= stillSafeM) return 0;
  if (distanceM <= flushM) return 1;
  return (stillSafeM - distanceM) / (stillSafeM - flushM);
}

/**
 * Camo multiplier on nerve rate. Higher birdSpot → bird spooked faster.
 * Reserved hook: terrain mismatch can multiply this later.
 */
export function camoNerveMultiplier(camoBirdSpot: number): number {
  const spot = Math.min(1.2, Math.max(0.05, camoBirdSpot));
  // ~0.55 (great camo) … ~1.35 (poor)
  return 0.45 + spot * 1.15;
}

/**
 * Instantaneous nerve rate (per real second) for Aware stalking.
 * Advanced algorithm entry point — keep side-effect free.
 */
export function encounterNerveRatePerSec(
  ctx: EncounterNerveContext,
): { rate: number; reason: EncounterNerveTickResult["reason"] } {
  const { distanceM, isMoving, moveHoldSec, camoBirdSpot } = ctx;
  const camo = camoNerveMultiplier(camoBirdSpot);
  const losBoost =
    1 +
    (ctx.losActive && (ctx.birdSeesPlayer ?? 0) > 0.4
      ? 0.15 * (ctx.birdSeesPlayer ?? 0)
      : 0);

  if (distanceM <= ENCOUNTER_NERVE.alwaysFlushDistanceM) {
    return { rate: 99, reason: "always_flush" };
  }

  const movingPastGrace =
    isMoving && moveHoldSec >= ENCOUNTER_NERVE.moveGraceSec;
  const inGrace = isMoving && moveHoldSec < ENCOUNTER_NERVE.moveGraceSec;

  if (distanceM > ENCOUNTER_NERVE.stillSafeDistanceM) {
    if (!isMoving) return { rate: 0, reason: "still_safe" };
    if (inGrace) return { rate: 0, reason: "move_grace" };
    // Far but moving past grace — mild spook (camo still helps)
    return { rate: 0.055 * camo * losBoost, reason: "moving_far" };
  }

  const prox = proximityFactor(distanceM);
  // Still inside 350 m: slow creep of nerves (camo + proximity)
  let rate = 0.018 * prox * camo * losBoost;
  let reason: EncounterNerveTickResult["reason"] = "still_close";

  if (movingPastGrace) {
    rate += 0.14 * Math.max(0.25, prox) * camo * losBoost;
    reason = "moving_close";
  } else if (inGrace) {
    reason = "move_grace";
  }

  return { rate, reason };
}

/**
 * Advance encounter nerve by `dtSec` real seconds.
 * Call from Aware rAF loop. Flushes at threshold or ≤ 80 m.
 */
export function tickEncounterNerve(
  nerve: number,
  dtSec: number,
  ctx: EncounterNerveContext,
  flushThreshold = ENCOUNTER_NERVE.flushThreshold,
): EncounterNerveTickResult {
  if (ctx.distanceM <= ENCOUNTER_NERVE.alwaysFlushDistanceM) {
    return {
      nerve: ENCOUNTER_NERVE.nerveCap,
      flushes: true,
      ratePerSec: 99,
      reason: "always_flush",
    };
  }

  const { rate, reason } = encounterNerveRatePerSec(ctx);
  const next = Math.min(ENCOUNTER_NERVE.nerveCap, Math.max(0, nerve + rate * dtSec));
  return {
    nerve: next,
    flushes: next >= flushThreshold,
    ratePerSec: rate,
    reason,
  };
}

/**
 * Legacy snapshot score (range / HUD). Prefer tickEncounterNerve in Aware.
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
