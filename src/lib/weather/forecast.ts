/**
 * yr.no-style 7-day hunt forecast — synthetic but terrain- and calendar-driven.
 * Feeds jaktkort booking, bird spawn bias, and ballistics temperature.
 */

import {
  addCalendarDays,
  formatHuntDateNb,
  formatHuntDateShortNb,
  meanSeasonTempC,
  parseIsoDate,
  type HuntCalendarDate,
} from "@/lib/hunt/calendar";
import {
  createDayWeather,
  formatWindCompass,
  formatWindSpeed,
  MAX_WIND_SPEED_MS,
  sampleToppjaktWindMs,
  type DayWeather,
  type HuntWeatherBias,
  type WeatherSnapshot,
} from "@/lib/weather/spec";

export type PrecipKind = "none" | "rain" | "snow";

export type HuntWeatherDay = {
  isoDate: string;
  date: HuntCalendarDate;
  temperatureC: number;
  windSpeedMs: number;
  windFromDeg: number;
  /** 0–100 */
  cloudCoverPct: number;
  foggy: boolean;
  precip: PrecipKind;
  /** Clear skies with sun (no fog/precip, low cloud cover). */
  sunny: boolean;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Deterministic PRNG from terrain + date — stable forecast when reopening yr.no. */
export function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10_000) / 10_000;
  };
}

/** Terrain altitude tweak — inland / mountain leases run colder. */
function terrainTempOffsetC(terrainId: string): number {
  if (terrainId === "trondelag" || terrainId === "svenskegrensa") return -2.5;
  if (terrainId === "finnskogen" || terrainId === "sandbekken") return -1;
  if (terrainId === "rulles-lovenskiold") return -1.5;
  if (terrainId.includes("ostlandet-budsjett")) return 0.5;
  return 0;
}

function generateHuntWeatherDay(
  terrainId: string,
  date: HuntCalendarDate,
  random: () => number,
): HuntWeatherDay {
  const isoDate = `${date.year}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
  const baseTemp =
    meanSeasonTempC(date) + terrainTempOffsetC(terrainId) + (random() * 2 - 1) * 3.5;
  const temperatureC = round1(clamp(baseTemp, -22, 18));

  const windSpeedMs = sampleToppjaktWindMs(random);
  const windFromDeg = Math.round(random() * 360);

  const cloudRoll = random();
  const cloudCoverPct = Math.round(
    clamp(
      cloudRoll < 0.35
        ? 15 + random() * 35
        : cloudRoll < 0.7
          ? 45 + random() * 35
          : 70 + random() * 28,
      5,
      100,
    ),
  );

  const foggy =
    cloudCoverPct >= 50
      ? random() < 0.22
      : random() < 0.06;

  // Nedbør: samme trekk blir snø ved 0 °C eller kaldere (minusgrader / frost).
  let precip: PrecipKind = "none";
  if (random() < (cloudCoverPct >= 60 ? 0.42 : 0.18)) {
    precip = temperatureC <= 0 ? "snow" : "rain";
  }

  /** Klarvær med sol — synlig sol, lite skydekke, ingen tåke/nedbør. */
  const sunny =
    precip === "none" && !foggy && cloudCoverPct < 35;

  return {
    isoDate,
    date,
    temperatureC,
    windSpeedMs,
    windFromDeg,
    cloudCoverPct,
    foggy,
    precip,
    sunny,
  };
}

export function generateTerrainForecast(
  terrainId: string,
  startIso: string,
  days = 7,
): HuntWeatherDay[] {
  const start = parseIsoDate(startIso);
  if (!start) return [];
  const out: HuntWeatherDay[] = [];
  let d = start;
  for (let i = 0; i < days; i++) {
    const iso = `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
    const random = seededRandom(`${terrainId}::${iso}`);
    out.push(generateHuntWeatherDay(terrainId, d, random));
    d = addCalendarDays(d, 1);
  }
  return out;
}

export function getHuntWeatherDay(
  terrainId: string,
  isoDate: string,
): HuntWeatherDay | null {
  const date = parseIsoDate(isoDate);
  if (!date) return null;
  const random = seededRandom(`${terrainId}::${isoDate}`);
  return generateHuntWeatherDay(terrainId, date, random);
}

