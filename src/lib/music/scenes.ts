import type { TownLocationId } from "@/components/town/TownHub";

/** Scene keys — one folder per scene under /public/music/. */
export type MusicScene =
  | "intro"
  | "town"
  | "home"
  | "shop"
  | "market"
  | "bar"
  | "sheriff"
  | "range"
  | "hunt";

/**
 * Tracks discovered in /public/music/. `null` = no file yet (silent).
 * Paths are URL-encoded where filenames contain spaces.
 */
const INTRO_TOWN_TRACK = "/music/intro/intro.mp3";

export const MUSIC_TRACKS: Record<MusicScene, string | null> = {
  intro: INTRO_TOWN_TRACK,
  town: INTRO_TOWN_TRACK,
  home: "/music/home/inventory.mp3",
  shop: "/music/shop/shop.mp3",
  market: "/music/market/meatmark.mp3",
  bar: "/music/bar/ompa.mp3",
  sheriff: "/music/sheriff/lensmann.mp3",
  range: null,
  hunt: "/music/hunt/map%20music.mp3",
};

export function getMusicTrack(scene: MusicScene): string | null {
  return MUSIC_TRACKS[scene];
}

export type MusicContextInput = {
  phase:
    | "loading"
    | "name"
    | "welcome"
    | "town"
    | "location"
    | "sheriff-applied"
    | "hunt";
  location: TownLocationId | null;
};

/** Map game UI state → music scene (or null when nothing should play). */
export function musicSceneFromGame({
  phase,
  location,
}: MusicContextInput): MusicScene | null {
  if (phase === "loading" || phase === "name") return null;
  if (phase === "welcome") return "intro";
  if (phase === "town") return "town";
  if (phase === "sheriff-applied") return "sheriff";
  if (phase === "hunt") return "hunt";
  if (phase === "location" && location) {
    switch (location) {
      case "sheriff":
        return "sheriff";
      case "pike-pro-shop":
        return "shop";
      case "cb-customs":
        return "shop";
      case "meat-market":
        return "market";
      case "rulles":
        return "bar";
      case "home":
        return "home";
      case "shooting-range":
        return "range";
      default:
        return "town";
    }
  }
  return null;
}
