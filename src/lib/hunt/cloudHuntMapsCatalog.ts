/**
 * Synced cloud hunt terrains (Admin → Jaktfelt → Oppdater fra sky).
 * Empty until the first sync.
 */

import type { HuntMapAsset } from "@/lib/hunt/maps";
import type { MapBirdSeat } from "@/lib/hunt/mapPlacements";

export const CLOUD_HUNT_MAPS: Record<string, HuntMapAsset> = {};

export const CLOUD_MAP_BIRD_SEATS: Record<string, readonly MapBirdSeat[]> = {};
