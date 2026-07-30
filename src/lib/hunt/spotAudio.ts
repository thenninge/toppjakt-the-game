/**
 * Spotting optic SFX under /public/sfx/.
 * - ruffle: raise binos / switch optic (play to completion under black)
 * - thermal: thermal boot (after ruffle) + WH/BH/Outline/Fusion clicks
 * - lrf: F / Space / LRF button ranging (Web Audio gain > 1)
 */

import { effectiveSfxVolume } from "@/lib/audio/volumes";

export const SPOT_AUDIO = {
  ruffle: "/sfx/ruffle.mp3",
  thermal: "/sfx/thermal.mp3",
  lrf: "/sfx/buttonlrf.mp3",
} as const;

const RUFFLE_VOLUME = 0.7;
const THERMAL_VOLUME = 0.65;
/** Base HTML volume × 3 via Web Audio (HTMLAudioElement.volume caps at 1). */
const LRF_GAIN = 0.7 * 3;

export type SpotAudioHandle = {
  audio: HTMLAudioElement;
  /** Resolves when playback ends (or immediately if muted / failed). */
  ended: Promise<void>;
  stop: () => void;
};

let audioCtx: AudioContext | null = null;

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
 * One-shot with Web Audio gain (can exceed HTML volume 1.0).
 * Used for LRF click which needs +3× loudness.
 */
function playWithGain(src: string, gainValue: number): void {
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

  const audio = new Audio(src);
  audio.volume = 1;
  const source = ctx.createMediaElementSource(audio);
  const gain = ctx.createGain();
  gain.gain.value = scaled;
  source.connect(gain);
  gain.connect(ctx.destination);
  const cleanup = () => {
    try {
      source.disconnect();
      gain.disconnect();
    } catch {
      /* ignore */
    }
    audio.src = "";
  };
  audio.addEventListener("ended", cleanup, { once: true });
  audio.addEventListener("error", cleanup, { once: true });
  void audio.play().catch(cleanup);
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

/** LRF ranging (F / Space / LRF button) — 3× louder than base. */
export function playSpotLrf(): void {
  playWithGain(SPOT_AUDIO.lrf, LRF_GAIN);
}
