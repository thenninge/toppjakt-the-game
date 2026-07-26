/**
 * Skis / snowshoes / ski boots — winter travel over snow with a hunting kit.
 *
 * Score10: higher is always better.
 * - Boards: maxSpeed, flowPerKg, widthMm
 * - Boots (isBoots): terrainSpeed / stamina reused via maxSpeed / flowPerKg display
 *
 * Width (mm): wide boards float in deep snow with a heavy pack.
 * Ski boots are required when skis (boards) are in the kit.
 */

import type { Score10 } from "@/lib/shop/score";

export type SkiKitSlot = "boards" | "boots";

export type SkiSpec = {
  /** 1–10. Boards: top speed on firm snow. Boots: terrain speed. */
  maxSpeed: Score10;
  /** 1–10. Boards: flow per kg. Boots: stamina. */
  flowPerKg: Score10;
  /** Approximate tip/waist width (mm). 0 for boots. */
  widthMm: number;
  /** Ski boots — exclusive vs other boots; can pack with boards. */
  isBoots?: boolean;
};

export function skiKitSlot(ski: SkiSpec): SkiKitSlot {
  return ski.isBoots ? "boots" : "boards";
}

export function isSkiBootsSpec(ski: SkiSpec): boolean {
  return !!ski.isBoots;
}
