/**
 * BlackJack Challenge — Cortina-style KYL rack at ~500 yards.
 * @see https://www.shootsmallgroups.com/kyl-blackjack-leaderboard/
 */

import type { AmmoSpec } from "@/lib/ammo/spec";
import {
  densityRatioFromTempC,
  exactBallisticHold,
} from "@/lib/ballistics/solver";
import type { KestrelGunProfile } from "@/lib/ballistics/kestrelProfile";
import { kestrelSolveAmmo } from "@/lib/ballistics/kestrelProfile";
import {
  barrelV0FactorForRifle,
  type InstalledCustomBarrel,
} from "@/lib/customs/customBarrel";
import { milClicksToScopeClicks } from "@/lib/optics/clicks";
import type { ScopeClickUnit } from "@/lib/optics/spec";
import { TIUR_SPRITE_HEIGHT_MM } from "@/lib/hunt/shoot";
import {
  SPRITE_SIZE_REF_DISTANCE_M,
  TIUR_TOPP_WIDTH_PCT_AT_100M,
} from "@/lib/hunt/birds";
import type { DayWeather } from "@/lib/weather/spec";
import { crosswindMs } from "@/lib/weather/spec";
import { FIELD_IMPACT_LANDSCAPE_SRC } from "@/lib/range/fieldImpactComp";

export { FIELD_IMPACT_LANDSCAPE_SRC as BLACKJACK_LANDSCAPE_SRC };

/** ~500 yards. */
export const BLACKJACK_DISTANCE_M = 457;

export const BLACKJACK_DISTANCE_YD = 500;

/** Stage clock — Cortina: 2 minutes. */
export const BLACKJACK_TIME_LIMIT_MS = 2 * 60 * 1000;

/** Charity-style entry (~$100). */
export const BLACKJACK_ENTRY_FEE_NOK = 1000;

export const BLACKJACK_SHOT_BEARING_DEG = 0;

/** Rack centre on Losby field landscape (%). Near 500 m seats. */
export const BLACKJACK_RACK_CENTER = { x: 49.5, y: 39.2 } as const;

/**
 * Horizontal pitch between plate centres as a fraction of the largest plate
 * widthPct (12″). Tuned so the six plates read as one KYL rack.
 */
export const BLACKJACK_RACK_PITCH_FRAC = 1.15;

/**
 * Lobby spotting only — true angular size at 500 yd is tiny on a wide
 * landscape photo; scale plates up so the KYL rack reads like the reference.
 * Live scope / hit math uses unscaled {@link blackjackPlateWidthPct}.
 */
export const BLACKJACK_LOBBY_VISUAL_SCALE = 5;

export type BlackjackPlateSpec = {
  /** 0 = 12″ … 5 = 2″ */
  index: number;
  sizeInch: number;
  sizeMm: number;
  points: number;
  label: string;
};

/** Target 1–6: 12″→2″, points 1–6 (sum 21 = BlackJack). */
export const BLACKJACK_PLATES: readonly BlackjackPlateSpec[] = [
  { index: 0, sizeInch: 12, sizeMm: 12 * 25.4, points: 1, label: '12″' },
  { index: 1, sizeInch: 10, sizeMm: 10 * 25.4, points: 2, label: '10″' },
  { index: 2, sizeInch: 8, sizeMm: 8 * 25.4, points: 3, label: '8″' },
  { index: 3, sizeInch: 6, sizeMm: 6 * 25.4, points: 4, label: '6″' },
  { index: 4, sizeInch: 4, sizeMm: 4 * 25.4, points: 5, label: '4″' },
  { index: 5, sizeInch: 2, sizeMm: 2 * 25.4, points: 6, label: '2″' },
] as const;

export const BLACKJACK_FORWARD_TOTAL = 21;
export const BLACKJACK_REVERSE_TOTAL = 42;
/** Extra BlackJack for each additional hit on the 2″ after clearing the rack. */
export const BLACKJACK_EXTRA_POINTS = 21;

/**
 * Paint-flake “hole” on steel ≈ bullet diameter × this (maling skaller av).
 */
export const BLACKJACK_PAINT_FLAKE_SCALE = 6;

export type BlackjackRunPhase = "forward" | "reverse" | "extras";

