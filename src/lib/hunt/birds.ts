/**
 * Birds on the hunt grid (tiur first).
 * Visual-in-trees spotting comes later — this is map placement + flush on approach.
 */

import {
  getBirdSprite,
  pickBirdSpriteId,
  type BirdSpriteId,
} from "@/lib/hunt/birdSprites";
import { getBirdSpriteScaleFactor } from "@/lib/hunt/birdSpriteScale";
import {
  cellLabel,
  clampCell,
  type HuntGridCell,
  type HuntMapAsset,
} from "@/lib/hunt/maps";
import type { HuntPaceId } from "@/lib/hunt/pace";
import {
  perchesForSpotImage,
  rollPerchDistanceM,
  type SpotPerch,
} from "@/lib/hunt/spotPerches";
import { weightedSpawnCells } from "@/lib/hunt/mapPlacements";
import { suppressorShotStayChance } from "@/lib/suppressor/spec";
import {
  HABROK_GREEN_MIN_ZOOM,
  HABROK_YELLOW_MIN_ZOOM,
} from "@/lib/optics/spec";

export type BirdSpecies = "tiur" | "orrhane" | "ugle";

export type HuntBird = {
  id: string;
  species: BirdSpecies;
  cell: HuntGridCell;
  /** Viewing distance in meters (150–450). */
  distanceM: number;
  /**
   * Times this bird has flushed/spooked this hunt.
   * At {@link MAX_SPOOKS_BEFORE_GONE} the bird leaves the map for good.
   */
  spookCount: number;
};

/** After this many spooks, the bird is gone from the hunt. */
export const MAX_SPOOKS_BEFORE_GONE = 2;

/** Mental fatigue gain when a bird is spooked away for good (0–1 scale). */
export const GONE_BIRD_MENTAL_HIT = 0.15;

/**
 * Mind hit when the bird flushes in Hunt shoot (after «Klar til skudd»),
 * right before the trigger — bitter near-miss.
 */
export const SHOOT_FLUSH_MIND_HIT = 0.3;

/** Mind hit on a clean miss (frustration). */
export const MISS_MIND_HIT = 0.1;

/** Eyes resolve rød + lilla bands (placement ≤230 m); grønn/gul needs binos/thermal. */
export const EYES_MAX_DISTANCE_M = 230;

/** Grønn distance band (requires optic; Habrok needs zoom > 10×). */
export const GREEN_BAND_MAX_M = 300;

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

/**
 * After a shot: chance each bird in the cell stays perched.
 * Without suppressor most fly (95%); with suppressor more stay (85% fly).
 * Subsonic + suppressor: silent — birds do not flush (stay = 100%).
 */
export const POST_SHOT_FLUSH_CHANCE_OPEN = 0.95;
export const POST_SHOT_FLUSH_CHANCE_SUPPRESSED = 0.85;

/** @deprecated Use postShotStayChance(hasSuppressor). */
export const POST_SHOT_STAY_CHANCE = 1 - POST_SHOT_FLUSH_CHANCE_SUPPRESSED;

/** Chance a second bird of the same species shares the cell on spawn. */
export const TIUR_COMPANION_CHANCE = 0.2;
/** Orrhane pairs are common — double the old 40 % baseline. */
export const ORRHANE_COMPANION_CHANCE = 0.8;

/**
 * When binding a bird to a spot perch: prefer far seats (min >230 m)
 * half the time; near seats (can be ≤230 m) get the remainder.
 */
export const SPOT_PERCH_FAR_BAND_CHANCE = 0.5;

/**
 * Without suppressor: 95 % fly.
 * With suppressor (supersonic): flush from dB (0 dB → 100 %, −40 dB → 65 %).
 * Silent (subsonic .22 / .300 BLK + suppressor): no flush.
 */
export function postShotStayChance(
  hasSuppressor: boolean,
  silentShot = false,
  soundReductionDb?: number | null,
): number {
  if (silentShot) return 1;
  if (!hasSuppressor) return 1 - POST_SHOT_FLUSH_CHANCE_OPEN;
  if (soundReductionDb != null && Number.isFinite(soundReductionDb)) {
    return suppressorShotStayChance(soundReductionDb);
  }
  return 1 - POST_SHOT_FLUSH_CHANCE_SUPPRESSED;
}

