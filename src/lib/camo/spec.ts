/**
 * Camouflage & apparel vs bird vision + movement.
 *
 * Full suits and small pieces (buff, beanie, gloves, boots) live in the
 * same shop category. Kit exclusivity is per *slot* (one buff, one boots…).
 *
 * Birds (orrfugl/tiur) have excellent vision. Camo does not make you invisible —
 * it reduces how easily a bird spots the human outline / contrast.
 *
 * birdSpotSnow / birdSpotNoSnow: LOW = good for hunter.
 * terrainSpeed / stamina: Score10, HIGH = better (expensive ≈ better).
 *
 * Ski boots (slot ski_boots) are required when skis are in the kit.
 */

import type { Score10 } from "@/lib/shop/score";
import { clampScore10 } from "@/lib/shop/score";

export type CamoTerrain =
  | "snow"
  | "snow_broken"
  | "autumn_forest"
  | "pine_forest"
  | "open_mountain"
  | "bog_heath"
  | "general";

export type CamoSlot =
  | "suit"
  | "buff"
  | "beanie"
  | "gloves"
  | "boots"
  | "ski_boots";

export type CamoSpec = {
  /** Bird spot ease in snow. Lower = better concealment. */
  birdSpotSnow: number;
  /** Bird spot ease without snow. Lower = better concealment. */
  birdSpotNoSnow: number;
  /** Terrains where this pattern is intended to shine. */
  bestTerrains: CamoTerrain[];
  /**
   * If false, item exists in game data but cannot be bought in XXL.
   * @default true
   */
  availableInShop?: boolean;
  /** Kit slot — one item per slot. Default suit for full camo. */
  slot: CamoSlot;
  /** 1–10. Higher = better movement speed in terrain. */
  terrainSpeed: Score10;
  /** 1–10. Higher = better stamina retention while hunting. */
  stamina: Score10;
};

export function camoSlot(camo: CamoSpec): CamoSlot {
  return camo.slot ?? "suit";
}

/** Active bird-spot factor for current conditions. */
export function birdSpotForConditions(
  camo: CamoSpec,
  snowOnGround: boolean,
): number {
  return snowOnGround ? camo.birdSpotSnow : camo.birdSpotNoSnow;
}

/**
 * Blend kit camo pieces into one bird-spot factor for nervousness.
 * Suit dominates; apparel pieces nudge the average. Lower = better.
 * No camo in kit → poor default (highly visible).
 */
export function kitBirdSpotFactor(
  pieces: CamoSpec[],
  snowOnGround: boolean,
): number {
  if (pieces.length === 0) return 0.85;
  const suit = pieces.find((p) => (p.slot ?? "suit") === "suit");
  const others = pieces.filter((p) => (p.slot ?? "suit") !== "suit");
  const suitSpot = suit
    ? birdSpotForConditions(suit, snowOnGround)
    : 0.75;
  if (others.length === 0) return suitSpot;
  const otherAvg =
    others.reduce((s, p) => s + birdSpotForConditions(p, snowOnGround), 0) /
    others.length;
  return suitSpot * 0.7 + otherAvg * 0.3;
}

/**
 * Simple “dyrere = bedre” mapping for apparel.
 * Returns Score10 terrain/stamina and a bird-spot floor hint.
 */
export function apparelQualityFromPrice(priceNok: number): {
  terrainSpeed: Score10;
  stamina: Score10;
} {
  if (priceNok >= 5000) return { terrainSpeed: 10, stamina: 10 };
  if (priceNok >= 3500) return { terrainSpeed: 8, stamina: 8 };
  if (priceNok >= 2500) return { terrainSpeed: 7, stamina: 7 };
  if (priceNok >= 1000) return { terrainSpeed: 6, stamina: 6 };
  if (priceNok >= 400) return { terrainSpeed: 5, stamina: 5 };
  if (priceNok >= 150) return { terrainSpeed: 4, stamina: 4 };
  if (priceNok >= 80) return { terrainSpeed: 3, stamina: 3 };
  return { terrainSpeed: clampScore10(2), stamina: clampScore10(2) };
}

/** Rough reference scale (placeholders — tune with playtests). */
export const BIRD_SPOT_REFERENCE = {
  eliteSnow: 0.08,
  excellentSnow: 0.1,
  goodSnowVintage: 0.18,
  premiumNoSnow: 0.22,
  solidNoSnow: 0.28,
  budgetNoSnow: 0.42,
  snowCamoOffSeason: 0.82,
  forestCamoOnSnow: 0.75,
  noCamo: 0.85,
} as const;
