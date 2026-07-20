/**
 * Birds on the hunt grid (tiur first).
 * Visual-in-trees spotting comes later — this is map placement + flush on approach.
 */

import {
  clampCell,
  type HuntGridCell,
  type HuntMapAsset,
} from "@/lib/hunt/maps";
import type { HuntPaceId } from "@/lib/hunt/pace";

export type BirdSpecies = "tiur" | "orrhane";

export type HuntBird = {
  id: string;
  species: BirdSpecies;
  cell: HuntGridCell;
  /** Viewing distance in meters (150–450). */
  distanceM: number;
};

/** Eyes can resolve birds closer than this; farther needs binos. */
export const EYES_MAX_DISTANCE_M = 250;

export const BIRD_DISTANCE_MIN_M = 150;
export const BIRD_DISTANCE_MAX_M = 450;

/** Compass from hunter's POV on the grid (N = toward higher row letters). */
export type FlushDirection =
  | "N"
  | "NE"
  | "E"
  | "SE"
  | "S"
  | "SW"
  | "W"
  | "NW";

export const FLUSH_DIRECTIONS: FlushDirection[] = [
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW",
];

/** Chance a bird flushes when you enter its cell at this pace. */
export const FLUSH_PROBABILITY: Record<HuntPaceId, number> = {
  "extreme-caution": 0,
  caution: 0.2,
  normal: 0.5,
  speedy: 1,
};

export const TIUR_SPAWN_COUNT = 20;

export const FLUKT_IMAGES = ["/images/birds/flukt/flukt1.png"] as const;

/** Treetop sprites for spotting overlays. */
export const TIUR_TOPP_IMAGES = ["/images/birds/tiur/tiurtopp1.png"] as const;

/** Where a bird sits in the spot landscape (percent of frame). */
export type BirdVisualPlacement = {
  birdId: string;
  species: BirdSpecies;
  imageSrc: string;
  distanceM: number;
  /** Horizontal position 0–100 (% of landscape). */
  x: number;
  /** Vertical position 0–100 (% of landscape). */
  y: number;
  /** Sprite width as % of landscape width. */
  widthPct: number;
  flip?: boolean;
};

export function rollBirdDistance(random: () => number = Math.random): number {
  return (
    BIRD_DISTANCE_MIN_M +
    Math.floor(random() * (BIRD_DISTANCE_MAX_M - BIRD_DISTANCE_MIN_M + 1))
  );
}

/** True if this distance is visible with eyes (and therefore also with binos). */
export function visibleWithEyes(distanceM: number): boolean {
  return distanceM < EYES_MAX_DISTANCE_M;
}

export function visibleInSpotMode(
  distanceM: number,
  mode: "eyes" | "binos",
): boolean {
  if (mode === "binos") return true;
  return visibleWithEyes(distanceM);
}

/**
 * Apparent size scales with 1/range.
 * Baseline: previous ~9% frame width → at 100 m we use 10% of that (0.9%).
 */
export const TIUR_TOPP_WIDTH_PCT_AT_100M = 9 * 0.1;
export const SPRITE_SIZE_REF_DISTANCE_M = 100;

export function spriteWidthPctForDistance(distanceM: number): number {
  const d = Math.max(1, distanceM);
  return TIUR_TOPP_WIDTH_PCT_AT_100M * (SPRITE_SIZE_REF_DISTANCE_M / d);
}

/**
 * Is the LRF reticle (lens center) on this bird?
 * Hit radius grows with apparent size under current zoom.
 */
export function isBirdUnderLrfReticle(
  placement: Pick<BirdVisualPlacement, "x" | "y" | "widthPct">,
  pan: { x: number; y: number },
  zoom: number,
): boolean {
  const lx = (1 - zoom) * pan.x + placement.x * zoom;
  const ly = (1 - zoom) * pan.y + placement.y * zoom;
  const dx = lx - 50;
  const dy = ly - 50;
  const apparentHalf = Math.max(1.2, (placement.widthPct * zoom) / 2);
  return dx * dx + dy * dy <= apparentHalf * apparentHalf;
}