export function companionChanceForSpecies(species: BirdSpecies): number {
  if (species === "ugle") return 0;
  return species === "orrhane"
    ? ORRHANE_COMPANION_CHANCE
    : TIUR_COMPANION_CHANCE;
}

/** @deprecated Prefer pickBirdSpriteId + getBirdSprite. */
export const TIUR_TOPP_IMAGES = [
  "/images/birds/tiur/tiurtopp1.png",
  "/images/birds/tiur/tiurtopp2.png",
  "/images/birds/tiur/tiur1b.png",
  "/images/birds/tiur/tiur2b.png",
  "/images/birds/tiur/tiur3b.png",
  "/images/birds/tiur/tiur4b.png",
] as const;

/** @deprecated Prefer pickBirdSpriteId + getBirdSprite. */
export const ORRHANE_TOPP_IMAGES = [
  "/images/birds/orre/orretopp1.png",
  "/images/birds/orre/orretopp2.png",
  "/images/birds/orre/orre1b.png",
  "/images/birds/orre/orre2b.png",
  "/images/birds/orre/orre3b.png",
  "/images/birds/orre/orre4b.png",
  "/images/birds/orre/orre5b.png",
] as const;

export function toppImageForSpecies(
  species: BirdSpecies,
  random: () => number = Math.random,
): string {
  return getBirdSprite(pickBirdSpriteId(species, random)).toppSrc;
}

/** Where a bird sits in the spot landscape (percent of frame). */
export type BirdVisualPlacement = {
  birdId: string;
  species: BirdSpecies;
  /** Stable perch id within the spotting image (`p0`, …). */
  perchId?: string;
  /**
   * Synlig med bare øyne — catalog/admin metadata only.
   * Hunt eyes visibility is distance ≤230 m (not this flag).
   */
  eyesVisible?: boolean;
  /** Paired topp/target variant. */
  spriteId: BirdSpriteId;
  /** Topp sprite shown while spotting. */
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
  return distanceM <= EYES_MAX_DISTANCE_M;
}

/**
 * Habrok zoom gate for thermal silhouette / Fusion outline.
 * Rød/lilla (≤230 m) always; grønn (≤300 m) needs >10×; gul needs >15×.
 * Fusion still shows the day-optic bird without this gate — only the outline uses it.
 */
export function visibleWithHabrokZoom(
  distanceM: number,
  opticZoom: number,
): boolean {
  if (distanceM <= EYES_MAX_DISTANCE_M) return true;
  if (distanceM <= GREEN_BAND_MAX_M) return opticZoom > HABROK_GREEN_MIN_ZOOM;
  return opticZoom > HABROK_YELLOW_MIN_ZOOM;
}

export function visibleInSpotMode(
  distanceM: number,
  mode: "eyes" | "binos" | "thermal",
  opts?: {
    habrokZoom?: number | null;
    eyesVisible?: boolean;
    /**
     * Admin calibration: eyes mode follows the eyesVisible flag only
     * (ignore meter gate so you can verify the checkbox on far perches).
     */
    adminEyesFlagPreview?: boolean;
  },
): boolean {
  if (mode === "eyes") {
    if (opts?.adminEyesFlagPreview) {
      return opts.eyesVisible === true;
    }
    // Hunt: eyes visibility is distance-only (≤ {@link EYES_MAX_DISTANCE_M}).
    return visibleWithEyes(distanceM);
  }
  if (opts?.habrokZoom != null && Number.isFinite(opts.habrokZoom)) {
    return visibleWithHabrokZoom(distanceM, opts.habrokZoom);
  }
  return true;
}

/**
 * Apparent size scales with 1/range.
 * Sized so rød/lilla birds (≤230 m) are findable with naked eye.
 * Optional `spriteId` applies per-image scale (admin-calibrated, 1–200 %).
 */
export const TIUR_TOPP_WIDTH_PCT_AT_100M = 2.25;
export const SPRITE_SIZE_REF_DISTANCE_M = 100;

