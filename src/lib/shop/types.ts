import type { AmmoSpec, ProjectileType } from "@/lib/ammo/spec";
import type { CamoSpec } from "@/lib/camo/spec";
import type { CarrySpec } from "@/lib/carry/spec";
import type { MiscSpec } from "@/lib/misc/spec";
import type { LrfSpec, ScopeSpec } from "@/lib/optics/spec";
import type { StockSpec } from "@/lib/stock/spec";
import type { RifleSpec } from "@/lib/rifle/spec";
import type { BallisticsSpec } from "@/lib/ballistics/spec";
import type { SkiSpec } from "@/lib/ski/spec";
import type { BipodSpec } from "@/lib/bipod/spec";
import type { FoodSpec } from "@/lib/food/spec";

export type ShopCategory =
  | "lrf"
  | "scope"
  | "suppressor"
  | "stock"
  | "rifle"
  | "ammo"
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
  ammo?: AmmoSpec;
  camo?: CamoSpec;
  carry?: CarrySpec;
  misc?: MiscSpec;
  lrf?: LrfSpec;
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
  scope: "Scopes",
  suppressor: "Lyddempere",
  stock: "Stokker",
  rifle: "Rifler",
  ammo: "Ammunisjon",
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
  "scope",
  "suppressor",
  "bipod",
  "stock",
  "rifle",
  "ammo",
  "camo",
  "ballistics",
  "backpack",
  "chestrig",
  "skis",
  "food",
  "misc",
];

export type { ProjectileType };
