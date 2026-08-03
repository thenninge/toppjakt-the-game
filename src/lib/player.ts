import type { GameCarcass } from "@/lib/hunt/carcass";
import type { JaktkortBook } from "@/lib/hunt/jaktkort";
import type { GameLang } from "@/lib/i18n/lang";
import {
  EMPTY_CUSTOMS_MODS,
  HOME_LOAD_AMMO_BY_CALIBER,
  type CustomsMods,
} from "@/lib/customs/spec";
import {
  clampElevationMmAt100,
  clickUnitLabel,
  milClicksToScopeClicks,
  mmAt100ToAngular,
} from "@/lib/optics/clicks";
import type { ScopeClickUnit, ScopeSpec } from "@/lib/optics/spec";
import { applyScopeClickError } from "@/lib/optics/spec";
import type { GameRealism } from "@/lib/optics/turretStyle";
import {
  DEFAULT_SCOPE_AIM_CONTROL,
  type ScopeAimControl,
} from "@/lib/range/scopeAimControl";
import {
  DEFAULT_FOCUS_TRIGGER_BAR_LENGTH,
  DEFAULT_SCOPE_ZOOM_ON_FOCUS,
  DEFAULT_ZEN_MODE,
  type FocusTriggerBarLength,
} from "@/lib/range/playerScopeSettings";
import { isPackableFoodKind } from "@/lib/food/spec";
import { spentBrassItemIdForAmmo, isSpentBrassItemId, spentBrassKeyForCaliber } from "@/lib/reloading/brass";
import {
  createDefaultLoadBenchRecipe,
  type LoadBenchRecipe,
} from "@/lib/reloading/recipe";
import type {
  InstalledCustomBarrel,
  StoredCustomBarrel,
} from "@/lib/customs/customBarrel";
import {
  customsModsAfterPipeInstall,
  toStoredCustomBarrel,
} from "@/lib/customs/customBarrel";
import {
  type ArmedLoadPlan,
} from "@/lib/reloading/loadPhysics";
import type { LoadDevTable } from "@/lib/reloading/loadDevTable";
import { createEmptyLoadDevTable } from "@/lib/reloading/loadDevTable";
import type { LoadBookEntry } from "@/lib/reloading/loadBook";
import {
  createEmptyLoadBook,
  buildLoadBookEntryFromLot,
  upsertLoadBookEntry,
} from "@/lib/reloading/loadBook";
import type { HomeLoadedLot } from "@/lib/reloading/homeLoadedAmmo";
import {
  buildHomeLotFromRow,
  isHomeLoadAmmoId,
  patchHomeLoadedLot,
  resolveHomeLoadItem,
  spentBrassItemIdForHomeLot,
} from "@/lib/reloading/homeLoadedAmmo";
import { removeLoadDevRow } from "@/lib/reloading/loadDevTable";
import { powderGrainsPerBox } from "@/lib/reloading/componentStock";
import { isPowderItem } from "@/lib/reloading/components";
import type { KestrelGunProfile } from "@/lib/ballistics/kestrelProfile";
import type { RealLoadProfile } from "@/lib/ballistics/realLoad";
import type { AwareHuntState } from "@/lib/aware/shotPairStorage";
import {
  createJaktkort,
  emptyJaktkortBook,
  getJaktkortForTerrain,
  upsertJaktkort,
} from "@/lib/hunt/jaktkort";
import { getHuntingTerrain } from "@/lib/hunt/terrain";
import { sanitizeKitScopeMountIds } from "@/lib/mount/fit";
import { getShopItem } from "@/lib/shop/catalog";
import type { ShopItem } from "@/lib/shop/types";
import {
  isAmmoItem,
  isBackpackItem,
  isChestrigItem,
  isFoodItem,
  isMiscItem,
  isMountItem,
  isRifleItem,
  isScopeItem,
  isStockItem,
  isThermalItem,
} from "@/lib/shop/types";
import {
  mountClearsZeroOnMountRemove,
  mountClearsZeroOnScopeRemove,
  type MountTier,
} from "@/lib/mount/spec";
import { isFireStarterMisc } from "@/lib/misc/spec";

/** Live home-load lots for resolvePlayerItem (synced from save state). */
let homeLotCache: readonly HomeLoadedLot[] = [];

export function syncHomeLoadedLotCache(lots: readonly HomeLoadedLot[]): void {
  homeLotCache = lots;
}

export type InventoryEntry = {
  itemId: string;
  qty: number;
};

export type ZeroingProfile = {
  /**
   * Random first-time combo offset, stored as mm-at-100 m (angular).
   * Capped to ±MAX_ZERO_BASE_OFFSET_MM (±5 clicks).
   */
  baseXMm: number;
  baseYMm: number;
  /**
   * Saved turret correction, mm-at-100 m (angular).
   * Can be many clicks (long-range dial / re-zero).
   */
  savedXMm: number;
  savedYMm: number;
  /**
   * Set when the player presses «Lagre zero» on the range.
   * Required before hunt — missing means not hunt-ready for this combo.
   */
  verifiedAtMs?: number;
};

/** One measured series from the shooting range (shotlog row). */
export type ShotLogEntry = {
  id: string;
  /** Unix ms when the series was measured. */
  atMs: number;
  rifleId: string;
  scopeId: string;
  ammoId: string;
  /** Snapshot labels so old rows stay readable if catalog names change. */
  rifleLabel: string;
  scopeLabel: string;
  ammoLabel: string;
  distanceM: number;
  shotCount: number;
  extremeSpreadMm: number;
  groupMoa: number;
  meanRadiusMm: number;
  poiXMm: number;
  poiYMm: number;
  /**
   * Effective zero as mm-at-100 m (angular: base + saved + session).
   * Paper shift at series distance = value × (distanceM / 100).
   */
  zeroXMm: number;
  zeroYMm: number;
  /** Saved turret correction at log time (mm-at-100 m). */
  savedZeroXMm: number;
  savedZeroYMm: number;
  /** Unsaved session clicks at log time (mm-at-100 m). */
  sessionZeroXMm: number;
  sessionZeroYMm: number;
  /**
   * Chronograph (Garmin Xero in kit): realized muzzle velocity per shot (m/s).
   * Omitted when no chrono was packed.
   */
  chronoV0Mps?: number[];
  /** Air / powder temperature (°C) logged with chrono series (for later dV/dT). */
  chronoTemperatureC?: number;
  /** Where the chrono series was logged (range vs field deploy). */
  chronoSource?: "range" | "field";
};

/**
 * Field DOPE card row from the range: ammo + distance → dial clicks.
 * Elevation is the primary hold; windage stored when dialed.
 */
export type DopeCardEntry = {
  id: string;
  atMs: number;
  rifleId: string;
  scopeId: string;
  ammoId: string;
  ammoLabel: string;
  distanceM: number;
  /** 0.1 mil elevation clicks (+ down / − up). */
  elevationClicks: number;
  /** 0.1 mil windage clicks (+ right / − left). */
  windageClicks: number;
};

/** Cap so the log cannot grow without bound in one session. */
export const MAX_SHOT_LOG_ENTRIES = 200;
export const MAX_DOPE_CARD_ENTRIES = 80;

/** Paperwork only — never appears in inventory. Required to buy hunting rifles. */
export type WeaponLicense = {
  id: string;
  brand: string;
  type: string;
  caliber: string;
  /** Gift / inheritance — does not count on the fee ladder. */
  gifted?: boolean;
};

export type PlayerStats = {
  name: string;
  nickname: string;
  balance: number;
  orrhaner: number;
  tiur: number;
  /**
   * Lifetime harvest counts (never decrease on Meat Market sale).
   * Used for Rulles landowner audience gates.
   */
  lifetimeTiur: number;
  lifetimeOrrhaner: number;
  /** Easter-egg owl harvests (never sold at Meat Market). */
  lifetimeUgle: number;
  /**
   * Last owl observation milestone offered (26 / 36 / 46…).
   * Prevents re-offering until the next decade after a miss/flush.
   */
  owlLastOfferedMilestone: number | null;
  /**
   * Birds in the hunting pack/sekk (this hunt only).
   * Moved to {@link freezerCarcasses} when the hunt ends.
   */
  carcasses: GameCarcass[];
  /**
   * Home freezer — harvested birds stored until sold at Meat Market.
   * Does not count toward pack weight on the next hunt.
   */
  freezerCarcasses: GameCarcass[];
  /** Longest hunting hit distance in meters. */
  maxRange: number;
  /**
   * Lifetime walked distance in meters (grid cells + ettersøk/tree recovery).
   * Same sources as the hunt HUD «Distance travelled».
   */
  lifetimeDistanceM: number;
  inventory: InventoryEntry[];
  /** Item ids currently assembled into the hunting kit (at Home). */
  kit: string[];
  /** Approved rifle licenses (Lensmann). Not inventory items. */
  weaponLicenses: WeaponLicense[];
  /**
   * Per player×rifle×ammo affinity (key: `rifleId::ammoId`).
   * Rolled on first range use of that pair.
   */
  ammoAffinities: Record<string, number>;
  /** Per player×rifle×scope×ammo zeroing state. */
  zeroingProfiles: Record<string, ZeroingProfile>;
  /**
   * Lifetime shots through each rifle barrel (keyed by rifle item id).
   * Drives barrel-wear MOA; reset by CB Customs rebarrel / custom pipe.
   */
  rifleRoundCounts: Record<string, number>;
  /**
   * Per-rifle custom CNC barrel from CB Customs (replaces factory MOA floor).
   */
  customBarrels: Record<string, InstalledCustomBarrel>;
  /**
   * Removed custom pipes kept in inventory — can be re-installed on the same rifle.
   */
  spareBarrels: Record<string, StoredCustomBarrel[]>;
  /** Chronological range series log (newest first). */
  shotLog: ShotLogEntry[];
  /** Field DOPE card from range (newest first). */
  dopeCard: DopeCardEntry[];
  /** CB Customs gunsmith / finish work. */
  customsMods: CustomsMods;
  /** Booked hunting terrain from inatur.no (null = none chosen yet). */
  selectedHuntingTerrainId: string | null;
  /**
   * Active inatur jaktkort per terrain (dag / uke / sesong).
   * Multiple terrains can hold cards at the same time.
   */
  jaktkort: JaktkortBook;
  /** Handshake grounds unlocked at Rulles (terrain ids). */
  unlockedTerrainIds: string[];
  /**
   * Home inventory: auto-pack mat/snacks (ready + meal) into kit when owned.
   */
  autoSupplyFood: boolean;
  /**
   * Saved favorite hunt loadout (item ids). Pack from Home / range
   * via «Pakk favorittkitt for jakt».
   */
  favoriteKitIds: string[];
  /** Laderommet — selected components for the current home load. */
  loadBenchRecipe: LoadBenchRecipe;
  /**
   * Armed ladeplan from Laderommet — live-fire uses this for kaboom rolls.
   * Null = not testing a home load.
   */
  armedLoadPlan: ArmedLoadPlan | null;
  /** Load development ladder (charges + measured v0 / samling). */
  loadDevTable: LoadDevTable;
  /** Archived home loads for lookup. */
  loadBook: LoadBookEntry[];
  /** Loaded home ammo batches (shootable). */
  homeLoadedLots: HomeLoadedLot[];
  /** Open powder stock in grains (after opening boxes). */
  powderOpenGrains: Record<string, number>;
  /** One-shot migration: reloading box qty → pieces. */
  reloadingPiecesMigrated: boolean;
  /**
   * Kestrel AB gun profiles per ammo id (calibrated MV / BC / dV/dT).
   */
  kestrelProfiles: Record<string, KestrelGunProfile>;
  /**
   * Player-entered real ballistic loads (per rifle) for simulator / procedure
   * training — MV, BC, dV/dT, SD and drop card @ standard atmosphere.
   */
  realLoadProfiles: RealLoadProfile[];
  /**
   * When true (and kit has ballistic LRF or Kestrel), CB Real loads drive
   * simulation for CB Customs home-load ammo only.
   */
  useRealDataInSimulation: boolean;
  /**
   * Scope / turret realism: low = assisted; medium = classic HUD dials;
   * high = tube-mounted realistic turrets (per-scope chrome via turretStyleForScope).
   */
  realism: GameRealism;
  /**
   * Scope aim: move target/landscape under a fixed reticle, or move the
   * reticle over a stationary target (hamburger → Move reticle/target).
   */
  scopeAimControl: ScopeAimControl;
  /**
   * When true, holding focus applies catalog focus-zoom (premium scopes).
   * Town → Settings.
   */
  scopeZoomOnFocus: boolean;
  /**
   * Short (~40% High/medium rails) or long (classic tall) focus/trigger bars.
   * Town → Settings.
   */
  focusTriggerBarLength: FocusTriggerBarLength;
  /**
   * Zen: no bird-nerve over time / Deploy / anlegg / Aware gear menus.
   * Movement on the Aware map still raises nerve.
   */
  zenMode: boolean;
  /**
   * Open hunt Aware skuddpar — synced so unfinished recoveries survive
   * across devices for the same terrain/jaktkort day.
   */
  awareHunt: AwareHuntState | null;
  /**
   * Norwegian-style hunter exam cleared — required before hunt / jaktkort use.
   */
  jegerprovePassed: boolean;
  /** Preferred UI language (Jegerprøve + hamburger preference). */
  lang: GameLang;
};

