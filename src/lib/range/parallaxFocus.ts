/**
 * Scope parallax / side-focus dial — distance marks + DOF blur vs subject range.
 * (True optical parallax error is out of scope; this is focus sharpness only.)
 */

/** Engraved hashmarks on the parallax turret (meters). */
export const PARALLAX_MARKS_M = [
  25, 30, 40, 50, 100, 150, 200, 300, 400, 500, 600, 800, 1000,
] as const;

/** Focus dialed to ∞ — treated as this distance for blur math. */
export const PARALLAX_INF_M = 2000;

/** Soft max CSS blur when focus is way off. */
export const PARALLAX_BLUR_CAP_PX = 7;

const LOG_SOFT = 0.12;
const LOG_GAIN = 5.5;

/** Visual rail: marks + ∞ as dial slots (index 0..length). */
export const PARALLAX_SLOT_COUNT = PARALLAX_MARKS_M.length + 1;

/**
 * Uneven visual spacing along the rail (0 = near / 25 m, 1 = ∞).
 * Equal gaps 30→40→50→100; 25 sits closer to 30 than 30 is to 40.
 */
const PARA_RAIL_T = [
  0, // 25
  0.055, // 30 — tighter than 30→40
  0.145, // 40  (+0.09)
  0.235, // 50  (+0.09)
  0.325, // 100 (+0.09)
  0.42, // 150
  0.51, // 200
  0.60, // 300
  0.68, // 400
  0.75, // 500
  0.82, // 600
  0.88, // 800
  0.94, // 1000
  1, // ∞
] as const;

export function isParallaxInfinity(focusM: number): boolean {
  return !Number.isFinite(focusM) || focusM >= PARALLAX_INF_M;
}

/** Effective meters for blur (∞ → PARALLAX_INF_M). */
export function parallaxFocusEffectiveM(focusM: number): number {
  if (isParallaxInfinity(focusM)) return PARALLAX_INF_M;
  return Math.max(10, focusM);
}

export function formatParallaxFocusM(focusM: number): string {
  if (isParallaxInfinity(focusM)) return "∞";
  const n = Math.round(focusM);
  return `${n} m`;
}

/**
 * CSS blur radius (px) from subject distance vs dialed focus.
 * Log-distance mismatch so 350 vs 200 / 400 is readable for rough ranging.
 */
export function focusBlurPx(subjectM: number, focusM: number): number {
  const subj = Math.max(10, subjectM);
  const focus = parallaxFocusEffectiveM(focusM);
  const mismatch = Math.abs(Math.log(subj) - Math.log(focus));
  if (mismatch < LOG_SOFT) return 0;
  const t = (mismatch - LOG_SOFT) / (1.2 - LOG_SOFT);
  const px = Math.min(PARALLAX_BLUR_CAP_PX, t * LOG_GAIN);
  return px < 0.05 ? 0 : px;
}

/** Short admin meta hint from blur amount. */
export function focusBlurHint(blurPx: number): string {
  if (blurPx < 0.05) return "skarpt";
  if (blurPx < 2) return "myk";
  if (blurPx < 4.5) return "uskarp";
  return "veldig uskarp";
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Focus meters at engraved slot index (last = ∞). */
export function parallaxFocusAtSlot(slot: number): number {
  const i = Math.round(slot);
  if (i >= PARALLAX_MARKS_M.length) return Number.POSITIVE_INFINITY;
  if (i <= 0) return PARALLAX_MARKS_M[0]!;
  return PARALLAX_MARKS_M[Math.min(PARALLAX_MARKS_M.length - 1, i)]!;
}

/**
 * Map continuous dial index [0 .. marks.length] onto focus meters.
 * Integer indices land on marks; last slot is ∞.
 */
export function parallaxFocusFromDialIndex(index: number): number {
  const max = PARALLAX_MARKS_M.length; // ∞ at index === max
  const clamped = Math.min(max, Math.max(0, index));
  if (clamped >= max) return Number.POSITIVE_INFINITY;
  const lo = Math.floor(clamped);
  const hi = Math.ceil(clamped);
  if (lo === hi) return PARALLAX_MARKS_M[lo]!;
  if (hi >= max) {
    const a = PARALLAX_MARKS_M[lo]!;
    const t = clamped - lo;
    return a + t * (PARALLAX_INF_M - a);
  }
  const a = PARALLAX_MARKS_M[lo]!;
  const b = PARALLAX_MARKS_M[hi]!;
  const t = clamped - lo;
  return a + t * (b - a);
}

/** Inverse of parallaxFocusFromDialIndex for drum face position. */
export function parallaxDialIndexFromFocusM(focusM: number): number {
  if (isParallaxInfinity(focusM)) return PARALLAX_MARKS_M.length;
  const m = Math.max(10, focusM);
  const marks = PARALLAX_MARKS_M;
  if (m <= marks[0]!) return 0;
  for (let i = 0; i < marks.length - 1; i++) {
    const a = marks[i]!;
    const b = marks[i + 1]!;
    if (m <= b) {
      const t = (m - a) / (b - a);
      return i + t;
    }
  }
  const last = marks[marks.length - 1]!;
  if (m >= PARALLAX_INF_M) return marks.length;
  const t = Math.min(1, (m - last) / (PARALLAX_INF_M - last));
  return marks.length - 1 + t;
}

/** Visual 0–1 position on the uneven rail for a dial index. */
export function parallaxRailTFromDialIndex(index: number): number {
  const max = PARALLAX_MARKS_M.length;
  const clamped = Math.min(max, Math.max(0, index));
  const lo = Math.floor(clamped);
  const hi = Math.ceil(clamped);
  if (lo === hi) return PARA_RAIL_T[lo] ?? 1;
  const a = PARA_RAIL_T[lo] ?? 0;
  const b = PARA_RAIL_T[Math.min(hi, PARA_RAIL_T.length - 1)] ?? 1;
  return lerp(a, b, clamped - lo);
}

/** Dial index from visual 0–1 rail position (drag on fixed scale). */
export function parallaxDialIndexFromRailT(t: number): number {
  const u = Math.min(1, Math.max(0, t));
  for (let i = 0; i < PARA_RAIL_T.length - 1; i++) {
    const a = PARA_RAIL_T[i]!;
    const b = PARA_RAIL_T[i + 1]!;
    if (u <= b) {
      const frac = b === a ? 0 : (u - a) / (b - a);
      return i + frac;
    }
  }
  return PARALLAX_MARKS_M.length;
}

/** Label for engraved slot (∞ for last). */
export function parallaxSlotLabel(slot: number): string {
  if (slot >= PARALLAX_MARKS_M.length) return "∞";
  return String(PARALLAX_MARKS_M[slot]!);
}

/** Nudge focus toward nearer (−) or farther (+) by one mark. */
export function nudgeParallaxFocusM(focusM: number, dir: -1 | 1): number {
  const idx = parallaxDialIndexFromFocusM(focusM);
  const next = Math.min(
    PARALLAX_MARKS_M.length,
    Math.max(0, Math.round(idx + dir)),
  );
  return parallaxFocusFromDialIndex(next);
}
