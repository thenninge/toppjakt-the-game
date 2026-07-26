/**
 * Hunt heart rate (BPM) → vertical gun shake.
 *
 * Pulse is a real 50–180 BPM channel driven by BODY fatigue, recent walking
 * exertion, Aware sneak, spotting spikes, mind-food calm, and stimulants.
 */

export const HEART_RATE_FLOOR_BPM = 50;
/** Baseline “hvilepuls” after rest / tyribål. */
export const HEART_RATE_REST_BPM = 60;
export const HEART_RATE_MAX_BPM = 180;

/** BODY fatigue 0→1 contributes up to this many BPM above rest. */
export const PULSE_FROM_BODY_BPM = 45;
/** Recent walk exertion 0→1 contributes up to this many BPM. */
export const PULSE_FROM_EXERTION_BPM = 55;
/** Aware sneak 0→1 contributes up to this many BPM. */
export const PULSE_FROM_AWARE_SNEAK_BPM = 35;

/** Spotting spike: orre / tiur. */
export const PULSE_SPOT_ORRE_BPM = 20;
export const PULSE_SPOT_TIUR_BPM = 30;

/**
 * Mind recovery → pulse drop: 100 % mind → −50 BPM (floor 50).
 * 20 % mind → −10 BPM.
 */
export const PULSE_PER_FULL_MIND_BPM = 50;

/** Vertical heartbeat amp at 100 m when BPM is at max (mm of POA). */
export const PULSE_SHAKE_AMP_MM_AT_100M = 22;
/** Bipod / backpack rest dampens pulse vertical shake (not eliminate). */
export const PULSE_SHAKE_REST_MULT = 0.45;
/** Hold breath (F) strongly dampens pulse vertical shake. */
export const PULSE_SHAKE_FOCUS_MULT = 0.35;

/** How fast HR eases toward target (fraction per game-minute). */
export const PULSE_EASE_PER_GAME_MIN = 0.35;
/** Extra ease while spotting with eyes/binos (calm down over time). */
export const PULSE_SPOTTING_EASE_MULT = 2.2;
/** Exertion decay per game-minute while idle / resting. */
export const EXERTION_DECAY_PER_GAME_MIN = 0.12;
/** Aware sneak intensity decay per game-minute while still. */
export const AWARE_SNEAK_DECAY_PER_GAME_MIN = 0.18;
/** Aware sneak rise while moving (per real second of sneak). */
export const AWARE_SNEAK_RISE_PER_SEC = 0.22;

export type PulseStim = {
  boostBpm: number;
  /** Clock minutes when stim expires (absolute hunt clock). */
  expiresAtClockMin: number;
};

export type PulseState = {
  heartRateBpm: number;
  /** 0–1 recent travel intensity. */
  exertion01: number;
  /** 0–1 Aware sneak load. */
  awareSneak01: number;
  stim: PulseStim | null;
};

export function clampHeartRateBpm(n: number): number {
  if (!Number.isFinite(n)) return HEART_RATE_REST_BPM;
  return Math.min(
    HEART_RATE_MAX_BPM,
    Math.max(HEART_RATE_FLOOR_BPM, n),
  );
}

export function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export function initialPulseState(
  physicalFatigue = 0,
): PulseState {
  return {
    heartRateBpm: targetHeartRateBpm({
      physicalFatigue,
      exertion01: 0,
      awareSneak01: 0,
      stimBoostBpm: 0,
    }),
    exertion01: 0,
    awareSneak01: 0,
    stim: null,
  };
}

export function activeStimBoostBpm(
  stim: PulseStim | null,
  clockMinutes: number,
): number {
  if (!stim) return 0;
  if (clockMinutes >= stim.expiresAtClockMin) return 0;
  return Math.max(0, stim.boostBpm);
}

