/**
 * Rifle precision floor — “average best accuracy” in MOA.
 *
 * This is what the platform is *known* to be able to achieve with
 * ammo that likes it — not a guarantee for every box.
 *
 * Scale (guide):
 *   ~0.25 MOA  megabra (e.g. Sauer 200 STR + custom stainless Krieger)
 *   ~0.50 MOA  bra-bra / solid hunting precision
 *   >1.0 MOA   budget / unknown barrels
 *
 * ## Engine: per-player ammo affinity (uflaks / hell)
 * Buying a good rifle does not auto-unlock its floor with every load.
 * On first serious testing of (player, rifleId, ammoId), roll a stable
 * affinity factor for that trio. Bad luck → that ammo never groups well
 * in *their* rifle; they must try other ammo — like real hunters.
 *
 * Conceptual:
 *   base = combine(rifle.averageBestAccuracyMoa, ammo.maxAchievableMoa, stock.moaDelta, …)
 *   effective = base * playerAmmoAffinity(playerId, rifleId, ammoId)
 *
 * Affinity is persistent per save (not re-rolled each shot).
 */

import type { Score10 } from "@/lib/shop/score";
import { clampScore10 } from "@/lib/shop/score";

export type RifleSpec = {
  /**
   * Average best accuracy (MOA) this rifle is known for with matching ammo.
   * Lower = tighter. Shown in shop as reference; final groups need ammo + affinity.
   */
  averageBestAccuracyMoa: number;
};

/**
 * Tunable table — edit these numbers freely.
 * Keys = catalog rifle ids.
 */
export const RIFLE_AVERAGE_BEST_MOA: Record<string, number> = {
  // Megabra / competition class
  "rifle-ai-at-x": 0.25,
  "rifle-sauer-200str": 0.28, // custom Krieger builds can sit ~0.25

  // Bra-bra precision / varmint / LR hunting
  "rifle-tikka-t3x-tac-a1": 0.35,
  "rifle-tikka-t3x-super-varminter": 0.35,
  "rifle-cz457": 0.4, // Varmint MTR rimfire
  "rifle-bergara-b14-hmr": 0.4,
  "rifle-sako-90-peak": 0.4,
  "rifle-sako-s20": 0.45,
  "rifle-sauer-404": 0.45,
  "rifle-browning-xbolt-pro": 0.45,
  "rifle-sako-85-finnlight": 0.5,
  "rifle-blaser-r8": 0.5,

  // Solid hunting / mid
  "rifle-rem-700-aac-sd": 0.55,
  "rifle-bergara-b14-ridge": 0.55,
  "rifle-tikka-t3x-lite": 0.6,
  "rifle-howa-1500-hs": 0.65,
  "rifle-ruger-american-predator": 0.75,
  "rifle-ruger-american-ranch-300blk": 0.9,
  "rifle-cz455": 0.8,
  "rifle-rem-700-sps": 0.85,
  "rifle-cz452": 0.55, // uncle gift — solid .22 with matching ammo

  // Budget
  "rifle-magasinet-budget-308": 1.25,
  "rifle-jula-youth-22": 1.5,
};

export function rifleAverageBestMoa(rifleId: string): number {
  const v = RIFLE_AVERAGE_BEST_MOA[rifleId];
  if (v == null) {
    throw new Error(`Missing averageBestAccuracyMoa for rifle "${rifleId}"`);
  }
  return v;
}

/** Map MOA floor → Score10 (higher = better) for shop UX. */
export function averageBestMoaToScore10(moa: number): Score10 {
  // 0.25 → 10, 0.5 → 8, 1.0 → 5, 1.5 → 2
  if (moa <= 0.25) return 10;
  if (moa >= 1.5) return 1;
  const t = (moa - 0.25) / (1.5 - 0.25);
  return clampScore10(10 - t * 9);
}

/**
 * Placeholder for per-player ammo affinity.
 * Engine will persist rolls; this is the default band until wired to saves.
 * 1.0 = “typical”; >1 worsens group; <1 is lucky ammo match.
 */
export const AMMO_AFFINITY_MIN = 0.85;
export const AMMO_AFFINITY_MAX = 1.35;

export function rollAmmoAffinity(
  random: () => number = Math.random,
): number {
  return (
    AMMO_AFFINITY_MIN +
    random() * (AMMO_AFFINITY_MAX - AMMO_AFFINITY_MIN)
  );
}
