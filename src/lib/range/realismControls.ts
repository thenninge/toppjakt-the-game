/**
 * Per-realism-level feature toggles + shared parameters.
 * Admin «Realism controls» edits localStorage; gameplay reads live.
 *
 * Defaults match historical behaviour: medium = classic HUD; high = tube
 * turrets + parallax blur + illumination + cant (with bubble level in kit).
 */

import type { GameRealism } from "@/lib/optics/turretStyle";
import { realismLevelKey } from "@/lib/range/realismGameplay";

const STORAGE_KEY = "toppjakt-realism-controls-v1";

/** Keep in sync with CANT_ENTRY_SPREAD_DEG / CANT_UI_MAX_DEG defaults. */
const DEFAULT_CANT_ENTRY_SPREAD_DEG = 3.2;
const DEFAULT_CANT_UI_MAX_DEG = 8;
/** Keep in sync with FOCUS_ABORT_MS / TRIGGER_BAR_MS defaults. */
const DEFAULT_FOCUS_ABORT_MS = 7000;
const DEFAULT_TRIGGER_BAR_MS = 3000;

export type RealismFeatureKey =
  | "tubeTurrets"
  | "parallaxBlur"
  | "illumination"
  | "cant"
  | "focusHold"
  | "triggerTiming";

export type RealismLevelFeatures = Record<RealismFeatureKey, boolean>;

export type RealismParams = {
  /** Entry cant amplitude (deg). Used by {@link rollEntryCantDeg}. */
  cantEntrySpreadDeg: number;
  /** Soft max |cant| for UI + clamp. */
  cantUiMaxDeg: number;
  /** Multiplier on parallax DOF blur when blur is enabled. */
  parallaxBlurMult: number;
  /** Focus hard abort (ms). */
  focusAbortMs: number;
  /** Trigger bar fill duration (ms). */
  triggerBarMs: number;
};

export type RealismControlsState = {
  features: Record<GameRealism, RealismLevelFeatures>;
  params: RealismParams;
};

export const REALISM_FEATURE_LABELS: Record<RealismFeatureKey, string> = {
  tubeTurrets: "Tube-mounted turrets (elev/wind/para/illum)",
  parallaxBlur: "Parallax DOF blur",
  illumination: "Reticle illumination turret",
  cant: "Cant (bubble level measures when in kit)",
  focusHold: "Focus hold (F) bar + settle",
  triggerTiming: "Trigger timing (Space) bar + pull error",
};

const DEFAULT_LOW: RealismLevelFeatures = {
  tubeTurrets: false,
  parallaxBlur: false,
  illumination: false,
  cant: false,
  focusHold: true,
  triggerTiming: true,
};

const DEFAULT_MEDIUM: RealismLevelFeatures = {
  tubeTurrets: false,
  parallaxBlur: false,
  illumination: false,
  cant: false,
  focusHold: true,
  triggerTiming: true,
};

const DEFAULT_HIGH: RealismLevelFeatures = {
  tubeTurrets: true,
  parallaxBlur: true,
  illumination: true,
  cant: true,
  focusHold: true,
  triggerTiming: true,
};

export const DEFAULT_REALISM_PARAMS: RealismParams = {
  cantEntrySpreadDeg: DEFAULT_CANT_ENTRY_SPREAD_DEG,
  cantUiMaxDeg: DEFAULT_CANT_UI_MAX_DEG,
  parallaxBlurMult: 1,
  focusAbortMs: DEFAULT_FOCUS_ABORT_MS,
  triggerBarMs: DEFAULT_TRIGGER_BAR_MS,
};

export const DEFAULT_REALISM_CONTROLS: RealismControlsState = {
  features: {
    low: { ...DEFAULT_LOW },
    medium: { ...DEFAULT_MEDIUM },
    high: { ...DEFAULT_HIGH },
  },
  params: { ...DEFAULT_REALISM_PARAMS },
};

const listeners = new Set<() => void>();
let cache: RealismControlsState | null = null;

function clampNum(n: number, lo: number, hi: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, n));
}

