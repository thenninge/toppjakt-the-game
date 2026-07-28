/**
 * Aware cell-local geometry: hunter / bird positions on the stage (0–100 %).
 *
 * Default scale (Finnskogen): 450 m × 2.2 × 1.27 → ~1257 m at 42 % radius.
 * Other maps may override via HuntMapAsset.awareMapMaxM.
 */

import type { HuntGridCell, HuntMapAsset } from "@/lib/hunt/maps";

/** Finnskogen-calibrated default: meters represented by {@link AWARE_MAP_RADIUS_PCT}. */
export const AWARE_MAP_MAX_M = 450 * 2.2 * 1.27;
export const AWARE_MAP_RADIUS_PCT = 42;
export const AWARE_METERS_PER_PCT = AWARE_MAP_MAX_M / AWARE_MAP_RADIUS_PCT;

export type CellPoint = { x: number; y: number };

export type AwareMapScaleSource = Pick<HuntMapAsset, "awareMapMaxM"> | null | undefined;

/** Per-map Aware max range (m at {@link AWARE_MAP_RADIUS_PCT}); Finnskogen default. */
export function awareMapMaxMFor(map: AwareMapScaleSource): number {
  const n = map?.awareMapMaxM;
  return typeof n === "number" && Number.isFinite(n) && n > 0
    ? n
    : AWARE_MAP_MAX_M;
}

export function awareMetersPerPctFor(map: AwareMapScaleSource): number {
  return awareMapMaxMFor(map) / AWARE_MAP_RADIUS_PCT;
}

/** Centre of a hunt grid cell in Aware map % (full terrain image). */
export function cellCenterOnAwareMap(
  cell: HuntGridCell,
  map: Pick<HuntMapAsset, "cols" | "rows">,
): CellPoint {
  return {
    x: ((cell.col + 0.5) / map.cols) * 100,
    y: (1 - (cell.row + 0.5) / map.rows) * 100,
  };
}

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

/**
 * Point at `distanceM` along compass bearing from `origin`.
 * Uses the map's Aware scale (maxM → {@link AWARE_MAP_RADIUS_PCT}).
 */
export function pointFromBearingDistance(
  origin: CellPoint,
  distanceM: number,
  bearingDeg: number,
  maxM: number = AWARE_MAP_MAX_M,
): CellPoint {
  const radiusPct = AWARE_MAP_RADIUS_PCT;
  const pct = Math.min(
    radiusPct,
    (Math.max(0, distanceM) / Math.max(1, maxM)) * radiusPct,
  );
  const rad = ((bearingDeg - 90) * Math.PI) / 180;
  return {
    x: origin.x + Math.cos(rad) * pct,
    y: origin.y + Math.sin(rad) * pct,
  };
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