export function huntWeatherBias(day: HuntWeatherDay): HuntWeatherBias {
  let tiur = 1;
  let orrhane = 1;
  let count = 1;
  let spotting = 1;
  const tiurHints: string[] = [];
  const orrhaneHints: string[] = [];

  if (day.cloudCoverPct >= 55) {
    tiur += 0.22;
    tiurHints.push("skyet");
  }
  if (day.foggy) {
    tiur += 0.32;
    tiurHints.push("tåke");
  }
  if (day.precip === "snow") {
    tiur += 0.28;
    tiurHints.push("snø");
  }

  // Orrhaner: kaldt klarvær med sol er best.
  if (day.sunny && day.temperatureC <= 6) {
    orrhane += 0.38;
    orrhaneHints.push("klarvær", "sol");
  } else if (
    day.temperatureC <= 2 &&
    day.precip === "none" &&
    day.cloudCoverPct < 45 &&
    !day.foggy
  ) {
    orrhane += 0.22;
    orrhaneHints.push("kaldt og klart");
  } else if (day.sunny) {
    orrhane += 0.12;
    orrhaneHints.push("sol");
  }

  let windHint: string | null = null;
  if (day.windSpeedMs >= 3) {
    const penalty = day.windSpeedMs >= 4.5 ? 0.42 : 0.26;
    count *= 1 - penalty;
    spotting *= 1 - penalty;
    windHint =
      day.windSpeedMs >= 4.5
        ? "Mye vind — færre fugl sitter"
        : "Bris — redusert sjanse for å se fugl";
  }

  return {
    tiurWeightMult: tiur,
    orrhaneWeightMult: orrhane,
    birdCountMult: count,
    spottingMult: spotting,
    tiurHint:
      tiurHints.length > 0 ? `Bra tiurvær (${tiurHints.join(", ")})` : null,
    orrhaneHint:
      orrhaneHints.length > 0
        ? `Bra orrvær (${orrhaneHints.join(", ")})`
        : null,
    windHint,
  };
}

function snapshotFromHuntDay(day: HuntWeatherDay): WeatherSnapshot {
  return {
    temperatureC: day.temperatureC,
    windSpeedMs: day.windSpeedMs,
    windFromDeg: day.windFromDeg,
  };
}

/** Build playable {@link DayWeather} for a booked hunt day. */
export function createDayWeatherForHunt(
  terrainId: string,
  isoDate: string,
): DayWeather | null {
  const huntDay = getHuntWeatherDay(terrainId, isoDate);
  if (!huntDay) return null;
  const bias = huntWeatherBias(huntDay);
  const truth = snapshotFromHuntDay(huntDay);
  const random = seededRandom(`${terrainId}::forecast::${isoDate}`);
  const forecast: WeatherSnapshot = {
    temperatureC: round1(
      truth.temperatureC + (random() * 2 - 1) * 2,
    ),
    windSpeedMs: clamp(
      round1(
        truth.windSpeedMs *
          (1 + ((random() * 2 - 1) * 18) / 100),
      ),
      0,
      MAX_WIND_SPEED_MS,
    ),
    windFromDeg: truth.windFromDeg,
  };
  return {
    dayLabel: `${formatHuntDateNb(huntDay.date, { weekday: true })} — ${terrainId}`,
    forecast,
    live: { ...truth },
    morningWindSpeedMs: truth.windSpeedMs,
    missionMinutes: 0,
    huntDateIso: isoDate,
    huntBias: bias,
    hourly: generateHuntDayHourly(terrainId, isoDate),
  };
}

export function formatPrecipNb(precip: PrecipKind): string {
  if (precip === "snow") return "Snø";
  if (precip === "rain") return "Regn";
  return "Opphold";
}

export function formatCloudNb(day: {
  foggy: boolean;
  cloudCoverPct: number;
  sunny: boolean;
  precip?: PrecipKind;
}): string {
  if (day.foggy) return "Tåke";
  if (day.cloudCoverPct >= 75) return "Overskyet";
  if (day.cloudCoverPct >= 45) return "Delvis skyet";
  if (day.sunny) return "Klarvær · Sol";
  if (
    day.cloudCoverPct < 45 &&
    (day.precip ?? "none") === "none" &&
    !day.foggy
  ) {
    return "Klarvær";
  }
  return "Lettskyet";
}

export function formatForecastRowLabel(day: HuntWeatherDay): string {
  return formatHuntDateShortNb(day.date);
}

export function formatForecastWindNb(day: HuntWeatherDay): string {
  return `${formatWindSpeed(day.windSpeedMs)} ${formatWindCompass(day.windFromDeg)}`;
}

export type HuntHourlySlot = {
  /** Hour of day 8–18 inclusive. */
  hour: number;
  temperatureC: number;
  windSpeedMs: number;
  windFromDeg: number;
  cloudCoverPct: number;
  foggy: boolean;
  precip: PrecipKind;
  sunny: boolean;
};

/**
 * Wind spotting multiplier — calm ≈ 1, 3 m/s ~0.74, 5 m/s ~0.58.
 * Used for time-of-day bird spotting (prespot / study-map hint).
 */
export function spottingMultFromWindMs(windSpeedMs: number): number {
  const w = Math.max(0, windSpeedMs);
  if (w < 3) return 1;
  if (w >= 4.5) return 0.58;
  return 0.74;
}

/** Cloud / fog / snow / sun modifiers on spotting (species-agnostic visibility). */
export function spottingMultFromSky(opts: {
  cloudCoverPct: number;
  foggy: boolean;
  precip: PrecipKind;
  sunny: boolean;
}): number {
  let m = 1;
  if (opts.foggy) m *= 0.85;
  if (opts.precip === "snow") m *= 0.9;
  if (opts.precip === "rain") m *= 0.92;
  if (opts.sunny) m *= 1.05;
  return m;
}

