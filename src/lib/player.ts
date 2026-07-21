import type { GameCarcass } from "@/lib/hunt/carcass";
import {
  EMPTY_CUSTOMS_MODS,
  type CustomsMods,
} from "@/lib/customs/spec";
import { getShopItem } from "@/lib/shop/catalog";
import type { ShopItem } from "@/lib/shop/types";
import { isAmmoItem } from "@/lib/shop/types";

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
  /** Effective zero offset on paper when the series was shot (mm). */
  zeroXMm: number;
  zeroYMm: number;
  /** Saved turret correction at log time (mm). */
  savedZeroXMm: number;
  savedZeroYMm: number;
  /** Unsaved session clicks at log time (mm). */
  sessionZeroXMm: number;
  sessionZeroYMm: number;
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
  /** Harvested birds ready for Meat Market (weight + meat quality). */
  carcasses: GameCarcass[];
  /** Longest hunting hit distance in meters. */
  maxRange: number;
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
  /** Chronological range series log (newest first). */
  shotLog: ShotLogEntry[];
  /** Field DOPE card from range (newest first). */
  dopeCard: DopeCardEntry[];
  /** CB Customs gunsmith / finish work. */
  customsMods: CustomsMods;
  /** Booked hunting terrain from inatur.no (null = none chosen yet). */
  selectedHuntingTerrainId: string | null;
  /** Handshake grounds unlocked at Rulles (terrain ids). */
  unlockedTerrainIds: string[];
};

export const STARTING_BALANCE = 500_000;
export const STARTER_RIFLE_ID = "rifle-cz452";
export const STARTER_LICENSE_ID = "license-starter-cz452";
/** Temporary range-test weapon platform (Sauer 200 STR + NF + match ammo). */
export const TEST_RANGE_LOADOUT_IDS = [
  "rifle-sauer-200str",
  "scope-nf-nx8-4-32-mrad",
  "ammo-norma-65x55-black-diamond",
  "ammo-lapua-65x55-scenar",
  "sup-svemko-genesis-30",
  "bipod-trs-really-right",
  "stock-mdt-acc-elite-rem700",
] as const;

/**
 * Full starter hunt kit (also equipped). One item per slot — expand later if asked.
 * Food qty overrides are in STARTER_HUNT_QTY.
 */
export const STARTER_HUNT_LOADOUT_IDS = [
  ...TEST_RANGE_LOADOUT_IDS,
  "misc-vorn-deer-42",
  "food-msr-pocketrocket",
  "food-msr-isopro-230",
  "food-real-turmat",
  "food-boller-5pk",
  "food-polarbrod-ost-skinke",
  "food-dronning-kokesjokolade",
  "misc-thermos-jula",
  "misc-sittpute-biltema",
  "misc-triggercam",
  "camo-pinewood-lappland",
  "camo-buff-autumn-realtree",
  "camo-beanie-forest-swedteam",
  "camo-gloves-forest-swedteam",
  "camo-boots-lowa",
  "lrf-sig-kilo3000-bdx-10x42",
  "misc-kestrel-5700-elite",
] as const;

/** Extra inventory qty for consumables (default 1). */
export const STARTER_HUNT_QTY: Partial<Record<string, number>> = {
  "food-real-turmat": 3,
  "food-boller-5pk": 1,
  "food-polarbrod-ost-skinke": 1,
  "food-dronning-kokesjokolade": 1,
};

export const TEST_RANGE_LICENSE_ID = "license-test-sauer-200str";
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
/** Max dial / saved turret correction (±100 clicks ≈ ±10 mil). */
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

