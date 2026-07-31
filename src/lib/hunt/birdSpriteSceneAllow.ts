/**
 * Which bird sprites may appear on which spotting landscape.
 * Default: all allowed. Admin can deny pairs that clash (brightness/contrast).
 *
 * Repo catalog: {@link BIRD_SPRITE_SCENE_ALLOW_CATALOG}.
 * Admin drafts: localStorage until «Lagre scene-pool til repo».
 */

import type { BirdSpriteId } from "@/lib/hunt/birdSprites";
import { BIRD_SPRITE_SCENE_ALLOW_CATALOG } from "@/lib/hunt/birdSpriteSceneAllowCatalog";

const STORAGE_KEY = "toppjakt-bird-sprite-scene-allow-v1";

/** spotImageSrc → sprite ids that are NOT allowed on that scene. */
export type BirdSpriteSceneDenyMap = Record<string, BirdSpriteId[]>;

let overrideCache: BirdSpriteSceneDenyMap | null = null;
/** Mutable catalog so bake can update without a full page reload. */
let catalogCache: BirdSpriteSceneDenyMap = {
  ...BIRD_SPRITE_SCENE_ALLOW_CATALOG,
};
const listeners = new Set<() => void>();

function readStorage(): BirdSpriteSceneDenyMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: BirdSpriteSceneDenyMap = {};
    for (const [spot, ids] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (!Array.isArray(ids)) continue;
      out[spot] = ids.filter((id): id is BirdSpriteId => typeof id === "string");
    }
    return out;
  } catch {
    return {};
  }
}

function ensureOverrides(): BirdSpriteSceneDenyMap {
  if (!overrideCache) overrideCache = readStorage();
  return overrideCache;
}

function writeStorage(map: BirdSpriteSceneDenyMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

function notify(): void {
  listeners.forEach((fn) => fn());
}

function deniedForSpot(spotImageSrc: string): BirdSpriteId[] {
  const ov = ensureOverrides();
  if (Object.prototype.hasOwnProperty.call(ov, spotImageSrc)) {
    return ov[spotImageSrc] ?? [];
  }
  return catalogCache[spotImageSrc] ?? [];
}

/** True unless admin denied this sprite on this spotting image. */
export function isBirdSpriteAllowedInScene(
  spotImageSrc: string,
  spriteId: BirdSpriteId,
): boolean {
  if (!spotImageSrc) return true;
  const denied = deniedForSpot(spotImageSrc);
  if (denied.length === 0) return true;
  return !denied.includes(spriteId);
}

/** Persist allow/deny for one sprite × spotting image (local draft). */
export function setBirdSpriteAllowedInScene(
  spotImageSrc: string,
  spriteId: BirdSpriteId,
  allowed: boolean,
): void {
  if (!spotImageSrc) return;
  const map = { ...ensureOverrides() };
  const base = new Set(deniedForSpot(spotImageSrc));
  if (allowed) base.delete(spriteId);
  else base.add(spriteId);
  // Empty array = allow all for this spot (overrides catalog denies).
  map[spotImageSrc] = [...base];
  overrideCache = map;
  writeStorage(map);
  notify();
}

/** Effective deny map (overrides win over catalog; empty override = allow all). */
export function exportEffectiveBirdSpriteSceneDenyMap(): BirdSpriteSceneDenyMap {
  const ov = ensureOverrides();
  const out: BirdSpriteSceneDenyMap = {};
  const spots = new Set([
    ...Object.keys(catalogCache),
    ...Object.keys(ov),
  ]);
  for (const spot of spots) {
    if (Object.prototype.hasOwnProperty.call(ov, spot)) {
      const ids = ov[spot] ?? [];
      if (ids.length > 0) out[spot] = [...ids];
    } else if ((catalogCache[spot]?.length ?? 0) > 0) {
      out[spot] = [...catalogCache[spot]!];
    }
  }
  return out;
}

export function isBirdSpriteSceneAllowDirty(): boolean {
  return Object.keys(ensureOverrides()).length > 0;
}

/** After bake: adopt written catalog and clear local drafts. */
export function applyBakedBirdSpriteSceneAllow(
  denyMap: BirdSpriteSceneDenyMap,
): void {
  catalogCache = {};
  for (const [spot, ids] of Object.entries(denyMap)) {
    if (ids && ids.length > 0) catalogCache[spot] = [...ids];
  }
  overrideCache = {};
  writeStorage({});
  notify();
}

export function subscribeBirdSpriteSceneAllow(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
