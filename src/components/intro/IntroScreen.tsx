"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { generateNickname } from "@/lib/nickname";
import {
  addToInventory,
  ammoRoundsPerPurchase,
  applyAutoSupplyFood,
  canApproveNewLicense,
  canBuyHuntingRifle,
  consumeAmmoRound,
  countHuntingRifles,
  countPaidLicenses,
  createInitialStats,
  createWeaponLicense,
  ensureZeroingProfile,
  clearZeroingForRifle,
  clearZeroingForScope,
  formatPermitFee,
  grantStarterGear,
  grantUncleRifle,
  ensureNamedStarterGear,
  isAutoSupplyFoodItem,
  isCheatPlayerName,
  isVipPlayerName,
  startingBalanceForName,
  resolvePlayerItem,
  saveZeroing,
  appendShotLogEntry,
  addDopeCardEntry,
  updateDopeCardEntry,
  removeDopeCardEntry,
  unusedLicenseCount,
  consumeInventoryItem,
  getInventoryQty,
  sellInventoryOnFinn,
  resetRifleBarrel,
  clearCustomBarrel,
  installCustomBarrel,
  armLoadPlan,
  disarmLoadPlan,
  type PlayerStats,
  type ShotLogEntry,
  type DopeCardEntry,
  type ZeroingProfile,
} from "@/lib/player";
import {
  ownsKestrelDevice,
  upsertKestrelProfile as mergeKestrelProfile,
  type KestrelGunProfile,
} from "@/lib/ballistics/kestrelProfile";
import { applyMeasuredSeriesToLoadDevRow } from "@/lib/reloading/loadDevTable";
import {
  buildLoadBookEntry,
  upsertLoadBookEntry,
} from "@/lib/reloading/loadBook";
import { computeChronoSeriesStats } from "@/lib/ballistics/kestrelProfile";
import type { ShopItem } from "@/lib/shop/types";
import {
  isReloadStarterKitId,
  type StarterKitSelection,
} from "@/lib/reloading/starterKit";
import { resolveStarterKitPurchase } from "@/lib/shop/catalog";
import {
  buildInstalledCustomBarrel,
  type CustomBarrelConfig,
} from "@/lib/customs/customBarrel";
import { StatsFrame } from "@/components/hud/StatsFrame";
import { StatusBar } from "@/components/hud/StatusBar";
import { GameConfirmDialog } from "@/components/ui/GameConfirmDialog";
import { SaveConflictDialog } from "@/components/ui/SaveConflictDialog";
import {
  GameMusic,
  readMusicEnabled,
  writeMusicEnabled,
} from "@/components/hud/GameMusic";
import { musicSceneFromGame } from "@/lib/music/scenes";
import { WeatherFrame } from "@/components/hud/WeatherFrame";
import {
  advanceLiveWeather,
  createDayWeather,
  type DayWeather,
} from "@/lib/weather/spec";
import { TownHub, type TownLocationId } from "@/components/town/TownHub";
import { HowToPlayView } from "@/components/town/HowToPlayView";
import {
  SheriffOffice,
  type SheriffFinishResult,
} from "@/components/town/SheriffOffice";
import { XxlShop } from "@/components/town/XxlShop";
import { CbCustoms } from "@/components/town/CbCustoms";
import { BARREL_REPLACE_NOK } from "@/lib/rifle/barrelWear";
import { MeatMarket } from "@/components/town/MeatMarket";
import { RullesBar } from "@/components/town/RullesBar";
import { UGLE_TACO_NOK } from "@/lib/hunt/owlEasterEgg";
import { HomeBase, toggleKitItem } from "@/components/town/HomeBase";
import { ShootingRange } from "@/components/town/ShootingRange";
import { HuntMapView, type HuntHudStatus } from "@/components/hunt/HuntMapView";
import { HuntStaminaBars } from "@/components/hunt/HuntStaminaBars";
import { formatHuntClock } from "@/lib/hunt/travel";
import {
  addCarcassToStatsCounts,
  removeCarcassFromStatsCounts,
  type GameCarcass,
} from "@/lib/hunt/carcass";
import {
  CUSTOMS_SERVICES,
  HOME_LOAD_PER_ROUND_NOK,
  customsBeddingMoaDelta,
  customsCalmMultiplier,
  customsTriggerPullScale,
  type CustomsServiceId,
} from "@/lib/customs/spec";
import { isAmmoItem, isCamoItem, isFoodItem, isMiscItem, isRifleItem, isThermalItem } from "@/lib/shop/types";
import { camoSlot } from "@/lib/camo/spec";
import { isHeadlampMisc } from "@/lib/misc/spec";
import {
  getHuntingTerrain,
  type HuntingTerrainId,
} from "@/lib/hunt/terrain";
import {
  consumeJaktkortOnEndHunt,
  consumeJaktkortOnOvernight,
  createJaktkort,
  type JaktkortKind,
} from "@/lib/hunt/jaktkort";
import {
  clearPlayerSave,
  loadPlayerSave,
  savePlayerStats,
  type PlayerSaveV1,
} from "@/lib/playerSave";
import {
  fetchCloudSave,
  putCloudSave,
} from "@/lib/cloudSave";
import { clearShotPairsStorage } from "@/lib/aware/shotPairStorage";

type Phase =
  | "loading"
  | "name"
  | "welcome"
  | "town"
  | "location"
  | "sheriff-applied"
  | "hunt";

const LOADING_MS = 1000;

function displayName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

