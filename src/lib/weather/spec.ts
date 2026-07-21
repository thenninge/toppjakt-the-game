/**
 * Weather — daily forecast + live (dynamic) conditions.
 *
 * ## Forecast vs truth
 * Morning forecast is what phone apps / LRF-with-AB use for density & wind.
 * Forecast has error (±% on speed, ±° on direction). Live wind drifts during
 * the day/mission — reality moves away from the forecast.
 *
 * ## Kestrel vs forecast LRF
 * - Kestrel (anemometer): measures *local* wind → true crosswind for the shot.
 * - LRF/AB on binoculars: no real crosswind sensor; uses forecast and typically
 *   reports *full-value* windage (assumes wind from 90° to line of fire).
 */

export type WeatherSnapshot = {
  /** Air temperature °C */
  temperatureC: number;
  /** Wind speed m/s */
  windSpeedMs: number;
  /**
   * Meteorological “from” direction in degrees (0 = N, 90 = E, 180 = S, 270 = W).
   */
  windFromDeg: number;
};

export type DayWeather = {
  /** Calendar / hunt day label (for UI). */
  dayLabel: string;
  /** Morning forecast the player (and forecast-fed solvers) see. */
  forecast: WeatherSnapshot;
  /** Live conditions — drifts over mission time. */
  live: WeatherSnapshot;
  /** Minutes since dawn / mission start. */
  missionMinutes: number;
};

/** Typical forecast error vs eventual morning truth (before daytime drift). */
export const FORECAST_WIND_SPEED_ERROR_PERCENT = 18;
export const FORECAST_WIND_DIR_ERROR_DEG = 25;
export const FORECAST_TEMP_ERROR_C = 2;

const COMPASS = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
] as const;

export function normalizeDeg(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

export function formatWindCompass(windFromDeg: number): string {
  const i = Math.round(normalizeDeg(windFromDeg) / 22.5) % 16;
  return COMPASS[i];
}

export function formatWindSpeed(ms: number): string {
  return `${ms.toFixed(1)} m/s`;
}

/** Crosswind component (m/s) for a shot bearing (degrees, where the rifle points).
 * Sign: **+ = wind from the left** (9 o'clock) → bullet drifts right → dial L.
 * − = wind from the right (3 o'clock) → dial R.
 */
export function crosswindMs(
  windSpeedMs: number,
  windFromDeg: number,
  shotBearingDeg: number,
): number {
  // Wind FROM angle relative to shot. sin(+90°) = wind from right of muzzle,
  // so we negate to get the shooter's "from left" convention used by windDriftMm.
  const angle = ((windFromDeg - shotBearingDeg) * Math.PI) / 180;
  return -windSpeedMs * Math.sin(angle);
}

/**
 * What forecast-fed LRF/AB typically offers: full-value windage =
 * assume wind is fully from 90° (max lateral), using forecast speed.
 */
export function fullValueWindageMs(forecastWindSpeedMs: number): number {
  return forecastWindSpeedMs;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function randn(random: () => number): number {
  // Box–Muller
  const u = Math.max(1e-9, random());
  const v = Math.max(1e-9, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Build a Norwegian autumn-mountain style day (tunable). */
export function createDayWeather(
  opts?: { dayLabel?: string; random?: () => number },
): DayWeather {
  const random = opts?.random ?? Math.random;
  const truthMorning: WeatherSnapshot = {
    temperatureC: Math.round((-2 + random() * 12) * 10) / 10,
    windSpeedMs: Math.round((1.5 + random() * 8) * 10) / 10,
    windFromDeg: Math.round(random() * 360),
  };

  // Forecast is noisy view of morning truth
  const forecast: WeatherSnapshot = {
    temperatureC:
      Math.round(
        (truthMorning.temperatureC +
          (random() * 2 - 1) * FORECAST_TEMP_ERROR_C) *
          10,
      ) / 10,
    windSpeedMs: clamp(
      Math.round(
        truthMorning.windSpeedMs *
          (1 +
            ((random() * 2 - 1) * FORECAST_WIND_SPEED_ERROR_PERCENT) / 100) *
          10,
      ) / 10,
      0,
      30,
    ),
    windFromDeg: normalizeDeg(
      truthMorning.windFromDeg +
        (random() * 2 - 1) * FORECAST_WIND_DIR_ERROR_DEG,
    ),
  };

  return {
    dayLabel: opts?.dayLabel ?? "Dag 1 — fjellvær",
    forecast,
    live: { ...truthMorning },
    missionMinutes: 0,
  };
}

/**
 * Advance live weather. Wind and temp wander; forecast stays fixed for the day.
 */
export function advanceLiveWeather(
  day: DayWeather,
  dtMinutes: number,
  random: () => number = Math.random,
): DayWeather {
  if (dtMinutes <= 0) return day;
  const steps = Math.max(1, Math.round(dtMinutes));
  let live = { ...day.live };
  for (let i = 0; i < steps; i++) {
    live = {
      temperatureC:
        Math.round(
          (live.temperatureC + randn(random) * 0.08) * 10,
        ) / 10,
      windSpeedMs: clamp(
        Math.round((live.windSpeedMs + randn(random) * 0.15) * 10) / 10,
        0,
        25,
      ),
      windFromDeg: normalizeDeg(live.windFromDeg + randn(random) * 4),
    };
  }
  return {
    ...day,
    live,
    missionMinutes: day.missionMinutes + dtMinutes,
  };
}
