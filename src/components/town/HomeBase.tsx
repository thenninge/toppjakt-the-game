"use client";

import { useMemo, useState } from "react";
import {
  finnSalePayoutNok,
  formatInventoryQuantity,
  resolvePlayerItem,
  type DopeCardEntry,
  type InventoryEntry,
  type ShotLogEntry,
} from "@/lib/player";
import {
  isAmmoItem,
  isCarryItem,
  isCamoItem,
  isFoodItem,
  isRifleItem,
  isSkiItem,
  isStockItem,
  type ShopCategory,
  type ShopItem,
} from "@/lib/shop/types";
import { formatWeightKg } from "@/lib/shop/weights";
import { formatScore10 } from "@/lib/shop/score";
import {
  computeKitTopSpeedKmh,
  formatTopSpeed,
} from "@/lib/kit/speed";
import { kitCanBoil } from "@/lib/food/spec";
import { camoSlot } from "@/lib/camo/spec";
import {
  EMPTY_CUSTOMS_MODS,
  customsWeightReductionGrams,
  type CustomsMods,
} from "@/lib/customs/spec";
import { LocationNav } from "@/components/town/LocationNav";
import { ExpandableSection } from "@/components/ui/ExpandableSection";
import { InaturNo } from "@/components/town/InaturNo";
import { ShotLogView } from "@/components/town/ShotLogView";
import { DopeCardView } from "@/components/town/DopeCardView";
import { getHuntingTerrain } from "@/lib/hunt/terrain";
import { huntReadyCheck } from "@/lib/hunt/readiness";

/** Categories where only one equipped item makes sense at a time. */
const EXCLUSIVE_KIT_CATEGORIES = new Set([
  "rifle",
  "scope",
  "stock",
  "suppressor",
  "backpack",
  "chestrig",
  "skis",
  "ballistics",
  "lrf",
  "thermal",
  "bipod",
]);

/** Weapon platform slots shown in Current rig (single-item slots). */
const RIG_SLOTS: { key: ShopCategory; label: string }[] = [
  { key: "rifle", label: "Rifle" },
  { key: "scope", label: "Scope" },
  { key: "stock", label: "Stock" },
  { key: "bipod", label: "Bipod" },
  { key: "suppressor", label: "Can" },
];

function itemLabel(item: ShopItem): string {
  const base = `${item.brand} ${item.name}`;
  if (item.caliber) return `${base} · ${item.caliber}`;
  if (isAmmoItem(item)) return `${base} · ${item.ammo.caliber}`;
  return base;
}

type HomeBaseProps = {
  balance: number;
  inventory: InventoryEntry[];
  kit: string[];
  shotLog: ShotLogEntry[];
  dopeCard: DopeCardEntry[];
  customsMods?: CustomsMods;
  licenseCount: number;
  rifleCount: number;
  unusedLicenses: number;
  selectedHuntingTerrainId: string | null;
  unlockedTerrainIds: string[];
  onToggleKit: (itemId: string) => void;
  /** Sell one unit (or ammo eske) on Finn at ~50% catalog price. */
  onSellOnFinn: (itemId: string) => void;
  onSelectHuntingTerrain: (terrainId: string) => void;
  onUpdateDope: (
    id: string,
    patch: Partial<
      Pick<
        DopeCardEntry,
        "distanceM" | "elevationClicks" | "windageClicks" | "ammoLabel"
      >
    >,
  ) => void;
  onRemoveDope: (id: string) => void;
  onStartHunt: () => void;
  onLeave: () => void;
};

