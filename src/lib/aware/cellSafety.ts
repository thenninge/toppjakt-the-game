/**
 * Deterministic bebyggelse + terrengbakgrunn for a hunt grid cell.
 *
 * Kakestykker are generated once per cell (seeded bearings + half-angles).
 * When the hunter / plan apex moves, only the draw origin changes —
 * compass direction and width stay frozen. That opens safe corridors by
 * walking without slices swinging toward nearby hazard points.
 *
 * ONE source of truth: drawn wedges === Klar til skudd.
 */

import {
  AWARE_METERS_PER_PCT,
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

/** Cell-local origin used when anchoring hazard seats (map centre of the cell). */
const CELL_CENTER: CellPoint = { x: 50, y: 50 };

/**
 * Slice half-angles are 25% narrower than the previous generation range
 * (max width × 0.75).
 */
const HALF_ANGLE_SCALE = 0.75;

/** Per kind: chance a cell gets that danger (habitation / terrain). Was 1.0. */
const DANGER_ZONE_CHANCE = 0.5;

export type DangerKind = "habitation" | "terrain";

/**
 * Fixed danger sector for the encounter.
 * `bearingDeg` + `halfAngleDeg` never change after generation.
 */
export type DangerHazard = {
  /** Frozen compass bearing of the slice (degrees). */
  bearingDeg: number;
  halfAngleDeg: number;
  /** Far seat used only for catalog / debug — not for re-aiming the wedge. */
  target: CellPoint;
  kind: DangerKind;
  label: string;
  category?: HabitationCategory;
  fill: string;
};

/** Hazard ready to draw from a stand / plan apex (same angles as generation). */
export type DangerWedge = DangerHazard;

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
 * `bearingDeg` / `distanceM` are frozen from cell centre at generation.
 */
export function habitationSlicesForCell(
  mapId: HuntMapId,
  cell: HuntGridCell,
): HabitationSlice[] {
  const seed = hashStr(`${mapId}:${cellLabel(cell)}:hab`);
  const rnd = mulberry32(seed);
  if (rnd() >= DANGER_ZONE_CHANCE) return [];
  const count = 1 + Math.floor(rnd() * 4); // 1–4 when present
  const slices: HabitationSlice[] = [];
  for (let i = 0; i < count; i++) {
    const cat = CATEGORIES[Math.floor(rnd() * CATEGORIES.length)]!;
    const bearingDeg = rnd() * 360;
    const half =
      cat === "village" ? 12 : cat === "hamlet" ? 9 : cat === "farm" ? 7 : 5;
    slices.push({
      bearingDeg,
      halfAngleDeg: (half + rnd() * 3) * HALF_ANGLE_SCALE,
      category: cat,
      label: HABITATION_LABELS[cat],
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
  if (rnd() >= DANGER_ZONE_CHANCE) return [];
  const badCount = 1 + Math.floor(rnd() * 2); // 1–2 when present
  const hazards: DangerHazard[] = [];
  for (let i = 0; i < badCount; i++) {
    const bearingDeg = rnd() * 360;
    const distanceM = 1000 + Math.floor(rnd() * 1800);
    const halfAngleDeg = (15 + rnd() * 20) * HALF_ANGLE_SCALE;
    hazards.push({
      bearingDeg,
      halfAngleDeg,
      target: cellPointFromBearingDistance(CELL_CENTER, bearingDeg, distanceM),
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
      bearingDeg: s.bearingDeg,
      halfAngleDeg: s.halfAngleDeg,
      target: cellPointFromBearingDistance(
        CELL_CENTER,
        s.bearingDeg,
        s.distanceM,
      ),
      kind: "habitation",
      label: s.label,
      category: s.category,
      fill: HABITATION_COLORS[s.category],
    }),
  );
  return [...hab, ...terrainHazardsForCell(mapId, cell)];
}

/**
 * Wedges for drawing / Klar til skudd from `origin`.
 * Apex follows the stand; bearing and half-angle stay frozen from generation.
 */
export function dangerWedgesFromOrigin(
  hazards: readonly DangerHazard[],
  _origin: CellPoint,
): DangerWedge[] {
  return hazards.map((h) => ({ ...h }));
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