export type BlackjackPlateLayout = BlackjackPlateSpec & {
  /** Plate centre on landscape (%). */
  x: number;
  y: number;
  /** Square width as % of landscape (same convention as hunt spotting). */
  widthPct: number;
};

export type BlackjackRackLayout = {
  distanceM: number;
  plates: BlackjackPlateLayout[];
};

export type BlackjackHoldCard = {
  distanceM: number;
  elevClicks: number;
  windClicks: number;
  elevLabel: string;
  windLabel: string;
  source: "ballistikk";
};

export type BlackjackHitLog = {
  plateIndex: number;
  sizeInch: number;
  pointsAwarded: number;
  xMm: number;
  yMm: number;
  diameterMm: number;
  runPhase: BlackjackRunPhase;
  elapsedMs: number;
};

export type BlackjackResult = {
  score: number;
  elapsedMs: number;
  shotsFired: number;
  hits: number;
  blackjacks: number;
  completedForward: boolean;
  completedReverse: boolean;
  timedOut: boolean;
  payoutNok: number;
  tierLabel: string | null;
  entryFeeNok: number;
  netNok: number;
  hitLog: BlackjackHitLog[];
};

/** Prize by score; ties broken by shortest time (leaderboard only). */
export const BLACKJACK_PAYOUT_TIERS: readonly {
  minScore: number;
  payoutNok: number;
  label: string;
}[] = [
  { minScore: 84, payoutNok: 5000, label: "Finale-nivå (≥84)" },
  { minScore: 63, payoutNok: 3000, label: "Sterk (≥63)" },
  { minScore: 42, payoutNok: 1500, label: "Dobbel rack (≥42)" },
  { minScore: 21, payoutNok: 800, label: "BlackJack (≥21)" },
  { minScore: 10, payoutNok: 300, label: "På vei (≥10)" },
];

/**
 * Landscape width % for a square plate of physical size at distance.
 * Anchored to the same 100 m / tiur-height convention as hunt spotting.
 */
export function blackjackPlateWidthPct(
  sizeMm: number,
  distanceM: number = BLACKJACK_DISTANCE_M,
): number {
  const d = Math.max(1, distanceM);
  return (
    TIUR_TOPP_WIDTH_PCT_AT_100M *
    (SPRITE_SIZE_REF_DISTANCE_M / d) *
    (sizeMm / TIUR_SPRITE_HEIGHT_MM)
  );
}

/** Build fixed KYL rack on the Losby landscape at ~500 yd. */
export function buildBlackjackRack(
  distanceM: number = BLACKJACK_DISTANCE_M,
  opts?: { visualScale?: number },
): BlackjackRackLayout {
  const visualScale = Math.max(0.1, opts?.visualScale ?? 1);
  const platesSized = BLACKJACK_PLATES.map((p) => ({
    ...p,
    widthPct: blackjackPlateWidthPct(p.sizeMm, distanceM) * visualScale,
  }));
  const pitch =
    (platesSized[0]?.widthPct ?? 1) * BLACKJACK_RACK_PITCH_FRAC;
  const n = platesSized.length;
  const totalSpan = pitch * (n - 1);
  const startX = BLACKJACK_RACK_CENTER.x - totalSpan / 2;
  const plates: BlackjackPlateLayout[] = platesSized.map((p, i) => ({
    ...p,
    x: startX + i * pitch,
    y: BLACKJACK_RACK_CENTER.y,
    widthPct: p.widthPct,
  }));
  return { distanceM, plates };
}

export function blackjackPlateAt(
  rack: BlackjackRackLayout | null,
  index: number,
): BlackjackPlateLayout | null {
  if (!rack || index < 0 || index >= rack.plates.length) return null;
  return rack.plates[index] ?? null;
}

/** True if impact (mm from plate centre) lands on the square steel. */
export function isBlackjackPlateHit(
  xMm: number,
  yMm: number,
  sizeMm: number,
): boolean {
  const half = sizeMm / 2;
  return Math.abs(xMm) <= half && Math.abs(yMm) <= half;
}

