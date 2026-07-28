/**
 * Player volume prefs — music vs SFX, persisted in localStorage.
 * Values are 0–1 multipliers on each channel’s base gain.
 *
 * Status-bar «Music: Off» mutes music *and* SFX (master audio gate).
 */

const MUSIC_KEY = "toppjakt-music-volume";
const SFX_KEY = "toppjakt-sfx-volume";
const MUSIC_ENABLED_KEY = "toppjakt-music-enabled";

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

/** Status-bar music toggle — also gates SFX when false. */
export function readMusicEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(MUSIC_ENABLED_KEY);
  if (stored === null) return true;
  return stored === "true";
}

export function writeMusicEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUSIC_ENABLED_KEY, String(enabled));
  emit();
}

export function readMusicVolume(): number {
  return readStored(MUSIC_KEY, DEFAULT_MUSIC);
}

/** Stored SFX preference (slider) — ignores master mute. */
export function readSfxVolume(): number {
  return readStored(SFX_KEY, DEFAULT_SFX);
}

/**
 * Live SFX multiplier for playback.
 * 0 when Music is Off (status bar), else the SFX slider value.
 */
export function effectiveSfxVolume(): number {
  if (!readMusicEnabled()) return 0;
  return readSfxVolume();
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

/** Notify when volume or master mute changes (live slider / Music Off). */
export function subscribeAudioVolumes(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
