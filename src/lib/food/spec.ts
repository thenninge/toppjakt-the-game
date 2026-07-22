/**
 * Food & cook kit — body/mind recovery on hunt trips.
 *
 * Ready food works cold. Freeze-dried “Real” needs boiled water
 * (stove + gas in kit).
 */

export type FoodKind = "stove" | "fuel" | "meal" | "ready";

export type FoodSpec = {
  kind: FoodKind;
  /**
   * How many hunt trips this pack lasts before empty.
   * Stove gear uses a high number (durable).
   */
  huntTrips: number;
  /**
   * Legacy shop hint (1–10). Prefer bodyGain / mindGain for hunt effects.
   */
  staminaGain: number;
  /** Physical stamina restored (0–1 of full bar). */
  bodyGain: number;
  /** Mental stamina restored (0–1 of full bar). */
  mindGain: number;
  /** Game minutes spent eating / preparing. */
  minutes: number;
  /** Freeze-dried / needs boiled water (stove + fuel required). */
  requiresBoil: boolean;
};

export function isCookGear(food: FoodSpec): boolean {
  return food.kind === "stove" || food.kind === "fuel";
}

/** True if kit can boil water for freeze-dried meals. */
export function kitCanBoil(foods: FoodSpec[]): boolean {
  const stove = foods.some((f) => f.kind === "stove");
  const fuel = foods.some((f) => f.kind === "fuel" && f.huntTrips > 0);
  return stove && fuel;
}

export type FoodRecovery = {
  bodyGain: number;
  mindGain: number;
  minutes: number;
};

/**
 * Effective recovery from a food item given kit boil capability.
 * Boil-required meals return null without stove+fuel.
 */
export function effectiveFoodRecovery(
  food: FoodSpec,
  canBoil: boolean,
): FoodRecovery | null {
  if (food.kind === "stove" || food.kind === "fuel") return null;
  if (food.bodyGain <= 0 && food.mindGain <= 0) return null;
  if (food.requiresBoil && !canBoil) return null;
  return {
    bodyGain: food.bodyGain,
    mindGain: food.mindGain,
    minutes: Math.max(1, food.minutes),
  };
}

/** @deprecated Prefer effectiveFoodRecovery. */
export function effectiveFoodStamina(
  food: FoodSpec,
  canBoil: boolean,
): number {
  const rec = effectiveFoodRecovery(food, canBoil);
  if (!rec) return 0;
  return food.staminaGain;
}

export function formatStaminaPct(gain: number): string {
  if (gain <= 0) return "0%";
  return `${Math.round(gain * 100)}%`;
}

/** Jula thermos — enables coffee cup on hunt. */
export const THERMOS_ITEM_ID = "misc-thermos-jula";

export const COFFEE_RECOVERY: FoodRecovery & { label: string } = {
  label: "Kaffekopp (termos)",
  bodyGain: 0.05,
  mindGain: 0.15,
  minutes: 5,
};

/** Short sit-down rest — no fire, does not flush birds. */
export const SHORT_REST_RECOVERY: FoodRecovery & { label: string } = {
  label: "Rest for 10 minutes",
  bodyGain: 0.12,
  mindGain: 0.15,
  minutes: 10,
};

export const TYRIBAL_RECOVERY = {
  label: "Tyribål!",
  /** Shown on the eat/rest option — fire clears the cell. */
  note: "Skremmer all fugl fra cellen du står i.",
  bodyGain: 0.3,
  mindToFull: true as const,
  minutes: 45,
};
