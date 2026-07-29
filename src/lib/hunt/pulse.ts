/**
 * Hunt heart rate (BPM) → vertical gun shake (systolic kick on top of calm wobble).
 *
 * Pulse is a real 50–180 BPM channel driven by BODY fatigue, recent walking
 * exertion, Aware sneak, spotting spikes, mind-food calm, and stimulants.
 */

export const HEART_RATE_FLOOR_BPM = 50;
/** Baseline “hvilepuls” after rest / tyribål. */
export const HEART_RATE_REST_BPM = 60;
export const HEART_RATE_MAX_BPM = 180;

/**
 * Shake bands (intensity 0→1):
 *   <80     invisible
 *   80–100  slight
 *   100–120 moderate
 *   120–140 noticeable
 *   140–180 full
 */
export const PULSE_SHAKE_VISIBLE_BPM = 80;

/** BODY fatigue 0→1 contributes up to this many BPM above rest. */
export const PULSE_FROM_BODY_BPM = 45;
/**
 * While resting / sitting, BODY only partially floors the pulse target so
 * acute load can settle below the shake band even when the BODY bar is low.
 */
export const PULSE_BODY_WHILE_RESTING_MULT = 0.45;
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

/** Vertical heartbeat kick amp at 100 m when intensity is full (mm of POA). */
export const PULSE_SHAKE_AMP_MM_AT_100M = 22;
/** Bipod / backpack rest dampens pulse kick (not eliminate). */
export const PULSE_SHAKE_REST_MULT = 0.5;
/**
 * Extra damp when CB bagrider is stacked on sekk/bipod.
 * Combined with rest: 0.5 × 0.35 = 0.175 — bagrider cuts more than bipod alone.
 */
export const PULSE_SHAKE_BAGRIDER_MULT = 0.35;

/** How fast HR rises toward a higher target (fraction per game-minute). */
export const PULSE_EASE_RISE_PER_GAME_MIN = 0.55;
/** How fast HR falls toward a lower target while idle. */
export const PULSE_EASE_FALL_PER_GAME_MIN = 0.28;
/** Extra fall ease while resting / tyribål sit. */
export const PULSE_EASE_FALL_RESTING_MULT = 2.4;
/** Extra ease while spotting with eyes/binos (calm down over time). */
export const PULSE_SPOTTING_EASE_MULT = 2.2;
/** Exertion decay per game-minute while idle / resting. */
export const EXERTION_DECAY_PER_GAME_MIN = 0.16;
/** Aware sneak intensity decay per game-minute while still. */
export const AWARE_SNEAK_DECAY_PER_GAME_MIN = 0.22;
/** Aware sneak rise while moving (per real second of sneak). */
export const AWARE_SNEAK_RISE_PER_SEC = 0.22;

/** @deprecated Prefer rise/fall rates. Kept for any old call sites. */
export const PULSE_EASE_PER_GAME_MIN = PULSE_EASE_FALL_PER_GAME_MIN;
/** @deprecated Focus uses the same calm curve as weapon shake. */
export const PULSE_SHAKE_FOCUS_MULT = 0.35;

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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp01(t);
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
  /** Sitting / eat rest — BODY floors pulse less hard. */
  resting?: boolean;
}): number {
  const body = clamp01(input.physicalFatigue);
  const exertion = clamp01(input.exertion01);
  const sneak = clamp01(input.awareSneak01);
  const stim = Math.max(0, input.stimBoostBpm);
  const bodyMult = input.resting ? PULSE_BODY_WHILE_RESTING_MULT : 1;
  const raw =
    HEART_RATE_REST_BPM +
    body * PULSE_FROM_BODY_BPM * bodyMult +
    exertion * PULSE_FROM_EXERTION_BPM +
    sneak * PULSE_FROM_AWARE_SNEAK_BPM +
    stim;
  return clampHeartRateBpm(raw);
}

/**
 * Ease current BPM toward target. Rise is snappy; fall is slower unless
 * `fallingMult` is raised (rest / spotting).
 */
