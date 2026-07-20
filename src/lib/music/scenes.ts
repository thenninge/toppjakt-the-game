import type { TownLocationId } from "@/components/town/TownHub";

/** Scene keys — one folder per scene under /public/music/. */
export type MusicScene =
  | "intro"
  | "town"
  | "home"
  | "shop"
  | "sheriff"
  | "range"
  | "hunt";

/**
 * Tracks discovered in /public/music/. `null` = no file yet (silent).
 * Paths are URL-encoded where filenames contain spaces.
 */
export const MUSIC_TRACKS: Record<MusicScene, string | null> = {
  intro: "/music/intro/intro.mp3",
  town: null,
  home: "/music/home/inventory.mp3",
  shop: null,
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
    | "sheriff-applied";
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
  if (phase === "location" && location) {
    switch (location) {
      case "sheriff":
        return "sheriff";
      case "pike-pro-shop":
        return "shop";
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
