/**
 * Spotting optic SFX under /public/sfx/.
 * - ruffle: raise binos / switch optic (play to completion under black)
 * - thermal: thermal boot (after ruffle) + WH/BH/Outline/Fusion clicks
 * - lrf: F / Space / LRF button ranging (Web Audio buffer, gain > 1)
 */

import { effectiveSfxVolume } from "@/lib/audio/volumes";

export const SPOT_AUDIO = {
  ruffle: "/sfx/ruffle.mp3",
  thermal: "/sfx/thermal.mp3",
  lrf: "/sfx/buttonlrf.mp3",
} as const;

const RUFFLE_VOLUME = 0.7;
const THERMAL_VOLUME = 0.65;
/** Base gain × 3 via Web Audio (HTMLAudioElement.volume caps at 1). */
const LRF_GAIN = 0.7 * 3;

export type SpotAudioHandle = {
  audio: HTMLAudioElement;
  /** Resolves when playback ends (or immediately if muted / failed). */
  ended: Promise<void>;
  stop: () => void;
};

let audioCtx: AudioContext | null = null;
/** Decoded LRF click — BufferSource so every press plays (MediaElementSource often one-shots). */
const bufferCache = new Map<string, AudioBuffer | Promise<AudioBuffer>>();

function getAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function loadBuffer(
  ctx: AudioContext,
  src: string,
): Promise<AudioBuffer> {
  const hit = bufferCache.get(src);
  if (hit instanceof AudioBuffer) return Promise.resolve(hit);
  if (hit) return hit;
  const pending = fetch(src)
    .then((r) => {
      if (!r.ok) throw new Error(`SFX fetch ${r.status}`);
      return r.arrayBuffer();
    })
    .then((raw) => ctx.decodeAudioData(raw.slice(0)))
    .then((buf) => {
      bufferCache.set(src, buf);
      return buf;
    })
    .catch((err) => {
      bufferCache.delete(src);
      throw err;
    });
  bufferCache.set(src, pending);
  return pending;
}

function playTracked(
  src: string,
  baseVolume: number,
): SpotAudioHandle | null {
  if (typeof window === "undefined") return null;
  const vol = Math.min(1, baseVolume * effectiveSfxVolume());
  if (vol <= 0) {
    return {
      audio: new Audio(),
      ended: Promise.resolve(),
      stop: () => {},
    };
  }
  const audio = new Audio(src);
  audio.volume = vol;
  let settled = false;
  let resolveEnded!: () => void;
  const ended = new Promise<void>((resolve) => {
    resolveEnded = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
  });
  const onEnd = () => resolveEnded();
  audio.addEventListener("ended", onEnd, { once: true });
  audio.addEventListener("error", onEnd, { once: true });
  void audio.play().catch(() => resolveEnded());
  return {
    audio,
    ended,
    stop: () => {
      audio.pause();
      audio.removeEventListener("ended", onEnd);
      audio.removeEventListener("error", onEnd);
      audio.src = "";
      resolveEnded();
    },
  };
}

/**
 * One-shot via AudioBuffer — safe to fire on every LRF press (overlap OK).
 */
function playBufferOneShot(src: string, gainValue: number): void {
  if (typeof window === "undefined") return;
  const scaled = gainValue * effectiveSfxVolume();
  if (scaled <= 0) return;

  const ctx = getAudioCtx();
  if (!ctx) {
    const audio = new Audio(src);
    audio.volume = Math.min(1, scaled);
    void audio.play().catch(() => {});
    return;
  }

  void (async () => {
    try {
      if (ctx.state === "suspended") await ctx.resume();
      const buffer = await loadBuffer(ctx, src);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = scaled;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start(0);
    } catch {
      const audio = new Audio(src);
      audio.volume = Math.min(1, scaled);
      void audio.play().catch(() => {});
    }
  })();
}

/** Cloth/gear ruffle — raising binos or swapping optic. */
export function playSpotRuffle(): SpotAudioHandle | null {
  return playTracked(SPOT_AUDIO.ruffle, RUFFLE_VOLUME);
}

/** Thermal spotter boot / any thermal toolbar button. */
export function playSpotThermal(): SpotAudioHandle | null {
  return playTracked(SPOT_AUDIO.thermal, THERMAL_VOLUME);
}

/** Fire-and-forget thermal click (WH/BH/Outline/Fusion). */
export function playSpotThermalClick(): void {
  playSpotThermal();
}

/** LRF ranging (F / Space / LRF button) — plays on every press. */
export function playSpotLrf(): void {
  playBufferOneShot(SPOT_AUDIO.lrf, LRF_GAIN);
}
