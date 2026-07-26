"use client";

import { useMemo, useState } from "react";
import {
  FINN_BUYER_NO_SHOW_CHANCE,
  finnSalePayoutNok,
  formatInventoryQuantity,
  resolvePlayerItem,
  type DopeCardEntry,
  type InventoryEntry,
  type ShotLogEntry,
  type ZeroingProfile,
} from "@/lib/player";
import {
  isAmmoItem,
  isCarryItem,
  isCamoItem,
  isFoodItem,
  isMiscItem,
  isMountItem,
  isSkiItem,
  isThermalItem,
  inventoryGroupForItem,
  INVENTORY_GROUPS,
  type InventoryGroupId,
  type ShopCategory,
  type ShopItem,
} from "@/lib/shop/types";
import { formatTubeDiameterMm, mountTierLabelNb, mountClearsZeroOnScopeRemove, mountClearsZeroOnMountRemove } from "@/lib/mount/spec";
import { formatWeightKg } from "@/lib/shop/weights";
import { formatScore10 } from "@/lib/shop/score";
import {
  computeKitTopSpeedKmh,
  formatTopSpeed,
} from "@/lib/kit/speed";
import { computeKitOverview } from "@/lib/kit/overview";
import { computePackLoad, itemCarryWeightGrams, itemCarryWeightNote } from "@/lib/kit/pack";
import {
  isShotCamItemId,
  isCamcorderItemId,
  isCamcorderTripodItemId,
  shotCamLabel,
  resolveShotCamKind,
} from "@/lib/hunt/shoot";
import { isWindMeterItemId } from "@/lib/ballistics/kestrelProfile";
import {
  formatMarketKr,
  formatWeightKg as formatCarcassWeightKg,
  meatQualityLabelNb,
  speciesLabelNb,
  type GameCarcass,
} from "@/lib/hunt/carcass";
import { kitCanBoil } from "@/lib/food/spec";
import { camoSlot } from "@/lib/camo/spec";
import {
  EMPTY_CUSTOMS_MODS,
  type CustomsMods,
} from "@/lib/customs/spec";
import type { InstalledCustomBarrel } from "@/lib/customs/customBarrel";
import { BARREL_MAKERS } from "@/lib/customs/customBarrel";
import { isSuppressorCoverMisc } from "@/lib/misc/spec";
import { LocationNav } from "@/components/town/LocationNav";
import { ExpandableSection } from "@/components/ui/ExpandableSection";
import { FavoriteKitPanel } from "@/components/town/FavoriteKitPanel";
import { GameConfirmDialog } from "@/components/ui/GameConfirmDialog";
import { InaturNo } from "@/components/town/InaturNo";
import { ShotLogDopeView, type ShotLogDopeTab } from "@/components/town/ShotLogDopeView";
import { LaderommetView } from "@/components/town/LaderommetView";
import type { LoadBenchRecipe } from "@/lib/reloading/recipe";
import type { ArmedLoadPlan } from "@/lib/reloading/loadPhysics";
import type { LoadDevTable } from "@/lib/reloading/loadDevTable";
import type { LoadBookEntry } from "@/lib/reloading/loadBook";
import type { HomeLoadedLot } from "@/lib/reloading/homeLoadedAmmo";
import type { KestrelGunProfile } from "@/lib/ballistics/kestrelProfile";
import {
  formatJaktkortStatusNb,
  type ActiveJaktkort,
  type JaktkortKind,
} from "@/lib/hunt/jaktkort";
import { getHuntingTerrain } from "@/lib/hunt/terrain";
import { huntReadyCheck } from "@/lib/hunt/readiness";

/** Categories where only one equipped item makes sense at a time. */
const EXCLUSIVE_KIT_CATEGORIES = new Set([
  "rifle",
  "scope",
  "mount",
  "stock",
  "suppressor",
  "backpack",
  "chestrig",
  // Wind meters (Kestrel / Clas Ohlson / …) share a slot via getMiscSlot —
  // other ballistics (e.g. GPS) are not auto-exclusive.
  "lrf",
  "thermal",
  "bipod",
]);

/** Weapon-mounted slots in Current rig (not sekk/apparel). */
type RigSlotDef =
  | { kind: "shop"; key: ShopCategory; label: string }
  | { kind: "pipe"; label: string }
  | { kind: "wrap"; label: string }
  | { kind: "shotcam"; label: string };

