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
  /** Bolt-body fluting — light weight save (separate from pipe fluting). */
  boltFluting: boolean;
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
  /** Titanium nitride / TiN-style action coating — faster bolt cycle. */
  actionTiCoating: boolean;
  /** Custom cheek riser / comb — a bit more calm. */
  cheekRiser: boolean;
  /** Soft buttpad — lower felt recoil (stay in the glass after the shot). */
  buttpad: boolean;
  /** Barrel crown job — small MOA improvement. */
  barrelCrown: boolean;
  /** Custom bolt knob — cosmetic + slightly faster bolt cycle. */
  customBoltKnob: boolean;
  /** Hex color for the custom bolt knob (e.g. #ff6600). */
  boltKnobColor: string;
  /** CB 10-round magazine (default factory = 5). */
  magCapacity10: boolean;
  /** CB 15-round magazine (supersedes 10). */
  magCapacity15: boolean;
};

/** Default knob tint when the service is first bought. */
export const DEFAULT_BOLT_KNOB_COLOR = "#e02020";

/** Preset swatches in CB Customs color picker. */
export const BOLT_KNOB_COLOR_PRESETS = [
  "#e02020",
  "#ff6600",
  "#ffcc00",
  "#22aa44",
  "#2266cc",
  "#cc44aa",
  "#111111",
  "#c5ccd4",
  "#ffffff",
] as const;

