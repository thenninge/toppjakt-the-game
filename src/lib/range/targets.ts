/**
 * Zeroing-lane skyteskiver — assets + paper calibration (bullseye, mm↔px).
 *
 * Impact / aim coords are physical mm on the paper. Calibrate {@link pxPerMm}
 * from the **printed thin grid** only (1 cm or 2 cm squares on the PNG) —
 * never from “Dot 0.5 mrad” diamond tip-to-tip (that label is angular at
 * distance, not paper millimetres) and never by counting every other line.
 *
 * `visualScale` enlarges the board in the scope (angular size); it does not
 * replace {@link pxPerMm} for hole / aim placement on the texture.
 */

import type { RangeDistanceM } from "@/lib/range/precision";
import { RANGE_DISTANCES_M } from "@/lib/range/precision";

export type RangeTargetId =
  | "cba-100"
  | "tracking-test"
  | "target-200"
  | "target-300"
  | "target-400"
  | "target-500";

export type RangeTargetDef = {
  id: RangeTargetId;
  label: string;
  /** Compact label for the skive picker. */
  shortLabel: string;
  src: string;
  nativeWidth: number;
  nativeHeight: number;
  bullseyeXPx: number;
  bullseyeYPx: number;
  /** Native pixels per physical millimetre on the paper (windage / X). */
  pxPerMm: number;
  /**
   * Optional separate Y calibration (elevation). When omitted, use {@link pxPerMm}.
   * Tracking template has slightly different V/H red-line spacing.
   */
  pxPerMmY?: number;
  /**
   * Extra display scale in the scope (1 = asset as-is).
   * Used when the PNG under-represents real board angular size.
   */
  visualScale: number;
};

/**
 * CBA detail (cba-detail.png). Admin-calibrated from printed grid.
 * Note: reticle 1 mil ↔ diamond tip still uses the separate CBA tip contract
 * in precision.ts — keep pxPerMm coherent with that if dial/hash must match tip.
 */
export const RANGE_TARGETS: Record<RangeTargetId, RangeTargetDef> = {
  "cba-100": {
    id: "cba-100",
    label: "CBA 100 m",
    shortLabel: "CBA",
    src: "/range/cba-detail.png",
    nativeWidth: 949,
    nativeHeight: 1024,
    bullseyeXPx: 485.6,
    bullseyeYPx: 538.4,
    pxPerMm: 13.036,
    visualScale: 1,
  },
  /**
   * Tracking test template @ 100 m — 1 cm grid (= 0.1 mrad / 1 click).
   * Origin (0) = top centre cross (vertical 0 × top horizontal).
   * Labels 5R/5L/5U/… are in 0.1 mrad clicks (5R = 5 cm = 0.5 mrad), not full mils.
   * Windage: 5R↔5L = 353 px / 100 mm. Elevation: 5-click step ≈ 182 px / 50 mm.
   * Perfect MRAD scope: 5 clicks → 5U/5R; 20 clicks → 20U.
   */
  "tracking-test": {
    id: "tracking-test",
    label: "Tracking test 100 m",
    shortLabel: "Track",
    src: "/range/tracking-test.jpg",
    nativeWidth: 724,
    nativeHeight: 1024,
    bullseyeXPx: 359.5,
    bullseyeYPx: 690.8,
    pxPerMm: 3.547,
/** Readable board; reticle uses true-mil scale on this lane (see reticles). */
    visualScale: 2,
  },
  /**
   * target200.png — thin dotted 2 cm grid ≈ 60 px.
   */
  "target-200": {
    id: "target-200",
    label: "200 m-skive",
    shortLabel: "200",
    src: "/range/target200.png",
    nativeWidth: 646,
    nativeHeight: 554,
    bullseyeXPx: 327.6,
    bullseyeYPx: 270.8,
    pxPerMm: 3.047,
    visualScale: 2,
  },
  /**
   * target300.png — thin dotted 2 cm grid ≈ 67 px.
   * Do not use “Dot 0.5 mrad” tip-to-tip as mm.
   */
  "target-300": {
    id: "target-300",
    label: "300 m-skive",
    shortLabel: "300",
    src: "/range/target300.png",
    nativeWidth: 1852,
    nativeHeight: 1312,
    bullseyeXPx: 928.2,
    bullseyeYPx: 655.7,
    pxPerMm: 6.551,
    pxPerMmY: 6.572,
    visualScale: 2,
  },
  /**
   * target400.png — thin dotted 2 cm grid ≈ 89.5 px.
   */
  "target-400": {
    id: "target-400",
    label: "400 m-skive",
    shortLabel: "400",
    src: "/range/target400.png",
    nativeWidth: 1241,
    nativeHeight: 874,
    bullseyeXPx: 623.3,
    bullseyeYPx: 436.4,
    pxPerMm: 89.5 / 20,
    visualScale: 2.84,
  },
  /**
   * target500.png — thin dotted 2 cm grid ≈ 133 px (H) / 129 px (V).
   * 88 px was a half-feature mis-read (~1.5× too few px/mm).
   */
  "target-500": {
    id: "target-500",
    label: "500 m-skive",
    shortLabel: "500",
    src: "/range/target500.png",
    nativeWidth: 1852,
    nativeHeight: 1312,
    bullseyeXPx: 925.4,
    bullseyeYPx: 656.4,
    pxPerMm: 6.578,
    pxPerMmY: 6.551,
    visualScale: 2,
  },
};