const WEAPON_RIG_SLOTS: RigSlotDef[] = [
  { kind: "shop", key: "rifle", label: "Våpen" },
  { kind: "pipe", label: "Pipe" },
  { kind: "shop", key: "suppressor", label: "Lyddemper" },
  { kind: "shop", key: "scope", label: "Kikkert" },
  { kind: "shop", key: "mount", label: "Montasje" },
  { kind: "wrap", label: "Wrap" },
  { kind: "shop", key: "stock", label: "Stokk" },
  { kind: "shotcam", label: "Triggercam" },
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
  rifleRoundCounts?: Record<string, number>;
  customsMods?: CustomsMods;
  customBarrels?: Record<string, InstalledCustomBarrel>;
  /** Harvested birds in the home freezer (until Meat Market). */
  freezerCarcasses?: GameCarcass[];
  licenseCount: number;
  rifleCount: number;
  unusedLicenses: number;
  selectedHuntingTerrainId: string | null;
  jaktkort: ActiveJaktkort | null;
  /** Hunter exam cleared — required to leave for a hunt. */
  jegerprovePassed?: boolean;
  unlockedTerrainIds: string[];
  /** VIP name package — Finnskogen etc. on Inatur. */
  isVip?: boolean;
  /** Admin PIN session — same VIP Inatur listings. */
  isAdmin?: boolean;
  zeroingProfiles: Record<string, ZeroingProfile>;
  /** Auto-pack mat/snacks from inventory into kit. */
  autoSupplyFood: boolean;
  /** Saved favorite hunt loadout. */
  favoriteKitIds: string[];
  loadBenchRecipe: LoadBenchRecipe;
  loadDevTable: LoadDevTable;
  loadBook: LoadBookEntry[];
  homeLoadedLots: HomeLoadedLot[];
  powderOpenGrains: Record<string, number>;
  armedLoadPlan: ArmedLoadPlan | null;
  onToggleKit: (itemId: string) => void;
  onSetAutoSupplyFood: (enabled: boolean) => void;
  /** Mark / unmark one inventory item as part of the favorite hunt kit. */
  onToggleFavoriteItem: (itemId: string, enabled: boolean) => void;
  onPackFavoriteKit: () => void;
  onChangeLoadBenchRecipe: (recipe: LoadBenchRecipe) => void;
  onChangeLoadDevTable: (table: LoadDevTable) => void;
  onChangeLoadBook: (book: LoadBookEntry[]) => void;
  onLoadHomeAmmo: (rowId: string) => { ok: boolean; error?: string };
  onDisarmLoadPlan: () => void;
  /** Sell one unit (or ammo eske) on Finn at ~50% catalog price. */
  onSellOnFinn: (itemId: string) => void;
  onPurchaseJaktkort: (terrainId: string, kind: JaktkortKind) => void;
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
  hasKestrel?: boolean;
  kestrelProfiles?: Record<string, KestrelGunProfile>;
  onUpsertKestrelProfile?: (profile: KestrelGunProfile) => void;
  onStartHunt: () => void;
  onLeave: () => void;
};

