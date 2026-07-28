import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  HUNT_MAPS,
  type CoreHuntMapId,
  type HuntGridCell,
} from "@/lib/hunt/maps";
import {
  MAP_BIRD_SEATS,
  type MapBirdSeat,
} from "@/lib/hunt/mapPlacements";

const MAP_IDS = Object.keys(HUNT_MAPS) as CoreHuntMapId[];

type BakeBody = {
  mapId?: string;
  seats?: unknown;
  awareMapMaxM?: number | null;
  start?: HuntGridCell | null;
};

function isMapId(id: string): id is CoreHuntMapId {
  return MAP_IDS.includes(id as CoreHuntMapId);
}

function normalizeSeat(raw: unknown): MapBirdSeat | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (s.species !== "tiur" && s.species !== "orrhane") return null;
  const xPct = Number(s.xPct);
  const yPct = Number(s.yPct);
  const row = Number(s.row);
  const col = Number(s.col);
  if (
    ![xPct, yPct, row, col].every((n) => Number.isFinite(n)) ||
    xPct < 0 ||
    xPct > 100 ||
    yPct < 0 ||
    yPct > 100
  ) {
    return null;
  }
  return {
    species: s.species,
    xPct: Math.round(xPct * 100) / 100,
    yPct: Math.round(yPct * 100) / 100,
    row: Math.max(0, Math.round(row)),
    col: Math.max(0, Math.round(col)),
  };
}

function formatSeat(s: MapBirdSeat): string {
  return `    { species: "${s.species}", xPct: ${s.xPct}, yPct: ${s.yPct}, row: ${s.row}, col: ${s.col} },`;
}

function buildPlacementsFile(
  seatsByMap: Partial<Record<CoreHuntMapId, MapBirdSeat[]>>,
): string {
  const blocks = MAP_IDS.filter((id) => (seatsByMap[id]?.length ?? 0) > 0)
    .map((id) => {
      const seats = seatsByMap[id]!;
      return `  ${id}: [\n${seats.map(formatSeat).join("\n")}\n  ],`;
    })
    .join("\n");

  return `/**
 * Hand-marked bird seats from /public/maps/maps_placement/*_placement.png
 * Detected automatically: green squares = tiur, red circles = orrhane.
 * Coordinates are % of the placement image; cells use the 7×6 hunt grid
 * (row 0 = A at bottom, col 0 = 1 at left).
 *
 * Regenerate: node scripts/extract-map-placements.mjs
 * Or Admin → Jaktfelt → Lagre til repo.
 *
 * Auto-generated ${new Date().toISOString()}
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
${blocks}
};

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
}

function patchMapsTs(
  source: string,
  mapId: CoreHuntMapId,
  opts: { awareMapMaxM?: number | null; start?: HuntGridCell | null },
): string {
  const map = HUNT_MAPS[mapId];
  // Match the map object block: `id: { ... },` — non-greedy until next top-level key or end.
  const re = new RegExp(
    `(  ${mapId}: \\{[\\s\\S]*?)(\\n  \\},)`,
    "m",
  );
  const m = source.match(re);
  if (!m) throw new Error(`Could not find ${mapId} block in maps.ts`);

  let block = m[1]!;

  if (opts.start) {
    const { row, col } = opts.start;
    const startLine = `    start: { row: ${row}, col: ${col} }, // ${String.fromCharCode(65 + row)}${col + 1}`;
    if (/start:\s*\{[^}]+\}/.test(block)) {
      block = block.replace(/start:\s*\{[^}]+\}[^\n]*/, startLine);
    } else {
      block = block.replace(
        /(playable:\s*(?:true|false),?)/,
        `$1\n${startLine}`,
      );
    }
  }

  if (opts.awareMapMaxM === null) {
    block = block.replace(/\n\s*\/\*\*[^*]*awareMapMaxM[^*]*\*\/\s*\n?/gi, "\n");
    block = block.replace(/\n\s*awareMapMaxM:\s*[^,\n]+,?/g, "");
  } else if (typeof opts.awareMapMaxM === "number") {
    const line = `    awareMapMaxM: ${opts.awareMapMaxM},`;
    if (/awareMapMaxM:\s*/.test(block)) {
      block = block.replace(/awareMapMaxM:\s*[^,\n]+,?/, line.trim());
    } else {
      block = `${block}\n${line}`;
    }
  }

  // Ensure default start still present if we didn't touch it
  void map;

  return source.replace(re, `${block}${m[2]}`);
}

/**
 * Dev-only: bake Admin → Jaktfelt seats (+ optional Aware scale / start)
 * into mapPlacements.ts and maps.ts.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Jaktfelt bake is disabled in production." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object body" }, { status: 400 });
  }

  const { mapId, seats: rawSeats, awareMapMaxM, start } = body as BakeBody;
  if (!mapId || !isMapId(mapId)) {
    return NextResponse.json({ error: "Invalid mapId" }, { status: 400 });
  }
  if (!Array.isArray(rawSeats)) {
    return NextResponse.json({ error: "seats array required" }, { status: 400 });
  }

  const seats: MapBirdSeat[] = [];
  for (const raw of rawSeats) {
    const s = normalizeSeat(raw);
    if (!s) {
      return NextResponse.json({ error: "Invalid seat entry" }, { status: 400 });
    }
    const map = HUNT_MAPS[mapId];
    if (s.row >= map.rows || s.col >= map.cols) {
      return NextResponse.json(
        { error: `Seat outside grid: ${s.row},${s.col}` },
        { status: 400 },
      );
    }
    seats.push(s);
  }

  const merged: Partial<Record<CoreHuntMapId, MapBirdSeat[]>> = {};
  for (const id of MAP_IDS) {
    if (id === mapId) merged[id] = seats;
    else merged[id] = [...(MAP_BIRD_SEATS[id] ?? [])];
  }

  const placementsPath = path.join(
    process.cwd(),
    "src/lib/hunt/mapPlacements.ts",
  );
  await fs.writeFile(placementsPath, buildPlacementsFile(merged), "utf8");

  let mapsPatched = false;
  if (awareMapMaxM !== undefined || start != null) {
    const mapsPath = path.join(process.cwd(), "src/lib/hunt/maps.ts");
    const mapsSrc = await fs.readFile(mapsPath, "utf8");
    const next = patchMapsTs(mapsSrc, mapId, {
      awareMapMaxM:
        awareMapMaxM === undefined
          ? undefined
          : awareMapMaxM === null
            ? null
            : Math.max(50, Math.round(Number(awareMapMaxM))),
      start:
        start &&
        typeof start.row === "number" &&
        typeof start.col === "number"
          ? {
              row: Math.max(0, Math.round(start.row)),
              col: Math.max(0, Math.round(start.col)),
            }
          : null,
    });
    await fs.writeFile(mapsPath, next, "utf8");
    mapsPatched = true;
  }

  return NextResponse.json({
    ok: true,
    mapId,
    seats: seats.length,
    paths: [
      "src/lib/hunt/mapPlacements.ts",
      ...(mapsPatched ? ["src/lib/hunt/maps.ts"] : []),
    ],
  });
}