export function HomeBase({
  balance,
  inventory,
  kit,
  shotLog,
  dopeCard,
  customsMods = EMPTY_CUSTOMS_MODS,
  licenseCount,
  rifleCount,
  unusedLicenses,
  selectedHuntingTerrainId,
  unlockedTerrainIds,
  onToggleKit,
  onSellOnFinn,
  onSelectHuntingTerrain,
  onUpdateDope,
  onRemoveDope,
  onStartHunt,
  onLeave,
}: HomeBaseProps) {
  const [view, setView] = useState<"main" | "inatur" | "shotlog" | "dope">(
    "main",
  );
  const ownedItems = useMemo(() => {
    return inventory
      .map((entry) => {
        const item = resolvePlayerItem(entry.itemId);
        return item ? { item, qty: entry.qty } : null;
      })
      .filter((x): x is { item: ShopItem; qty: number } => x != null)
      .sort(
        (a, b) =>
          a.item.category.localeCompare(b.item.category) ||
          a.item.brand.localeCompare(b.item.brand),
      );
  }, [inventory]);

  const kitItems = useMemo(() => {
    return kit
      .map((id) => resolvePlayerItem(id))
      .filter((x): x is ShopItem => x != null);
  }, [kit]);

  const totalWeightGrams = useMemo(() => {
    const raw = kitItems.reduce((sum, item) => sum + item.weightGrams, 0);
    const rifle = kitItems.find(isRifleItem);
    const stock = kitItems.find(isStockItem);
    const cut = customsWeightReductionGrams(customsMods, {
      rifleWeightGrams: rifle?.weightGrams ?? 3500,
      stockWeightGrams: stock?.weightGrams ?? null,
    });
    return Math.max(0, raw - cut);
  }, [kitItems, customsMods]);

  const carryPieces = useMemo(
    () => kitItems.filter(isCarryItem).map((i) => i.carry),
    [kitItems],
  );

  const ski = useMemo(() => {
    const found = kitItems.find(isSkiItem);
    return found ? found.ski : null;
  }, [kitItems]);

  const canBoil = useMemo(
    () => kitCanBoil(kitItems.filter(isFoodItem).map((i) => i.food)),
    [kitItems],
  );

  const hasSkis = useMemo(() => kitItems.some(isSkiItem), [kitItems]);
  const hasSkiBoots = useMemo(
    () =>
      kitItems.some(
        (i) => isCamoItem(i) && camoSlot(i.camo) === "ski_boots",
      ),
    [kitItems],
  );

  const topSpeedKmh = useMemo(
    () =>
      computeKitTopSpeedKmh({
        totalWeightGrams,
        carryPieces,
        ski,
      }),
    [totalWeightGrams, carryPieces, ski],
  );

  const inventoryValueNok = useMemo(
    () =>
      ownedItems.reduce(
        (sum, { item, qty }) => sum + Math.max(0, item.priceNok) * qty,
        0,
      ),
    [ownedItems],
  );

  const kitValueNok = useMemo(
    () =>
      kitItems.reduce((sum, item) => sum + Math.max(0, item.priceNok), 0),
    [kitItems],
  );

  const currentRig = useMemo(() => {
    return RIG_SLOTS.map((slot) => {
      const item = kitItems.find((i) => i.category === slot.key) ?? null;
      return { ...slot, item };
    });
  }, [kitItems]);

  const rigAmmo = useMemo(
    () => kitItems.filter((i) => i.category === "ammo"),
    [kitItems],
  );

  const rigGearComplete = currentRig.every((s) => s.item != null);
  const selectedTerrain = getHuntingTerrain(selectedHuntingTerrainId) ?? null;

  const rigSummary = useMemo(() => {
    const gearFilled = currentRig.filter((s) => s.item).length;
    const ammoCount = rigAmmo.length;
    return `${gearFilled}/${currentRig.length} gear · ${ammoCount} ammo`;
  }, [currentRig, rigAmmo]);

  const inventorySummary = useMemo(() => {
    if (ownedItems.length === 0) return "Tomt skap";
    const inKit = ownedItems.filter(({ item }) => kit.includes(item.id)).length;
    return `${ownedItems.length} typer · ${inKit} i kit`;
  }, [ownedItems, kit]);

  const huntReady = useMemo(
    () =>
      huntReadyCheck({
        kitItems,
        inventory,
        selectedHuntingTerrainId,
      }),
    [kitItems, inventory, selectedHuntingTerrainId],
  );

  /**
   * Rifle and scope define the zeroing combo (see zeroingKey). Swapping
   * either one means the previously dialed-in turrets no longer apply to
   * the new combo, so warn before replacing what's currently equipped.
   * Ammo is excluded: each ammo type keeps its own saved zero in parallel,
   * so switching ammo never loses anything and needs no warning.
   */
  function requestToggleKit(item: ShopItem) {
    const isZeroCombo = item.category === "rifle" || item.category === "scope";
    const alreadyEquipped = kit.includes(item.id);
    if (isZeroCombo && !alreadyEquipped) {
      const current = kitItems.find((i) => i.category === item.category);
      if (current && current.id !== item.id) {
        const ok = window.confirm(
          "Dette gjør at du må skyte inn på nytt. Sikker på at du vil bytte?",
        );
        if (!ok) return;
      }
    }
    onToggleKit(item.id);
  }

  if (view === "shotlog") {
    return (
      <ShotLogView
        entries={shotLog}
        onBack={() => setView("main")}
        backLabel="← Tilbake til hjem"
      />
    );
  }

  if (view === "dope") {
    return (
      <DopeCardView
        entries={dopeCard}
        onUpdate={onUpdateDope}
        onRemove={onRemoveDope}
        onBack={() => setView("main")}
        backLabel="← Tilbake til hjem"
      />
    );
  }

  if (view === "inatur") {
    return (
      <InaturNo
        balance={balance}
        selectedTerrainId={selectedHuntingTerrainId}
        unlockedTerrainIds={unlockedTerrainIds}
        onSelectTerrain={onSelectHuntingTerrain}
        onBack={() => setView("main")}
      />
    );
  }

  return (
    <div className="home-base">
      <LocationNav
        onBackToTown={onLeave}
        hint="Sett sammen jakt-kit. Vekt, verdi og top speed oppdateres live."
      />

      <header className="shop-header">
        <p className="intro-line intro-gift">Hjem — inventory & kit</p>
        <p className="shop-row-note">
          Våpenlisenser: {licenseCount} · Rifler: {rifleCount}
          {unusedLicenses > 0
            ? ` · ${unusedLicenses} ubrukt lisens (Pike Pro)`
            : " · ingen ubrukt lisens — søk hos Lensmannen for å kjøpe rifle"}
        </p>
        {selectedTerrain ? (
          <p className="shop-row-note">
            Jaktterreng: {selectedTerrain.name} ({selectedTerrain.region}) ·{" "}
            {selectedTerrain.pricePerDayNok.toLocaleString("nb-NO")} kr/dag
          </p>
        ) : (
          <p className="shop-row-note">
            Ingen jaktterreng valgt — book via inatur.no.
          </p>
        )}
      </header>

      <div className="home-actions">
        <button
          type="button"
          className="intro-button home-inatur-btn"
          onClick={() => setView("inatur")}
        >
          inatur.no
        </button>
        <button
          type="button"
          className="intro-button sheriff-secondary"
          onClick={() => setView("shotlog")}
        >
          Shotlog ({shotLog.length})
        </button>
        <button
          type="button"
          className="intro-button sheriff-secondary"
          onClick={() => setView("dope")}
        >
          Se/edit DOPE ({dopeCard.length})
        </button>
        <button
          type="button"
          className="intro-button home-hunt-btn"
          disabled={!huntReady.ok}
          title={
            huntReady.ok
              ? "Start jakt"
              : huntReady.blockers.join(" · ")
          }
          onClick={onStartHunt}
        >
          Dra på jakt
        </button>
      </div>
      {!huntReady.ok ? (
        <p className="shop-row-note home-hunt-blockers">
          {huntReady.blockers.join(" · ")}
        </p>
      ) : null}

      <ExpandableSection title="Current rig" summary={rigSummary}>
        <section className="current-rig" aria-label="Current rig">
          <p className="shop-row-note current-rig-inline-note">
            Dette tar du med på skytebanen og jakt. Flere ammo-typer = test i
            sekvens. Bytt under inventory for å reconfigure.
            {rigGearComplete ? "" : " — noen gear-slots er tomme."}
          </p>
          <ul className="current-rig-list">
          {currentRig.map(({ key, label, item }) => (
            <li
              key={key}
              className={
                item ? "current-rig-slot" : "current-rig-slot is-empty"
              }
            >
              <span className="current-rig-label">{label}</span>
              <span className="current-rig-value">
                {item ? itemLabel(item) : "— ikke valgt"}
              </span>
              {item ? (
                <button
                  type="button"
                  className="current-rig-clear"
                  onClick={() => onToggleKit(item.id)}
                  title={`Fjern ${label} fra kit`}
                >
                  Fjern
                </button>
              ) : (
                <span className="current-rig-clear is-placeholder" aria-hidden>
                  —
                </span>
              )}
            </li>
          ))}
          <li
            className={
              rigAmmo.length > 0
                ? "current-rig-slot current-rig-ammo"
                : "current-rig-slot current-rig-ammo is-empty"
            }
          >
            <span className="current-rig-label">Ammo</span>
            <div className="current-rig-ammo-list">
              {rigAmmo.length === 0 ? (
                <span className="current-rig-value">— ingen valgt</span>
              ) : (
                rigAmmo.map((item) => (
                  <div key={item.id} className="current-rig-ammo-row">
                    <span className="current-rig-value">
                      {itemLabel(item)}
                      {" · "}
                      {formatInventoryQuantity(
                        item.id,
                        inventory.find((e) => e.itemId === item.id)?.qty ?? 0,
                      )}
                    </span>
                    <button
                      type="button"
                      className="current-rig-clear"
                      onClick={() => onToggleKit(item.id)}
                      title="Fjern ammo fra kit"
                    >
                      Fjern
                    </button>
                  </div>
                ))
              )}
            </div>
          </li>
        </ul>
        </section>
      </ExpandableSection>

      <div className="kit-summary" aria-live="polite">
        <div className="kit-summary-item">
          <span className="kit-summary-label">Inventory verdi</span>
          <span className="kit-summary-value">
            {inventoryValueNok.toLocaleString("nb-NO")} kr
          </span>
        </div>
        <div className="kit-summary-item">
          <span className="kit-summary-label">Pakket kit verdi</span>
          <span className="kit-summary-value">
            {kitValueNok.toLocaleString("nb-NO")} kr
          </span>
        </div>
        <div className="kit-summary-item">
          <span className="kit-summary-label">Total vekt</span>
          <span className="kit-summary-value">
            {formatWeightKg(totalWeightGrams)}
          </span>
        </div>
        <div className="kit-summary-item">
          <span className="kit-summary-label">Top speed</span>
          <span className="kit-summary-value">
            {formatTopSpeed(topSpeedKmh)}
          </span>
        </div>
        <div className="kit-summary-item">
          <span className="kit-summary-label">I kit</span>
          <span className="kit-summary-value">{kitItems.length} stk</span>
        </div>
      </div>

      {ski ? (
        <p className="shop-row-note">
          Ski: max {formatScore10(ski.maxSpeed)} · flyt/kg{" "}
          {formatScore10(ski.flowPerKg)} · bredde {ski.widthMm} mm
          {ski.widthMm >= 90
            ? " — bred: bra i dyp snø med tung sekk"
            : ski.widthMm > 0 && ski.widthMm < 55
              ? " — smal: rask på hardt føre, synker i dyp snø"
              : ""}
        </p>
      ) : (
        <p className="shop-row-note">
          Ingen ski/truger i kit — beregner som støvler (lav top speed).
        </p>
      )}

      <p className="shop-row-note">
        {canBoil
          ? "Kokeklar: brenner + gass i kit — Real turmat gir stamina."
          : "Ikke kokeklar: Real turmat gir 0 stamina til du har PocketRocket + gassboks."}
      </p>

      {hasSkis && !hasSkiBoots ? (
        <p className="shop-row-note" style={{ color: "var(--danger-rust)" }}>
          Ski i kit uten skistøvler — du kommer ingen vei før du tar med
          skistøvler.
        </p>
      ) : null}

      {ownedItems.length === 0 ? (
        <p className="intro-line">Tomt skap. Pike Pro venter.</p>
      ) : (
        <ExpandableSection title="Inventory" summary={inventorySummary}>
          <ul className="shop-list home-kit-list">
          {ownedItems.map(({ item, qty }) => {
            const equipped = kit.includes(item.id);
            const finnDeal = finnSalePayoutNok(item, qty);
            return (
              <li key={item.id} className="shop-row">
                <div className="shop-row-main">
                  <span className="shop-row-name">
                    {item.brand} {item.name}
                  </span>
                  <span className="shop-row-meta">
                    {item.category} · {formatWeightKg(item.weightGrams)}
                    {formatInventoryQuantity(item.id, qty)
                      ? ` · ${formatInventoryQuantity(item.id, qty)}`
                      : qty > 1
                        ? ` · ×${qty}`
                        : ""}
                    {EXCLUSIVE_KIT_CATEGORIES.has(item.category)
                      ? " · én i kit"
                      : ""}
                    {finnDeal
                      ? ` · Finn ~${finnDeal.payout.toLocaleString("nb-NO")} kr`
                      : ""}
                  </span>
                  {isCamoItem(item) ? (
                    <span className="shop-row-ballistics">
                      {camoSlot(item.camo)} · bird snow{" "}
                      {item.camo.birdSpotSnow.toFixed(2)} · speed{" "}
                      {formatScore10(item.camo.terrainSpeed)} · stam{" "}
                      {formatScore10(item.camo.stamina)}
                    </span>
                  ) : null}
                  {isSkiItem(item) ? (
                    <span className="shop-row-ballistics">
                      max {formatScore10(item.ski.maxSpeed)} · flyt/kg{" "}
                      {formatScore10(item.ski.flowPerKg)} · {item.ski.widthMm}{" "}
                      mm
                    </span>
                  ) : null}
                  {isFoodItem(item) ? (
                    <span className="shop-row-ballistics">
                      {item.food.kind === "stove"
                        ? "brenner"
                        : item.food.kind === "fuel"
                          ? `gass · ${item.food.huntTrips} turer`
                          : item.food.requiresBoil
                            ? `Body +${Math.round(item.food.bodyGain * 100)}% · Mind +${Math.round(item.food.mindGain * 100)}% · krever koking`
                            : `Body +${Math.round(item.food.bodyGain * 100)}% · Mind +${Math.round(item.food.mindGain * 100)}% · ${item.food.minutes} min`}
                    </span>
                  ) : null}
                </div>
                <div className="home-inventory-actions">
                  <button
                    type="button"
                    className={
                      equipped
                        ? "intro-button shop-buy kit-equipped"
                        : "intro-button shop-buy"
                    }
                    onClick={() => requestToggleKit(item)}
                  >
                    {equipped ? "I kit" : "Ta med"}
                  </button>
                  <button
                    type="button"
                    className="intro-button shop-buy sheriff-secondary"
                    disabled={!finnDeal}
                    title={
                      finnDeal
                        ? isAmmoItem(item)
                          ? `Selg ${finnDeal.consumeQty} patroner for ${finnDeal.payout.toLocaleString("nb-NO")} kr (50% av eskepris)`
                          : `Selg for ${finnDeal.payout.toLocaleString("nb-NO")} kr (50% av kjøpspris)`
                        : "Kan ikke selges"
                    }
                    onClick={() => {
                      if (!finnDeal) return;
                      onSellOnFinn(item.id);
                    }}
                  >
                    Selg på Finn
                  </button>
                </div>
              </li>
            );
          })}
          </ul>
        </ExpandableSection>
      )}

      <LocationNav onBackToTown={onLeave} />
    </div>
  );
}