export function spriteWidthPctForDistance(
  distanceM: number,
  spriteId?: BirdSpriteId,
  perchScalePercent: number = 100,
): number {
  const d = Math.max(1, distanceM);
  const base = TIUR_TOPP_WIDTH_PCT_AT_100M * (SPRITE_SIZE_REF_DISTANCE_M / d);
  const spriteFactor = spriteId ? getBirdSpriteScaleFactor(spriteId) : 1;
  const perchFactor = Number.isFinite(perchScalePercent)
    ? Math.max(0.01, Math.min(2, perchScalePercent / 100))
    : 1;
  return base * spriteFactor * perchFactor;
}

/**
 * Keep perch/sprite scale factors when the hunter moves to a new stand range.
 * widthPct ∝ 1/distance, so multiply by fromDist/toDist.
 */
export function rescaleSpriteWidthPct(
  widthPct: number,
  fromDistanceM: number,
  toDistanceM: number,
): number {
  const from = Math.max(1, fromDistanceM);
  const to = Math.max(1, toDistanceM);
  const next = widthPct * (from / to);
  return Number.isFinite(next) && next > 0 ? next : widthPct;
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

/** Minimum hit radius as % of landscape (matches SpotView click / LRF floor). */
const LANDSCAPE_BIRD_HIT_MIN_PCT = 4.5;

/**
 * Nearest bird under a landscape point (%, same frame as SpotView placements).
 * Used by eyes click and gun-scope mark-before-engage.
 */
export function findBirdNearLandscapePoint(
  placements: BirdVisualPlacement[],
  xPct: number,
  yPct: number,
): BirdVisualPlacement | null {
  let best: BirdVisualPlacement | null = null;
  let bestD2 = Infinity;
  for (const p of placements) {
    const radius =
      Math.max(p.widthPct / 2, LANDSCAPE_BIRD_HIT_MIN_PCT / 2) * 1.15;
    const dx = p.x - xPct;
    const dy = p.y - yPct;
    const d2 = dx * dx + dy * dy;
    if (d2 <= radius * radius && d2 < bestD2) {
      best = p;
      bestD2 = d2;
    }
  }
  return best;
}

/** Median placement widthPct — sizes the gun-prep scope scene so overlays match Spot. */
export function medianPlacementWidthPct(
  placements: Pick<BirdVisualPlacement, "widthPct">[],
  fallback = 2,
): number {
  const widths = placements
    .map((p) => p.widthPct)
    .filter((w) => Number.isFinite(w) && w > 0)
    .sort((a, b) => a - b);
  if (widths.length === 0) return fallback;
  return widths[Math.floor(widths.length / 2)] ?? fallback;
}

/**
 * Pan so the bird sits under the LRF reticle (lens centre at 50 %, 50 %).
 * Same transform as {@link isBirdUnderLrfReticle}.
 */
export function panToCenterOnBird(
  placement: Pick<BirdVisualPlacement, "x" | "y">,
  zoom: number,
): { x: number; y: number } {
  const z = Math.max(1, zoom);
  if (z <= 1.001) {
    return { x: placement.x, y: placement.y };
  }
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  return {
    x: clamp((50 - placement.x * z) / (1 - z)),
    y: clamp((50 - placement.y * z) / (1 - z)),
  };
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
  /** Where it relocated — same as `from` if gone for good. */
  to: HuntGridCell;
  imageSrc: string;
  /** spookCount after this flush (1 or 2). */
  spookCount: number;
  /** True if this was the 2nd spook — bird leaves the hunt. */
  gone: boolean;
  /**
   * walk/nerve: stalk flush (spook++). shot: sound flush after a round
   * (no spook increment — companions / miss fly-out).
   */
  cause?: "walk" | "nerve" | "shot";
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
 * Spawn birds across the map (tiur / orrhane mix from terrain ratings).
 * Cells are weighted by hand-marked seats (green = tiur, red = orrhane).
 * Same-species companions: tiur +20 %, orrhane +80 %.
 */
export function spawnTiurOnMap(
  map: HuntMapAsset,
  count: number = TIUR_SPAWN_COUNT,
  random: () => number = Math.random,
  opts?: {
    tiurRating?: number;
    orrhaneRating?: number;
  },
): HuntBird[] {
  const birds: HuntBird[] = [];
  const tiurRating = Math.max(0, opts?.tiurRating ?? 3);
  const orrhaneRating = Math.max(0, opts?.orrhaneRating ?? 2);
  const speciesWeight = tiurRating + orrhaneRating;

  const pickSpecies = (): "tiur" | "orrhane" => {
    if (speciesWeight <= 0) return "tiur";
    return random() < orrhaneRating / speciesWeight ? "orrhane" : "tiur";
  };

  const pickWeightedCell = (
    species: "tiur" | "orrhane",
  ): HuntGridCell | null => {
    const weighted = weightedSpawnCells(map.id, species, map.start);
    if (weighted.length === 0) return null;
    let total = 0;
    for (const w of weighted) total += w.weight;
    if (total <= 0) return null;
    let roll = random() * total;
    for (const w of weighted) {
      roll -= w.weight;
      if (roll <= 0) return { ...w.cell };
    }
    return { ...weighted[weighted.length - 1]!.cell };
  };

  /** Fallback: any non-parking cell (maps without placement data). */
  const fallbackCells: HuntGridCell[] = [];
  const startKey = `${map.start.row},${map.start.col}`;
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (`${r},${c}` === startKey) continue;
      fallbackCells.push({ row: r, col: c });
    }
  }

  let nextId = 1;
  const pushBird = (species: BirdSpecies, cell: HuntGridCell) => {
    birds.push({
      id: `${species}-${nextId++}`,
      species,
      cell: { ...cell },
      distanceM: rollBirdDistance(random),
      spookCount: 0,
    });
  };

  const spawnOne = () => {
    const species = pickSpecies();
    let cell = pickWeightedCell(species);
    if (!cell && species === "tiur") cell = pickWeightedCell("orrhane");
    if (!cell && species === "orrhane") cell = pickWeightedCell("tiur");
    if (!cell && fallbackCells.length > 0) {
      cell = fallbackCells[Math.floor(random() * fallbackCells.length)]!;
    }
    if (!cell) return;
    pushBird(species, cell);
    if (random() < companionChanceForSpecies(species)) {
      pushBird(species, cell);
    }
  };

  for (let i = 0; i < Math.max(0, count); i++) {
    spawnOne();
  }
  return birds;
}