export const STARTING_BALANCE = 10_000;
/** Cheat login name — full starter kit + cash (case-insensitive). */
export const CHEAT_PLAYER_NAME = "Neppe";
export const CHEAT_STARTING_BALANCE = 500_000;
/**
 * First-name tokens that unlock elevated starting cash + VIP kit
 * (case-insensitive word match). e.g. "Jørn Nilsson" → {@link VIP_STARTING_BALANCE}.
 */
export const VIP_NAME_TOKENS = [
  "jørn",
  "ivar",
  "tomas",
  "einar",
  "eirik",
  "konrad",
  "stahl",
  "dyre",
  "mona",
  "hoftun",
] as const;
export const VIP_STARTING_BALANCE = 100_000;
/**
 * Substrings in the chosen hunter name that grant elevated starting cash only
 * (no VIP kit). Case-insensitive — e.g. "Smarteclaus".
 * («Hesla» uten fornavnet Eirik; Eirik selv er VIP med full kit.)
 */
export const BONUS_CASH_NAME_SUBSTRINGS = ["smart", "hesla"] as const;
export const BONUS_CASH_STARTING_BALANCE = VIP_STARTING_BALANCE;
export const STARTER_RIFLE_ID = "rifle-cz452";
export const STARTER_SCOPE_ID = "scope-biltema-3-9x40";
/** Hawke 1" — matches Biltema starter scope tube. */
export const STARTER_MOUNT_ID = "mount-hawke-match-1in";
export const STARTER_LICENSE_ID = "license-starter-cz452";

/**
 * Shared hunt support gear (bag, food, camo, Kestrel) — appended to every
 * VIP / cheat weapon profile. LRF is per-profile ({@link KitProfile.lrfId}).
 */
export const STARTER_HUNT_SUPPORT_IDS = [
  "misc-vorn-deer-42",
  "chest-sitka-mountain",
  "food-msr-pocketrocket",
  "food-msr-isopro-230",
  "food-real-turmat",
  "food-boller-5pk",
  "food-polarbrod-ost-skinke",
  "food-dronning-kokesjokolade",
  "misc-thermos-jula",
  "misc-sittpute-biltema",
  "misc-triggercam",
  "misc-suunto-a-10",
  "camo-jacket-norrona-kvinnherad-gtx",
  "camo-pants-seeland-hawker-pro",
  "camo-buff-3charlie-mesh",
  "camo-cap-multicam",
  "camo-gloves-mechanix-multicam",
  "camo-boots-m77",
  "misc-kestrel-5700-elite",
] as const;

/** Shared VIP carry: Vorn Deer backpack + Sitka Mountain (QR 10) chestrig. */
export const VIP_BACKPACK_ID = "misc-vorn-deer-42";
export const VIP_CHESTRIG_ID = "chest-sitka-mountain";
/** Ivar VIP: battery desk fan for range mirage. */
export const IVAR_BORDVIFTE_ID = "misc-bordvifte-batteri";
/** Einar-loadout (inkl. Hoftun): Kestrel + Hikmicro Lynx. */
export const EINAR_KESTREL_ID = "misc-kestrel-5700-elite";
export const EINAR_LYNX_ID = "thermal-hikmicro-lynx-le10";
/** Best regular inatur terrain (not VIP / Rulles / cloud-custom). */
export const EINAR_SEASON_TERRAIN_ID = "svenskegrensa";

/** Default LRF when a kit profile omits {@link KitProfile.lrfId}. */
export const DEFAULT_VIP_LRF_ID = "lrf-sig-kilo3000-bdx-10x42";

/** Extra inventory qty for consumables (default 1). */
export const STARTER_HUNT_QTY: Partial<Record<string, number>> = {
  "food-real-turmat": 3,
  "food-boller-5pk": 1,
  "food-polarbrod-ost-skinke": 1,
  "food-dronning-kokesjokolade": 1,
};

export type KitProfileId =
  | "tomas"
  | "ivar"
  | "jorn"
  | "einar"
  | "dyre"
  | "mona"
  | "neppe";

export type KitProfile = {
  id: KitProfileId;
  /** Weapon platform item ids (rifle, scope, ammo, can, bipod, stock…). */
  weaponIds: readonly string[];
  /**
   * Hunt support ids (bag, camo, food…). When set, replaces
   * {@link STARTER_HUNT_SUPPORT_IDS}.
   */
  supportIds?: readonly string[];
  /**
   * LRF binos in the hunt support loadout.
   * Defaults to {@link DEFAULT_VIP_LRF_ID} (Sig KILO3000).
   */
  lrfId?: string;
  /** Override inventory qty for specific item ids (e.g. 100 rounds of ammo). */
  itemQty?: Partial<Record<string, number>>;
  /** Ammo ids that get a perfect 100 m zero with rifle+scope. */
  zeroAmmoIds: readonly string[];
  license: {
    id: string;
    brand: string;
    type: string;
    caliber: string;
  };
  /** Pre-applied CB Customs work (Tomas: søylebedding + flute + slank stokk). */
  customsMods?: CustomsMods;
  /** Starting realism level when this kit is granted (e.g. Einar → high). */
  realism?: GameRealism;
};

/** Tomas — Sauer 200 STR + ZCO 527 + Svemko Hunter + softgun + CB Customs (inkl. trigger tuning). */
export const KIT_PROFILE_TOMAS: KitProfile = {
  id: "tomas",
  weaponIds: [
    "rifle-sauer-200str",
    "scope-zco-527-mct",
    "mount-spuhr-sp4602-36",
    "ammo-norma-65x55-black-diamond",
    "ammo-lapua-65x55-scenar",
    "sup-svemko-hunter-1",
    "bipod-game-on-softgun",
  ],
  zeroAmmoIds: [
    "ammo-norma-65x55-black-diamond",
    "ammo-lapua-65x55-scenar",
  ],
  license: {
    id: "license-vip-tomas-sauer-200str",
    brand: "Sauer",
    type: "200 STR",
    caliber: "6,5×55",
  },
  customsMods: {
    ...EMPTY_CUSTOMS_MODS,
    pillarBedding: true,
    fluting: true,
    stockSlim: true,
    triggerTuning: true,
  },
};

/** Ivar — CarbonWölf Berillium Level + Nightforce NX8 MOA + Hausken JD184 + softgun + bordvifte. */
export const KIT_PROFILE_IVAR: KitProfile = {
  id: "ivar",
  weaponIds: [
    "rifle-carbonwolf-berillium",
    "scope-nf-nx8-4-32-moa",
    "mount-spuhr-sp3001-30",
    "ammo-norma-65x55-black-diamond",
    "ammo-lapua-65x55-scenar",
    "sup-hausken-jd184-xtrm",
    "bipod-game-on-softgun",
    "misc-bordvifte-batteri",
  ],
  lrfId: "lrf-zeiss-victory-rf-10x42",
  zeroAmmoIds: [
    "ammo-norma-65x55-black-diamond",
    "ammo-lapua-65x55-scenar",
  ],
  license: {
    id: "license-vip-ivar-carbonwolf-berillium",
    brand: "CarbonWölf",
    type: "Berillium Level",
    caliber: "6,5×55",
  },
};

/** Jørn — Rem700 SA Hansen Custom + MDT HNT26 + Kahles K624i MSR + A-TEC + Caldwell XLA + bordvifte. */
export const KIT_PROFILE_JORN: KitProfile = {
  id: "jorn",
  weaponIds: [
    "rifle-rem-700-sa-hansen-custom",
    "stock-mdt-hnt26-rem700",
    "scope-kahles-k624i-6-24-mrad",
    "mount-spuhr-sp4002-34",
    "ammo-norma-65cm-black-diamond",
    "ammo-lapua-65cm-scenar-l",
    "sup-atec-optima-50",
    "bipod-caldwell-xla",
    "misc-bordvifte-batteri",
  ],
  lrfId: "lrf-leica-geovid-r-10x42",
  zeroAmmoIds: [
    "ammo-norma-65cm-black-diamond",
    "ammo-lapua-65cm-scenar-l",
  ],
  license: {
    id: "license-vip-jorn-rem-700-hansen-custom",
    brand: "Hansen Custom",
    type: "Rem700 SA",
    caliber: "6,5 Creedmoor",
  },
};

/**
 * Einar / Eirik / Konrad / Stahl / Hoftun — Sauer 200 STR + ZCO 527 (ingen
 * Triggercam-zoom-lås) + Recknagel 36 + Svemko Hunter + Spartan Javelin +
 * Lynx + Sig KILO3000 + support-kit. VIP-start: 100 000 kr.
 */
export const KIT_PROFILE_EINAR: KitProfile = {
  id: "einar",
  weaponIds: [
    "rifle-sauer-200str",
    "scope-zco-527-mct",
    "mount-recknagel-eratac-36",
    "ammo-lapua-65x55-scenar",
    "sup-svemko-hunter-1",
    "bipod-spartan-javelin",
    "misc-ulf-bubblelevel",
    "thermal-hikmicro-lynx-le10",
    "misc-garmin-xero-c1-pro",
  ],
  supportIds: [
    "misc-kestrel-5700-elite",
    "misc-vorn-deer-42",
    "chest-sitka-mountain",
    "misc-triggercam",
    "misc-thermos-jula",
    "outdoors-opptenningsbrikker",
    "food-boller-5pk",
    "camo-boots-crispi-titan-evo",
  ],
  lrfId: "lrf-sig-kilo3000-bdx-10x42",
  itemQty: {
    "ammo-lapua-65x55-scenar": 100,
  },
  zeroAmmoIds: ["ammo-lapua-65x55-scenar"],
  license: {
    id: "license-vip-einar-sauer-200str",
    brand: "Sauer",
    type: "200 STR",
    caliber: "6,5×55",
  },
  realism: "high",
};