/** Landscape extent in mm when aim/impact is relative to {@link refPlate}. */
export function blackjackSceneSizeMm(
  refPlate: BlackjackPlateLayout,
  landAspect: number,
): { widthMm: number; heightMm: number } {
  const widthMm =
    refPlate.sizeMm * (100 / Math.max(0.05, refPlate.widthPct));
  return {
    widthMm,
    heightMm: widthMm / Math.max(0.25, landAspect),
  };
}

/** Impact in ref-plate mm → local mm on another plate. */
export function blackjackImpactLocalOnPlate(
  impactRefMm: { x: number; y: number },
  refPlate: BlackjackPlateLayout,
  plate: BlackjackPlateLayout,
  scene: { widthMm: number; heightMm: number },
): { xMm: number; yMm: number } {
  const ox = ((plate.x - refPlate.x) / 100) * scene.widthMm;
  const oy = ((plate.y - refPlate.y) / 100) * scene.heightMm;
  return { xMm: impactRefMm.x - ox, yMm: impactRefMm.y - oy };
}

/**
 * Which plate (if any) the impact hits. Prefer smallest plate when overlapping.
 * `impactRefMm` is relative to {@link refPlate} centre (scene aim frame).
 */
export function findBlackjackPlateHit(
  rack: BlackjackRackLayout,
  impactRefMm: { x: number; y: number },
  refPlate: BlackjackPlateLayout,
  landAspect: number,
): {
  plate: BlackjackPlateLayout;
  localXMm: number;
  localYMm: number;
} | null {
  const scene = blackjackSceneSizeMm(refPlate, landAspect);
  let best: {
    plate: BlackjackPlateLayout;
    localXMm: number;
    localYMm: number;
  } | null = null;
  for (const plate of rack.plates) {
    const local = blackjackImpactLocalOnPlate(
      impactRefMm,
      refPlate,
      plate,
      scene,
    );
    if (!isBlackjackPlateHit(local.xMm, local.yMm, plate.sizeMm)) continue;
    if (!best || plate.sizeMm < best.plate.sizeMm) {
      best = {
        plate,
        localXMm: local.xMm,
        localYMm: local.yMm,
      };
    }
  }
  return best;
}

export type BlackjackProgress = {
  runPhase: BlackjackRunPhase;
  /** Hint: suggested next unscored plate (HUD). */
  nextPlateIndex: number;
  /** Bitmask of plates scored in forward pass (bit i = plate i). */
  forwardHitMask: number;
  /** Bitmask of plates scored in reverse pass. */
  reverseHitMask: number;
  score: number;
  blackjacks: number;
  completedForward: boolean;
  completedReverse: boolean;
};

function maskHas(mask: number, index: number): boolean {
  return (mask & (1 << index)) !== 0;
}

function maskWith(mask: number, index: number): number {
  return mask | (1 << index);
}

function maskCount(mask: number): number {
  let n = 0;
  let m = mask;
  while (m) {
    n += m & 1;
    m >>>= 1;
  }
  return n;
}

/** First unscored plate in forward (0→5) or reverse larger plates; extras → 2″. */
export function blackjackHintPlateIndex(p: BlackjackProgress): number {
  if (p.runPhase === "extras") return 5;
  if (p.runPhase === "forward") {
    for (let i = 0; i < BLACKJACK_PLATES.length; i++) {
      if (!maskHas(p.forwardHitMask, i)) return i;
    }
    return 5;
  }
  // reverse: prefer remaining larger plates, else 2″ for extras
  for (let i = BLACKJACK_PLATES.length - 2; i >= 0; i--) {
    if (!maskHas(p.reverseHitMask, i)) return i;
  }
  return 5;
}

/**
 * Plates still awarding points.
 * After the forward row is filled, the 2″ stays needed for extra BlackJacks
 * while unscored reverse plates (12″–4″) remain available toward 42.
 */
export function blackjackNeededPlateIndices(
  p: BlackjackProgress,
): ReadonlySet<number> {
  const s = new Set<number>();
  if (p.runPhase === "forward") {
    for (let i = 0; i < BLACKJACK_PLATES.length; i++) {
      if (!maskHas(p.forwardHitMask, i)) s.add(i);
    }
    return s;
  }
  // extras / reverse — 2″ always active for +21 after forward clear
  s.add(5);
  if (!p.completedReverse) {
    for (let i = 0; i <= 4; i++) {
      if (!maskHas(p.reverseHitMask, i)) s.add(i);
    }
  }
  return s;
}

