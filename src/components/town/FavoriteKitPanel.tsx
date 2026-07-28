"use client";

import { useMemo } from "react";
import { resolvePlayerItem } from "@/lib/player";
import {
  itemCarryWeightGrams,
  itemCarryWeightNote,
} from "@/lib/kit/pack";
import { formatWeightKg } from "@/lib/shop/weights";
import {
  EMPTY_CUSTOMS_MODS,
  type CustomsMods,
} from "@/lib/customs/spec";
import type { InstalledCustomBarrel } from "@/lib/customs/customBarrel";
import {
  isCamoItem,
  isFoodItem,
  isMiscItem,
  isSkiItem,
  type ShopCategory,
  type ShopItem,
} from "@/lib/shop/types";
import { camoSlot } from "@/lib/camo/spec";
import {
  isShotCamItemId,
  shotCamLabel,
  resolveShotCamKind,
} from "@/lib/hunt/shoot";
import { isBubbleLevelMisc, isSuppressorCoverMisc } from "@/lib/misc/spec";
import { ExpandableSection } from "@/components/ui/ExpandableSection";

type FavoriteKitPanelProps = {
  favoriteKitIds: string[];
  /** Current packed kit — used to show whether favorite is already active. */
  kit: string[];
  /** Inventory item ids with qty > 0 (for missing markers). */
  ownedItemIds: ReadonlySet<string>;
  onPackFavoriteKit: () => void;
  /** Remove one item from the saved favorite kit. */
  onRemoveFavoriteItem: (itemId: string) => void;
  /** Optional compact note under the button (e.g. range context). */
  hint?: string;
  /** CB fluting / stock slim for carry-weight display. */
  customsMods?: CustomsMods;
  /** Installed CB pipes — rifle weight subtracts factory barrel when present. */
  customBarrels?: Record<string, InstalledCustomBarrel>;
};

const CATEGORY_LABELS: Partial<Record<ShopCategory, string>> = {
  rifle: "Våpen",
  scope: "Kikkert",
  mount: "Montasje",
  suppressor: "Lyddemper",
  stock: "Stokk",
  bipod: "Tofot",
  ammo: "Ammo",
  lrf: "LRF",
  thermal: "Termisk",
  ballistics: "Ballistikk",
  backpack: "Sekk",
  chestrig: "Chestrig",
  skis: "Ski",
  food: "Mat",
  outdoors: "Outdoor",
  camo: "Camo",
  misc: "Misc",
  reloading: "Lading",
};

const CAMO_LABELS: Record<string, string> = {
  suit: "Ghillie",
  jacket: "Jakke",
  pants: "Bukse",
  vest: "Vest",
  down: "Dunis",
  base_layer: "Ull",
  socks: "Sokker",
  buff: "Buff",
  beanie: "Lue",
  cap: "Cap",
  gloves: "Hansker",
  boots: "Sko",
  ski_boots: "Skistøvler",
};

function itemLine(item: ShopItem | undefined, id: string): string {
  if (!item) return id;
  const base = `${item.brand} ${item.name}`;
  if (item.caliber) return `${base} · ${item.caliber}`;
  return base;
}

function slotLabel(item: ShopItem | undefined): string {
  if (!item) return "Ukjent";
  if (isShotCamItemId(item.id)) {
    const kind = resolveShotCamKind([item.id]);
    return kind ? shotCamLabel(kind) : "Triggercam";
  }
  if (isMiscItem(item) && isSuppressorCoverMisc(item.misc)) return "Wrap";
  if (isMiscItem(item) && isBubbleLevelMisc(item.misc)) return "Bubble level";
  if (isCamoItem(item)) {
    return CAMO_LABELS[camoSlot(item.camo)] ?? "Camo";
  }
  if (isSkiItem(item)) {
    return item.ski.isBoots ? "Skistøvler" : "Ski";
  }
  if (isFoodItem(item)) {
    if (item.food.kind === "thermos") return "Termos";
    if (item.food.kind === "stove") return "Brenner";
    if (item.food.kind === "fuel") return "Gass";
    return "Mat";
  }
  return CATEGORY_LABELS[item.category] ?? item.category;
}