export function createInitialStats(): PlayerStats {
  return {
    name: "",
    nickname: "",
    balance: STARTING_BALANCE,
    orrhaner: 0,
    tiur: 0,
    lifetimeTiur: 0,
    lifetimeOrrhaner: 0,
    carcasses: [],
    maxRange: 0,
    inventory: [],
    kit: [],
    weaponLicenses: [],
    ammoAffinities: {},
    zeroingProfiles: {},
    shotLog: [],
    dopeCard: [],
    customsMods: { ...EMPTY_CUSTOMS_MODS },
    selectedHuntingTerrainId: null,
    unlockedTerrainIds: [],
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

export function formatDopeElevationClicks(clicks: number): string {
  if (clicks === 0) return "0";
  const mil = Math.abs(clicks / 10).toFixed(1);
  return `${Math.abs(clicks)} (${mil} mil ${clicks < 0 ? "U" : "D"})`;
}

export function formatDopeWindageClicks(clicks: number): string {
  if (clicks === 0) return "0";
  const mil = Math.abs(clicks / 10).toFixed(1);
  return `${Math.abs(clicks)} (${mil} mil ${clicks < 0 ? "L" : "R"})`;
}

export function formatZeroAxisMm(
  mmAt100: number,
  axis: "windage" | "elevation",
): string {
  const clicks = Math.round(mmAt100 / ZERO_CLICK_MM);
  if (clicks === 0) return "0.0 mil";
  const mil = Math.abs(clicks / 10).toFixed(1);
  if (axis === "windage") {
    return `${mil} mil ${clicks < 0 ? "L" : "R"}`;
  }
  return `${mil} mil ${clicks < 0 ? "U" : "D"}`;
}

export function zeroingKey(
  rifleId: string,
  scopeId: string,
  ammoId: string,
): string {
  return `${rifleId}::${scopeId}::${ammoId}`;
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
 */
export function effectiveZeroOffsetMm(
  profile: ZeroingProfile,
  sessionXMm = 0,
  sessionYMm = 0,
  distanceM = 100,
): { xMm: number; yMm: number } {
  const x100 = profile.baseXMm + profile.savedXMm + sessionXMm;
  const y100 = profile.baseYMm + profile.savedYMm + sessionYMm;
  return {
    xMm: angularMmAtDistance(x100, distanceM),
    yMm: angularMmAtDistance(y100, distanceM),
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
    },
  };
}

export function resolvePlayerItem(id: string): ShopItem | undefined {
  return getShopItem(id);
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

export function grantStarterGear(stats: PlayerStats): PlayerStats {
  let next = stats;

  // CZ inheritance + license (still in inventory; not forced into kit).
  if (!next.inventory.some((e) => e.itemId === STARTER_RIFLE_ID)) {
    next = {
      ...next,
      inventory: [...next.inventory, { itemId: STARTER_RIFLE_ID, qty: 1 }],
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

  // Full hunt + range test loadout — inventory and kit.
  for (const id of STARTER_HUNT_LOADOUT_IDS) {
    if (!next.inventory.some((e) => e.itemId === id)) {
      const item = getShopItem(id);
      let qty = STARTER_HUNT_QTY[id] ?? 1;
      if (item && isAmmoItem(item)) {
        qty = ammoRoundsPerPurchase(item);
      }
      next = {
        ...next,
        inventory: addToInventory(next.inventory, id, qty),
      };
    }
  }
  if (!next.weaponLicenses.some((l) => l.id === TEST_RANGE_LICENSE_ID)) {
    next = {
      ...next,
      weaponLicenses: [
        ...next.weaponLicenses,
        {
          id: TEST_RANGE_LICENSE_ID,
          brand: "Sauer",
          type: "200 STR",
          caliber: "6,5×55",
          gifted: true,
        },
      ],
    };
  }

  next = { ...next, kit: [...STARTER_HUNT_LOADOUT_IDS] };

  // Starter platform is already zeroed — BDX holds assume perfect 100 m zero.
  const perfect: ZeroingProfile = {
    baseXMm: 0,
    baseYMm: 0,
    savedXMm: 0,
    savedYMm: 0,
  };
  const rifleId = TEST_RANGE_LOADOUT_IDS[0];
  const scopeId = TEST_RANGE_LOADOUT_IDS[1];
  let profiles = { ...next.zeroingProfiles };
  for (const ammoId of [
    "ammo-norma-65x55-black-diamond",
    "ammo-lapua-65x55-scenar",
  ]) {
    profiles = {
      ...profiles,
      [zeroingKey(rifleId, scopeId, ammoId)]: perfect,
    };
  }
  next = { ...next, zeroingProfiles: profiles };

  return next;
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

export function formatInventoryQuantity(itemId: string, qty: number): string {
  const item = getShopItem(itemId);
  if (item && isAmmoItem(item)) {
    return `${qty} patron${qty === 1 ? "" : "er"}`;
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

/** Spend one round of ammo; drops from kit when empty. */
export function consumeAmmoRound(
  stats: PlayerStats,
  ammoId: string,
): { stats: PlayerStats; ok: boolean } {
  const { inventory, ok } = consumeInventoryItem(stats.inventory, ammoId, 1);
  if (!ok) return { stats, ok: false };
  const kit =
    getInventoryQty(inventory, ammoId) === 0
      ? stats.kit.filter((id) => id !== ammoId)
      : stats.kit;
  return { stats: { ...stats, inventory, kit }, ok: true };
}

/** Default Finn.no resale fraction of catalog purchase price. */
export const FINN_SALE_FRACTION = 0.5;

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
  return {
    stats: {
      ...stats,
      inventory,
      kit,
      balance: stats.balance + deal.payout,
    },
    payout: deal.payout,
    consumeQty: deal.consumeQty,
  };
}