export function IntroScreen() {
  const { data: session, status: authStatus } = useSession();
  const [phase, setPhase] = useState<Phase>("loading");
  const [dots, setDots] = useState(".");
  const [name, setName] = useState("");
  const [stats, setStats] = useState<PlayerStats>(createInitialStats);
  const [location, setLocation] = useState<TownLocationId | null>(null);
  const [error, setError] = useState("");
  const [authNote, setAuthNote] = useState("");
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [weather, setWeather] = useState<DayWeather>(() => createDayWeather());
  const [lastPermit, setLastPermit] = useState<SheriffFinishResult | null>(
    null,
  );
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [hunterStatusEnabled, setHunterStatusEnabled] = useState(true);
  const [huntHud, setHuntHud] = useState<HuntHudStatus | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [kaboomNotice, setKaboomNotice] = useState(false);
  const [saveConflict, setSaveConflict] = useState<{
    local: PlayerSaveV1;
    cloud: PlayerSaveV1;
  } | null>(null);
  const statsRef = useRef(stats);
  const bootstrappedRef = useRef(false);
  /** Last hunt HUD distance — used to delta-accumulate into lifetimeDistanceM. */
  const lastHuntDistanceMRef = useRef(0);

  const showStats = phase !== "loading" && phase !== "name" && !!stats.name;
  const musicScene = musicSceneFromGame({ phase, location });
  const onHuntHudChange = useCallback((hud: HuntHudStatus) => {
    const next = Math.max(0, hud.distanceTravelledM ?? 0);
    const prev = lastHuntDistanceMRef.current;
    const delta = next > prev ? next - prev : 0;
    lastHuntDistanceMRef.current = next;
    setHuntHud(hud);
    if (delta > 0) {
      setStats((s) => ({
        ...s,
        lifetimeDistanceM: Math.max(0, s.lifetimeDistanceM) + delta,
      }));
    }
  }, []);

  function clearHuntHud() {
    lastHuntDistanceMRef.current = 0;
    setHuntHud(null);
  }
  const signedIn = authStatus === "authenticated" && !!session?.user;

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  /** Persist local + debounced cloud when signed in. */
  useEffect(() => {
    if (!stats.name) return;
    savePlayerStats(stats);
    if (authStatus !== "authenticated") return;
    const t = window.setTimeout(() => {
      void putCloudSave(stats).catch((err) => {
        console.warn("Cloud save failed", err);
      });
    }, 900);
    return () => window.clearTimeout(t);
  }, [stats, authStatus]);

  useEffect(() => {
    setMusicEnabled(readMusicEnabled());
  }, []);

  useEffect(() => {
    if (phase !== "loading") return;
    if (authStatus === "loading") return;
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const dotTimer = window.setInterval(() => {
      setDots((d) => (d.length >= 4 ? "." : `${d}.`));
    }, 380);

    let cancelled = false;

    async function bootstrap() {
      const started = Date.now();
      const local = loadPlayerSave();
      let chosen = local;

      if (authStatus === "authenticated") {
        setCloudSyncing(true);
        try {
          const cloud = await fetchCloudSave();
          if (cancelled) return;

          const localNamed = !!local?.stats.name;
          const cloudNamed = !!cloud?.stats.name;

          if (localNamed && cloudNamed && local && cloud) {
            // Both exist — ask the player; do not auto-overwrite.
            const wait = Math.max(0, LOADING_MS - (Date.now() - started));
            if (wait > 0) await new Promise((r) => window.setTimeout(r, wait));
            if (cancelled) return;
            setCloudSyncing(false);
            setSaveConflict({ local, cloud });
            setAuthNote("Innlogget — velg lokal eller sky-save.");
            setPhase("name");
            return;
          }

          if (cloudNamed && cloud) {
            chosen = cloud;
            savePlayerStats(cloud.stats);
            setAuthNote("Innlogget — save hentet fra sky.");
          } else if (localNamed && local) {
            chosen = local;
            await putCloudSave(local.stats, local.savedAtMs);
            setAuthNote("Innlogget — lokal save lastet opp til sky.");
          } else {
            setAuthNote("Innlogget — opprett jeger.");
          }
        } catch (err) {
          console.warn(err);
          setAuthNote(
            "Innlogget, men sky-save feilet — bruker lokal lagring.",
          );
        } finally {
          if (!cancelled) setCloudSyncing(false);
        }
      }

      const wait = Math.max(0, LOADING_MS - (Date.now() - started));
      if (wait > 0) await new Promise((r) => window.setTimeout(r, wait));
      if (cancelled) return;

      if (chosen?.stats.name) {
        const next = ensureNamedStarterGear(chosen.stats);
        setStats(next);
        setName(next.name);
        setPhase("town");
        return;
      }

      const googleName = session?.user?.name?.trim() ?? "";
      if (googleName) setName(displayName(googleName));
      setPhase("name");
    }

    void bootstrap();

    return () => {
      cancelled = true;
      window.clearInterval(dotTimer);
    };
  }, [phase, authStatus, session?.user?.name]);

  function toggleMusic() {
    setMusicEnabled((prev) => {
      const next = !prev;
      writeMusicEnabled(next);
      return next;
    });
  }

  function toggleHunterStatus() {
    setHunterStatusEnabled((prev) => !prev);
  }

  /** Wipe local save — log out and create a new hunter. */
  function requestDeleteUser() {
    setDeleteConfirmOpen(true);
  }

  function confirmDeleteUserAndRestart() {
    setDeleteConfirmOpen(false);
    clearPlayerSave();
    clearShotPairsStorage();
    setStats(createInitialStats());
    setName("");
    setError("");
    setAuthNote("");
    setLocation(null);
    setLastPermit(null);
    clearHuntHud();
    setWeather(createDayWeather());
    setPhase("name");
    if (signedIn) void signOut({ redirect: false });
  }

  function loginWithGoogle() {
    setError("");
    void signIn("google", { callbackUrl: "/" });
  }

  async function logoutGoogle() {
    setAuthNote("");
    setSaveConflict(null);
    await signOut({ redirect: false });
  }

  function enterWithSave(save: PlayerSaveV1, note: string) {
    const next = ensureNamedStarterGear(save.stats);
    savePlayerStats(next);
    setStats(next);
    setName(next.name);
    setAuthNote(note);
    setSaveConflict(null);
    setPhase("town");
  }

  function chooseCloudSave() {
    if (!saveConflict) return;
    enterWithSave(saveConflict.cloud, "Lastet inn inventory fra sky.");
  }

  async function chooseLocalOverwriteCloud() {
    if (!saveConflict) return;
    const local = saveConflict.local;
    try {
      setCloudSyncing(true);
      await putCloudSave(local.stats, local.savedAtMs);
      enterWithSave(local, "Lokal inventory lastet opp — sky overskrevet.");
    } catch (err) {
      console.warn(err);
      setError(
        err instanceof Error
          ? err.message
          : "Kunne ikke overskrive sky — prøv igjen.",
      );
    } finally {
      setCloudSyncing(false);
    }
  }

  async function cancelConflictLogin() {
    const local = saveConflict?.local ?? loadPlayerSave();
    setSaveConflict(null);
    setAuthNote("");
    await signOut({ redirect: false });
    if (local?.stats.name) {
      enterWithSave(local, "Innlogging avbrutt — fortsetter med lokal save.");
    } else {
      setAuthNote("Innlogging avbrutt.");
      setPhase("name");
    }
  }

  /** Rename hunter in place — returns error string or null on success. */
  function renameHunter(raw: string): string | null {
    const trimmed = raw.trim();
    if (trimmed.length < 2) return "Navn må være minst 2 tegn.";
    if (trimmed.length > 24) return "Maks 24 tegn.";
    const nice = displayName(trimmed);
    setName(nice);
    setStats((prev) => ({
      ...prev,
      name: nice,
      nickname: generateNickname(trimmed),
    }));
    return null;
  }

  // Weather HUD only during mission — not town / shop / sheriff / home.
  const showWeather = false;

  useEffect(() => {
    if (!showWeather) return;
    const id = window.setInterval(() => {
      setWeather((w) => advanceLiveWeather(w, 2));
    }, 8000);
    return () => window.clearInterval(id);
  }, [showWeather]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 24) {
      setError("Keep it under 24 characters, partner.");
      return;
    }
    const nice = displayName(trimmed);
    setError("");
    setStats((prev) => ({
      ...prev,
      name: nice,
      nickname: generateNickname(trimmed),
      balance: startingBalanceForName(nice),
    }));
    setPhase("welcome");
  }

  function enterLocation(id: TownLocationId) {
    setLocation(id);
    setPhase("location");
  }

  function backToTown() {
    setLocation(null);
    setPhase("town");
  }

  function applyForPermit(result: SheriffFinishResult) {
    if (stats.balance < result.fee) return;
    setLastPermit(result);
    setStats((prev) => {
      let next: PlayerStats = {
        ...prev,
        balance: prev.balance - result.fee,
      };
      if (result.approved && canApproveNewLicense(prev)) {
        const license = createWeaponLicense(result.application);
        next = {
          ...next,
          weaponLicenses: [...next.weaponLicenses, license],
        };
      }
      return next;
    });
    setPhase("sheriff-applied");
  }

  function buyShopItem(
    item: ShopItem,
    qty = 1,
    opts?: { starterKit?: StarterKitSelection },
  ) {
    const n = Math.max(1, Math.min(99, Math.floor(qty)));
    setStats((prev) => {
      if (isReloadStarterKitId(item.id)) {
        const purchase = resolveStarterKitPurchase(opts?.starterKit);
        if (prev.balance < purchase.dealPriceNok) return prev;
        let inventory = prev.inventory;
        for (const partId of purchase.contentIds) {
          inventory = addToInventory(inventory, partId, 1);
        }
        return {
          ...prev,
          balance: prev.balance - purchase.dealPriceNok,
          inventory,
        };
      }
      if (item.bundleItemIds && item.bundleItemIds.length > 0) {
        if (prev.balance < item.priceNok) return prev;
        let inventory = prev.inventory;
        for (const partId of item.bundleItemIds) {
          inventory = addToInventory(inventory, partId, 1);
        }
        return {
          ...prev,
          balance: prev.balance - item.priceNok,
          inventory,
        };
      }
      const unitQty = isAmmoItem(item) ? ammoRoundsPerPurchase(item) : 1;
      const cost = item.priceNok * n;
      if (prev.balance < cost) return prev;
      if (isRifleItem(item) && !canBuyHuntingRifle(prev)) return prev;
      let next: PlayerStats = {
        ...prev,
        balance: prev.balance - cost,
        inventory: addToInventory(prev.inventory, item.id, unitQty * n),
      };
      if (isAutoSupplyFoodItem(item)) {
        next = applyAutoSupplyFood(next);
      }
      return next;
    });
  }

  function sellOnFinn(itemId: string) {
    setStats((prev) => {
      const result = sellInventoryOnFinn(prev, itemId);
      return result ? result.stats : prev;
    });
  }

  function harvestBird(carcass: GameCarcass) {
    setStats((prev) => {
      const counts = addCarcassToStatsCounts(
        prev.tiur,
        prev.orrhaner,
        carcass.species,
      );
      return {
        ...prev,
        ...counts,
        lifetimeTiur:
          carcass.species === "tiur"
            ? prev.lifetimeTiur + 1
            : prev.lifetimeTiur,
        lifetimeOrrhaner:
          carcass.species === "orrhane"
            ? prev.lifetimeOrrhaner + 1
            : prev.lifetimeOrrhaner,
        lifetimeUgle:
          carcass.species === "ugle"
            ? prev.lifetimeUgle + 1
            : prev.lifetimeUgle,
        carcasses: [...prev.carcasses, carcass],
        maxRange: Math.max(prev.maxRange, carcass.distanceM),
      };
    });
  }

  function consumeHuntCarcasses(carcassIds: string[]) {
    if (carcassIds.length === 0) return;
    const idSet = new Set(carcassIds);
    setStats((prev) => {
      const eaten = prev.carcasses.filter((c) => idSet.has(c.id));
      let tiur = prev.tiur;
      let orrhaner = prev.orrhaner;
      for (const c of eaten) {
        const counts = removeCarcassFromStatsCounts(tiur, orrhaner, c.species);
        tiur = counts.tiur;
        orrhaner = counts.orrhaner;
      }
      return {
        ...prev,
        tiur,
        orrhaner,
        carcasses: prev.carcasses.filter((c) => !idSet.has(c.id)),
      };
    });
  }

  /** Mid-hunt: pack → car (same freezer stash as end-of-hunt). */
  function depositCarcassesAtCar() {
    setStats((prev) => {
      if (prev.carcasses.length === 0) return prev;
      return {
        ...prev,
        freezerCarcasses: [...prev.freezerCarcasses, ...prev.carcasses],
        carcasses: [],
      };
    });
  }

  function sellCarcasses(carcassIds: string[]) {
    const idSet = new Set(carcassIds);
    setStats((prev) => {
      const selling = [...prev.freezerCarcasses, ...prev.carcasses].filter(
        (c) => idSet.has(c.id) && c.species !== "ugle",
      );
      if (selling.length === 0) return prev;
      let tiur = prev.tiur;
      let orrhaner = prev.orrhaner;
      let payout = 0;
      for (const c of selling) {
        payout += c.marketValueNok;
        const next = removeCarcassFromStatsCounts(tiur, orrhaner, c.species);
        tiur = next.tiur;
        orrhaner = next.orrhaner;
      }
      const soldIds = new Set(selling.map((c) => c.id));
      return {
        ...prev,
        balance: prev.balance + payout,
        tiur,
        orrhaner,
        freezerCarcasses: prev.freezerCarcasses.filter((c) => !soldIds.has(c.id)),
        carcasses: prev.carcasses.filter((c) => !soldIds.has(c.id)),
      };
    });
  }

  /** Rulle's off-menu Ugletaco — not advertised at Meat Market. */
  function sellUgleToRulle(carcassId: string): boolean {
    const prev = statsRef.current;
    const all = [...prev.freezerCarcasses, ...prev.carcasses];
    const ugle = all.find((c) => c.id === carcassId && c.species === "ugle");
    if (!ugle) return false;
    const next = {
      ...prev,
      balance: prev.balance + UGLE_TACO_NOK,
      freezerCarcasses: prev.freezerCarcasses.filter((c) => c.id !== carcassId),
      carcasses: prev.carcasses.filter((c) => c.id !== carcassId),
    };
    statsRef.current = next;
    setStats(next);
    return true;
  }

  function spendAtRulles(amountNok: number): boolean {
    if (amountNok <= 0) return true;
    const prev = statsRef.current;
    if (prev.balance < amountNok) return false;
    const next = { ...prev, balance: prev.balance - amountNok };
    statsRef.current = next;
    setStats(next);
    return true;
  }

  function unlockRullesTerrain(terrainId: HuntingTerrainId) {
    setStats((prev) => {
      if (prev.unlockedTerrainIds.includes(terrainId)) return prev;
      return {
        ...prev,
        unlockedTerrainIds: [...prev.unlockedTerrainIds, terrainId],
      };
    });
  }

  function buyCustomsService(id: CustomsServiceId) {
    const svc = CUSTOMS_SERVICES.find((s) => s.id === id);
    if (!svc || svc.comingSoon) return;
    setStats((prev) => {
      if (prev.balance < svc.priceNok) return prev;
      const mods = { ...prev.customsMods };
      if (id === "bedding") {
        if (mods.bedding || mods.pillarBedding) return prev;
        mods.bedding = true;
      } else if (id === "pillar_bedding") {
        if (mods.pillarBedding) return prev;
        mods.pillarBedding = true;
        mods.bedding = true; // superseded, but mark as done
      } else if (id === "fluting") {
        if (mods.fluting) return prev;
        mods.fluting = true;
      } else if (id === "stock_slim") {
        if (mods.stockSlim) return prev;
        mods.stockSlim = true;
      } else if (id === "trigger_tuning") {
        if (mods.triggerTuning) return prev;
        mods.triggerTuning = true;
      } else if (id === "home_loads_setup") {
        if (mods.homeLoadsSetup) return prev;
        mods.homeLoadsSetup = true;
      } else if (id === "custom_camo") {
        if (mods.customCamo) return prev;
        mods.customCamo = true;
      } else if (id === "bagrider") {
        if (mods.bagrider) return prev;
        mods.bagrider = true;
      } else if (id === "action_trueing") {
        if (mods.actionTrueing) return prev;
        mods.actionTrueing = true;
      } else if (id === "cheek_riser") {
        if (mods.cheekRiser) return prev;
        mods.cheekRiser = true;
      } else if (id === "barrel_crown") {
        if (mods.barrelCrown) return prev;
        mods.barrelCrown = true;
      } else {
        return prev;
      }
      return {
        ...prev,
        balance: prev.balance - svc.priceNok,
        customsMods: mods,
      };
    });
  }

  function orderCustomsHomeLoads(ammoId: string, rounds: number) {
    const qty = Math.max(1, Math.floor(rounds));
    const cost = qty * HOME_LOAD_PER_ROUND_NOK;
    setStats((prev) => {
      if (!prev.customsMods.homeLoadsSetup) return prev;
      if (prev.balance < cost) return prev;
      const item = resolvePlayerItem(ammoId);
      if (!item || !isAmmoItem(item)) return prev;
      return {
        ...prev,
        balance: prev.balance - cost,
        inventory: addToInventory(prev.inventory, ammoId, qty),
      };
    });
  }

  function replaceCustomsBarrel(rifleId: string) {
    setStats((prev) => {
      if (prev.balance < BARREL_REPLACE_NOK) return prev;
      const item = resolvePlayerItem(rifleId);
      if (!item || item.category !== "rifle") return prev;
      const rounds = prev.rifleRoundCounts[rifleId] ?? 0;
      const hasCustom = prev.customBarrels[rifleId] != null;
      if (rounds <= 0 && !hasCustom) return prev;
      return resetRifleBarrel(
        clearCustomBarrel(
          { ...prev, balance: prev.balance - BARREL_REPLACE_NOK },
          rifleId,
        ),
        rifleId,
      );
    });
  }

  function installCustomsCustomBarrel(
    rifleId: string,
    config: CustomBarrelConfig,
    priceNok: number,
  ) {
    setStats((prev) => {
      const item = resolvePlayerItem(rifleId);
      if (!item || item.category !== "rifle") return prev;
      if (prev.balance < priceNok) return prev;
      const barrel = buildInstalledCustomBarrel(config, rifleId, priceNok);
      return installCustomBarrel(prev, rifleId, barrel, priceNok);
    });
  }

  const spendAmmoRound = useCallback(
    (ammoId: string, rifleId?: string): boolean => {
      const result = consumeAmmoRound(statsRef.current, ammoId, { rifleId });
      if (!result.ok) return false;
      setStats(result.stats);
      if (result.kaboom) {
        setKaboomNotice(true);
        return false;
      }
      return true;
    },
    [],
  );

  const ensureComboZero = useCallback(
    (
      rifleId: string,
      scopeId: string,
      ammoId: string,
    ): ZeroingProfile => {
      const ensured = ensureZeroingProfile(
        statsRef.current.zeroingProfiles,
        rifleId,
        scopeId,
        ammoId,
      );
      if (ensured.rolled) {
        setStats((prev) => ({
          ...prev,
          zeroingProfiles: ensured.map,
        }));
      }
      return ensured.profile;
    },
    [],
  );

  const saveComboZero = useCallback(
    (key: string, sessionXMm: number, sessionYMm: number) => {
      setStats((prev) => ({
        ...prev,
        zeroingProfiles: saveZeroing(
          prev.zeroingProfiles,
          key,
          sessionXMm,
          sessionYMm,
        ),
      }));
    },
    [],
  );

  const addDopeEntry = useCallback(
    (entry: Omit<DopeCardEntry, "id" | "atMs">) => {
      setStats((prev) => ({
        ...prev,
        dopeCard: addDopeCardEntry(prev.dopeCard, entry),
      }));
    },
    [],
  );

  const updateDopeEntry = useCallback(
    (
      id: string,
      patch: Partial<
        Pick<
          DopeCardEntry,
          "distanceM" | "elevationClicks" | "windageClicks" | "ammoLabel"
        >
      >,
    ) => {
      setStats((prev) => ({
        ...prev,
        dopeCard: updateDopeCardEntry(prev.dopeCard, id, patch),
      }));
    },
    [],
  );

  const removeDopeEntry = useCallback((id: string) => {
    setStats((prev) => ({
      ...prev,
      dopeCard: removeDopeCardEntry(prev.dopeCard, id),
    }));
  }, []);

  const upsertKestrelProfile = useCallback((profile: KestrelGunProfile) => {
    setStats((prev) => ({
      ...prev,
      kestrelProfiles: mergeKestrelProfile(prev.kestrelProfiles, profile),
    }));
  }, []);

  const logRangeSeries = useCallback((entry: ShotLogEntry) => {
    setStats((prev) => {
      let next: PlayerStats = {
        ...prev,
        shotLog: appendShotLogEntry(prev.shotLog, entry),
      };
      const rowId = prev.armedLoadPlan?.loadDevRowId;
      if (rowId) {
        const chronoStats = entry.chronoV0Mps?.length
          ? computeChronoSeriesStats(entry.chronoV0Mps)
          : null;
        const table = applyMeasuredSeriesToLoadDevRow(
          next.loadDevTable,
          rowId,
          {
            meanV0Mps: chronoStats?.meanMps ?? null,
            highV0Mps: chronoStats?.highMps ?? null,
            lowV0Mps: chronoStats?.lowMps ?? null,
            stdevV0Mps: chronoStats?.stdevMps ?? null,
            groupMoa: entry.groupMoa,
            extremeSpreadMm: entry.extremeSpreadMm,
            seriesId: entry.id,
          },
        );
        const row = table.rows.find((r) => r.id === rowId);
        next = { ...next, loadDevTable: table };
        if (row) {
          next = {
            ...next,
            loadBook: upsertLoadBookEntry(
              next.loadBook,
              buildLoadBookEntry({
                caliberKey:
                  prev.armedLoadPlan?.caliberKey ??
                  prev.loadBenchRecipe.caliberKey,
                row,
                brassItemId: prev.loadBenchRecipe.brassItemId,
              }),
            ),
          };
        }
      }
      return next;
    });
  }, []);

  function toggleKit(itemId: string) {
    setStats((prev) => {
      const before = prev.kit;
      const after = toggleKitItem(
        prev.kit,
        itemId,
        (id) => resolvePlayerItem(id)?.category,
        (id) => {
          const item = resolvePlayerItem(id);
          return item && isFoodItem(item) ? item.food.kind : undefined;
        },
        (id) => {
          const item = resolvePlayerItem(id);
          return item && isCamoItem(item) ? camoSlot(item.camo) : undefined;
        },
        (id) => {
          const item = resolvePlayerItem(id);
          return item && isMiscItem(item) && isHeadlampMisc(item.misc)
            ? "headlamp"
            : undefined;
        },
        (id) => {
          const item = resolvePlayerItem(id);
          return !!(
            item &&
            isThermalItem(item) &&
            item.thermal.isThermalBinocular
          );
        },
      );
      const removed = before.filter((id) => !after.includes(id));
      let profiles = prev.zeroingProfiles;
      for (const id of removed) {
        const rem = resolvePlayerItem(id);
        if (rem?.category === "scope") {
          profiles = clearZeroingForScope(profiles, id);
        } else if (rem?.category === "rifle") {
          profiles = clearZeroingForRifle(profiles, id);
        }
      }
      return {
        ...prev,
        kit: after,
        zeroingProfiles: profiles,
      };
    });
  }

  function selectHuntingTerrain(terrainId: string, kind: JaktkortKind) {
    setStats((prev) => {
      const terrain = getHuntingTerrain(terrainId);
      if (!terrain) return prev;
      const kort = createJaktkort(terrainId, kind, terrain.pricePerDayNok);
      if (prev.balance < kort.paidNok) return prev;
      const sameActive =
        prev.jaktkort &&
        prev.jaktkort.terrainId === terrainId &&
        prev.jaktkort.kind === kind &&
        prev.jaktkort.daysRemaining > 0;
      if (sameActive) return prev;
      return {
        ...prev,
        balance: prev.balance - kort.paidNok,
        selectedHuntingTerrainId: terrainId,
        jaktkort: kort,
      };
    });
  }

  function startHunt() {
    if (!stats.selectedHuntingTerrainId || !stats.jaktkort) return;
    if (stats.jaktkort.daysRemaining <= 0) return;
    setStats((prev) => applyAutoSupplyFood(prev));
    setLocation(null);
    clearHuntHud();
    setPhase("hunt");
  }

  function endHunt(opts?: { skipJaktkortConsume?: boolean }) {
    if (!opts?.skipJaktkortConsume) {
      setStats((prev) => {
        const next = consumeJaktkortOnEndHunt(prev.jaktkort);
        return {
          ...prev,
          jaktkort: next,
          selectedHuntingTerrainId: next?.terrainId ?? null,
          // Pack → freezer when leaving the field.
          freezerCarcasses: [...prev.freezerCarcasses, ...prev.carcasses],
          carcasses: [],
        };
      });
    } else {
      setStats((prev) => ({
        ...prev,
        selectedHuntingTerrainId: prev.jaktkort?.terrainId ?? null,
        freezerCarcasses: [...prev.freezerCarcasses, ...prev.carcasses],
        carcasses: [],
      }));
    }
    clearHuntHud();
    setLocation("home");
    setPhase("location");
  }

  /** Overnatting ute bruker én jaktdag. Returnerer om jakten kan fortsette. */
  function consumeJaktkortOvernight(): boolean {
    const prev = statsRef.current;
    const next = consumeJaktkortOnOvernight(prev.jaktkort);
    const updated = {
      ...prev,
      jaktkort: next,
      selectedHuntingTerrainId: next?.terrainId ?? null,
    };
    statsRef.current = updated;
    setStats(updated);
    return next != null && next.daysRemaining > 0;
  }

  function consumeHuntFood(itemId: string): boolean {
    const prev = statsRef.current;
    const result = consumeInventoryItem(prev.inventory, itemId, 1);
    if (!result.ok) return false;
    let kit = prev.kit;
    if (getInventoryQty(result.inventory, itemId) === 0) {
      kit = kit.filter((id) => id !== itemId);
    }
    const next = applyAutoSupplyFood({
      ...prev,
      inventory: result.inventory,
      kit,
    });
    statsRef.current = next;
    setStats(next);
    return true;
  }

  function setAutoSupplyFood(enabled: boolean) {
    setStats((prev) =>
      applyAutoSupplyFood({ ...prev, autoSupplyFood: enabled }),
    );
  }

  function headIntoTown() {
    setStats((prev) => {
      const balance = startingBalanceForName(prev.name);
      const withBalance = { ...prev, balance };
      if (isCheatPlayerName(prev.name) || isVipPlayerName(prev.name)) {
        return ensureNamedStarterGear(withBalance);
      }
      return grantUncleRifle(withBalance);
    });
    setPhase("town");
  }

  return (
    <div className={showStats ? "intro-root intro-root-play" : "intro-root"}>
      <div className="intro-sky" aria-hidden />
      <div className="intro-scanlines" aria-hidden />

      {showStats ? (
        <div className="hud-stack">
          <StatusBar
            musicEnabled={musicEnabled}
            onMusicToggle={toggleMusic}
            hunterStatusEnabled={hunterStatusEnabled}
            onHunterStatusToggle={toggleHunterStatus}
          />
          {hunterStatusEnabled ? (
            <StatsFrame
              stats={stats}
              onRename={renameHunter}
              onDeleteUser={requestDeleteUser}
              authEmail={signedIn ? session?.user?.email ?? "Google" : null}
              onGoogleLogin={signedIn ? undefined : loginWithGoogle}
              onGoogleLogout={signedIn ? () => void logoutGoogle() : undefined}
            />
          ) : null}
        </div>
      ) : null}

      <GameMusic scene={musicScene} enabled={musicEnabled && showStats} />

      {showWeather ? <WeatherFrame weather={weather} /> : null}

      <main className="intro-panel">
        <header
          className={
            phase === "hunt" ? "intro-header intro-header-hunt" : "intro-header"
          }
        >
          {phase === "hunt" && huntHud ? (
            <div className="intro-header-clock-stack">
              <p
                className={
                  huntHud.isDark
                    ? "intro-header-clock hunt-clock is-dark"
                    : "intro-header-clock hunt-clock"
                }
              >
                Kl {formatHuntClock(huntHud.clockMinutes)}
              </p>
              <p className="intro-header-distance">
                Distance travelled:{" "}
                {(huntHud.distanceTravelledM ?? 0) >= 1000
                  ? `${((huntHud.distanceTravelledM ?? 0) / 1000).toFixed(
                      (huntHud.distanceTravelledM ?? 0) % 1000 === 0 ? 0 : 1,
                    )} km`
                  : `${huntHud.distanceTravelledM ?? 0} m`}
              </p>
            </div>
          ) : phase === "hunt" ? (
            <span className="intro-header-side" aria-hidden />
          ) : null}
          <div className="intro-header-brand">
            <h1 className="intro-title">Cold Bore Toppjakt</h1>
            <p className="intro-subtitle">The Game!</p>
          </div>
          {phase === "hunt" && huntHud ? (
            <HuntStaminaBars
              physical={huntHud.physicalStamina}
              mental={huntHud.mentalStamina}
              thermalBattery={huntHud.thermalBattery}
              birdNerve={huntHud.birdNerve}
            />
          ) : phase === "hunt" ? (
            <span className="intro-header-side" aria-hidden />
          ) : null}
        </header>

        {phase === "loading" && (
          <p className="intro-prompt intro-loading" role="status">
            Loading {dots} Cold Bore Toppjakt - The Game!
            {cloudSyncing ? " · synker sky…" : ""}
          </p>
        )}

        {phase === "name" && (
          <form className="intro-form" onSubmit={onSubmit}>
            <div className="intro-auth-block">
              {signedIn ? (
                <>
                  <p className="shop-row-note">
                    Innlogget som {session?.user?.email ?? "Google"}
                    {authNote ? ` — ${authNote}` : ""}
                  </p>
                  <button
                    type="button"
                    className="intro-button sheriff-secondary"
                    onClick={() => void logoutGoogle()}
                  >
                    Logg ut
                  </button>
                </>
              ) : (
                <>
                  <p className="intro-prompt">
                    Logg inn for å lagre på tvers av enheter (samme konto som
                    CBAware):
                  </p>
                  <button
                    type="button"
                    className="intro-button"
                    onClick={loginWithGoogle}
                  >
                    Logg inn med Google
                  </button>
                  <p className="shop-row-note">
                    Eller spill uten konto (kun denne nettleseren):
                  </p>
                </>
              )}
            </div>

            <label className="intro-prompt" htmlFor="player-name">
              Please enter name:
            </label>
            <div className="intro-input-row">
              <span className="intro-cursor" aria-hidden>
                &gt;
              </span>
              <input
                id="player-name"
                className="intro-input"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                maxLength={24}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {error ? <p className="intro-error">{error}</p> : null}
            <button type="submit" className="intro-button">
              Continue
            </button>
          </form>
        )}

        {phase === "welcome" && (
          <div className="intro-dialogue">
            <p className="intro-line">
              Welcome {stats.name}! Or should I say &quot;{stats.nickname}&quot;?
            </p>
            <p className="intro-line">
              So you want to start with toppjakt, son! Couldn&apos;t be more
              stolt av deg!
            </p>
            <p className="intro-line intro-gift">
              Here, take my CZ452 — and that Biltema 3-9× I stuck on it. Great
              for squirrels in the back yard!
            </p>

            <blockquote className="intro-thought">
              Ah.. great.. uncle&apos;s .22 with a rattly Biltema 3-9×40. Clicks
              like Lego. Gee wiz, need to level up. Better buy some ammo and
              take it to the range.
            </blockquote>

            <button
              type="button"
              className="intro-button"
              onClick={headIntoTown}
            >
              Head into town
            </button>
          </div>
        )}

        {phase === "town" && (
          <TownHub
            playerName={stats.name}
            nickname={stats.nickname}
            onEnter={enterLocation}
          />
        )}

        {phase === "location" && location === "sheriff" && (
          <SheriffOffice
            playerName={stats.name}
            nickname={stats.nickname}
            balance={stats.balance}
            rifleCount={countHuntingRifles(stats)}
            licenseCount={stats.weaponLicenses.length}
            paidLicenseCount={countPaidLicenses(stats)}
            onPayAndFinish={applyForPermit}
            onLeave={backToTown}
          />
        )}

        {phase === "location" && location === "xxl" && (
          <XxlShop
            balance={stats.balance}
            inventory={stats.inventory}
            canBuyRifle={canBuyHuntingRifle(stats)}
            unusedLicenses={unusedLicenseCount(stats)}
            onBuy={buyShopItem}
            onLeave={backToTown}
          />
        )}

        {phase === "location" && location === "cb-customs" && (
          <CbCustoms
            balance={stats.balance}
            customsMods={stats.customsMods}
            kitItems={stats.kit
              .map((id) => resolvePlayerItem(id))
              .filter((x): x is ShopItem => x != null)}
            inventory={stats.inventory}
            rifleRoundCounts={stats.rifleRoundCounts}
            customBarrels={stats.customBarrels}
            onBuyService={buyCustomsService}
            onOrderHomeLoads={orderCustomsHomeLoads}
            onReplaceBarrel={replaceCustomsBarrel}
            onInstallCustomBarrel={installCustomsCustomBarrel}
            onLeave={backToTown}
          />
        )}

        {phase === "location" && location === "meat-market" && (
          <MeatMarket
            playerName={stats.name}
            nickname={stats.nickname}
            balance={stats.balance}
            carcasses={[...stats.freezerCarcasses, ...stats.carcasses]}
            onSell={sellCarcasses}
            onLeave={backToTown}
          />
        )}

        {phase === "location" && location === "rulles" && (
          <RullesBar
            playerName={stats.name}
            nickname={stats.nickname}
            balance={stats.balance}
            unlockedTerrainIds={stats.unlockedTerrainIds}
            hunter={{
              tiur: stats.tiur,
              orrhaner: stats.orrhaner,
              lifetimeTiur: stats.lifetimeTiur,
              lifetimeOrrhaner: stats.lifetimeOrrhaner,
              maxRange: stats.maxRange,
            }}
            ugleCarcass={
              [...stats.freezerCarcasses, ...stats.carcasses].find(
                (c) => c.species === "ugle",
              ) ?? null
            }
            onSellUgle={sellUgleToRulle}
            onSpend={spendAtRulles}
            onEarn={(amountNok) => {
              if (amountNok <= 0) return;
              setStats((prev) => ({
                ...prev,
                balance: prev.balance + amountNok,
              }));
            }}
            onUnlockTerrain={unlockRullesTerrain}
            onLeave={backToTown}
          />
        )}

        {phase === "location" && location === "home" && (
          <HomeBase
            balance={stats.balance}
            inventory={stats.inventory}
            kit={stats.kit}
            shotLog={stats.shotLog}
            dopeCard={stats.dopeCard}
            rifleRoundCounts={stats.rifleRoundCounts}
            customsMods={stats.customsMods}
            customBarrels={stats.customBarrels}
            freezerCarcasses={stats.freezerCarcasses}
            licenseCount={stats.weaponLicenses.length}
            rifleCount={countHuntingRifles(stats)}
            unusedLicenses={unusedLicenseCount(stats)}
            selectedHuntingTerrainId={stats.selectedHuntingTerrainId}
            jaktkort={stats.jaktkort}
            unlockedTerrainIds={stats.unlockedTerrainIds}
            zeroingProfiles={stats.zeroingProfiles}
            autoSupplyFood={stats.autoSupplyFood}
            loadBenchRecipe={stats.loadBenchRecipe}
            loadDevTable={stats.loadDevTable}
            loadBook={stats.loadBook}
            armedLoadPlan={stats.armedLoadPlan}
            onToggleKit={toggleKit}
            onSetAutoSupplyFood={setAutoSupplyFood}
            onChangeLoadBenchRecipe={(recipe) =>
              setStats((prev) => ({ ...prev, loadBenchRecipe: recipe }))
            }
            onChangeLoadDevTable={(table) =>
              setStats((prev) => ({ ...prev, loadDevTable: table }))
            }
            onChangeLoadBook={(book) =>
              setStats((prev) => ({ ...prev, loadBook: book }))
            }
            onArmLoadPlan={(plan) =>
              setStats((prev) => armLoadPlan(prev, plan))
            }
            onDisarmLoadPlan={() =>
              setStats((prev) => disarmLoadPlan(prev))
            }
            onSellOnFinn={sellOnFinn}
            onPurchaseJaktkort={selectHuntingTerrain}
            onUpdateDope={updateDopeEntry}
            onRemoveDope={removeDopeEntry}
            hasKestrel={ownsKestrelDevice(
              stats.inventory.map((e) => e.itemId),
              stats.kit,
            )}
            kestrelProfiles={stats.kestrelProfiles}
            onUpsertKestrelProfile={upsertKestrelProfile}
            onStartHunt={startHunt}
            onLeave={backToTown}
          />
        )}

        {phase === "hunt" && stats.selectedHuntingTerrainId ? (
          <HuntMapView
            terrainId={stats.selectedHuntingTerrainId}
            kitItems={stats.kit
              .map((id) => resolvePlayerItem(id))
              .filter((x): x is ShopItem => x != null)}
            inventory={stats.inventory}
            ammoAffinities={stats.ammoAffinities}
            zeroingProfiles={stats.zeroingProfiles}
            rifleRoundCounts={stats.rifleRoundCounts}
            customBarrels={stats.customBarrels}
            dopeCard={stats.dopeCard}
            kestrelProfiles={stats.kestrelProfiles}
            customsMods={stats.customsMods}
            weather={weather}
            musicEnabled={musicEnabled}
            onAffinitiesChange={(next) =>
              setStats((prev) => ({ ...prev, ammoAffinities: next }))
            }
            onConsumeAmmo={spendAmmoRound}
            onEnsureZeroing={ensureComboZero}
            onAddDope={addDopeEntry}
            onLogSeries={logRangeSeries}
            onConsumeFood={consumeHuntFood}
            onBirdHarvested={harvestBird}
            carcasses={stats.carcasses}
            onConsumeCarcasses={consumeHuntCarcasses}
            onDepositCarcassesAtCar={depositCarcassesAtCar}
            onHudChange={onHuntHudChange}
            onCampOvernight={consumeJaktkortOvernight}
            onLeave={endHunt}
            lifetimeTiur={stats.lifetimeTiur}
            lifetimeOrrhaner={stats.lifetimeOrrhaner}
            lifetimeUgle={stats.lifetimeUgle}
            owlLastOfferedMilestone={stats.owlLastOfferedMilestone}
            onOwlOffered={(milestone) =>
              setStats((prev) => ({
                ...prev,
                owlLastOfferedMilestone: milestone,
              }))
            }
          />
        ) : null}

        {phase === "location" && location === "shooting-range" && (
          <ShootingRange
            kitItems={stats.kit
              .map((id) => resolvePlayerItem(id))
              .filter((x): x is ShopItem => x != null)}
            inventory={stats.inventory}
            ammoAffinities={stats.ammoAffinities}
            zeroingProfiles={stats.zeroingProfiles}
            rifleRoundCounts={stats.rifleRoundCounts}
            customBarrels={stats.customBarrels}
            shotLog={stats.shotLog}
            dopeCard={stats.dopeCard}
            weather={weather}
            customsMoaDelta={customsBeddingMoaDelta(stats.customsMods)}
            customsCalmMult={customsCalmMultiplier(stats.customsMods)}
            customsTriggerPullScale={customsTriggerPullScale(stats.customsMods)}
            balance={stats.balance}
            onPayCompetitionFee={(amountNok) => {
              let paid = false;
              setStats((prev) => {
                if (prev.balance < amountNok) return prev;
                paid = true;
                return { ...prev, balance: prev.balance - amountNok };
              });
              return paid;
            }}
            onAwardCompetitionPayout={(amountNok) => {
              if (amountNok <= 0) return;
              setStats((prev) => ({
                ...prev,
                balance: prev.balance + amountNok,
              }));
            }}
            onAffinitiesChange={(next) =>
              setStats((prev) => ({ ...prev, ammoAffinities: next }))
            }
            onConsumeAmmo={spendAmmoRound}
            onEnsureZeroing={ensureComboZero}
            onSaveZeroing={saveComboZero}
            onAddDope={addDopeEntry}
            onUpdateDope={updateDopeEntry}
            onRemoveDope={removeDopeEntry}
            onLogSeries={logRangeSeries}
            kestrelProfiles={stats.kestrelProfiles}
            onUpsertKestrelProfile={upsertKestrelProfile}
            loadDevTable={stats.loadDevTable}
            loadBenchRecipe={stats.loadBenchRecipe}
            armedLoadPlan={stats.armedLoadPlan}
            onArmLoadPlan={(plan) =>
              setStats((prev) => armLoadPlan(prev, plan))
            }
            onDisarmLoadPlan={() =>
              setStats((prev) => disarmLoadPlan(prev))
            }
            musicEnabled={musicEnabled}
            onLeave={backToTown}
          />
        )}

        {phase === "location" && location === "how-to-play" && (
          <HowToPlayView onLeave={backToTown} />
        )}

        {phase === "sheriff-applied" && (
          <div className="intro-dialogue">
            {lastPermit?.approved ? (
              <>
                <p className="intro-line intro-gift">Lisens GODKJENT</p>
                <p className="intro-line">
                  Takk for betalingen, {stats.name}.{" "}
                  {formatPermitFee(lastPermit.fee)} er trukket. Digipost kan
                  komme om 45–55 uker — men statusfeltet står allerede på
                  GODKJENT.
                </p>
                <p className="intro-line">
                  Lisens for {lastPermit.application.brand}{" "}
                  {lastPermit.application.type} (
                  {lastPermit.application.caliber}) er i systemet. Den ligger
                  ikke i inventory — den låser opp kjøp hos XXL.
                </p>
              </>
            ) : (
              <>
                <p className="intro-line intro-gift">Søknad mottatt (avslått)</p>
                <p className="intro-line">
                  Takk for betalingen, {stats.name}.{" "}
                  {formatPermitFee(lastPermit?.fee ?? 0)} er trukket. Du har
                  allerede maks antall våpenlisenser. Systemet nekter — penere
                  enn lenspersonen.
                </p>
              </>
            )}
            <button type="button" className="intro-button" onClick={backToTown}>
              ← Tilbake til byen
            </button>
          </div>
        )}

        {phase === "location" &&
          location &&
          location !== "sheriff" &&
          location !== "xxl" &&
          location !== "cb-customs" &&
          location !== "home" &&
          location !== "meat-market" &&
          location !== "rulles" &&
          location !== "shooting-range" &&
          location !== "how-to-play" && (
          <div className="intro-dialogue">
            <p className="intro-line intro-gift">{location}</p>
            <p className="intro-line">
              The door is unlocked, but the shelves are still being stocked.
              Come back soon.
            </p>
            <button type="button" className="intro-button" onClick={backToTown}>
              ← Tilbake til byen
            </button>
          </div>
        )}
      </main>

      {(phase === "loading" || phase === "name") && (
        <p className="intro-footer">
          Drop your landscape art in /public/intro-bg.png
        </p>
      )}

      {deleteConfirmOpen ? (
        <GameConfirmDialog
          title="Slett jeger"
          message={
            `Slette ${stats.name || "jegeren"} for godt?\n` +
            "Alt lagret (penger, kit, jakt, skuddpar) forsvinner i denne nettleseren. " +
            "Du kan logge inn på nytt med et nytt navn."
          }
          confirmLabel="Slett"
          cancelLabel="Avbryt"
          danger
          onConfirm={confirmDeleteUserAndRestart}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      ) : null}

      {kaboomNotice ? (
        <GameConfirmDialog
          title="Våpen sprengt"
          message={
            "Overtrykk i ladeplanen detonerte våpenet.\n" +
            "Rifle, pipe, stokk, bedding og all CB Customs-customisering er tapt.\n" +
            "Du er uskadd — men du må skaffe nytt våpen og starte oppsettet på nytt."
          }
          confirmLabel="Forstått"
          cancelLabel="Lukk"
          danger
          onConfirm={() => {
            setKaboomNotice(false);
            if (phase === "hunt") {
              // Drop back to town if still in hunt with no rifle.
              setPhase("town");
              setLocation(null);
              setHuntHud(null);
            } else if (location === "shooting-range") {
              setLocation(null);
              setPhase("town");
            }
          }}
          onCancel={() => setKaboomNotice(false)}
        />
      ) : null}

      {saveConflict ? (
        <SaveConflictDialog
          local={saveConflict.local}
          cloud={saveConflict.cloud}
          onChooseCloud={chooseCloudSave}
          onChooseLocal={() => void chooseLocalOverwriteCloud()}
          onCancelLogin={() => void cancelConflictLogin()}
        />
      ) : null}
    </div>
  );
}
