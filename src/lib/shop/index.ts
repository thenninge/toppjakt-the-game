export type {
  ShopCategory,
  ShopItem,
  AmmoShopItem,
  CamoShopItem,
  CarryShopItem,
  MiscShopItem,
  LrfShopItem,
  ThermalShopItem,
  ScopeShopItem,
  StockShopItem,
  RifleShopItem,
  BallisticsShopItem,
  SkiShopItem,
  BipodShopItem,
  FoodShopItem,
  SuppressorShopItem,
} from "./types";
export {
  SHOP_CATEGORIES,
  SHOP_CATEGORY_LABELS,
  isAmmoItem,
  isCamoItem,
  isCarryItem,
  isBackpackItem,
  isChestrigItem,
  isMiscItem,
  isLrfItem,
  isThermalItem,
  isScopeItem,
  isStockItem,
  isRifleItem,
  isBallisticsItem,
  isSkiItem,
  isBipodItem,
  isFoodItem,
  isSuppressorItem,
  isBundleItem,
} from "./types";
export {
  SHOP_CATALOG,
  getCatalogByCategory,
  getShopItem,
  isPurchasableInShop,
  starterKitDealPriceNok,
  starterKitListPriceNok,
  resolveStarterKitPurchase,
} from "./catalog";
export type { AmmoSpec, ProjectileType } from "@/lib/ammo/spec";
export {
  moaToGroupMm,
  CALIBER_SORT_ORDER,
  PROJECTILE_TYPE_SORT_ORDER,
} from "@/lib/ammo/spec";
export type { CamoSpec, CamoTerrain, CamoSlot } from "@/lib/camo/spec";
export {
  BIRD_SPOT_REFERENCE,
  birdSpotForConditions,
  kitBirdSpotFactor,
  camoSlot,
  apparelQualityFromPrice,
} from "@/lib/camo/spec";
export type { CarrySpec } from "@/lib/carry/spec";
export {
  DEFAULT_CARRY,
  combineCarrySpecs,
  scoreToQuickReleaseNerve,
  scoreToFeltFraction,
  scoreToBackpackFeltFraction,
  scoreToOpticFeltFraction,
  scoreToWeightPenaltyFactor,
} from "@/lib/carry/spec";
export type { Score10 } from "./score";
export { clampScore10, formatScore10, SCORE10_MIN, SCORE10_MAX } from "./score";
export type { MiscSpec } from "@/lib/misc/spec";
export {
  miscFeltWeightGrams,
  isHeadlampMisc,
  isCamcorderMisc,
  isChronographMisc,
  isRangeFanMisc,
  isChamberCoolerMisc,
  isFireStarterMisc,
  isSitPadMisc,
  miscKitMirageMult,
  miscKitWeaponCalmGrams,
} from "@/lib/misc/spec";
export type { LrfSpec, ScopeSpec, ScopeClickUnit, ThermalSpec } from "@/lib/optics/spec";
export { measureDistanceWithLrf } from "@/lib/optics/spec";
export type { StockSpec } from "@/lib/stock/spec";
export { applyStockMoaDelta } from "@/lib/stock/spec";
export type { RifleSpec } from "@/lib/rifle/spec";
export {
  RIFLE_AVERAGE_BEST_MOA,
  rifleAverageBestMoa,
  averageBestMoaToScore10,
  rollAmmoAffinity,
  AMMO_AFFINITY_MIN,
  AMMO_AFFINITY_MAX,
} from "@/lib/rifle/spec";
export type { BallisticsSpec } from "@/lib/ballistics/spec";
export {
  FORECAST_SOLVER_WIND_ERROR_PERCENT,
  FORECAST_SOLVER_TEMP_ERROR_C,
} from "@/lib/ballistics/spec";
export type { DayWeather, WeatherSnapshot } from "@/lib/weather/spec";
export {
  createDayWeather,
  advanceLiveWeather,
  crosswindMs,
  fullValueWindageMs,
  formatWindCompass,
  formatWindSpeed,
  FORECAST_WIND_SPEED_ERROR_PERCENT,
} from "@/lib/weather/spec";
export {
  SUPPRESSOR_CALM_WEIGHT_FACTOR,
  suppressorKitWeightGrams,
  suppressorWeaponCalmGrams,
  suppressorShotFlushChance,
  suppressorShotStayChance,
} from "@/lib/suppressor/spec";
export type { SuppressorSpec } from "@/lib/suppressor/spec";
export type { SkiSpec, SkiKitSlot } from "@/lib/ski/spec";
export { skiKitSlot, isSkiBootsSpec } from "@/lib/ski/spec";
export type { BipodSpec } from "@/lib/bipod/spec";
export { bipodWeaponCalmGrams } from "@/lib/bipod/spec";
export type { FoodSpec, FoodKind, FoodRecovery } from "@/lib/food/spec";
export {
  kitCanBoil,
  effectiveFoodStamina,
  effectiveFoodRecovery,
  formatStaminaPct,
  isCookGear,
  THERMOS_ITEM_ID,
  COFFEE_RECOVERY,
  SHORT_REST_RECOVERY,
  TYRIBAL_RECOVERY,
  SIT_PAD_ITEM_ID,
  SIT_PAD_BODY_RECOVERY_MULT,
  sitPadBodyGain,
} from "@/lib/food/spec";
export {
  computeKitTopSpeedKmh,
  formatTopSpeed,
  BASE_TOP_SPEED_KMH,
  BOOTS_ONLY_SKI,
} from "@/lib/kit/speed";
export { formatWeightKg, WEIGHT_G_BY_ID } from "./weights";
