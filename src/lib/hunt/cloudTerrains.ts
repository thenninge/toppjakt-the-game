/**
 * Runtime registry for Supabase-published hunt terrains.
 * Synced copies also land in cloudHuntMapsCatalog.ts via Admin → Jaktfelt.
 */

import type { HuntGridCell } from "@/lib/hunt/maps";
import type { MapBirdSeat } from "@/lib/hunt/mapPlacements";

export const CLOUD_TERRAIN_MAX_BYTES = 6 * 1024 * 1024;
export const CLOUD_TERRAIN_MAX_EDGE_PX = 4096;
/** Prefer PNG for map art; JPEG allowed as fallback. */
export const CLOUD_TERRAIN_PNG_QUALITY_HINT = 0.92;

export type CloudHuntTerrain = {
  id: string;
  title: string;
  regionHint: string;
  imageUrl: string;
  cols: number;
  rows: number;
  start: HuntGridCell;
  awareMapMaxM: number | null;
  seats: MapBirdSeat[];
  updatedAt?: string;
};

const CACHE_TTL_MS = 10 * 60 * 1000;

type CacheState = {
  fetchedAt: number;
  terrains: CloudHuntTerrain[];
};

let cache: CacheState | null = null;
let inflight: Promise<CloudHuntTerrain[]> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

export function subscribeCloudTerrains(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getCachedCloudTerrains(): CloudHuntTerrain[] {
  return cache?.terrains ?? [];
}

function setCache(terrains: CloudHuntTerrain[]) {
  cache = { fetchedAt: Date.now(), terrains };
  notify();
}

/**
 * Fetch published cloud terrains (browser). Soft-fails to [] if API unavailable.
 */
export async function ensureCloudTerrainsLoaded(
  opts?: { force?: boolean },
): Promise<CloudHuntTerrain[]> {
  if (
    !opts?.force &&
    cache &&
    Date.now() - cache.fetchedAt < CACHE_TTL_MS
  ) {
    return cache.terrains;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/hunt/cloud-terrains");
      if (!res.ok) {
        if (cache) return cache.terrains;
        setCache([]);
        return [];
      }
      const data = (await res.json()) as {
        terrains?: CloudHuntTerrain[];
      };
      const list = Array.isArray(data.terrains) ? data.terrains : [];
      setCache(list);
      return list;
    } catch {
      if (cache) return cache.terrains;
      setCache([]);
      return [];
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function isCloudTerrainImage(imageSrc: string): boolean {
  if (!imageSrc) return false;
  return (
    imageSrc.includes("/storage/v1/object/public/hunt-terrains/") ||
    imageSrc.startsWith("/maps/cloud/")
  );
}
