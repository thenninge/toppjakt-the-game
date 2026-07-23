import type { AmmoSpec, ProjectileType } from "@/lib/ammo/spec";
import type { CamoSpec } from "@/lib/camo/spec";
import type { CarrySpec } from "@/lib/carry/spec";
import type { MiscSpec } from "@/lib/misc/spec";
import type { LrfSpec, ScopeSpec, ThermalSpec } from "@/lib/optics/spec";
import type { StockSpec } from "@/lib/stock/spec";
import type { RifleSpec } from "@/lib/rifle/spec";
import type { BallisticsSpec } from "@/lib/ballistics/spec";
import type { SkiSpec } from "@/lib/ski/spec";
import type { BipodSpec } from "@/lib/bipod/spec";
import type { FoodSpec } from "@/lib/food/spec";

export type ShopCategory =
  | "lrf"
  | "thermal"
  | "scope"
  | "suppressor"
  | "stock"
  | "rifle"
  | "ammo"
  | "reloading"
  | "camo"
  | "ballistics"
  | "backpack"
  | "chestrig"
  | "skis"
  | "bipod"
  | "food"
  | "misc";

export type ShopItemBase = {
  id: string;
  category: ShopCategory;
  brand: string;
  name: string;
  priceNok: number;
  weightGrams?: number;
  note?: string;
  fits?: string;
  caliber?: string;
  unitLabel?: string;
  /** Listed but not buyable (grayed — "Sold out"). */
  soldOut?: boolean;
};

export type AmmoShopItem = ShopItemBase & {
  category: "ammo";
  ammo: AmmoSpec;
  unitLabel: string;
  weightGrams: number;
  camo?: never;
  carry?: never;
  misc?: never;
  lrf?: never;
  thermal?: never;
  scope?: never;
  stock?: never;
  rifle?: never;
  ballistics?: never;
  ski?: never;
  bipod?: never;
  food?: never;
};

export type CamoShopItem = ShopItemBase & {
  category: "camo";
  camo: CamoSpec;
  weightGrams: number;
  ammo?: never;
  carry?: never;
  misc?: never;
  lrf?: never;
  thermal?: never;
  scope?: never;
  stock?: never;
  rifle?: never;
  ballistics?: never;
  ski?: never;
  bipod?: never;
  food?: never;
};

export type CarryShopItem = ShopItemBase & {
  category: "backpack" | "chestrig";
  carry: CarrySpec;
  weightGrams: number;
  ammo?: never;
  camo?: never;
  misc?: never;
  lrf?: never;
  thermal?: never;
  scope?: never;
  stock?: never;
  rifle?: never;
  ballistics?: never;
  ski?: never;
  bipod?: never;
  food?: never;
};

export type MiscShopItem = ShopItemBase & {
  category: "misc";
  misc: MiscSpec;
  weightGrams: number;
  ammo?: never;
  camo?: never;
  carry?: never;
  lrf?: never;
  thermal?: never;
  scope?: never;
  stock?: never;
  rifle?: never;
  ballistics?: never;
  ski?: never;
  bipod?: never;
  food?: never;
};

export type LrfShopItem = ShopItemBase & {
  category: "lrf";
  lrf: LrfSpec;
  weightGrams: number;
  ammo?: never;
  camo?: never;
  carry?: never;
  misc?: never;
  scope?: never;
  stock?: never;
  rifle?: never;
  ballistics?: never;
  ski?: never;
  bipod?: never;
  food?: never;
  thermal?: never;
};

export type ThermalShopItem = ShopItemBase & {
  category: "thermal";
  thermal: ThermalSpec;
  weightGrams: number;
  ammo?: never;
  camo?: never;
  carry?: never;
  misc?: never;
  lrf?: never;
  scope?: never;
  stock?: never;
  rifle?: never;
  ballistics?: never;
  ski?: never;
  bipod?: never;
  food?: never;
};

