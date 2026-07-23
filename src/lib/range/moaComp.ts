/**
 * Toppjakt MOA competition — 10-target STD sheet at 100 m.
 *
 * Printed scale: dashed grid square = 1 cm = 10 mm (primary calibration).
 * Scoring uses engine mm → MOA via MM_PER_MOA_AT_100M.
 * Only the worst of 10 shots counts.
 *
 * Scope zoom: `scopeImageScale` is tuned for the CBA target (≈11.5 px/mm).
 * This sheet is coarser (≈2.8 px/mm), so CSS scale is boosted by
 * `moaCompScopeScaleFactor()` so 1 mm paper matches zeroing angular size.
 * Reticle keeps the unboosted CBA scale so mil hashes stay true.
 */

import { MM_PER_MOA_AT_100M } from "@/lib/ballistics/dispersion";
import {
  CBA_DIAMOND_CENTER_TO_TIP_MM,
  CBA_DIAMOND_CENTER_TO_TIP_PX,
  scopeImageScale,
  type ShotImpact,
} from "@/lib/range/precision";
import type { ScopeSpec } from "@/lib/optics/spec";

export const MOA_COMP_IMG_SRC = "/range/moa-comp-std.png";
export const MOA_COMP_NATIVE_W = 1024;
export const MOA_COMP_NATIVE_H = 726;

/** 10 bullseyes — cross intersections measured on moa-comp-std.png. */
export const MOA_COMP_TARGETS: readonly { xPx: number; yPx: number }[] = [
  { xPx: 134, yPx: 204 },
  { xPx: 322, yPx: 205 },
  { xPx: 510, yPx: 199 },
  { xPx: 699, yPx: 199 },
  { xPx: 886, yPx: 199 },
  { xPx: 134, yPx: 475 },
  { xPx: 322, yPx: 471 },
  { xPx: 510, yPx: 470 },
  { xPx: 699, yPx: 470 },
  { xPx: 886, yPx: 470 },
] as const;

export const MOA_COMP_SHOT_COUNT = MOA_COMP_TARGETS.length;

/** Printed grid square = 1 cm = 10 mm. */
export const MOA_COMP_GRID_MM = 10;

/**
 * Native pixels per 1 cm grid square (measured on moa-comp-std.png).
 * Bullet holes and pan use this so Ø 6.5 mm ≈ 0.65× one square.
 */
export const MOA_COMP_GRID_PX = 28;

export const MOA_COMP_PX_PER_MM = MOA_COMP_GRID_PX / MOA_COMP_GRID_MM;

export const MOA_COMP_DISTANCE_M = 100;

export const MOA_COMP_ENTRY_FEE_NOK = 100;

/** CBA px/mm ÷ sheet px/mm — multiply scopeImageScale for the paper only. */
export function moaCompScopeScaleFactor(): number {
  const cbaPxPerMm =
    CBA_DIAMOND_CENTER_TO_TIP_PX / CBA_DIAMOND_CENTER_TO_TIP_MM;
  return cbaPxPerMm / MOA_COMP_PX_PER_MM;
}

/**
 * Fine-tune after CBA match: paper a touch smaller so Nightforce (etc.)
 * mil hashes read correctly against the STD sheet.
 */
export const MOA_COMP_SCOPE_PAPER_TUNE = 0.88;

/** Target (paper) CSS scale at optical zoom — matches zeroing angular size. */
export function moaCompScopeImageScale(
  zoom: number,
  scope?: Pick<ScopeSpec, "minZoom" | "maxZoom">,
  distanceM: number = MOA_COMP_DISTANCE_M,
): number {
  return (
    scopeImageScale(zoom, scope, distanceM) *
    moaCompScopeScaleFactor() *
    MOA_COMP_SCOPE_PAPER_TUNE
  );
}

/** Prize tiers by worst-shot MOA (lower = better). First match wins. */
export const MOA_COMP_PAYOUT_TIERS: readonly {
  maxWorstMoa: number;
  payoutNok: number;
  label: string;
}[] = [
  { maxWorstMoa: 0.25, payoutNok: 2500, label: "Elite (≤0.25)" },
  { maxWorstMoa: 0.5, payoutNok: 1200, label: "Sterk (≤0.50)" },
  { maxWorstMoa: 0.75, payoutNok: 600, label: "Bra (≤0.75)" },
  { maxWorstMoa: 1.0, payoutNok: 350, label: "Godkjent (≤1.00)" },
  { maxWorstMoa: 1.25, payoutNok: 250, label: "På streken (≤1.25)" },
];

