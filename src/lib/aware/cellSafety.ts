/**
 * Deterministic bebyggelse + terrengbakgrunn for a hunt grid cell.
 *
 * Hazards are fixed distant points. Kakestykker are drawn from the current
 * stand / plan origin toward those points with a CONSTANT half-angle (no
 * distance-based widening). Apex moves; width does not — so lateral moves
 * open safe shot corridors without the slices “morphing”.
 *
 * ONE source of truth: drawn wedges === Klar til skudd.
 */

import {
  AWARE_METERS_PER_PCT,
  bearingDegFromTo,
  type CellPoint,
} from "@/lib/aware/cellGeometry";
import { cellLabel, type HuntGridCell, type HuntMapId } from "@/lib/hunt/maps";
import {
  HABITATION_COLORS,
  HABITATION_LABELS,
  type HabitationCategory,
  type HabitationSlice,
} from "@/lib/aware/types";

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORIES: HabitationCategory[] = [
  "isolated_dwelling",
  "farm",
  "hamlet",
  "village",
];

/** Cell-local origin used when anchoring hazards (map centre of the cell). */
const CELL_CENTER: CellPoint = { x: 50, y: 50 };

export type DangerKind = "habitation" | "terrain";

/**
 * Fixed far hazard. `halfAngleDeg` is constant for the whole encounter;
 * only the bearing from the current apex → target is recomputed.
 */
export type DangerHazard = {
  target: CellPoint;
  halfAngleDeg: number;
  kind: DangerKind;
  label: string;
  category?: HabitationCategory;
  fill: string;
};

/** Hazard projected from a stand / plan apex (draw + fire permission). */
export type DangerWedge = DangerHazard & {
  bearingDeg: number;
};

export const TERRAIN_BACKSTOP_FILL = "rgba(90, 70, 160, 0.5)";

/** Place a point `distanceM` along compass bearing from `origin` (cell %). */
export function cellPointFromBearingDistance(
  origin: CellPoint,
  bearingDeg: number,
  distanceM: number,
): CellPoint {
  const rad = ((bearingDeg - 90) * Math.PI) / 180;
  const pct = distanceM / AWARE_METERS_PER_PCT;
  return {
    x: origin.x + pct * Math.cos(rad),
    y: origin.y + pct * Math.sin(rad),
  };
}

/** Smallest absolute angle difference (degrees). */
export function angleDeltaDeg(a: number, b: number): number {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return d;
}

/** True if `bearingDeg` lies inside the wedge (inclusive edges). */
export function bearingHitsWedge(
  bearingDeg: number,
  wedge: Pick<DangerWedge, "bearingDeg" | "halfAngleDeg">,
): boolean {
  return angleDeltaDeg(bearingDeg, wedge.bearingDeg) <= wedge.halfAngleDeg;
}

/**
 * Habitation catalog for this cell (seeded).
 * `bearingDeg` / `distanceM` are from cell centre — the fixed hazard seat.
 */
export function habitationSlicesForCell(
  mapId: HuntMapId,
  cell: HuntGridCell,
): HabitationSlice[] {
  const seed = hashStr(`${mapId}:${cellLabel(cell)}:hab`);
  const rnd = mulberry32(seed);
  const count = 1 + Math.floor(rnd() * 4); // 1–4
  const slices: HabitationSlice[] = [];
  for (let i = 0; i < count; i++) {
    const cat = CATEGORIES[Math.floor(rnd() * CATEGORIES.length)]!;
    const bearingDeg = rnd() * 360;
    const half =
      cat === "village" ? 12 : cat === "hamlet" ? 9 : cat === "farm" ? 7 : 5;
    slices.push({
      bearingDeg,
      halfAngleDeg: half + rnd() * 3,
      category: cat,
      label: HABITATION_LABELS[cat],
      // Far enough that lateral moves barely change bearing (width stays fixed).
      distanceM: 900 + Math.floor(rnd() * 2000),
    });
  }
  return slices;
}

function terrainHazardsForCell(
  mapId: HuntMapId,
  cell: HuntGridCell,
): DangerHazard[] {
  const seed = hashStr(`${mapId}:${cellLabel(cell)}:back`);
  const rnd = mulberry32(seed);
  const badCount = 1 + Math.floor(rnd() * 2);
  const hazards: DangerHazard[] = [];
  for (let i = 0; i < badCount; i++) {
    const bearingDeg = rnd() * 360;
    const distanceM = 1000 + Math.floor(rnd() * 1800);
    const halfAngleDeg = 15 + rnd() * 20;
    hazards.push({
      target: cellPointFromBearingDistance(CELL_CENTER, bearingDeg, distanceM),
      halfAngleDeg,
      kind: "terrain",
      label: "Utrygg terrengbakgrunn",
      fill: TERRAIN_BACKSTOP_FILL,
    });
  }
  return hazards;
}

/** Fixed hazards for this cell (stable for the hunt encounter). */
export function dangerHazardsForCell(
  mapId: HuntMapId,
  cell: HuntGridCell,
): DangerHazard[] {
  const hab = habitationSlicesForCell(mapId, cell).map(
    (s): DangerHazard => ({
      target: cellPointFromBearingDistance(
        CELL_CENTER,
        s.bearingDeg,
        s.distanceM,
      ),
      halfAngleDeg: s.halfAngleDeg,
      kind: "habitation",
      label: s.label,
      category: s.category,
      fill: HABITATION_COLORS[s.category],
    }),
  );
  return [...hab, ...terrainHazardsForCell(mapId, cell)];
}

/**
 * Project hazards from `origin` (hunter or clicked plan point).
 * Bearing updates with apex; {@link DangerHazard.halfAngleDeg} does not.
 */
export function dangerWedgesFromOrigin(
  hazards: readonly DangerHazard[],
  origin: CellPoint,
): DangerWedge[] {
  return hazards.map((h) => ({
    ...h,
    bearingDeg: bearingDegFromTo(origin, h.target),
  }));
}

/**
 * Wedges from cell centre (legacy). Prefer
 * {@link dangerHazardsForCell} + {@link dangerWedgesFromOrigin}.
 */
export function dangerWedgesForCell(
  mapId: HuntMapId,
  cell: HuntGridCell,
): DangerWedge[] {
  return dangerWedgesFromOrigin(dangerHazardsForCell(mapId, cell), CELL_CENTER);
}

/** @deprecated Prefer dangerHazardsForCell + dangerWedgesFromOrigin. */
export function terrainBackstopWedgesForCell(
  mapId: HuntMapId,
  cell: HuntGridCell,
): DangerWedge[] {
  return dangerWedgesFromOrigin(terrainHazardsForCell(mapId, cell), CELL_CENTER);
}

/** True if firing bearing clears every danger wedge (exact match to drawn pie). */
export function bearingIsSafe(
  bearingDeg: number,
  wedges: Array<Pick<DangerWedge, "bearingDeg" | "halfAngleDeg">>,
): boolean {
  return wedges.every((w) => !bearingHitsWedge(bearingDeg, w));
}

/** @deprecated Prefer dangerWedgesFromOrigin + bearingIsSafe. */
export function terrainBackstopOk(
  mapId: HuntMapId,
  cell: HuntGridCell,
  bearingDeg: number,
): boolean {
  return bearingIsSafe(bearingDeg, terrainBackstopWedgesForCell(mapId, cell));
}

export function coverFactorForCell(
  mapId: HuntMapId,
  cell: HuntGridCell,
): number {
  const seed = hashStr(`${mapId}:${cellLabel(cell)}:cover`);
  const rnd = mulberry32(seed);
  return 0.15 + rnd() * 0.7;
}
