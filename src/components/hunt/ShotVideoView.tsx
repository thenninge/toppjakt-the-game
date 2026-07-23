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
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    window.dispatchEvent(new Event("toppjakt-resume-music"));
    onContinueRef.current();
  }

  useEffect(() => {
    doneRef.current = false;
  }, [videoSrc]);

  useEffect(() => {
    // Video playback often pauses looping HTMLAudio — nudge music back on.
    window.dispatchEvent(new Event("toppjakt-resume-music"));
    return () => {
      window.dispatchEvent(new Event("toppjakt-resume-music"));
    };
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
          className="walk-view-img"
          src={videoSrc}
          autoPlay
          muted
          playsInline
          preload="auto"
          onPlay={() =>
            window.dispatchEvent(new Event("toppjakt-resume-music"))
          }
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
