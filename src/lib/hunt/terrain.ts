/** Hunting terrain booked via inatur.no — used later for bird spawn weights. */

import { getHuntMap, type HuntMapId } from "@/lib/hunt/maps";

export type BirdRating = 1 | 2 | 3 | 4 | 5;

export type HuntingTerrainId =
  | "ostlandet-budsjett"
  | "ostlandet-standard"
  | "trondelag"
  | "rulles-stubb-teig"
  | "rulles-kristian-li"
  | "rulles-lovenskiold";

export type HuntingTerrain = {
  id: HuntingTerrainId;
  name: string;
  region: string;
  blurb: string;
  /** Daily lease in NOK (inatur.no / handshake). */
  pricePerDayNok: number;
  /** 1–5. Higher = more likely tiur in this terrain. */
  tiurRating: BirdRating;
  /** 1–5. Higher = more likely orrhane in this terrain. */
  orrhaneRating: BirdRating;
  mapId: HuntMapId;
  /**
   * `inatur` = always listed.
   * `rulles` = only after unlocking via Rulles (snøvling + påspandering).
   */
  access: "inatur" | "rulles";
  /** Flavor: who shook your hand. */
  landownerName?: string;
};

/** Base inatur listings + Rulles handshake grounds. */
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
    access: "inatur",
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
    access: "inatur",
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
    access: "inatur",
  },
  {
    id: "rulles-stubb-teig",
    name: "Stubbens teig",
    region: "Østlandet",
    blurb:
      "Kari Stubb sitt lille stykke. «Ikke skyt mot hytta. Den er forsikret, men jeg er ikke.»",
    pricePerDayNok: 700,
    tiurRating: 2,
    orrhaneRating: 3,
    mapId: "ostlandet1",
    access: "rulles",
    landownerName: "Kari Stubb",
  },
  {
    id: "rulles-kristian-li",
    name: "Kristian Olav sin li",
    region: "Østlandet",
    blurb:
      "Kristian Olav sin skråning. Bra med orre, grei tiur — hvis du ikke tråkker i potetene.",
    pricePerDayNok: 1600,
    tiurRating: 3,
    orrhaneRating: 4,
    mapId: "ostlandet2",
    access: "rulles",
    landownerName: "Kristian Olav",
  },
  {
    id: "rulles-lovenskiold",
    name: "Løvenskiolds finmark",
    region: "Østlandet / «privat»",
    blurb:
      "Carl Otto Løvenskiolds fineste. Stappfullt av fugl. Du er gjest — oppfør deg deretter.",
    pricePerDayNok: 12000,
    tiurRating: 5,
    orrhaneRating: 5,
    mapId: "midtnorge1",
    access: "rulles",
    landownerName: "Carl Otto Løvenskiold",
  },
];

export function getHuntingTerrain(
  id: string | null | undefined,
): HuntingTerrain | undefined {
  if (!id) return undefined;
  return HUNTING_TERRAINS.find((t) => t.id === id);
}

/** Terrains visible on inatur for this player. */
export function terrainsAvailableForPlayer(
  unlockedTerrainIds: readonly string[],
): HuntingTerrain[] {
  const unlocked = new Set(unlockedTerrainIds);
  return HUNTING_TERRAINS.filter(
    (t) => t.access === "inatur" || unlocked.has(t.id),
  );
}

export function formatBirdRating(rating: BirdRating): string {
  return `${rating}/5`;
}

/** Public image path for a terrain's hunt map. */
export function terrainMapSrc(terrain: HuntingTerrain): string {
  return getHuntMap(terrain.mapId).src;
}