export type ScopeShopItem = ShopItemBase & {
  category: "scope";
  scope: ScopeSpec;
  weightGrams: number;
  ammo?: never;
  camo?: never;
  carry?: never;
  misc?: never;
  lrf?: never;
  stock?: never;
  rifle?: never;
  ballistics?: never;
  ski?: never;
  bipod?: never;
  food?: never;
};

export type StockShopItem = ShopItemBase & {
  category: "stock";
  stock: StockSpec;
  weightGrams: number;
  ammo?: never;
  camo?: never;
  carry?: never;
  misc?: never;
  lrf?: never;
  thermal?: never;
  scope?: never;
  rifle?: never;
  ballistics?: never;
  ski?: never;
  bipod?: never;
  food?: never;
};

export type RifleShopItem = ShopItemBase & {
  category: "rifle";
  rifle: RifleSpec;
  weightGrams: number;
  ammo?: never;
  camo?: never;
  carry?: never;
  misc?: never;
  lrf?: never;
  thermal?: never;
  scope?: never;
  stock?: never;
  ballistics?: never;
  ski?: never;
  bipod?: never;
  food?: never;
};

export type BallisticsShopItem = ShopItemBase & {
  category: "ballistics";
  ballistics: BallisticsSpec;
  weightGrams: number;
  ammo?: never;
  camo?: never;
  carry?: never;
  misc?: never;
  lrf?: never;
  thermal?: never;
  scope?: never;
  stock?: never;
  rifle?: never;
  ski?: never;
  bipod?: never;
  food?: never;
};

export type SkiShopItem = ShopItemBase & {
  category: "skis";
  ski: SkiSpec;
  weightGrams: number;
  ammo?: never;
  camo?: never;
  carry?: never;
  misc?: never;
  lrf?: never;
  thermal?: never;
  scope?: never;
  stock?: never;
  rifle?: never;
  ballistics?: never;
  bipod?: never;
  food?: never;
};

export type BipodShopItem = ShopItemBase & {
  category: "bipod";
  bipod: BipodSpec;
  weightGrams: number;
  ammo?: never;
  camo?: never;
  carry?: never;
  misc?: never;
  lrf?: never;
  thermal?: never;
  scope?: never;
  stock?: never;
  rifle?: never;
  ballistics?: never;
  ski?: never;
  food?: never;
};

export type FoodShopItem = ShopItemBase & {
  category: "food";
  food: FoodSpec;
  weightGrams: number;
  ammo?: never;
  camo?: never;
  carry?: never;
  misc?: never;
  lrf?: never;
  thermal?: never;
  scope?: never;
  stock?: never;
  rifle?: never;
  ballistics?: never;
  ski?: never;
  bipod?: never;
};

export type GearShopItem = ShopItemBase & {
  category: Exclude<
    ShopCategory,
    | "ammo"
    | "camo"
    | "backpack"
    | "chestrig"
    | "misc"
    | "lrf"
    | "thermal"
    | "scope"
    | "stock"
    | "rifle"
    | "ballistics"
    | "skis"
    | "bipod"
    | "food"
  >;
  ammo?: never;
  camo?: never;
  carry?: never;
  misc?: never;
  lrf?: never;
  thermal?: never;
  scope?: never;
  stock?: never;
  rifle?: never;
  ballistics?: never;
  ski?: never;
  weightGrams: number;
};

export type ShopItem =
  | AmmoShopItem
  | CamoShopItem
  | CarryShopItem
  | MiscShopItem
  | LrfShopItem
  | ThermalShopItem
  | ScopeShopItem
  | StockShopItem
  | RifleShopItem
  | BallisticsShopItem
  | SkiShopItem
  | BipodShopItem
  | FoodShopItem
  | GearShopItem;