export function normalizeBoltKnobColor(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_BOLT_KNOB_COLOR;
  const s = raw.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(s)) {
    const r = s[1]!;
    const g = s[2]!;
    const b = s[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return DEFAULT_BOLT_KNOB_COLOR;
}

export const EMPTY_CUSTOMS_MODS: CustomsMods = {
  bedding: false,
  pillarBedding: false,
  fluting: false,
  boltFluting: false,
  stockSlim: false,
  triggerTuning: false,
  homeLoadsSetup: false,
  customCamo: false,
  bagrider: false,
  actionTrueing: false,
  actionTiCoating: false,
  cheekRiser: false,
  buttpad: false,
  barrelCrown: false,
  customBoltKnob: false,
  boltKnobColor: DEFAULT_BOLT_KNOB_COLOR,
  magCapacity10: false,
  magCapacity15: false,
};

export type CustomsServiceId =
  | "bedding"
  | "pillar_bedding"
  | "fluting"
  | "bolt_fluting"
  | "stock_slim"
  | "trigger_tuning"
  | "home_loads_setup"
  | "custom_camo"
  | "bagrider"
  | "action_trueing"
  | "action_ti_coating"
  | "cheek_riser"
  | "buttpad"
  | "barrel_crown"
  | "custom_bolt_knob"
  | "mag_10"
  | "mag_15";

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
/** Bolt-body fluting — modest mass cut. */
export const BOLT_FLUTING_WEIGHT_G = 100;
/** Fraction of stock (or estimated stock) mass removed by slanking. */
export const STOCK_SLIM_FRACTION = 0.25;
/**
 * Share of rifle catalog mass treated as the factory stock.
 * When an aftermarket stock is equipped, this is subtracted from the rifle
 * so catalog rifle + new stock does not double-count.
 */
export const FACTORY_STOCK_WEIGHT_FRACTION = 0.3;
/**
 * Share of rifle catalog mass treated as the factory barrel.
 * When a custom CB pipe is installed, this is subtracted from the rifle
 * and the custom blank weight is added instead.
 */
export const FACTORY_BARREL_WEIGHT_FRACTION = 0.35;

/** Estimated factory stock grams baked into a rifle catalog weight. */
export function estimatedFactoryStockGrams(rifleWeightGrams: number): number {
  return Math.round(Math.max(0, rifleWeightGrams) * FACTORY_STOCK_WEIGHT_FRACTION);
}

/** Estimated factory barrel grams baked into a rifle catalog weight. */
export function estimatedFactoryBarrelGrams(rifleWeightGrams: number): number {
  return Math.round(Math.max(0, rifleWeightGrams) * FACTORY_BARREL_WEIGHT_FRACTION);
}
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
/** Soft buttpad — recoil damping only (no calm). */
export const BUTTPAD_RECOIL_DAMPING_MULT = 1.25;
/** Bagrider also softens muzzle jump. */
export const BAGRIDER_RECOIL_DAMPING_MULT = 1.2;
/** Cheek riser — slightly better recoil control. */
export const CHEEK_RISER_RECOIL_DAMPING_MULT = 1.12;
/** Fresh crown — small MOA improvement. */
export const BARREL_CROWN_MOA = 0.03;

/** Base real-time wait after a shot before the next break (bolt cycle). */
export const BASE_BOLT_CYCLE_MS = 1200;
/** Action Ti-coating — 20 % faster bolt cycle (×0.8). */
export const ACTION_TI_RELOAD_MULT = 0.8;
/** Custom bolt knob — 10 % faster bolt cycle (×0.9). */
export const BOLT_KNOB_RELOAD_MULT = 0.9;

/** Factory / XXL default detachable mag capacity. */
export const DEFAULT_MAG_CAPACITY = 5;
/** Extra real-time pause (ms) when a mag change is required mid-string. */
export const MAG_CHANGE_EXTRA_MS = 4000;

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
    id: "bolt_fluting",
    name: "Bolt fluting",
    priceNok: 1000,
    effect: `Fluting av bolt — sparer ${BOLT_FLUTING_WEIGHT_G} g.`,
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
    effect: `Bakre bag-rider — +${Math.round((BAGRIDER_CALM_MULT - 1) * 100)}% calm, −${BAGRIDER_MOA.toFixed(2)} MOA, ×${BAGRIDER_RECOIL_DAMPING_MULT.toFixed(2)} rekyl-demping.`,
  },
  {
    id: "action_trueing",
    name: "Action trueing",
    priceNok: 8000,
    effect: `Lapping / trueing av action — −${ACTION_TRUEING_MOA.toFixed(2)} MOA.`,
  },
  {
    id: "action_ti_coating",
    name: "Action Ti-coating",
    priceNok: 1000,
    effect: `TiN / Ti-coating på action — ${Math.round((1 - ACTION_TI_RELOAD_MULT) * 100)}% raskere omlading (kortere delay mellom skudd).`,
  },
  {
    id: "cheek_riser",
    name: "Cheek riser",
    priceNok: 2500,
    effect: `Custom comb / cheek riser — +${Math.round((CHEEK_RISER_CALM_MULT - 1) * 100)}% calm, ×${CHEEK_RISER_RECOIL_DAMPING_MULT.toFixed(2)} rekyl-demping.`,
  },
  {
    id: "buttpad",
    name: "CB Soft Buttpad",
    priceNok: 3500,
    effect: `Myk bakkappe — ×${BUTTPAD_RECOIL_DAMPING_MULT.toFixed(2)} rekyl-demping (lettere å følge fuglen i kikkerten etter skudd).`,
  },
  {
    id: "barrel_crown",
    name: "Barrel crown",
    priceNok: 3500,
    effect: `Ny crown på pipa — −${BARREL_CROWN_MOA.toFixed(2)} MOA.`,
  },
  {
    id: "custom_bolt_knob",
    name: "Custom bolt knob",
    priceNok: 1000,
    effect: `Custom knott — velg farge. ${Math.round((1 - BOLT_KNOB_RELOAD_MULT) * 100)}% raskere omlading (kortere delay mellom skudd). Vises i Admire current rig.`,
  },
  {
    id: "mag_10",
    name: "Custom magasin 10 skudd",
    priceNok: 2500,
    effect: `10-skudds magasin (standard fra XXL er ${DEFAULT_MAG_CAPACITY}). Færre magasinbytter i konkurranse.`,
  },
  {
    id: "mag_15",
    name: "Custom magasin 15 skudd",
    priceNok: 5000,
    effect: `15-skudds magasin — erstatter 10-skudds. Færre magasinbytter i konkurranse.`,
  },
];

