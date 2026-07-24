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
