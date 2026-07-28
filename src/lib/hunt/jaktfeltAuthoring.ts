/**
 * Helpers for Admin → Jaktfelt: seat placement, cell from map %, Aware scale.
 */

import {
  AWARE_MAP_MAX_M,
  AWARE_MAP_RADIUS_PCT,
  awareMapMaxMFor,
  awareMetersPerPctFor,
  type CellPoint,
} from "@/lib/aware/cellGeometry";
import type { HuntGridCell, HuntMapAsset, HuntMapId } from "@/lib/hunt/maps";
import { cellLabel } from "@/lib/hunt/maps";
import type { MapBirdSeat } from "@/lib/hunt/mapPlacements";

export type JaktfeltBirdSpecies = "tiur" | "orrhane";

export type JaktfeltMapTool =
  | "tiur"
  | "orrhane"
  | "erase"
  | "start"
  | "measure"
  | "aware-ring";

/** Map % → hunt grid cell (row 0 = A bottom, col 0 = 1 left). */
export function cellFromMapPct(
  xPct: number,
  yPct: number,
  map: Pick<HuntMapAsset, "cols" | "rows">,
): HuntGridCell {
  const col = Math.max(
    0,
    Math.min(map.cols - 1, Math.floor((xPct / 100) * map.cols)),
  );
  const rowFromTop = Math.floor((yPct / 100) * map.rows);
  const row = Math.max(0, Math.min(map.rows - 1, map.rows - 1 - rowFromTop));
  return { row, col };
}

export function seatAtClick(
  species: JaktfeltBirdSpecies,
  xPct: number,
  yPct: number,
  map: Pick<HuntMapAsset, "cols" | "rows">,
): MapBirdSeat {
  const cell = cellFromMapPct(xPct, yPct, map);
  return {
    species,
    xPct: Math.round(xPct * 100) / 100,
    yPct: Math.round(yPct * 100) / 100,
    row: cell.row,
    col: cell.col,
  };
}

/** Drop seats within ~1.2 % of a click (map %). */
export function eraseSeatsNear(
  seats: readonly MapBirdSeat[],
  xPct: number,
  yPct: number,
  radiusPct = 1.2,
): MapBirdSeat[] {
  return seats.filter(
    (s) => Math.hypot(s.xPct - xPct, s.yPct - yPct) > radiusPct,
  );
}

export function countSeats(seats: readonly MapBirdSeat[]): {
  tiur: number;
  orrhane: number;
  total: number;
} {
  let tiur = 0;
  let orrhane = 0;
  for (const s of seats) {
    if (s.species === "tiur") tiur += 1;
    else orrhane += 1;
  }
  return { tiur, orrhane, total: tiur + orrhane };
}

/** Diameter in map-% for a meter radius at current Aware scale. */
export function awareRingDiameterPct(
  radiusM: number,
  map: Parameters<typeof awareMetersPerPctFor>[0],
): number {
  const mPerPct = awareMetersPerPctFor(map);
  return (Math.max(0, radiusM) / mPerPct) * 2;
}

/** 42 % radius ring used by Aware map-max calibration. */
export function awareScaleRingDiameterPct(): number {
  return AWARE_MAP_RADIUS_PCT * 2;
}

/**
 * Infer awareMapMaxM from a known ground distance between two map points.
 * The measured map % span should equal that many meters.
 */
export function awareMapMaxMFromKnownSpan(
  a: CellPoint,
  b: CellPoint,
  knownDistanceM: number,
): number {
  const pct = Math.hypot(b.x - a.x, b.y - a.y);
  if (pct < 0.05 || !(knownDistanceM > 0)) return AWARE_MAP_MAX_M;
  const metersPerPct = knownDistanceM / pct;
  return Math.round(metersPerPct * AWARE_MAP_RADIUS_PCT);
}

export function formatSeatSummary(
  seats: readonly MapBirdSeat[],
  map: Pick<HuntMapAsset, "cols" | "rows">,
): string {
  const c = countSeats(seats);
  return `${c.total} seter (${c.tiur} tiur · ${c.orrhane} orre) · grid ${map.cols}×${map.rows}`;
}

export function startCellLabel(
  start: HuntGridCell,
): string {
  return cellLabel(start);
}

export { awareMapMaxMFor, AWARE_MAP_MAX_M, AWARE_MAP_RADIUS_PCT };
export type { HuntMapId };
