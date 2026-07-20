/**
 * Deterministic bebyggelse + terrengbakgrunn for a hunt grid cell.
 *
 * ONE source of truth: danger wedges drawn on the Aware pie are the SAME
 * wedges used to allow/deny «Klar til skudd». No hidden margins.
 */

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

export type DangerKind = "habitation" | "terrain";

/** Absolute compass wedge — identical for draw + fire permission. */
export type DangerWedge = {
  bearingDeg: number;
  halfAngleDeg: number;
  kind: DangerKind;
  label: string;
  /** Habitation only — for colour. */
  category?: HabitationCategory;
  fill: string;
};

export const TERRAIN_BACKSTOP_FILL = "rgba(90, 70, 160, 0.5)";

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
 * Habitation pie slices around the hunter for this cell.
 * Bearings are compass degrees (0 = north / up on the cell map).
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
      distanceM: 400 + Math.floor(rnd() * 2200),
    });
  }
  return slices;
}

/** Terrain backstop danger wedges (road / cliff / open valley). */
export function terrainBackstopWedgesForCell(
  mapId: HuntMapId,
  cell: HuntGridCell,
): DangerWedge[] {
  const seed = hashStr(`${mapId}:${cellLabel(cell)}:back`);
  const rnd = mulberry32(seed);
  const badCount = 1 + Math.floor(rnd() * 2);
  const wedges: DangerWedge[] = [];
  for (let i = 0; i < badCount; i++) {
    wedges.push({
      bearingDeg: rnd() * 360,
      halfAngleDeg: 15 + rnd() * 20,
      kind: "terrain",
      label: "Utrygg terrengbakgrunn",
      fill: TERRAIN_BACKSTOP_FILL,
    });
  }
  return wedges;
}

/**
 * All fire-blocking wedges for this cell — draw these, and only these,
 * when deciding Klar til skudd.
 */
export function dangerWedgesForCell(
  mapId: HuntMapId,
  cell: HuntGridCell,
): DangerWedge[] {
  const hab = habitationSlicesForCell(mapId, cell).map(
    (s): DangerWedge => ({
      bearingDeg: s.bearingDeg,
      halfAngleDeg: s.halfAngleDeg,
      kind: "habitation",
      label: s.label,
      category: s.category,
      fill: HABITATION_COLORS[s.category],
    }),
  );
  return [...hab, ...terrainBackstopWedgesForCell(mapId, cell)];
}

/** True if firing bearing clears every danger wedge (exact match to drawn pie). */
export function bearingIsSafe(
  bearingDeg: number,
  wedges: Array<Pick<DangerWedge, "bearingDeg" | "halfAngleDeg">>,
): boolean {
  return wedges.every((w) => !bearingHitsWedge(bearingDeg, w));
}

/** @deprecated Prefer dangerWedgesForCell + bearingIsSafe. */
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
