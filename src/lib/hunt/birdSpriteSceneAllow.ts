/**
 * Which bird sprites may appear on which spotting landscape.
 * Default: all allowed. Admin can deny pairs that clash (brightness/contrast).
 * Persisted in localStorage.
 */

import type { BirdSpriteId } from "@/lib/hunt/birdSprites";

const STORAGE_KEY = "toppjakt-bird-sprite-scene-allow-v1";

/** spotImageSrc → sprite ids that are NOT allowed on that scene. */
type DenyMap = Record<string, BirdSpriteId[]>;

let cache: DenyMap | null = null;
const listeners = new Set<() => void>();

function readStorage(): DenyMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: DenyMap = {};
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

function ensureCache(): DenyMap {
  if (!cache) cache = readStorage();
  return cache;
}

function writeStorage(map: DenyMap): void {
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

/** True unless admin denied this sprite on this spotting image. */
export function isBirdSpriteAllowedInScene(
  spotImageSrc: string,
  spriteId: BirdSpriteId,
): boolean {
  if (!spotImageSrc) return true;
  const denied = ensureCache()[spotImageSrc];
  if (!denied || denied.length === 0) return true;
  return !denied.includes(spriteId);
}

/** Persist allow/deny for one sprite × spotting image. */
export function setBirdSpriteAllowedInScene(
  spotImageSrc: string,
  spriteId: BirdSpriteId,
  allowed: boolean,
): void {
  if (!spotImageSrc) return;
  const map = { ...ensureCache() };
  const prev = new Set(map[spotImageSrc] ?? []);
  if (allowed) prev.delete(spriteId);
  else prev.add(spriteId);
  if (prev.size === 0) delete map[spotImageSrc];
  else map[spotImageSrc] = [...prev];
  cache = map;
  writeStorage(map);
  notify();
}

export function subscribeBirdSpriteSceneAllow(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
