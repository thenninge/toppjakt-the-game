/**
 * Per-sprite hit-zone overrides (vital + body ellipse).
 *
 * - Catalog defaults: {@link BIRD_HIT_ZONE_CATALOG} (committed)
 * - Local overrides: browser localStorage (admin drafts)
 *
 * Promote with Admin → Treffområde → «Skriv til repo (dev)».
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

const STORAGE_KEY = "toppjakt-bird-hit-zones-v2";

export const HIT_ZONE_INSTANT_MM_MIN = 20;
export const HIT_ZONE_INSTANT_MM_MAX = 150;
export const HIT_ZONE_VITAL_MM_MIN = 40;
export const HIT_ZONE_VITAL_MM_MAX = 250;
export const HIT_ZONE_BODY_RX_MIN = 20;
export const HIT_ZONE_BODY_RX_MAX = 280;
export const HIT_ZONE_BODY_RY_MIN = 30;
export const HIT_ZONE_BODY_RY_MAX = 320;
export const HIT_ZONE_BODY_OFFSET_MAX = 200;
export const HIT_ZONE_HEAD_MM_MIN = 15;
export const HIT_ZONE_HEAD_MM_MAX = 120;

export type BirdHitZoneOverride = BirdHitZone;

type OverrideMap = Partial<Record<BirdSpriteId, BirdHitZoneOverride>>;

let cache: OverrideMap | null = null;
const listeners = new Set<() => void>();

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function defaultBodyForSprite(spriteId: BirdSpriteId): Pick<
  BirdHitZone,
  | "bodyRxMm"
  | "bodyRyMm"
  | "bodyOffsetXMm"
  | "bodyOffsetYMm"
  | "bodyRotationDeg"
> {
  const fromCatalog = BIRD_HIT_ZONE_CATALOG[spriteId];
  if (fromCatalog) {
    return {
      bodyRxMm: fromCatalog.bodyRxMm,
      bodyRyMm: fromCatalog.bodyRyMm,
      bodyOffsetXMm: fromCatalog.bodyOffsetXMm,
      bodyOffsetYMm: fromCatalog.bodyOffsetYMm,
      bodyRotationDeg: fromCatalog.bodyRotationDeg,
    };
  }
  const s = getBirdSprite(spriteId);
  const h = 480;
  const w = h * (s.toppW / s.toppH);
  return {
    bodyRxMm: Math.round(w * 0.26),
    bodyRyMm: Math.round(h * 0.32),
    bodyOffsetXMm: 0,
    bodyOffsetYMm: Math.round(h * 0.04),
    bodyRotationDeg: 0,
  };
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
  const body = defaultBodyForSprite(spriteId);
  const headCx = clamp(
    raw.headCxPx ?? base.headCxPx ?? base.vitalCxPx,
    0,
    sprite.toppW,
  );
  const headCy = clamp(
    raw.headCyPx ?? base.headCyPx ?? Math.max(4, base.vitalCyPx - 20),
    0,
    sprite.toppH,
  );
  const headD = Math.round(
    clamp(
      raw.headDiameterMm ?? base.headDiameterMm ?? 42,
      HIT_ZONE_HEAD_MM_MIN,
      HIT_ZONE_HEAD_MM_MAX,
    ),
  );
  return {
    vitalCxPx: clamp(raw.vitalCxPx ?? base.vitalCxPx, 0, sprite.toppW),
    vitalCyPx: clamp(raw.vitalCyPx ?? base.vitalCyPx, 0, sprite.toppH),
    instantDiameterMm: Math.round(instant),
    vitalDiameterMm: Math.round(vital),
    headCxPx: Math.round(headCx * 10) / 10,
    headCyPx: Math.round(headCy * 10) / 10,
    headDiameterMm: headD,
    bodyRxMm: Math.round(
      clamp(
        raw.bodyRxMm ?? base.bodyRxMm ?? body.bodyRxMm,
        HIT_ZONE_BODY_RX_MIN,
        HIT_ZONE_BODY_RX_MAX,
      ),
    ),
    bodyRyMm: Math.round(
      clamp(
        raw.bodyRyMm ?? base.bodyRyMm ?? body.bodyRyMm,
        HIT_ZONE_BODY_RY_MIN,
        HIT_ZONE_BODY_RY_MAX,
      ),
    ),
    bodyOffsetXMm: Math.round(
      clamp(
        raw.bodyOffsetXMm ?? base.bodyOffsetXMm ?? body.bodyOffsetXMm,
        -HIT_ZONE_BODY_OFFSET_MAX,
        HIT_ZONE_BODY_OFFSET_MAX,
      ),
    ),
    bodyOffsetYMm: Math.round(
      clamp(
        raw.bodyOffsetYMm ?? base.bodyOffsetYMm ?? body.bodyOffsetYMm,
        -HIT_ZONE_BODY_OFFSET_MAX,
        HIT_ZONE_BODY_OFFSET_MAX,
      ),
    ),
    bodyRotationDeg: Math.round(
      ((raw.bodyRotationDeg ??
        base.bodyRotationDeg ??
        body.bodyRotationDeg) %
        360) +
        360,
    ) % 360,
  };
}

function parseZone(
  o: Record<string, unknown>,
  spriteId: BirdSpriteId,
): BirdHitZoneOverride | null {
  if (typeof o.vitalCxPx !== "number") return null;
  if (typeof o.vitalCyPx !== "number") return null;
  if (typeof o.instantDiameterMm !== "number") return null;
  if (typeof o.vitalDiameterMm !== "number") return null;
  return normalize(
    {
      vitalCxPx: o.vitalCxPx,
      vitalCyPx: o.vitalCyPx,
      instantDiameterMm: o.instantDiameterMm,
      vitalDiameterMm: o.vitalDiameterMm,
      headCxPx: typeof o.headCxPx === "number" ? o.headCxPx : undefined,
      headCyPx: typeof o.headCyPx === "number" ? o.headCyPx : undefined,
      headDiameterMm:
        typeof o.headDiameterMm === "number" ? o.headDiameterMm : undefined,
      bodyRxMm: typeof o.bodyRxMm === "number" ? o.bodyRxMm : undefined,
      bodyRyMm: typeof o.bodyRyMm === "number" ? o.bodyRyMm : undefined,
      bodyOffsetXMm:
        typeof o.bodyOffsetXMm === "number" ? o.bodyOffsetXMm : undefined,
      bodyOffsetYMm:
        typeof o.bodyOffsetYMm === "number" ? o.bodyOffsetYMm : undefined,
      bodyRotationDeg:
        typeof o.bodyRotationDeg === "number" ? o.bodyRotationDeg : undefined,
    },
    spriteId,
  );
}

function readStorage(): OverrideMap {
  if (typeof window === "undefined") return {};
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem("toppjakt-bird-hit-zones-v1");
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: OverrideMap = {};
    for (const [id, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (!v || typeof v !== "object") continue;
      const z = parseZone(v as Record<string, unknown>, id as BirdSpriteId);
      if (z) out[id as BirdSpriteId] = z;
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
  const body = defaultBodyForSprite(spriteId);
  return {
    vitalCxPx: s.vitalCxPx,
    vitalCyPx: s.vitalCyPx,
    instantDiameterMm: 66,
    vitalDiameterMm: 114,
    headCxPx: s.vitalCxPx,
    headCyPx: Math.max(4, s.vitalCyPx - 20),
    headDiameterMm: 42,
    ...body,
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

export function clearAllBirdHitZoneOverrides(): void {
  cache = {};
  writeStorage({});
  notify();
}

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

export function exportHitZoneOverrides(): OverrideMap {
  return { ...ensureCache() };
}

export function subscribeBirdHitZones(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
