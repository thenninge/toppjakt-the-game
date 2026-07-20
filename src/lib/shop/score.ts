/**
 * Player-facing shop scores — always 1–10, always higher = better.
 *
 * UX rule: every Pike Pro category should expose Score10 knobs so the
 * player can compare kit without learning inverted scales (low=good).
 * Engine may still use raw physics (MOA, %, grams); scores are the
 * shop/HUD language.
 */

export type Score10 = number;

export const SCORE10_MIN = 1;
export const SCORE10_MAX = 10;

export function clampScore10(n: number): Score10 {
  return Math.min(SCORE10_MAX, Math.max(SCORE10_MIN, Math.round(n)));
}

export function isScore10(n: number): n is Score10 {
  return Number.isFinite(n) && n >= SCORE10_MIN && n <= SCORE10_MAX;
}

/** Format for shop rows: "8/10". */
export function formatScore10(score: Score10): string {
  return `${clampScore10(score)}/10`;
}
