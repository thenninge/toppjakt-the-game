/**
 * Magasinbytte SFX — short rack/insert for competition mag changes.
 */

import { effectiveSfxVolume } from "@/lib/audio/volumes";

const MAG_CHANGE_SRC = "/sfx/magasinbytte.mp3";
const MAG_CHANGE_VOLUME = 0.85;

let cached: HTMLAudioElement | null = null;

export function playMagasinbytte(): void {
  try {
    const vol = Math.min(1, MAG_CHANGE_VOLUME * effectiveSfxVolume());
    if (vol <= 0.001) return;
    if (!cached) {
      cached = new Audio(MAG_CHANGE_SRC);
      cached.preload = "auto";
    }
    const a = cached.cloneNode(true) as HTMLAudioElement;
    a.volume = vol;
    void a.play().catch(() => {});
  } catch {
    /* ignore autoplay / missing file */
  }
}
