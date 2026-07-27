/**
 * Scope turret dial SFX — single click + hold burst under /public/sfx/turret/.
 * Gain is above HTMLAudioElement.volume (max 1) so clicks cut through music.
 */

import { readSfxVolume } from "@/lib/audio/volumes";

export const TURRET_AUDIO = {
  click: "/sfx/turret/click.mp3",
  burst: "/sfx/turret/clickburst.mp3",
} as const;

/** Was 0.55 / 0.5 on HTML volume — ×6 via Web Audio gain. */
const CLICK_GAIN = 0.55 * 6;
const BURST_GAIN = 0.5 * 6;

type BurstHandle = {
  audio: HTMLAudioElement;
  source: MediaElementAudioSourceNode | null;
  gain: GainNode | null;
};

let audioCtx: AudioContext | null = null;
let burstHandle: BurstHandle | null = null;

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

function effectiveGain(base: number): number {
  return base * readSfxVolume();
}

function playWithGain(src: string, gainValue: number, loop: boolean): BurstHandle | null {
  const scaled = effectiveGain(gainValue);
  if (scaled <= 0) return null;

  const ctx = getAudioCtx();
  if (!ctx) {
    const audio = new Audio(src);
    audio.loop = loop;
    audio.volume = Math.min(1, scaled);
    void audio.play().catch(() => {});
    return { audio, source: null, gain: null };
  }

  const audio = new Audio(src);
  audio.loop = loop;
  audio.volume = 1;
  const source = ctx.createMediaElementSource(audio);
  const gain = ctx.createGain();
  gain.gain.value = scaled;
  source.connect(gain);
  gain.connect(ctx.destination);
  void audio.play().catch(() => {});
  return { audio, source, gain };
}

/** One mechanical click (button tap or drum tick). */
export function playTurretClick(): void {
  if (typeof window === "undefined") return;
  playWithGain(TURRET_AUDIO.click, CLICK_GAIN, false);
}

/** Looping multi-click while holding a turret button. */
export function startTurretBurst(): void {
  if (typeof window === "undefined") return;
  stopTurretBurst();
  burstHandle = playWithGain(TURRET_AUDIO.burst, BURST_GAIN, true);
}

export function stopTurretBurst(): void {
  if (!burstHandle) return;
  const { audio, source, gain } = burstHandle;
  burstHandle = null;
  audio.pause();
  audio.src = "";
  try {
    source?.disconnect();
    gain?.disconnect();
  } catch {
    /* ignore */
  }
}
