/**
 * Barrel heat on the shooting range — mirage from a hot pipe.
 *
 * Heat rises per shot, cools over time (weather + fluting modify rate).
 * Mirage visible from 25 % heat; mid ≈ heat × 2 × gear, ±30 % swing.
 */

import type { InstalledCustomBarrel, CustomBarrelConfig } from "@/lib/customs/customBarrel";

export const BARREL_HEAT_DEFAULT_SHOT_PCT = 5;
export const BARREL_HEAT_VARMINT_SHOT_PCT = 3.5;
export const BARREL_HEAT_CARBON_SHOT_PCT = 1.5;
export const BARREL_HEAT_DEFAULT_COOL_PCT = 1;
export const BARREL_HEAT_FLUTED_COOL_PCT = 2;

/** Min OD (mm) — never below this → varmint heat class (3.5%/shot). */
export const VARMINT_MIN_DIAMETER_MM = 19;

/** Factory rifles treated as varmint contour. */
export const VARMINT_FACTORY_RIFLE_IDS = new Set([
  "rifle-tikka-t3x-super-varminter",
]);

export type BarrelHeatProfile = {
  /** Heat added per shot (percent points, 0–100 scale). */
  heatPerShotPct: number;
  /** Base cool per second before weather (percent points). */
  coolPerSecPct: number;
  /** Short class label for UI. */
  classLabel: string;
  fluted: boolean;
  isCarbon: boolean;
  isVarmintClass: boolean;
  /** Steel profile min OD, or null. */
  minDiameterMm: number | null;
};

export function minStationDiameterMm(
  stations: { diameterMm: number }[],
): number | null {
  if (!stations.length) return null;
  let min = Infinity;
  for (const s of stations) {
    if (Number.isFinite(s.diameterMm)) min = Math.min(min, s.diameterMm);
  }
  return Number.isFinite(min) ? min : null;
}

/** Weather multiplier on cool rate: −20 °C → 1.3×, +20 °C → 0.7×. */
export function weatherCoolMult(temperatureC: number): number {
  if (!Number.isFinite(temperatureC)) return 1;
  return Math.max(0.5, Math.min(1.5, 1 - 0.015 * temperatureC));
}

export function barrelHeatFromCustomConfig(
  config: CustomBarrelConfig,
): BarrelHeatProfile {
  const fluted = !!config.fluted && config.material !== "carbon";
  if (config.material === "carbon") {
    return {
      heatPerShotPct: BARREL_HEAT_CARBON_SHOT_PCT,
      coolPerSecPct: BARREL_HEAT_DEFAULT_COOL_PCT,
      classLabel: "Carbon",
      fluted: false,
      isCarbon: true,
      isVarmintClass: false,
      minDiameterMm: null,
    };
  }
  const minD = minStationDiameterMm(config.stations);
  const isVarmintClass =
    minD != null && minD >= VARMINT_MIN_DIAMETER_MM - 1e-6;
  const heatPerShotPct = isVarmintClass
    ? BARREL_HEAT_VARMINT_SHOT_PCT
    : BARREL_HEAT_DEFAULT_SHOT_PCT;
  const coolPerSecPct = fluted
    ? BARREL_HEAT_FLUTED_COOL_PCT
    : BARREL_HEAT_DEFAULT_COOL_PCT;
  return {
    heatPerShotPct,
    coolPerSecPct,
    classLabel: isVarmintClass
      ? fluted
        ? "Varmint · fluted"
        : "Varmint"
      : fluted
        ? "Standard · fluted"
        : "Standard",
    fluted,
    isCarbon: false,
    isVarmintClass,
    minDiameterMm: minD,
  };
}

export function barrelHeatForRifle(
  rifleId: string | null | undefined,
  custom: InstalledCustomBarrel | null | undefined,
): BarrelHeatProfile {
  if (custom) return barrelHeatFromCustomConfig(custom);
  if (rifleId && VARMINT_FACTORY_RIFLE_IDS.has(rifleId)) {
    return {
      heatPerShotPct: BARREL_HEAT_VARMINT_SHOT_PCT,
      coolPerSecPct: BARREL_HEAT_DEFAULT_COOL_PCT,
      classLabel: "Varmint (fabrikk)",
      fluted: false,
      isCarbon: false,
      isVarmintClass: true,
      minDiameterMm: null,
    };
  }
  return {
    heatPerShotPct: BARREL_HEAT_DEFAULT_SHOT_PCT,
    coolPerSecPct: BARREL_HEAT_DEFAULT_COOL_PCT,
    classLabel: "Standard",
    fluted: false,
    isCarbon: false,
    isVarmintClass: false,
    minDiameterMm: null,
  };
}

