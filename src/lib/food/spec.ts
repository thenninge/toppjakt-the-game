/**
 * Food & cook kit — stamina on hunt trips.
 *
 * Ready food (brød, baguette, boller) restores stamina without a stove.
 * Freeze-dried “Real” turmat needs boiled water → kit must include a
 * burner + gas canister with trips left, or the stamina gain does not fire.
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
   * Stamina restored when used on a trip (0 for stove/fuel).
   * Score-ish 1–10 for meals; ready food is lower than a hot Real meal.
   */
  staminaGain: number;
  /** Freeze-dried / needs boiled water (stove + fuel required). */
  requiresBoil: boolean;
};

export function isCookGear(food: FoodSpec): boolean {
  return food.kind === "stove" || food.kind === "fuel";
}

/** True if kit can boil water for freeze-dried meals. */
export function kitCanBoil(
  foods: FoodSpec[],
): boolean {
  const stove = foods.some((f) => f.kind === "stove");
  const fuel = foods.some((f) => f.kind === "fuel" && f.huntTrips > 0);
  return stove && fuel;
}

/**
 * Effective stamina from a food item given kit boil capability.
 * Boil-required meals return 0 without stove+fuel.
 */
export function effectiveFoodStamina(
  food: FoodSpec,
  canBoil: boolean,
): number {
  if (food.staminaGain <= 0) return 0;
  if (food.requiresBoil && !canBoil) return 0;
  return food.staminaGain;
}
