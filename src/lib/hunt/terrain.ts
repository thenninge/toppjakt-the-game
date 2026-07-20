/** Hunting terrain booked via inatur.no — used later for bird spawn weights. */

import { getHuntMap, type HuntMapId } from "@/lib/hunt/maps";

export type BirdRating = 1 | 2 | 3 | 4 | 5;

export type HuntingTerrainId =
  | "ostlandet-budsjett"
  | "ostlandet-standard"
  | "trondelag";

export type HuntingTerrain = {
  id: HuntingTerrainId;
  name: string;
  region: string;
  blurb: string;
  /** Daily lease in NOK (inatur.no). */
  pricePerDayNok: 500 | 1000 | 2000;
  /** 1–5. Higher = more likely tiur in this terrain. */
  tiurRating: BirdRating;
  /** 1–5. Higher = more likely orrhane in this terrain. */
  orrhaneRating: BirdRating;
  mapId: HuntMapId;
};

/** Exactly three options — one per test map. Expand later when asked. */
export const HUNTING_TERRAINS: HuntingTerrain[] = [
  {
    id: "ostlandet-budsjett",
    name: "Gammel hogst",
    region: "Østlandet",
    blurb: "Billig leie, tynt med fugl — men du kommer deg ut.",
    pricePerDayNok: 500,
    tiurRating: 1,
    orrhaneRating: 2,
    mapId: "ostlandet1",
  },
  {
    id: "ostlandet-standard",
    name: "Bjørkeskog",
    region: "Østlandet",
    blurb: "Middels pris og middels fugl — trygg standard.",
    pricePerDayNok: 1000,
    tiurRating: 3,
    orrhaneRating: 3,
    mapId: "ostlandet2",
  },
  {
    id: "trondelag",
    name: "Myrkanter",
    region: "Trøndelag",
    blurb: "Første spillbare kart. Parker ved veien nede til høyre.",
    pricePerDayNok: 2000,
    tiurRating: 4,
    orrhaneRating: 5,
    mapId: "midtnorge1",
  },
];

export function getHuntingTerrain(
  id: string | null | undefined,
): HuntingTerrain | undefined {
  if (!id) return undefined;
  return HUNTING_TERRAINS.find((t) => t.id === id);
}

export function formatBirdRating(rating: BirdRating): string {
  return `${rating}/5`;
}

/** Public image path for a terrain's hunt map. */
export function terrainMapSrc(terrain: HuntingTerrain): string {
  return getHuntMap(terrain.mapId).src;
}
