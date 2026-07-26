/**
 * CB Customs — gunsmith / finish work applied to the hunter's setup.
 *
 * MOA improvements reduce the angular dispersion envelope (tighter groups).
 * Weight work lowers kit carry mass without changing precision.
 * Custom camo adds sneak % so birds build nerve slower.
 */

export type CustomsMods = {
  bedding: boolean;
  pillarBedding: boolean;
  fluting: boolean;
  stockSlim: boolean;
  /** Light trigger — halves POI error from a bad break on the trigger bar. */
  triggerTuning: boolean;
  /** Paid setup — unlocks ordering CB Home Load ammo. */
  homeLoadsSetup: boolean;
  customCamo: boolean;
  /** Rear bag rider — +calm and a touch of MOA. */
  bagrider: boolean;
  /** Action trueing / lapping — tighter groups. */
  actionTrueing: boolean;
  /** Custom cheek riser / comb — a bit more calm. */
  cheekRiser: boolean;
  /** Barrel crown job — small MOA improvement. */
  barrelCrown: boolean;
};

export const EMPTY_CUSTOMS_MODS: CustomsMods = {
  bedding: false,
  pillarBedding: false,
  fluting: false,
  stockSlim: false,
  triggerTuning: false,
  homeLoadsSetup: false,
  customCamo: false,
  bagrider: false,
  actionTrueing: false,
  cheekRiser: false,
  barrelCrown: false,
};

export type CustomsServiceId =
  | "bedding"
  | "pillar_bedding"
  | "fluting"
  | "stock_slim"
  | "trigger_tuning"
  | "home_loads_setup"
  | "custom_camo"
  | "bagrider"
  | "action_trueing"
  | "cheek_riser"
  | "barrel_crown";

export type CustomsService = {
  id: CustomsServiceId;
  name: string;
  priceNok: number;
  /** Player-facing effect blurb. */
  effect: string;
  /** Coming soon — not purchasable. */
  comingSoon?: boolean;
};

export const BEDDING_MOA = 0.04;
export const PILLAR_BEDDING_MOA = 0.06;
/** Home-load ammo is ~0.05 MOA tighter than top factory match (wired in catalog). */
export const HOME_LOAD_MOA = 0.05;
export const FLUTING_WEIGHT_G = 500;
/** Fraction of stock (or estimated stock) mass removed by slanking. */
export const STOCK_SLIM_FRACTION = 0.25;
/**
 * Multiplier on kit bird-spot after custom camo paint (legacy).
 * Prefer {@link CUSTOM_CAMO_SNEAK_BONUS_PCT} with the % clothing model.
 */
export const CUSTOM_CAMO_SPOT_MULT = 0.85;
/** Extra sneak % from CB custom camo (~15 % less nerve pressure). */
export const CUSTOM_CAMO_SNEAK_BONUS_PCT = 15;
/**
 * Multiplier on trigger-pull POI error after trigger tuning.
 * 0.5 = half the miss distance from a bad release vs the trigger-bar mark.
 */
export const TRIGGER_TUNING_PULL_SCALE = 0.5;

/** MOA cut from a fitted CB Bagrider (rear rest). */
export const BAGRIDER_MOA = 0.05;
/** Calm multiplier with CB Bagrider (+15%). */
export const BAGRIDER_CALM_MULT = 1.15;
/** Action trueing / lapping — gunsmith flex MOA. */
export const ACTION_TRUEING_MOA = 0.04;
/** Cheek riser — modest calm from better cheek weld. */
export const CHEEK_RISER_CALM_MULT = 1.08;
/** Fresh crown — small MOA improvement. */
export const BARREL_CROWN_MOA = 0.03;

export const HOME_LOAD_SETUP_NOK = 5000;
export const HOME_LOAD_PER_ROUND_NOK = 100;
/** Default order size when buying home loads. */
export const HOME_LOAD_ORDER_ROUNDS = 20;

export const CUSTOMS_SERVICES: CustomsService[] = [
  {
    id: "bedding",
    name: "Bedding",
    priceNok: 2500,
    effect: `Forbedrer spredning med ${BEDDING_MOA.toFixed(2)} MOA (strammere grupper).`,
  },
  {
    id: "pillar_bedding",
    name: "Søylebedding",
    priceNok: 3500,
    effect: `Forbedrer spredning med ${PILLAR_BEDDING_MOA.toFixed(2)} MOA. Erstatter vanlig bedding.`,
  },
  {
    id: "fluting",
    name: "Fluting av pipe",
    priceNok: 5000,
    effect: `Reduserer vekt med ${FLUTING_WEIGHT_G} g — beholder presisjon.`,
  },
  {
    id: "stock_slim",
    name: "Slanking av stokk",
    priceNok: 3000,
    effect: `Reduserer stokkvekt med ${Math.round(STOCK_SLIM_FRACTION * 100)}% — beholder presisjon.`,
  },
  {
    id: "trigger_tuning",
    name: "Trigger tuning",
    priceNok: 3000,
    effect: `Fjærlett avtrekk — halverer treffpunktfeil når avtrekket slippes feil ift merket på trigger-baren.`,
  },
  {
    id: "home_loads_setup",
    name: "Home loads (oppsett)",
    priceNok: HOME_LOAD_SETUP_NOK,
    effect: `Låser opp spesiallager for presisjon (−${HOME_LOAD_MOA.toFixed(2)} MOA vs top match). Deretter ${HOME_LOAD_PER_ROUND_NOK},-/skudd.`,
  },
  {
    id: "custom_camo",
    name: "Custom camo",
    priceNok: 1000,
    effect:
      "+15 % sneak — fuglen bygger nerve saktere (samme stack som klær).",
  },
  {
    id: "bagrider",
    name: "CB Bagrider",
    priceNok: 4500,
    effect: `Bakre bag-rider — +${Math.round((BAGRIDER_CALM_MULT - 1) * 100)}% calm og −${BAGRIDER_MOA.toFixed(2)} MOA.`,
  },
  {
    id: "action_trueing",
    name: "Action trueing",
    priceNok: 8000,
    effect: `Lapping / trueing av action — −${ACTION_TRUEING_MOA.toFixed(2)} MOA.`,
  },
  {
    id: "cheek_riser",
    name: "Cheek riser",
    priceNok: 2500,
    effect: `Custom comb / cheek riser — +${Math.round((CHEEK_RISER_CALM_MULT - 1) * 100)}% calm (bedre kinnfeste).`,
  },
  {
    id: "barrel_crown",
    name: "Barrel crown",
    priceNok: 3500,
    effect: `Ny crown på pipa — −${BARREL_CROWN_MOA.toFixed(2)} MOA.`,
  },
];

