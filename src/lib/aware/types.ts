/**
 * In-game Aware shell — safety scan, LOS, skuddpar / track.
 * Visual + game logic inspired by the real Aware app; no live GPS/Overpass.
 */

import type { BirdHarvestInput } from "@/lib/hunt/carcass";
import type { HuntGridCell } from "@/lib/hunt/maps";
import type { HuntShotResultKind, HuntShotZone } from "@/lib/hunt/shoot";
import type { FleeObservation } from "@/lib/aware/ettersok";

export type AwareAppMode = "aware" | "shoot" | "track";

export type HabitationCategory =
  | "village"
  | "hamlet"
  | "farm"
  | "isolated_dwelling";

export type HabitationSlice = {
  bearingDeg: number;
  halfAngleDeg: number;
  category: HabitationCategory;
  label: string;
  distanceM: number;
};

export type CellLocalPoint = {
  /** 0–100 within the cell map frame (left→right). */
  x: number;
  /** 0–100 (top→bottom in screen space). */
  y: number;
};

/** Impact fasit on the bird (mm from vital centre) — shown when found. */
export type ShotHitFasit = {
  xMm: number;
  yMm: number;
  diameterMm: number;
  zone: HuntShotZone;
  kind: HuntShotResultKind;
};

export type ShotPair = {
  id: string;
  atMs: number;
  cell: HuntGridCell;
  cellLabel: string;
  stand: CellLocalPoint;
  /**
   * Where the shot was aimed (bird / tree). Drawn on the Aware map with a
   * ~20 m search ring so you can find the tree again from far away.
   */
  target: CellLocalPoint;
  /**
   * Land / fall area after the shot. Same as `target` for kills; for wounded
   * ettersøk this is the (hidden) true land position.
   */
  impact: CellLocalPoint;
  distanceM: number;
  bearingDeg: number;
  resultKind: HuntShotResultKind;
  /** Active / draft søkespor for neste ettersøk. */
  trackPoints: Array<CellLocalPoint & { atMs: number }>;
  /**
   * Completed søkespor from each Ettersøk run — always kept so the player
   * can see where they have already searched.
   */
  searchedTracks?: Array<{
    points: Array<CellLocalPoint & { atMs: number }>;
    atMs: number;
    found: boolean;
  }>;
  /**
   * true = bird/tree recovered.
   * null = still searching (failed attempts do not lock this to false).
   */
  found: boolean | null;
  /** How many 30-min ettersøk sweeps have been run. */
  ettersokAttempts?: number;
  /** Outcome of the latest ettersøk sweep (for UI). */
  lastEttersok?: {
    found: boolean;
    reason: string;
    findChance: number;
    atMs: number;
  };
  /** Wounded flee cue (direction ± optional land distance). */
  fleeObservation?: FleeObservation;
  /** Shot data for Meat Market when ettersøk later finds the bird. */
  harvestDraft?: BirdHarvestInput;
  /** True impact on bird — revealed when the bird/tree is found. */
  hitFasit?: ShotHitFasit;
};

/** Map endpoint for the visible skuddpar (aim point). */
export function shotPairAimPoint(pair: ShotPair): CellLocalPoint {
  return pair.target ?? pair.impact;
}

export type BirdLosReading = {
  /** 0–1: how clearly the bird can see the hunter. */
  birdSeesPlayer: number;
  /** 0–1: how clearly the hunter can see the bird. */
  playerSeesBird: number;
  mutualLos: boolean;
  /** Cover / terrain blocking factor 0–1 (1 = fully screened). */
  coverFactor: number;
};

export const HABITATION_LABELS: Record<HabitationCategory, string> = {
  village: "Landsby",
  hamlet: "Grend",
  farm: "Gård",
  isolated_dwelling: "Enkeltbolig",
};

export const HABITATION_COLORS: Record<HabitationCategory, string> = {
  village: "rgba(220, 60, 40, 0.62)",
  hamlet: "rgba(230, 120, 40, 0.55)",
  farm: "rgba(220, 180, 50, 0.5)",
  isolated_dwelling: "rgba(200, 160, 70, 0.45)",
};