export function initialBlackjackProgress(): BlackjackProgress {
  return {
    runPhase: "forward",
    nextPlateIndex: 0,
    forwardHitMask: 0,
    reverseHitMask: 0,
    score: 0,
    blackjacks: 0,
    completedForward: false,
    completedReverse: false,
  };
}

export type BlackjackHitApply = {
  next: BlackjackProgress;
  pointsAwarded: number;
  /** False = steel hit but no score (already cleared / wrong for extras). */
  scored: boolean;
};

/**
 * Freefire scoring: any unscored plate in the current pass awards its points
 * (order free).
 *
 * After the forward row (BlackJack 21), the 2″ stays live for +21 per hit
 * (“additional BlackJacks”). Reverse of 12″–4″ still scores plate points;
 * clearing those five awards the reverse 2″ (6 pts) so a full reverse rack
 * totals 42 without requiring a separate 6-pt hit on the 2″.
 */
export function applyBlackjackPlateHit(
  prev: BlackjackProgress,
  plateIndex: number,
): BlackjackHitApply | null {
  const plate = BLACKJACK_PLATES[plateIndex];
  if (!plate) return null;

  if (prev.runPhase === "forward") {
    if (maskHas(prev.forwardHitMask, plateIndex)) {
      return { next: prev, pointsAwarded: 0, scored: false };
    }
    const forwardHitMask = maskWith(prev.forwardHitMask, plateIndex);
    const next: BlackjackProgress = {
      ...prev,
      forwardHitMask,
      score: prev.score + plate.points,
      nextPlateIndex: 0,
    };
    if (maskCount(forwardHitMask) >= BLACKJACK_PLATES.length) {
      next.completedForward = true;
      next.blackjacks += 1;
      // 2″ stays active immediately for extra BlackJacks; reverse is parallel.
      next.runPhase = "extras";
      next.nextPlateIndex = 5;
    } else {
      next.nextPlateIndex = blackjackHintPlateIndex(next);
    }
    return { next, pointsAwarded: plate.points, scored: true };
  }

  // Post-forward: extras (+21 on 2″) and optional reverse on 12″–4″.
  if (plateIndex === 5) {
    return {
      pointsAwarded: BLACKJACK_EXTRA_POINTS,
      scored: true,
      next: {
        ...prev,
        runPhase: "extras",
        score: prev.score + BLACKJACK_EXTRA_POINTS,
        blackjacks: prev.blackjacks + 1,
        nextPlateIndex: 5,
      },
    };
  }

  if (prev.completedReverse || maskHas(prev.reverseHitMask, plateIndex)) {
    return { next: prev, pointsAwarded: 0, scored: false };
  }

  // Reverse freefire on larger plates (0–4).
  const reverseHitMask = maskWith(prev.reverseHitMask, plateIndex);
  let score = prev.score + plate.points;
  let pointsAwarded = plate.points;
  let blackjacks = prev.blackjacks;
  let completedReverse = false;
  const largerDone = [0, 1, 2, 3, 4].every((i) => maskHas(reverseHitMask, i));
  if (largerDone) {
    // Reverse 2″ credit — 2″ itself only scores extras after forward clear.
    const twoInch = BLACKJACK_PLATES[5]!;
    score += twoInch.points;
    pointsAwarded += twoInch.points;
    blackjacks += 1;
    completedReverse = true;
  }
  const next: BlackjackProgress = {
    ...prev,
    runPhase: "extras",
    reverseHitMask,
    score,
    blackjacks,
    completedReverse,
    nextPlateIndex: blackjackHintPlateIndex({
      ...prev,
      runPhase: "extras",
      reverseHitMask,
      completedReverse,
    }),
  };
  return { next, pointsAwarded, scored: true };
}

function formatElevNb(scopeClicks: number): string {
  if (scopeClicks === 0) return "0";
  return `${Math.abs(scopeClicks)} ${scopeClicks < 0 ? "Opp" : "Ned"}`;
}