/** Effective cool %/s at current air temp (optional gear cool multiplier). */
export function effectiveCoolPerSecPct(
  profile: BarrelHeatProfile,
  temperatureC: number,
  /** e.g. 2 with Magnetospeed RifleKuhl. */
  gearCoolMult = 1,
): number {
  const mult = Number.isFinite(gearCoolMult) && gearCoolMult > 0 ? gearCoolMult : 1;
  return (
    Math.round(
      profile.coolPerSecPct * weatherCoolMult(temperatureC) * mult * 100,
    ) / 100
  );
}

/** Heat fraction where mirage becomes visible. */
export const MIRAGE_VISIBLE_FROM_HEAT = 0.25;

/** Mirage midpoint gain vs heat (2 = double; full-hot mid ≈ 2). */
export const MIRAGE_HEAT_GAIN = 2;

/**
 * Mirage midpoint from barrel heat.
 * Visible from {@link MIRAGE_VISIBLE_FROM_HEAT}; mid = heat × {@link MIRAGE_HEAT_GAIN} × gear.
 * Live strength swings ±30 % around mid via {@link mirageStrengthAtTime}.
 * Baseline (no bare-muzzle cut) is *with* suppressor; without can: ×0.6.
 * Fan removes 70%.
 */
export function mirageFromBarrelHeat(
  heat01: number,
  opts: {
    fanOn?: boolean;
    /** Current mirage numbers assume a can — bare muzzle is milder. */
    hasSuppressor?: boolean;
    /**
     * Extra gear multiplier (mirage band / suppressor covers).
     * Applied after suppressor/fan. Default 1.
     */
    gearMirageMult?: number;
  } = {},
): number {
  const h = Math.max(0, Math.min(1, heat01));
  if (h < MIRAGE_VISIBLE_FROM_HEAT) return 0;
  let mid = h * MIRAGE_HEAT_GAIN;
  if (!opts.hasSuppressor) mid *= 0.6;
  if (opts.fanOn) mid *= 0.3;
  const gear =
    opts.gearMirageMult != null &&
    Number.isFinite(opts.gearMirageMult) &&
    opts.gearMirageMult > 0
      ? opts.gearMirageMult
      : 1;
  return mid * gear;
}

export function formatBarrelHeatPreview(
  profile: BarrelHeatProfile,
  temperatureC = 10,
): string {
  const cool = effectiveCoolPerSecPct(profile, temperatureC);
  return `${profile.heatPerShotPct} %/skudd · kjøling ~${cool.toFixed(1)} %/s @ ${temperatureC.toFixed(0)}°C (${profile.classLabel})`;
}

/**
 * Dual-state barrel heat: shots bump {@link target01}; displayed
 * {@link heat01} eases toward it (fast rise that softens into the target).
 */
export type BarrelHeatState = {
  heat01: number;
  target01: number;
};

export function createBarrelHeatState(): BarrelHeatState {
  return { heat01: 0, target01: 0 };
}

/**
 * Catch-up rate (1/s) toward target — ~90 % of a step in ~0.5 s.
 * Feels like a quick surge that settles, not an instant jump.
 */
export const BARREL_HEAT_CATCHUP_PER_SEC = 4.5;

/** Shot: raise the asymptote; display heat catches up on the next ticks. */
export function bumpBarrelHeatTarget(
  state: BarrelHeatState,
  profile: BarrelHeatProfile,
): BarrelHeatState {
  return {
    heat01: state.heat01,
    target01: Math.min(1, state.target01 + profile.heatPerShotPct / 100),
  };
}

/**
 * Per-frame: cool the target, ease displayed heat toward it.
 */
export function tickBarrelHeat(
  state: BarrelHeatState,
  profile: BarrelHeatProfile,
  temperatureC: number,
  dtSec: number,
  gearCoolMult = 1,
): BarrelHeatState {
  if (dtSec <= 0) return state;
  const cool =
    (effectiveCoolPerSecPct(profile, temperatureC, gearCoolMult) / 100) *
    dtSec;
  const target01 = Math.max(0, state.target01 - cool);
  const catchup = 1 - Math.exp(-BARREL_HEAT_CATCHUP_PER_SEC * dtSec);
  const heat01 = Math.max(
    0,
    Math.min(1, state.heat01 + (target01 - state.heat01) * catchup),
  );
  return { heat01, target01 };
}

/** @deprecated Prefer {@link bumpBarrelHeatTarget} + {@link tickBarrelHeat}. */
export function applyBarrelHeatShot(
  heat01: number,
  profile: BarrelHeatProfile,
): number {
  return Math.min(1, heat01 + profile.heatPerShotPct / 100);
}

/** @deprecated Prefer {@link tickBarrelHeat}. */
export function applyBarrelHeatCool(
  heat01: number,
  profile: BarrelHeatProfile,
  temperatureC: number,
  dtSec: number,
): number {
  if (dtSec <= 0 || heat01 <= 0) return Math.max(0, heat01);
  const cool = (effectiveCoolPerSecPct(profile, temperatureC) / 100) * dtSec;
  return Math.max(0, heat01 - cool);
}
