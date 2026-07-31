/**
 * Persist Lapua Enviro/App range dial across hunt engagements.
 */

const STORAGE_KEY = "toppjakt-lapua-app-v1";
const SAVE_VERSION = 1 as const;

export const LAPUA_RANGE_MIN_M = 50;
export const LAPUA_RANGE_MAX_M = 1000;
export const LAPUA_RANGE_STEP_M = 10;

export type LapuaAppSettings = {
  rangeM: number;
};

export const LAPUA_DEFAULT_SETTINGS: LapuaAppSettings = {
  rangeM: 200,
};

type SaveV1 = {
  version: typeof SAVE_VERSION;
} & LapuaAppSettings;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v != null && !Array.isArray(v);
}

export function clampLapuaRangeM(n: number): number {
  const raw = Number.isFinite(n) ? n : LAPUA_DEFAULT_SETTINGS.rangeM;
  return Math.min(
    LAPUA_RANGE_MAX_M,
    Math.max(LAPUA_RANGE_MIN_M, Math.round(raw)),
  );
}

export function loadLapuaAppSettings(): LapuaAppSettings {
  if (typeof window === "undefined") return { ...LAPUA_DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...LAPUA_DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== SAVE_VERSION) {
      return { ...LAPUA_DEFAULT_SETTINGS };
    }
    return {
      rangeM: clampLapuaRangeM(Number(parsed.rangeM)),
    };
  } catch {
    return { ...LAPUA_DEFAULT_SETTINGS };
  }
}

/** True when the player (or a prior engagement) has saved a range dial. */
export function hasLapuaAppSettings(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) != null;
  } catch {
    return false;
  }
}

export function saveLapuaAppSettings(
  partial: Partial<LapuaAppSettings>,
): void {
  if (typeof window === "undefined") return;
  const prev = loadLapuaAppSettings();
  const next: SaveV1 = {
    version: SAVE_VERSION,
    rangeM: clampLapuaRangeM(partial.rangeM ?? prev.rangeM),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}