function normalizeFeatures(
  raw: unknown,
  fallback: RealismLevelFeatures,
): RealismLevelFeatures {
  const src =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...fallback };
  for (const key of Object.keys(fallback) as RealismFeatureKey[]) {
    if (typeof src[key] === "boolean") out[key] = src[key];
  }
  return out;
}

function normalizeParams(raw: unknown): RealismParams {
  const src =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_REALISM_PARAMS;
  return {
    cantEntrySpreadDeg: clampNum(
      typeof src.cantEntrySpreadDeg === "number" ? src.cantEntrySpreadDeg : d.cantEntrySpreadDeg,
      0.5,
      12,
      d.cantEntrySpreadDeg,
    ),
    cantUiMaxDeg: clampNum(
      typeof src.cantUiMaxDeg === "number" ? src.cantUiMaxDeg : d.cantUiMaxDeg,
      2,
      20,
      d.cantUiMaxDeg,
    ),
    parallaxBlurMult: clampNum(
      typeof src.parallaxBlurMult === "number" ? src.parallaxBlurMult : d.parallaxBlurMult,
      0,
      3,
      d.parallaxBlurMult,
    ),
    focusAbortMs: clampNum(
      typeof src.focusAbortMs === "number" ? src.focusAbortMs : d.focusAbortMs,
      2000,
      20000,
      d.focusAbortMs,
    ),
    triggerBarMs: clampNum(
      typeof src.triggerBarMs === "number" ? src.triggerBarMs : d.triggerBarMs,
      500,
      8000,
      d.triggerBarMs,
    ),
  };
}

function normalizeState(raw: unknown): RealismControlsState {
  const src =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const featuresRaw =
    src.features && typeof src.features === "object"
      ? (src.features as Record<string, unknown>)
      : {};
  return {
    features: {
      low: normalizeFeatures(featuresRaw.low, DEFAULT_LOW),
      medium: normalizeFeatures(featuresRaw.medium, DEFAULT_MEDIUM),
      high: normalizeFeatures(featuresRaw.high, DEFAULT_HIGH),
    },
    params: normalizeParams(src.params),
  };
}

function readStorage(): RealismControlsState {
  if (typeof window === "undefined") return structuredClone(DEFAULT_REALISM_CONTROLS);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_REALISM_CONTROLS);
    return normalizeState(JSON.parse(raw) as unknown);
  } catch {
    return structuredClone(DEFAULT_REALISM_CONTROLS);
  }
}

function ensureCache(): RealismControlsState {
  if (!cache) cache = readStorage();
  return cache;
}

function writeStorage(state: RealismControlsState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode */
  }
}

function notify(): void {
  listeners.forEach((fn) => fn());
}

export function getRealismControls(): RealismControlsState {
  return ensureCache();
}

export function getRealismFeatures(level: GameRealism): RealismLevelFeatures {
  return ensureCache().features[realismLevelKey(level)];
}

export function realismFeatureEnabled(
  level: GameRealism | null | undefined,
  feature: RealismFeatureKey,
): boolean {
  return ensureCache().features[realismLevelKey(level)][feature];
}

export function getRealismParams(): RealismParams {
  return ensureCache().params;
}

export function setRealismControls(next: RealismControlsState): void {
  cache = normalizeState(next);
  writeStorage(cache);
  notify();
}

export function patchRealismLevelFeatures(
  level: GameRealism,
  patch: Partial<RealismLevelFeatures>,
): void {
  const cur = ensureCache();
  const lvl = realismLevelKey(level);
  setRealismControls({
    ...cur,
    features: {
      ...cur.features,
      [lvl]: { ...cur.features[lvl], ...patch },
    },
  });
}

export function patchRealismParams(patch: Partial<RealismParams>): void {
  const cur = ensureCache();
  setRealismControls({
    ...cur,
    params: normalizeParams({ ...cur.params, ...patch }),
  });
}

export function resetRealismControlsToDefaults(): void {
  cache = structuredClone(DEFAULT_REALISM_CONTROLS);
  writeStorage(cache);
  notify();
}

export function subscribeRealismControls(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
