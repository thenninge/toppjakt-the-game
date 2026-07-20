import { getShopItem } from "@/lib/shop/catalog";
import type { ShopItem } from "@/lib/shop/types";
import { isAmmoItem } from "@/lib/shop/types";

export type InventoryEntry = {
  itemId: string;
  qty: number;
};

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
};

export const STARTING_BALANCE = 500_000;
export const STARTER_RIFLE_ID = "rifle-cz452";
export const STARTER_LICENSE_ID = "license-starter-cz452";
/** Temporary range-test loadout (Sauer 200 STR + ZCO + match ammo). */
export const TEST_RANGE_LOADOUT_IDS = [
  "rifle-sauer-200str",
  "scope-nf-nx8-4-32-mrad",
  "ammo-norma-65x55-black-diamond",
  "ammo-lapua-65x55-scenar",
  "sup-svemko-genesis-30",
  "bipod-trs-really-right",
  "stock-mdt-acc-elite-rem700",
] as const;
export const TEST_RANGE_LICENSE_ID = "license-test-sauer-200str";
/** Norwegian satire: max legal hunting rifles before the system says nei. */
export const MAX_HUNTING_RIFLES = 8;
/** Base søknadsgebyr — doubles per paid license (500, 1000, 2000…). */
export const BASE_PERMIT_FEE = 500;

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
    maxRange: 0,
    inventory: [],
    kit: [],
    weaponLicenses: [],
    ammoAffinities: {},
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

  // Test range loadout — top shelf for shooting UX work.
  for (const id of TEST_RANGE_LOADOUT_IDS) {
    if (!next.inventory.some((e) => e.itemId === id)) {
      const item = getShopItem(id);
      const qty =
        item && isAmmoItem(item) ? ammoRoundsPerPurchase(item) : 1;
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

  const testKit = [...TEST_RANGE_LOADOUT_IDS];
  next = { ...next, kit: testKit };

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
