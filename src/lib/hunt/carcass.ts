/**
 * Harvested game for the Meat Market — weight, meat ruin, and payout.
 *
 * Weight: split-normal (skjev gauss) med gitt median, trunkert til artens range.
 * Ruin: treffsone (grønn < rød < kropp) × ammo damageFactor × anslagshastighet.
 * Pris: vekt × kjøttkvalitet interpolert mellom artens min/maks kr.
 */

import type { BirdSpecies } from "@/lib/hunt/birds";
import type { HuntShotZone } from "@/lib/hunt/shoot";

/** Full locked breakdown of how the offer was calculated. */
export type CarcassValuation = {
  /** Zone base ruin (grønn 0.14 / rød 0.48 / kropp 0.82). */
  zoneBase: number;
  /** Treff-score 0–10 (grønn 10, rød 5.5, kropp 2). */
  hitScore: number;
  /** Ammo damageFactor 0–1 (expansion / meat ruin). */
  damageFactor: number;
  /** 0.28 + 0.72×damageFactor — kulebidrag til ruin. */
  ammoFactor: number;
  /** impactVelocity / 900, clamped 0–1. */
  velocityNorm: number;
  /** 0.5 + 0.5×velocityNorm — hastighetsbidrag til ruin. */
  velocityFactor: number;
  /** zoneBase × ammoFactor × velocityFactor. */
  meatRuin: number;
  /** (vekt − min) / (max − min). */
  weightNorm: number;
  /** 1 − meatRuin. */
  quality: number;
  /** weightNorm^0.85 × quality^1.15. */
  score: number;
  minNok: number;
  maxNok: number;
  marketValueNok: number;
  /** Tap mot maks kun pga. vekt (perfekt kjøtt). */
  lostToWeightNok: number;
  /** Tap mot vekt-perfekt bud kun pga. kjøttskade. */
  lostToMeatNok: number;
  /** Totalt under teoretisk maks (tung + pent). */
  lostVsMaxNok: number;
};

export type GameCarcass = {
  /** Unique sellable id (game economy). */
  id: string;
  /** Engine bird id (tiur-1 …) — for flavor / tracking. */
  birdId: string;
  species: BirdSpecies;
  weightKg: number;
  /** 0 = pent skutt, 1 = kjøttet ødelagt. */
  meatRuin: number;
  zone: HuntShotZone;
  distanceM: number;
  impactVelocityMps: number;
  damageFactor: number;
  /** Locked offer at harvest time. */
  marketValueNok: number;
  harvestedAtMs: number;
  /** Ammo used for the killing shot (display). */
  ammoId?: string;
  ammoLabel?: string;
  caliber?: string;
  projectileType?: string;
  /** Muzzle velocity of that load (m/s). */
  v0?: number;
  /** Snapshot of every factor in the price formula. */
  valuation: CarcassValuation;
};

export type BirdHarvestInput = {
  birdId: string;
  species: BirdSpecies;
  zone: HuntShotZone;
  damageFactor: number;
  distanceM: number;
  impactVelocityMps: number;
  ammoId?: string;
  ammoLabel?: string;
  caliber?: string;
  projectileType?: string;
  v0?: number;
};

type SpeciesWeightSpec = {
  minKg: number;
  maxKg: number;
  /** Median of the skewed distribution. */
  medianKg: number;
};

type SpeciesMarketSpec = {
  minNok: number;
  maxNok: number;
};

export const SPECIES_WEIGHT: Record<BirdSpecies, SpeciesWeightSpec> = {
  tiur: { minKg: 3.5, maxKg: 5.5, medianKg: 4.1 },
  orrhane: { minKg: 0.8, maxKg: 2.0, medianKg: 1.3 },
};

/** Pent skutt tung fugl → max; dårlig skutt lett → min. */
export const SPECIES_MARKET: Record<BirdSpecies, SpeciesMarketSpec> = {
  tiur: { minNok: 1000, maxNok: 5500 },
  orrhane: { minNok: 500, maxNok: 2000 },
};

/** Base meat ruin by hit zone (grønn / rød / kropp). */
export const ZONE_RUIN_BASE: Record<HuntShotZone, number> = {
  instant: 0.14,
  vital: 0.48,
  body: 0.82,
  none: 1,
};