/**
 * Dyre — same support / optic stack as Einar, but Tikka T3x Lite instead of
 * Sauer 200 STR.
 */
export const KIT_PROFILE_DYRE: KitProfile = {
  id: "dyre",
  weaponIds: [
    "rifle-tikka-t3x-lite",
    "scope-zco-527-mct",
    "mount-recknagel-eratac-36",
    "ammo-lapua-65x55-scenar",
    "sup-svemko-hunter-1",
    "bipod-spartan-javelin",
    "misc-ulf-bubblelevel",
    "thermal-hikmicro-lynx-le10",
    "misc-garmin-xero-c1-pro",
  ],
  supportIds: [
    "misc-kestrel-5700-elite",
    "misc-vorn-deer-42",
    "chest-sitka-mountain",
    "misc-triggercam",
    "misc-thermos-jula",
    "outdoors-opptenningsbrikker",
    "food-boller-5pk",
    "camo-boots-crispi-titan-evo",
  ],
  lrfId: "lrf-sig-kilo3000-bdx-10x42",
  itemQty: {
    "ammo-lapua-65x55-scenar": 100,
  },
  zeroAmmoIds: ["ammo-lapua-65x55-scenar"],
  license: {
    id: "license-vip-dyre-tikka-t3x-lite",
    brand: "Tikka",
    type: "T3x Lite",
    caliber: "6,5×55",
  },
  realism: "high",
};

/**
 * Mona — same kit as Einar, plus CB Customs crown / action trueing / søylebedding
 * and 500 CB custom home-load rounds (6,5×55).
 */
export const KIT_PROFILE_MONA: KitProfile = {
  id: "mona",
  weaponIds: [
    "rifle-sauer-200str",
    "scope-zco-527-mct",
    "mount-recknagel-eratac-36",
    "ammo-lapua-65x55-scenar",
    "ammo-cb-homeload-65x55",
    "sup-svemko-hunter-1",
    "bipod-spartan-javelin",
    "misc-ulf-bubblelevel",
    "thermal-hikmicro-lynx-le10",
    "misc-garmin-xero-c1-pro",
  ],
  supportIds: [
    "misc-kestrel-5700-elite",
    "misc-vorn-deer-42",
    "chest-sitka-mountain",
    "misc-triggercam",
    "misc-thermos-jula",
    "outdoors-opptenningsbrikker",
    "food-boller-5pk",
    "camo-boots-crispi-titan-evo",
  ],
  lrfId: "lrf-sig-kilo3000-bdx-10x42",
  itemQty: {
    "ammo-lapua-65x55-scenar": 100,
    "ammo-cb-homeload-65x55": 500,
  },
  zeroAmmoIds: ["ammo-lapua-65x55-scenar", "ammo-cb-homeload-65x55"],
  license: {
    id: "license-vip-mona-sauer-200str",
    brand: "Sauer",
    type: "200 STR",
    caliber: "6,5×55",
  },
  customsMods: {
    ...EMPTY_CUSTOMS_MODS,
    pillarBedding: true,
    actionTrueing: true,
    barrelCrown: true,
    homeLoadsSetup: true,
  },
  realism: "high",
};

/** Neppe (cheat) — competition Sauer + NF + Genesis + ACC Elite. */
export const KIT_PROFILE_NEPPE: KitProfile = {
  id: "neppe",
  weaponIds: [
    "rifle-sauer-200str",
    "scope-nf-nx8-4-32-mrad",
    "mount-spuhr-sp3001-30",
    "ammo-norma-65x55-black-diamond",
    "ammo-lapua-65x55-scenar",
    "sup-svemko-genesis-30",
    "bipod-trs-really-right",
    "stock-mdt-acc-elite-rem700",
  ],
  zeroAmmoIds: [
    "ammo-norma-65x55-black-diamond",
    "ammo-lapua-65x55-scenar",
  ],
  license: {
    id: "license-test-sauer-200str",
    brand: "Sauer",
    type: "200 STR",
    caliber: "6,5×55",
  },
};

export const KIT_PROFILES: Record<KitProfileId, KitProfile> = {
  tomas: KIT_PROFILE_TOMAS,
  ivar: KIT_PROFILE_IVAR,
  jorn: KIT_PROFILE_JORN,
  einar: KIT_PROFILE_EINAR,
  dyre: KIT_PROFILE_DYRE,
  mona: KIT_PROFILE_MONA,
  neppe: KIT_PROFILE_NEPPE,
};

/** Einar-stack support gear (Kestrel + Lynx): Einar / Dyre / Mona. */
function isEinarStackProfile(id: KitProfileId): boolean {
  return id === "einar" || id === "dyre" || id === "mona";
}

/** @deprecated Prefer {@link KIT_PROFILE_NEPPE}.weaponIds */
export const TEST_RANGE_LOADOUT_IDS = KIT_PROFILE_NEPPE.weaponIds;

/** Full equipped kit for a profile (weapon + hunt support + LRF). */
export function huntLoadoutIdsForProfile(
  profile: KitProfile,
): string[] {
  const lrfId = profile.lrfId ?? DEFAULT_VIP_LRF_ID;
  const support = profile.supportIds ?? STARTER_HUNT_SUPPORT_IDS;
  const ids = [...profile.weaponIds, ...support];
  if (!ids.includes(lrfId)) ids.push(lrfId);
  return ids;
}

/** @deprecated Prefer {@link huntLoadoutIdsForProfile}(KIT_PROFILE_NEPPE). */
export const STARTER_HUNT_LOADOUT_IDS = huntLoadoutIdsForProfile(
  KIT_PROFILE_NEPPE,
);

export const TEST_RANGE_LICENSE_ID = KIT_PROFILE_NEPPE.license.id;
/** Norwegian satire: max legal hunting rifles before the system says nei. */
export const MAX_HUNTING_RIFLES = 8;
/** Base søknadsgebyr — doubles per paid license (500, 1000, 2000…). */
export const BASE_PERMIT_FEE = 500;
/** 0.1 mil click → mm on paper at 100 m (angular; scales with distance). */
export const ZERO_CLICK_MM = 10;
/**
 * Max random first-time combo offset (±5 clicks).
 * Not a turret limit — scopes can dial far more.
 */
export const MAX_ZERO_BASE_OFFSET_MM = 50;
/** Max dial / saved *windage* (and generic) correction (±100 clicks ≈ ±10 mil).
 * Elevation uses {@link clampElevationTurretMm} / `elevationUpClicks` instead. */
export const MAX_TURRET_OFFSET_MM = 1000;

/** @deprecated Use MAX_ZERO_BASE_OFFSET_MM — kept as alias for clarity in old comments. */
export const MAX_ZEROING_OFFSET_MM = MAX_ZERO_BASE_OFFSET_MM;

/**
 * Fee for the next paid rifle license at Lensmannen.
 * Ladder: 500, 1000, 2000, 4000… (`priorPaidLicenses` = previous paid approvals).
 */
export function permitFeeForNextRifle(priorPaidLicenses: number): number {
  const n = Math.max(0, Math.floor(priorPaidLicenses));
  return BASE_PERMIT_FEE * 2 ** n;
}

export function formatPermitFee(nok: number): string {
  return `${nok.toLocaleString("nb-NO")},-`;
}

/** True when the display/login name is the cheat identity (Neppe). */
export function isCheatPlayerName(name: string): boolean {
  return name.trim().toLowerCase() === CHEAT_PLAYER_NAME.toLowerCase();
}

/**
 * True when any word in the name matches a VIP first-name token
 * (Jørn / Ivar / Tomas / Einar / Eirik / Konrad / Dyre / Mona — e.g. "Jørn Nilsson"),
 * or the name contains «Hoftun» (family VIP).
 */
export function isVipPlayerName(name: string): boolean {
  return vipKitProfileIdForName(name) != null;
}

/** True when the hunter name contains «Hoftun» (any casing). */
export function isHoftunPlayerName(name: string): boolean {
  return name.trim().toLowerCase().normalize("NFC").includes("hoftun");
}

/** Map login name → VIP kit profile id (null if not a VIP first name). */
export function vipKitProfileIdForName(name: string): KitProfileId | null {
  const normalized = name.trim().toLowerCase().normalize("NFC");
  const words = normalized.split(/[\s\-_/.,]+/).filter(Boolean);
  if (words.includes("tomas")) return "tomas";
  if (words.includes("ivar")) return "ivar";
  if (words.includes("jørn") || words.includes("jorn")) return "jorn";
  // Konrad / Hoftun / Eirik share Einar’s Sauer 200 + ZCO 527 + High realism.
  // Dyre gets the same stack with Tikka T3x Lite. Mona = Einar + CB work/loads.
  if (words.includes("dyre")) return "dyre";
  if (words.includes("mona")) return "mona";
  if (
    words.includes("einar") ||
    words.includes("eirik") ||
    words.includes("konrad") ||
    normalized.includes("hoftun")
  ) {
    return "einar";
  }
  return null;
}

/**
 * True when the chosen hunter name contains a bonus-cash substring
 * ("smart", "hesla" — e.g. Smarteclaus, Eirik Hesla).
 */
export function isBonusCashPlayerName(name: string): boolean {
  const n = name.trim().toLowerCase().normalize("NFC");
  if (!n) return false;
  return BONUS_CASH_NAME_SUBSTRINGS.some((token) => n.includes(token));
}

/** Starting cash for a newly registered display name. */
export function startingBalanceForName(name: string): number {
  if (isCheatPlayerName(name)) return CHEAT_STARTING_BALANCE;
  if (isVipPlayerName(name)) return VIP_STARTING_BALANCE;
  if (isBonusCashPlayerName(name)) return BONUS_CASH_STARTING_BALANCE;
  return STARTING_BALANCE;
}

/**
 * Story gift only — uncle's CZ452 + Biltema 3-9× + license.
 * Normal starts also get STARTING_BALANCE (10 000 kr). No full hunt loadout.
 */
export function grantUncleRifle(stats: PlayerStats): PlayerStats {
  let next = stats;

  if (!next.inventory.some((e) => e.itemId === STARTER_RIFLE_ID)) {
    next = {
      ...next,
      inventory: [...next.inventory, { itemId: STARTER_RIFLE_ID, qty: 1 }],
    };
  }
  if (!next.inventory.some((e) => e.itemId === STARTER_SCOPE_ID)) {
    next = {
      ...next,
      inventory: [...next.inventory, { itemId: STARTER_SCOPE_ID, qty: 1 }],
    };
  }
  if (!next.inventory.some((e) => e.itemId === STARTER_MOUNT_ID)) {
    next = {
      ...next,
      inventory: [...next.inventory, { itemId: STARTER_MOUNT_ID, qty: 1 }],
    };
  }
  if (!next.weaponLicenses.some((l) => l.id === STARTER_LICENSE_ID)) {
    next = {
      ...next,
      weaponLicenses: [
        ...next.weaponLicenses,
        {
          id: STARTER_LICENSE_ID,
          brand: "CZ",
          type: "452 American",
          caliber: ".22 LR",
          gifted: true,
        },
      ],
    };
  }

  return next;
}