export function normalizeCustomsMods(raw: unknown): CustomsMods {
  if (typeof raw !== "object" || raw == null) return { ...EMPTY_CUSTOMS_MODS };
  const o = raw as Record<string, unknown>;
  return {
    bedding: o.bedding === true,
    pillarBedding: o.pillarBedding === true,
    fluting: o.fluting === true,
    stockSlim: o.stockSlim === true,
    triggerTuning: o.triggerTuning === true,
    homeLoadsSetup: o.homeLoadsSetup === true,
    customCamo: o.customCamo === true,
    bagrider: o.bagrider === true,
    actionTrueing: o.actionTrueing === true,
    cheekRiser: o.cheekRiser === true,
    barrelCrown: o.barrelCrown === true,
  };
}

/** Scale on trigger-bar pull error → POI (1 = stock trigger, 0.5 = tuned). */
export function customsTriggerPullScale(mods: CustomsMods): number {
  return mods.triggerTuning ? TRIGGER_TUNING_PULL_SCALE : 1;
}

/** Negative MOA delta from bedding, bagrider, trueing, crown. */
export function customsBeddingMoaDelta(mods: CustomsMods): number {
  let delta = 0;
  if (mods.pillarBedding) delta -= PILLAR_BEDDING_MOA;
  else if (mods.bedding) delta -= BEDDING_MOA;
  if (mods.bagrider) delta -= BAGRIDER_MOA;
  if (mods.actionTrueing) delta -= ACTION_TRUEING_MOA;
  if (mods.barrelCrown) delta -= BARREL_CROWN_MOA;
  return delta;
}

/** Multiplier on weapon calm (bagrider × cheek riser). */
export function customsCalmMultiplier(mods: CustomsMods): number {
  let m = 1;
  if (mods.bagrider) m *= BAGRIDER_CALM_MULT;
  if (mods.cheekRiser) m *= CHEEK_RISER_CALM_MULT;
  return m;
}

/**
 * Grams removed from kit carry by fluting + stock slim.
 * `stockWeightGrams` = equipped stock; if missing, estimate ~30% of rifle mass.
 */
export function customsWeightReductionGrams(
  mods: CustomsMods,
  opts: { rifleWeightGrams: number; stockWeightGrams: number | null },
): number {
  let cut = 0;
  if (mods.fluting) cut += FLUTING_WEIGHT_G;
  if (mods.stockSlim) {
    const base =
      opts.stockWeightGrams != null && opts.stockWeightGrams > 0
        ? opts.stockWeightGrams
        : Math.round(opts.rifleWeightGrams * 0.3);
    cut += Math.round(base * STOCK_SLIM_FRACTION);
  }
  return cut;
}

/** @deprecated Prefer {@link applyCustomCamoSneakPct}. */
export function applyCustomCamoBirdSpot(
  kitBirdSpot: number,
  mods: CustomsMods,
): number {
  if (!mods.customCamo) return kitBirdSpot;
  return Math.max(0.05, kitBirdSpot * CUSTOM_CAMO_SPOT_MULT);
}

/** Add CB custom-camo sneak bonus to kit clothing sneak %. */
export function applyCustomCamoSneakPct(
  kitSneakPct: number,
  mods: CustomsMods,
): number {
  if (!mods.customCamo) return kitSneakPct;
  return kitSneakPct + CUSTOM_CAMO_SNEAK_BONUS_PCT;
}

export function serviceOwned(
  mods: CustomsMods,
  id: CustomsServiceId,
): boolean {
  if (id === "bedding") return mods.bedding || mods.pillarBedding;
  if (id === "pillar_bedding") return mods.pillarBedding;
  if (id === "fluting") return mods.fluting;
  if (id === "stock_slim") return mods.stockSlim;
  if (id === "trigger_tuning") return mods.triggerTuning;
  if (id === "home_loads_setup") return mods.homeLoadsSetup;
  if (id === "custom_camo") return mods.customCamo;
  if (id === "bagrider") return mods.bagrider;
  if (id === "action_trueing") return mods.actionTrueing;
  if (id === "cheek_riser") return mods.cheekRiser;
  if (id === "barrel_crown") return mods.barrelCrown;
  return false;
}

/** Home-load catalog ids by caliber label. */
export const HOME_LOAD_AMMO_BY_CALIBER: Record<string, string> = {
  "6,5×55": "ammo-cb-homeload-65x55",
  "6,5 Creedmoor": "ammo-cb-homeload-65cm",
  ".308 Win": "ammo-cb-homeload-308",
  ".30-06": "ammo-cb-homeload-3006",
  ".223 Rem": "ammo-cb-homeload-223",
  ".22 LR": "ammo-cb-homeload-22lr",
};

export function isHomeLoadAmmoId(itemId: string): boolean {
  return itemId.startsWith("ammo-cb-homeload-");
}
