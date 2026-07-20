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

export function GameMusic({ scene, enabled }: GameMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current ?? new Audio();
    audio.loop = true;
    audio.volume = MUSIC_VOLUME;
    audioRef.current = audio;

    if (!enabled || !scene) {
      audio.pause();
      trackRef.current = null;
      return;
    }

    const track = getMusicTrack(scene);
    if (!track) {
      audio.pause();
      trackRef.current = null;
      return;
    }

    const nextSrc = new URL(track, window.location.href).href;
    const sameTrack = trackRef.current === nextSrc;

    if (!sameTrack) {
      audio.pause();
      audio.src = track;
      trackRef.current = nextSrc;
      void audio.play().catch(() => {
        /* Autoplay blocked until next user gesture — toggle will retry. */
      });
      return;
    }

    if (audio.paused) {
      void audio.play().catch(() => {});
    }
  }, [scene, enabled]);

  return null;
}