export const RANGE_TARGET_IDS = Object.keys(RANGE_TARGETS) as RangeTargetId[];

/** Default skive for each lane distance. */
export const DEFAULT_TARGET_BY_DISTANCE: Record<RangeDistanceM, RangeTargetId> = {
  100: "cba-100",
  200: "target-200",
  300: "target-300",
  400: "target-400",
  500: "target-500",
};

/**
 * Pick default skive for any distance 100–1000 m (nearest calibrated preset).
 */
export function defaultTargetIdForDistanceM(distanceM: number): RangeTargetId {
  const d = Number.isFinite(distanceM) ? distanceM : 100;
  let best: RangeDistanceM = 100;
  let bestDiff = Infinity;
  for (const p of RANGE_DISTANCES_M) {
    const diff = Math.abs(p - d);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = p;
    }
  }
  return DEFAULT_TARGET_BY_DISTANCE[best];
}

export function getRangeTarget(id: RangeTargetId): RangeTargetDef {
  return RANGE_TARGETS[id];
}

export function defaultTargetIdForDistance(distanceM: RangeDistanceM): RangeTargetId {
  return DEFAULT_TARGET_BY_DISTANCE[distanceM];
}

export function targetPxPerMm(
  target: RangeTargetDef,
  imageWidthPx: number = target.nativeWidth,
): number {
  return target.pxPerMm * (imageWidthPx / target.nativeWidth);
}

export function targetPxPerMmY(
  target: RangeTargetDef,
  imageHeightPx: number = target.nativeHeight,
): number {
  const ppm = target.pxPerMmY ?? target.pxPerMm;
  return ppm * (imageHeightPx / target.nativeHeight);
}

export function mmToPxOnTarget(
  mm: number,
  target: RangeTargetDef,
  imageWidthPx: number = target.nativeWidth,
): number {
  return mm * targetPxPerMm(target, imageWidthPx);
}

/** Windage (X) — native / rendered width basis. */
export function mmToPxOnTargetX(
  mm: number,
  target: RangeTargetDef,
  imageWidthPx: number = target.nativeWidth,
): number {
  return mm * targetPxPerMm(target, imageWidthPx);
}

/** Elevation (Y) — uses {@link RangeTargetDef.pxPerMmY} when set. */
export function mmToPxOnTargetY(
  mm: number,
  target: RangeTargetDef,
  imageHeightPx: number = target.nativeHeight,
): number {
  return mm * targetPxPerMmY(target, imageHeightPx);
}

/** Offset from image centre (50%/50%) to bullseye, in rendered pixel space. */
export function targetBullseyeOffsetFromImageCenterPx(
  target: RangeTargetDef,
  imageWidthPx: number = target.nativeWidth,
  imageHeightPx: number = target.nativeHeight,
): { x: number; y: number } {
  const sx = imageWidthPx / target.nativeWidth;
  const sy = imageHeightPx / target.nativeHeight;
  return {
    x: (target.bullseyeXPx - target.nativeWidth / 2) * sx,
    y: (target.bullseyeYPx - target.nativeHeight / 2) * sy,
  };
}

export function targetBullseyePx(
  target: RangeTargetDef,
  imageWidthPx: number = target.nativeWidth,
  imageHeightPx: number = target.nativeHeight,
): { x: number; y: number } {
  const o = targetBullseyeOffsetFromImageCenterPx(
    target,
    imageWidthPx,
    imageHeightPx,
  );
  return {
    x: imageWidthPx / 2 + o.x,
    y: imageHeightPx / 2 + o.y,
  };
}
