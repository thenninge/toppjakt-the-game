"use client";

import { useEffect, useState } from "react";
import {
  formatWindCompass,
} from "@/lib/weather/spec";

type WindMeterViewProps = {
  /** True wind from-direction (deg). */
  windFromDeg: number;
  /** True wind speed (m/s). */
  windSpeedMs: number;
  /** Device ±% error — drives display jitter. */
  windErrorPercent?: number;
  brand?: string;
  name?: string;
};

/**
 * Budget Clas Ohlson-style anemometer HUD — local wind *speed* only.
 * No crosswind / windage solution; player must use Enviro/App.
 */
export function WindMeterView({
  windFromDeg,
  windSpeedMs,
  windErrorPercent = 18,
  brand = "Clas Ohlson",
  name = "Digital vindmåler",
}: WindMeterViewProps) {
  const [displayMs, setDisplayMs] = useState(windSpeedMs);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    function sample() {
      if (cancelled) return;
      const err = Math.max(0.05, windErrorPercent / 100);
      const jitter = 1 + (Math.random() * 2 - 1) * err;
      const flicker = (Math.random() - 0.5) * Math.max(0.15, windSpeedMs * 0.08);
      const next = Math.max(0, windSpeedMs * jitter + flicker);
      setDisplayMs(next);
      timer = window.setTimeout(sample, 380 + Math.random() * 420);
    }

    sample();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [windSpeedMs, windErrorPercent]);

  const fromLabel = formatWindCompass(windFromDeg);

  return (
    <div className="wind-meter-panel" role="img" aria-label="Vindmåler">
      <header className="wind-meter-header">
        <span className="wind-meter-brand">{brand}</span>
        <span className="wind-meter-name">{name}</span>
      </header>

      <div className="wind-meter-lcd">
        <p className="wind-meter-from">
          Vind fra <strong>{fromLabel}</strong>
          <span className="wind-meter-from-deg"> ({Math.round(windFromDeg)}°)</span>
        </p>
        <p className="wind-meter-speed">{displayMs.toFixed(1)}</p>
        <p className="wind-meter-speed-hint">m/s · lokal måling</p>
      </div>

      <p className="shop-row-note wind-meter-note">
        Viser bare vindstyrke fra der det blåser — ikke sidevindvinkel mot
        skuddet. Bruk Enviro/App for windage.
      </p>
    </div>
  );
}