export function toggleKitItem(
  kit: string[],
  itemId: string,
  getCategory: (id: string) => string | undefined,
  getFoodKind?: (id: string) => string | undefined,
  getCamoSlot?: (id: string) => string | undefined,
  getMiscSlot?: (id: string) => string | undefined,
): string[] {
  if (kit.includes(itemId)) {
    return kit.filter((id) => id !== itemId);
  }
  const category = getCategory(itemId);
  if (category && EXCLUSIVE_KIT_CATEGORIES.has(category)) {
    const withoutSame = kit.filter((id) => getCategory(id) !== category);
    return [...withoutSame, itemId];
  }
  const foodKind = getFoodKind?.(itemId);
  if (foodKind === "stove" || foodKind === "fuel") {
    const without = kit.filter((id) => getFoodKind?.(id) !== foodKind);
    return [...without, itemId];
  }
  const miscSlot = getMiscSlot?.(itemId);
  if (miscSlot) {
    const without = kit.filter((id) => getMiscSlot?.(id) !== miscSlot);
    return [...without, itemId];
  }
  // One per camo/apparel slot (suit, buff, beanie, gloves, boots, ski_boots).
  const slot = getCamoSlot?.(itemId);
  if (slot) {
    const without = kit.filter((id) => getCamoSlot?.(id) !== slot);
    return [...without, itemId];
  }
  return [...kit, itemId];
}
