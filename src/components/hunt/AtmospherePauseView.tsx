"use client";

import { useEffect, useRef, useState } from "react";
import { formatHuntClock } from "@/lib/hunt/travel";

type AtmospherePauseViewProps = {
  imageSrc: string;
  title: string;
  subtitle?: string;
  durationMinutes: number;
  /** Clock when the pause started. */
  clockMinutes: number;
  /**
   * Real-time hold before auto-continue.
   * Defaults to a 3–5 s scale based on `durationMinutes`.
   */
  holdMs?: number;
  onContinue: () => void;
  skipLabel?: string;
  ariaLabel?: string;
};

function animDurationMs(durationMinutes: number): number {
  // Real-time pause length: 3–5 seconds (compressed game time).
  return Math.min(5000, Math.max(3000, 2800 + durationMinutes * 25));
}

/** Shared Lost Patrol-style pause: clock counts up, then auto-continues. */
export function AtmospherePauseView({
  imageSrc,
  title,
  subtitle,
  durationMinutes,
  clockMinutes,
  holdMs,
  onContinue,
  skipLabel = "Hopp over",
  ariaLabel = "Pause",
}: AtmospherePauseViewProps) {
  const [displayMinutes, setDisplayMinutes] = useState(clockMinutes);
  const [elapsed, setElapsed] = useState(0);
  const doneRef = useRef(false);
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  function finish() {
    if (doneRef.current) return;
    doneRef.current = true;
    setDisplayMinutes(clockMinutes + durationMinutes);
    setElapsed(durationMinutes);
    onContinueRef.current();
  }

  useEffect(() => {
    doneRef.current = false;
    const durationMs = holdMs ?? animDurationMs(durationMinutes);
    const start = performance.now();
    let raf = 0;

    function frame(now: number) {
      if (doneRef.current) return;
      const t = Math.min(1, (now - start) / durationMs);
      const mins = Math.floor(t * durationMinutes);
      setElapsed(mins);
      setDisplayMinutes(clockMinutes + mins);
      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        finish();
      }
    }

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockMinutes, durationMinutes, holdMs]);

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

  const remaining = Math.max(0, durationMinutes - elapsed);

  return (
    <div className="walk-view" role="dialog" aria-modal="true" aria-label={ariaLabel}>
      <div className="walk-view-frame">
        <img src={imageSrc} alt="" className="walk-view-img" draggable={false} />
        <div className="walk-view-veil" aria-hidden />
        <div className="walk-view-copy">
          <p className="intro-line intro-gift">{title}</p>
          {subtitle ? <p className="intro-line">{subtitle}</p> : null}
          <p className="shop-row-note walk-view-clock">
            Kl {formatHuntClock(displayMinutes)}
            {" · "}
            {elapsed}/{durationMinutes} min
            {remaining > 0 ? ` · ${remaining} min igjen` : " · ferdig"}
          </p>
          <button type="button" className="intro-button" onClick={finish}>
            {skipLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