export function targetHeartRateBpm(input: {
  physicalFatigue: number;
  exertion01: number;
  awareSneak01: number;
  stimBoostBpm: number;
}): number {
  const body = clamp01(input.physicalFatigue);
  const exertion = clamp01(input.exertion01);
  const sneak = clamp01(input.awareSneak01);
  const stim = Math.max(0, input.stimBoostBpm);
  const raw =
    HEART_RATE_REST_BPM +
    body * PULSE_FROM_BODY_BPM +
    exertion * PULSE_FROM_EXERTION_BPM +
    sneak * PULSE_FROM_AWARE_SNEAK_BPM +
    stim;
  return clampHeartRateBpm(raw);
}

/**
 * Ease current BPM toward target. `gameMinutes` is elapsed hunt time.
 */
export function easeHeartRateBpm(
  currentBpm: number,
  targetBpm: number,
  gameMinutes: number,
): number {
  if (gameMinutes <= 0) return clampHeartRateBpm(currentBpm);
  const t = 1 - Math.exp(-PULSE_EASE_PER_GAME_MIN * gameMinutes);
  return clampHeartRateBpm(currentBpm + (targetBpm - currentBpm) * t);
}

/**
 * Walk bump: speedy / high strain raises exertion; extreme caution barely does.
 * `physicalStrain` and `speed` from HuntPace.
 */
export function exertionAfterWalk(
  prev: number,
  opts: { physicalStrain: number; speed: number; pathCells: number },
): number {
  const cells = Math.max(0, opts.pathCells);
  if (cells <= 0) return clamp01(prev);
  const intensity = clamp01(opts.physicalStrain) * Math.max(0.15, opts.speed);
  const bump = intensity * 0.22 * Math.min(6, cells);
  return clamp01(prev + bump);
}

export function decayExertion01(prev: number, gameMinutes: number): number {
  if (gameMinutes <= 0) return clamp01(prev);
  const t = 1 - Math.exp(-EXERTION_DECAY_PER_GAME_MIN * gameMinutes);
  return clamp01(prev * (1 - t));
}

export function decayAwareSneak01(prev: number, gameMinutes: number): number {
  if (gameMinutes <= 0) return clamp01(prev);
  const t = 1 - Math.exp(-AWARE_SNEAK_DECAY_PER_GAME_MIN * gameMinutes);
  return clamp01(prev * (1 - t));
}

/** Real-time Aware sneak while moving toward a safe seat. */
export function riseAwareSneak01(prev: number, realSec: number): number {
  if (realSec <= 0) return clamp01(prev);
  return clamp01(prev + AWARE_SNEAK_RISE_PER_SEC * realSec);
}

/**
 * Advance pulse state by `gameMinutes` of hunt time (idle / rest / eat / spot).
 * Pass `resting` / `spotting` for stronger calm-down.
 */
export function tickPulseState(
  state: PulseState,
  opts: {
    gameMinutes: number;
    physicalFatigue: number;
    clockMinutes: number;
    resting?: boolean;
    spotting?: boolean;
  },
): PulseState {
  const mins = Math.max(0, opts.gameMinutes);
  const stimBoost = activeStimBoostBpm(state.stim, opts.clockMinutes);
  const stim =
    state.stim && opts.clockMinutes >= state.stim.expiresAtClockMin
      ? null
      : state.stim;
  const decayMult =
    (opts.resting ? 2.2 : 1) * (opts.spotting ? 1.6 : 1);
  const easeMult = opts.spotting ? PULSE_SPOTTING_EASE_MULT : 1;
  const exertion01 = decayExertion01(state.exertion01, mins * decayMult);
  const awareSneak01 = decayAwareSneak01(state.awareSneak01, mins * decayMult);
  const target = targetHeartRateBpm({
    physicalFatigue: opts.physicalFatigue,
    exertion01,
    awareSneak01,
    stimBoostBpm: stimBoost,
  });
  return {
    heartRateBpm: easeHeartRateBpm(
      state.heartRateBpm,
      target,
      mins * easeMult,
    ),
    exertion01,
    awareSneak01,
    stim,
  };
}

