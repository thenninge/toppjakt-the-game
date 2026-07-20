/**
 * In-game Aware shell — safety scan, LOS, skuddpar / track.
 * Visual + game logic inspired by the real Aware app; no live GPS/Overpass.
 */

import type { BirdHarvestInput } from "@/lib/hunt/carcass";
import type { HuntGridCell } from "@/lib/hunt/maps";
import type { HuntShotResultKind } from "@/lib/hunt/shoot";

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

export type ShotPair = {
  id: string;
  atMs: number;
  cell: HuntGridCell;
  cellLabel: string;
  stand: CellLocalPoint;
  /** Estimated impact / fall area in cell coords. */
  impact: CellLocalPoint;
  distanceM: number;
  bearingDeg: number;
  resultKind: HuntShotResultKind;
  trackPoints: Array<CellLocalPoint & { atMs: number }>;
  /** null = not searched yet */
  found: boolean | null;
  /** Shot data for Meat Market when ettersøk later finds the bird. */
  harvestDraft?: BirdHarvestInput;
};

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
