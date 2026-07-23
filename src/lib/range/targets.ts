/**
 * Zeroing-lane skyteskiver — assets + paper calibration (bullseye, mm↔px).
 *
 * Impact / aim coords are physical mm on the paper. Each PNG has its own
 * px/mm from printed grid or labeled angular size at the design distance.
 * `visualScale` enlarges the board in the scope so angular size matches reality.
 */

import type { RangeDistanceM } from "@/lib/range/precision";

export type RangeTargetId =
  | "cba-100"
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
  /** Native pixels per physical millimetre on the paper. */
  pxPerMm: number;
  /**
   * Extra display scale in the scope (1 = asset as-is).
   * Used when the PNG under-represents real board angular size.
   */
  visualScale: number;
};

/**
 * CBA detail (cba-detail.png): diamond tip 10 mm = 115 px.
 * Bullseye measured on asset (not geometric centre).
 */
export const RANGE_TARGETS: Record<RangeTargetId, RangeTargetDef> = {
  "cba-100": {
    id: "cba-100",
    label: "CBA 100 m",
    shortLabel: "CBA",
    src: "/range/cba-detail.png",
    nativeWidth: 949,
    nativeHeight: 1024,
    bullseyeXPx: 487,
    bullseyeYPx: 538,
    pxPerMm: 115 / 10,
    visualScale: 1,
  },
  /**
   * target200.png — dotted grid ≈ 60.5 px ≈ 2 cm; ×2 visual for real size.
   */
  "target-200": {
    id: "target-200",
    label: "200 m-skive",
    shortLabel: "200",
    src: "/range/target200.png",
    nativeWidth: 646,
    nativeHeight: 554,
    bullseyeXPx: 327,
    bullseyeYPx: 272,
    pxPerMm: 60.5 / 20,
    visualScale: 2,
  },
  /**
   * target300.png — centre diamond tip-to-tip ≈ 123 px = Dot 0.5 mrad @ 300 m
   * (0.5 × 300 mm = 150 mm). ×1.95 visual.
   */
  "target-300": {
    id: "target-300",
    label: "300 m-skive",
    shortLabel: "300",
    src: "/range/target300.png",
    nativeWidth: 1852,
    nativeHeight: 1312,
    bullseyeXPx: 927,
    bullseyeYPx: 657,
    pxPerMm: 123 / 150,
    visualScale: 1.95,
  },
  /**
   * target400.png — Dot 0.5 mrad @ 400 m = 200 mm tip-to-tip (~104 px).
   */
  "target-400": {
    id: "target-400",
    label: "400 m-skive",
    shortLabel: "400",
    src: "/range/target400.png",
    nativeWidth: 1241,
    nativeHeight: 874,
    bullseyeXPx: 623,
    bullseyeYPx: 437,
    pxPerMm: 104 / 200,
    visualScale: 1.42 * 2,
  },
  /**
   * target500.png — 2 cm grid ≈ 123.5 px; ×2 visual for real size.
   */
  "target-500": {
    id: "target-500",
    label: "500 m-skive",
    shortLabel: "500",
    src: "/range/target500.png",
    nativeWidth: 1852,
    nativeHeight: 1312,
    bullseyeXPx: 926,
    bullseyeYPx: 657,
    pxPerMm: 123.5 / 20,
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

export function mmToPxOnTarget(
  mm: number,
  target: RangeTargetDef,
  imageWidthPx: number = target.nativeWidth,
): number {
  return mm * targetPxPerMm(target, imageWidthPx);
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
