/**
 * Persist Sig BDX app dials (wind / clock / temp) across hunt engagements.
 */

const STORAGE_KEY = "toppjakt-sig-bdx-app-v1";
const SAVE_VERSION = 1 as const;

export type SigBdxAppSettings = {
  windSpeedMs: number;
  /** Relative wind-from vs shot: 0° = 12 o'clock, clockwise. */
  windRelDeg: number;
  tempC: number;
};

export const SIG_BDX_DEFAULT_SETTINGS: SigBdxAppSettings = {
  windSpeedMs: 0,
  windRelDeg: 0,
  tempC: 0,
};

type SaveV1 = {
  version: typeof SAVE_VERSION;
} & SigBdxAppSettings;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v != null && !Array.isArray(v);
}

function clampTempC(n: number): number {
  const t = Math.round(Number.isFinite(n) ? n : 0);
  return Math.min(30, Math.max(-25, t));
}

function clampWindMs(n: number): number {
  const v = Number.isFinite(n) ? n : 0;
  return Math.min(5, Math.max(0, Math.round(v * 10) / 10));
}

function snapHourDeg(deg: number): number {
  const n = ((Math.round(deg / 30) * 30) % 360 + 360) % 360;
  return n;
}

export function loadSigBdxAppSettings(): SigBdxAppSettings {
  if (typeof window === "undefined") return { ...SIG_BDX_DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...SIG_BDX_DEFAULT_SETTINGS };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== SAVE_VERSION) {
      return { ...SIG_BDX_DEFAULT_SETTINGS };
    }
    return {
      windSpeedMs: clampWindMs(Number(parsed.windSpeedMs)),
      windRelDeg: snapHourDeg(Number(parsed.windRelDeg)),
      tempC: clampTempC(Number(parsed.tempC)),
    };
  } catch {
    return { ...SIG_BDX_DEFAULT_SETTINGS };
  }
}

export function saveSigBdxAppSettings(settings: SigBdxAppSettings): void {
  if (typeof window === "undefined") return;
  try {
    const payload: SaveV1 = {
      version: SAVE_VERSION,
      windSpeedMs: clampWindMs(settings.windSpeedMs),
      windRelDeg: snapHourDeg(settings.windRelDeg),
      tempC: clampTempC(settings.tempC),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode — ignore */
  }
}