function placementFromPerch(
  bird: HuntBird,
  perch: SpotPerch,
  distanceM: number,
  flip: boolean,
  random: () => number,
  spotImageSrc: string,
): BirdVisualPlacement {
  const spriteId = pickBirdSpriteId(perch.species, random, {
    spotImageSrc,
  });
  const sprite = getBirdSprite(spriteId);
  return {
    birdId: bird.id,
    species: perch.species,
    perchId: perch.id,
    eyesVisible: perch.eyesVisible === true,
    spriteId,
    imageSrc: sprite.toppSrc,
    distanceM,
    x: perch.x,
    y: perch.y,
    widthPct: spriteWidthPctForDistance(
      distanceM,
      spriteId,
      perch.scalePercent ?? 100,
    ),
    flip,
  };
}

/** Near seats (can roll ≤230 m) vs far (always beyond eyes range). */
function isEyesBandPerch(
  perch: Pick<SpotPerch, "distanceMinM" | "distanceMaxM">,
): boolean {
  return Math.min(perch.distanceMinM, perch.distanceMaxM) <= EYES_MAX_DISTANCE_M;
}

function isFarBandPerch(
  perch: Pick<SpotPerch, "distanceMinM" | "distanceMaxM">,
): boolean {
  return Math.min(perch.distanceMinM, perch.distanceMaxM) > EYES_MAX_DISTANCE_M;
}

function pickOneFromPool(
  pool: SpotPerch[],
  random: () => number,
): SpotPerch | null {
  if (pool.length === 0) return null;
  const i = Math.floor(random() * pool.length);
  return pool.splice(i, 1)[0] ?? null;
}

/**
 * Pick `count` perches with band bias: 50 % far (>230 m min), 50 % near
 * (can be ≤230 m). Within a band, seats are uniform. Falls back to the other
 * band if one is empty.
 */
function selectPerchesWeighted(
  perches: SpotPerch[],
  count: number,
  random: () => number,
): SpotPerch[] {
  if (count <= 0) return [];
  if (count >= perches.length) return [...perches];

  const eyesPool = perches.filter(isEyesBandPerch);
  const farPool = perches.filter(isFarBandPerch);
  const picked: SpotPerch[] = [];

  while (picked.length < count) {
    const preferFar = random() < SPOT_PERCH_FAR_BAND_CHANCE;
    let pick: SpotPerch | null = null;
    if (preferFar) {
      pick =
        pickOneFromPool(farPool, random) ?? pickOneFromPool(eyesPool, random);
    } else {
      pick =
        pickOneFromPool(eyesPool, random) ?? pickOneFromPool(farPool, random);
    }
    if (!pick) break;
    picked.push(pick);
  }

  return picked;
}

