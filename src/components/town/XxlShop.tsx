"use client";

import { useMemo, useState } from "react";
import {
  getCatalogByCategory,
  getShopItem,
  isPurchasableInShop,
} from "@/lib/shop/catalog";
import {
  SHOP_CATEGORIES,
  SHOP_CATEGORY_LABELS,
  isAmmoItem,
  isCamoItem,
  isCarryItem,
  isLrfItem,
  isThermalItem,
  isMiscItem,
  isScopeItem,
  isStockItem,
  isRifleItem,
  isBallisticsItem,
  isSkiItem,
  isBipodItem,
  isFoodItem,
  type ShopCategory,
  type ShopItem,
} from "@/lib/shop/types";
import { miscFeltWeightGrams } from "@/lib/misc/spec";
import {
  SUPPRESSOR_CALM_WEIGHT_FACTOR,
  suppressorWeaponCalmGrams,
} from "@/lib/suppressor/spec";
import {
  formatInventoryQuantity,
  type InventoryEntry,
} from "@/lib/player";
import type { ProjectileType } from "@/lib/ammo/spec";
import {
  CALIBER_SORT_ORDER,
  PROJECTILE_TYPE_SORT_ORDER,
} from "@/lib/ammo/spec";
import type { ScopeClickUnit } from "@/lib/optics/spec";
import { formatWeightKg } from "@/lib/shop/weights";
import { formatScore10 } from "@/lib/shop/score";
import { averageBestMoaToScore10 } from "@/lib/rifle/spec";
import { bipodWeaponCalmGrams } from "@/lib/bipod/spec";
import { LocationNav } from "@/components/town/LocationNav";

type XxlShopProps = {
  balance: number;
  inventory: InventoryEntry[];
  /** Unused weapon licenses — required to buy hunting rifles. */
  canBuyRifle: boolean;
  unusedLicenses: number;
  onBuy: (item: ShopItem) => void;
  onLeave: () => void;
};

type AmmoSortMode = "caliber-type" | "type-caliber";
type GlobalSort =
  | "default"
  | "price-asc"
  | "price-desc"
  | "weight-asc"
  | "weight-desc";
type ScopeSort =
  | GlobalSort
  | "maxzoom-desc"
  | "maxzoom-asc"
  | "minzoom-asc"
  | "minzoom-desc";

function formatPrice(nok: number): string {
  return `${nok.toLocaleString("nb-NO")} kr`;
}

function sortByGlobal(list: ShopItem[], mode: GlobalSort): ShopItem[] {
  if (mode === "default") return list;
  const sorted = [...list];
  sorted.sort((a, b) => {
    if (mode === "price-asc") return a.priceNok - b.priceNok;
    if (mode === "price-desc") return b.priceNok - a.priceNok;
    if (mode === "weight-asc") return a.weightGrams - b.weightGrams;
    return b.weightGrams - a.weightGrams;
  });
  return sorted;
}