export type CatalogDraft = {
  id: string;
  category: ShopCategory;
  brand: string;
  name: string;
  priceNok: number;
  weightGrams?: number;
  note?: string;
  fits?: string;
  caliber?: string;
  unitLabel?: string;
  soldOut?: boolean;
  ammo?: AmmoSpec;
  camo?: CamoSpec;
  carry?: CarrySpec;
  misc?: MiscSpec;
  lrf?: LrfSpec;
  thermal?: ThermalSpec;
  scope?: ScopeSpec;
  stock?: StockSpec;
  rifle?: RifleSpec;
  ballistics?: BallisticsSpec;
  ski?: SkiSpec;
  bipod?: BipodSpec;
  food?: FoodSpec;
};

export function isAmmoItem(item: ShopItem): item is AmmoShopItem {
  return item.category === "ammo";
}

export function isCamoItem(item: ShopItem): item is CamoShopItem {
  return item.category === "camo";
}

export function isCarryItem(item: ShopItem): item is CarryShopItem {
  return item.category === "backpack" || item.category === "chestrig";
}

export function isMiscItem(item: ShopItem): item is MiscShopItem {
  return item.category === "misc";
}

export function isLrfItem(item: ShopItem): item is LrfShopItem {
  return item.category === "lrf";
}

export function isThermalItem(item: ShopItem): item is ThermalShopItem {
  return item.category === "thermal";
}

export function isScopeItem(item: ShopItem): item is ScopeShopItem {
  return item.category === "scope";
}

export function isStockItem(item: ShopItem): item is StockShopItem {
  return item.category === "stock";
}

export function isRifleItem(item: ShopItem): item is RifleShopItem {
  return item.category === "rifle";
}

export function isBallisticsItem(item: ShopItem): item is BallisticsShopItem {
  return item.category === "ballistics";
}

export function isSkiItem(item: ShopItem): item is SkiShopItem {
  return item.category === "skis";
}

export function isBipodItem(item: ShopItem): item is BipodShopItem {
  return item.category === "bipod";
}

export function isFoodItem(item: ShopItem): item is FoodShopItem {
  return item.category === "food";
}

export const SHOP_CATEGORY_LABELS: Record<ShopCategory, string> = {
  lrf: "LRF / Avstandsmålere",
  thermal: "Termisk / Spotters",
  scope: "Scopes",
  suppressor: "Lyddempere",
  stock: "Stokker",
  rifle: "Rifler",
  ammo: "Ammunisjon",
  reloading: "Hjemmelading",
  camo: "Camouflage",
  ballistics: "Ballistics",
  backpack: "Backpacks",
  chestrig: "Chestrigs",
  skis: "Skis/Snowshoes",
  bipod: "Bipods / Tofot",
  food: "Food",
  misc: "Misc kult kit",
};

export const SHOP_CATEGORIES: ShopCategory[] = [
  "lrf",
  "thermal",
  "scope",
  "suppressor",
  "bipod",
  "stock",
  "rifle",
  "ammo",
  "reloading",
  "camo",
  "ballistics",
  "backpack",
  "chestrig",
  "skis",
  "food",
  "misc",
];

/** Home inventory buckets (skap-gruppering). */
export type InventoryGroupId = "gun_kit" | "kit_kit" | "camo" | "food";

export const INVENTORY_GROUPS: readonly {
  id: InventoryGroupId;
  label: string;
}[] = [
  { id: "gun_kit", label: "Gun-kit" },
  { id: "kit_kit", label: "Kit-kit" },
  { id: "camo", label: "Camo/clothes" },
  { id: "food", label: "Food" },
] as const;

/**
 * Gun-kit = rifle/optik/ammo/tofoter.
 * Kit-kit = LRF/bino, thermal, Kestrel, chestrig, headlamp, camcorder, …
 * Camo/clothes + Food = egne lister.
 */
export function inventoryGroupForItem(item: ShopItem): InventoryGroupId {
  switch (item.category) {
    case "rifle":
    case "scope":
    case "suppressor":
    case "stock":
    case "bipod":
    case "ammo":
    case "reloading":
      return "gun_kit";
    case "camo":
      return "camo";
    case "food":
      return "food";
    default:
      // lrf, thermal, ballistics, backpack, chestrig, skis, misc
      return "kit_kit";
  }
}

export type { ProjectileType };
