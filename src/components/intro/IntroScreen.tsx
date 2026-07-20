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
  formatPermitFee,
  grantStarterGear,
  resolvePlayerItem,
  unusedLicenseCount,
  type PlayerStats,
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
import { HomeBase, toggleKitItem } from "@/components/town/HomeBase";
import { ShootingRange } from "@/components/town/ShootingRange";
import { isAmmoItem, isCamoItem, isFoodItem, isRifleItem } from "@/lib/shop/types";
import { camoSlot } from "@/lib/camo/spec";

type Phase =
  | "loading"
  | "name"
  | "welcome"
  | "town"
  | "location"
  | "sheriff-applied";

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
  const statsRef = useRef(stats);

  const showStats = phase !== "loading" && phase !== "name" && !!stats.name;
  const musicScene = musicSceneFromGame({ phase, location });

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    setMusicEnabled(readMusicEnabled());
  }, []);

  function toggleMusic() {
    setMusicEnabled((prev) => {
      const next = !prev;
      writeMusicEnabled(next);
      return next;
    });
  }
  // Weather HUD only during mission — not town / shop / sheriff / home.
  const showWeather = false;

  // Live weather drifts only while on a mission (when weather HUD is shown).
  useEffect(() => {
    if (!showWeather) return;
    const id = window.setInterval(() => {
      setWeather((w) => advanceLiveWeather(w, 2));
    }, 8000);
    return () => window.clearInterval(id);
  }, [showWeather]);

  useEffect(() => {
    if (phase !== "loading") return;

    const dotTimer = window.setInterval(() => {
      setDots((d) => (d.length >= 4 ? "." : `${d}.`));
    }, 380);

    const done = window.setTimeout(() => {
      setPhase("name");
    }, LOADING_MS);

    return () => {
      window.clearInterval(dotTimer);
      window.clearTimeout(done);
    };
  }, [phase]);

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

  const spendAmmoRound = useCallback((ammoId: string): boolean => {
    const result = consumeAmmoRound(statsRef.current, ammoId);
    if (!result.ok) return false;
    setStats(result.stats);
    return true;
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
      ),
    }));
  }

  function headIntoTown() {
    setStats((prev) => grantStarterGear(prev));
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
          />
          <StatsFrame stats={stats} />
        </div>
      ) : null}

      <GameMusic scene={musicScene} enabled={musicEnabled && showStats} />

      {showWeather ? <WeatherFrame weather={weather} /> : null}

      <main className="intro-panel">
        <header className="intro-header">
          <h1 className="intro-title">Cold Bore Toppjakt</h1>
          <p className="intro-subtitle">The Game!</p>
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
              Here, take my CZ452, it&apos;s yours now. It&apos;s great for
              squirrels in the back yard!
            </p>

            <blockquote className="intro-thought">
              Ah.. great.. my old uncle&apos;s .22 with iron sights and no
              picatinny.. gee wiz, need to level up. Better buy some ammo and
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

        {phase === "location" && location === "home" && (
          <HomeBase
            inventory={stats.inventory}
            kit={stats.kit}
            licenseCount={stats.weaponLicenses.length}
            rifleCount={countHuntingRifles(stats)}
            unusedLicenses={unusedLicenseCount(stats)}
            onToggleKit={toggleKit}
            onLeave={backToTown}
          />
        )}

        {phase === "location" && location === "shooting-range" && (
          <ShootingRange
            kitItems={stats.kit
              .map((id) => resolvePlayerItem(id))
              .filter((x): x is ShopItem => x != null)}
            inventory={stats.inventory}
            ammoAffinities={stats.ammoAffinities}
            onAffinitiesChange={(next) =>
              setStats((prev) => ({ ...prev, ammoAffinities: next }))
            }
            onConsumeAmmo={spendAmmoRound}
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
          location !== "home" &&
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
