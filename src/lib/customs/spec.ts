/**
 * CB Customs — gunsmith / finish work applied to the hunter's setup.
 *
 * MOA improvements reduce the angular dispersion envelope (tighter groups).
 * Weight work lowers kit carry mass without changing precision.
 * Custom camo multiplies kit bird-spot (lower = harder for birds to see you).
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
};

export const EMPTY_CUSTOMS_MODS: CustomsMods = {
  bedding: false,
  pillarBedding: false,
  fluting: false,
  stockSlim: false,
  triggerTuning: false,
  homeLoadsSetup: false,
  customCamo: false,
};

export type CustomsServiceId =
  | "bedding"
  | "pillar_bedding"
  | "fluting"
  | "stock_slim"
  | "trigger_tuning"
  | "home_loads_setup"
  | "custom_camo"
  | "custom_build";

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
 * Multiplier on kit bird-spot after custom camo paint.
 * Lower = better concealment. ~15% harder for birds to pick you up.
 */
export const CUSTOM_CAMO_SPOT_MULT = 0.85;
/**
 * Multiplier on trigger-pull POI error after trigger tuning.
 * 0.5 = half the miss distance from a bad release vs the trigger-bar mark.
 */
export const TRIGGER_TUNING_PULL_SCALE = 0.5;

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
      "Maling / finish tilpasset jakten — fuglen får litt vanskeligere for å spotte deg.",
  },
  {
    id: "custom_build",
    name: "Custom build",
    priceNok: 0,
    effect: "Full custom rifle fra blank — CNC, pipe, chassis.",
    comingSoon: true,
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
  };
}

/** Scale on trigger-bar pull error → POI (1 = stock trigger, 0.5 = tuned). */
export function customsTriggerPullScale(mods: CustomsMods): number {
  return mods.triggerTuning ? TRIGGER_TUNING_PULL_SCALE : 1;
}

/** Negative MOA delta from bedding work (pillar supersedes plain bedding). */
export function customsBeddingMoaDelta(mods: CustomsMods): number {
  if (mods.pillarBedding) return -PILLAR_BEDDING_MOA;
  if (mods.bedding) return -BEDDING_MOA;
  return 0;
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

export function applyCustomCamoBirdSpot(
  kitBirdSpot: number,
  mods: CustomsMods,
): number {
  if (!mods.customCamo) return kitBirdSpot;
  return Math.max(0.05, kitBirdSpot * CUSTOM_CAMO_SPOT_MULT);
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