export function findBirdUnderLrfReticle(
  placements: BirdVisualPlacement[],
  pan: { x: number; y: number },
  zoom: number,
): BirdVisualPlacement | null {
  let best: BirdVisualPlacement | null = null;
  let bestDist = Infinity;
  for (const p of placements) {
    if (!isBirdUnderLrfReticle(p, pan, zoom)) continue;
    const lx = (1 - zoom) * pan.x + p.x * zoom;
    const ly = (1 - zoom) * pan.y + p.y * zoom;
    const d = (lx - 50) ** 2 + (ly - 50) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

const DIR_DELTA: Record<FlushDirection, { dRow: number; dCol: number }> = {
  N: { dRow: 1, dCol: 0 },
  NE: { dRow: 1, dCol: 1 },
  E: { dRow: 0, dCol: 1 },
  SE: { dRow: -1, dCol: 1 },
  S: { dRow: -1, dCol: 0 },
  SW: { dRow: -1, dCol: -1 },
  W: { dRow: 0, dCol: -1 },
  NW: { dRow: 1, dCol: -1 },
};

export type FlushEvent = {
  birdId: string;
  species: BirdSpecies;
  direction: FlushDirection;
  from: HuntGridCell;
  to: HuntGridCell;
  imageSrc: string;
};

function cellKey(cell: HuntGridCell): string {
  return `${cell.row},${cell.col}`;
}

export function birdsInCell(
  birds: HuntBird[],
  cell: HuntGridCell,
): HuntBird[] {
  const k = cellKey(cell);
  return birds.filter((b) => cellKey(b.cell) === k);
}

export function pickFlushDirection(
  random: () => number = Math.random,
): FlushDirection {
  const i = Math.floor(random() * FLUSH_DIRECTIONS.length);
  return FLUSH_DIRECTIONS[i] ?? "N";
}

export function pickFluktImage(random: () => number = Math.random): string {
  const i = Math.floor(random() * FLUKT_IMAGES.length);
  return FLUKT_IMAGES[i] ?? FLUKT_IMAGES[0]!;
}

/** Move 1–2 cells in direction, clamped to map. */
export function relocateBirdCell(
  from: HuntGridCell,
  direction: FlushDirection,
  map: HuntMapAsset,
  random: () => number = Math.random,
): HuntGridCell {
  const steps = random() < 0.5 ? 1 : 2;
  const { dRow, dCol } = DIR_DELTA[direction];
  return clampCell(
    {
      row: from.row + dRow * steps,
      col: from.col + dCol * steps,
    },
    map,
  );
}

/**
 * Spawn `count` tiur across the map. Several birds may share a cell.
 * Always places one on the start cell (parking) for visual placement testing.
 */
export function spawnTiurOnMap(
  map: HuntMapAsset,
  count: number = TIUR_SPAWN_COUNT,
  random: () => number = Math.random,
): HuntBird[] {
  const birds: HuntBird[] = [];
  const startKey = cellKey(map.start);
  const cells: HuntGridCell[] = [];
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (`${r},${c}` === startKey) continue;
      cells.push({ row: r, col: c });
    }
  }

  // Guaranteed test bird on start (A7 on Trøndelag map).
  birds.push({
    id: "tiur-1",
    species: "tiur",
    cell: { ...map.start },
    distanceM: rollBirdDistance(random),
  });

  if (cells.length === 0) return birds;

  for (let i = 1; i < count; i++) {
    const pick = cells[Math.floor(random() * cells.length)]!;
    birds.push({
      id: `tiur-${i + 1}`,
      species: "tiur",
      cell: { ...pick },
      distanceM: rollBirdDistance(random),
    });
  }
  return birds;
}

/**
 * Place birds that are in `cell` into the spot landscape.
 * Positions are in the upper tree band so toppjakt sprites sit in crowns.
 * Start-cell test bird (`tiur-1`) uses a fixed spot so placement is easy to tune.
 */
export function placementsForBirdsInCell(
  birds: HuntBird[],
  cell: HuntGridCell,
  random: () => number = Math.random,
): BirdVisualPlacement[] {
  const here = birdsInCell(birds, cell);
  return here.map((bird, i) => {
    const widthPct = spriteWidthPctForDistance(bird.distanceM);
    if (bird.id === "tiur-1") {
      return {
        birdId: bird.id,
        species: bird.species,
        imageSrc: TIUR_TOPP_IMAGES[0]!,
        distanceM: bird.distanceM,
        x: 58,
        y: 24,
        widthPct,
        flip: false,
      };
    }
    const spread = here.length > 1 ? (i - (here.length - 1) / 2) * 10 : 0;
    return {
      birdId: bird.id,
      species: bird.species,
      imageSrc: TIUR_TOPP_IMAGES[0]!,
      distanceM: bird.distanceM,
      x: Math.max(8, Math.min(88, 52 + spread + (random() - 0.5) * 18)),
      y: Math.max(8, Math.min(45, 20 + (random() - 0.5) * 16)),
      widthPct,
      flip: random() < 0.5,
    };
  });
}

export type FlushResolveResult = {
  birds: HuntBird[];
  events: FlushEvent[];
};

/**
 * For each cell entered (path), birds there may flush based on pace.
 * Flushed birds are relocated 1–2 cells in a random direction.
 */
export function resolveFlushesOnPath(
  birds: HuntBird[],
  path: HuntGridCell[],
  paceId: HuntPaceId,
  map: HuntMapAsset,
  random: () => number = Math.random,
): FlushResolveResult {
  const pFlush = FLUSH_PROBABILITY[paceId] ?? 0.5;
  if (pFlush <= 0 || path.length === 0) {
    return { birds, events: [] };
  }

  const next = birds.map((b) => ({
    ...b,
    cell: { ...b.cell },
  }));
  const events: FlushEvent[] = [];
  const flushedIds = new Set<string>();

  for (const cell of path) {
    const here = next.filter(
      (b) => !flushedIds.has(b.id) && cellKey(b.cell) === cellKey(cell),
    );
    for (const bird of here) {
      if (random() >= pFlush) continue;
      const direction = pickFlushDirection(random);
      const to = relocateBirdCell(bird.cell, direction, map, random);
      const from = { ...bird.cell };
      bird.cell = to;
      bird.distanceM = rollBirdDistance(random);
      flushedIds.add(bird.id);
      events.push({
        birdId: bird.id,
        species: bird.species,
        direction,
        from,
        to,
        imageSrc: pickFluktImage(random),
      });
    }
  }

  return { birds: next, events };
}

export function flushMessage(event: FlushEvent): string {
  const species = event.species === "tiur" ? "Tiuren" : "Orrhanen";
  return (
    `Du hører vingeslag og ser opp. Fuglen er allerede fløyet. ` +
    `${species} gikk i retning ${event.direction}. ` +
    `Beveg deg mer forsiktig neste gang.`
  );
}
