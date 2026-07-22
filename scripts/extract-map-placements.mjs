/**
 * Extract green (tiur) / red (orrhane) markers from maps_placement overlays
 * into src/lib/hunt/mapPlacements.ts
 *
 *   node scripts/extract-map-placements.mjs
 */
import sharp from "sharp";
import fs from "fs";

const COLS = 7;
const ROWS = 6;

const FILES = {
  ostlandet1: "public/maps/maps_placement/ostland1_placement.png",
  ostlandet2: "public/maps/maps_placement/ostland2_placement.png",
  midtnorge1: "public/maps/maps_placement/myrkanter_placement.png",
  inatur1: "public/maps/maps_placement/inatur1_placement.png",
  inatur2: "public/maps/maps_placement/inatur2_placement.png",
  svenskegrensa: "public/maps/maps_placement/svenskegrensa_placement.png",
};

function isGreen(r, g, b) {
  return g >= 200 && g > r + 80 && g > b + 80 && r < 120 && b < 120;
}
function isRed(r, g, b) {
  return r >= 200 && r > g + 80 && r > b + 80 && g < 120 && b < 120;
}

async function detect(file) {
  const { data, info } = await sharp(file)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a < 180) continue;
      if (isGreen(r, g, b)) mask[y * w + x] = 1;
      else if (isRed(r, g, b)) mask[y * w + x] = 2;
    }
  }
  const visited = new Uint8Array(w * h);
  const seats = [];
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (!mask[idx] || visited[idx]) continue;
      const kind = mask[idx];
      const q = [[x, y]];
      visited[idx] = 1;
      let sx = 0;
      let sy = 0;
      let n = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;
      while (q.length) {
        const [cx, cy] = q.pop();
        sx += cx;
        sy += cy;
        n++;
        if (cx < minX) minX = cx;
        if (cx > maxX) maxX = cx;
        if (cy < minY) minY = cy;
        if (cy > maxY) maxY = cy;
        for (const [dx, dy] of dirs) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (visited[ni] || mask[ni] !== kind) continue;
          visited[ni] = 1;
          q.push([nx, ny]);
        }
      }
      if (n < 40) continue;
      const bw = maxX - minX + 1;
      const bh = maxY - minY + 1;
      if (bw < 4 || bh < 4 || bw > 80 || bh > 80) continue;
      const cx = sx / n;
      const cy = sy / n;
      const xPct = +(100 * (cx / w)).toFixed(2);
      const yPct = +(100 * (cy / h)).toFixed(2);
      const col = Math.min(COLS - 1, Math.max(0, Math.floor((xPct / 100) * COLS)));
      const rowFromTop = Math.min(
        ROWS - 1,
        Math.max(0, Math.floor((yPct / 100) * ROWS)),
      );
      const row = ROWS - 1 - rowFromTop;
      seats.push({
        species: kind === 1 ? "tiur" : "orrhane",
        xPct,
        yPct,
        row,
        col,
      });
    }
  }
  seats.sort((a, b) => a.row - b.row || a.col - b.col || a.xPct - b.xPct);
  return seats;
}

const maps = {};
for (const [id, file] of Object.entries(FILES)) {
  maps[id] = await detect(file);
  console.log(id, maps[id].length);
}

let ts = `/**
 * Hand-marked bird seats from /public/maps/maps_placement/*_placement.png
 * Detected automatically: green squares = tiur, red circles = orrhane.
 * Coordinates are % of the placement image; cells use the 7×6 hunt grid
 * (row 0 = A at bottom, col 0 = 1 at left).
 *
 * Regenerate: node scripts/extract-map-placements.mjs
 */

import type { HuntGridCell, HuntMapId } from "@/lib/hunt/maps";

type BirdSpecies = "tiur" | "orrhane";

export type MapBirdSeat = {
  species: BirdSpecies;
  /** 0–100 left → right on map image */
  xPct: number;
  /** 0–100 top → bottom on map image */
  yPct: number;
  row: number;
  col: number;
};

export type CellSeatCounts = {
  tiur: number;
  orrhane: number;
  total: number;
};

export const MAP_BIRD_SEATS: Partial<Record<HuntMapId, readonly MapBirdSeat[]>> = {
`;

