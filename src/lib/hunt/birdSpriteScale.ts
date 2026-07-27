/**
 * Per-sprite scale (0–200 %). 100 % = {@link TIUR_SPRITE_HEIGHT_MM} tall on
 * glass (holdover matches ballistics). Lower/higher scales visual + mm together.
 *
 * Defaults: {@link BIRD_SPRITE_SCALE_CATALOG} (repo).
 * Admin edits: localStorage overrides until baked with «Lagre til repo».
 */

import {
  allBirdSpriteIds,
  spriteIdsForSpecies,
  type BirdSpriteId,
} from "@/lib/hunt/birdSprites";
import type { BirdSpecies } from "@/lib/hunt/birds";
import { BIRD_SPRITE_SCALE_CATALOG } from "@/lib/hunt/birdSpriteScaleCatalog";

const STORAGE_KEY = "toppjakt-bird-sprite-scales-v1";

export const BIRD_SPRITE_SCALE_MIN = 0;
export const BIRD_SPRITE_SCALE_MAX = 200;
export const BIRD_SPRITE_SCALE_DEFAULT = 100;

export type BirdSpriteScaleSpecies = BirdSpecies;
type ScaleMap = Partial<Record<BirdSpriteId, number>>;

let overrideCache: ScaleMap | null = null;
/** Mutable copy so bake can update without a full page reload. */
let catalogCache: Record<BirdSpriteId, number> = {
  ...BIRD_SPRITE_SCALE_CATALOG,
};
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

function ensureOverrides(): ScaleMap {
  if (!overrideCache) overrideCache = readStorage();
  return overrideCache;
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

/** Catalog default for this sprite (repo / last bake in session). */
export function catalogBirdSpriteScalePercent(id: BirdSpriteId): number {
  const v = catalogCache[id];
  return v == null ? BIRD_SPRITE_SCALE_DEFAULT : clampScale(v);
}

/** Apparent size % for this sprite (override → catalog → 100). */
export function getBirdSpriteScalePercent(id: BirdSpriteId): number {
  const ov = ensureOverrides()[id];
  if (ov != null) return clampScale(ov);
  return catalogBirdSpriteScalePercent(id);
}

/** Factor 0.01–2.0 for width math. */
export function getBirdSpriteScaleFactor(id: BirdSpriteId): number {
  return getBirdSpriteScalePercent(id) / 100;
}

/** True when local override differs from catalog for this sprite. */
export function isBirdSpriteScaleDirty(id: BirdSpriteId): boolean {
  const ov = ensureOverrides()[id];
  if (ov == null) return false;
  return clampScale(ov) !== catalogBirdSpriteScalePercent(id);
}

/** True when any sprite of the species has a dirty local scale. */
export function isBirdSpriteSpeciesScaleDirty(
  species: BirdSpriteScaleSpecies,
): boolean {
  return spriteIdsForSpecies(species).some(isBirdSpriteScaleDirty);
}

/** Persist local override for one sprite; notifies subscribers. */
export function setBirdSpriteScalePercent(
  id: BirdSpriteId,
  percent: number,
): number {
  const next = clampScale(percent);
  const map = { ...ensureOverrides(), [id]: next };
  // Drop override if it matches catalog (keeps storage clean).
  if (next === catalogBirdSpriteScalePercent(id)) {
    delete map[id];
  }
  overrideCache = map;
  writeStorage(map);
  notify();
  return next;
}

/** Effective scales for every sprite (for bake payload). */
export function exportEffectiveBirdSpriteScales(): Record<
  BirdSpriteId,
  number
> {
  const out = {} as Record<BirdSpriteId, number>;
  for (const id of allBirdSpriteIds()) {
    out[id] = getBirdSpriteScalePercent(id);
  }
  return out;
}

/**
 * After a successful repo bake: update in-memory catalog and clear matching
 * local overrides for the given sprite ids.
 */
export function applyBakedBirdSpriteScales(
  scales: Partial<Record<BirdSpriteId, number>>,
): void {
  const nextCatalog = { ...catalogCache };
  for (const [id, raw] of Object.entries(scales)) {
    if (typeof raw !== "number") continue;
    nextCatalog[id as BirdSpriteId] = clampScale(raw);
  }
  catalogCache = nextCatalog;

  const ov = { ...ensureOverrides() };
  for (const id of Object.keys(scales) as BirdSpriteId[]) {
    delete ov[id];
  }
  overrideCache = ov;
  writeStorage(ov);
  notify();
}

/** Subscribe to scale map changes (admin live preview). */
export function subscribeBirdSpriteScales(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