export function HomeBase({
  balance,
  inventory,
  kit,
  shotLog,
  dopeCard,
  rifleRoundCounts = {},
  customsMods = EMPTY_CUSTOMS_MODS,
  customBarrels = {},
  freezerCarcasses = [],
  licenseCount,
  rifleCount,
  unusedLicenses,
  selectedHuntingTerrainId,
  jaktkort,
  jegerprovePassed = false,
  unlockedTerrainIds,
  isVip = false,
  isAdmin = false,
  zeroingProfiles,
  autoSupplyFood,
  favoriteKitIds,
  loadBenchRecipe,
  loadDevTable,
  loadBook,
  homeLoadedLots,
  powderOpenGrains,
  armedLoadPlan,
  onToggleKit,
  onSetAutoSupplyFood,
  onToggleFavoriteItem,
  onPackFavoriteKit,
  onChangeLoadBenchRecipe,
  onChangeLoadDevTable,
  onChangeLoadBook,
  onLoadHomeAmmo,
  onDisarmLoadPlan,
  onSellOnFinn,
  onPurchaseJaktkort,
  onUpdateDope,
  onRemoveDope,
  hasKestrel = false,
  kestrelProfiles = {},
  onUpsertKestrelProfile,
  onStartHunt,
  onLeave,
}: HomeBaseProps) {
  const [view, setView] = useState<
    "main" | "inatur" | "shotlog-dope" | "laderommet"
  >("main");
  /** When opening Shotlog/Dope from a deep link, which tab. */
  const [shotlogDopeTab, setShotlogDopeTab] = useState<ShotLogDopeTab>(
    "shotlog",
  );
  /** Pending rifle/scope swap that needs re-zero warning. */
  const [kitSwapConfirm, setKitSwapConfirm] = useState<ShopItem | null>(null);
  /** Pending rifle/scope unequip — clears saved zeros. */
  const [kitRemoveConfirm, setKitRemoveConfirm] = useState<ShopItem | null>(
    null,
  );
  /** Pending Finn.no sale confirm (item + payout). */
  const [finnSaleConfirm, setFinnSaleConfirm] = useState<{
    item: ShopItem;
    payout: number;
  } | null>(null);
  /** Finn buyer no-show message after a failed sale attempt. */
  const [finnNoShow, setFinnNoShow] = useState(false);
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

  const inventoryByGroup = useMemo(() => {
    const map = new Map<
      InventoryGroupId,
      { item: ShopItem; qty: number }[]
    >();
    for (const g of INVENTORY_GROUPS) map.set(g.id, []);
    for (const row of ownedItems) {
      map.get(inventoryGroupForItem(row.item))!.push(row);
    }
    return map;
  }, [ownedItems]);

  const kitItems = useMemo(() => {
    return kit
      .map((id) => resolvePlayerItem(id))
      .filter((x): x is ShopItem => x != null);
  }, [kit]);

  const packLoad = useMemo(
    () =>
      computePackLoad({
        kitItems,
        customsMods,
        customBarrels,
        // Freezer birds stay home — pack weight is kit only until the next hunt.
        carcasses: [],
      }),
    [kitItems, customsMods, customBarrels],
  );

  const totalWeightGrams = packLoad.totalGrams;
  const kitOnlyGrams = packLoad.kitGrams;

  const carryPieces = useMemo(
    () => kitItems.filter(isCarryItem).map((i) => i.carry),
    [kitItems],
  );

  const ski = useMemo(() => {
    const found = kitItems.find((i) => isSkiItem(i) && !i.ski.isBoots);
    return found && isSkiItem(found) ? found.ski : null;
  }, [kitItems]);

  const canBoil = useMemo(
    () => kitCanBoil(kitItems.filter(isFoodItem).map((i) => i.food)),
    [kitItems],
  );

  const hasSkis = useMemo(
    () => kitItems.some((i) => isSkiItem(i) && !i.ski.isBoots),
    [kitItems],
  );
  const hasSkiBoots = useMemo(
    () =>
      kitItems.some(
        (i) => isSkiItem(i) && i.ski.isBoots,
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

  const kitOverview = useMemo(
    () =>
      computeKitOverview({
        kitItems,
        customsMods,
        carcasses: [],
        customBarrels,
      }),
    [kitItems, customsMods, customBarrels],
  );

  const freezerSummary = useMemo(() => {
    if (freezerCarcasses.length === 0) return "Tom — ingen vilt";
    const kg = freezerCarcasses.reduce((s, c) => s + c.weightKg, 0);
    const value = freezerCarcasses.reduce((s, c) => s + c.marketValueNok, 0);
    return `${freezerCarcasses.length} fugl${freezerCarcasses.length === 1 ? "" : "er"} · ${formatCarcassWeightKg(kg)} · ${formatMarketKr(value)}`;
  }, [freezerCarcasses]);

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

  const weaponRigRows = useMemo(() => {
    const rifle = kitItems.find((i) => i.category === "rifle") ?? null;
    const pipe = rifle ? customBarrels[rifle.id] ?? null : null;
    const wrap =
      kitItems.find(
        (i) => isMiscItem(i) && isSuppressorCoverMisc(i.misc),
      ) ?? null;
    const shotCam =
      kitItems.find((i) => isShotCamItemId(i.id)) ?? null;
    const shotKind = resolveShotCamKind(kit);

    return WEAPON_RIG_SLOTS.map((slot) => {
      if (slot.kind === "shop") {
        const item = kitItems.find((i) => i.category === slot.key) ?? null;
        const carryG = item
          ? itemCarryWeightGrams(item, customsMods, kitItems, customBarrels)
          : 0;
        let note = item
          ? itemCarryWeightNote(item, customsMods, kitItems, customBarrels)
          : null;
        let value = item ? itemLabel(item) : "— ikke valgt";
        if (item && isMountItem(item)) {
          value = `${itemLabel(item)} · ${formatTubeDiameterMm(item.mount.tubeDiameterMm)}`;
          const tierNote = mountTierLabelNb(item.mount.tier);
          note = note ? `${note} · ${tierNote}` : tierNote;
        }
        return {
          key: slot.key,
          label: slot.label,
          item,
          value,
          weightGrams: item ? carryG : null,
          note,
          removable: !!item,
        };
      }
      if (slot.kind === "pipe") {
        if (!rifle) {
          return {
            key: "pipe",
            label: slot.label,
            item: null,
            value: "— (trenger våpen)",
            weightGrams: null as number | null,
            note: null as string | null,
            removable: false,
          };
        }
        if (!pipe) {
          return {
            key: "pipe",
            label: slot.label,
            item: null,
            value: "Fabrikpipe",
            weightGrams: null,
            note: "inkl. i våpenvekt",
            removable: false,
          };
        }
        const maker =
          BARREL_MAKERS.find((m) => m.id === pipe.maker)?.name ?? pipe.maker;
        return {
          key: "pipe",
          label: slot.label,
          item: null,
          value: `${maker} · ${pipe.lengthIn}" · ${pipe.averageBestAccuracyMoa.toFixed(2)} MOA`,
          weightGrams: pipe.weightGrams,
          note: pipe.fluted ? "flutet · erstatter fabrikpipe" : "erstatter fabrikpipe",
          removable: false,
        };
      }
      if (slot.kind === "wrap") {
        const carryG = wrap
          ? itemCarryWeightGrams(wrap, customsMods, kitItems)
          : 0;
        return {
          key: "wrap",
          label: slot.label,
          item: wrap,
          value: wrap ? itemLabel(wrap) : "— ikke valgt",
          weightGrams: wrap ? carryG : null,
          note: null as string | null,
          removable: !!wrap,
        };
      }
      // shotcam
      const carryG = shotCam
        ? itemCarryWeightGrams(shotCam, customsMods, kitItems)
        : 0;
      return {
        key: "shotcam",
        label: slot.label,
        item: shotCam,
        value: shotCam
          ? `${shotKind ? shotCamLabel(shotKind) : "Shotcam"} · ${itemLabel(shotCam)}`
          : "— ikke valgt",
        weightGrams: shotCam ? carryG : null,
        note: null as string | null,
        removable: !!shotCam,
      };
    });
  }, [kitItems, customBarrels, customsMods, kit]);

  const weaponRigWeightGrams = useMemo(
    () =>
      weaponRigRows.reduce(
        (sum, row) => sum + (row.weightGrams ?? 0),
        0,
      ),
    [weaponRigRows],
  );

  const rigFilledCount = weaponRigRows.filter((r) => !r.value.startsWith("—"))
    .length;

  const selectedTerrain = getHuntingTerrain(selectedHuntingTerrainId) ?? null;

  const rigSummary = useMemo(() => {
    return `${rigFilledCount}/${weaponRigRows.length} på våpen · ${formatWeightKg(weaponRigWeightGrams)}`;
  }, [rigFilledCount, weaponRigRows.length, weaponRigWeightGrams]);

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
        jaktkort,
        zeroingProfiles,
        jegerprovePassed,
      }),
    [
      kitItems,
      inventory,
      selectedHuntingTerrainId,
      jaktkort,
      zeroingProfiles,
      jegerprovePassed,
    ],
  );

  /**
   * Rifle/scope/mount affect zero retention. Warn when a change will wipe
   * saved zeros (mid/budget mounts, or any rifle change).
   */
  function requestToggleKit(item: ShopItem) {
    const mountInKit = kitItems.find(isMountItem) ?? null;
    const mountTier = mountInKit?.mount.tier ?? null;
    const alreadyEquipped = kit.includes(item.id);

    if (item.category === "rifle" && alreadyEquipped) {
      setKitRemoveConfirm(item);
      return;
    }
    if (item.category === "rifle" && !alreadyEquipped) {
      const current = kitItems.find((i) => i.category === "rifle");
      if (current && current.id !== item.id) {
        setKitSwapConfirm(item);
        return;
      }
    }

    if (item.category === "scope") {
      const clears = mountClearsZeroOnScopeRemove(mountTier);
      if (alreadyEquipped && clears) {
        setKitRemoveConfirm(item);
        return;
      }
      if (!alreadyEquipped) {
        const current = kitItems.find((i) => i.category === "scope");
        if (current && current.id !== item.id && clears) {
          setKitSwapConfirm(item);
          return;
        }
      }
    }

    if (item.category === "mount") {
      if (alreadyEquipped && mountInKit && mountClearsZeroOnMountRemove(mountInKit.mount.tier)) {
        setKitRemoveConfirm(item);
        return;
      }
      if (!alreadyEquipped) {
        const current = kitItems.find(isMountItem);
        if (
          current &&
          current.id !== item.id &&
          mountClearsZeroOnMountRemove(current.mount.tier)
        ) {
          setKitSwapConfirm(item);
          return;
        }
      }
    }

    onToggleKit(item.id);
  }

  function confirmKitSwap() {
    if (!kitSwapConfirm) return;
    const id = kitSwapConfirm.id;
    setKitSwapConfirm(null);
    onToggleKit(id);
  }

  function confirmKitRemove() {
    if (!kitRemoveConfirm) return;
    const id = kitRemoveConfirm.id;
    setKitRemoveConfirm(null);
    onToggleKit(id);
  }

  function confirmFinnSale() {
    const pending = finnSaleConfirm;
    setFinnSaleConfirm(null);
    if (!pending) return;
    if (Math.random() < FINN_BUYER_NO_SHOW_CHANCE) {
      setFinnNoShow(true);
      return;
    }
    onSellOnFinn(pending.item.id);
  }

  if (view === "shotlog-dope") {
    return (
      <ShotLogDopeView
        shotLog={shotLog}
        dopeCard={dopeCard}
        rifleRoundCounts={rifleRoundCounts}
        onUpdateDope={onUpdateDope}
        onRemoveDope={onRemoveDope}
        onBack={() => setView("main")}
        initialTab={shotlogDopeTab}
        hasKestrel={hasKestrel}
        kestrelProfiles={kestrelProfiles}
        onUpsertKestrelProfile={onUpsertKestrelProfile}
      />
    );
  }

  if (view === "laderommet") {
    return (
      <LaderommetView
        inventory={inventory}
        recipe={loadBenchRecipe}
        loadDevTable={loadDevTable}
        loadBook={loadBook}
        homeLoadedLots={homeLoadedLots}
        powderOpenGrains={powderOpenGrains}
        armedLoadPlan={armedLoadPlan}
        onChangeRecipe={onChangeLoadBenchRecipe}
        onChangeLoadDevTable={onChangeLoadDevTable}
        onChangeLoadBook={onChangeLoadBook}
        onLoadHomeAmmo={onLoadHomeAmmo}
        onDisarmLoadPlan={onDisarmLoadPlan}
        onBack={() => setView("main")}
      />
    );
  }

  if (view === "inatur") {
    return (
      <InaturNo
        balance={balance}
        selectedTerrainId={selectedHuntingTerrainId}
        jaktkort={jaktkort}
        unlockedTerrainIds={unlockedTerrainIds}
        isVip={isVip}
        isAdmin={isAdmin}
        onPurchaseJaktkort={onPurchaseJaktkort}
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
            ? ` · ${unusedLicenses} ubrukt lisens (XXL)`
            : " · ingen ubrukt lisens — søk hos Lensmannen for å kjøpe rifle"}
        </p>
        {selectedTerrain && jaktkort ? (
          <p className="shop-row-note">
            Jaktkort: {selectedTerrain.name} ({selectedTerrain.region}) ·{" "}
            {formatJaktkortStatusNb(jaktkort)}
          </p>
        ) : (
          <p className="shop-row-note">
            Ingen jaktkort — kjøp via inatur.no.
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
          onClick={() => {
            setShotlogDopeTab("shotlog");
            setView("shotlog-dope");
          }}
        >
          Shotlog ({shotLog.length}/{dopeCard.length})
        </button>
        <button
          type="button"
          className="intro-button sheriff-secondary"
          onClick={() => setView("laderommet")}
        >
          Laderommet
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
            Bare det som sitter på våpenet: våpen, pipe, lyddemper, kikkert,
            montasje, wrap, stokk og triggercam. Vekt etter CB-tuning der det
            gjelder. Pipe byttes hos CB Customs.
          </p>
          <ul className="current-rig-list">
            {weaponRigRows.map((row) => (
              <li
                key={row.key}
                className={
                  row.value.startsWith("—")
                    ? "current-rig-slot is-empty"
                    : "current-rig-slot"
                }
              >
                <span className="current-rig-label">{row.label}</span>
                <span className="current-rig-value">
                  {row.value}
                  {row.weightGrams != null ? (
                    <span className="current-rig-weight">
                      {" · "}
                      {formatWeightKg(row.weightGrams)}
                      {row.note ? (
                        <span className="current-rig-weight-note">
                          {" "}
                          ({row.note})
                        </span>
                      ) : null}
                    </span>
                  ) : row.note ? (
                    <span className="current-rig-weight-note">
                      {" "}
                      ({row.note})
                    </span>
                  ) : null}
                </span>
                {row.removable && row.item ? (
                  <button
                    type="button"
                    className="current-rig-clear"
                    onClick={() => requestToggleKit(row.item!)}
                    title={`Fjern ${row.label} fra kit`}
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
            <li className="current-rig-slot current-rig-total">
              <span className="current-rig-label">Total på våpen</span>
              <span className="current-rig-value">
                {formatWeightKg(weaponRigWeightGrams)}
                {customsMods.fluting || customsMods.stockSlim
                  ? " · etter CB-tuning"
                  : ""}
              </span>
              <span className="current-rig-clear is-placeholder" aria-hidden>
                —
              </span>
            </li>
          </ul>
        </section>
      </ExpandableSection>

      <ExpandableSection title="Freezer" summary={freezerSummary}>
        <section className="home-freezer" aria-label="Freezer">
          <p className="shop-row-note current-rig-inline-note">
            Felt vilt flyttes hit når du avslutter jakt. Ligger til du selger på
            Meat Market — teller ikke i sekk-vekt på neste tur.
          </p>
          {freezerCarcasses.length === 0 ? (
            <p className="intro-line">Tom fryser. Ut og jakt.</p>
          ) : (
            <ul className="shop-list home-freezer-list">
              {freezerCarcasses.map((c) => (
                <li key={c.id} className="shop-row">
                  <div className="shop-row-main">
                    <span className="shop-row-name">
                      {speciesLabelNb(c.species)} · {formatCarcassWeightKg(c.weightKg)}
                    </span>
                    <span className="shop-row-meta">
                      {meatQualityLabelNb(c.meatRuin)} · {c.distanceM} m
                      {c.ammoLabel ? ` · ${c.ammoLabel}` : ""}
                    </span>
                  </div>
                  <span className="shop-row-price">
                    {formatMarketKr(c.marketValueNok)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </ExpandableSection>

      <ExpandableSection
        title="Active kit overview"
        summary={kitOverview.summary}
      >
        <section className="kit-overview" aria-label="Active kit overview">
          <p className="shop-row-note current-rig-inline-note">
            Live analyse av det du har i kit — hva som holder deg tilbake, og
            hva som lønner seg å oppgradere.
          </p>

          <div className="kit-overview-block">
            <h3 className="kit-overview-heading">Presisjon</h3>
            {kitOverview.precision.bestMoa != null ? (
              <p className="kit-overview-stat">
                Beste envelope:{" "}
                <strong>
                  {kitOverview.precision.bestMoa.toFixed(2)} MOA
                </strong>
                {kitOverview.precision.worstMoa != null &&
                kitOverview.precision.worstMoa !==
                  kitOverview.precision.bestMoa
                  ? ` · svakeste load ${kitOverview.precision.worstMoa.toFixed(2)} MOA`
                  : ""}
                <span className="kit-overview-stat-note">
                  {" "}
                  (rifle + ammo + stock + bedding · affinity 1.0)
                </span>
              </p>
            ) : (
              <p className="kit-overview-stat">
                {kitOverview.precision.missing.join(" · ") ||
                  "Kan ikke beregne MOA ennå."}
              </p>
            )}
            {kitOverview.precision.rows.length > 1 ? (
              <ul className="kit-overview-ammo">
                {kitOverview.precision.rows.map((row) => (
                  <li key={row.ammoId}>
                    {row.label}: {row.envelopeMoa.toFixed(2)} MOA
                  </li>
                ))}
              </ul>
            ) : null}
            <ul className="kit-overview-tips">
              {kitOverview.precision.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>

          <div className="kit-overview-block">
            <h3 className="kit-overview-heading">Speed</h3>
            <p className="kit-overview-stat">
              Top speed: <strong>{kitOverview.speed.topSpeedLabel}</strong>
              {" · "}
              {kitOverview.speed.weightKg.toFixed(1)} kg
              {" · "}
              carry comfort {formatScore10(kitOverview.speed.carryComfort)}
              {kitOverview.speed.hasSkis ? " · ski" : " · støvler"}
            </p>
            <ul className="kit-overview-tips">
              {kitOverview.speed.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>

          <div className="kit-overview-block">
            <h3 className="kit-overview-heading">Sneak</h3>
            <p className="kit-overview-stat">
              Sneak:{" "}
              <strong>
                {formatScore10(kitOverview.sneak.sneakScore)}
              </strong>
              {" · "}
              nerve −{kitOverview.sneak.sneakPct}%
              {kitOverview.sneak.speedPct !== 0
                ? ` · speed ${kitOverview.sneak.speedPct > 0 ? "+" : ""}${kitOverview.sneak.speedPct}%`
                : ""}
              {kitOverview.sneak.focusPct !== 0
                ? ` · focus +${kitOverview.sneak.focusPct}%`
                : ""}
              {kitOverview.sneak.recoveryPct !== 0
                ? ` · recovery ${kitOverview.sneak.recoveryPct > 0 ? "+" : ""}${kitOverview.sneak.recoveryPct}%`
                : ""}
            </p>
            <ul className="kit-overview-tips">
              {kitOverview.sneak.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>

          <div className="kit-overview-block">
            <h3 className="kit-overview-heading">Totalt — hva kan forbedres</h3>
            <ul className="kit-overview-tips">
              {kitOverview.overall.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
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
          {packLoad.carcassGrams > 0 ? (
            <span className="kit-summary-sub">
              kit {formatWeightKg(kitOnlyGrams)} + vilt{" "}
              {formatCarcassWeightKg(packLoad.carcassGrams / 1000)}
              {packLoad.fatigueLoadFactor > 1.02
                ? ` · +${Math.round((packLoad.fatigueLoadFactor - 1) * 100)}% fatigue`
                : ""}
            </span>
          ) : null}
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

      {kitItems.some((i) => isCamcorderItemId(i.id)) &&
      !kitItems.some((i) => isCamcorderTripodItemId(i.id)) ? (
        <p className="shop-row-note" style={{ color: "var(--danger-rust)" }}>
          Camcorder i kit uten stativ — ta med Biltema-, Manfrotto- eller
          Triggerstick-stativ før jakt.
        </p>
      ) : null}

      <FavoriteKitPanel
        favoriteKitIds={favoriteKitIds}
        kit={kit}
        ownedItemIds={
          new Set(
            inventory.filter((e) => e.qty > 0).map((e) => e.itemId),
          )
        }
        onPackFavoriteKit={onPackFavoriteKit}
        onRemoveFavoriteItem={(itemId) => onToggleFavoriteItem(itemId, false)}
        customsMods={customsMods}
        customBarrels={customBarrels}
        hint="Bytter ut hele kittet med lagret favoritt (f.eks. etter skytebane)."
      />

      {ownedItems.length === 0 ? (
        <p className="intro-line">Tomt skap. XXL venter.</p>
      ) : (
        <ExpandableSection title="Inventory" summary={inventorySummary}>
          <label className="home-auto-supply">
            <input
              type="checkbox"
              checked={autoSupplyFood}
              onChange={(e) => onSetAutoSupplyFood(e.target.checked)}
            />
            <span>
              Auto-supply mat og snacks
              <span className="home-auto-supply-hint">
                {" "}
                — pakker brød, boller, baguetter, sjokolade og turmat i kit
                automatisk
              </span>
            </span>
          </label>
          <div className="home-inventory-groups">
            {INVENTORY_GROUPS.map((group) => {
              const rows = inventoryByGroup.get(group.id) ?? [];
              if (rows.length === 0) return null;
              const qtySum = rows.reduce((n, r) => n + r.qty, 0);
              const summary =
                qtySum > rows.length
                  ? `${rows.length} typer · ${qtySum} totalt`
                  : `${rows.length} ${rows.length === 1 ? "vare" : "varer"}`;
              return (
                <ExpandableSection
                  key={group.id}
                  title={group.label}
                  summary={summary}
                  scrollOnExpand={false}
                >
                  <ul className="shop-list home-kit-list">
                    {rows.map(({ item, qty }) => {
                      const equipped = kit.includes(item.id);
                      const isFavorite = favoriteKitIds.includes(item.id);
                      const finnDeal = finnSalePayoutNok(item, qty);
                      return (
                        <li key={item.id} className="shop-row">
                          <div className="shop-row-main">
                            <span className="shop-row-name">
                              {item.brand} {item.name}
                            </span>
                            <span className="shop-row-meta">
                              {item.category} ·{" "}
                              {formatWeightKg(item.weightGrams)}
                              {formatInventoryQuantity(item.id, qty)
                                ? ` · ${formatInventoryQuantity(item.id, qty)}`
                                : qty > 1
                                  ? ` · ×${qty}`
                                  : ""}
                              {EXCLUSIVE_KIT_CATEGORIES.has(item.category)
                                ? isThermalItem(item) &&
                                  item.thermal.isThermalBinocular
                                  ? " · erstatter bino+termisk"
                                  : " · én i kit"
                                : isWindMeterItemId(item.id)
                                  ? " · én vindmåler i kit"
                                  : isShotCamItemId(item.id)
                                  ? " · én shotcam i kit"
                                  : isCamcorderItemId(item.id)
                                    ? " · én camcorder i kit"
                                    : isCamcorderTripodItemId(item.id)
                                      ? " · ett stativ i kit"
                                      : ""}
                              {finnDeal
                                ? ` · Finn ~${finnDeal.payout.toLocaleString("nb-NO")} kr`
                                : ""}
                            </span>
                            {isCamoItem(item) ? (
                              <span className="shop-row-ballistics">
                                {camoSlot(item.camo)} · sneak{" "}
                                {item.camo.sneakPct}% · speed{" "}
                                {item.camo.speedPct}% · focus{" "}
                                {item.camo.focusPct}% · recovery{" "}
                                {item.camo.recoveryPct}%
                              </span>
                            ) : null}
                            {isSkiItem(item) ? (
                              <span className="shop-row-ballistics">
                                {item.ski.isBoots
                                  ? `skistøvler · speed ${formatScore10(item.ski.maxSpeed)} · stam ${formatScore10(item.ski.flowPerKg)}`
                                  : `max ${formatScore10(item.ski.maxSpeed)} · flyt/kg ${formatScore10(item.ski.flowPerKg)} · ${item.ski.widthMm} mm`}
                              </span>
                            ) : null}
                            {isFoodItem(item) ? (
                              <span className="shop-row-ballistics">
                                {item.food.kind === "stove"
                                  ? "brenner"
                                  : item.food.kind === "fuel"
                                    ? `gass · ${item.food.huntTrips} turer`
                                    : item.food.kind === "thermos"
                                      ? "termos · 5 kaffekopper per tur"
                                      : item.food.temporaryMindFullMinutes
                                        ? `Mind → 100% i ${item.food.temporaryMindFullMinutes} min · crash`
                                        : item.food.requiresBoil
                                          ? `Body +${Math.round(item.food.bodyGain * 100)}% · Mind +${Math.round(item.food.mindGain * 100)}% · krever koking`
                                          : `Body +${Math.round(item.food.bodyGain * 100)}% · Mind +${Math.round(item.food.mindGain * 100)}% · ${item.food.minutes} min`}
                              </span>
                            ) : null}
                          </div>
                          <div className="home-inventory-actions">
                            <label
                              className="home-item-favorite"
                              title="Del av favoritt-jaktkitt"
                            >
                              <input
                                type="checkbox"
                                checked={isFavorite}
                                onChange={(e) =>
                                  onToggleFavoriteItem(
                                    item.id,
                                    e.target.checked,
                                  )
                                }
                              />
                              <span>Favoritt</span>
                            </label>
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
                                setFinnSaleConfirm({
                                  item,
                                  payout: finnDeal.payout,
                                });
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
              );
            })}
          </div>
        </ExpandableSection>
      )}

      <LocationNav onBackToTown={onLeave} />

      {kitSwapConfirm ? (
        <GameConfirmDialog
          title="Bytte utstyr"
          message={
            kitSwapConfirm.category === "scope"
              ? "Du bytter kikkert.\n\nMed mellomklasse/budsjett-montasje slettes lagret zero for den gamle kikkerten — skyte inn på nytt («Lagre zero»). Toppklasse (Spuhr/Recknagel) overfører zero ved samme rørdiameter."
              : kitSwapConfirm.category === "mount"
                ? "Du bytter montasje.\n\nMellomklasse/budsjett: lagret zero slettes — skyte inn på nytt. Toppklasse beholder zero."
                : "Du bytter rifle.\n\nAll lagret zero for den gamle rifla slettes. Du må skyte inn på nytt («Lagre zero») før du kan dra på jakt."
          }
          confirmLabel="Bytt"
          cancelLabel="Avbryt"
          onConfirm={confirmKitSwap}
          onCancel={() => setKitSwapConfirm(null)}
        />
      ) : null}

      {kitRemoveConfirm ? (
        <GameConfirmDialog
          title={
            kitRemoveConfirm.category === "scope"
              ? "Fjern kikkert"
              : kitRemoveConfirm.category === "mount"
                ? "Fjern montasje"
                : "Fjern rifle"
          }
          message={
            kitRemoveConfirm.category === "scope"
              ? "Fjerner du kikkerten med mellomklasse/budsjett-montasje, slettes lagret zero.\n\nToppklasse beholder zero ved av/på."
              : kitRemoveConfirm.category === "mount"
                ? "Fjerner du mellomklasse/budsjett-montasje, slettes lagret zero for kikkerten.\n\nToppklasse (QD) beholder zero."
                : "Fjerner du rifla fra kit, slettes all lagret zero for den rifla.\n\nDu må skyte inn på nytt («Lagre zero») før du kan dra på jakt."
          }
          confirmLabel="Fjern"
          cancelLabel="Avbryt"
          onConfirm={confirmKitRemove}
          onCancel={() => setKitRemoveConfirm(null)}
        />
      ) : null}

      {finnSaleConfirm ? (
        <GameConfirmDialog
          title="Selg på Finn"
          message={`Selge på finn til ${finnSaleConfirm.payout.toLocaleString("nb-NO")} kr?`}
          confirmLabel="Ja"
          cancelLabel="Avbryt"
          onConfirm={confirmFinnSale}
          onCancel={() => setFinnSaleConfirm(null)}
        />
      ) : null}

      {finnNoShow ? (
        <GameConfirmDialog
          title="Finn"
          message="Finn-kjøperen dukket aldri opp, du må legge den ut på nytt."
          confirmLabel="OK"
          cancelLabel="Lukk"
          onConfirm={() => setFinnNoShow(false)}
          onCancel={() => setFinnNoShow(false)}
        />
      ) : null}
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
  /** Habrok-class thermal binocular — exclusive vs other thermal + LRF. */
  getIsThermalBinocular?: (id: string) => boolean,
  /** Skis category: boards vs boots (both can be packed). */
  getSkiSlot?: (id: string) => string | undefined,
): string[] {
  if (kit.includes(itemId)) {
    return kit.filter((id) => id !== itemId);
  }
  const category = getCategory(itemId);
  const addingHabrok = !!getIsThermalBinocular?.(itemId);

  let next = kit;
  if (addingHabrok) {
    // Habrok replaces separate binos (LRF) and any other thermal.
    next = kit.filter(
      (id) => getCategory(id) !== "lrf" && getCategory(id) !== "thermal",
    );
    return [...next, itemId];
  }
  if (category === "lrf" || category === "thermal") {
    // Adding ordinary bino/thermal removes Habrok if equipped.
    next = kit.filter((id) => !getIsThermalBinocular?.(id));
  }
  if (category === "skis") {
    const skiSlot = getSkiSlot?.(itemId) ?? "boards";
    const without = next.filter((id) => getSkiSlot?.(id) !== skiSlot);
    return [...without, itemId];
  }
  // Shared kit slots (wind meter, camcorder, headlamp, …) before category exclusivity.
  const miscSlot = getMiscSlot?.(itemId);
  if (miscSlot) {
    const without = next.filter((id) => getMiscSlot?.(id) !== miscSlot);
    return [...without, itemId];
  }
  if (category && EXCLUSIVE_KIT_CATEGORIES.has(category)) {
    const withoutSame = next.filter((id) => getCategory(id) !== category);
    return [...withoutSame, itemId];
  }
  const foodKind = getFoodKind?.(itemId);
  if (foodKind === "stove" || foodKind === "fuel" || foodKind === "thermos") {
    const without = next.filter((id) => getFoodKind?.(id) !== foodKind);
    return [...without, itemId];
  }
  // One per camo/apparel slot. Ghillie (suit) exclusive vs jacket + pants.
  const slot = getCamoSlot?.(itemId);
  if (slot) {
    let without = next.filter((id) => getCamoSlot?.(id) !== slot);
    if (slot === "suit") {
      without = without.filter((id) => {
        const s = getCamoSlot?.(id);
        return s !== "jacket" && s !== "pants";
      });
    } else if (slot === "jacket" || slot === "pants") {
      without = without.filter((id) => getCamoSlot?.(id) !== "suit");
    }
    return [...without, itemId];
  }
  return [...next, itemId];
}