/**
 * Hourly timeline 08:00–18:00 for a hunt day.
 * Wind/temp evolve through the day (deterministic from terrain + date).
 */
export function generateHuntDayHourly(
  terrainId: string,
  isoDate: string,
): HuntHourlySlot[] {
  const morning = getHuntWeatherDay(terrainId, isoDate);
  if (!morning) return [];
  const random = seededRandom(`${terrainId}::hourly::${isoDate}`);

  // Afternoon wind path: calm day stays calm, or builds / fades.
  const pathRoll = random();
  const afternoonPeak =
    pathRoll < 0.55
      ? morning.windSpeedMs * (0.7 + random() * 0.4)
      : pathRoll < 0.85
        ? clamp(
            morning.windSpeedMs + 1.2 + random() * 2.5,
            0,
            MAX_WIND_SPEED_MS,
          )
        : clamp(morning.windSpeedMs * (0.35 + random() * 0.3), 0, 2);

  const eveningWind = clamp(
    afternoonPeak * (0.55 + random() * 0.5) + (random() * 0.6 - 0.3),
    0,
    MAX_WIND_SPEED_MS,
  );

  const dirDrift = (random() * 2 - 1) * 40;
  const slots: HuntHourlySlot[] = [];

  for (let hour = 8; hour <= 18; hour++) {
    const t = (hour - 8) / 10; // 0 at 08, 1 at 18
    // Piecewise wind: morning → peak ~14 → evening
    let wind: number;
    if (t <= 0.6) {
      const u = t / 0.6;
      wind = morning.windSpeedMs + (afternoonPeak - morning.windSpeedMs) * u;
    } else {
      const u = (t - 0.6) / 0.4;
      wind = afternoonPeak + (eveningWind - afternoonPeak) * u;
    }
    wind = round1(clamp(wind + (random() * 0.4 - 0.2), 0, MAX_WIND_SPEED_MS));

    // Temp: cool morning, slight midday bump, colder late.
    const tempBump = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 3.5;
    const temperatureC = round1(
      clamp(morning.temperatureC + tempBump - t * 1.5, -22, 18),
    );

    const cloudCoverPct = Math.round(
      clamp(
        morning.cloudCoverPct + (random() * 24 - 12) + (t > 0.5 ? 5 : 0),
        5,
        100,
      ),
    );
    const foggy =
      morning.foggy && hour <= 11
        ? true
        : cloudCoverPct >= 55
          ? random() < 0.12
          : false;

    let precip: PrecipKind = "none";
    if (random() < (cloudCoverPct >= 65 ? 0.28 : 0.1)) {
      precip = temperatureC <= 0 ? "snow" : "rain";
    } else if (morning.precip !== "none" && hour <= 12 && random() < 0.45) {
      precip = temperatureC <= 0 ? "snow" : morning.precip;
    }

    const sunny =
      precip === "none" && !foggy && cloudCoverPct < 35;

    slots.push({
      hour,
      temperatureC,
      windSpeedMs: wind,
      windFromDeg: Math.round(
        ((morning.windFromDeg + dirDrift * t) % 360 + 360) % 360,
      ),
      cloudCoverPct,
      foggy,
      precip,
      sunny,
    });
  }
  return slots;
}

export function sampleHourlyAtClockMinutes(
  slots: readonly HuntHourlySlot[],
  clockMinutes: number,
): HuntHourlySlot | null {
  if (slots.length === 0) return null;
  const hour = Math.floor(clockMinutes / 60);
  const frac = (clockMinutes % 60) / 60;
  const a =
    slots.find((s) => s.hour === hour) ??
    slots.reduce((best, s) =>
      Math.abs(s.hour - hour) < Math.abs(best.hour - hour) ? s : best,
    );
  const b = slots.find((s) => s.hour === hour + 1) ?? a;
  if (a === b) return a;
  const lerp = (x: number, y: number) => round1(x + (y - x) * frac);
  return {
    hour: a.hour,
    temperatureC: lerp(a.temperatureC, b.temperatureC),
    windSpeedMs: lerp(a.windSpeedMs, b.windSpeedMs),
    windFromDeg: a.windFromDeg,
    cloudCoverPct: Math.round(
      a.cloudCoverPct + (b.cloudCoverPct - a.cloudCoverPct) * frac,
    ),
    foggy: frac < 0.5 ? a.foggy : b.foggy,
    precip: frac < 0.5 ? a.precip : b.precip,
    sunny: frac < 0.5 ? a.sunny : b.sunny,
  };
}

export function spottingMultAtHour(slot: HuntHourlySlot): number {
  return (
    spottingMultFromWindMs(slot.windSpeedMs) *
    spottingMultFromSky({
      cloudCoverPct: slot.cloudCoverPct,
      foggy: slot.foggy,
      precip: slot.precip,
      sunny: slot.sunny,
    })
  );
}

export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}
