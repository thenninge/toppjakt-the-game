/** Hunting terrain booked via inatur.no — used later for bird spawn weights. */

import { getHuntMap, type HuntMapId } from "@/lib/hunt/maps";

export type BirdRating = 1 | 2 | 3 | 4 | 5;

export type HuntingTerrainId =
  | "ostlandet-budsjett"
  | "ostlandet-standard"
  | "trondelag"
  | "inatur-hogstflate"
  | "inatur-granskog"
  | "svenskegrensa"
  | "finnskogen"
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
   * `vip` = VIP-package names + admin PIN session.
   */
  access: "inatur" | "rulles" | "vip";
  /** Flavor: who shook your hand. */
  landownerName?: string;
};

/** Base inatur listings + Rulles handshake grounds. */
export const HUNTING_TERRAINS: HuntingTerrain[] = [
  {
    id: "ostlandet-budsjett",
    name: "Gammel hogst",
    region: "Østlandet",
    blurb:
      "Billig leie, tynt med fugl (10 tiur) — gamle hogstkanter med litt furu og bjørk. Du kommer deg ut.",
    pricePerDayNok: 250,
    tiurRating: 1,
    orrhaneRating: 2,
    mapId: "ostlandet1",
    access: "inatur",
  },
  {
    id: "ostlandet-standard",
    name: "Bjørkeskog",
    region: "Østlandet",
    blurb:
      "Middels pris og middels fugl (15 tiur) — bjørkekanter der orre beiter, fururrygger for tiur.",
    pricePerDayNok: 500,
    tiurRating: 3,
    orrhaneRating: 3,
    mapId: "ostlandet2",
    access: "inatur",
  },
  {
    id: "trondelag",
    name: "Myrkanter",
    region: "Trøndelag",
    blurb:
      "Dyreste inatur-teig — myrkanter og furuhøyder, fullt med fugl (20 tiur). Parker i A7.",
    pricePerDayNok: 1000,
    tiurRating: 4,
    orrhaneRating: 5,
    mapId: "midtnorge1",
    access: "inatur",
  },
  {
    id: "inatur-hogstflate",
    name: "Hogstflate nord",
    region: "Østlandet",
    blurb:
      "Frøfurufelt og hogstkanter — orre langs beite og bjørk, tiur på furutoppene.",
    pricePerDayNok: 750,
    tiurRating: 3,
    orrhaneRating: 4,
    mapId: "inatur1",
    access: "inatur",
  },
  {
    /** Legacy id — display name is furuskog (saves keep this key). */
    id: "inatur-granskog",
    name: "Furuskog sør",
    region: "Østlandet",
    blurb:
      "Klassisk furuskog — tiur på myrer og høyder, orre i frøfelt og bjørkekanter.",
    pricePerDayNok: 900,
    tiurRating: 4,
    orrhaneRating: 3,
    mapId: "inatur2",
    access: "inatur",
  },
  {
    id: "svenskegrensa",
    name: "Svenskegrensa",
    region: "Østlandet",
    blurb:
      "Langs grensa — fururrygger, myrer og mange markerte sitteplasser.",
    pricePerDayNok: 1100,
    tiurRating: 4,
    orrhaneRating: 4,
    mapId: "svenskegrensa",
    access: "inatur",
  },
  {
    id: "finnskogen",
    name: "Finnskogen",
    region: "Østlandet / Finnskogen",
    blurb:
      "VIP-teig — furuskog, myrkanter og gode sitteplasser. Dagskort 1500 kr · tiur 4/5 · orrfugl 4/5.",
    pricePerDayNok: 1500,
    tiurRating: 4,
    orrhaneRating: 4,
    mapId: "finnskogen",
    access: "vip",
  },
  {
    id: "rulles-stubb-teig",
    name: "Stubbens teig",
    region: "Østlandet",
    blurb:
      "Kari Stubb sitt lille stykke (10 tiur) — litt furu, litt bjørk. «Ikke skyt mot hytta. Den er forsikret, men jeg er ikke.»",
    pricePerDayNok: 350,
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
      "Kristian Olav sin skråning (15 tiur) — orre i bjørk og beite, tiur opp mot furua. Ikke tråkk i potetene.",
    pricePerDayNok: 800,
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
      "Carl Otto Løvenskiolds fineste (20 tiur) — myr, furuhøyder og orrekanter. Du er gjest — oppfør deg deretter.",
    pricePerDayNok: 6000,
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

/**
 * How many tiur spawn on the map for this lease.
 * Cheap → thin; mid → decent; expensive → full.
 *   ≤ 350 kr  → 10
 *   ≤ 800 kr  → 15
 *   else      → 20
 */
export function tiurSpawnCountForTerrain(terrain: HuntingTerrain): number {
  if (terrain.pricePerDayNok <= 350) return 10;
  if (terrain.pricePerDayNok <= 800) return 15;
  return 20;
}

/** Terrains visible on inatur for this player. */
export function terrainsAvailableForPlayer(
  unlockedTerrainIds: readonly string[],
  opts?: { isVip?: boolean; isAdmin?: boolean },
): HuntingTerrain[] {
  const unlocked = new Set(unlockedTerrainIds);
  const vipOk = !!opts?.isVip || !!opts?.isAdmin;
  return HUNTING_TERRAINS.filter((t) => {
    if (t.access === "inatur") return true;
    if (t.access === "rulles") return unlocked.has(t.id);
    if (t.access === "vip") return vipOk;
    return false;
  });
}

export function formatBirdRating(rating: BirdRating): string {
  return `${rating}/5`;
}

/** Public image path for a terrain's hunt map. */
export function terrainMapSrc(terrain: HuntingTerrain): string {
  return getHuntMap(terrain.mapId).src;
}
