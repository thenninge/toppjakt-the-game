"use client";

import { useMemo, useState } from "react";
import {
  bookableForecastDates,
  formatHuntDateNb,
  HUNT_SEASON_END_DAY,
  HUNT_SEASON_END_MONTH,
  HUNT_SEASON_START_DAY,
  HUNT_SEASON_START_MONTH,
  parseIsoDate,
  seasonStartDate,
} from "@/lib/hunt/calendar";
import type { HuntingTerrain } from "@/lib/hunt/terrain";
import { terrainYrHeader } from "@/lib/hunt/terrain";
import {
  formatCloudNb,
  formatForecastRowLabel,
  formatForecastWindNb,
  formatPrecipNb,
  generateTerrainForecast,
  huntWeatherBias,
  type HuntWeatherDay,
} from "@/lib/weather/forecast";

type YrNoForecastPanelProps = {
  terrain: HuntingTerrain;
  nextHuntDate: string;
  selectedDate: string;
  onSelectDate: (iso: string) => void;
  onClose: () => void;
};

function tempLabel(c: number): string {
  return `${c > 0 ? "+" : ""}${c.toFixed(0)}°`;
}

function dayHints(day: HuntWeatherDay): string[] {
  const bias = huntWeatherBias(day);
  return [bias.tiurHint, bias.orrhaneHint, bias.windHint].filter(
    (h): h is string => !!h,
  );
}

export function YrNoForecastPanel({
  terrain,
  nextHuntDate,
  selectedDate,
  onSelectDate,
  onClose,
}: YrNoForecastPanelProps) {
  const yr = terrainYrHeader(terrain);
  const forecast = useMemo(
    () => generateTerrainForecast(terrain.id, nextHuntDate, 7),
    [terrain.id, nextHuntDate],
  );
  const [expanded, setExpanded] = useState(selectedDate);

  const start = seasonStartDate();

  return (
    <div
      className="yr-forecast-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`yr.no — ${terrain.name}`}
      onClick={onClose}
    >
      <div
        className="yr-forecast-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="yr-forecast-head">
          <div>
            <p className="yr-forecast-brand">yr.no</p>
            <p className="yr-forecast-place">
              {yr.name} · {terrain.name}
            </p>
            <p className="yr-forecast-meta">
              {yr.lat.toFixed(2)}°N {yr.lon.toFixed(2)}°E · 7-dagers varsel
            </p>
            <p className="yr-forecast-season">
              Jaktsesong {HUNT_SEASON_START_DAY}.{" "}
              {formatMonthNb(HUNT_SEASON_START_MONTH)} – {HUNT_SEASON_END_DAY}.{" "}
              {formatMonthNb(HUNT_SEASON_END_MONTH)}
            </p>
          </div>
          <button type="button" className="intro-button" onClick={onClose}>
            Lukk
          </button>
        </header>

        <p className="shop-row-note yr-forecast-note">
          Neste jaktdag:{" "}
          {formatHuntDateNb(parseIsoDate(nextHuntDate) ?? start, {
            weekday: true,
          })}
          . Trykk <strong>Velg</strong> til høyre for dagen du vil jakte — været
          påvirker tiur/orr-sjanse, og vind reduserer spotting.
        </p>

        <ul className="yr-forecast-list">
          {forecast.map((day) => {
            const selected = day.isoDate === selectedDate;
            const hints = dayHints(day);
            const open = expanded === day.isoDate;
            return (
              <li
                key={day.isoDate}
                className={
                  selected ? "yr-forecast-day is-selected" : "yr-forecast-day"
                }
              >
                <div className="yr-forecast-day-row">
                  <button
                    type="button"
                    className="yr-forecast-day-btn"
                    onClick={() =>
                      setExpanded(open ? "" : day.isoDate)
                    }
                    title="Vis jakttips for dagen"
                  >
                    <span className="yr-forecast-day-label">
                      {formatForecastRowLabel(day)}
                    </span>
                    <span className="yr-forecast-temp">
                      {tempLabel(day.temperatureC)}
                    </span>
                    <span className="yr-forecast-wind">
                      {formatForecastWindNb(day)}
                    </span>
                    <span className="yr-forecast-sky">{formatCloudNb(day)}</span>
                    <span className="yr-forecast-precip">
                      {formatPrecipNb(day.precip)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={
                      selected
                        ? "intro-button shop-buy kit-equipped yr-forecast-pick"
                        : "intro-button shop-buy yr-forecast-pick"
                    }
                    onClick={() => {
                      onSelectDate(day.isoDate);
                      setExpanded(day.isoDate);
                    }}
                    title={`Jakt ${formatHuntDateNb(day.date)}`}
                  >
                    {selected ? "Valgt" : "Velg"}
                  </button>
                </div>
                {open && hints.length > 0 ? (
                  <ul className="yr-forecast-hints">
                    {hints.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>

        {bookableForecastDates(nextHuntDate).length === 0 ? (
          <p className="intro-error">
            Sesongen er over — ingen flere jaktdager før neste år.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function formatMonthNb(month: number): string {
  const names = [
    "jan",
    "feb",
    "mar",
    "apr",
    "mai",
    "jun",
    "jul",
    "aug",
    "sep",
    "okt",
    "nov",
    "des",
  ];
  return names[month - 1] ?? String(month);
}
