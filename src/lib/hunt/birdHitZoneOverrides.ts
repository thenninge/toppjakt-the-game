/**
 * Per-sprite hit-zone overrides (vital centre + green/red diameters).
 * Catalog defaults from birdSprites + TIUR_*_DIAMETER_MM. Persisted locally.
 */

import {
  getBirdSprite,
  type BirdSpriteId,
} from "@/lib/hunt/birdSprites";

const STORAGE_KEY = "toppjakt-bird-hit-zones-v1";

/** Match {@link TIUR_INSTANT_KILL_DIAMETER_MM} / {@link TIUR_VITAL_DIAMETER_MM}. */
const DEFAULT_INSTANT_DIAMETER_MM = 66;
const DEFAULT_VITAL_DIAMETER_MM = 114;

export const HIT_ZONE_INSTANT_MM_MIN = 20;
export const HIT_ZONE_INSTANT_MM_MAX = 150;
export const HIT_ZONE_VITAL_MM_MIN = 40;
export const HIT_ZONE_VITAL_MM_MAX = 250;

export type BirdHitZoneOverride = {
  vitalCxPx: number;
  vitalCyPx: number;
  instantDiameterMm: number;
  vitalDiameterMm: number;
};

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

/** Catalog defaults (code) for a sprite. */
export function catalogHitZone(spriteId: BirdSpriteId): BirdHitZoneOverride {
  const s = getBirdSprite(spriteId);
  return {
    vitalCxPx: s.vitalCxPx,
    vitalCyPx: s.vitalCyPx,
    instantDiameterMm: DEFAULT_INSTANT_DIAMETER_MM,
    vitalDiameterMm: DEFAULT_VITAL_DIAMETER_MM,
  };
}

/** Effective zone after overrides. */
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

export function subscribeBirdHitZones(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