/**
 * Grant a named kit profile: inventory + equipped kit + license + zeros + customs.
 */
export function grantKitProfile(
  stats: PlayerStats,
  profile: KitProfile,
): PlayerStats {
  let next = grantUncleRifle(stats);
  const loadout = huntLoadoutIdsForProfile(profile);

  for (const id of loadout) {
    if (!next.inventory.some((e) => e.itemId === id)) {
      const item = getShopItem(id);
      let qty = profile.itemQty?.[id] ?? STARTER_HUNT_QTY[id] ?? 1;
      if (item && isAmmoItem(item)) {
        qty = profile.itemQty?.[id] ?? ammoRoundsPerPurchase(item);
      }
      next = {
        ...next,
        inventory: addToInventory(next.inventory, id, qty),
      };
    }
  }

  if (!next.weaponLicenses.some((l) => l.id === profile.license.id)) {
    next = {
      ...next,
      weaponLicenses: [
        ...next.weaponLicenses,
        { ...profile.license, gifted: true },
      ],
    };
  }

  next = { ...next, kit: [...loadout] };

  if (profile.customsMods) {
    next = { ...next, customsMods: { ...profile.customsMods } };
  }

  if (profile.realism) {
    next = { ...next, realism: profile.realism };
  }

  const perfect: ZeroingProfile = {
    baseXMm: 0,
    baseYMm: 0,
    savedXMm: 0,
    savedYMm: 0,
    verifiedAtMs: Date.now(),
  };
  const rifleId = profile.weaponIds.find((id) => id.startsWith("rifle-"));
  const scopeId = profile.weaponIds.find((id) => id.startsWith("scope-"));
  if (rifleId && scopeId) {
    let profiles = { ...next.zeroingProfiles };
    for (const ammoId of profile.zeroAmmoIds) {
      profiles = {
        ...profiles,
        [zeroingKey(rifleId, scopeId, ammoId)]: perfect,
      };
    }
    next = { ...next, zeroingProfiles: profiles };
  }

  // New players (incl. VIP kits) still take the exam — do not auto-pass.
  return next;
}

/** Cheat (Neppe) — full competition Sauer kit. */
export function grantStarterGear(stats: PlayerStats): PlayerStats {
  return grantKitProfile(stats, KIT_PROFILE_NEPPE);
}

/** VIP first-name loadout (Tomas / Ivar / Jørn / Einar / Eirik / …). */
export function grantVipStarterGear(
  stats: PlayerStats,
  name: string,
): PlayerStats {
  const id = vipKitProfileIdForName(name);
  if (!id) return grantUncleRifle(stats);
  return grantKitProfile(stats, KIT_PROFILES[id]);
}

/** Profile for cheat/VIP names, else null. */
function namedStarterProfile(name: string): KitProfile | null {
  if (isCheatPlayerName(name)) return KIT_PROFILE_NEPPE;
  const profileId = vipKitProfileIdForName(name);
  if (!profileId) return null;
  return KIT_PROFILES[profileId];
}

/**
 * True when cheat/VIP already owns every profile weapon id
 * (rifle/scope/ammo/… — not shared hunt-support gear).
 */
export function hasNamedStarterKit(stats: PlayerStats): boolean {
  const profile = namedStarterProfile(stats.name);
  if (!profile) return true;
  return profile.weaponIds.every((id) =>
    stats.inventory.some((e) => e.itemId === id),
  );
}

/** Equip the profile LRF (add to inventory if needed; replace other LRF in kit). */
function syncProfileLrf(stats: PlayerStats, profile: KitProfile): PlayerStats {
  const lrfId = profile.lrfId ?? DEFAULT_VIP_LRF_ID;
  let next = stats;
  if (!next.inventory.some((e) => e.itemId === lrfId)) {
    next = {
      ...next,
      inventory: addToInventory(next.inventory, lrfId, 1),
    };
  }
  const withoutLrf = next.kit.filter((id) => !id.startsWith("lrf-"));
  const kitNeedsSync =
    !next.kit.includes(lrfId) ||
    next.kit.some((id) => id.startsWith("lrf-") && id !== lrfId);
  if (kitNeedsSync) {
    next = { ...next, kit: [...withoutLrf, lrfId] };
  }
  return next;
}

/**
 * VIP packs: Vorn Deer + Sitka Mountain Optics Harness (best QR).
 * Ivar also gets bordvifte. Einar-loadout (Hoftun m.fl.) gets Kestrel + Lynx.
 * Exclusive backpack/chestrig/thermal slots swapped in kit.
 */
function syncVipCarryGear(
  stats: PlayerStats,
  profile: KitProfile,
): PlayerStats {
  let inv = [...stats.inventory];
  let kit = [...stats.kit];
  let changed = false;

  const ensureOwned = (id: string) => {
    if (inv.some((e) => e.itemId === id)) return;
    inv.push({ itemId: id, qty: 1 });
    changed = true;
  };

  ensureOwned(VIP_BACKPACK_ID);
  ensureOwned(VIP_CHESTRIG_ID);
  if (profile.id === "ivar") ensureOwned(IVAR_BORDVIFTE_ID);
  if (isEinarStackProfile(profile.id)) {
    ensureOwned(EINAR_KESTREL_ID);
    ensureOwned(EINAR_LYNX_ID);
  }

  const ensureExclusiveKit = (
    wantId: string,
    isSlot: (item: ShopItem) => boolean,
  ) => {
    if (kit.includes(wantId)) return;
    const others = kit.filter((id) => {
      const item = getShopItem(id);
      return item ? isSlot(item) : false;
    });
    if (others.length > 0) {
      kit = kit.filter((id) => !others.includes(id));
    }
    kit.push(wantId);
    changed = true;
  };

  const ensureKitItem = (wantId: string) => {
    if (kit.includes(wantId)) return;
    kit.push(wantId);
    changed = true;
  };

  ensureExclusiveKit(VIP_BACKPACK_ID, isBackpackItem);
  ensureExclusiveKit(VIP_CHESTRIG_ID, isChestrigItem);

  if (profile.id === "ivar") ensureKitItem(IVAR_BORDVIFTE_ID);
  if (isEinarStackProfile(profile.id)) {
    ensureKitItem(EINAR_KESTREL_ID);
    ensureExclusiveKit(EINAR_LYNX_ID, isThermalItem);
  }

  if (!changed) return stats;
  return { ...stats, inventory: inv, kit };
}

/**
 * Grant cheat/VIP loadout when the name matches but the profile rifle is
 * missing — e.g. saves created before VIP kits, or load skipping intro.
 * Idempotent if the kit is already present; still syncs profile LRF + carry.
 * Hoftun also gets Sandbekken sesongkort; Einar-loadout gets Svenskegrensa.
 */
export function ensureNamedStarterGear(stats: PlayerStats): PlayerStats {
  const profile = namedStarterProfile(stats.name);
  let next = stats;
  if (profile) {
    if (!hasNamedStarterKit(next)) {
      if (isCheatPlayerName(next.name)) next = grantStarterGear(next);
      else if (isVipPlayerName(next.name)) {
        next = grantVipStarterGear(next, next.name);
      }
    } else {
      next = syncProfileLrf(next, profile);
      next = syncVipCarryGear(next, profile);
    }
  }
  // Legacy / favorite kits may have packed wrong-diameter rings — drop mount.
  const sanitizedKit = sanitizeKitScopeMountIds(next.kit, getShopItem);
  if (!kitsEqual(next.kit, sanitizedKit)) {
    next = {
      ...next,
      kit: sanitizedKit,
      zeroingProfiles: applyMountZeroingAfterKitChange(
        next.zeroingProfiles,
        next.kit,
        sanitizedKit,
      ),
    };
  }
  next = ensureHoftunSandbekkenPass(next);
  return ensureEinarSeasonPass(next);
}

/** Hoftun VIP: free Sandbekken season card (idempotent while days remain). */
export const HOFTUN_SANDBEKKEN_TERRAIN_ID = "sandbekken";

export function ensureHoftunSandbekkenPass(stats: PlayerStats): PlayerStats {
  if (!isHoftunPlayerName(stats.name)) return stats;
  const existing = getJaktkortForTerrain(
    stats.jaktkort,
    HOFTUN_SANDBEKKEN_TERRAIN_ID,
  );
  if (existing && existing.daysRemaining > 0) return stats;
  const terrain = getHuntingTerrain(HOFTUN_SANDBEKKEN_TERRAIN_ID);
  const kort = createJaktkort(
    HOFTUN_SANDBEKKEN_TERRAIN_ID,
    "season",
    terrain?.pricePerDayNok ?? 1200,
  );
  return {
    ...stats,
    jaktkort: upsertJaktkort(stats.jaktkort, kort),
    selectedHuntingTerrainId:
      stats.selectedHuntingTerrainId ?? HOFTUN_SANDBEKKEN_TERRAIN_ID,
  };
}

/**
 * Einar-loadout VIP (Einar, Eirik, Konrad, Hoftun, Mona): season pass on
 * Svenskegrensa — best priced regular Inatur terrain (not VIP/Rulles/cloud-custom).
 */
export function ensureEinarSeasonPass(stats: PlayerStats): PlayerStats {
  const profileId = vipKitProfileIdForName(stats.name);
  if (profileId !== "einar" && profileId !== "mona") return stats;
  const existing = getJaktkortForTerrain(
    stats.jaktkort,
    EINAR_SEASON_TERRAIN_ID,
  );
  if (existing && existing.daysRemaining > 0) return stats;
  const terrain = getHuntingTerrain(EINAR_SEASON_TERRAIN_ID);
  const kort = createJaktkort(
    EINAR_SEASON_TERRAIN_ID,
    "season",
    terrain?.pricePerDayNok ?? 1100,
  );
  return {
    ...stats,
    jaktkort: upsertJaktkort(stats.jaktkort, kort),
    selectedHuntingTerrainId:
      stats.selectedHuntingTerrainId ?? EINAR_SEASON_TERRAIN_ID,
  };
}

/** Admin session: Finnskogen sesongkort + CB Real loads top-up. */
export const ADMIN_CB_HOMELOAD_ROUNDS = 999;
export const ADMIN_FINNSKOGEN_TERRAIN_ID = "finnskogen";

/**
 * When the admin PIN session is active: active Finnskogen season card and
 * at least {@link ADMIN_CB_HOMELOAD_ROUNDS} CB Customs home-load rounds
 * matching the equipped rifle caliber (fallback 6,5×55). Free / no balance.
 * Idempotent ammo top-up; always refreshes the sesongkort to full days.
 */
