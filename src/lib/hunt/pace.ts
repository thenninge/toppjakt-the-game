/**
 * Player pace / caution while moving between hunt grid cells.
 * Travel minutes = baseCellMinutes(effort) / speed.
 */

export type HuntPaceId =
  | "extreme-caution"
  | "caution"
  | "normal"
  | "speedy";

export type HuntPace = {
  id: HuntPaceId;
  label: string;
  blurb: string;
  /** Chance to notice birds in trees while moving / spotting. */
  spottingProbability: number;
  /** Fraction of max speed (1 = full speed). */
  speed: number;
  /** Higher = mental fatigue accumulates faster. */
  mentalStrain: number;
  /** Higher = physical fatigue accumulates faster. */
  physicalStrain: number;
};

/** Four paces — do not expand without asking. */
export const HUNT_PACES: HuntPace[] = [
  {
    id: "extreme-caution",
    label: "Extreme caution",
    blurb:
      "Saktere, ser nesten alt. 15 % sjanse for å spotte fugl før den ser deg.",
    spottingProbability: 0.95,
    speed: 0.3,
    mentalStrain: 1,
    physicalStrain: 0.1,
  },
  {
    id: "caution",
    label: "Caution",
    blurb: "Forsiktig jaktfart. God spotting, litt mental belastning.",
    spottingProbability: 0.75,
    speed: 0.5,
    mentalStrain: 0.8,
    physicalStrain: 0.2,
  },
  {
    id: "normal",
    label: "Normal hunt",
    blurb: "Balansert tempo og oppmerksomhet.",
    spottingProbability: 0.6,
    speed: 0.7,
    mentalStrain: 0.5,
    physicalStrain: 0.5,
  },
  {
    id: "speedy",
    label: "Speedy transport",
    blurb: "Raskt gjennom. Ser lite, fysisk slitsomt.",
    spottingProbability: 0.2,
    speed: 1,
    mentalStrain: 0.1,
    physicalStrain: 1,
  },
];

export function getHuntPace(id: HuntPaceId): HuntPace {
  const found = HUNT_PACES.find((p) => p.id === id);
  if (!found) return HUNT_PACES[2]!;
  return found;
}

/**
 * Chance to auto-spot a bird after arriving on Extreme caution
 * («ser fuglen før den ser deg»).
 */
export const EXTREME_CAUTION_PRESPOT_CHANCE = 0.15;
