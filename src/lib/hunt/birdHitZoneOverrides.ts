/**
 * Per-sprite hit-zone overrides (vital centre + green/red diameters).
 *
 * - Catalog defaults: {@link BIRD_HIT_ZONE_CATALOG} (committed, ships to all players)
 * - Local overrides: browser localStorage (admin drafts only)
 *
 * Promote drafts with Admin → Treffområde → «Skriv til repo (dev)».
 */

import {
  BIRD_HIT_ZONE_CATALOG,
  type BirdHitZone,
} from "@/lib/hunt/birdHitZoneCatalog";
import {
  allBirdSpriteIds,
  getBirdSprite,
  type BirdSpriteId,
} from "@/lib/hunt/birdSprites";

const STORAGE_KEY = "toppjakt-bird-hit-zones-v1";

export const HIT_ZONE_INSTANT_MM_MIN = 20;
export const HIT_ZONE_INSTANT_MM_MAX = 150;
export const HIT_ZONE_VITAL_MM_MIN = 40;
export const HIT_ZONE_VITAL_MM_MAX = 250;

export type BirdHitZoneOverride = BirdHitZone;

type OverrideMap = Partial<Record<BirdSpriteId, BirdHitZoneOverride>>;

let cache: OverrideMap | null = null;
const listeners = new Set<() => void>();

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function normalize(
  raw: Partial<BirdHitZoneOverride>,
  spriteId: BirdSpriteId,
): BirdHitZoneOverride {
  const base = catalogHitZone(spriteId);
  let instant = clamp(
    raw.instantDiameterMm ?? base.instantDiameterMm,
    HIT_ZONE_INSTANT_MM_MIN,
    HIT_ZONE_INSTANT_MM_MAX,
  );
  let vital = clamp(
    raw.vitalDiameterMm ?? base.vitalDiameterMm,
    HIT_ZONE_VITAL_MM_MIN,
    HIT_ZONE_VITAL_MM_MAX,
  );
  if (vital < instant) vital = instant;
  const sprite = getBirdSprite(spriteId);
  return {
    vitalCxPx: clamp(raw.vitalCxPx ?? base.vitalCxPx, 0, sprite.toppW),
    vitalCyPx: clamp(raw.vitalCyPx ?? base.vitalCyPx, 0, sprite.toppH),
    instantDiameterMm: Math.round(instant),
    vitalDiameterMm: Math.round(vital),
  };
}

function readStorage(): OverrideMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: OverrideMap = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const o = v as Record<string, unknown>;
      if (typeof o.vitalCxPx !== "number") continue;
      if (typeof o.vitalCyPx !== "number") continue;
      if (typeof o.instantDiameterMm !== "number") continue;
      if (typeof o.vitalDiameterMm !== "number") continue;
      out[id as BirdSpriteId] = normalize(
        {
          vitalCxPx: o.vitalCxPx,
          vitalCyPx: o.vitalCyPx,
          instantDiameterMm: o.instantDiameterMm,
          vitalDiameterMm: o.vitalDiameterMm,
        },
        id as BirdSpriteId,
      );
    }
    return out;
  } catch {
    return {};
  }
}

function ensureCache(): OverrideMap {
  if (!cache) cache = readStorage();
  return cache;
}

function writeStorage(map: OverrideMap): void {
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

/** Catalog defaults (committed code) for a sprite. */
export function catalogHitZone(spriteId: BirdSpriteId): BirdHitZoneOverride {
  const fromCatalog = BIRD_HIT_ZONE_CATALOG[spriteId];
  if (fromCatalog) return { ...fromCatalog };
  const s = getBirdSprite(spriteId);
  return {
    vitalCxPx: s.vitalCxPx,
    vitalCyPx: s.vitalCyPx,
    instantDiameterMm: 66,
    vitalDiameterMm: 114,
  };
}

/** Effective zone after local overrides. */
export function getBirdHitZone(spriteId: BirdSpriteId): BirdHitZoneOverride {
  const ov = ensureCache()[spriteId];
  if (!ov) return catalogHitZone(spriteId);
  return normalize(ov, spriteId);
}

export function getBirdHitZoneOverride(
  spriteId: BirdSpriteId,
): BirdHitZoneOverride | null {
  return ensureCache()[spriteId] ?? null;
}

export function setBirdHitZoneOverride(
  spriteId: BirdSpriteId,
  zone: Partial<BirdHitZoneOverride>,
): BirdHitZoneOverride {
  const next = normalize({ ...getBirdHitZone(spriteId), ...zone }, spriteId);
  const map = { ...ensureCache(), [spriteId]: next };
  cache = map;
  writeStorage(map);
  notify();
  return next;
}

export function clearBirdHitZoneOverride(spriteId: BirdSpriteId): void {
  const map = { ...ensureCache() };
  if (!(spriteId in map)) return;
  delete map[spriteId];
  cache = map;
  writeStorage(map);
  notify();
}

/** Drop all local overrides (e.g. after baking into the committed catalog). */
export function clearAllBirdHitZoneOverrides(): void {
  cache = {};
  writeStorage({});
  notify();
}

/** Snapshot of effective zones for every registered sprite (for repo bake). */
export function exportEffectiveHitZones(): Record<
  BirdSpriteId,
  BirdHitZoneOverride
> {
  const out = {} as Record<BirdSpriteId, BirdHitZoneOverride>;
  for (const id of allBirdSpriteIds()) {
    out[id] = getBirdHitZone(id);
  }
  return out;
}

/** Local override map only (may be partial). */
export function exportHitZoneOverrides(): OverrideMap {
  return { ...ensureCache() };
}

export function subscribeBirdHitZones(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
