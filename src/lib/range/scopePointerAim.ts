/**
 * Pointer drag → aim mm so the scope world follows the finger
 * (same feel as SpotView binos/thermal pan).
 *
 * Scope paint: panPx = aimMm * pxPerMm * scale
 * Finger +dx → world +dx → panPx −dx → aimMm decreases.
 */

/**
 * Convert screen/client deltas into the element's local CSS px.
 * Needed when an ancestor applies {@code transform: scale} (ScopeOpticFit).
 */
export function clientDeltaToLocalCssPx(
  dxClientPx: number,
  dyClientPx: number,
  el: Pick<
    HTMLElement,
    "offsetWidth" | "offsetHeight" | "getBoundingClientRect"
  >,
): { dx: number; dy: number } {
  const rect = el.getBoundingClientRect();
  const sx = rect.width / Math.max(1e-6, el.offsetWidth);
  const sy = rect.height / Math.max(1e-6, el.offsetHeight);
  return {
    dx: dxClientPx / sx,
    dy: dyClientPx / sy,
  };
}

export function aimMmDeltaFromPointerDrag(opts: {
  dxClientPx: number;
  dyClientPx: number;
  scale: number;
  pxPerMm: number;
  /** 1 = normal; use focus slow-mult for fine drag. */
  sensitivity?: number;
  /**
   * Viewport (or any scaled element). When set, client deltas are converted
   * to local CSS px before aim math (ScopeOpticFit uniform scale).
   */
  viewportEl?: Pick<
    HTMLElement,
    "offsetWidth" | "offsetHeight" | "getBoundingClientRect"
  > | null;
}): { x: number; y: number } {
  const sens = opts.sensitivity ?? 1;
  let dx = opts.dxClientPx;
  let dy = opts.dyClientPx;
  if (opts.viewportEl) {
    const local = clientDeltaToLocalCssPx(dx, dy, opts.viewportEl);
    dx = local.dx;
    dy = local.dy;
  }
  const denom = Math.max(1e-6, opts.scale * opts.pxPerMm);
  return {
    x: (-dx * sens) / denom,
    y: (-dy * sens) / denom,
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
