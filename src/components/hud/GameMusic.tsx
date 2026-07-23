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

/**
 * Looping scene music. Browsers often pause HTMLAudio when a <video> starts
 * (even muted post-shot clips) — we resume whenever we still want music on.
 */
export function GameMusic({ scene, enabled }: GameMusicProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const trackRef = useRef<string | null>(null);
  /** False only around intentional pause/disable — skips auto-resume. */
  const wantPlayRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current ?? new Audio();
    audio.loop = true;
    audio.volume = MUSIC_VOLUME;
    audioRef.current = audio;

    function tryResume() {
      if (!wantPlayRef.current) return;
      if (!audio.paused) return;
      void audio.play().catch(() => {});
    }

    function onUnexpectedPause() {
      // Intentional pause sets wantPlayRef false first in the same tick.
      queueMicrotask(tryResume);
    }

    audio.addEventListener("pause", onUnexpectedPause);
    document.addEventListener("visibilitychange", tryResume);
    window.addEventListener(
      "toppjakt-resume-music" as keyof WindowEventMap,
      tryResume as EventListener,
    );

    if (!enabled || !scene) {
      wantPlayRef.current = false;
      audio.pause();
      trackRef.current = null;
      return () => {
        audio.removeEventListener("pause", onUnexpectedPause);
        document.removeEventListener("visibilitychange", tryResume);
        window.removeEventListener(
          "toppjakt-resume-music" as keyof WindowEventMap,
          tryResume as EventListener,
        );
      };
    }

    const track = getMusicTrack(scene);
    if (!track) {
      wantPlayRef.current = false;
      audio.pause();
      trackRef.current = null;
      return () => {
        audio.removeEventListener("pause", onUnexpectedPause);
        document.removeEventListener("visibilitychange", tryResume);
        window.removeEventListener(
          "toppjakt-resume-music" as keyof WindowEventMap,
          tryResume as EventListener,
        );
      };
    }

    const nextSrc = new URL(track, window.location.href).href;
    const sameTrack = trackRef.current === nextSrc;

    if (!sameTrack) {
      wantPlayRef.current = false;
      audio.pause();
      audio.src = track;
      trackRef.current = nextSrc;
      wantPlayRef.current = true;
      void audio.play().catch(() => {
        /* Autoplay blocked until next user gesture — toggle will retry. */
      });
    } else {
      wantPlayRef.current = true;
      tryResume();
    }

    return () => {
      audio.removeEventListener("pause", onUnexpectedPause);
      document.removeEventListener("visibilitychange", tryResume);
      window.removeEventListener(
        "toppjakt-resume-music" as keyof WindowEventMap,
        tryResume as EventListener,
      );
    };
  }, [scene, enabled]);

  return null;
}
