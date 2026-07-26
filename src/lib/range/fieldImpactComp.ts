/**
 * IMPACT! field-figure competition — Losby hillside, random seats + species.
 * Score = elapsed time only. Hold card uses DOPE when available, else ballistics.
 */

import type { AmmoSpec } from "@/lib/ammo/spec";
import {
  densityRatioFromTempC,
  exactBallisticHold,
} from "@/lib/ballistics/solver";
import type { KestrelGunProfile } from "@/lib/ballistics/kestrelProfile";
import { kestrelSolveAmmo } from "@/lib/ballistics/kestrelProfile";
import { spriteWidthPctForDistance, type BirdSpecies } from "@/lib/hunt/birds";
import {
  pickBirdSpriteId,
  type BirdSpriteId,
} from "@/lib/hunt/birdSprites";
import type { HuntShotResultKind, HuntShotZone } from "@/lib/hunt/shoot";
import { milClicksToScopeClicks } from "@/lib/optics/clicks";
import type { ScopeClickUnit } from "@/lib/optics/spec";
import {
  nearestDopeEntry,
  type DopeCardEntry,
} from "@/lib/player";
import { crosswindMs, type DayWeather } from "@/lib/weather/spec";

/** Clean Losby field-range photo (no seat markers). */
export const FIELD_IMPACT_LANDSCAPE_SRC = "/range/losby-field.png";

/** Annotated reference (seat markers) — not shown in-game. */
export const FIELD_IMPACT_SEATS_REF_SRC = "/range/losby-field-seats-ref.png";

/** Known stage distances printed on the hold card. */
export const FIELD_IMPACT_DISTANCES_M = [100, 200, 300, 400, 500] as const;

export const FIELD_IMPACT_STAGE_COUNT = FIELD_IMPACT_DISTANCES_M.length;

export const FIELD_IMPACT_ENTRY_FEE_NOK = 150;

/** Range lane bearing for crosswind (meteorological “from”). */
export const FIELD_IMPACT_SHOT_BEARING_DEG = 0;

/** Prefer DOPE when nearest row is within this many metres. */
export const FIELD_IMPACT_DOPE_MAX_DELTA_M = 50;

/** Species pool — each square can be tiur, orre, or ugle. */
export const FIELD_IMPACT_SPECIES: readonly BirdSpecies[] = [
  "tiur",
  "orrhane",
  "ugle",
] as const;

/**
 * Seat pools on {@link FIELD_IMPACT_LANDSCAPE_SRC} (% of image, centre of square).
 * Measured from the annotated Losby photo (red / magenta / green / yellow tiers).
 * 500 m seats sit on the rocky/forest edge above the yellow berm.
 */
export const FIELD_IMPACT_SEATS: Readonly<
  Record<number, readonly { x: number; y: number }[]>
> = {
  100: [
    { x: 22.4, y: 62.9 },
    { x: 39.7, y: 62.9 },
    { x: 57.4, y: 63.6 },
    { x: 68.8, y: 62.9 },
  ],
  200: [
    { x: 30.1, y: 60.0 },
    { x: 46.3, y: 58.5 },
    { x: 61.9, y: 58.5 },
    { x: 73.8, y: 57.9 },
  ],
  300: [
    { x: 36.3, y: 53.0 },
    { x: 43.9, y: 53.7 },
    { x: 52.5, y: 52.9 },
    { x: 64.5, y: 51.7 },
  ],
  400: [
    { x: 36.3, y: 45.2 },
    { x: 41.9, y: 46.3 },
    { x: 50.7, y: 43.2 },
    { x: 61.8, y: 45.8 },
  ],
  500: [
    { x: 38.0, y: 39.0 },
    { x: 46.0, y: 38.0 },
    { x: 53.5, y: 37.5 },
    { x: 61.5, y: 39.0 },
  ],
};

/** Prize tiers by finish time (lower = better). First match wins. */
export const FIELD_IMPACT_PAYOUT_TIERS: readonly {
  maxSeconds: number;
  payoutNok: number;
  label: string;
}[] = [
  { maxSeconds: 45, payoutNok: 3000, label: "Elite (≤45 s)" },
  { maxSeconds: 60, payoutNok: 1500, label: "Sterk (≤60 s)" },
  { maxSeconds: 90, payoutNok: 800, label: "Bra (≤90 s)" },
  { maxSeconds: 120, payoutNok: 400, label: "Godkjent (≤120 s)" },
];

export type FieldImpactHoldSource = "DOPE" | "ballistikk";

export type FieldImpactHoldCard = {
  distanceM: number;
  elevClicks: number;
  windClicks: number;
  elevLabel: string;
  windLabel: string;
  source: FieldImpactHoldSource;
  dopeDistanceM?: number;
};

/** Logged impact on a stage figure (IMPACT hit that advanced the round). */
export type FieldImpactStageHit = {
  distanceM: number;
  spriteId: BirdSpriteId;
  species: BirdSpecies;
  xMm: number;
  yMm: number;
  diameterMm: number;
  zone: HuntShotZone;
  kind: HuntShotResultKind;
};

export type FieldImpactResult = {
  elapsedMs: number;
  stagesHit: number;
  shotsFired: number;
  payoutNok: number;
  tierLabel: string | null;
  entryFeeNok: number;
  netNok: number;
  /** Winning impact per stage (for AAR). */
  stageHits: FieldImpactStageHit[];
};

/** One rolled stage for a competition run. */
export type FieldImpactStageLayout = {
  distanceM: number;
  spriteId: BirdSpriteId;
  species: BirdSpecies;
  /** Seat centre on landscape (%). */
  x: number;
  y: number;
  /** Bird width as % of landscape (same convention as hunt spotting). */
  widthPct: number;
};

