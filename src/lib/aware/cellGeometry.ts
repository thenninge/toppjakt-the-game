/**
 * Aware cell-local geometry: hunter / bird positions on the stage (0–100 %).
 * Scale matches birdMarkerOnAwareMap (450 m → 42 % radius).
 */

export const AWARE_MAP_MAX_M = 450;
export const AWARE_MAP_RADIUS_PCT = 42;
export const AWARE_METERS_PER_PCT = AWARE_MAP_MAX_M / AWARE_MAP_RADIUS_PCT;

export type CellPoint = { x: number; y: number };

export function clampCellPoint(p: CellPoint): CellPoint {
  return {
    x: Math.min(96, Math.max(4, p.x)),
    y: Math.min(96, Math.max(4, p.y)),
  };
}

/** Compass bearing from `from` → `to` (0 = north / up on map). */
export function bearingDegFromTo(from: CellPoint, to: CellPoint): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

export function distanceMBetween(
  a: CellPoint,
  b: CellPoint,
  metersPerPct = AWARE_METERS_PER_PCT,
): number {
  return Math.hypot(b.x - a.x, b.y - a.y) * metersPerPct;
}

/** Move `from` toward `to` by `stepPct` (percent of stage). */
export function stepToward(
  from: CellPoint,
  to: CellPoint,
  stepPct: number,
): CellPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.05) return clampCellPoint(to);
  const t = Math.min(1, stepPct / dist);
  return clampCellPoint({
    x: from.x + dx * t,
    y: from.y + dy * t,
  });
}

export function stepByKeys(
  from: CellPoint,
  keys: { up: boolean; down: boolean; left: boolean; right: boolean },
  stepPct: number,
): CellPoint {
  let dx = 0;
  let dy = 0;
  if (keys.up) dy -= 1;
  if (keys.down) dy += 1;
  if (keys.left) dx -= 1;
  if (keys.right) dx += 1;
  if (dx === 0 && dy === 0) return from;
  const len = Math.hypot(dx, dy);
  return clampCellPoint({
    x: from.x + (dx / len) * stepPct,
    y: from.y + (dy / len) * stepPct,
  });
}
