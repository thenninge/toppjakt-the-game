"use client";

import { useEffect, useRef } from "react";

type ShotVideoViewProps = {
  videoSrc: string;
  title: string;
  subtitle?: string;
  onContinue: () => void;
  skipLabel?: string;
  ariaLabel?: string;
};

/**
 * Full-frame post-shot clip (kill / hit / miss).
 * Continues when the video ends, errors, or the player skips.
 * Always muted — scene music runs on Web Audio and must not be interrupted.
 */
export function ShotVideoView({
  videoSrc,
  title,
  subtitle,
  onContinue,
  skipLabel = "Fortsett",
  ariaLabel = "Skuddresultat",
}: ShotVideoViewProps) {
  const doneRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    const el = videoRef.current;
    if (el) {
      el.pause();
      el.removeAttribute("src");
      el.load();
    }
    onContinueRef.current();
  }

  useEffect(() => {
    doneRef.current = false;
  }, [videoSrc]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
    el.volume = 0;
    // Some browsers still expose an audio track — silence every one.
    try {
      const anyEl = el as HTMLVideoElement & {
        audioTracks?: { length: number; [i: number]: { enabled: boolean } };
      };
      const tracks = anyEl.audioTracks;
      if (tracks) {
        for (let i = 0; i < tracks.length; i++) {
          tracks[i]!.enabled = false;
        }
      }
    } catch {
      /* audioTracks not supported */
    }
    void el.play().catch(() => {
      /* autoplay blocked — user can skip */
    });
  }, [videoSrc]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="walk-view"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div className="walk-view-frame">
        <video
          key={videoSrc}
          ref={videoRef}
          className="walk-view-img"
          src={videoSrc}
          autoPlay
          muted
          playsInline
          preload="auto"
          disableRemotePlayback
          onEnded={finish}
          onError={finish}
        />
        <div className="walk-view-veil" aria-hidden />
        <div className="walk-view-copy">
          <p className="intro-line intro-gift">{title}</p>
          {subtitle ? <p className="intro-line">{subtitle}</p> : null}
          <button type="button" className="intro-button" onClick={finish}>
            {skipLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