export function FavoriteKitPanel({
  favoriteKitIds,
  kit,
  ownedItemIds,
  onPackFavoriteKit,
  onRemoveFavoriteItem,
  hint,
  customsMods = EMPTY_CUSTOMS_MODS,
  customBarrels = {},
}: FavoriteKitPanelProps) {
  const ownedFavorite = favoriteKitIds.filter((id) => ownedItemIds.has(id));
  const missing = favoriteKitIds.filter((id) => !ownedItemIds.has(id));
  const alreadyPacked =
    ownedFavorite.length > 0 &&
    ownedFavorite.length === kit.length &&
    ownedFavorite.every((id) => kit.includes(id)) &&
    kit.every((id) => ownedFavorite.includes(id));

  const favoriteItems = useMemo(
    () =>
      favoriteKitIds
        .map((id) => ({ id, item: resolvePlayerItem(id) }))
        .filter((row): row is { id: string; item: ShopItem } => row.item != null),
    [favoriteKitIds],
  );

  const ownedFavoriteItems = useMemo(
    () => favoriteItems.filter((row) => ownedItemIds.has(row.id)).map((r) => r.item),
    [favoriteItems, ownedItemIds],
  );

  const totalCarryGrams = useMemo(
    () =>
      ownedFavoriteItems.reduce(
        (sum, item) =>
          sum +
          itemCarryWeightGrams(
            item,
            customsMods,
            ownedFavoriteItems,
            customBarrels,
          ),
        0,
      ) +
      ownedFavoriteItems
        .filter((item) => item.category === "rifle")
        .reduce((sum, rifle) => sum + (customBarrels[rifle.id]?.weightGrams ?? 0), 0),
    [ownedFavoriteItems, customsMods, customBarrels],
  );

  const summary =
    favoriteKitIds.length === 0
      ? "Ingen favoritt lagret"
      : `${ownedFavorite.length} deler · ${formatWeightKg(totalCarryGrams)}` +
        (missing.length > 0 ? ` · ${missing.length} mangler` : "") +
        (alreadyPacked ? " · pakket" : "");

  return (
    <ExpandableSection title="Favoritt-kit" summary={summary}>
      {favoriteKitIds.length === 0 ? (
        <p className="shop-row-note">
          Kryss av «Favoritt» på hver vare i Inventory for å bygge favoritt-jaktkittet.
        </p>
      ) : (
        <>
          <p className="shop-row-note current-rig-inline-note">
            Lagret jakt-loadout med bærevekt. Fjern tar varen ut av favoritt
            (ikke inventory).
          </p>
          <section className="current-rig" aria-label="Favoritt-kit">
            <ul className="current-rig-list">
              {favoriteKitIds.map((id) => {
                const owned = ownedItemIds.has(id);
                const item = resolvePlayerItem(id);
                const carryG = item
                  ? itemCarryWeightGrams(
                      item,
                      customsMods,
                      ownedFavoriteItems,
                      customBarrels,
                    )
                  : 0;
                const note = item
                  ? itemCarryWeightNote(
                      item,
                      customsMods,
                      ownedFavoriteItems,
                      customBarrels,
                    )
                  : null;
                const value = !item
                  ? id
                  : !owned
                    ? `${itemLine(item, id)} — ikke i inventory`
                    : itemLine(item, id);

                return (
                  <li
                    key={id}
                    className={
                      owned ? "current-rig-slot" : "current-rig-slot is-empty"
                    }
                  >
                    <span className="current-rig-label">
                      {slotLabel(item)}
                    </span>
                    <span className="current-rig-value">
                      {value}
                      {item && owned ? (
                        <span className="current-rig-weight">
                          {" · "}
                          {formatWeightKg(carryG)}
                          {note ? (
                            <span className="current-rig-weight-note">
                              {" "}
                              ({note})
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                    <button
                      type="button"
                      className="current-rig-clear"
                      onClick={() => onRemoveFavoriteItem(id)}
                      title="Fjern fra favoritt-kit"
                    >
                      Fjern
                    </button>
                  </li>
                );
              })}
              <li className="current-rig-slot current-rig-total">
                <span className="current-rig-label">Total</span>
                <span className="current-rig-value">
                  {formatWeightKg(totalCarryGrams)}
                  {customsMods.fluting || customsMods.stockSlim
                    ? " · etter CB-tuning"
                    : ""}
                  {missing.length > 0 ? " (kun eid gear)" : ""}
                </span>
                <span className="current-rig-clear is-placeholder" aria-hidden>
                  —
                </span>
              </li>
            </ul>
          </section>
          <button
            type="button"
            className="intro-button"
            disabled={ownedFavorite.length === 0 || alreadyPacked}
            onClick={onPackFavoriteKit}
          >
            {alreadyPacked
              ? "Favorittkitt er allerede pakket"
              : "Pakk favorittkitt for jakt"}
          </button>
          {hint ? <p className="shop-row-note">{hint}</p> : null}
          {missing.length > 0 ? (
            <p className="shop-row-note">
              Manglende deler hoppes over ved pakking.
            </p>
          ) : null}
        </>
      )}
    </ExpandableSection>
  );
}
