/**
 * Skis / snowshoes — winter travel over snow with a hunting kit.
 *
 * Score10: higher is always better.
 * - maxSpeed: top pace on firm / packed snow
 * - flowPerKg: how well the ski “carries” kit weight (less bogging per kg)
 *
 * Width (mm): wide boards float in deep snow with a heavy pack; skinny
 * “joggepinner” are fast on crust but sink with a full sekk.
 */

import type { Score10 } from "@/lib/shop/score";

export type SkiSpec = {
  /** 1–10. Higher = higher top speed on firm / packed snow. */
  maxSpeed: Score10;
  /** 1–10. Higher = better flow / less drag per kg of kit. */
  flowPerKg: Score10;
  /** Approximate tip/waist width (mm). Wide helps deep snow + heavy pack. */
  widthMm: number;
};
