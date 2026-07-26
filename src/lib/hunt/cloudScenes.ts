/**
 * Runtime registry for Supabase-published spotting scenes.
 * Merged into spot image pool + perch lookup alongside SPOT_PERCHES.
 */

import type { SpotPerch } from "@/lib/hunt/spotPerches";

export type CloudScenePerch = {
  x: number;
  y: number;
  species: "tiur" | "orrhane";
  distanceMinM: number;
  distanceMaxM: number;
  eyesVisible?: boolean;
  scalePercent?: number;
  id?: string;
};

export type CloudSpotScene = {
  id: string;
  title: string;
  imageUrl: string;
  perches: CloudScenePerch[];
  updatedAt?: string;
};

const CACHE_TTL_MS = 10 * 60 * 1000;

type CacheState = {
  fetchedAt: number;
  scenes: CloudSpotScene[];
};

let cache: CacheState | null = null;
let inflight: Promise<CloudSpotScene[]> | null = null;
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

export function subscribeCloudScenes(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getCachedCloudScenes(): CloudSpotScene[] {
  return cache?.scenes ?? [];
}

export function cloudSceneImageSrcs(): string[] {
  return getCachedCloudScenes().map((s) => s.imageUrl);
}

export function cloudPerchesForImage(imageSrc: string): SpotPerch[] | null {
  const scene = getCachedCloudScenes().find((s) => s.imageUrl === imageSrc);
  if (!scene) return null;
  return scene.perches.map((p, i) => ({
    id: p.id ?? `p${i}`,
    x: p.x,
    y: p.y,
    species: p.species,
    distanceMinM: p.distanceMinM,
    distanceMaxM: p.distanceMaxM,
    eyesVisible: p.eyesVisible !== false,
    scalePercent: p.scalePercent ?? 100,
  }));
}

export function isCloudSpotImage(imageSrc: string): boolean {
  if (!imageSrc) return false;
  if (cloudPerchesForImage(imageSrc)) return true;
  // Public Supabase storage URL for our bucket
  return (
    imageSrc.includes("/storage/v1/object/public/spot-scenes/") ||
    imageSrc.startsWith("cloud:")
  );
}

function setCache(scenes: CloudSpotScene[]) {
  cache = { fetchedAt: Date.now(), scenes };
  notify();
}

/**
 * Fetch published cloud scenes (browser). Soft-fails to [] if API unavailable.
 */
export async function ensureCloudScenesLoaded(
  opts?: { force?: boolean },
): Promise<CloudSpotScene[]> {
  if (
    !opts?.force &&
    cache &&
    Date.now() - cache.fetchedAt < CACHE_TTL_MS
  ) {
    return cache.scenes;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/spot/cloud-scenes");
      if (!res.ok) {
        if (cache) return cache.scenes;
        setCache([]);
        return [];
      }
      const data = (await res.json()) as {
        scenes?: CloudSpotScene[];
      };
      const scenes = Array.isArray(data.scenes) ? data.scenes : [];
      setCache(scenes);
      return scenes;
    } catch {
      if (cache) return cache.scenes;
      setCache([]);
      return [];
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Max bytes accepted after compression (API + client). */
export const CLOUD_SCENE_MAX_BYTES = 3 * 1024 * 1024;
export const CLOUD_SCENE_MAX_EDGE_PX = 2500;
export const CLOUD_SCENE_JPEG_QUALITY = 0.8;
