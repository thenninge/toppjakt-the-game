"use client";

import { useState } from "react";
import type { DayWeather } from "@/lib/weather/spec";
import {
  formatWindCompass,
  formatWindSpeed,
} from "@/lib/weather/spec";

type WeatherFrameProps = {
  weather: DayWeather;
};

/**
 * Corner weather chip — collapsed by default.
 * Only mount this during mission (not town / shop / sheriff).
 */
export function WeatherFrame({ weather }: WeatherFrameProps) {
  const [open, setOpen] = useState(false);
  const { forecast, live, dayLabel, missionMinutes } = weather;
  const hours = Math.floor(missionMinutes / 60);
  const mins = Math.floor(missionMinutes % 60);
  const timeLabel =
    missionMinutes <= 0
      ? "morgen"
      : `+${hours}t ${mins.toString().padStart(2, "0")}m`;

  const chipLabel = `${formatWindSpeed(live.windSpeedMs)} ${formatWindCompass(live.windFromDeg)}`;

  return (
    <div
      className={
        open ? "weather-fab weather-fab-open" : "weather-fab"
      }
    >
      <button
        type="button"
        className="weather-fab-toggle"
        aria-expanded={open}
        aria-controls="weather-fab-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="weather-fab-label">Vær</span>
        <span className="weather-fab-chip">{chipLabel}</span>
        <span className="weather-fab-caret" aria-hidden>
          {open ? "▼" : "▲"}
        </span>
      </button>

      {open ? (
        <aside
          id="weather-fab-panel"
          className="weather-fab-panel"
          aria-label="Weather details"
        >
          <div className="stats-frame-title">Vær — {dayLabel}</div>
          <dl className="stats-grid weather-grid">
            <div className="stats-item">
              <dt>Vind (live)</dt>
              <dd>
                {formatWindSpeed(live.windSpeedMs)}{" "}
                {formatWindCompass(live.windFromDeg)}
              </dd>
            </div>
            <div className="stats-item">
              <dt>Retning</dt>
              <dd>{Math.round(live.windFromDeg)}°</dd>
            </div>
            <div className="stats-item">
              <dt>Temp</dt>
              <dd>{live.temperatureC.toFixed(1)}°C</dd>
            </div>
            <div className="stats-item">
              <dt>Forecast vind</dt>
              <dd>
                {formatWindSpeed(forecast.windSpeedMs)}{" "}
                {formatWindCompass(forecast.windFromDeg)}
              </dd>
            </div>
            <div className="stats-item">
              <dt>Forecast temp</dt>
              <dd>{forecast.temperatureC.toFixed(1)}°C</dd>
            </div>
            <div className="stats-item">
              <dt>Tid</dt>
              <dd>{timeLabel}</dd>
            </div>
          </dl>
          <p className="weather-hint">
            LRF/AB: forecast / full-value. Kestrel: live crosswind.
          </p>
        </aside>
      ) : null}
    </div>
  );
}