export function applyAdminSessionPerks(stats: PlayerStats): PlayerStats {
  if (!stats.name) return stats;

  const terrain = getHuntingTerrain(ADMIN_FINNSKOGEN_TERRAIN_ID);
  const kort = createJaktkort(
    ADMIN_FINNSKOGEN_TERRAIN_ID,
    "season",
    terrain?.pricePerDayNok ?? 1500,
  );

  const rifle =
    stats.kit
      .map((id) => getShopItem(id))
      .find((i) => i && isRifleItem(i)) ?? null;
  const caliber = rifle?.caliber ?? "6,5×55";
  const ammoId =
    HOME_LOAD_AMMO_BY_CALIBER[caliber] ??
    HOME_LOAD_AMMO_BY_CALIBER["6,5×55"]!;

  let inventory = stats.inventory;
  const have = getInventoryQty(inventory, ammoId);
  if (have < ADMIN_CB_HOMELOAD_ROUNDS) {
    inventory = addToInventory(
      inventory,
      ammoId,
      ADMIN_CB_HOMELOAD_ROUNDS - have,
    );
  }

  const kit = stats.kit.includes(ammoId) ? stats.kit : [...stats.kit, ammoId];
  const unlockedTerrainIds = stats.unlockedTerrainIds.includes(
    ADMIN_FINNSKOGEN_TERRAIN_ID,
  )
    ? stats.unlockedTerrainIds
    : [...stats.unlockedTerrainIds, ADMIN_FINNSKOGEN_TERRAIN_ID];

  return {
    ...stats,
    selectedHuntingTerrainId: ADMIN_FINNSKOGEN_TERRAIN_ID,
    jaktkort: upsertJaktkort(stats.jaktkort, kort),
    inventory,
    kit,
    unlockedTerrainIds,
    customsMods: {
      ...stats.customsMods,
      homeLoadsSetup: true,
    },
  };
}

export function createInitialStats(): PlayerStats {
  return {
    name: "",
    nickname: "",
    balance: STARTING_BALANCE,
    orrhaner: 0,
    tiur: 0,
    lifetimeTiur: 0,
    lifetimeOrrhaner: 0,
    lifetimeUgle: 0,
    owlLastOfferedMilestone: null,
    carcasses: [],
    freezerCarcasses: [],
    maxRange: 0,
    lifetimeDistanceM: 0,
    inventory: [],
    kit: [],
    weaponLicenses: [],
    ammoAffinities: {},
    zeroingProfiles: {},
    rifleRoundCounts: {},
    customBarrels: {},
    spareBarrels: {},
    shotLog: [],
    dopeCard: [],
    customsMods: { ...EMPTY_CUSTOMS_MODS },
    selectedHuntingTerrainId: null,
    jaktkort: emptyJaktkortBook(),
    unlockedTerrainIds: [],
    autoSupplyFood: false,
    favoriteKitIds: [],
    loadBenchRecipe: createDefaultLoadBenchRecipe(),
    armedLoadPlan: null,
    loadDevTable: createEmptyLoadDevTable(),
    loadBook: createEmptyLoadBook(),
    homeLoadedLots: [],
    powderOpenGrains: {},
    reloadingPiecesMigrated: true,
    kestrelProfiles: {},
    realLoadProfiles: [],
    useRealDataInSimulation: false,
    realism: "medium",
    scopeAimControl: DEFAULT_SCOPE_AIM_CONTROL,
    scopeZoomOnFocus: DEFAULT_SCOPE_ZOOM_ON_FOCUS,
    focusTriggerBarLength: DEFAULT_FOCUS_TRIGGER_BAR_LENGTH,
    zenMode: DEFAULT_ZEN_MODE,
    awareHunt: null,
    jegerprovePassed: false,
    lang: "nb",
  };
}

export function appendShotLogEntry(
  log: ShotLogEntry[],
  entry: ShotLogEntry,
): ShotLogEntry[] {
  return [entry, ...log].slice(0, MAX_SHOT_LOG_ENTRIES);
}

/** mm-at-100 m (angular) → 0.1 mil click count. */
export function mmAt100ToClicks(mmAt100: number): number {
  return Math.round(mmAt100 / ZERO_CLICK_MM);
}

/**
 * Upsert a DOPE row for rifle×ammo×distance (replaces same key).
 * Newest first.
 */
export function addDopeCardEntry(
  card: DopeCardEntry[],
  entry: Omit<DopeCardEntry, "id" | "atMs"> & {
    id?: string;
    atMs?: number;
  },
): DopeCardEntry[] {
  const next: DopeCardEntry = {
    id: entry.id ?? `dope-${Date.now()}`,
    atMs: entry.atMs ?? Date.now(),
    rifleId: entry.rifleId,
    scopeId: entry.scopeId,
    ammoId: entry.ammoId,
    ammoLabel: entry.ammoLabel,
    distanceM: Math.round(entry.distanceM),
    elevationClicks: Math.round(entry.elevationClicks),
    windageClicks: Math.round(entry.windageClicks),
  };
  const rest = card.filter(
    (e) =>
      !(
        e.rifleId === next.rifleId &&
        e.ammoId === next.ammoId &&
        e.distanceM === next.distanceM
      ),
  );
  return [next, ...rest].slice(0, MAX_DOPE_CARD_ENTRIES);
}

export function updateDopeCardEntry(
  card: DopeCardEntry[],
  id: string,
  patch: Partial<
    Pick<
      DopeCardEntry,
      "distanceM" | "elevationClicks" | "windageClicks" | "ammoLabel"
    >
  >,
): DopeCardEntry[] {
  return card.map((e) => {
    if (e.id !== id) return e;
    return {
      ...e,
      distanceM:
        patch.distanceM != null
          ? Math.max(50, Math.round(patch.distanceM))
          : e.distanceM,
      elevationClicks:
        patch.elevationClicks != null
          ? Math.round(patch.elevationClicks)
          : e.elevationClicks,
      windageClicks:
        patch.windageClicks != null
          ? Math.round(patch.windageClicks)
          : e.windageClicks,
      ammoLabel:
        typeof patch.ammoLabel === "string" && patch.ammoLabel.trim()
          ? patch.ammoLabel.trim()
          : e.ammoLabel,
    };
  });
}

export function removeDopeCardEntry(
  card: DopeCardEntry[],
  id: string,
): DopeCardEntry[] {
  return card.filter((e) => e.id !== id);
}

/**
 * Nearest DOPE row for rifle×ammo at a given range (Enviro «Use DOPE»).
 */
export function nearestDopeEntry(
  card: readonly DopeCardEntry[],
  opts: {
    rifleId: string;
    ammoId: string;
    distanceM: number;
  },
): DopeCardEntry | null {
  const rows = card.filter(
    (e) => e.rifleId === opts.rifleId && e.ammoId === opts.ammoId,
  );
  if (rows.length === 0) return null;
  const d = opts.distanceM;
  return rows.reduce((best, e) =>
    Math.abs(e.distanceM - d) < Math.abs(best.distanceM - d) ? e : best,
  );
}

/** 0.1 mil clicks → mm-at-100 for session turrets. */
export function dopeClicksToMmAt100(clicks: number): number {
  return Math.round(clicks) * ZERO_CLICK_MM;
}

export function formatDopeElevationClicks(
  clicks: number,
  clickUnit: ScopeClickUnit = "MRAD",
): string {
  if (clicks === 0) return "0";
  const scopeClicks = milClicksToScopeClicks(clicks, clickUnit);
  const mm = clicks * ZERO_CLICK_MM;
  const ang = mmAt100ToAngular(mm, clickUnit);
  const digits = clickUnit === "MOA" ? 2 : 1;
  const u = clickUnitLabel(clickUnit);
  return `${Math.abs(scopeClicks)} (${ang.toFixed(digits)} ${u} ${clicks < 0 ? "U" : "D"})`;
}

export function formatDopeWindageClicks(
  clicks: number,
  clickUnit: ScopeClickUnit = "MRAD",
): string {
  if (clicks === 0) return "0";
  const scopeClicks = milClicksToScopeClicks(clicks, clickUnit);
  const mm = clicks * ZERO_CLICK_MM;
  const ang = mmAt100ToAngular(mm, clickUnit);
  const digits = clickUnit === "MOA" ? 2 : 1;
  const u = clickUnitLabel(clickUnit);
  return `${Math.abs(scopeClicks)} (${ang.toFixed(digits)} ${u} ${clicks < 0 ? "L" : "R"})`;
}

export function formatZeroAxisMm(
  mmAt100: number,
  axis: "windage" | "elevation",
  clickUnit: ScopeClickUnit = "MRAD",
): string {
  if (Math.abs(mmAt100) < 0.05) {
    return clickUnit === "MOA" ? "0.00 MOA" : "0.0 mil";
  }
  const ang = mmAt100ToAngular(mmAt100, clickUnit);
  const digits = clickUnit === "MOA" ? 2 : 1;
  const u = clickUnit === "MOA" ? "MOA" : "mil";
  if (axis === "windage") {
    return `${ang.toFixed(digits)} ${u} ${mmAt100 < 0 ? "L" : "R"}`;
  }
  return `${ang.toFixed(digits)} ${u} ${mmAt100 < 0 ? "U" : "D"}`;
}

export function zeroingKey(
  rifleId: string,
  scopeId: string,
  ammoId: string,
): string {
  return `${rifleId}::${scopeId}::${ammoId}`;
}

/** True if the player has pressed «Lagre zero» for this combo (or legacy save). */
export function isZeroVerified(
  profile: ZeroingProfile | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.verifiedAtMs != null && profile.verifiedAtMs > 0) return true;
  // Legacy saves: non-zero dial almost always means they saved once.
  return profile.savedXMm !== 0 || profile.savedYMm !== 0;
}

/** True if both kit id lists contain the same items (order-independent). */
export function kitsEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((id, i) => id === sb[i]);
}

/** Favorite ids still owned in inventory (qty > 0). */
export function ownedFavoriteKitIds(stats: PlayerStats): string[] {
  const owned = new Set(
    stats.inventory.filter((e) => e.qty > 0).map((e) => e.itemId),
  );
  return stats.favoriteKitIds.filter((id) => owned.has(id));
}

/**
 * Replace active kit with the saved favorite (owned items only).
 * Clears / transfers zero profiles based on mount tier rules.
 * Drops a mount that does not match the favorite scope tube diameter.
 */
export function applyFavoriteKit(stats: PlayerStats): PlayerStats {
  const nextKit = sanitizeKitScopeMountIds(
    ownedFavoriteKitIds(stats),
    getShopItem,
  );
  if (kitsEqual(stats.kit, nextKit)) return stats;
  return {
    ...stats,
    kit: nextKit,
    zeroingProfiles: applyMountZeroingAfterKitChange(
      stats.zeroingProfiles,
      stats.kit,
      nextKit,
    ),
  };
}

/** Drop all zero profiles that include this scope id. */
export function clearZeroingForScope(
  map: Record<string, ZeroingProfile>,
  scopeId: string,
): Record<string, ZeroingProfile> {
  const next: Record<string, ZeroingProfile> = {};
  const needle = `::${scopeId}::`;
  for (const [key, profile] of Object.entries(map)) {
    if (!key.includes(needle)) next[key] = profile;
  }
  return next;
}

/** Drop all zero profiles that include this rifle id. */
export function clearZeroingForRifle(
  map: Record<string, ZeroingProfile>,
  rifleId: string,
): Record<string, ZeroingProfile> {
  const next: Record<string, ZeroingProfile> = {};
  const prefix = `${rifleId}::`;
  for (const [key, profile] of Object.entries(map)) {
    if (!key.startsWith(prefix)) next[key] = profile;
  }
  return next;
}

/**
 * Copy verified (or any) zero profiles from one scope id to another for the
 * same rifle+ammo keys. Used by top-tier mounts when swapping scopes.
 */