function randomCrownPlacement(
  bird: HuntBird,
  index: number,
  total: number,
  random: () => number,
  spotImageSrc?: string,
): BirdVisualPlacement {
  const spriteId = pickBirdSpriteId(bird.species, random, {
    spotImageSrc,
  });
  const sprite = getBirdSprite(spriteId);
  const widthPct = spriteWidthPctForDistance(bird.distanceM, spriteId);
  if (bird.id === "tiur-1") {
    return {
      birdId: bird.id,
      species: bird.species,
      spriteId,
      imageSrc: sprite.toppSrc,
      distanceM: bird.distanceM,
      x: 58,
      y: 40,
      widthPct,
      flip: random() < 0.5,
    };
  }
  const spread = total > 1 ? (index - (total - 1) / 2) * 10 : 0;
  return {
    birdId: bird.id,
    species: bird.species,
    spriteId,
    imageSrc: sprite.toppSrc,
    distanceM: bird.distanceM,
    x: Math.max(8, Math.min(88, 52 + spread + (random() - 0.5) * 18)),
    y: Math.max(32, Math.min(50, 40 + (random() - 0.5) * 12)),
    widthPct,
    flip: random() < 0.5,
  };
}

/**
 * Bind birds in `cell` to hand-authored perches on `imageSrc` when available.
 * Updates species + distance on assigned birds so LRF / shoot match the visual.
 * Extra perches (e.g. spot9 test on start) spawn transient birds in that cell.
 */
export function bindBirdsToSpotImage(
  birds: HuntBird[],
  cell: HuntGridCell,
  imageSrc: string,
  opts: {
    /** Place a bird on every perch (start-cell placement test). */
    fillAllPerches?: boolean;
    random?: () => number;
  } = {},
): { birds: HuntBird[]; placements: BirdVisualPlacement[] } {
  const random = opts.random ?? Math.random;
  const perches = perchesForSpotImage(imageSrc);
  if (perches.length === 0) {
    // No placement guide for this landscape → never invent random crowns.
    return { birds, placements: [] };
  }

  const here = birdsInCell(birds, cell);
  const unused = [...here];
  const assignedIds = new Set<string>();
  const placements: BirdVisualPlacement[] = [];
  let next = birds.map((b) => ({ ...b, cell: { ...b.cell } }));
  let transient = 0;

  const takeBird = (species: BirdSpecies): HuntBird | null => {
    const idx = unused.findIndex((b) => b.species === species);
    const pick =
      idx >= 0
        ? unused.splice(idx, 1)[0]!
        : unused.length > 0
          ? unused.shift()!
          : null;
    return pick;
  };

  const perchCount = opts.fillAllPerches
    ? perches.length
    : Math.min(perches.length, Math.max(here.length, 0));

  // 50 % far (>230 m), 50 % near (can be eyes-range). Visibility is distance-only.
  const ordered = opts.fillAllPerches
    ? [...perches]
    : selectPerchesWeighted(perches, perchCount, random);

  for (const perch of ordered) {
    let bird = takeBird(perch.species);
    const distanceM = rollPerchDistanceM(perch, random);
    if (!bird) {
      if (!opts.fillAllPerches) break;
      transient += 1;
      bird = {
        id: `perch-${imageSrc}-${transient}`,
        species: perch.species,
        cell: { ...cell },
        distanceM,
        spookCount: 0,
      };
      next = [...next, bird];
    } else {
      next = next.map((b) =>
        b.id === bird!.id
          ? {
              ...b,
              species: perch.species,
              distanceM,
              cell: { ...cell },
            }
          : b,
      );
      bird = {
        ...bird,
        species: perch.species,
        distanceM,
        cell: { ...cell },
      };
    }
    assignedIds.add(bird.id);
    placements.push(
      placementFromPerch(
        bird,
        perch,
        distanceM,
        random() < 0.5,
        random,
        imageSrc,
      ),
    );
  }

  // Leftover birds in cell (more birds than perches): random crown fallback.
  const leftovers = unused.filter((b) => !assignedIds.has(b.id));
  leftovers.forEach((bird, i) => {
    placements.push(
      randomCrownPlacement(bird, i, leftovers.length, random, imageSrc),
    );
  });

  return { birds: next, placements };
}