export type FieldImpactRoundLayout = {
  stages: FieldImpactStageLayout[];
};

function pickOne<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]!;
}

/** Roll seats + species for all five distances (fresh each start). */
export function rollFieldImpactRound(
  random: () => number = Math.random,
): FieldImpactRoundLayout {
  const stages: FieldImpactStageLayout[] = FIELD_IMPACT_DISTANCES_M.map(
    (distanceM) => {
      const seats = FIELD_IMPACT_SEATS[distanceM] ?? FIELD_IMPACT_SEATS[100]!;
      const seat = pickOne(seats, random);
      const species = pickOne(FIELD_IMPACT_SPECIES, random);
      const spriteId = pickBirdSpriteId(species, random);
      return {
        distanceM,
        spriteId,
        species,
        x: seat.x,
        y: seat.y,
        widthPct: spriteWidthPctForDistance(distanceM, spriteId),
      };
    },
  );
  return { stages };
}

export function fieldImpactStageFromLayout(
  layout: FieldImpactRoundLayout | null,
  index: number,
): FieldImpactStageLayout | null {
  if (!layout || index < 0 || index >= layout.stages.length) return null;
  return layout.stages[index] ?? null;
}

function formatElevNb(scopeClicks: number): string {
  if (scopeClicks === 0) return "0";
  return `${Math.abs(scopeClicks)} ${scopeClicks < 0 ? "Opp" : "Ned"}`;
}

function formatWindNb(scopeClicks: number): string {
  if (scopeClicks === 0) return "0 Side";
  return `${Math.abs(scopeClicks)} ${scopeClicks < 0 ? "Venstre" : "Høyre"}`;
}

/**
 * Hold slip for one stage: DOPE when close enough, else solver with wind + dV/dT.
 */
export function buildFieldImpactHoldCard(opts: {
  rifleId: string;
  ammoId: string;
  ammo: AmmoSpec;
  distanceM: number;
  dopeCard: readonly DopeCardEntry[];
  weather: DayWeather;
  clickUnit: ScopeClickUnit;
  kestrelProfiles?: Record<string, KestrelGunProfile>;
}): FieldImpactHoldCard {
  const dope = nearestDopeEntry(opts.dopeCard, {
    rifleId: opts.rifleId,
    ammoId: opts.ammoId,
    distanceM: opts.distanceM,
  });
  if (
    dope &&
    Math.abs(dope.distanceM - opts.distanceM) <= FIELD_IMPACT_DOPE_MAX_DELTA_M
  ) {
    const elev = milClicksToScopeClicks(dope.elevationClicks, opts.clickUnit);
    const wind = milClicksToScopeClicks(dope.windageClicks, opts.clickUnit);
    return {
      distanceM: opts.distanceM,
      elevClicks: elev,
      windClicks: wind,
      elevLabel: formatElevNb(elev),
      windLabel: formatWindNb(wind),
      source: "DOPE",
      dopeDistanceM: dope.distanceM,
    };
  }

  const solve = kestrelSolveAmmo(
    opts.ammo,
    opts.ammoId,
    opts.kestrelProfiles,
  );
  const densityRatio = densityRatioFromTempC(opts.weather.live.temperatureC);
  const cw = crosswindMs(
    opts.weather.live.windSpeedMs,
    opts.weather.live.windFromDeg,
    FIELD_IMPACT_SHOT_BEARING_DEG,
  );
  const hold = exactBallisticHold(solve.ammo, opts.distanceM, cw, {
    densityRatio,
    powderTempC: opts.weather.live.temperatureC,
    dvDtMpsPerC: solve.dvDtMpsPerC,
  });
  const elev = milClicksToScopeClicks(hold.elevationClicks, opts.clickUnit);
  const wind = milClicksToScopeClicks(hold.windageClicks, opts.clickUnit);
  return {
    distanceM: opts.distanceM,
    elevClicks: elev,
    windClicks: wind,
    elevLabel: formatElevNb(elev),
    windLabel: formatWindNb(wind),
    source: "ballistikk",
  };
}

export function formatFieldImpactElapsed(ms: number): string {
  const s = Math.max(0, ms) / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rem = s - m * 60;
  return `${m}:${rem.toFixed(1).padStart(4, "0")}`;
}

export function payoutForFieldImpactTime(elapsedMs: number): {
  payoutNok: number;
  tierLabel: string | null;
} {
  const sec = elapsedMs / 1000;
  for (const t of FIELD_IMPACT_PAYOUT_TIERS) {
    if (sec <= t.maxSeconds) {
      return { payoutNok: t.payoutNok, tierLabel: t.label };
    }
  }
  return { payoutNok: 0, tierLabel: null };
}

export function finalizeFieldImpact(opts: {
  elapsedMs: number;
  shotsFired: number;
  stagesHit: number;
  stageHits?: FieldImpactStageHit[];
  entryFeeNok?: number;
}): FieldImpactResult {
  const entry = opts.entryFeeNok ?? FIELD_IMPACT_ENTRY_FEE_NOK;
  const { payoutNok, tierLabel } = payoutForFieldImpactTime(opts.elapsedMs);
  return {
    elapsedMs: opts.elapsedMs,
    stagesHit: opts.stagesHit,
    shotsFired: opts.shotsFired,
    payoutNok,
    tierLabel,
    entryFeeNok: entry,
    netNok: payoutNok - entry,
    stageHits: opts.stageHits ?? [],
  };
}
