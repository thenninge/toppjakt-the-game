/**
 * Pointer drag → aim mm so the scope world follows the finger
 * (same feel as SpotView binos/thermal pan).
 *
 * Scope paint: panPx = aimMm * pxPerMm * scale
 * Finger +dx → world +dx → panPx −dx → aimMm decreases.
 */
export function aimMmDeltaFromPointerDrag(opts: {
  dxClientPx: number;
  dyClientPx: number;
  scale: number;
  pxPerMm: number;
  /** 1 = normal; use focus slow-mult for fine drag. */
  sensitivity?: number;
}): { x: number; y: number } {
  const sens = opts.sensitivity ?? 1;
  const denom = Math.max(1e-6, opts.scale * opts.pxPerMm);
  return {
    x: (-opts.dxClientPx * sens) / denom,
    y: (-opts.dyClientPx * sens) / denom,
  };
}

export function clampAimMm(
  x: number,
  y: number,
  limitX: number,
  limitY: number = limitX,
): { x: number; y: number } {
  return {
    x: Math.max(-limitX, Math.min(limitX, x)),
    y: Math.max(-limitY, Math.min(limitY, y)),
  };
}

/** Arrow hold: wait before continuous pan (mirrors SpotView binos). */
export const SCOPE_AIM_HOLD_MS = 160;
/** Speed multiplier right when continuous pan starts. */
export const SCOPE_AIM_HOLD_BASE_MULT = 1;
/** Extra multiplier per second of holding. */
export const SCOPE_AIM_HOLD_ACCEL = 2.6;
/** Cap so long holds stay controllable. */
export const SCOPE_AIM_HOLD_MAX_MULT = 5.5;
/**
 * Single arrow tap — fraction of visible scope FOV (landscape) or
 * of {@link SCOPE_AIM_TAP_MM} at 100 m (paper target).
 */
export const SCOPE_AIM_TAP_FOV_FRAC = 0.045;
export const SCOPE_AIM_TAP_MM = 10;

/**
 * Hold ramp for arrow aim — 0 during the tap window, then 1→max.
 * Same curve shape as SpotView `OPTIC_PAN_HOLD_*`.
 */
export function scopeAimHoldMult(
  sinceMs: number | null,
  nowMs: number,
): number {
  if (sinceMs == null) return 0;
  const held = nowMs - sinceMs;
  if (held < SCOPE_AIM_HOLD_MS) return 0;
  const t = (held - SCOPE_AIM_HOLD_MS) / 1000;
  return Math.min(
    SCOPE_AIM_HOLD_MAX_MULT,
    SCOPE_AIM_HOLD_BASE_MULT + t * SCOPE_AIM_HOLD_ACCEL,
  );
}