export function transferZeroingForScopeSwap(
  map: Record<string, ZeroingProfile>,
  fromScopeId: string,
  toScopeId: string,
): Record<string, ZeroingProfile> {
  if (!fromScopeId || !toScopeId || fromScopeId === toScopeId) return map;
  const next = { ...map };
  const fromNeedle = `::${fromScopeId}::`;
  for (const [key, profile] of Object.entries(map)) {
    if (!key.includes(fromNeedle)) continue;
    const parts = key.split("::");
    if (parts.length !== 3) continue;
    const [rifleId, , ammoId] = parts;
    if (!rifleId || !ammoId) continue;
    const newKey = zeroingKey(rifleId, toScopeId, ammoId);
    if (!isZeroVerified(next[newKey])) {
      next[newKey] = { ...profile };
    }
  }
  return next;
}

function kitMountTier(kitIds: readonly string[]): MountTier | null {
  for (const id of kitIds) {
    const item = getShopItem(id);
    if (item && isMountItem(item)) return item.mount.tier;
  }
  return null;
}

/**
 * After a kit change: clear / transfer zeros based on mount tier.
 * Top = keep / transfer on same-diameter scope swap. Mid/budget = clear on
 * scope or mount remove.
 */
export function applyMountZeroingAfterKitChange(
  profiles: Record<string, ZeroingProfile>,
  beforeKit: readonly string[],
  afterKit: readonly string[],
): Record<string, ZeroingProfile> {
  const removed = beforeKit.filter((id) => !afterKit.includes(id));
  const added = afterKit.filter((id) => !beforeKit.includes(id));
  let next = profiles;

  const removedScope = removed
    .map((id) => getShopItem(id))
    .find((i): i is import("@/lib/shop/types").ScopeShopItem =>
      !!i && isScopeItem(i),
    );
  const addedScope = added
    .map((id) => getShopItem(id))
    .find((i): i is import("@/lib/shop/types").ScopeShopItem =>
      !!i && isScopeItem(i),
    );
  const removedMount = removed
    .map((id) => getShopItem(id))
    .find((i): i is import("@/lib/shop/types").MountShopItem =>
      !!i && isMountItem(i),
    );
  const afterTier = kitMountTier(afterKit);
  // Prefer mount that remains / is newly equipped; fall back to removed mount tier.
  const mountTier =
    afterTier ?? (removedMount ? removedMount.mount.tier : null);

  if (removedScope && addedScope) {
    const sameTube =
      removedScope.scope.tubeDiameterMm === addedScope.scope.tubeDiameterMm;
    if (mountTier === "top" && sameTube) {
      next = transferZeroingForScopeSwap(
        next,
        removedScope.id,
        addedScope.id,
      );
    } else if (mountClearsZeroOnScopeRemove(mountTier)) {
      next = clearZeroingForScope(next, removedScope.id);
    }
  } else if (removedScope && mountClearsZeroOnScopeRemove(mountTier)) {
    next = clearZeroingForScope(next, removedScope.id);
  }

  for (const id of removed) {
    const rem = getShopItem(id);
    if (rem?.category === "rifle") {
      next = clearZeroingForRifle(next, id);
    }
  }

  if (removedMount && mountClearsZeroOnMountRemove(removedMount.mount.tier)) {
    const scopeItem =
      afterKit.map((id) => getShopItem(id)).find((i) => i && isScopeItem(i)) ??
      beforeKit.map((id) => getShopItem(id)).find((i) => i && isScopeItem(i));
    if (scopeItem && isScopeItem(scopeItem)) {
      next = clearZeroingForScope(next, scopeItem.id);
    }
  }

  return next;
}

/** Clamp the initial random zero offset (±5 clicks). */
export function clampZeroBaseMm(mm: number): number {
  return Math.max(
    -MAX_ZERO_BASE_OFFSET_MM,
    Math.min(MAX_ZERO_BASE_OFFSET_MM, mm),
  );
}

/** Clamp session / saved turret dial (± many clicks). */
export function clampTurretMm(mm: number): number {
  return Math.max(
    -MAX_TURRET_OFFSET_MM,
    Math.min(MAX_TURRET_OFFSET_MM, mm),
  );
}

/**
 * Elevation dial clamp — absolute UP travel + optional mechanical zero-stop.
 * Does **not** use symmetric {@link clampTurretMm} (that capped ZCO at 100↑).
 */
export function clampElevationTurretMm(
  mm: number,
  scope:
    | Pick<ScopeSpec, "clickUnit" | "zeroStop" | "elevationUpClicks">
    | null
    | undefined,
): number {
  return clampElevationMmAt100(mm, scope);
}

/** @deprecated Prefer clampZeroBaseMm or clampTurretMm. */
export function clampZeroingMm(mm: number): number {
  return clampZeroBaseMm(mm);
}

/** Convert mm-at-100 m (angular) to mm on paper at `distanceM`. */
export function angularMmAtDistance(
  mmAt100: number,
  distanceM: number,
): number {
  return mmAt100 * (distanceM / 100);
}

/** How many 0.1 mil clicks equal this drop on paper at distance. */
export function clicksForDropMm(dropMm: number, distanceM: number): number {
  const mmPerClick = ZERO_CLICK_MM * (distanceM / 100);
  if (mmPerClick <= 0) return 0;
  return dropMm / mmPerClick;
}

function randomZeroClicks(random: () => number): number {
  return Math.floor(random() * 11) - 5;
}

export function ensureZeroingProfile(
  map: Record<string, ZeroingProfile>,
  rifleId: string,
  scopeId: string,
  ammoId: string,
  random: () => number = Math.random,
): {
  key: string;
  profile: ZeroingProfile;
  map: Record<string, ZeroingProfile>;
  rolled: boolean;
} {
  const key = zeroingKey(rifleId, scopeId, ammoId);
  const existing = map[key];
  if (existing) {
    return { key, profile: existing, map, rolled: false };
  }

  let xClicks = 0;
  let yClicks = 0;
  for (let i = 0; i < 4; i++) {
    xClicks = randomZeroClicks(random);
    yClicks = randomZeroClicks(random);
    if (xClicks !== 0 || yClicks !== 0) break;
  }
  if (xClicks === 0 && yClicks === 0) yClicks = 1;

  const profile: ZeroingProfile = {
    baseXMm: xClicks * ZERO_CLICK_MM,
    baseYMm: yClicks * ZERO_CLICK_MM,
    savedXMm: 0,
    savedYMm: 0,
  };
  return {
    key,
    profile,
    map: { ...map, [key]: profile },
    rolled: true,
  };
}

/**
 * Effective POI shift on paper at `distanceM`.
 * Profile + session are stored as mm-at-100 m (0.1 mil clicks × 10).
 * Optional `clickErrorPercent` scales player dials (saved + session) ±%.
 */
export function effectiveZeroOffsetMm(
  profile: ZeroingProfile,
  sessionXMm = 0,
  sessionYMm = 0,
  distanceM = 100,
  opts?: {
    clickErrorPercent?: number;
    random?: () => number;
  },
): { xMm: number; yMm: number } {
  const random = opts?.random ?? Math.random;
  const errPct = opts?.clickErrorPercent ?? 0;
  const dialX = applyScopeClickError(
    profile.savedXMm + sessionXMm,
    errPct,
    random,
  );
  const dialY = applyScopeClickError(
    profile.savedYMm + sessionYMm,
    errPct,
    random,
  );
  return {
    xMm: angularMmAtDistance(profile.baseXMm + dialX, distanceM),
    yMm: angularMmAtDistance(profile.baseYMm + dialY, distanceM),
  };
}

export function saveZeroing(
  map: Record<string, ZeroingProfile>,
  key: string,
  sessionXMm: number,
  sessionYMm: number,
): Record<string, ZeroingProfile> {
  const profile = map[key];
  if (!profile) return map;
  return {
    ...map,
    [key]: {
      ...profile,
      savedXMm: clampTurretMm(profile.savedXMm + sessionXMm),
      savedYMm: clampTurretMm(profile.savedYMm + sessionYMm),
      verifiedAtMs: Date.now(),
    },
  };
}

export function resolvePlayerItem(id: string): ShopItem | undefined {
  return getShopItem(id) ?? resolveHomeLoadItem(id, homeLotCache);
}

/** Physical hunting rifles in inventory (not licenses). */
export function countHuntingRifles(stats: PlayerStats): number {
  let n = 0;
  for (const e of stats.inventory) {
    const item = getShopItem(e.itemId);
    if (item?.category === "rifle") n += e.qty;
  }
  return n;
}

export function countPaidLicenses(stats: PlayerStats): number {
  return stats.weaponLicenses.filter((l) => !l.gifted).length;
}

/** Licenses not yet matched by an owned rifle. */
export function unusedLicenseCount(stats: PlayerStats): number {
  return Math.max(0, stats.weaponLicenses.length - countHuntingRifles(stats));
}

export function canBuyHuntingRifle(stats: PlayerStats): boolean {
  const rifles = countHuntingRifles(stats);
  return (
    rifles < MAX_HUNTING_RIFLES && rifles < stats.weaponLicenses.length
  );
}

export function canApproveNewLicense(stats: PlayerStats): boolean {
  return stats.weaponLicenses.length < MAX_HUNTING_RIFLES;
}

