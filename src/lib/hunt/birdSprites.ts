/**
 * Observation topp sprites ↔ shoot/AAR target guides.
 *
 * Spotting uses `toppSrc` (clean). Shoot and AAR use the same topp sprite.
 * Target PNGs in `*_target/` are analysis-only: green/red rings define vital
 * centres, which we map into topp pixel space. Never shown in-game.
 *
 * Batch A: tiurtoppN ↔ tiurtargetN, orretoppN ↔ orretargetN.
 * Batch B (`*b.png`): no painted target guides yet — vitals measured on the
 * topp itself (chest / heart-lung landmark). Same physical zone Ø as A
 * ({@link TIUR_INSTANT_KILL_DIAMETER_MM} / {@link TIUR_VITAL_DIAMETER_MM}).
 */

import type { BirdSpecies } from "@/lib/hunt/birds";
import { isBirdSpriteAllowedInScene } from "@/lib/hunt/birdSpriteSceneAllow";

export type BirdSpriteId =
  | "tiur-1"
  | "tiur-2"
  | "tiur-1b"
  | "tiur-2b"
  | "tiur-3b"
  | "tiur-4b"
  | "orre-1"
  | "orre-2"
  | "orre-1b"
  | "orre-2b"
  | "orre-3b"
  | "orre-4b"
  | "orre-5b"
  | "ugle-1";

export type BirdSpriteDef = {
  id: BirdSpriteId;
  species: BirdSpecies;
  /** Clean treetop sprite — spotting + scope. */
  toppSrc: string;
  /** Guide with green (instant) / red (vital) rings — or topp when batch B. */
  targetSrc: string;
  toppW: number;
  toppH: number;
  targetW: number;
  targetH: number;
  /**
   * Vital centre on the TOPP sprite (px, top-left origin).
   * Mapped from the matching target guide rings (A) or set on topp (B).
   */
  vitalCxPx: number;
  vitalCyPx: number;
  /** Same point on the target guide (for AAR overlays). */
  targetVitalCxPx: number;
  targetVitalCyPx: number;
};

function mapToTopp(
  targetCx: number,
  targetCy: number,
  targetW: number,
  targetH: number,
  toppW: number,
  toppH: number,
): { x: number; y: number } {
  return {
    x: targetCx * (toppW / targetW),
    y: targetCy * (toppH / targetH),
  };
}

function def(
  partial: Omit<BirdSpriteDef, "vitalCxPx" | "vitalCyPx"> & {
    targetVitalCxPx: number;
    targetVitalCyPx: number;
  },
): BirdSpriteDef {
  const v = mapToTopp(
    partial.targetVitalCxPx,
    partial.targetVitalCyPx,
    partial.targetW,
    partial.targetH,
    partial.toppW,
    partial.toppH,
  );
  return {
    ...partial,
    vitalCxPx: v.x,
    vitalCyPx: v.y,
  };
}

/**
 * Batch B: vitals defined directly on the topp (no separate target guide).
 * Instant/vital ring diameters still come from shoot.ts (physical mm).
 */
function defTopp(partial: {
  id: BirdSpriteId;
  species: BirdSpecies;
  toppSrc: string;
  toppW: number;
  toppH: number;
  vitalCxPx: number;
  vitalCyPx: number;
}): BirdSpriteDef {
  return {
    id: partial.id,
    species: partial.species,
    toppSrc: partial.toppSrc,
    targetSrc: partial.toppSrc,
    toppW: partial.toppW,
    toppH: partial.toppH,
    targetW: partial.toppW,
    targetH: partial.toppH,
    vitalCxPx: partial.vitalCxPx,
    vitalCyPx: partial.vitalCyPx,
    targetVitalCxPx: partial.vitalCxPx,
    targetVitalCyPx: partial.vitalCyPx,
  };
}

/**
 * Vital centres:
 * - Batch A: green-ring pixel clusters on `*_target/*targetN.png`.
 * - Batch B: chest / heart-lung landmark on the topp silhouette (pose-aware).
 */
