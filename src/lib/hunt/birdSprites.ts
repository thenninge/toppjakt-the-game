/**
 * Observation topp sprites ↔ shoot/AAR target guides.
 *
 * Spotting uses `toppSrc` (clean). Shoot and AAR use the same topp sprite.
 * Target PNGs in `*_target/` are analysis-only: green/red rings define vital
 * centres, which we map into topp pixel space. Never shown in-game.
 *
 * Index pairing: tiurtopp1 ↔ tiurtarget1, orretopp2 ↔ orretarget2, …
 */

import type { BirdSpecies } from "@/lib/hunt/birds";

export type BirdSpriteId = "tiur-1" | "tiur-2" | "orre-1" | "orre-2" | "ugle-1";

export type BirdSpriteDef = {
  id: BirdSpriteId;
  species: BirdSpecies;
  /** Clean treetop sprite — spotting + scope. */
  toppSrc: string;
  /** Guide with green (instant) / red (vital) rings. */
  targetSrc: string;
  toppW: number;
  toppH: number;
  targetW: number;
  targetH: number;
  /**
   * Vital centre on the TOPP sprite (px, top-left origin).
   * Mapped from the matching target guide rings.
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
 * Vital centres from green-ring pixel clusters on target guides
 * (see `*_target/*targetN.png`).
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

const TIUR_IDS: BirdSpriteId[] = ["tiur-1", "tiur-2"];
const ORRE_IDS: BirdSpriteId[] = ["orre-1", "orre-2"];
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
): BirdSpriteId {
  const ids = spriteIdsForSpecies(species);
  return ids[Math.floor(random() * ids.length)] ?? ids[0]!;
}

/** Resolve sprite id from a topp path (legacy placements). */
export function spriteIdFromToppSrc(src: string): BirdSpriteId | null {
  for (const s of Object.values(BIRD_SPRITES)) {
    if (s.toppSrc === src) return s.id;
  }
  return null;
}
