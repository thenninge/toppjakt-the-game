"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { generateNickname } from "@/lib/nickname";
import {
  addToInventory,
  ammoRoundsPerPurchase,
  canApproveNewLicense,
  canBuyHuntingRifle,
  consumeAmmoRound,
  countHuntingRifles,
  countPaidLicenses,
  createInitialStats,
  createWeaponLicense,
  ensureZeroingProfile,
  formatPermitFee,
  grantStarterGear,
  grantUncleRifle,
  isCheatPlayerName,
  startingBalanceForName,
  resolvePlayerItem,
  saveZeroing,
  appendShotLogEntry,
  addDopeCardEntry,
  updateDopeCardEntry,
  removeDopeCardEntry,
  unusedLicenseCount,
  consumeInventoryItem,
  sellInventoryOnFinn,
  type PlayerStats,
  type ShotLogEntry,
  type DopeCardEntry,
  type ZeroingProfile,
} from "@/lib/player";
import type { ShopItem } from "@/lib/shop/types";
import { StatsFrame } from "@/components/hud/StatsFrame";
import { StatusBar } from "@/components/hud/StatusBar";
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
import {
  SheriffOffice,
  type SheriffFinishResult,
} from "@/components/town/SheriffOffice";
import { PikeProShop } from "@/components/town/PikeProShop";
import { CbCustoms } from "@/components/town/CbCustoms";
import { MeatMarket } from "@/components/town/MeatMarket";
import { RullesBar } from "@/components/town/RullesBar";
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
  type CustomsServiceId,
} from "@/lib/customs/spec";
import { isAmmoItem, isCamoItem, isFoodItem, isMiscItem, isRifleItem } from "@/lib/shop/types";
import { camoSlot } from "@/lib/camo/spec";
import { isHeadlampMisc } from "@/lib/misc/spec";
import {
  getHuntingTerrain,
  type HuntingTerrainId,
} from "@/lib/hunt/terrain";
import {
  loadPlayerSave,
  savePlayerStats,
} from "@/lib/playerSave";

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
  const [phase, setPhase] = useState<Phase>("loading");
  const [dots, setDots] = useState(".");
  const [name, setName] = useState("");
  const [stats, setStats] = useState<PlayerStats>(createInitialStats);
  const [location, setLocation] = useState<TownLocationId | null>(null);
  const [error, setError] = useState("");
  const [weather, setWeather] = useState<DayWeather>(() => createDayWeather());
  const [lastPermit, setLastPermit] = useState<SheriffFinishResult | null>(
    null,
  );
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [hunterStatusEnabled, setHunterStatusEnabled] = useState(true);
  const [huntHud, setHuntHud] = useState<HuntHudStatus | null>(null);
  const statsRef = useRef(stats);

  const showStats = phase !== "loading" && phase !== "name" && !!stats.name;
  const musicScene = musicSceneFromGame({ phase, location });
  const onHuntHudChange = useCallback((hud: HuntHudStatus) => {
    setHuntHud(hud);
  }, []);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  /** Persist progress across refresh / new Vercel deploys (same browser). */
  useEffect(() => {
    if (!stats.name) return;
    savePlayerStats(stats);
  }, [stats]);

  useEffect(() => {
    setMusicEnabled(readMusicEnabled());
  }, []);

  useEffect(() => {
    if (phase !== "loading") return;

    const dotTimer = window.setInterval(() => {
      setDots((d) => (d.length >= 4 ? "." : `${d}.`));
    }, 380);

    const done = window.setTimeout(() => {
      const saved = loadPlayerSave();
      if (saved?.stats.name) {
        setStats(saved.stats);
        setName(saved.stats.name);
        setPhase("town");
        return;
      }
      setPhase("name");
    }, LOADING_MS);

    return () => {
      window.clearInterval(dotTimer);
      window.clearTimeout(done);
    };
  }, [phase]);

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

  function buyShopItem(item: ShopItem) {
    setStats((prev) => {
      if (prev.balance < item.priceNok) return prev;
      if (isRifleItem(item) && !canBuyHuntingRifle(prev)) return prev;
      const purchaseQty = isAmmoItem(item) ? ammoRoundsPerPurchase(item) : 1;
      return {
        ...prev,
        balance: prev.balance - item.priceNok,
        inventory: addToInventory(prev.inventory, item.id, purchaseQty),
      };
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

  function sellCarcasses(carcassIds: string[]) {
    const idSet = new Set(carcassIds);
    setStats((prev) => {
      const selling = prev.carcasses.filter((c) => idSet.has(c.id));
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
      return {
        ...prev,
        balance: prev.balance + payout,
        tiur,
        orrhaner,
        carcasses: prev.carcasses.filter((c) => !idSet.has(c.id)),
      };
    });
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
      } else if (id === "home_loads_setup") {
        if (mods.homeLoadsSetup) return prev;
        mods.homeLoadsSetup = true;
      } else if (id === "custom_camo") {
        if (mods.customCamo) return prev;
        mods.customCamo = true;
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

  const spendAmmoRound = useCallback((ammoId: string): boolean => {
    const result = consumeAmmoRound(statsRef.current, ammoId);
    if (!result.ok) return false;
    setStats(result.stats);
    return true;
  }, []);

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

  const logRangeSeries = useCallback((entry: ShotLogEntry) => {
    setStats((prev) => ({
      ...prev,
      shotLog: appendShotLogEntry(prev.shotLog, entry),
    }));
  }, []);

  function toggleKit(itemId: string) {
    setStats((prev) => ({
      ...prev,
      kit: toggleKitItem(
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
      ),
    }));
  }

  function selectHuntingTerrain(terrainId: string) {
    setStats((prev) => {
      const terrain = getHuntingTerrain(terrainId);
      if (!terrain || prev.balance < terrain.pricePerDayNok) return prev;
      if (prev.selectedHuntingTerrainId === terrainId) return prev;
      return {
        ...prev,
        balance: prev.balance - terrain.pricePerDayNok,
        selectedHuntingTerrainId: terrainId,
      };
    });
  }

  function startHunt() {
    if (!stats.selectedHuntingTerrainId) return;
    setLocation(null);
    setHuntHud(null);
    setPhase("hunt");
  }

  function endHunt() {
    setHuntHud(null);
    setLocation("home");
    setPhase("location");
  }

  function consumeHuntFood(itemId: string): boolean {
    const prev = statsRef.current;
    const result = consumeInventoryItem(prev.inventory, itemId, 1);
    if (!result.ok) return false;
    const next = { ...prev, inventory: result.inventory };
    statsRef.current = next;
    setStats(next);
    return true;
  }

  function headIntoTown() {
    setStats((prev) => {
      if (isCheatPlayerName(prev.name)) {
        return grantStarterGear({
          ...prev,
          balance: startingBalanceForName(prev.name),
        });
      }
      return grantUncleRifle({
        ...prev,
        balance: startingBalanceForName(prev.name),
      });
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
          {hunterStatusEnabled ? <StatsFrame stats={stats} /> : null}
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
            <p
              className={
                huntHud.isDark
                  ? "intro-header-clock hunt-clock is-dark"
                  : "intro-header-clock hunt-clock"
              }
            >
              Kl {formatHuntClock(huntHud.clockMinutes)}
            </p>
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
            />
          ) : phase === "hunt" ? (
            <span className="intro-header-side" aria-hidden />
          ) : null}
        </header>

        {phase === "loading" && (
          <p className="intro-prompt intro-loading" role="status">
            Loading {dots} Cold Bore Toppjakt - The Game!
          </p>
        )}

        {phase === "name" && (
          <form className="intro-form" onSubmit={onSubmit}>
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

        {phase === "location" && location === "pike-pro-shop" && (
          <PikeProShop
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
            onBuyService={buyCustomsService}
            onOrderHomeLoads={orderCustomsHomeLoads}
            onLeave={backToTown}
          />
        )}

        {phase === "location" && location === "meat-market" && (
          <MeatMarket
            playerName={stats.name}
            nickname={stats.nickname}
            balance={stats.balance}
            carcasses={stats.carcasses}
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
            onSpend={spendAtRulles}
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
            customsMods={stats.customsMods}
            licenseCount={stats.weaponLicenses.length}
            rifleCount={countHuntingRifles(stats)}
            unusedLicenses={unusedLicenseCount(stats)}
            selectedHuntingTerrainId={stats.selectedHuntingTerrainId}
            unlockedTerrainIds={stats.unlockedTerrainIds}
            onToggleKit={toggleKit}
            onSellOnFinn={sellOnFinn}
            onSelectHuntingTerrain={selectHuntingTerrain}
            onUpdateDope={updateDopeEntry}
            onRemoveDope={removeDopeEntry}
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
            dopeCard={stats.dopeCard}
            customsMods={stats.customsMods}
            weather={weather}
            musicEnabled={musicEnabled}
            onAffinitiesChange={(next) =>
              setStats((prev) => ({ ...prev, ammoAffinities: next }))
            }
            onConsumeAmmo={spendAmmoRound}
            onEnsureZeroing={ensureComboZero}
            onConsumeFood={consumeHuntFood}
            onBirdHarvested={harvestBird}
            carcasses={stats.carcasses}
            onConsumeCarcasses={consumeHuntCarcasses}
            onHudChange={onHuntHudChange}
            onLeave={endHunt}
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
            shotLog={stats.shotLog}
            dopeCard={stats.dopeCard}
            weather={weather}
            customsMoaDelta={customsBeddingMoaDelta(stats.customsMods)}
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
            musicEnabled={musicEnabled}
            onLeave={backToTown}
          />
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
                  ikke i inventory — den låser opp kjøp hos Pike Pro.
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
          location !== "pike-pro-shop" &&
          location !== "cb-customs" &&
          location !== "home" &&
          location !== "meat-market" &&
          location !== "rulles" &&
          location !== "shooting-range" && (
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
    </div>
  );
}
