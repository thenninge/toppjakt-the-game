/**
 * Persist Swarovski EL Range app dials (player wind) across engagements.
 * Temp / humidity / pressure always come from forecast enviro.
 */

const STORAGE_KEY = "toppjakt-el-range-app-v1";
const SAVE_VERSION = 1 as const;

export type ElRangeAppSettings = {
  windSpeedMs: number;
  /**
   * Relative wind-from vs shot (crosswind angle):
   * 0° = headwind (12 o'clock), 90° = from right, 270° = from left.
   */
  crosswindAngleDeg: number;
};

export const EL_RANGE_DEFAULT_SETTINGS: ElRangeAppSettings = {
  windSpeedMs: 0,
  crosswindAngleDeg: 90,
};

type SaveV1 = {
  version: typeof SAVE_VERSION;
} & ElRangeAppSettings;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v != null && !Array.isArray(v);
}

function clampWindMs(n: number): number {
  const v = Number.isFinite(n) ? n : 0;
  return Math.min(5, Math.max(0, Math.round(v * 10) / 10));
}

function clampAngle(n: number): number {
  const d = ((Math.round(Number.isFinite(n) ? n : 90) % 360) + 360) % 360;
  return d;
}

export function loadElRangeAppSettings(): ElRangeAppSettings {
  if (typeof window === "undefined") return { ...EL_RANGE_DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EL_RANGE_DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== SAVE_VERSION) {
      return { ...EL_RANGE_DEFAULT_SETTINGS };
    }
    return {
      windSpeedMs: clampWindMs(Number(parsed.windSpeedMs)),
      crosswindAngleDeg: clampAngle(Number(parsed.crosswindAngleDeg)),
    };
  } catch {
    return { ...EL_RANGE_DEFAULT_SETTINGS };
  }
}

export function saveElRangeAppSettings( partial: Partial<ElRangeAppSettings>): void {
  if (typeof window === "undefined") return;
  const prev = loadElRangeAppSettings();
  const next: SaveV1 = {
    version: SAVE_VERSION,
    windSpeedMs: clampWindMs(partial.windSpeedMs ?? prev.windSpeedMs),
    crosswindAngleDeg: clampAngle(
      partial.crosswindAngleDeg ?? prev.crosswindAngleDeg,
    ),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota */
  }
}
