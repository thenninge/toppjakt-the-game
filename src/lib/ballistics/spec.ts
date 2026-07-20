/**
 * Handheld ballistics / weather meters (Kestrel, ACE, budget anemometers).
 *
 * ## Why buy a Kestrel if LRF has AB?
 * Onboard LRF ballistics typically pull **weather forecast** (temp, density,
 * wind) — larger ±% error, and **no true crosswind**. They often give
 * full-value windage (assume wind from 90°).
 *
 * A Kestrel (or similar anemometer) measures **local** wind → real crosswind
 * for the shot bearing. Smaller wind error than forecast.
 */

import type { Score10 } from "@/lib/shop/score";

export type BallisticsSpec = {
  /**
   * True if the unit has an anemometer / can sample local wind for
   * real crosswind (not forecast full-value).
   */
  measuresCrosswind: boolean;
  /**
   * ±% error on wind speed when this device is the wind source.
   * Kestrel Elite ≈ 3; budget ≈ 12–18; forecast-fed path is worse (see weather).
   */
  windErrorPercent: number;
  /**
   * ± error on temperature reading (°C). Affects density / solver.
   */
  tempErrorC: number;
  /** 1–10 shop score — higher = better readings / solver trust. */
  readingAccuracy: Score10;
  /** Short solver label if any (AB, GeoBallistics, …). */
  solver?: string;
};

/** Forecast-fed LRF/AB path (no handheld meter) — worse than Kestrel. */
export const FORECAST_SOLVER_WIND_ERROR_PERCENT = 18;
export const FORECAST_SOLVER_TEMP_ERROR_C = 2;