export type AdminSpotSpeciesMode = "tiur" | "orrhane" | "both";

function stableFlipFromId(id: string): boolean {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h & 1) === 0;
}

/**
 * Admin: fill given perches with fixed tiur/orre sprites (ignores hunt birds).
 * `stableDistance` uses mid of min/max + id-based flip (scene editor).
 */
export function adminPlacementsFromPerches(
  perches: readonly SpotPerch[],
  opts: {
    tiurSpriteId: BirdSpriteId;
    orreSpriteId: BirdSpriteId;
    stableDistance?: boolean;
    random?: () => number;
  },
): BirdVisualPlacement[] {
  const random = opts.random ?? Math.random;
  const seats = perches.filter(
    (p) => p.species === "tiur" || p.species === "orrhane",
  );

  return seats.map((perch, i) => {
    const spriteId =
      perch.species === "orrhane" ? opts.orreSpriteId : opts.tiurSpriteId;
    const sprite = getBirdSprite(spriteId);
    const perchId = perch.id ?? `p${i}`;
    let distanceM = opts.stableDistance
      ? Math.round((perch.distanceMinM + perch.distanceMaxM) / 2)
      : rollPerchDistanceM(perch, random);
    return {
      birdId: `admin-${perchId}`,
      perchId,
      eyesVisible: perch.eyesVisible === true,
      species: perch.species,
      spriteId,
      imageSrc: sprite.toppSrc,
      distanceM,
      x: perch.x,
      y: perch.y,
      widthPct: spriteWidthPctForDistance(
        distanceM,
        spriteId,
        perch.scalePercent ?? 100,
      ),
      flip: opts.stableDistance
        ? stableFlipFromId(perchId)
        : random() < 0.5,
    };
  });
}

/**
 * Admin calibration: fill every perch on `imageSrc` (optionally filtered by
 * species) with fixed tiur/orre sprites — ignores kit and hunt bird state.
 */
export function adminPlacementsForSpotImage(
  imageSrc: string,
  opts: {
    speciesMode: AdminSpotSpeciesMode;
    tiurSpriteId: BirdSpriteId;
    orreSpriteId: BirdSpriteId;
    random?: () => number;
  },
): BirdVisualPlacement[] {
  let perches = perchesForSpotImage(imageSrc);
  if (opts.speciesMode === "tiur") {
    perches = perches.filter((p) => p.species === "tiur");
  } else if (opts.speciesMode === "orrhane") {
    perches = perches.filter((p) => p.species === "orrhane");
  } else {
    perches = perches.filter(
      (p) => p.species === "tiur" || p.species === "orrhane",
    );
  }

  return adminPlacementsFromPerches(perches, {
    tiurSpriteId: opts.tiurSpriteId,
    orreSpriteId: opts.orreSpriteId,
    random: opts.random,
  });
}

/**
 * Place birds that are in `cell` into the spot landscape.
 * When `imageSrc` has a placement guide, uses those perches (x/y/species/range).
 * Otherwise: default crown band; start-cell `tiur-1` stays on a fixed tune spot.
 */
export function placementsForBirdsInCell(
  birds: HuntBird[],
  cell: HuntGridCell,
  imageSrc?: string,
  random: () => number = Math.random,
): BirdVisualPlacement[] {
  if (imageSrc && perchesForSpotImage(imageSrc).length > 0) {
    return bindBirdsToSpotImage(birds, cell, imageSrc, { random }).placements;
  }
  const here = birdsInCell(birds, cell);
  return here.map((bird, i) =>
    randomCrownPlacement(bird, i, here.length, random, imageSrc),
  );
}

export type FlushResolveResult = {
  birds: HuntBird[];
  events: FlushEvent[];
};

/**
 * Apply one spook to a bird: increment counter, relocate or remove.
 * Returns updated bird list and a flush event (always).
 */