function formatWindNb(scopeClicks: number): string {
  if (scopeClicks === 0) return "0 Side";
  return `${Math.abs(scopeClicks)} ${scopeClicks < 0 ? "Venstre" : "Høyre"}`;
}

export function buildBlackjackHoldCard(opts: {
  rifleId: string;
  ammoId: string;
  ammo: AmmoSpec;
  distanceM?: number;
  weather: DayWeather;
  clickUnit: ScopeClickUnit;
  kestrelProfiles?: Record<string, KestrelGunProfile>;
  customBarrel?: InstalledCustomBarrel | null;
}): BlackjackHoldCard {
  const distanceM = opts.distanceM ?? BLACKJACK_DISTANCE_M;
  const solve = kestrelSolveAmmo(
    opts.ammo,
    opts.ammoId,
    opts.kestrelProfiles,
  );
  const densityRatio = densityRatioFromTempC(opts.weather.live.temperatureC);
  const cw = crosswindMs(
    opts.weather.live.windSpeedMs,
    opts.weather.live.windFromDeg,
    BLACKJACK_SHOT_BEARING_DEG,
  );
  const hold = exactBallisticHold(solve.ammo, distanceM, cw, {
    densityRatio,
    powderTempC: opts.weather.live.temperatureC,
    dvDtMpsPerC: solve.dvDtMpsPerC,
    v0Scale: barrelV0FactorForRifle(opts.rifleId, opts.customBarrel ?? null),
  });
  const elev = milClicksToScopeClicks(hold.elevationClicks, opts.clickUnit);
  const wind = milClicksToScopeClicks(hold.windageClicks, opts.clickUnit);
  return {
    distanceM,
    elevClicks: elev,
    windClicks: wind,
    elevLabel: formatElevNb(elev),
    windLabel: formatWindNb(wind),
    source: "ballistikk",
  };
}

export function formatBlackjackElapsed(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}:${rem.toFixed(1).padStart(4, "0")}`;
}

export function formatBlackjackClock(remainingMs: number): string {
  const ms = Math.max(0, remainingMs);
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function payoutForBlackjackScore(score: number): {
  payoutNok: number;
  tierLabel: string | null;
} {
  for (const t of BLACKJACK_PAYOUT_TIERS) {
    if (score >= t.minScore) {
      return { payoutNok: t.payoutNok, tierLabel: t.label };
    }
  }
  return { payoutNok: 0, tierLabel: null };
}

export function finalizeBlackjack(opts: {
  score: number;
  elapsedMs: number;
  shotsFired: number;
  hits: number;
  blackjacks: number;
  completedForward: boolean;
  completedReverse: boolean;
  timedOut: boolean;
  hitLog?: BlackjackHitLog[];
  entryFeeNok?: number;
}): BlackjackResult {
  const entry = opts.entryFeeNok ?? BLACKJACK_ENTRY_FEE_NOK;
  const { payoutNok, tierLabel } = payoutForBlackjackScore(opts.score);
  return {
    score: opts.score,
    elapsedMs: opts.elapsedMs,
    shotsFired: opts.shotsFired,
    hits: opts.hits,
    blackjacks: opts.blackjacks,
    completedForward: opts.completedForward,
    completedReverse: opts.completedReverse,
    timedOut: opts.timedOut,
    payoutNok,
    tierLabel,
    entryFeeNok: entry,
    netNok: payoutNok - entry,
    hitLog: opts.hitLog ?? [],
  };
}

/** Synthetic square geom for scope aim math (mm ↔ landscape %). */
export function blackjackPlateGeom(sizeMm: number): {
  nativeW: number;
  nativeH: number;
  spriteHeightMm: number;
  spriteWidthMm: number;
  vitalOff: { x: number; y: number };
} {
  const native = 128;
  return {
    nativeW: native,
    nativeH: native,
    spriteHeightMm: sizeMm,
    spriteWidthMm: sizeMm,
    vitalOff: { x: 0, y: 0 },
  };
}

export function blackjackRunPhaseLabelNb(
  phase: BlackjackRunPhase,
  opts?: { completedReverse?: boolean },
): string {
  if (phase === "forward") return "Frem (12″→2″)";
  if (opts?.completedReverse) return "Ekstra BlackJack (2″)";
  return "2″ ekstra (+21) · revers valgfri";
}