export function XxlShop({
  balance,
  inventory,
  canBuyRifle,
  unusedLicenses,
  onBuy,
  onLeave,
}: XxlShopProps) {
  const [category, setCategory] = useState<ShopCategory>("ammo");
  const [message, setMessage] = useState("");
  const [globalSort, setGlobalSort] = useState<GlobalSort>("price-asc");
  const [ammoSort, setAmmoSort] = useState<AmmoSortMode>("caliber-type");
  const [caliberFilter, setCaliberFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<ProjectileType | "all">("all");
  const [scopeSort, setScopeSort] = useState<ScopeSort>("price-asc");
  const [clickUnitFilter, setClickUnitFilter] = useState<
    ScopeClickUnit | "all"
  >("all");
  const [lrfBallisticsOnly, setLrfBallisticsOnly] = useState(false);

  const items = useMemo(() => {
    let list = getCatalogByCategory(category);

    if (category === "ammo") {
      list = list.filter((item) => {
        if (!isAmmoItem(item)) return false;
        if (caliberFilter !== "all" && item.ammo.caliber !== caliberFilter) {
          return false;
        }
        if (typeFilter !== "all" && item.ammo.projectileType !== typeFilter) {
          return false;
        }
        return true;
      });
      if (ammoSort === "type-caliber") {
        list = [...list].sort((a, b) => {
          if (!isAmmoItem(a) || !isAmmoItem(b)) return 0;
          const t =
            PROJECTILE_TYPE_SORT_ORDER.indexOf(a.ammo.projectileType) -
            PROJECTILE_TYPE_SORT_ORDER.indexOf(b.ammo.projectileType);
          if (t !== 0) return t;
          return (
            CALIBER_SORT_ORDER.indexOf(a.ammo.caliber) -
            CALIBER_SORT_ORDER.indexOf(b.ammo.caliber)
          );
        });
      }
    }

    if (category === "lrf") {
      if (lrfBallisticsOnly) {
        list = list.filter(
          (item) => isLrfItem(item) && item.lrf.hasOnboardBallistics,
        );
      }
    }

    if (category === "scope") {
      if (clickUnitFilter !== "all") {
        list = list.filter(
          (item) => isScopeItem(item) && item.scope.clickUnit === clickUnitFilter,
        );
      }
      if (
        scopeSort === "maxzoom-desc" ||
        scopeSort === "maxzoom-asc" ||
        scopeSort === "minzoom-asc" ||
        scopeSort === "minzoom-desc"
      ) {
        list = [...list].sort((a, b) => {
          if (!isScopeItem(a) || !isScopeItem(b)) return 0;
          if (scopeSort === "maxzoom-desc") {
            return b.scope.maxZoom - a.scope.maxZoom;
          }
          if (scopeSort === "maxzoom-asc") {
            return a.scope.maxZoom - b.scope.maxZoom;
          }
          if (scopeSort === "minzoom-asc") {
            return a.scope.minZoom - b.scope.minZoom;
          }
          return b.scope.minZoom - a.scope.minZoom;
        });
      } else {
        list = sortByGlobal(list, scopeSort);
      }
      return list;
    }

    return sortByGlobal(list, globalSort);
  }, [
    category,
    globalSort,
    ammoSort,
    caliberFilter,
    typeFilter,
    scopeSort,
    clickUnitFilter,
    lrfBallisticsOnly,
  ]);

  function ownedQty(itemId: string): number {
    return inventory.find((e) => e.itemId === itemId)?.qty ?? 0;
  }

  function tryBuy(item: ShopItem) {
    if (!isPurchasableInShop(item)) {
      setMessage("Unobtainable — ikke til salgs i XXL.");
      return;
    }
    if (isRifleItem(item) && !canBuyRifle) {
      setMessage(
        unusedLicenses <= 0
          ? "Ingen ubrukt våpenlisens. Søk hos Lensmannen først — lisens ≠ rifle."
          : "Kan ikke kjøpe flere jaktrifler (maks 8).",
      );
      return;
    }
    if (balance < item.priceNok) {
      setMessage(`Ikke nok på kontoen til ${item.name}.`);
      return;
    }
    onBuy(item);
    setMessage(`Kjøpt: ${item.brand} ${item.name} (−${formatPrice(item.priceNok)})`);
  }

  const ownedPreview = inventory
    .map((e) => {
      const item = getShopItem(e.itemId);
      if (!item) return null;
      return `${item.brand} ${item.name}${e.qty > 1 ? ` ×${e.qty}` : ""}`;
    })
    .filter(Boolean)
    .slice(0, 6);

  const sortSelect = (
    value: GlobalSort,
    onChange: (v: GlobalSort) => void,
  ) => (
    <label className="shop-filter">
      Sorter
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as GlobalSort)}
      >
        <option value="default">Katalog</option>
        <option value="price-asc">Pris ↑ (billigst først)</option>
        <option value="price-desc">Pris ↓</option>
        <option value="weight-asc">Vekt ↑</option>
        <option value="weight-desc">Vekt ↓</option>
      </select>
    </label>
  );

  return (
    <div className="shop">
      <LocationNav
        onBackToTown={onLeave}
        hint="Sticky — alltid synlig øverst mens du scroller katalogen."
      />

      <div className="shop-header">
        <p className="intro-line intro-gift">XXL</p>
        <p className="intro-line">
          Weapons, glass, cans and brass. Prices are Norwegian street
          estimates — we&apos;ll tweak as we go.
          {category === "rifle"
            ? unusedLicenses > 0
              ? ` Ubrukte lisenser: ${unusedLicenses}.`
              : " Ingen ubrukt lisens — rifler er låst til du har søkt hos Lensmannen."
            : ""}
        </p>
      </div>

      <div className="shop-tabs" role="tablist" aria-label="Shop categories">
        {SHOP_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={category === cat}
            className={
              category === cat ? "shop-tab shop-tab-active" : "shop-tab"
            }
            onClick={() => {
              setCategory(cat);
              setMessage("");
              setGlobalSort("price-asc");
              setScopeSort("price-asc");
            }}
          >
            {SHOP_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div className="shop-ammo-controls">
        {category !== "scope" &&
          sortSelect(globalSort, setGlobalSort)}

        {category === "ammo" && (
          <>
            <label className="shop-filter">
              Kaliber
              <select
                value={caliberFilter}
                onChange={(e) => setCaliberFilter(e.target.value)}
              >
                <option value="all">Alle</option>
                {CALIBER_SORT_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="shop-filter">
              Type
              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as ProjectileType | "all")
                }
              >
                <option value="all">Alle</option>
                {PROJECTILE_TYPE_SORT_ORDER.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="shop-filter">
              Ammo-gruppering
              <select
                value={ammoSort}
                onChange={(e) => setAmmoSort(e.target.value as AmmoSortMode)}
              >
                <option value="caliber-type">Kaliber → type</option>
                <option value="type-caliber">Type → kaliber</option>
              </select>
            </label>
          </>
        )}

        {category === "scope" && (
          <>
            <label className="shop-filter">
              Klikk
              <select
                value={clickUnitFilter}
                onChange={(e) =>
                  setClickUnitFilter(e.target.value as ScopeClickUnit | "all")
                }
              >
                <option value="all">Alle</option>
                <option value="MRAD">MRAD</option>
                <option value="MOA">MOA</option>
              </select>
            </label>
            <label className="shop-filter">
              Sorter
              <select
                value={scopeSort}
                onChange={(e) => setScopeSort(e.target.value as ScopeSort)}
              >
                <option value="default">Katalog</option>
                <option value="price-asc">Pris ↑ (billigst først)</option>
                <option value="price-desc">Pris ↓</option>
                <option value="weight-asc">Vekt ↑</option>
                <option value="weight-desc">Vekt ↓</option>
                <option value="maxzoom-desc">Max zoom ↓</option>
                <option value="maxzoom-asc">Max zoom ↑</option>
                <option value="minzoom-asc">Min zoom ↑</option>
                <option value="minzoom-desc">Min zoom ↓</option>
              </select>
            </label>
          </>
        )}

        {category === "lrf" && (
          <label className="shop-filter shop-filter-check">
            <span>Kun m/intern ballistikk</span>
            <input
              type="checkbox"
              checked={lrfBallisticsOnly}
              onChange={(e) => setLrfBallisticsOnly(e.target.checked)}
            />
          </label>
        )}
      </div>

      <ul className="shop-list">
        {items.map((item) => {
          const qty = ownedQty(item.id);
          const unobtainable = !isPurchasableInShop(item);
          const soldOut = !!item.soldOut;
          const canAfford = !unobtainable && balance >= item.priceNok;
          const isUniqueGear =
            !unobtainable && item.category !== "ammo" && qty > 0;
          const needsLicense = isRifleItem(item) && !canBuyRifle;
          const ammo = isAmmoItem(item) ? item.ammo : null;
          const camo = isCamoItem(item) ? item.camo : null;
          const carry = isCarryItem(item) ? item.carry : null;
          const misc = isMiscItem(item) ? item.misc : null;
          const lrf = isLrfItem(item) ? item.lrf : null;
          const thermal = isThermalItem(item) ? item.thermal : null;
          const scope = isScopeItem(item) ? item.scope : null;
          const stock = isStockItem(item) ? item.stock : null;
          const rifle = isRifleItem(item) ? item.rifle : null;
          const ballistics = isBallisticsItem(item) ? item.ballistics : null;
          const ski = isSkiItem(item) ? item.ski : null;
          const bipod = isBipodItem(item) ? item.bipod : null;
          const food = isFoodItem(item) ? item.food : null;
          const isSuppressor = item.category === "suppressor";

          return (
            <li
              key={item.id}
              className={
                unobtainable ? "shop-row shop-row-unobtainable" : "shop-row"
              }
            >
              <div className="shop-row-main">
                <span className="shop-row-name">
                  {item.brand} {item.name}
                </span>
                <span className="shop-row-meta">
                  {unobtainable ? "—" : formatPrice(item.priceNok)}
                  {` · ${formatWeightKg(item.weightGrams)}`}
                  {ammo
                    ? ` · ${ammo.caliber} · ${ammo.projectileType}`
                    : item.caliber
                      ? ` · ${item.caliber}`
                      : ""}
                  {item.unitLabel ? ` · ${item.unitLabel}` : ""}
                  {item.fits ? ` · passer: ${item.fits}` : ""}
                  {qty > 0
                    ? isAmmoItem(item)
                      ? ` · eid: ${formatInventoryQuantity(item.id, qty)}`
                      : ` · eid: ${qty}`
                    : ""}
                </span>
                {ammo ? (
                  <span className="shop-row-ballistics">
                    v0 {ammo.v0} m/s · BC {ammo.bc} ({ammo.bcModel}) · damage{" "}
                    {ammo.damageFactor.toFixed(2)}
                  </span>
                ) : null}
                {camo ? (
                  <span className="shop-row-ballistics">
                    {camo.slot} · bird snow {camo.birdSpotSnow.toFixed(2)} ·
                    no-snow {camo.birdSpotNoSnow.toFixed(2)} · speed{" "}
                    {formatScore10(camo.terrainSpeed)} · stam{" "}
                    {formatScore10(camo.stamina)}
                  </span>
                ) : null}
                {carry ? (
                  <span className="shop-row-ballistics">
                    comfort {formatScore10(carry.carryComfort)} · QR{" "}
                    {formatScore10(carry.quickRelease)} · optics{" "}
                    {formatScore10(carry.opticsAccess)}
                  </span>
                ) : null}
                {misc ? (
                  <span className="shop-row-ballistics">
                    weight {item.weightGrams} g · endurance{" "}
                    {misc.enduranceGrams} · felt{" "}
                    {miscFeltWeightGrams(item.weightGrams, misc)} g
                    {misc.isHeadlamp ? " · hodelykt (nattgåing etter 17:00)" : ""}
                  </span>
                ) : null}
                {lrf ? (
                  <span className="shop-row-ballistics">
                    {lrf.magnification != null
                      ? `${lrf.magnification}× · `
                      : ""}
                    range ±{lrf.rangeErrorPercent}%
                    {lrf.hasOnboardBallistics
                      ? ` · Intern ballistikk: ${lrf.ballisticSystem ?? "ja"} (forecast / full-value — Kestrel 5700 Elite gir lokal fasit)`
                      : " · Kun avstand — vurder Kestrel 5700 Elite for fasit"}
                  </span>
                ) : null}
                {thermal ? (
                  <span className="shop-row-ballistics">
                    {thermal.magnification}× · pixel {thermal.pixelFactor}
                    {thermal.timeFactor != null
                      ? ` · tid ×${thermal.timeFactor}`
                      : ""}
                    {thermal.hasIntegratedLrf
                      ? ` · LRF ±${thermal.rangeErrorPercent ?? "?"}%`
                      : " · kun termisk"}
                  </span>
                ) : null}
                {scope ? (
                  <span className="shop-row-ballistics">
                    zoom {scope.minZoom}–{scope.maxZoom}× · {scope.clickUnit} ·
                    klikk ±{scope.clickErrorPercent}% · zero-ret{" "}
                    {scope.zeroRetentionInaccuracy.toFixed(2)} MOA
                  </span>
                ) : null}
                {stock ? (
                  <span className="shop-row-ballistics">
                    MOA {stock.moaDelta > 0 ? "+" : ""}
                    {stock.moaDelta.toFixed(2)} (på rifle+ammo-gulv)
                  </span>
                ) : null}
                {rifle ? (
                  <span className="shop-row-ballistics">
                    avg best {rifle.averageBestAccuracyMoa.toFixed(2)} MOA ·
                    accuracy {formatScore10(averageBestMoaToScore10(rifle.averageBestAccuracyMoa))}
                    {" "}(avhenger av ammo + din uflaks)
                  </span>
                ) : null}
                {ballistics ? (
                  <span className="shop-row-ballistics">
                    {ballistics.measuresCrosswind
                      ? "måler crosswind"
                      : "forecast / ingen lokal crosswind"}{" "}
                    · vind ±{ballistics.windErrorPercent}% · reading{" "}
                    {formatScore10(ballistics.readingAccuracy)}
                    {ballistics.solver ? ` · ${ballistics.solver}` : ""}
                  </span>
                ) : null}
                {ski ? (
                  <span className="shop-row-ballistics">
                    max {formatScore10(ski.maxSpeed)} · flyt/kg{" "}
                    {formatScore10(ski.flowPerKg)} · bredde {ski.widthMm} mm
                  </span>
                ) : null}
                {bipod ? (
                  <span className="shop-row-ballistics">
                    calm {formatScore10(bipod.weaponCalm)} · deploy{" "}
                    {formatScore10(bipod.deploySpeed)} · track{" "}
                    {formatScore10(bipod.tracking)} · bære +
                    {item.weightGrams} g · calm-mass +
                    {bipodWeaponCalmGrams(item.weightGrams, bipod)} g
                  </span>
                ) : null}
                {food ? (
                  <span className="shop-row-ballistics">
                    {food.kind === "stove"
                      ? "brenner — kreves for Real"
                      : food.kind === "fuel"
                        ? `gass · ${food.huntTrips} jaktturer`
                        : food.requiresBoil
                          ? `Body +${Math.round(food.bodyGain * 100)}% · Mind +${Math.round(food.mindGain * 100)}% · ${food.minutes} min · krever koking`
                          : `Body +${Math.round(food.bodyGain * 100)}% · Mind +${Math.round(food.mindGain * 100)}% · ${food.minutes} min`}
                  </span>
                ) : null}
                {isSuppressor ? (
                  <span className="shop-row-ballistics">
                    bære +{item.weightGrams} g · calm +
                    {suppressorWeaponCalmGrams(item.weightGrams)} g (×
                    {SUPPRESSOR_CALM_WEIGHT_FACTOR} fremme)
                  </span>
                ) : null}
                {item.note ? (
                  <span className="shop-row-note">{item.note}</span>
                ) : null}
              </div>
              <button
                type="button"
                className="intro-button shop-buy"
                disabled={
                  unobtainable || !canAfford || isUniqueGear || needsLicense
                }
                onClick={() => tryBuy(item)}
              >
                {soldOut
                  ? "For tiden utsolgt"
                  : unobtainable
                    ? "Unobtainable"
                    : isUniqueGear
                      ? "Owned"
                      : needsLicense
                        ? "Trenger lisens"
                        : canAfford
                          ? "Buy"
                          : "Too poor"}
              </button>
            </li>
          );
        })}
      </ul>

      {message ? <p className="shop-message">{message}</p> : null}

      {ownedPreview.length > 0 ? (
        <p className="shop-owned">
          Bag: {ownedPreview.join(" · ")}
          {inventory.length > 6 ? " …" : ""}
        </p>
      ) : null}

      <div className="shop-footer-nav">
        <LocationNav onBackToTown={onLeave} />
      </div>
    </div>
  );
}
