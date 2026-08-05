/**
 * Hunting season calendar — 10 Sep through 23 Dec (inclusive).
 * Drives yr.no-style forecasts, seasonal temperature, and jaktkort booking.
 */

export const HUNT_SEASON_YEAR = 2026;
export const HUNT_SEASON_START_MONTH = 9;
export const HUNT_SEASON_START_DAY = 10;
export const HUNT_SEASON_END_MONTH = 12;
export const HUNT_SEASON_END_DAY = 23;

export type HuntCalendarDate = {
  year: number;
  month: number;
  day: number;
};

export function seasonStartDate(
  year: number = HUNT_SEASON_YEAR,
): HuntCalendarDate {
  return {
    year,
    month: HUNT_SEASON_START_MONTH,
    day: HUNT_SEASON_START_DAY,
  };
}

export function seasonEndDate(
  year: number = HUNT_SEASON_YEAR,
): HuntCalendarDate {
  return {
    year,
    month: HUNT_SEASON_END_MONTH,
    day: HUNT_SEASON_END_DAY,
  };
}

export function defaultNextHuntDateIso(
  year: number = HUNT_SEASON_YEAR,
): string {
  return toIsoDate(seasonStartDate(year));
}

export function toIsoDate(d: HuntCalendarDate): string {
  const m = String(d.month).padStart(2, "0");
  const day = String(d.day).padStart(2, "0");
  return `${d.year}-${m}-${day}`;
}

export function parseIsoDate(iso: string): HuntCalendarDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

const NB_MONTHS = [
  "januar",
  "februar",
  "mars",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "desember",
] as const;

const NB_WEEKDAYS = [
  "søndag",
  "mandag",
  "tirsdag",
  "onsdag",
  "torsdag",
  "fredag",
  "lørdag",
] as const;

function calendarDateToUtcMs(d: HuntCalendarDate): number {
  return Date.UTC(d.year, d.month - 1, d.day);
}

export function compareCalendarDates(
  a: HuntCalendarDate,
  b: HuntCalendarDate,
): number {
  return calendarDateToUtcMs(a) - calendarDateToUtcMs(b);
}

export function addCalendarDays(
  d: HuntCalendarDate,
  days: number,
): HuntCalendarDate {
  const dt = new Date(calendarDateToUtcMs(d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

export function isWithinHuntSeason(d: HuntCalendarDate): boolean {
  const start = seasonStartDate(d.year);
  const end = seasonEndDate(d.year);
  return compareCalendarDates(d, start) >= 0 && compareCalendarDates(d, end) <= 0;
}

export function seasonProgress01(d: HuntCalendarDate): number {
  const start = seasonStartDate(d.year);
  const end = seasonEndDate(d.year);
  const total =
    (calendarDateToUtcMs(end) - calendarDateToUtcMs(start)) / 86_400_000;
  const elapsed =
    (calendarDateToUtcMs(d) - calendarDateToUtcMs(start)) / 86_400_000;
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, elapsed / total));
}

/**
 * Mean air temperature for a calendar day through the season.
 * ~15 °C on 10 Sep → ~−18 °C on 23 Dec (noise added in forecast generator).
 */
export function meanSeasonTempC(d: HuntCalendarDate): number {
  const t = seasonProgress01(d);
  return Math.round((15 - t * 33) * 10) / 10;
}

export function formatHuntDateNb(
  d: HuntCalendarDate,
  opts?: { weekday?: boolean },
): string {
  const month = NB_MONTHS[d.month - 1] ?? String(d.month);
  const base = `${d.day}. ${month}`;
  if (!opts?.weekday) return base;
  const wd =
    NB_WEEKDAYS[new Date(calendarDateToUtcMs(d)).getUTCDay()] ?? "";
  return `${wd} ${base}`;
}

export function formatHuntDateShortNb(d: HuntCalendarDate): string {
  return `${d.day}.${String(d.month).padStart(2, "0")}`;
}

/** Up to `count` bookable ISO dates from the next hunt day (within season). */
export function bookableForecastDates(
  nextHuntDateIso: string,
  count = 7,
): string[] {
  const start = parseIsoDate(nextHuntDateIso);
  if (!start) return [];
  const out: string[] = [];
  let d = start;
  for (let i = 0; i < count; i++) {
    if (!isWithinHuntSeason(d)) break;
    out.push(toIsoDate(d));
    d = addCalendarDays(d, 1);
  }
  return out;
}

export function isBookableHuntDate(
  iso: string,
  nextHuntDateIso: string,
): boolean {
  const d = parseIsoDate(iso);
  const next = parseIsoDate(nextHuntDateIso);
  if (!d || !next) return false;
  if (!isWithinHuntSeason(d)) return false;
  if (compareCalendarDates(d, next) < 0) return false;
  const windowEnd = addCalendarDays(next, 6);
  return compareCalendarDates(d, windowEnd) <= 0;
}

/** After a completed hunt — next available calendar day. */
export function nextHuntDateAfter(iso: string): string {
  const d = parseIsoDate(iso);
  if (!d) return defaultNextHuntDateIso();
  const next = addCalendarDays(d, 1);
  if (!isWithinHuntSeason(next)) {
    return toIsoDate(addCalendarDays(seasonEndDate(d.year), 1));
  }
  return toIsoDate(next);
}

export function seasonOpenForHunting(nextHuntDateIso: string): boolean {
  const d = parseIsoDate(nextHuntDateIso);
  if (!d) return false;
  return isWithinHuntSeason(d);
}