/** Player-facing hit placement score (higher = cleaner meat potential). */
export const ZONE_HIT_SCORE: Record<HuntShotZone, number> = {
  instant: 10,
  vital: 5.5,
  body: 2,
  none: 0,
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function gauss(random: () => number): number {
  const u1 = Math.max(1e-12, random());
  const u2 = random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function roundKg(kg: number): number {
  return Math.round(kg * 100) / 100;
}

/**
 * Skjev gauss via split-normal: P(X ≤ median) = ½.
 * Høyre hale lengre (σR > σL) → typisk vekt rundt median, tunge fugler sjeldnere.
 */
export function sampleBirdWeightKg(
  species: BirdSpecies,
  random: () => number = Math.random,
): number {
  const { minKg, maxKg, medianKg } = SPECIES_WEIGHT[species];
  const sigmaL = (medianKg - minKg) / 1.75;
  const sigmaR = (maxKg - medianKg) / 1.55;
  for (let i = 0; i < 64; i++) {
    if (random() < 0.5) {
      const x = medianKg - Math.abs(gauss(random)) * sigmaL;
      if (x >= minKg && x <= medianKg) return roundKg(x);
    } else {
      const x = medianKg + Math.abs(gauss(random)) * sigmaR;
      if (x >= medianKg && x <= maxKg) return roundKg(x);
    }
  }
  return roundKg(medianKg);
}

export function computeCarcassValuation(input: {
  species: BirdSpecies;
  weightKg: number;
  zone: HuntShotZone;
  damageFactor: number;
  impactVelocityMps: number;
}): CarcassValuation {
  const zoneBase = ZONE_RUIN_BASE[input.zone] ?? 1;
  const hitScore = ZONE_HIT_SCORE[input.zone] ?? 0;
  const damageFactor = clamp01(input.damageFactor);
  const velocityNorm = clamp01(input.impactVelocityMps / 900);
  const ammoFactor = 0.28 + 0.72 * damageFactor;
  const velocityFactor = 0.5 + 0.5 * velocityNorm;
  const meatRuin = clamp01(zoneBase * ammoFactor * velocityFactor);

  const wSpec = SPECIES_WEIGHT[input.species];
  const mSpec = SPECIES_MARKET[input.species];
  const weightNorm = clamp01(
    (input.weightKg - wSpec.minKg) / (wSpec.maxKg - wSpec.minKg),
  );
  const quality = clamp01(1 - meatRuin);
  const score = Math.pow(weightNorm, 0.85) * Math.pow(quality, 1.15);
  const marketValueNok = Math.round(
    mSpec.minNok + (mSpec.maxNok - mSpec.minNok) * score,
  );

  const atPerfectMeat = Math.round(
    mSpec.minNok +
      (mSpec.maxNok - mSpec.minNok) * Math.pow(weightNorm, 0.85),
  );
  const atMaxWeightPerfectMeat = mSpec.maxNok;

  return {
    zoneBase,
    hitScore,
    damageFactor,
    ammoFactor,
    velocityNorm,
    velocityFactor,
    meatRuin,
    weightNorm,
    quality,
    score,
    minNok: mSpec.minNok,
    maxNok: mSpec.maxNok,
    marketValueNok,
    lostToWeightNok: Math.max(0, atMaxWeightPerfectMeat - atPerfectMeat),
    lostToMeatNok: Math.max(0, atPerfectMeat - marketValueNok),
    lostVsMaxNok: Math.max(0, atMaxWeightPerfectMeat - marketValueNok),
  };
}

/**
 * Kjøttødeleggelser 0–1.
 * Grønn sone << rød << kropp; ekspanderende kule og høy anslagshastighet øker ruin.
 */
export function meatRuinFromShot(input: {
  zone: HuntShotZone;
  damageFactor: number;
  impactVelocityMps: number;
}): number {
  return computeCarcassValuation({
    species: "tiur",
    weightKg: SPECIES_WEIGHT.tiur.medianKg,
    zone: input.zone,
    damageFactor: input.damageFactor,
    impactVelocityMps: input.impactVelocityMps,
  }).meatRuin;
}

/** Markedsverdi fra vekt + kjøttkvalitet. */
export function marketValueNok(
  species: BirdSpecies,
  weightKg: number,
  meatRuin: number,
): number {
  const wSpec = SPECIES_WEIGHT[species];
  const mSpec = SPECIES_MARKET[species];
  const wNorm = clamp01(
    (weightKg - wSpec.minKg) / (wSpec.maxKg - wSpec.minKg),
  );
  const quality = clamp01(1 - meatRuin);
  const score = Math.pow(wNorm, 0.85) * Math.pow(quality, 1.15);
  return Math.round(mSpec.minNok + (mSpec.maxNok - mSpec.minNok) * score);
}

export function speciesLabelNb(species: BirdSpecies): string {
  return species === "tiur" ? "Tiur" : "Orrfugl";
}

export function meatQualityLabelNb(meatRuin: number): string {
  if (meatRuin < 0.2) return "Pent skutt";
  if (meatRuin < 0.4) return "Bra";
  if (meatRuin < 0.6) return "Noe skade";
  if (meatRuin < 0.8) return "Mye ødelagt";
  return "Kjøttruin";
}

export function zoneLabelNb(zone: HuntShotZone): string {
  switch (zone) {
    case "instant":
      return "Grønn sone";
    case "vital":
      return "Rød sone";
    case "body":
      return "Kropp";
    default:
      return "Ukjent";
  }
}

export function formatWeightKg(kg: number): string {
  return `${kg.toFixed(2).replace(".", ",")} kg`;
}

export function formatMarketKr(nok: number): string {
  return `${nok.toLocaleString("nb-NO")} kr`;
}

export function formatPct01(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits).replace(".", ",")} %`;
}

export function formatFactor(n: number, digits = 2): string {
  return n.toFixed(digits).replace(".", ",");
}

/** Human lines explaining what pulled the price down. */
export function valuationDragNotes(v: CarcassValuation): string[] {
  const notes: string[] = [];
  if (v.lostToWeightNok >= 50) {
    notes.push(
      `Vekt: −${formatMarketKr(v.lostToWeightNok)} mot maks (vekt-score ${formatPct01(v.weightNorm)})`,
    );
  }
  if (v.lostToMeatNok >= 50) {
    notes.push(
      `Kjøttskade: −${formatMarketKr(v.lostToMeatNok)} (kvalitet ${formatPct01(v.quality)})`,
    );
  }
  if (v.hitScore < 10) {
    notes.push(
      `Treff-score ${formatFactor(v.hitScore, 1)}/10 (sonefaktor ${formatFactor(v.zoneBase)})`,
    );
  }
  if (v.damageFactor >= 0.45) {
    notes.push(
      `Kule ekspanderer hardt (damageFactor ${formatFactor(v.damageFactor)} → kulefaktor ${formatFactor(v.ammoFactor)})`,
    );
  } else if (v.damageFactor < 0.3) {
    notes.push(
      `Mild kule (damageFactor ${formatFactor(v.damageFactor)} → kulefaktor ${formatFactor(v.ammoFactor)})`,
    );
  }
  if (v.velocityNorm >= 0.75) {
    notes.push(
      `Høyt anslag (norm ${formatPct01(v.velocityNorm)} → hastighetsfaktor ${formatFactor(v.velocityFactor)})`,
    );
  } else if (v.velocityNorm <= 0.45) {
    notes.push(
      `Lavt anslag (norm ${formatPct01(v.velocityNorm)} → hastighetsfaktor ${formatFactor(v.velocityFactor)}) — litt snillere kjøtt`,
    );
  }
  if (notes.length === 0) {
    notes.push("Nær maks bud — tung fugl og rent treff.");
  }
  return notes;
}

export function createCarcassFromHarvest(
  input: BirdHarvestInput,
  random: () => number = Math.random,
): GameCarcass {
  const weightKg = sampleBirdWeightKg(input.species, random);
  const valuation = computeCarcassValuation({
    species: input.species,
    weightKg,
    zone: input.zone,
    damageFactor: input.damageFactor,
    impactVelocityMps: input.impactVelocityMps,
  });
  return {
    id: `carcass-${input.birdId}-${Date.now().toString(36)}-${Math.floor(random() * 1e4).toString(36)}`,
    birdId: input.birdId,
    species: input.species,
    weightKg,
    meatRuin: valuation.meatRuin,
    zone: input.zone,
    distanceM: Math.round(input.distanceM),
    impactVelocityMps: Math.round(input.impactVelocityMps),
    damageFactor: input.damageFactor,
    marketValueNok: valuation.marketValueNok,
    harvestedAtMs: Date.now(),
    ammoId: input.ammoId,
    ammoLabel: input.ammoLabel,
    caliber: input.caliber,
    projectileType: input.projectileType,
    v0: input.v0 != null ? Math.round(input.v0) : undefined,
    valuation,
  };
}

export function addCarcassToStatsCounts(
  tiur: number,
  orrhaner: number,
  species: BirdSpecies,
): { tiur: number; orrhaner: number } {
  if (species === "tiur") return { tiur: tiur + 1, orrhaner };
  return { tiur, orrhaner: orrhaner + 1 };
}

export function removeCarcassFromStatsCounts(
  tiur: number,
  orrhaner: number,
  species: BirdSpecies,
): { tiur: number; orrhaner: number } {
  if (species === "tiur") return { tiur: Math.max(0, tiur - 1), orrhaner };
  return { tiur, orrhaner: Math.max(0, orrhaner - 1) };
}
