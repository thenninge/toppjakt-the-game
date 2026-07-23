"use client";

import { useEffect, useRef } from "react";
import { getMusicTrack, type MusicScene } from "@/lib/music/scenes";

const MUSIC_VOLUME = 0.45;
const STORAGE_KEY = "toppjakt-music-enabled";

export function readMusicEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === null) return true;
  return stored === "true";
}

export function writeMusicEnabled(enabled: boolean): void {
  window.localStorage.setItem(STORAGE_KEY, String(enabled));
}

type GameMusicProps = {
  scene: MusicScene | null;
  enabled: boolean;
};

type MusicEngine = {
  ctx: AudioContext;
  gain: GainNode;
  source: AudioBufferSourceNode | null;
  /** Absolute URL of the buffer currently loaded/playing. */
  trackHref: string | null;
  buffers: Map<string, AudioBuffer>;
};

/**
 * Scene music via Web Audio — keeps playing when HTML <video> / shot SFX
 * run. HTMLAudioElement is often paused by the browser as soon as a video
 * starts (even muted), which is why hunt music died on post-shot clips.
 */
export function GameMusic({ scene, enabled }: GameMusicProps) {
  const engineRef = useRef<MusicEngine | null>(null);

  useEffect(() => {
    let cancelled = false;

    function ensureEngine(): MusicEngine {
      let eng = engineRef.current;
      if (eng) return eng;
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = MUSIC_VOLUME;
      gain.connect(ctx.destination);
      eng = {
        ctx,
        gain,
        source: null,
        trackHref: null,
        buffers: new Map(),
      };
      engineRef.current = eng;
      return eng;
    }

    function stopSource(eng: MusicEngine) {
      if (!eng.source) return;
      try {
        eng.source.stop();
      } catch {
        /* already stopped */
      }
      try {
        eng.source.disconnect();
      } catch {
        /* noop */
      }
      eng.source = null;
      eng.trackHref = null;
    }

    async function loadBuffer(
      eng: MusicEngine,
      href: string,
    ): Promise<AudioBuffer | null> {
      const cached = eng.buffers.get(href);
      if (cached) return cached;
      try {
        const res = await fetch(href);
        if (!res.ok) return null;
        const raw = await res.arrayBuffer();
        const buf = await eng.ctx.decodeAudioData(raw.slice(0));
        eng.buffers.set(href, buf);
        return buf;
      } catch {
        return null;
      }
    }

    async function startTrack(trackPath: string) {
      const eng = ensureEngine();
      if (eng.ctx.state === "suspended") {
        try {
          await eng.ctx.resume();
        } catch {
          /* needs a later gesture */
        }
      }
      const href = new URL(trackPath, window.location.href).href;
      if (eng.trackHref === href && eng.source) {
        eng.gain.gain.value = MUSIC_VOLUME;
        return;
      }
      const buf = await loadBuffer(eng, href);
      if (cancelled || !buf) return;
      stopSource(eng);
      const source = eng.ctx.createBufferSource();
      source.buffer = buf;
      source.loop = true;
      source.connect(eng.gain);
      eng.gain.gain.value = MUSIC_VOLUME;
      try {
        source.start(0);
      } catch {
        return;
      }
      eng.source = source;
      eng.trackHref = href;
    }

    function unlockOnGesture() {
      const eng = engineRef.current;
      if (!eng) return;
      if (eng.ctx.state === "suspended") {
        void eng.ctx.resume().catch(() => {});
      }
    }

    window.addEventListener("pointerdown", unlockOnGesture);
    window.addEventListener("keydown", unlockOnGesture);

    if (!enabled || !scene) {
      const eng = engineRef.current;
      if (eng) {
        stopSource(eng);
        eng.gain.gain.value = 0;
      }
    } else {
      const track = getMusicTrack(scene);
      if (!track) {
        const eng = engineRef.current;
        if (eng) stopSource(eng);
      } else {
        void startTrack(track);
      }
    }

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", unlockOnGesture);
      window.removeEventListener("keydown", unlockOnGesture);
      // Do not close the AudioContext — keep buffers warm across scene toggles.
      const eng = engineRef.current;
      if (eng && (!enabled || !scene)) {
        stopSource(eng);
      }
    };
  }, [scene, enabled]);

  useEffect(() => {
    return () => {
      const eng = engineRef.current;
      if (!eng) return;
      if (eng.source) {
        try {
          eng.source.stop();
        } catch {
          /* noop */
        }
      }
      void eng.ctx.close().catch(() => {});
      engineRef.current = null;
    };
  }, []);

  return null;
}
