/**
 * Player volume prefs — music vs SFX, persisted in localStorage.
 * Values are 0–1 multipliers on each channel’s base gain.
 */

const MUSIC_KEY = "toppjakt-music-volume";
const SFX_KEY = "toppjakt-sfx-volume";

const DEFAULT_MUSIC = 1;
const DEFAULT_SFX = 1;

type Listener = () => void;
const listeners = new Set<Listener>();

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function readStored(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  if (raw === null) return fallback;
  const n = Number.parseFloat(raw);
  return clamp01(Number.isFinite(n) ? n : fallback);
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function readMusicVolume(): number {
  return readStored(MUSIC_KEY, DEFAULT_MUSIC);
}

export function readSfxVolume(): number {
  return readStored(SFX_KEY, DEFAULT_SFX);
}

export function writeMusicVolume(volume: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUSIC_KEY, String(clamp01(volume)));
  emit();
}

export function writeSfxVolume(volume: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SFX_KEY, String(clamp01(volume)));
  emit();
}

/** Notify when either volume changes (live slider updates). */
export function subscribeAudioVolumes(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