/** Distinct calibers on the player's våpenkort (exact catalog strings). */
export function licensedCalibers(
  licenses: readonly Pick<WeaponLicense, "caliber">[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of licenses) {
    const c = l.caliber.trim();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/** Factory ammo (and CB home-loads) require a matching våpenkort caliber. */
export function canBuyAmmoCaliber(
  licenses: readonly Pick<WeaponLicense, "caliber">[],
  caliber: string,
): boolean {
  const want = caliber.trim();
  if (!want) return false;
  return licenses.some((l) => l.caliber.trim() === want);
}

export function createWeaponLicense(input: {
  brand: string;
  type: string;
  caliber: string;
}): WeaponLicense {
  const slug = `${input.brand}-${input.type}`
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return {
    id: `license-${slug || "rifle"}-${Date.now().toString(36)}`,
    brand: input.brand.trim(),
    type: input.type.trim(),
    caliber: input.caliber.trim(),
  };
}

export function addToInventory(
  inventory: InventoryEntry[],
  itemId: string,
  qty = 1,
): InventoryEntry[] {
  const existing = inventory.find((e) => e.itemId === itemId);
  if (existing) {
    return inventory.map((e) =>
      e.itemId === itemId ? { ...e, qty: e.qty + qty } : e,
    );
  }
  return [...inventory, { itemId, qty }];
}

/** Patroner per shop purchase (parsed from unitLabel, e.g. "eske 50"). */
export function ammoRoundsPerPurchase(item: ShopItem): number {
  if (!isAmmoItem(item)) return 1;
  const match = item.unitLabel?.match(/(\d+)\s*$/);
  return match ? parseInt(match[1], 10) : 20;
}

export function getInventoryQty(
  inventory: InventoryEntry[],
  itemId: string,
): number {
  return inventory.find((e) => e.itemId === itemId)?.qty ?? 0;
}

/** Ready meals + snacks that auto-supply packs into the hunt kit. */
export function isAutoSupplyFoodItem(item: ShopItem): boolean {
  return isFoodItem(item) && isPackableFoodKind(item.food.kind);
}

/**
 * When {@link PlayerStats.autoSupplyFood} is on: put all owned mat/snacks in
 * kit, and drop empty snacks from kit.
 */
export function applyAutoSupplyFood(stats: PlayerStats): PlayerStats {
  if (!stats.autoSupplyFood) return stats;
  const keep = new Set(stats.kit);
  for (const entry of stats.inventory) {
    if (entry.qty <= 0) continue;
    const item = getShopItem(entry.itemId) ?? null;
    if (!item || !isAutoSupplyFoodItem(item)) continue;
    keep.add(entry.itemId);
  }
  const kit = [...keep].filter((id) => {
    const item = getShopItem(id);
    if (!item || !isAutoSupplyFoodItem(item)) return true;
    return getInventoryQty(stats.inventory, id) > 0;
  });
  const same =
    kit.length === stats.kit.length && kit.every((id) => stats.kit.includes(id));
  return same ? stats : { ...stats, kit };
}

export function formatInventoryQuantity(itemId: string, qty: number): string {
  const item = getShopItem(itemId);
  if (item && isAmmoItem(item)) {
    return `${qty} patron${qty === 1 ? "" : "er"}`;
  }
  if (item && isMiscItem(item) && isFireStarterMisc(item.misc)) {
    return `${qty} bål`;
  }
  if (isSpentBrassItemId(itemId)) {
    return `${qty} hylse${qty === 1 ? "" : "r"}`;
  }
  return qty > 1 ? `×${qty}` : "";
}

/**
 * Remove qty from inventory. For ammo, qty = patroner.
 * Returns ok:false when insufficient stock.
 */
export function consumeInventoryItem(
  inventory: InventoryEntry[],
  itemId: string,
  qty = 1,
): { inventory: InventoryEntry[]; ok: boolean } {
  const entry = inventory.find((e) => e.itemId === itemId);
  if (!entry || entry.qty < qty) {
    return { inventory, ok: false };
  }
  if (entry.qty === qty) {
    return {
      inventory: inventory.filter((e) => e.itemId !== itemId),
      ok: true,
    };
  }
  return {
    inventory: inventory.map((e) =>
      e.itemId === itemId ? { ...e, qty: e.qty - qty } : e,
    ),
    ok: true,
  };
}

/** Spend one round of ammo; drops from kit when empty. Optionally counts a rifle shot.
 * Centerfire rounds also grant one spent brass case for hjemmelading.
 * Home-loaded lots update roundsRemaining + return brass from the load's brass brand.
 * If an armed ladeplan matches the ammo caliber, rolls overpressure kaboom.
 */
export function consumeAmmoRound(
  stats: PlayerStats,
  ammoId: string,
  opts?: { rifleId?: string; rng?: () => number },
): { stats: PlayerStats; ok: boolean; kaboom?: boolean } {
  const { inventory, ok } = consumeInventoryItem(stats.inventory, ammoId, 1);
  if (!ok) return { stats, ok: false };
  const kit =
    getInventoryQty(inventory, ammoId) === 0
      ? stats.kit.filter((id) => id !== ammoId)
      : stats.kit;
  let nextInventory = inventory;
  let homeLoadedLots = stats.homeLoadedLots;

  if (isHomeLoadAmmoId(ammoId)) {
    const lot = homeLoadedLots.find((l) => l.id === ammoId);
    if (lot) {
      const remaining = Math.max(0, lot.roundsRemaining - 1);
      homeLoadedLots = patchHomeLoadedLot(homeLoadedLots, ammoId, {
        roundsRemaining: remaining,
      });
      const brassId = spentBrassItemIdForHomeLot(lot);
      if (brassId) {
        nextInventory = addToInventory(nextInventory, brassId, 1);
      }
    }
  } else {
    const brassId = spentBrassItemIdForAmmo(ammoId);
    if (brassId) {
      nextInventory = addToInventory(nextInventory, brassId, 1);
    }
  }

  let next: PlayerStats = {
    ...stats,
    inventory: nextInventory,
    kit,
    homeLoadedLots,
  };
  syncHomeLoadedLotCache(homeLoadedLots);

  if (opts?.rifleId) {
    next = recordRifleShot(next, opts.rifleId);
  }

  const lot = homeLoadedLots.find((l) => l.id === ammoId);
  const kaboomChance =
    lot && lot.kaboomChance > 0
      ? lot.kaboomChance
      : next.armedLoadPlan && next.armedLoadPlan.kaboomChance > 0
        ? next.armedLoadPlan.kaboomChance
        : 0;
  const kaboomCaliber =
    lot?.caliberKey ?? next.armedLoadPlan?.caliberKey ?? null;

  if (kaboomChance > 0 && opts?.rifleId && kaboomCaliber) {
    const ammo = resolvePlayerItem(ammoId);
    const ammoKey =
      ammo && isAmmoItem(ammo)
        ? spentBrassKeyForCaliber(ammo.ammo.caliber)
        : lot?.caliberKey ?? null;
    if (ammoKey && ammoKey === kaboomCaliber) {
      const roll = (opts.rng ?? Math.random)();
      if (roll < kaboomChance) {
        next = applyLoadKaboom(next, opts.rifleId);
        return { stats: next, ok: true, kaboom: true };
      }
    }
  }

  return { stats: next, ok: true };
}

/**
 * Open powder boxes into grain stock until `needGrains` is available.
 */
function ensurePowderGrains(
  inventory: InventoryEntry[],
  powderOpenGrains: Record<string, number>,
  powderItemId: string,
  needGrains: number,
): {
  inventory: InventoryEntry[];
  powderOpenGrains: Record<string, number>;
  ok: boolean;
} {
  let inv = inventory;
  let open = { ...powderOpenGrains };
  let available = open[powderItemId] ?? 0;
  const item = getShopItem(powderItemId);
  if (!item || !isPowderItem(item)) {
    return { inventory: inv, powderOpenGrains: open, ok: false };
  }
  const perBox = powderGrainsPerBox(item);
  while (available + 1e-6 < needGrains) {
    const boxes = getInventoryQty(inv, powderItemId);
    if (boxes <= 0) {
      return { inventory: inv, powderOpenGrains: open, ok: false };
    }
    const consumed = consumeInventoryItem(inv, powderItemId, 1);
    if (!consumed.ok) {
      return { inventory: inv, powderOpenGrains: open, ok: false };
    }
    inv = consumed.inventory;
    available += perBox;
    open[powderItemId] = available;
  }
  return { inventory: inv, powderOpenGrains: open, ok: true };
}

/**
 * «Lad ammo» — consume components for a ladeplan-rad, create shootable lot,
 * archive to ladebok, remove row from plan.
 */
export function loadHomeAmmoFromPlanRow(
  stats: PlayerStats,
  rowId: string,
): { stats: PlayerStats; ok: boolean; error?: string; lotId?: string } {
  const row = stats.loadDevTable.rows.find((r) => r.id === rowId);
  if (!row) return { stats, ok: false, error: "Finner ikke ladeplan-rad." };
  if (!row.powderItemId || !row.bulletItemId || !row.primerItemId) {
    return { stats, ok: false, error: "Velg krutt, kule og primer først." };
  }
  const brassId = stats.loadBenchRecipe.brassItemId;
  if (!brassId) {
    return { stats, ok: false, error: "Velg hylse på benken først." };
  }
  const n = Math.max(1, Math.min(50, Math.round(row.shotsLoaded)));
  const grainsNeeded = n * row.powderGrains;

  let inventory = stats.inventory;
  if (getInventoryQty(inventory, brassId) < n) {
    return { stats, ok: false, error: `Trenger ${n} hylser.` };
  }
  if (getInventoryQty(inventory, row.primerItemId) < n) {
    return { stats, ok: false, error: `Trenger ${n} tennhetter.` };
  }
  if (getInventoryQty(inventory, row.bulletItemId) < n) {
    return { stats, ok: false, error: `Trenger ${n} kuler.` };
  }

  const powderReady = ensurePowderGrains(
    inventory,
    stats.powderOpenGrains,
    row.powderItemId,
    grainsNeeded,
  );
  if (!powderReady.ok) {
    return {
      stats,
      ok: false,
      error: `Ikke nok krutt (trenger ${grainsNeeded.toFixed(1)} gr).`,
    };
  }
  inventory = powderReady.inventory;
  const powderOpenGrains = { ...powderReady.powderOpenGrains };
  powderOpenGrains[row.powderItemId] =
    (powderOpenGrains[row.powderItemId] ?? 0) - grainsNeeded;
  if (powderOpenGrains[row.powderItemId]! < 0.05) {
    delete powderOpenGrains[row.powderItemId];
  } else {
    powderOpenGrains[row.powderItemId] =
      Math.round(powderOpenGrains[row.powderItemId]! * 10) / 10;
  }

  inventory = consumeInventoryItem(inventory, brassId, n).inventory;
  inventory = consumeInventoryItem(inventory, row.primerItemId, n).inventory;
  inventory = consumeInventoryItem(inventory, row.bulletItemId, n).inventory;

  const lot = buildHomeLotFromRow(
    stats.loadBenchRecipe.caliberKey,
    { ...row, shotsLoaded: n },
    brassId,
  );
  if (!lot) {
    return { stats, ok: false, error: "Klarte ikke å bygge ladning." };
  }

  inventory = addToInventory(inventory, lot.id, n);
  const kit = stats.kit.includes(lot.id) ? stats.kit : [...stats.kit, lot.id];
  const homeLoadedLots = [...stats.homeLoadedLots, lot];
  const loadDevTable = removeLoadDevRow(stats.loadDevTable, rowId);
  const loadBook = upsertLoadBookEntry(
    stats.loadBook,
    buildLoadBookEntryFromLot(lot),
  );

  const next: PlayerStats = {
    ...stats,
    inventory,
    kit,
    powderOpenGrains,
    homeLoadedLots,
    loadDevTable,
    loadBook,
    armedLoadPlan:
      stats.armedLoadPlan?.loadDevRowId === rowId
        ? null
        : stats.armedLoadPlan,
  };
  syncHomeLoadedLotCache(homeLoadedLots);
  return { stats: next, ok: true, lotId: lot.id };
}

/** Arm a hjemmeladd lot for Load test (kaboom + measurement write-back). */
export function armHomeLoadedLot(
  stats: PlayerStats,
  lotId: string,
): PlayerStats {
  const lot = stats.homeLoadedLots.find((l) => l.id === lotId);
  if (!lot || lot.roundsRemaining <= 0) return stats;
  const plan: ArmedLoadPlan = {
    caliberKey: lot.caliberKey,
    pressurePct: lot.pressurePct,
    overpressurePct: lot.overpressurePct,
    kaboomChance: lot.kaboomChance,
    v0Mps: lot.estimatedV0Mps,
    powderGrains: lot.powderGrains,
    seatingDepthThou: lot.seatingDepthThou,
    colMm: lot.colMm,
    armedAtMs: Date.now(),
    loadDevRowId: null,
    homeLotId: lot.id,
  };
  const kit = stats.kit.includes(lot.id) ? stats.kit : [...stats.kit, lot.id];
  return {
    ...stats,
    kit,
    armedLoadPlan: plan,
    loadDevTable: { ...stats.loadDevTable, activeRowId: null },
  };
}

/**
 * Overpressure kaboom — rifle, pipe, stock, bedding and all CB Customs work lost.
 * No personal injury; hunter walks away. Scope / ammo / bag stay.
 */
export function applyLoadKaboom(
  stats: PlayerStats,
  rifleId: string,
): PlayerStats {
  if (!rifleId) return { ...stats, armedLoadPlan: null };

  const stockId =
    stats.kit.map((id) => getShopItem(id)).find((i) => i && isStockItem(i))
      ?.id ?? null;

  let inventory = stats.inventory;
  let kit = stats.kit.filter((id) => id !== rifleId);

  const rifleQty = getInventoryQty(inventory, rifleId);
  if (rifleQty > 0) {
    inventory = consumeInventoryItem(inventory, rifleId, rifleQty).inventory;
  }

  if (stockId) {
    kit = kit.filter((id) => id !== stockId);
    const stockQty = getInventoryQty(inventory, stockId);
    if (stockQty > 0) {
      inventory = consumeInventoryItem(inventory, stockId, stockQty).inventory;
    }
  }

  const customBarrels = { ...stats.customBarrels };
  delete customBarrels[rifleId];
  const spareBarrels = { ...stats.spareBarrels };
  delete spareBarrels[rifleId];
  const rifleRoundCounts = { ...stats.rifleRoundCounts };
  delete rifleRoundCounts[rifleId];

  return {
    ...stats,
    inventory,
    kit,
    customBarrels,
    spareBarrels,
    rifleRoundCounts,
    zeroingProfiles: clearZeroingForRifle(stats.zeroingProfiles, rifleId),
    customsMods: { ...EMPTY_CUSTOMS_MODS },
    armedLoadPlan: null,
  };
}

export function armLoadPlan(
  stats: PlayerStats,
  plan: ArmedLoadPlan,
): PlayerStats {
  const loadDevTable =
    plan.loadDevRowId != null
      ? {
          ...stats.loadDevTable,
          activeRowId: plan.loadDevRowId,
        }
      : stats.loadDevTable;
  return { ...stats, armedLoadPlan: plan, loadDevTable };
}

export function disarmLoadPlan(stats: PlayerStats): PlayerStats {
  if (!stats.armedLoadPlan && !stats.loadDevTable.activeRowId) return stats;
  return {
    ...stats,
    armedLoadPlan: null,
    loadDevTable: { ...stats.loadDevTable, activeRowId: null },
  };
}

/** Increment lifetime shots through a rifle barrel. */
export function recordRifleShot(
  stats: PlayerStats,
  rifleId: string,
  count = 1,
): PlayerStats {
  if (!rifleId || count <= 0) return stats;
  const prev = stats.rifleRoundCounts[rifleId] ?? 0;
  return {
    ...stats,
    rifleRoundCounts: {
      ...stats.rifleRoundCounts,
      [rifleId]: prev + Math.floor(count),
    },
  };
}

/** Reset barrel round count after CB Customs rebarrel / custom pipe. */
export function resetRifleBarrel(
  stats: PlayerStats,
  rifleId: string,
): PlayerStats {
  if (!rifleId) return stats;
  const next = { ...stats.rifleRoundCounts };
  next[rifleId] = 0;
  return { ...stats, rifleRoundCounts: next };
}

/** Clear developed + CB catalog home loads after a pipe swap.
 * Also clears home-loads setup so the fee must be paid again. */
export function clearHomeLoadsOnBarrelSwap(stats: PlayerStats): PlayerStats {
  const cbIds = new Set(Object.values(HOME_LOAD_AMMO_BY_CALIBER));
  const inventory = stats.inventory.filter(
    (e) => !isHomeLoadAmmoId(e.itemId) && !cbIds.has(e.itemId),
  );
  const kit = stats.kit.filter(
    (id) => !isHomeLoadAmmoId(id) && !cbIds.has(id),
  );
  syncHomeLoadedLotCache([]);
  return {
    ...stats,
    customsMods: {
      ...stats.customsMods,
      homeLoadsSetup: false,
    },
    homeLoadedLots: [],
    loadDevTable: createEmptyLoadDevTable(),
    loadBook: createEmptyLoadBook(),
    armedLoadPlan: null,
    inventory,
    kit,
  };
}

/** Move the installed custom pipe into spare inventory. */
export function stashInstalledCustomBarrel(
  stats: PlayerStats,
  rifleId: string,
): PlayerStats {
  const current = stats.customBarrels[rifleId];
  if (!current) return stats;
  const customBarrels = { ...stats.customBarrels };
  delete customBarrels[rifleId];
  const list = [
    ...(stats.spareBarrels[rifleId] ?? []),
    toStoredCustomBarrel(current),
  ];
  return {
    ...stats,
    customBarrels,
    spareBarrels: { ...stats.spareBarrels, [rifleId]: list },
  };
}

/** Install a custom CNC barrel and zero wear on that rifle. */
export function installCustomBarrel(
  stats: PlayerStats,
  rifleId: string,
  barrel: InstalledCustomBarrel,
  priceNok: number,
): PlayerStats {
  if (!rifleId || priceNok < 0 || stats.balance < priceNok) return stats;
  const stashed = stashInstalledCustomBarrel(stats, rifleId);
  return clearHomeLoadsOnBarrelSwap(
    resetRifleBarrel(
      {
        ...stashed,
        balance: stashed.balance - priceNok,
        customsMods: customsModsAfterPipeInstall(stashed.customsMods),
        customBarrels: {
          ...stashed.customBarrels,
          [rifleId]: barrel,
        },
      },
      rifleId,
    ),
  );
}

/** Re-install a spare custom pipe (no charge — already paid). */
export function reinstallSpareCustomBarrel(
  stats: PlayerStats,
  rifleId: string,
  storageId: string,
): PlayerStats {
  if (!rifleId || !storageId) return stats;
  const spares = stats.spareBarrels[rifleId] ?? [];
  const pick = spares.find((b) => b.storageId === storageId);
  if (!pick) return stats;

  let nextSpares = spares.filter((b) => b.storageId !== storageId);
  const current = stats.customBarrels[rifleId];
  if (current) {
    nextSpares = [...nextSpares, toStoredCustomBarrel(current)];
  }

  const { storageId: _id, ...barrel } = pick;
  return clearHomeLoadsOnBarrelSwap(
    resetRifleBarrel(
      {
        ...stats,
        customBarrels: { ...stats.customBarrels, [rifleId]: barrel },
        spareBarrels: { ...stats.spareBarrels, [rifleId]: nextSpares },
      },
      rifleId,
    ),
  );
}

/** Standard factory pipe — stashes custom blank if present. */
export function reinstallFactoryBarrel(
  stats: PlayerStats,
  rifleId: string,
  priceNok: number,
): PlayerStats {
  if (!rifleId || priceNok < 0 || stats.balance < priceNok) return stats;
  const stashed = stashInstalledCustomBarrel(stats, rifleId);
  return clearHomeLoadsOnBarrelSwap(
    resetRifleBarrel(
      { ...stashed, balance: stashed.balance - priceNok },
      rifleId,
    ),
  );
}

/** One-time fluting retrofit on an installed unfluted custom steel barrel. */
export function fluteInstalledCustomBarrel(
  stats: PlayerStats,
  rifleId: string,
  priceNok: number,
): PlayerStats {
  if (!rifleId || priceNok < 0 || stats.balance < priceNok) return stats;
  const existing = stats.customBarrels[rifleId];
  if (!existing) return stats;
  if (existing.material === "carbon") return stats;
  if (existing.fluted) return stats;
  return {
    ...stats,
    balance: stats.balance - priceNok,
    customBarrels: {
      ...stats.customBarrels,
      [rifleId]: { ...existing, fluted: true },
    },
  };
}

/** Clear custom blank (e.g. standard factory rebarrel). */
export function clearCustomBarrel(
  stats: PlayerStats,
  rifleId: string,
): PlayerStats {
  if (!rifleId || !stats.customBarrels[rifleId]) return stats;
  const next = { ...stats.customBarrels };
  delete next[rifleId];
  return { ...stats, customBarrels: next };
}

export function getRifleRoundCount(
  counts: Record<string, number> | undefined,
  rifleId: string,
): number {
  if (!counts) return 0;
  const n = counts[rifleId];
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/** Default Finn.no resale fraction of catalog purchase price. */
export const FINN_SALE_FRACTION = 0.5;

/** Chance the Finn buyer never shows (sale aborted, item stays). */
export const FINN_BUYER_NO_SHOW_CHANCE = 0.3;

/** How many inventory units one Finn sale removes (ammo = one eske). */
export function finnSaleConsumeQty(item: ShopItem): number {
  return isAmmoItem(item) ? ammoRoundsPerPurchase(item) : 1;
}

/**
 * Payout for selling one shop unit on Finn (50% of catalog price by default).
 * Partial ammo boxes pay proportionally.
 */
export function finnSalePayoutNok(
  item: ShopItem,
  ownedQty: number,
  fraction: number = FINN_SALE_FRACTION,
): { payout: number; consumeQty: number } | null {
  if (ownedQty <= 0 || item.priceNok <= 0) return null;
  if (isAmmoItem(item)) {
    const box = ammoRoundsPerPurchase(item);
    const consumeQty = Math.min(ownedQty, box);
    const payout = Math.floor(
      item.priceNok * fraction * (consumeQty / box),
    );
    if (payout <= 0 && consumeQty <= 0) return null;
    return { payout, consumeQty };
  }
  return {
    payout: Math.floor(item.priceNok * fraction),
    consumeQty: 1,
  };
}

/**
 * Sell one inventory unit on Finn (catalog price × fraction).
 * Removes from kit when stock hits zero.
 */
export function sellInventoryOnFinn(
  stats: PlayerStats,
  itemId: string,
  fraction: number = FINN_SALE_FRACTION,
): { stats: PlayerStats; payout: number; consumeQty: number } | null {
  const item = getShopItem(itemId);
  if (!item) return null;
  const owned = getInventoryQty(stats.inventory, itemId);
  const deal = finnSalePayoutNok(item, owned, fraction);
  if (!deal) return null;
  const { inventory, ok } = consumeInventoryItem(
    stats.inventory,
    itemId,
    deal.consumeQty,
  );
  if (!ok) return null;
  const kit =
    getInventoryQty(inventory, itemId) === 0
      ? stats.kit.filter((id) => id !== itemId)
      : stats.kit;
  let rifleRoundCounts = stats.rifleRoundCounts;
  let customBarrels = stats.customBarrels;
  let spareBarrels = stats.spareBarrels;
  if (
    item.category === "rifle" &&
    getInventoryQty(inventory, itemId) === 0
  ) {
    if (rifleRoundCounts[itemId] != null) {
      rifleRoundCounts = { ...rifleRoundCounts };
      delete rifleRoundCounts[itemId];
    }
    if (customBarrels[itemId] != null) {
      customBarrels = { ...customBarrels };
      delete customBarrels[itemId];
    }
    if (spareBarrels[itemId] != null) {
      spareBarrels = { ...spareBarrels };
      delete spareBarrels[itemId];
    }
  }
  return {
    stats: {
      ...stats,
      inventory,
      kit,
      rifleRoundCounts,
      customBarrels,
      spareBarrels,
      balance: stats.balance + deal.payout,
    },
    payout: deal.payout,
    consumeQty: deal.consumeQty,
  };
}
