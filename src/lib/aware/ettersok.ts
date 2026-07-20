/**
 * Ettersøk — estimate whether the hunter finds a wounded bird from track work.
 */

import { AWARE_METERS_PER_PCT } from "@/lib/aware/cellGeometry";
import type { ShotPair } from "@/lib/aware/types";

export type EttersokEstimate = {
  findChance: number;
  found: boolean;
  reason: string;
};

/**
 * More track points near the impact → better odds.
 * Instant/vital kills still need tree recovery — much easier than wounded search.
 */
export function estimateEttersokFind(
  pair: ShotPair,
  random: () => number = Math.random,
): EttersokEstimate {
  const isKill =
    pair.resultKind === "instant_kill" || pair.resultKind === "vital_kill";
  const n = pair.trackPoints.length;
  let chance = isKill ? 0.55 : 0.18;
  if (n >= 1) chance += isKill ? 0.25 : 0.2;
  if (n >= 3) chance += isKill ? 0.12 : 0.22;
  if (n >= 5) chance += isKill ? 0.05 : 0.15;

  if (n > 0) {
    const last = pair.trackPoints[n - 1]!;
    const dx = last.x - pair.impact.x;
    const dy = last.y - pair.impact.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) chance += isKill ? 0.15 : 0.25;
    else if (dist < 18) chance += isKill ? 0.08 : 0.12;
    else if (dist > 35) chance -= isKill ? 0.05 : 0.1;
  }

  if (pair.resultKind === "ettersok") {
    chance -= 0.05;
  }

  chance = Math.max(0.05, Math.min(0.98, chance));
  const found = random() < chance;
  const reason = found
    ? isKill
      ? n === 0
        ? "Du finner treet og plukker fuglen."
        : "Skuddparet leder deg til riktig tre."
      : n === 0
        ? "Heldig — du snubler over fuglen uten spor."
        : "Sporene leder deg frem til fuglen."
    : isKill
      ? "Feil tre / du mistet oversikten — sjekk skuddparet på nytt."
      : n < 2
        ? "For få spor — du mister tråden i terrenget."
        : "Du følger feil retning og mister fuglen.";

  return { findChance: chance, found, reason };
}

/** Cell-local impact estimate from stand + bearing + distance. */
export function impactFromShot(opts: {
  stand: { x: number; y: number };
  bearingDeg: number;
  distanceM: number;
  metersPerPct?: number;
}): { x: number; y: number } {
  const mPerPct = opts.metersPerPct ?? AWARE_METERS_PER_PCT;
  const pct = opts.distanceM / mPerPct;
  const rad = ((opts.bearingDeg - 90) * Math.PI) / 180;
  const x = opts.stand.x + Math.cos(rad) * pct;
  const y = opts.stand.y + Math.sin(rad) * pct;
  return {
    x: Math.max(2, Math.min(98, x)),
    y: Math.max(2, Math.min(98, y)),
  };
}
