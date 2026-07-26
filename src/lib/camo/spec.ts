/**
 * Camouflage & apparel — additive % mods on hunt systems.
 *
 * Kit exclusivity is per slot (one jacket, one boots…). Ghillie (`suit`)
 * is exclusive against jacket and pants (enforced in kit toggle).
 *
 * Stats are percent-of-current:
 * - sneakPct → bird nerve rate × (1 − sum/100)
 * - speedPct → travel time × 1/(1 + sum/100)  (−10 → +11 % tid)
 * - focusPct → caution prespot × (1 + sum/100); mind drain × (1 − sum/100)
 * - recoveryPct → rest/pause Body gain × (1 + sum/100)  (kan være negativ)
 */

export type CamoTerrain =
  | "snow"
  | "snow_broken"
  | "autumn_forest"
  | "pine_forest"
  | "open_mountain"
  | "bog_heath"
  | "general";

export type CamoSlot =
  | "suit"
  | "jacket"
  | "pants"
  | "vest"
  | "down"
  | "base_layer"
  | "socks"
  | "buff"
  | "beanie"
  | "cap"
  | "gloves"
  | "boots"
  | "ski_boots";

export type CamoSpec = {
  /** % reduction on bird nerve rate. Higher = sneakier. */
  sneakPct: number;
  /** % change to field walking speed. Higher = faster (negative = slower). */
  speedPct: number;
  /** % boost to caution prespot + mind-drain reduction. */
  focusPct: number;
  /** % change to Body recovery on rest/pause (can be negative). */
  recoveryPct: number;
  /** Terrains where this pattern is intended (season / coaching). */
  bestTerrains: CamoTerrain[];
  /**
   * If false, item exists in game data but cannot be bought in XXL.
   * @default true
   */
  availableInShop?: boolean;
  /** Kit slot — one item per slot. */
  slot: CamoSlot;
};

export function camoSlot(camo: CamoSpec): CamoSlot {
  return camo.slot ?? "suit";
}

/**
 * Apparel worn on the body — excluded from pack/kit carry weight.
 * Vest + down stay in the sekk and still count.
 */
const BODY_WORN_CAMO_SLOTS: ReadonlySet<CamoSlot> = new Set([
  "jacket",
  "pants",
  "socks",
  "gloves",
  "base_layer",
]);

export function isBodyWornCamoSlot(slot: CamoSlot): boolean {
  return BODY_WORN_CAMO_SLOTS.has(slot);
}

/** True if this camo piece is worn on the body (not carried in the pack). */
export function isBodyWornCamo(camo: CamoSpec): boolean {
  return isBodyWornCamoSlot(camoSlot(camo));
}

/** Sum of one clothing % stat across equipped camo pieces. */
export function kitCamoStatSum(
  pieces: CamoSpec[],
  key: "sneakPct" | "speedPct" | "focusPct" | "recoveryPct",
): number {
  return pieces.reduce((sum, p) => sum + (p[key] ?? 0), 0);
}

/** Bird nerve rate multiplier from sneak %. 10 → ×0.9. */
export function clothingNerveMult(sneakPct: number): number {
  return Math.max(0, 1 - sneakPct / 100);
}

/**
 * Travel time multiplier from speed %.
 * −10 → ×≈1.111 (30 min → 33); +8 → ×≈0.926.
 */
export function clothingTravelTimeMult(speedPct: number): number {
  const speedFactor = 1 + speedPct / 100;
  if (speedFactor <= 0.05) return 20;
  return 1 / speedFactor;
}

/** Prespot chance multiplier from focus %. 3 → ×1.03. */
export function clothingPrespotMult(focusPct: number): number {
  return 1 + focusPct / 100;
}

/** Mind-drain multiplier from focus %. 3 → ×0.97. */
export function clothingMindDrainMult(focusPct: number): number {
  return Math.max(0, 1 - focusPct / 100);
}

/** Rest/pause Body gain from recovery %. −2 → ×0.98; +8 → ×1.08. */
export function clothingRestBodyGain(
  baseBodyGain: number,
  recoveryPct: number,
): number {
  return baseBodyGain * (1 + recoveryPct / 100);
}

/** Score10 from sneak % sum for Home overview (0 → 1, ~35 → 10). */
export function sneakPctToScore(sneakPct: number): number {
  const raw = 1 + (Math.max(0, sneakPct) / 35) * 9;
  return Math.max(1, Math.min(10, Math.round(raw)));
}
