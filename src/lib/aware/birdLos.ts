/**
 * LOS between hunter and bird — drives mutual visibility and nerves.
 */

import { coverFactorForCell } from "@/lib/aware/cellSafety";
import type { BirdLosReading } from "@/lib/aware/types";
import type { HuntGridCell, HuntMapId } from "@/lib/hunt/maps";

/**
 * Simplified mutual LOS for the encounter.
 * Closer + less cover → bird sees you more (and you see it better with LOS on).
 */
export function evaluateBirdLos(opts: {
  mapId: HuntMapId;
  cell: HuntGridCell;
  distanceM: number;
  /** Player has LOS tool active in Aware. */
  losActive: boolean;
  /** Seconds spent exposed with LOS / in the open this contact. */
  exposedSec?: number;
}): BirdLosReading {
  const cover = coverFactorForCell(opts.mapId, opts.cell);
  const distFactor = Math.max(0.15, Math.min(1, 450 / Math.max(80, opts.distanceM)));
  // Bird’s eye: cover helps you; proximity hurts.
  const birdSees = Math.max(
    0,
    Math.min(1, (1 - cover * 0.85) * distFactor * (opts.losActive ? 1.05 : 0.9)),
  );
  // Player LOS tool improves their own view of the bird.
  const playerSees = opts.losActive
    ? Math.max(0, Math.min(1, (1 - cover * 0.5) * distFactor))
    : Math.max(0, Math.min(1, (1 - cover * 0.75) * distFactor * 0.55));

  const mutualLos = birdSees > 0.35 && playerSees > 0.25;

  return {
    birdSeesPlayer: birdSees,
    playerSeesBird: playerSees,
    mutualLos,
    coverFactor: cover,
  };
}

/**
 * Extra nervousness per second of *game* time while the bird can see you.
 * Kept low so the player can actually use Aware (Scan / LOS / peiling)
 * before a flush — ~20× gentler than the first pass.
 */
export function losNerveRatePerSec(birdSeesPlayer: number): number {
  if (birdSeesPlayer < 0.2) return 0.00025;
  if (birdSeesPlayer < 0.45) return 0.00125;
  if (birdSeesPlayer < 0.7) return 0.00275;
  return 0.0045;
}
