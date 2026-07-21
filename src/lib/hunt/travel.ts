import type { HuntGridCell, HuntMapAsset, HuntMapId } from "@/lib/hunt/maps";
import { cellLabel } from "@/lib/hunt/maps";
import type { HuntPace } from "@/lib/hunt/pace";

/** Physical effort on a cell: 1 (lett) … 5 (tungt). */
export type EffortScore = 1 | 2 | 3 | 4 | 5;

/** One grid cell = 500 m. Effort 1 → 10 min, effort 5 → 30 min at speed 1. */
export const CELL_WIDTH_M = 500;
export const EFFORT_MIN_MINUTES = 10;
export const EFFORT_MAX_MINUTES = 30;

export const HUNT_DAY_START_MINUTES = 8 * 60; // 08:00
export const HUNT_DARK_MINUTES = 17 * 60; // 17:00 — skuddlys over
export const SPOT_ACTION_MINUTES = 5;
export const EAT_ACTION_MINUTES = 5;
export const REST_ACTION_MINUTES = 10;
/** One ettersøk search sweep around the shot / land area. */
export const ETTERSOK_SEARCH_MINUTES = 30;

/**
 * Trøndelag (midtnorge1): rows A–F (bottom→top), cols 1–7 (left→right).
 * A7 = parking / road = lett.
 */
const MIDTNORGE1_EFFORT: EffortScore[][] = [
  // A
  [4, 4, 3, 3, 2, 2, 1],
  // B
  [4, 5, 4, 3, 3, 2, 2],
  // C
  [3, 4, 5, 4, 3, 3, 2],
  // D
  [3, 3, 4, 4, 3, 3, 3],
  // E
  [4, 3, 3, 4, 4, 3, 3],
  // F
  [4, 4, 3, 3, 4, 4, 3],
];

const EFFORT_BY_MAP: Partial<Record<HuntMapId, EffortScore[][]>> = {
  midtnorge1: MIDTNORGE1_EFFORT,
};

export function getCellEffort(
  mapId: HuntMapId,
  cell: HuntGridCell,
): EffortScore {
  const grid = EFFORT_BY_MAP[mapId];
  if (!grid) return 3;
  const row = grid[cell.row];
  if (!row) return 3;
  return row[cell.col] ?? 3;
}

/**
 * Map-study estimate of bird likelihood for a cell (not the true spawn).
 * Combines terrain rating, effort band, and a stable cell hash.
 */
export function estimatedBirdChancePct(
  mapId: HuntMapId,
  cell: HuntGridCell,
  terrainBirdRating: number,
  isParking: boolean,
): number {
  if (isParking) return Math.max(2, Math.round(terrainBirdRating * 2));
  const effort = getCellEffort(mapId, cell);
  const base = terrainBirdRating * 9; // 9–45 for rating 1–5
  // Mid-high effort often = denser habitat on these maps.
  const effortBoost =
    effort === 1 ? -6 : effort === 2 ? 0 : effort === 3 ? 8 : effort === 4 ? 12 : 6;
  const hash = ((cell.row * 17 + cell.col * 31) % 13) - 6;
  return Math.max(4, Math.min(78, Math.round(base + effortBoost + hash)));
}

export function describeBirdChance(pctChance: number): string {
  if (pctChance < 15) return "Lav";
  if (pctChance < 35) return "Moderat";
  if (pctChance < 55) return "God";
  return "Høy";
}

/** Base minutes to cross one cell at speed factor 1. */
export function baseMinutesForEffort(effort: EffortScore): number {
  return (
    EFFORT_MIN_MINUTES +
    ((effort - 1) / 4) * (EFFORT_MAX_MINUTES - EFFORT_MIN_MINUTES)
  );
}

/** Travel time for one cell at given pace. */
export function travelMinutesForCell(
  effort: EffortScore,
  pace: HuntPace,
): number {
  return Math.round(baseMinutesForEffort(effort) / pace.speed);
}

/** Manhattan path of cells entered (excludes start, includes target). */
export function manhattanPath(
  from: HuntGridCell,
  to: HuntGridCell,
): HuntGridCell[] {
  const path: HuntGridCell[] = [];
  let r = from.row;
  let c = from.col;
  while (r !== to.row) {
    r += to.row > r ? 1 : -1;
    path.push({ row: r, col: c });
  }
  while (c !== to.col) {
    c += to.col > c ? 1 : -1;
    path.push({ row: r, col: c });
  }
  return path;
}

