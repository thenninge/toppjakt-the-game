/**
 * Per-map forced spotting scenes — certain hunt cells always open a fixed
 * spot image (with its perch set) instead of the random deck.
 *
 * Those images are reserved from the shared without-replacement spotting
 * pool: they must not be dealt randomly to other cells in the same deck
 * cycle (until the pool is exhausted and reshuffled).
 */

import type { HuntGridCell, HuntMapId } from "@/lib/hunt/maps";

/** `${row},${col}` → public spot image path. */
type CellSpotMap = Readonly<Record<string, string>>;

/**
 * Sandbekken (`cloud_sandbekken`):
 *   D2 → spot23 · C2 → spot22 · D3 → spot4 · C3 → spot18 · A3 → spot3
 *   B1 → spotting8b · C4 → spotting6b · A2 → spotting5b
 */
const SANDBEKKEN_FORCED: CellSpotMap = {
  "3,1": "/images/spot/spot23.png", // D2
  "2,1": "/images/spot/spot22.png", // C2
  "3,2": "/images/spot/spot4.png", // D3
  "2,2": "/images/spot/spot18.png", // C3
  "0,2": "/images/spot/spot3.png", // A3
  "1,0": "/images/spot/batchB/spotting8b.png", // B1
  "2,3": "/images/spot/batchB/spotting6b.png", // C4
  "0,1": "/images/spot/batchB/spotting5b.png", // A2
};

const FORCED_SPOT_BY_MAP: Partial<Record<string, CellSpotMap>> = {
  cloud_sandbekken: SANDBEKKEN_FORCED,
};

function cellKey(cell: HuntGridCell): string {
  return `${cell.row},${cell.col}`;
}

/** Fixed spotting image for this map cell, or null for random deck. */
export function forcedSpotImageForCell(
  mapId: HuntMapId | string | null | undefined,
  cell: HuntGridCell,
): string | null {
  if (!mapId) return null;
  return FORCED_SPOT_BY_MAP[mapId]?.[cellKey(cell)] ?? null;
}

/** Unique forced spot images reserved on this map. */
export function forcedSpotImagesForMap(
  mapId: HuntMapId | string | null | undefined,
): readonly string[] {
  if (!mapId) return [];
  const cells = FORCED_SPOT_BY_MAP[mapId];
  if (!cells) return [];
  return [...new Set(Object.values(cells))];
}

/** Remove every occurrence of `src` from a mutable without-replacement deck. */
export function removeSpotImageFromDeck(deck: string[], src: string): void {
  for (let i = deck.length - 1; i >= 0; i -= 1) {
    if (deck[i] === src) deck.splice(i, 1);
  }
}
