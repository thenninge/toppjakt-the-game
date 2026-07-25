/**
 * Admin overrides for perch distance brackets, eyes-band, and local scale %.
 * Keyed by spotting image + stable perch id. Catalog defaults apply when unset.
 */

import type { SpotPerch } from "@/lib/hunt/spotPerches";
import {
  defaultEyesVisibleForBracket,
  spotColorBandFromBracket,
} from "@/lib/hunt/spotBands";

const STORAGE_KEY = "toppjakt-perch-distance-overrides-v1";

export const PERCH_SCALE_MIN = 1;
export const PERCH_SCALE_MAX = 200;
export const PERCH_SCALE_DEFAULT = 100;

export type PerchDistanceBracket = {
  distanceMinM: number;
  distanceMaxM: number;
  /**
   * Synlig med bare øyne (rød/lilla kategori).
   * When omitted in storage, derived from the bracket color band.
   */
  eyesVisible: boolean;
  /** Perch-local sprite size factor (1–200 %, default 100). */
  scalePercent: number;
};

/** spotImageSrc → perchId → bracket */
type OverrideMap = Record<string, Record<string, PerchDistanceBracket>>;

let cache: OverrideMap | null = null;
const listeners = new Set<() => void>();

const DIST_MIN = 50;
const DIST_MAX = 800;

function clampDist(n: number): number {
  if (!Number.isFinite(n)) return 200;
  return Math.max(DIST_MIN, Math.min(DIST_MAX, Math.round(n)));
}

function clampScale(n: number): number {
  if (!Number.isFinite(n)) return PERCH_SCALE_DEFAULT;
  return Math.max(
    PERCH_SCALE_MIN,
    Math.min(PERCH_SCALE_MAX, Math.round(n)),
  );
}

function normalizeBracket(
  minM: number,
  maxM: number,
  eyesVisible?: boolean,
  scalePercent?: number,
): PerchDistanceBracket {
  let lo = clampDist(minM);
  let hi = clampDist(maxM);
  if (lo > hi) {
    const t = lo;
    lo = hi;
    hi = t;
  }
  return {
    distanceMinM: lo,
    distanceMaxM: hi,
    eyesVisible:
      typeof eyesVisible === "boolean"
        ? eyesVisible
        : defaultEyesVisibleForBracket(lo, hi),
    scalePercent:
      typeof scalePercent === "number"
        ? clampScale(scalePercent)
        : PERCH_SCALE_DEFAULT,
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
    for (const [spot, byId] of Object.entries(
      parsed as Record<string, unknown>,
    )) {
      if (!byId || typeof byId !== "object") continue;
      const row: Record<string, PerchDistanceBracket> = {};
      for (const [id, br] of Object.entries(
        byId as Record<string, unknown>,
      )) {
        if (!br || typeof br !== "object") continue;
        const o = br as Record<string, unknown>;
        if (typeof o.distanceMinM !== "number") continue;
        if (typeof o.distanceMaxM !== "number") continue;
        row[id] = normalizeBracket(
          o.distanceMinM,
          o.distanceMaxM,
          typeof o.eyesVisible === "boolean" ? o.eyesVisible : undefined,
          typeof o.scalePercent === "number" ? o.scalePercent : undefined,
        );
      }
      if (Object.keys(row).length > 0) out[spot] = row;
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

export function getPerchDistanceOverride(
  spotImageSrc: string,
  perchId: string,
): PerchDistanceBracket | null {
  return ensureCache()[spotImageSrc]?.[perchId] ?? null;
}

export function setPerchDistanceOverride(
  spotImageSrc: string,
  perchId: string,
  minM: number,
  maxM: number,
  eyesVisible?: boolean,
  scalePercent?: number,
): PerchDistanceBracket {
  const next = normalizeBracket(minM, maxM, eyesVisible, scalePercent);
  const map = { ...ensureCache() };
  const row = { ...(map[spotImageSrc] ?? {}) };
  row[perchId] = next;
  map[spotImageSrc] = row;
  cache = map;
  writeStorage(map);
  notify();
  return next;
}

export function clearPerchDistanceOverride(
  spotImageSrc: string,
  perchId: string,
): void {
  const map = { ...ensureCache() };
  const row = { ...(map[spotImageSrc] ?? {}) };
  if (!(perchId in row)) return;
  delete row[perchId];
  if (Object.keys(row).length === 0) delete map[spotImageSrc];
  else map[spotImageSrc] = row;
  cache = map;
  writeStorage(map);
  notify();
}

/** Apply stored overrides onto catalog perches (by id). */
export function applyPerchDistanceOverrides(
  spotImageSrc: string,
  perches: SpotPerch[],
): SpotPerch[] {
  const row = ensureCache()[spotImageSrc];
  return perches.map((p) => {
    const id = p.id;
    const ov = id && row ? row[id] : undefined;
    const distanceMinM = ov?.distanceMinM ?? p.distanceMinM;
    const distanceMaxM = ov?.distanceMaxM ?? p.distanceMaxM;
    const eyesVisible =
      ov?.eyesVisible ??
      p.eyesVisible ??
      defaultEyesVisibleForBracket(distanceMinM, distanceMaxM);
    const scalePercent = clampScale(
      ov?.scalePercent ?? p.scalePercent ?? PERCH_SCALE_DEFAULT,
    );
    return {
      ...p,
      distanceMinM,
      distanceMaxM,
      eyesVisible,
      scalePercent,
      colorBand: spotColorBandFromBracket(distanceMinM, distanceMaxM),
    };
  });
}

export function subscribePerchDistanceOverrides(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export {
  DIST_MIN as PERCH_DISTANCE_EDIT_MIN_M,
  DIST_MAX as PERCH_DISTANCE_EDIT_MAX_M,
};