for (const [id, seats] of Object.entries(maps)) {
  ts += `  ${id}: [\n`;
  for (const s of seats) {
    ts += `    { species: "${s.species}", xPct: ${s.xPct}, yPct: ${s.yPct}, row: ${s.row}, col: ${s.col} },\n`;
  }
  ts += `  ],\n`;
}
ts += `};

function cellKey(row: number, col: number): string {
  return \`\${row},\${col}\`;
}

const CELL_COUNTS: Partial<Record<HuntMapId, Record<string, CellSeatCounts>>> = (() => {
  const out: Partial<Record<HuntMapId, Record<string, CellSeatCounts>>> = {};
  for (const [mapId, seats] of Object.entries(MAP_BIRD_SEATS) as [
    HuntMapId,
    readonly MapBirdSeat[],
  ][]) {
    const counts: Record<string, CellSeatCounts> = {};
    for (const s of seats) {
      const k = cellKey(s.row, s.col);
      const cur = counts[k] ?? { tiur: 0, orrhane: 0, total: 0 };
      if (s.species === "tiur") cur.tiur += 1;
      else cur.orrhane += 1;
      cur.total += 1;
      counts[k] = cur;
    }
    out[mapId] = counts;
  }
  return out;
})();

const MAX_TOTAL_BY_MAP: Partial<Record<HuntMapId, number>> = (() => {
  const out: Partial<Record<HuntMapId, number>> = {};
  for (const [mapId, counts] of Object.entries(CELL_COUNTS) as [
    HuntMapId,
    Record<string, CellSeatCounts>,
  ][]) {
    let max = 1;
    for (const c of Object.values(counts)) max = Math.max(max, c.total);
    out[mapId] = max;
  }
  return out;
})();

export function getMapBirdSeats(mapId: HuntMapId): readonly MapBirdSeat[] {
  return MAP_BIRD_SEATS[mapId] ?? [];
}

export function getCellSeatCounts(
  mapId: HuntMapId,
  cell: HuntGridCell,
): CellSeatCounts {
  return (
    CELL_COUNTS[mapId]?.[cellKey(cell.row, cell.col)] ?? {
      tiur: 0,
      orrhane: 0,
      total: 0,
    }
  );
}

export function seatsInCell(
  mapId: HuntMapId,
  cell: HuntGridCell,
  species?: BirdSpecies,
): MapBirdSeat[] {
  return getMapBirdSeats(mapId).filter(
    (s) =>
      s.row === cell.row &&
      s.col === cell.col &&
      (species == null || s.species === species),
  );
}

/** Weighted cells that have at least one seat for the species (parking excluded). */
export function weightedSpawnCells(
  mapId: HuntMapId,
  species: BirdSpecies,
  parking: HuntGridCell,
): { cell: HuntGridCell; weight: number }[] {
  const counts = CELL_COUNTS[mapId];
  if (!counts) return [];
  const out: { cell: HuntGridCell; weight: number }[] = [];
  for (const [key, c] of Object.entries(counts)) {
    const weight = species === "tiur" ? c.tiur : c.orrhane;
    if (weight <= 0) continue;
    const [rs, cs] = key.split(",");
    const row = Number(rs);
    const col = Number(cs);
    if (row === parking.row && col === parking.col) continue;
    out.push({ cell: { row, col }, weight });
  }
  return out;
}

/**
 * Study-map bird likelihood from seat density (0–100).
 * More marked seats in a cell → higher score.
 */
export function placementBirdChancePct(
  mapId: HuntMapId,
  cell: HuntGridCell,
  terrainBirdRating: number,
  isParking: boolean,
): number | null {
  const seats = getMapBirdSeats(mapId);
  if (seats.length === 0) return null;
  if (isParking) return Math.max(2, Math.round(terrainBirdRating * 2));
  const counts = getCellSeatCounts(mapId, cell);
  const maxTotal = MAX_TOTAL_BY_MAP[mapId] ?? 1;
  const density = counts.total / maxTotal; // 0–1
  const base = terrainBirdRating * 8; // 8–40
  const densityBoost = Math.round(density * 42); // 0–42
  const emptyPenalty = counts.total === 0 ? -10 : 0;
  return Math.max(3, Math.min(82, Math.round(base + densityBoost + emptyPenalty)));
}
`;

fs.writeFileSync("src/lib/hunt/mapPlacements.ts", ts);
console.log("wrote src/lib/hunt/mapPlacements.ts");
