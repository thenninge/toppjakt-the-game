/** Range ambience and shot SFX under /public/music/range/. */
export const RANGE_AUDIO = {
  enter: "/music/range/to%20gunrange.mp3",
  shotNoSilencer: "/music/range/shot%20no%20silencer.mp3",
  shotWithSilencer: "/music/range/shot%20with%20silencer.mp3",
  afterShot: "/music/range/after%20shot.mp3",
} as const;

const AMBIENT_VOLUME = 0.42;
const SHOT_VOLUME = 0.75;
const AFTER_SHOT_VOLUME = 0.5;

function playOneShot(
  src: string,
  volume: number,
  onEnded?: () => void,
): HTMLAudioElement | null {
  const audio = new Audio(src);
  audio.volume = volume;
  if (onEnded) {
    audio.addEventListener("ended", onEnded, { once: true });
  }
  void audio.play().catch(() => {});
  return audio;
}

/** Start range entry audio; returns stop function (cancels if still playing). */
export function startRangeAmbient(): () => void {
  const audio = new Audio(RANGE_AUDIO.enter);
  audio.loop = false;
  audio.volume = AMBIENT_VOLUME;
  void audio.play().catch(() => {});
  return () => {
    audio.pause();
    audio.src = "";
  };
}

/** Shot crack → after-shot tail (suppressor picks the shot clip). */
export function playRangeShotSequence(hasSuppressor: boolean): void {
  const shotSrc = hasSuppressor
    ? RANGE_AUDIO.shotWithSilencer
    : RANGE_AUDIO.shotNoSilencer;

  playOneShot(shotSrc, SHOT_VOLUME, () => {
    playOneShot(RANGE_AUDIO.afterShot, AFTER_SHOT_VOLUME);
  });
}