export type MoaCompShot = ShotImpact & {
  /** 0–9 target index on the sheet. */
  targetIndex: number;
  /** Radial distance from that bullseye (mm). */
  radiusMm: number;
  /** Radius in MOA at 100 m. */
  radiusMoa: number;
};

export type MoaCompResult = {
  shots: MoaCompShot[];
  /** Worst (largest) radius MOA — the competition score. */
  worstMoa: number;
  worstTargetIndex: number;
  bestMoa: number;
  payoutNok: number;
  tierLabel: string | null;
  entryFeeNok: number;
  netNok: number;
};

export function moaCompMmToPx(mm: number): number {
  return mm * MOA_COMP_PX_PER_MM;
}

export function moaCompPxToMm(px: number): number {
  return px / MOA_COMP_PX_PER_MM;
}

/** Bullseye position in mm from image center (+x right, +y down). */
export function moaCompTargetPosMm(targetIndex: number): {
  xMm: number;
  yMm: number;
} {
  const t = MOA_COMP_TARGETS[targetIndex] ?? MOA_COMP_TARGETS[0]!;
  return {
    xMm: moaCompPxToMm(t.xPx - MOA_COMP_NATIVE_W / 2),
    yMm: moaCompPxToMm(t.yPx - MOA_COMP_NATIVE_H / 2),
  };
}

export function radiusMmToMoa(radiusMm: number): number {
  // Sheet/reticle fine-tune: reported score reads ~25% low vs visual.
  return (radiusMm / MM_PER_MOA_AT_100M) * 1.25;
}

export function scoreMoaCompShot(
  targetIndex: number,
  impactRelativeToBullseye: ShotImpact,
): MoaCompShot {
  const radiusMm = Math.hypot(
    impactRelativeToBullseye.xMm,
    impactRelativeToBullseye.yMm,
  );
  return {
    ...impactRelativeToBullseye,
    targetIndex,
    radiusMm,
    radiusMoa: radiusMmToMoa(radiusMm),
  };
}

/**
 * Pick nearest empty bullseye for an absolute sheet impact (mm from image centre).
 */
export function nearestEmptyTargetIndex(
  absXMm: number,
  absYMm: number,
  usedTargetIndexes: ReadonlySet<number>,
): number {
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < MOA_COMP_TARGETS.length; i++) {
    if (usedTargetIndexes.has(i)) continue;
    const p = moaCompTargetPosMm(i);
    const d = Math.hypot(absXMm - p.xMm, absYMm - p.yMm);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

export function payoutForWorstMoa(worstMoa: number): {
  payoutNok: number;
  tierLabel: string | null;
} {
  for (const tier of MOA_COMP_PAYOUT_TIERS) {
    if (worstMoa <= tier.maxWorstMoa) {
      return { payoutNok: tier.payoutNok, tierLabel: tier.label };
    }
  }
  return { payoutNok: 0, tierLabel: null };
}

export function finalizeMoaComp(
  shots: MoaCompShot[],
  entryFeeNok = MOA_COMP_ENTRY_FEE_NOK,
): MoaCompResult {
  if (shots.length === 0) {
    return {
      shots: [],
      worstMoa: Infinity,
      worstTargetIndex: -1,
      bestMoa: Infinity,
      payoutNok: 0,
      tierLabel: null,
      entryFeeNok,
      netNok: -entryFeeNok,
    };
  }
  let worst = shots[0]!;
  let best = shots[0]!;
  for (const s of shots) {
    if (s.radiusMoa > worst.radiusMoa) worst = s;
    if (s.radiusMoa < best.radiusMoa) best = s;
  }
  const { payoutNok, tierLabel } = payoutForWorstMoa(worst.radiusMoa);
  return {
    shots,
    worstMoa: worst.radiusMoa,
    worstTargetIndex: worst.targetIndex,
    bestMoa: best.radiusMoa,
    payoutNok,
    tierLabel,
    entryFeeNok,
    netNok: payoutNok - entryFeeNok,
  };
}

export function formatMoaCompScore(moa: number): string {
  if (!Number.isFinite(moa)) return "—";
  return `${moa.toFixed(2)} MOA`;
}