export function normalizeCustomsMods(raw: unknown): CustomsMods {
  if (typeof raw !== "object" || raw == null) return { ...EMPTY_CUSTOMS_MODS };
  const o = raw as Record<string, unknown>;
  return {
    bedding: o.bedding === true,
    pillarBedding: o.pillarBedding === true,
    fluting: o.fluting === true,
    boltFluting: o.boltFluting === true,
    stockSlim: o.stockSlim === true,
    triggerTuning: o.triggerTuning === true,
    homeLoadsSetup: o.homeLoadsSetup === true,
    customCamo: o.customCamo === true,
    bagrider: o.bagrider === true,
    actionTrueing: o.actionTrueing === true,
    actionTiCoating: o.actionTiCoating === true,
    cheekRiser: o.cheekRiser === true,
    buttpad: o.buttpad === true,
    barrelCrown: o.barrelCrown === true,
    customBoltKnob: o.customBoltKnob === true,
    boltKnobColor: normalizeBoltKnobColor(o.boltKnobColor),
    magCapacity10: o.magCapacity10 === true || o.magCapacity15 === true,
    magCapacity15: o.magCapacity15 === true,
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

/** Multiplier on recoil damping (bagrider × cheek × buttpad). */
export function customsRecoilDampingMultiplier(mods: CustomsMods): number {
  let m = 1;
  if (mods.bagrider) m *= BAGRIDER_RECOIL_DAMPING_MULT;
  if (mods.cheekRiser) m *= CHEEK_RISER_RECOIL_DAMPING_MULT;
  if (mods.buttpad) m *= BUTTPAD_RECOIL_DAMPING_MULT;
  return m;
}

/**
 * Grams removed from kit carry by fluting + stock slim.
 * `stockWeightGrams` = equipped stock; if missing, estimate factory stock share.
 * Pass `hasCustomBarrel` so factory-pipe fluting is not applied after a rebarrel.
 */
export function customsWeightReductionGrams(
  mods: CustomsMods,
  opts: {
    rifleWeightGrams: number;
    stockWeightGrams: number | null;
    hasCustomBarrel?: boolean;
  },
): number {
  let cut = 0;
  if (mods.fluting && !opts.hasCustomBarrel) cut += FLUTING_WEIGHT_G;
  if (mods.boltFluting) cut += BOLT_FLUTING_WEIGHT_G;
  if (mods.stockSlim) {
    const base =
      opts.stockWeightGrams != null && opts.stockWeightGrams > 0
        ? opts.stockWeightGrams
        : estimatedFactoryStockGrams(opts.rifleWeightGrams);
    cut += Math.round(base * STOCK_SLIM_FRACTION);
  }
  return cut;
}

/** Multiplier on bolt-cycle wait (lower = faster reload between shots). */
export function customsReloadTimeMult(mods: CustomsMods): number {
  let m = 1;
  if (mods.actionTiCoating) m *= ACTION_TI_RELOAD_MULT;
  if (mods.customBoltKnob) m *= BOLT_KNOB_RELOAD_MULT;
  return m;
}

/** Real-ms bolt cycle after a shot before the next break is allowed. */
export function customsBoltCycleMs(mods: CustomsMods): number {
  return Math.max(
    200,
    Math.round(BASE_BOLT_CYCLE_MS * customsReloadTimeMult(mods)),
  );
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

/** Effective magazine capacity (5 default, 10 / 15 from CB Customs). */
export function customsMagCapacity(mods: CustomsMods): number {
  if (mods.magCapacity15) return 15;
  if (mods.magCapacity10) return 10;
  return DEFAULT_MAG_CAPACITY;
}

export function serviceOwned(
  mods: CustomsMods,
  id: CustomsServiceId,
): boolean {
  if (id === "bedding") return mods.bedding || mods.pillarBedding;
  if (id === "pillar_bedding") return mods.pillarBedding;
  if (id === "fluting") return mods.fluting;
  if (id === "bolt_fluting") return mods.boltFluting;
  if (id === "stock_slim") return mods.stockSlim;
  if (id === "trigger_tuning") return mods.triggerTuning;
  if (id === "home_loads_setup") return mods.homeLoadsSetup;
  if (id === "custom_camo") return mods.customCamo;
  if (id === "bagrider") return mods.bagrider;
  if (id === "action_trueing") return mods.actionTrueing;
  if (id === "action_ti_coating") return mods.actionTiCoating;
  if (id === "cheek_riser") return mods.cheekRiser;
  if (id === "buttpad") return mods.buttpad;
  if (id === "barrel_crown") return mods.barrelCrown;
  if (id === "custom_bolt_knob") return mods.customBoltKnob;
  if (id === "mag_10") return mods.magCapacity10 || mods.magCapacity15;
  if (id === "mag_15") return mods.magCapacity15;
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