export function pathTravelMinutes(
  mapId: HuntMapId,
  from: HuntGridCell,
  to: HuntGridCell,
  pace: HuntPace,
): { minutes: number; path: HuntGridCell[]; steps: number } {
  const path = manhattanPath(from, to);
  let minutes = 0;
  for (const cell of path) {
    minutes += travelMinutesForCell(getCellEffort(mapId, cell), pace);
  }
  return { minutes, path, steps: path.length };
}

export function formatHuntClock(absoluteMinutes: number): string {
  const mins = huntTimeOfDayMinutes(absoluteMinutes);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Minutes since local 00:00 (0…1439), wrapping multi-day absolute clocks. */
export function huntTimeOfDayMinutes(absoluteMinutes: number): number {
  const day = 24 * 60;
  return ((Math.floor(absoluteMinutes) % day) + day) % day;
}

/**
 * Night for hunting: from 17:00 until 08:00 next morning.
 * Uses time-of-day so overnight camping (absolute clock past 24h) still works.
 */
export function isHuntDark(absoluteMinutes: number): boolean {
  const tod = huntTimeOfDayMinutes(absoluteMinutes);
  return tod >= HUNT_DARK_MINUTES || tod < HUNT_DAY_START_MINUTES;
}

/** Spotting / shooting only during skuddlys (08:00–17:00). */
export function canHuntAtTime(absoluteMinutes: number): boolean {
  const tod = huntTimeOfDayMinutes(absoluteMinutes);
  return tod >= HUNT_DAY_START_MINUTES && tod < HUNT_DARK_MINUTES;
}

/** Walking after 17:00 requires a headlamp in kit. */
export function canWalkAtNight(
  hasHeadlamp: boolean,
  absoluteMinutes: number,
): boolean {
  if (!isHuntDark(absoluteMinutes)) return true;
  return hasHeadlamp;
}

export function isAtParking(
  cell: HuntGridCell,
  map: Pick<HuntMapAsset, "start">,
): boolean {
  return cell.row === map.start.row && cell.col === map.start.col;
}

/** Game minutes from current time until next 08:00. */
export function minutesUntilDawn(absoluteMinutes: number): number {
  const day = 24 * 60;
  const tod = huntTimeOfDayMinutes(absoluteMinutes);
  // Already in skuddlys window.
  if (tod >= HUNT_DAY_START_MINUTES && tod < HUNT_DARK_MINUTES) return 0;
  // Evening / night after 17:00 → remainder of day + morning to 08:00.
  if (tod >= HUNT_DARK_MINUTES) {
    return day - tod + HUNT_DAY_START_MINUTES;
  }
  // After midnight, before 08:00.
  return HUNT_DAY_START_MINUTES - tod;
}

/** Stranded in the field after dark without a headlamp. */
export function isStrandedAtNight(
  absoluteMinutes: number,
  hasHeadlamp: boolean,
  atParking: boolean,
): boolean {
  return isHuntDark(absoluteMinutes) && !hasHeadlamp && !atParking;
}

export function clampFatigue(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Effective spotting after fatigue and daylight.
 * Mental fatigue hits spotting hard; physical a bit.
 */
export function effectiveSpottingProbability(
  baseSpotting: number,
  mentalFatigue: number,
  physicalFatigue: number,
  absoluteMinutes: number,
): number {
  const mentalFactor = 1 - clampFatigue(mentalFatigue) * 0.7;
  const physicalFactor = 1 - clampFatigue(physicalFatigue) * 0.25;
  let p = baseSpotting * mentalFactor * physicalFactor;
  if (isHuntDark(absoluteMinutes)) p *= 0.05;
  return Math.max(0, Math.min(1, p));
}

/** Fatigue gained when crossing one cell. */
export function fatigueFromStep(
  effort: EffortScore,
  pace: HuntPace,
): { mental: number; physical: number } {
  return {
    mental: pace.mentalStrain * 0.035 * effort,
    physical: pace.physicalStrain * 0.045 * effort,
  };
}

export function describeEffort(effort: EffortScore): string {
  switch (effort) {
    case 1:
      return "Lett (vei/parkering)";
    case 2:
      return "Ganske lett";
    case 3:
      return "Middels";
    case 4:
      return "Tungt";
    case 5:
      return "Svært tungt";
  }
}

export function cellStatsLine(
  map: HuntMapAsset,
  cell: HuntGridCell,
): string {
  const effort = getCellEffort(map.id, cell);
  const base = baseMinutesForEffort(effort);
  return `${cellLabel(cell)} · Effort ${effort}/5 · ${describeEffort(effort)} · ${base.toFixed(0)} min @ speed 1 · ${CELL_WIDTH_M} m`;
}