export function spookBird(
  birds: HuntBird[],
  birdId: string,
  map: HuntMapAsset,
  random: () => number = Math.random,
): { birds: HuntBird[]; event: FlushEvent | null } {
  const idx = birds.findIndex((b) => b.id === birdId);
  if (idx < 0) return { birds, event: null };
  const bird = birds[idx]!;
  const direction = pickFlushDirection(random);
  const from = { ...bird.cell };
  const nextCount = bird.spookCount + 1;
  const gone = nextCount >= MAX_SPOOKS_BEFORE_GONE;
  const to = gone
    ? from
    : relocateBirdCell(bird.cell, direction, map, random);

  const event: FlushEvent = {
    birdId: bird.id,
    species: bird.species,
    direction,
    from,
    to,
    imageSrc: pickFluktImage(random),
    spookCount: nextCount,
    gone,
  };

  if (gone) {
    return {
      birds: birds.filter((b) => b.id !== birdId),
      event,
    };
  }

  const next = birds.map((b, i) =>
    i === idx
      ? {
          ...b,
          spookCount: nextCount,
          cell: to,
          distanceM: rollBirdDistance(random),
        }
      : b,
  );
  return { birds: next, event };
}

/**
 * For each cell entered (path), birds there may flush based on pace.
 * Direction + relocate are from that cell (intermediate or destination).
 * 1st spook: relocate 1–2 cells. 2nd spook: gone for good.
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

  let next = birds.map((b) => ({
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
      flushedIds.add(bird.id);
      const result = spookBird(next, bird.id, map, random);
      next = result.birds;
      if (result.event) events.push(result.event);
    }
  }

  return { birds: next, events };
}

/**
 * Move a bird to another cell without spook-count (post-shot / fire flush).
 * Returns the flush event so UI can show flight direction.
 */
export function relocateBirdQuietly(
  birds: HuntBird[],
  birdId: string,
  map: HuntMapAsset,
  random: () => number = Math.random,
): { birds: HuntBird[]; event: FlushEvent | null } {
  const idx = birds.findIndex((b) => b.id === birdId);
  if (idx < 0) return { birds, event: null };
  const bird = birds[idx]!;
  const from = { ...bird.cell };
  const direction = pickFlushDirection(random);
  let to = relocateBirdCell(from, direction, map, random);
  // Prefer a different cell when possible.
  if (cellKey(to) === cellKey(from)) {
    to = relocateBirdCell(from, pickFlushDirection(random), map, random);
  }
  const event: FlushEvent = {
    birdId: bird.id,
    species: bird.species,
    direction,
    from,
    to,
    imageSrc: pickFluktImage(random),
    spookCount: bird.spookCount,
    gone: false,
    cause: "shot",
  };
  const next = birds.map((b, i) =>
    i === idx
      ? {
          ...b,
          cell: to,
          distanceM: rollBirdDistance(random),
        }
      : b,
  );
  return { birds: next, event };
}

export type PostShotFlushResult = {
  birds: HuntBird[];
  /** Birds that remained in the shot cell. */
  stayedIds: string[];
  /** Birds that left for other cells. */
  flushedIds: string[];
  /** One splash per flushed bird (direction to go after). */
  events: FlushEvent[];
};

/**
 * After a shot: every bird still in `cell` rolls stay vs flush.
 * Without suppressor: 95 % fly.
 * With suppressor: flush chance from soundReductionDb (0 dB → 100 %, −40 → 65 %).
 * Silent (subsonic + suppressor): no flush.
 * Applies to the shot-at bird (on miss) and any companions in the cell.
 */
