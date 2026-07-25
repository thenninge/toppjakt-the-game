/**
 * Per-sprite visual scale (1–200 %). Relative sizing between bird images —
 * independent of distance. Default 100. Persisted in localStorage.
 */

import type { BirdSpriteId } from "@/lib/hunt/birdSprites";

const STORAGE_KEY = "toppjakt-bird-sprite-scales-v1";

export const BIRD_SPRITE_SCALE_MIN = 1;
export const BIRD_SPRITE_SCALE_MAX = 200;
export const BIRD_SPRITE_SCALE_DEFAULT = 100;

type ScaleMap = Partial<Record<BirdSpriteId, number>>;

let cache: ScaleMap | null = null;
const listeners = new Set<() => void>();

function clampScale(n: number): number {
  if (!Number.isFinite(n)) return BIRD_SPRITE_SCALE_DEFAULT;
  return Math.max(
    BIRD_SPRITE_SCALE_MIN,
    Math.min(BIRD_SPRITE_SCALE_MAX, Math.round(n)),
  );
}

function readStorage(): ScaleMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: ScaleMap = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "number") out[k as BirdSpriteId] = clampScale(v);
    }
    return out;
  } catch {
    return {};
  }
}

function ensureCache(): ScaleMap {
  if (!cache) cache = readStorage();
  return cache;
}

function writeStorage(map: ScaleMap): void {
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

/** Apparent size multiplier for this sprite (1–200, default 100). */
export function getBirdSpriteScalePercent(id: BirdSpriteId): number {
  const v = ensureCache()[id];
  return v == null ? BIRD_SPRITE_SCALE_DEFAULT : clampScale(v);
}

/** Factor 0.01–2.0 for width math. */
export function getBirdSpriteScaleFactor(id: BirdSpriteId): number {
  return getBirdSpriteScalePercent(id) / 100;
}

/** Persist scale for one sprite; notifies subscribers. */
export function setBirdSpriteScalePercent(
  id: BirdSpriteId,
  percent: number,
): number {
  const next = clampScale(percent);
  const map = { ...ensureCache(), [id]: next };
  cache = map;
  writeStorage(map);
  notify();
  return next;
}

/** Subscribe to scale map changes (admin live preview). */
export function subscribeBirdSpriteScales(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