export const BIRD_SPRITES: Record<BirdSpriteId, BirdSpriteDef> = {
  "tiur-1": def({
    id: "tiur-1",
    species: "tiur",
    toppSrc: "/images/birds/tiur/tiurtopp1.png",
    targetSrc: "/images/birds/tiur/tiur_target/tiurtarget1.png",
    toppW: 88,
    toppH: 138,
    targetW: 107,
    targetH: 168,
    targetVitalCxPx: 50.0,
    targetVitalCyPx: 85.6,
  }),
  "tiur-2": def({
    id: "tiur-2",
    species: "tiur",
    toppSrc: "/images/birds/tiur/tiurtopp2.png",
    targetSrc: "/images/birds/tiur/tiur_target/tiurtarget2.png",
    toppW: 80,
    toppH: 96,
    targetW: 99,
    targetH: 127,
    targetVitalCxPx: 60.2,
    targetVitalCyPx: 62.1,
  }),
  /** Rear ¾ — vitals through upper back / chest cavity. */
  "tiur-1b": defTopp({
    id: "tiur-1b",
    species: "tiur",
    toppSrc: "/images/birds/tiur/tiur1b.png",
    toppW: 196,
    toppH: 324,
    vitalCxPx: 100,
    vitalCyPx: 165,
  }),
  /** Side profile facing right — behind white shoulder / green breast. */
  "tiur-2b": defTopp({
    id: "tiur-2b",
    species: "tiur",
    toppSrc: "/images/birds/tiur/tiur2b.png",
    toppW: 274,
    toppH: 352,
    vitalCxPx: 175,
    vitalCyPx: 165,
  }),
  /** Dark silhouette facing right — upper torso below neck. */
  "tiur-3b": defTopp({
    id: "tiur-3b",
    species: "tiur",
    toppSrc: "/images/birds/tiur/tiur3b.png",
    toppW: 124,
    toppH: 188,
    vitalCxPx: 65,
    vitalCyPx: 95,
  }),
  /** ¾ view — behind white wing-bend spot. */
  "tiur-4b": defTopp({
    id: "tiur-4b",
    species: "tiur",
    toppSrc: "/images/birds/tiur/tiur4b.png",
    toppW: 188,
    toppH: 190,
    vitalCxPx: 100,
    vitalCyPx: 95,
  }),
  "orre-1": def({
    id: "orre-1",
    species: "orrhane",
    toppSrc: "/images/birds/orre/orretopp1.png",
    targetSrc: "/images/birds/orre/orre_target/orretarget1.png",
    toppW: 88,
    toppH: 94,
    targetW: 107,
    targetH: 120,
    targetVitalCxPx: 34.9,
    targetVitalCyPx: 45.1,
  }),
  "orre-2": def({
    id: "orre-2",
    species: "orrhane",
    toppSrc: "/images/birds/orre/orretopp2.png",
    targetSrc: "/images/birds/orre/orre_target/orretarget2.png",
    toppW: 108,
    toppH: 146,
    targetW: 153,
    targetH: 179,
    targetVitalCxPx: 103.8,
    targetVitalCyPx: 77.5,
  }),
  /** Profile facing left — upper chest behind neck base. */
  "orre-1b": defTopp({
    id: "orre-1b",
    species: "orrhane",
    toppSrc: "/images/birds/orre/orre1b.png",
    toppW: 160,
    toppH: 230,
    vitalCxPx: 72,
    vitalCyPx: 105,
  }),
  /** Diagonal, head top-right — vitals center-right of torso. */
  "orre-2b": defTopp({
    id: "orre-2b",
    species: "orrhane",
    toppSrc: "/images/birds/orre/orre2b.png",
    toppW: 166,
    toppH: 188,
    vitalCxPx: 116,
    vitalCyPx: 94,
  }),
  /** Profile facing right — upper chest / white wing patch landmark. */
  "orre-3b": defTopp({
    id: "orre-3b",
    species: "orrhane",
    toppSrc: "/images/birds/orre/orre3b.png",
    toppW: 176,
    toppH: 216,
    vitalCxPx: 120,
    vitalCyPx: 125,
  }),
  /** Landscape diagonal — vitals just behind neck/shoulder join. */
  "orre-4b": defTopp({
    id: "orre-4b",
    species: "orrhane",
    toppSrc: "/images/birds/orre/orre4b.png",
    toppW: 194,
    toppH: 144,
    vitalCxPx: 105,
    vitalCyPx: 68,
  }),
  /** Tall lyre-tail silhouette facing left — upper body mass. */
  "orre-5b": defTopp({
    id: "orre-5b",
    species: "orrhane",
    toppSrc: "/images/birds/orre/orre5b.png",
    toppW: 146,
    toppH: 300,
    vitalCxPx: 72,
    vitalCyPx: 130,
  }),
  "ugle-1": def({
    id: "ugle-1",
    species: "ugle",
    toppSrc: "/images/birds/ugle/ugle.png",
    targetSrc: "/images/birds/ugle/ugle_target/ugle_target.png",
    toppW: 116,
    toppH: 174,
    targetW: 110,
    targetH: 166,
    targetVitalCxPx: 57.1,
    targetVitalCyPx: 78.2,
  }),
};

const TIUR_IDS: BirdSpriteId[] = [
  "tiur-1",
  "tiur-2",
  "tiur-1b",
  "tiur-2b",
  "tiur-3b",
  "tiur-4b",
];
const ORRE_IDS: BirdSpriteId[] = [
  "orre-1",
  "orre-2",
  "orre-1b",
  "orre-2b",
  "orre-3b",
  "orre-4b",
  "orre-5b",
];
const UGLE_IDS: BirdSpriteId[] = ["ugle-1"];

export function spriteIdsForSpecies(species: BirdSpecies): BirdSpriteId[] {
  if (species === "orrhane") return ORRE_IDS;
  if (species === "ugle") return UGLE_IDS;
  return TIUR_IDS;
}

export function getBirdSprite(id: BirdSpriteId): BirdSpriteDef {
  return BIRD_SPRITES[id];
}

export function pickBirdSpriteId(
  species: BirdSpecies,
  random: () => number = Math.random,
  opts?: { spotImageSrc?: string },
): BirdSpriteId {
  const all = spriteIdsForSpecies(species);
  const spot = opts?.spotImageSrc;
  const allowed = spot
    ? all.filter((id) => isBirdSpriteAllowedInScene(spot, id))
    : all;
  const ids = allowed.length > 0 ? allowed : all;
  return ids[Math.floor(random() * ids.length)] ?? ids[0]!;
}

/** Resolve sprite id from a topp path (legacy placements). */
export function spriteIdFromToppSrc(src: string): BirdSpriteId | null {
  for (const s of Object.values(BIRD_SPRITES)) {
    if (s.toppSrc === src) return s.id;
  }
  return null;
}