export function applyPostShotBirdFlush(input: {
  birds: HuntBird[];
  cell: HuntGridCell;
  map: HuntMapAsset;
  /** Already-removed kill / ettersøk bird — skip if still present. */
  excludeBirdId?: string;
  /** Kit has a suppressor on the rifle. */
  hasSuppressor?: boolean;
  /** Subsonic ammo + suppressor — birds do not flush. */
  silentShot?: boolean;
  /** Suppressor peak dB cut (negative). Used when not silent. */
  soundReductionDb?: number | null;
  stayChance?: number;
  random?: () => number;
}): PostShotFlushResult {
  const random = input.random ?? Math.random;
  const stayChance =
    input.stayChance ??
    postShotStayChance(
      !!input.hasSuppressor,
      !!input.silentShot,
      input.soundReductionDb,
    );
  let next = input.birds.map((b) => ({ ...b, cell: { ...b.cell } }));
  const stayedIds: string[] = [];
  const flushedIds: string[] = [];
  const events: FlushEvent[] = [];

  const here = next.filter(
    (b) =>
      cellKey(b.cell) === cellKey(input.cell) &&
      b.id !== input.excludeBirdId,
  );

  for (const bird of here) {
    const stay = random() < stayChance;
    if (stay) {
      stayedIds.push(bird.id);
      continue;
    }
    const moved = relocateBirdQuietly(next, bird.id, input.map, random);
    next = moved.birds;
    if (moved.event) events.push(moved.event);
    flushedIds.push(bird.id);
  }

  return { birds: next, stayedIds, flushedIds, events };
}

/**
 * Tyribål / fire: every bird in the hunter's cell leaves for another cell.
 * Does not increment spook count (rest mechanic, not a stalk flush).
 */
export function flushAllBirdsFromCell(
  birds: HuntBird[],
  cell: HuntGridCell,
  map: HuntMapAsset,
  random: () => number = Math.random,
): { birds: HuntBird[]; flushedCount: number } {
  let next = birds.map((b) => ({ ...b, cell: { ...b.cell } }));
  const here = birdsInCell(next, cell);
  for (const bird of here) {
    next = relocateBirdQuietly(next, bird.id, map, random).birds;
  }
  return { birds: next, flushedCount: here.length };
}

/** Norwegian compass name for flush direction (N → nord, SW → sørvest, …). */
export function flushDirectionNb(direction: FlushDirection): string {
  const labels: Record<FlushDirection, string> = {
    N: "nord",
    NE: "nordøst",
    E: "øst",
    SE: "sørøst",
    S: "sør",
    SW: "sørvest",
    W: "vest",
    NW: "nordvest",
  };
  return labels[direction];
}

/** Short splash headline: "Fra C6 · i retning S — sør". */
export function flushDirectionHeadline(event: FlushEvent): string {
  const from = cellLabel(event.from);
  return `Fra ${from} · i retning ${event.direction} — ${flushDirectionNb(event.direction)}`;
}

export function flushMessage(event: FlushEvent): string {
  const species =
    event.species === "tiur"
      ? "Tiuren"
      : event.species === "ugle"
        ? "Uglen"
        : "Orrhanen";
  const from = cellLabel(event.from);
  const dir = `${flushDirectionNb(event.direction)} (fra ${from})`;
  if (event.cause === "shot") {
    const to = cellLabel(event.to);
    return (
      `Du hører vingeslag og ser opp. ${species} letter mot ${dir} ` +
      `av skuddlyden — mot ${to}.`
    );
  }
  if (event.gone) {
    return (
      `${species} letter mot ${dir} — og er borte for godt. ` +
      "Du innser at du er en dårlig jeger og burde håndtert situasjonen bedre."
    );
  }
  return (
    `Du hører vingeslag og ser opp. ${species} letter mot ${dir} ` +
    `(spook ${event.spookCount}/${MAX_SPOOKS_BEFORE_GONE}). ` +
    `Én spook til og den er borte.`
  );
}

/**
 * Turn one placement (and matching HuntBird) into the easter-egg owl.
 * Prefers a visible perch; no-op if already an ugle or empty.
 */
export function morphSpotBirdToOwl(
  birds: HuntBird[],
  placements: BirdVisualPlacement[],
): { birds: HuntBird[]; placements: BirdVisualPlacement[] } {
  if (placements.some((p) => p.species === "ugle")) {
    return { birds, placements };
  }
  const target =
    placements.find((p) => p.species === "tiur" || p.species === "orrhane") ??
    placements[0];
  if (!target) return { birds, placements };
  const sprite = getBirdSprite("ugle-1");
  const nextPlacements = placements.map((p) =>
    p.birdId === target.birdId
      ? {
          ...p,
          species: "ugle" as const,
          spriteId: "ugle-1" as const,
          imageSrc: sprite.toppSrc,
        }
      : p,
  );
  const nextBirds = birds.map((b) =>
    b.id === target.birdId ? { ...b, species: "ugle" as const } : b,
  );
  return { birds: nextBirds, placements: nextPlacements };
}