/** Instant BPM bump (spotting spike). */
export function bumpHeartRateBpm(
  state: PulseState,
  deltaBpm: number,
): PulseState {
  if (!(deltaBpm > 0)) return state;
  return {
    ...state,
    heartRateBpm: clampHeartRateBpm(state.heartRateBpm + deltaBpm),
  };
}

/** Tyribål / deep rest → hvilepuls, clear acute load. */
export function setPulseToResting(state: PulseState): PulseState {
  return {
    heartRateBpm: HEART_RATE_REST_BPM,
    exertion01: 0,
    awareSneak01: 0,
    stim: null,
  };
}

/**
 * Mind recovery lowers pulse: mindGain 1 → −50 BPM (floor 50).
 * mindToFull / 100 % mind → set to 50.
 */
export function applyMindCalmToPulse(
  state: PulseState,
  opts: { mindGain?: number; mindToFull?: boolean },
): PulseState {
  if (opts.mindToFull) {
    return {
      ...state,
      stim: null,
      heartRateBpm: HEART_RATE_FLOOR_BPM,
    };
  }
  const gain = clamp01(opts.mindGain ?? 0);
  if (gain <= 0) return state;
  return {
    ...state,
    heartRateBpm: clampHeartRateBpm(
      state.heartRateBpm - gain * PULSE_PER_FULL_MIND_BPM,
    ),
  };
}

/** Apply stim from caffeine (replaces weaker/expired stim). */
export function applyPulseStim(
  state: PulseState,
  opts: {
    boostBpm: number;
    durationGameMin: number;
    clockMinutes: number;
    physicalFatigue: number;
  },
): PulseState {
  const { boostBpm, durationGameMin, clockMinutes, physicalFatigue } = opts;
  if (!(boostBpm > 0) || !(durationGameMin > 0)) return state;
  const next: PulseStim = {
    boostBpm,
    expiresAtClockMin: clockMinutes + durationGameMin,
  };
  const cur = activeStimBoostBpm(state.stim, clockMinutes);
  const stim =
    !state.stim ||
    next.boostBpm >= cur ||
    clockMinutes >= state.stim.expiresAtClockMin
      ? next
      : state.stim;
  const target = targetHeartRateBpm({
    physicalFatigue,
    exertion01: state.exertion01,
    awareSneak01: state.awareSneak01,
    stimBoostBpm: activeStimBoostBpm(stim, clockMinutes),
  });
  return {
    ...state,
    stim,
    heartRateBpm: easeHeartRateBpm(state.heartRateBpm, target, 2),
  };
}

/**
 * Vertical heartbeat amplitude in mm at POA (0 at ≤ rest, strong near max).
 * Isotropic calm wobble is separate — this is Y-only.
 */
export function pulseVerticalAmpMm(
  heartRateBpm: number,
  distanceM: number,
  opts?: { rest?: boolean; focused?: boolean },
): number {
  const bpm = clampHeartRateBpm(heartRateBpm);
  const span = HEART_RATE_MAX_BPM - HEART_RATE_REST_BPM;
  const t = Math.max(0, (bpm - HEART_RATE_REST_BPM) / span);
  const shaped = t * t;
  let amp =
    PULSE_SHAKE_AMP_MM_AT_100M * shaped * (Math.max(40, distanceM) / 100);
  if (opts?.rest) amp *= PULSE_SHAKE_REST_MULT;
  if (opts?.focused) amp *= PULSE_SHAKE_FOCUS_MULT;
  return amp;
}

export function pulseHz(heartRateBpm: number): number {
  return clampHeartRateBpm(heartRateBpm) / 60;
}

export function formatPulseBpm(heartRateBpm: number): string {
  return `${Math.round(clampHeartRateBpm(heartRateBpm))}`;
}