export function easeHeartRateBpm(
  currentBpm: number,
  targetBpm: number,
  gameMinutes: number,
  opts?: { fallingMult?: number },
): number {
  if (gameMinutes <= 0) return clampHeartRateBpm(currentBpm);
  const rising = targetBpm > currentBpm;
  const rate = rising
    ? PULSE_EASE_RISE_PER_GAME_MIN
    : PULSE_EASE_FALL_PER_GAME_MIN * Math.max(0.1, opts?.fallingMult ?? 1);
  const t = 1 - Math.exp(-rate * gameMinutes);
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
  const fallEaseMult =
    (opts.resting ? PULSE_EASE_FALL_RESTING_MULT : 1) *
    (opts.spotting ? PULSE_SPOTTING_EASE_MULT : 1);
  const exertion01 = decayExertion01(state.exertion01, mins * decayMult);
  const awareSneak01 = decayAwareSneak01(state.awareSneak01, mins * decayMult);
  const target = targetHeartRateBpm({
    physicalFatigue: opts.physicalFatigue,
    exertion01,
    awareSneak01,
    stimBoostBpm: stimBoost,
    resting: opts.resting,
  });
  return {
    heartRateBpm: easeHeartRateBpm(state.heartRateBpm, target, mins, {
      fallingMult: fallEaseMult,
    }),
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
 * Banded shake intensity 0–1 from BPM.
 * Below {@link PULSE_SHAKE_VISIBLE_BPM} → 0 (no visible kick).
 */
export function pulseShakeIntensity01(heartRateBpm: number): number {
  const bpm = clampHeartRateBpm(heartRateBpm);
  if (bpm < PULSE_SHAKE_VISIBLE_BPM) return 0;
  if (bpm < 100) return lerp(0, 0.22, (bpm - 80) / 20);
  if (bpm < 120) return lerp(0.22, 0.48, (bpm - 100) / 20);
  if (bpm < 140) return lerp(0.48, 0.75, (bpm - 120) / 20);
  return lerp(0.75, 1, (bpm - 140) / 40);
}

/**
 * Systolic kick shape for one beat cycle (phase 0–1).
 * Sharp rise, soft diastolic settle — not a pure sine.
 */
export function pulseKickShape01(phase01: number): number {
  const p = ((phase01 % 1) + 1) % 1;
  // Systole: 0 → peak in first ~14 % of the beat.
  if (p < 0.14) {
    const u = p / 0.14;
    return u * u;
  }
  // Early diastole: exponential fall toward a small residual.
  if (p < 0.42) {
    const u = (p - 0.14) / 0.28;
    return Math.exp(-4.2 * u) * (1 - 0.12 * u);
  }
  // Quiet remainder of the cycle.
  if (p < 0.55) {
    const u = (p - 0.42) / 0.13;
    return 0.06 * (1 - u);
  }
  return 0;
}

/**
 * Vertical heartbeat kick in mm at POA (0 below 80 BPM).
 * Added on top of isotropic calm wobble — Y only.
 */
export function pulseVerticalAmpMm(
  heartRateBpm: number,
  distanceM: number,
  opts?: {
    rest?: boolean;
    bagrider?: boolean;
    /**
     * Same focus calm multiplier as weapon shake (`focusCalmMultiplier`).
     * Amp is divided by this (sweet ≈ ÷3). Default 1 = no focus.
     */
    focusCalmMult?: number;
  },
): number {
  const intensity = pulseShakeIntensity01(heartRateBpm);
  if (intensity <= 0) return 0;
  let amp =
    PULSE_SHAKE_AMP_MM_AT_100M *
    intensity *
    (Math.max(40, distanceM) / 100);
  if (opts?.rest) amp *= PULSE_SHAKE_REST_MULT;
  if (opts?.bagrider && opts?.rest) amp *= PULSE_SHAKE_BAGRIDER_MULT;
  const focusMult = opts?.focusCalmMult;
  if (focusMult != null && Number.isFinite(focusMult) && focusMult > 0) {
    amp /= focusMult;
  }
  return amp;
}

/**
 * Signed vertical kick offset (−ish…1) for the current time.
 * Multiply by {@link pulseVerticalAmpMm} and add to wobble Y.
 */
export function pulseKickOffset(
  heartRateBpm: number,
  tSec: number,
): number {
  const hz = pulseHz(heartRateBpm);
  if (!(hz > 0)) return 0;
  const phase = tSec * hz;
  return pulseKickShape01(phase);
}

export function pulseHz(heartRateBpm: number): number {
  return clampHeartRateBpm(heartRateBpm) / 60;
}

export function formatPulseBpm(heartRateBpm: number): string {
  return `${Math.round(clampHeartRateBpm(heartRateBpm))}`;
}
