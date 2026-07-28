/** Range ambience and shot SFX under /public/music/range/. */

import { effectiveSfxVolume } from "@/lib/audio/volumes";

export const RANGE_AUDIO = {
  enter: "/music/range/to%20gunrange.mp3",
  shotNoSilencer: "/music/range/shot%20no%20silencer.mp3",
  shotWithSilencer: "/music/range/shot%20with%20silencer.mp3",
  afterShot: "/music/range/after%20shot.mp3",
} as const;

const AMBIENT_VOLUME = 0.42;
const SHOT_VOLUME = 0.75;
/** Subsonic + suppressor: barely audible “thump”. */
const SILENT_SHOT_VOLUME = 0.18;
const AFTER_SHOT_VOLUME = 0.5;
const SILENT_AFTER_SHOT_VOLUME = 0.12;

function scaledVolume(base: number): number {
  return Math.min(1, base * effectiveSfxVolume());
}

function playOneShot(
  src: string,
  volume: number,
  onEnded?: () => void,
): HTMLAudioElement | null {
  const vol = scaledVolume(volume);
  if (vol <= 0) return null;
  const audio = new Audio(src);
  audio.volume = vol;
  if (onEnded) {
    audio.addEventListener("ended", onEnded, { once: true });
  }
  void audio.play().catch(() => {});
  return audio;
}

/** Start range entry audio; returns stop function (cancels if still playing). */
export function startRangeAmbient(): () => void {
  const vol = scaledVolume(AMBIENT_VOLUME);
  if (vol <= 0) return () => {};
  const audio = new Audio(RANGE_AUDIO.enter);
  audio.loop = false;
  audio.volume = vol;
  void audio.play().catch(() => {});
  return () => {
    audio.pause();
    audio.src = "";
  };
}

export type RangeShotAudioOptions = {
  hasSuppressor: boolean;
  /** Subsonic + suppressor — use silencer clip at very low volume. */
  silent?: boolean;
  /**
   * Play casing / after-shot tail after the crack.
   * Default true (range). False in the field — no brass ping outdoors.
   */
  afterShot?: boolean;
};

/** Shot crack → optional after-shot tail (suppressor picks the shot clip). */
export function playRangeShotSequence(
  hasSuppressorOrOptions: boolean | RangeShotAudioOptions,
): void {
  const opts: RangeShotAudioOptions =
    typeof hasSuppressorOrOptions === "boolean"
      ? { hasSuppressor: hasSuppressorOrOptions }
      : hasSuppressorOrOptions;
  const silent = !!opts.silent && opts.hasSuppressor;
  const playAfter = opts.afterShot !== false;
  const shotSrc =
    opts.hasSuppressor || silent
      ? RANGE_AUDIO.shotWithSilencer
      : RANGE_AUDIO.shotNoSilencer;
  const shotVol = silent ? SILENT_SHOT_VOLUME : SHOT_VOLUME;
  const afterVol = silent ? SILENT_AFTER_SHOT_VOLUME : AFTER_SHOT_VOLUME;

  playOneShot(
    shotSrc,
    shotVol,
    playAfter
      ? () => {
          playOneShot(RANGE_AUDIO.afterShot, afterVol);
        }
      : undefined,
  );
}
