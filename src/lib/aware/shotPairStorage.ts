/**
 * Persist Aware skuddpar for the current hunt engagement (localStorage).
 */

import type { ShotPair } from "@/lib/aware/types";

const STORAGE_KEY = "toppjakt-aware-shot-pairs-v1";
const HUNT_ACTIVE_KEY = "toppjakt-aware-hunt-active";
const SAVE_VERSION = 1 as const;

type ShotPairSaveV1 = {
  version: typeof SAVE_VERSION;
  terrainId: string;
  savedAtMs: number;
  pairs: ShotPair[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v != null && !Array.isArray(v);
}

function normalizePair(raw: unknown): ShotPair | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string") return null;
  if (!isRecord(raw.stand) || !isRecord(raw.impact)) return null;
  const stand = {
    x: Number(raw.stand.x),
    y: Number(raw.stand.y),
  };
  const impact = {
    x: Number(raw.impact.x),
    y: Number(raw.impact.y),
  };
  if (![stand.x, stand.y, impact.x, impact.y].every(Number.isFinite)) {
    return null;
  }
  const target = isRecord(raw.target)
    ? { x: Number(raw.target.x), y: Number(raw.target.y) }
    : { ...impact };
  if (![target.x, target.y].every(Number.isFinite)) return null;

  return {
    ...(raw as unknown as ShotPair),
    stand,
    target,
    impact,
  };
}

export function loadShotPairsForTerrain(terrainId: string): ShotPair[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== SAVE_VERSION) return [];
    if (parsed.terrainId !== terrainId) return [];
    if (!Array.isArray(parsed.pairs)) return [];
    return parsed.pairs
      .map(normalizePair)
      .filter((p): p is ShotPair => p != null);
  } catch {
    return [];
  }
}

export function saveShotPairsForTerrain(
  terrainId: string,
  pairs: ShotPair[],
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: ShotPairSaveV1 = {
      version: SAVE_VERSION,
      terrainId,
      savedAtMs: Date.now(),
      pairs,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function clearShotPairsStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.sessionStorage.removeItem(HUNT_ACTIVE_KEY);
  } catch {
    /* ignore */
  }
}

/** True when this browser tab already has an active hunt engagement. */
export function isAwareHuntSessionActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(HUNT_ACTIVE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markAwareHuntSessionActive(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(HUNT_ACTIVE_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Load pairs for this terrain when continuing the same tab hunt (e.g. refresh).
 * Fresh hunt starts empty.
 */
export function loadShotPairsForHuntStart(terrainId: string): ShotPair[] {
  if (isAwareHuntSessionActive()) {
    return loadShotPairsForTerrain(terrainId);
  }
  clearShotPairsStorage();
  markAwareHuntSessionActive();
  return [];
}
