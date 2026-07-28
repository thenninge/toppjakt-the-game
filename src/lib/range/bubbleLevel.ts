/**
 * Bubble-level kit resolution — visual variants share cant wiring.
 */

import type { MiscSpec } from "@/lib/misc/spec";
import { isMiscItem, type ShopItem } from "@/lib/shop/types";

/** Catalog visual ids — add new skins here, keep cant math shared. */
export type BubbleLevelVisualId = "ulf";

export type BubbleLevelKit = {
  itemId: string;
  brand: string;
  name: string;
  visualId: BubbleLevelVisualId;
};

export function bubbleLevelVisualId(
  misc: MiscSpec | null | undefined,
): BubbleLevelVisualId | null {
  if (!misc?.isBubbleLevel) return null;
  const v = misc.bubbleLevelVisual;
  if (v === "ulf") return v;
  return "ulf";
}

export function resolveBubbleLevelFromKit(
  kitItems: readonly ShopItem[],
): BubbleLevelKit | null {
  for (const item of kitItems) {
    if (!isMiscItem(item)) continue;
    const visualId = bubbleLevelVisualId(item.misc);
    if (!visualId) continue;
    return {
      itemId: item.id,
      brand: item.brand,
      name: item.name,
      visualId,
    };
  }
  return null;
}
