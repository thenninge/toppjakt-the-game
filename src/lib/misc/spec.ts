/**
 * Misc kit effects — simple two-knob model (for now).
 *
 * Every shop item already has weightGrams. Misc items ALSO declare
 * enduranceGrams: a placeholder “comfort / stamina / coffee” credit
 * expressed in grams-equivalent.
 *
 * Working idea (NOT final engine math):
 *   feltWeightContribution ≈ weightGrams - enduranceGrams
 *
 * Example: Termos with weightGrams — felt mass is the catalog weight.
 * (Older note used a fictional endurance offset; thermos is food gear now.)
 *
 * Everything purchased feeds total gameplay of:
 *   - what ground you can cover
 *   - what the kit weighs (felt + raw)
 *   - what it costs (NOK)
 *
 * Expand with more factor types later; keep misc on these two knobs now.
 */

export type MiscSpec = {
  /**
   * Endurance credit in grams-equivalent.
   * Higher = more offset against felt carry weight / fatigue.
   * 0 = pure dead weight (e.g. soft case in the truck).
   */
  enduranceGrams: number;
  /** Allows walking after skuddlys ends (17:00) when packed in kit. */
  isHeadlamp?: boolean;
  /**
   * Hunt camcorder body — needs a tripod in kit to deploy.
   */
  isCamcorder?: boolean;
  /**
   * Tripod for hunt camcorder. Nerve cost applies on deploy
   * (steel = heavy/slow, carbon = light/fast).
   */
  isCamcorderTripod?: boolean;
  /**
   * Nerve bump (0–1) when deploying camcorder with this gear.
   * On tripods: setup cost. On camcorder body: unused (tripod wins).
   * Defaults to {@link CAMCORDER_SETUP_NERVE} (0.2) when omitted.
   */
  camcorderSetupNerve?: number;
  /**
   * Chronograph — measures real projectile velocity (muzzle / near-muzzle).
   * Gameplay wiring comes later; flag marks the kit item.
   */
  isChronograph?: boolean;
  /**
   * Battery desk fan — blows away heat mirage on the shooting range
   * when packed in kit.
   */
  isRangeFan?: boolean;
  /**
   * Chamber cooler (e.g. Magnetospeed RifleKuhl) — doubles barrel cool
   * rate on the shooting range. Does not clear mirage by itself.
   */
  isChamberCooler?: boolean;
  /**
   * Multiplies barrel-heat mirage when packed in kit (e.g. 0.7 = −30 %).
   * Stacks with other gear. Baseline mirage assumes a suppressor.
   */
  mirageMult?: number;
  /**
   * When true, mirageMult only applies if a suppressor is mounted
   * (suppressor covers). Mirage bands leave this unset.
   */
  mirageRequiresSuppressor?: boolean;
  /**
   * Extra forward calm mass (grams) toward weapon calm — not kit weight.
   * Mirage band: 1× weight. Suppressor covers: 2× weight (same as can).
   */
  weaponCalmGrams?: number;
  /**
   * When true, weaponCalmGrams only applies with a suppressor mounted.
   */
  weaponCalmRequiresSuppressor?: boolean;
  /**
   * Fire starters — each inventory unit is one bål/use.
   * Pack purchase grants {@link fireStarterUsesPerPack} units.
   */
  isFireStarter?: boolean;
  /** Minutes shaved off tyribål when a use is available (e.g. 15). */
  tyribalMinutesSaved?: number;
  /** Uses granted per shop purchase (e.g. 5). */
  fireStarterUsesPerPack?: number;
  /**
   * Sit pad — 1.2× body recovery on short rest and tyribål.
   */
  isSitPad?: boolean;
};

/** Placeholder net contribution to felt load (can be negative = net help). */
export function miscFeltWeightGrams(
  weightGrams: number,
  misc: MiscSpec,
): number {
  return weightGrams - misc.enduranceGrams;
}

export function isHeadlampMisc(misc: MiscSpec): boolean {
  return !!misc.isHeadlamp;
}

export function isCamcorderMisc(misc: MiscSpec): boolean {
  return !!misc.isCamcorder;
}

export function isCamcorderTripodMisc(misc: MiscSpec): boolean {
  return !!misc.isCamcorderTripod;
}

export function isChronographMisc(misc: MiscSpec): boolean {
  return !!misc.isChronograph;
}

export function isRangeFanMisc(misc: MiscSpec): boolean {
  return !!misc.isRangeFan;
}

export function isChamberCoolerMisc(misc: MiscSpec): boolean {
  return !!misc.isChamberCooler;
}

export function isFireStarterMisc(misc: MiscSpec): boolean {
  return !!misc.isFireStarter;
}

export function isSitPadMisc(misc: MiscSpec): boolean {
  return !!misc.isSitPad;
}

/** Lyddemper-cover / wrap — mirage only with a can mounted. */
export function isSuppressorCoverMisc(misc: MiscSpec): boolean {
  return !!misc.mirageRequiresSuppressor;
}

/** Combined mirage multiplier from packed misc (default 1). */
export function miscKitMirageMult(
  miscSpecs: MiscSpec[],
  hasSuppressor: boolean,
): number {
  let m = 1;
  for (const misc of miscSpecs) {
    const mult = misc.mirageMult;
    if (mult == null || !(mult > 0) || !Number.isFinite(mult)) continue;
    if (misc.mirageRequiresSuppressor && !hasSuppressor) continue;
    m *= mult;
  }
  return m;
}

/** Extra weapon-calm grams from packed misc. */
export function miscKitWeaponCalmGrams(
  miscSpecs: MiscSpec[],
  hasSuppressor: boolean,
): number {
  let sum = 0;
  for (const misc of miscSpecs) {
    const g = misc.weaponCalmGrams ?? 0;
    if (!(g > 0) || !Number.isFinite(g)) continue;
    if (misc.weaponCalmRequiresSuppressor && !hasSuppressor) continue;
    sum += g;
  }
  return sum;
}
