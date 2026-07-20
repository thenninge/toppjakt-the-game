"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  cellLabel,
  getHuntMap,
  rowLetter,
  type HuntGridCell,
  type HuntMapId,
} from "@/lib/hunt/maps";
import {
  formatBirdRating,
  getHuntingTerrain,
  terrainMapSrc,
} from "@/lib/hunt/terrain";
import { getHuntPace, HUNT_PACES, type HuntPaceId } from "@/lib/hunt/pace";
import {
  baseMinutesForEffort,
  CELL_WIDTH_M,
  clampFatigue,
  describeEffort,
  EAT_ACTION_MINUTES,
  fatigueFromStep,
  formatHuntClock,
  getCellEffort,
  HUNT_DAY_START_MINUTES,
  HUNT_DARK_MINUTES,
  isHuntDark,
  pathTravelMinutes,
  REST_ACTION_MINUTES,
  travelMinutesForCell,
  type EffortScore,
} from "@/lib/hunt/travel";
import {
  FORCED_REST_MINUTES,
  pickEatImage,
  pickSpotImage,
  pickWalkImage,
  REST_TIRED_IMAGE,
} from "@/lib/hunt/images";
import {
  getInventoryQty,
  type InventoryEntry,
  type ZeroingProfile,
} from "@/lib/player";
import {
  isAmmoItem,
  isBallisticsItem,
  isFoodItem,
  isLrfItem,
  type ShopItem,
} from "@/lib/shop/types";
import { kitCanBoil, effectiveFoodStamina } from "@/lib/food/spec";
import { SpotView, type SpotMode } from "@/components/hunt/SpotView";
import { HuntShootView } from "@/components/hunt/HuntShootView";
import { WalkView } from "@/components/hunt/WalkView";
import { AtmospherePauseView } from "@/components/hunt/AtmospherePauseView";
import {
  flushMessage,
  placementsForBirdsInCell,
  resolveFlushesOnPath,
  spawnTiurOnMap,
  visibleInSpotMode,
  type BirdVisualPlacement,
  type FlushEvent,
  type HuntBird,
} from "@/lib/hunt/birds";
import type { HuntShotResult } from "@/lib/hunt/shoot";
import { lrfOpticalMagnification } from "@/lib/optics/spec";
import { DEFAULT_BINOS_MAGNIFICATION } from "@/lib/hunt/images";
import {
  exactBallisticHold,
  formatHoldClicks,
  type BallisticHoldSolution,
} from "@/lib/ballistics/solver";
import { crosswindMs, type DayWeather } from "@/lib/weather/spec";

type HuntMapViewProps = {
  terrainId: string;
  kitItems: ShopItem[];
  inventory: InventoryEntry[];
  ammoAffinities: Record<string, number>;
  zeroingProfiles: Record<string, ZeroingProfile>;
  weather: DayWeather;
  musicEnabled: boolean;
  onAffinitiesChange: (next: Record<string, number>) => void;
  onConsumeAmmo: (ammoId: string) => boolean;
  onEnsureZeroing: (
    rifleId: string,
    scopeId: string,
    ammoId: string,
  ) => ZeroingProfile;
  onConsumeFood: (itemId: string) => boolean;
  onTiurHarvested: () => void;
  onLeave: () => void;
};

type PanelMode = "idle" | "inspect" | "arrived" | "eat";

type WalkSession = {
  imageSrc: string;
  from: HuntGridCell;
  to: HuntGridCell;
  minutes: number;
  path: HuntGridCell[];
  paceId: HuntPaceId;
};

type SpotSession = {
  imageSrc: string;
  birdPlacements: BirdVisualPlacement[];
};

type ShootSession = {
  imageSrc: string;
  bird: BirdVisualPlacement;
  trueDistanceM: number;
  measuredDistanceM: number;
  /** Exact BDX + Kestrel hold from perfect zero (if equipped). */
  ballisticHold: BallisticHoldSolution | null;
  /** True local crosswind used for the shot (m/s, +from left). */
  crosswindMs: number;
};

type EatSession = {
  imageSrc: string;
  itemId: string;
  label: string;
  stam: number;
};

type ForcedRestSession = {
  imageSrc: string;
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Physical stamina left (100% = fresh, 0% = exhausted / «på null»). */
function physicalStaminaLeft(fatigue: number): number {
  return clampFatigue(1 - fatigue);
}

export function HuntMapView({
  terrainId,
  kitItems,
  inventory,
  ammoAffinities,
  zeroingProfiles,
  weather,
  musicEnabled,
  onAffinitiesChange,
  onConsumeAmmo,
  onEnsureZeroing,
  onConsumeFood,
  onTiurHarvested,
  onLeave,
}: HuntMapViewProps) {
  const terrain = getHuntingTerrain(terrainId);
  const map = terrain ? getHuntMap(terrain.mapId) : null;

  const [pos, setPos] = useState<HuntGridCell>(() =>
    map ? { ...map.start } : { row: 0, col: 0 },
  );
  const clockSecondsRef = useRef(HUNT_DAY_START_MINUTES * 60);
  const [clockMinutes, setClockMinutes] = useState(HUNT_DAY_START_MINUTES);
  const [mentalFatigue, setMentalFatigue] = useState(0);
  const [physicalFatigue, setPhysicalFatigue] = useState(0);
  const [selected, setSelected] = useState<HuntGridCell | null>(null);
  const [paceId, setPaceId] = useState<HuntPaceId>("normal");
  const [panel, setPanel] = useState<PanelMode>("arrived");
  const [log, setLog] = useState(
    "Du er på parkeringsplassen. Klokka er 08:00 — skuddlyst.",
  );
  const [walkSession, setWalkSession] = useState<WalkSession | null>(null);
  const [spotSession, setSpotSession] = useState<SpotSession | null>(null);
  const [shootSession, setShootSession] = useState<ShootSession | null>(null);
  const [eatSession, setEatSession] = useState<EatSession | null>(null);
  const [forcedRest, setForcedRest] = useState<ForcedRestSession | null>(null);
  const [birds, setBirds] = useState<HuntBird[]>(() =>
    map ? spawnTiurOnMap(map) : [],
  );
  const [flushQueue, setFlushQueue] = useState<FlushEvent[]>([]);
  const flushCurrent = flushQueue[0] ?? null;
  const pendingForcedRestRef = useRef(false);

  const binoItem = useMemo(() => kitItems.find(isLrfItem) ?? null, [kitItems]);
  const hasBinos = !!binoItem;
  const binosLabel = binoItem
    ? `${binoItem.brand} ${binoItem.name}`
    : null;
  const binosMagnification = binoItem
    ? lrfOpticalMagnification(binoItem)
    : DEFAULT_BINOS_MAGNIFICATION;
  const kestrelItem = useMemo(
    () =>
      kitItems.find(
        (i) => isBallisticsItem(i) && i.ballistics.measuresCrosswind,
      ) ?? null,
    [kitItems],
  );
  /** BDX/AB + local wind → exact range and holds from perfect zero. */
  const hasExactBallistics = !!(
    binoItem?.lrf.hasOnboardBallistics && kestrelItem
  );
  const lrfSpec = useMemo(() => {
    if (!binoItem?.lrf) return null;
    if (hasExactBallistics) {
      return { ...binoItem.lrf, rangeErrorPercent: 0 };
    }
    return binoItem.lrf;
  }, [binoItem, hasExactBallistics]);
  const primaryAmmo = useMemo(
    () => kitItems.find(isAmmoItem) ?? null,
    [kitItems],
  );

  function syncClockFromRef() {
    setClockMinutes(Math.floor(clockSecondsRef.current / 60));
  }

  function advanceClockMinutes(deltaMin: number) {
    clockSecondsRef.current += deltaMin * 60;
    syncClockFromRef();
  }

  function addGameSeconds(sec: number) {
    clockSecondsRef.current += sec;
    syncClockFromRef();
  }

  useEffect(() => {
    if (!map) return;
    setPos({ ...map.start });
    clockSecondsRef.current = HUNT_DAY_START_MINUTES * 60;
    setClockMinutes(HUNT_DAY_START_MINUTES);
    setMentalFatigue(0);
    setPhysicalFatigue(0);
    setSelected(null);
    setPanel("arrived");
    setWalkSession(null);
    setSpotSession(null);
    setShootSession(null);
    setEatSession(null);
    setForcedRest(null);
    setBirds(spawnTiurOnMap(map));
    setFlushQueue([]);
    pendingForcedRestRef.current = false;
    setLog("Du er på parkeringsplassen. Klokka er 08:00 — skuddlyst.");
  }, [terrainId, map]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === "Escape" &&
        !spotSession &&
        !shootSession &&
        !walkSession &&
        !eatSession &&
        !forcedRest &&
        !flushCurrent
      ) {
        onLeave();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    onLeave,
    spotSession,
    shootSession,
    walkSession,
    eatSession,
    forcedRest,
    flushCurrent,
  ]);

  const cells = useMemo(() => {
    if (!map) return [];
    const list: {
      row: number;
      col: number;
      label: string;
      effort: EffortScore;
    }[] = [];
    for (let r = map.rows - 1; r >= 0; r--) {
      for (let c = 0; c < map.cols; c++) {
        list.push({
          row: r,
          col: c,
          label: cellLabel({ row: r, col: c }),
          effort: getCellEffort(map.id, { row: r, col: c }),
        });
      }
    }
    return list;
  }, [map]);

  const edible = useMemo(() => {
    const canBoil = kitCanBoil(
      kitItems.filter(isFoodItem).map((i) => i.food),
    );
    return kitItems
      .filter(isFoodItem)
      .filter((item) => item.food.kind === "meal" || item.food.kind === "ready")
      .map((item) => {
        const qty = getInventoryQty(inventory, item.id);
        const stam = effectiveFoodStamina(item.food, canBoil);
        return { item, qty, stam, canEat: qty > 0 && stam > 0 };
      })
      .filter((x) => x.qty > 0);
  }, [kitItems, inventory]);

  if (!terrain || !map) {
    return (
      <div className="hunt-map">
        <p className="intro-line">Ugyldig jaktterreng.</p>
        <button type="button" className="intro-button" onClick={onLeave}>
          Tilbake til Home
        </button>
      </div>
    );
  }

  const activeMap = map;
  const mapId = terrain.mapId as HuntMapId;
  const dark = isHuntDark(clockMinutes);
  const pace = getHuntPace(paceId);
  const hereEffort = getCellEffort(activeMap.id, pos);

  function fatigueAfterPath(
    path: HuntGridCell[],
    usedPace: ReturnType<typeof getHuntPace>,
  ): { mental: number; physical: number } {
    let mental = mentalFatigue;
    let physical = physicalFatigue;
    for (const cell of path) {
      const effort = getCellEffort(activeMap.id, cell);
      const gain = fatigueFromStep(effort, usedPace);
      mental = clampFatigue(mental + gain.mental);
      physical = clampFatigue(physical + gain.physical);
    }
    return { mental, physical };
  }

  function triggerForcedRestIfNeeded(nextPhysical: number): boolean {
    if (nextPhysical < 1) return false;
    setForcedRest({ imageSrc: REST_TIRED_IMAGE });
    setLog("Du er helt utkjørt (fysisk på null). Tvungen pause — 1 time.");
    return true;
  }

  function onCellClick(cell: HuntGridCell) {
    if (
      walkSession ||
      spotSession ||
      shootSession ||
      eatSession ||
      forcedRest ||
      flushCurrent
    )
      return;
    if (physicalFatigue >= 1) {
      setForcedRest({ imageSrc: REST_TIRED_IMAGE });
      return;
    }
    if (cell.row === pos.row && cell.col === pos.col) {
      setSelected(null);
      setPanel("arrived");
      return;
    }
    setSelected(cell);
    setPanel("inspect");
  }

  function goHere() {
    if (!selected) return;
    if (selected.row === pos.row && selected.col === pos.col) return;
    if (physicalFatigue >= 1) {
      setForcedRest({ imageSrc: REST_TIRED_IMAGE });
      setLog("Du er på null fysisk — må hvile før du går videre.");
      return;
    }

    const usedPace = getHuntPace(paceId);
    const trip = pathTravelMinutes(activeMap.id, pos, selected, usedPace);
    if (trip.steps === 0) return;

    setWalkSession({
      imageSrc: pickWalkImage(),
      from: { ...pos },
      to: { ...selected },
      minutes: trip.minutes,
      path: trip.path,
      paceId,
    });
    setSelected(null);
    setPanel("idle");
  }

  function finishWalk() {
    if (!walkSession) return;
    const usedPace = getHuntPace(walkSession.paceId);
    advanceClockMinutes(walkSession.minutes);
    const nextFatigue = fatigueAfterPath(walkSession.path, usedPace);
    setMentalFatigue(nextFatigue.mental);
    setPhysicalFatigue(nextFatigue.physical);
    setPos({ ...walkSession.to });
    const nowDark = isHuntDark(Math.floor(clockSecondsRef.current / 60));

    const flush = resolveFlushesOnPath(
      birds,
      walkSession.path,
      walkSession.paceId,
      activeMap,
    );
    setBirds(flush.birds);

    const walkLog =
      `Gikk til ${cellLabel(walkSession.to)} på ${walkSession.minutes} min (${usedPace.label}, ${walkSession.path.length} ruter).` +
      (nowDark ? " Det er mørkt — skuddlyst er over." : "");

    setWalkSession(null);

    if (flush.events.length > 0) {
      pendingForcedRestRef.current = nextFatigue.physical >= 1;
      setFlushQueue(flush.events);
      setLog(flushMessage(flush.events[0]!));
      return;
    }

    setLog(walkLog);
    if (triggerForcedRestIfNeeded(nextFatigue.physical)) return;
    setPanel("arrived");
  }

  function finishFlush() {
    const rest = flushQueue.slice(1);
    setFlushQueue(rest);
    if (rest.length > 0) {
      setLog(flushMessage(rest[0]!));
      return;
    }
    setLog("Fuglen er borte. Beveg deg mer forsiktig neste gang.");
    if (pendingForcedRestRef.current) {
      pendingForcedRestRef.current = false;
      setForcedRest({ imageSrc: REST_TIRED_IMAGE });
    } else {
      setPanel("arrived");
    }
  }

  function beginSpot() {
    setSpotSession({
      imageSrc: pickSpotImage(),
      birdPlacements: placementsForBirdsInCell(birds, pos),
    });
  }

  function finishSpot(info: { mode: SpotMode; gameSeconds: number }) {
    const lookMin = info.gameSeconds / 60;
    const strain =
      info.mode === "binos"
        ? 0.02 * pace.mentalStrain
        : 0.015 * pace.mentalStrain;
    setMentalFatigue((m) => clampFatigue(m + strain * Math.max(1, lookMin)));

    const timeLabel =
      lookMin >= 1
        ? `${lookMin.toFixed(1)} min`
        : `${Math.round(info.gameSeconds)} s`;
    const modeLabel = info.mode === "binos" ? "Binos" : "Øyne";
    const placements = spotSession?.birdPlacements ?? [];
    const visible = placements.filter((p) =>
      visibleInSpotMode(p.distanceM, info.mode),
    );
    const hiddenFar =
      info.mode === "eyes"
        ? placements.filter((p) => !visibleInSpotMode(p.distanceM, "eyes"))
        : [];

    if (visible.length > 0) {
      const dists = visible.map((p) => `${p.distanceM} m`).join(", ");
      setLog(
        `${modeLabel} (${timeLabel}): Du ser ${visible.length === 1 ? "en tiur" : `${visible.length} tiurer`} i trærne (${dists}).`,
      );
    } else if (hiddenFar.length > 0) {
      setLog(
        `${modeLabel} (${timeLabel}): Ingen fugl synlig med øynene. Prøv kikkert — det kan være noe lenger unna.`,
      );
    } else {
      setLog(`${modeLabel} (${timeLabel}): Ingen fugl i denne ruta.`);
    }
    setSpotSession(null);
    setPanel("arrived");
  }

  function onBirdObserved(info: {
    placement: BirdVisualPlacement;
    measuredDistanceM: number;
    gameSeconds: number;
  }) {
    const imageSrc = spotSession?.imageSrc ?? pickSpotImage();
    const lookMin = info.gameSeconds / 60;
    setMentalFatigue((m) =>
      clampFatigue(m + 0.02 * pace.mentalStrain * Math.max(1, lookMin)),
    );
    const trueDist = info.placement.distanceM;
    const measured = hasExactBallistics
      ? Math.round(trueDist)
      : info.measuredDistanceM;
    // Default shot bearing 0° — Kestrel gives true local crosswind component.
    const cw = crosswindMs(
      weather.live.windSpeedMs,
      weather.live.windFromDeg,
      0,
    );
    let hold: BallisticHoldSolution | null = null;
    if (hasExactBallistics && primaryAmmo) {
      hold = exactBallisticHold(primaryAmmo.ammo, measured, cw);
    }
    setSpotSession(null);
    setShootSession({
      imageSrc,
      bird: info.placement,
      trueDistanceM: trueDist,
      measuredDistanceM: measured,
      ballisticHold: hold,
      crosswindMs: cw,
    });
    if (hold) {
      setLog(
        `Fugl observert! LRF ${measured} m · BDX+Kestrel: ${formatHoldClicks(hold)} (perfekt zero).`,
      );
    } else {
      setLog(
        `Fugl observert! LRF ${measured} m — klar til skudd.`,
      );
    }
  }

  function abortShoot() {
    setShootSession(null);
    setLog("Du senker våpenet. Fuglen er fortsatt der.");
    setPanel("arrived");
  }

  function onHuntShotResult(result: HuntShotResult) {
    if (!shootSession) return;
    const id = shootSession.bird.birdId;
    const dist = result.measuredDistanceM;
    if (result.kind === "instant_kill" || result.kind === "vital_kill") {
      setBirds((prev) => prev.filter((b) => b.id !== id));
      onTiurHarvested();
      setLog(
        result.kind === "instant_kill"
          ? `Instant kill på ${dist} m (grønn sone). Tiuren er din.`
          : `Vitalt treff på ${dist} m — ren felling. Tiuren er din.`,
      );
    } else if (result.kind === "ettersok") {
      setBirds((prev) => prev.filter((b) => b.id !== id));
      const where =
        result.zone === "vital"
          ? "i rød vital-sone (ammo avgjorde ettersøk)"
          : "i kroppen";
      setLog(
        `Treff ${where} på ${dist} m — ettersøk. (Ettersøk-gameplay kommer.)`,
      );
    } else {
      setLog(
        `Bom på ${dist} m. Fuglen sitter fortsatt. Skru riktig elevation og prøv igjen.`,
      );
    }
    setShootSession(null);
    setPanel("arrived");
  }

  function restTen() {
    advanceClockMinutes(REST_ACTION_MINUTES);
    setMentalFatigue((m) => clampFatigue(m - 0.15));
    setPhysicalFatigue((p) => clampFatigue(p - 0.12));
    setLog("Du hviler 10 minutter. Mentalt og fysisk litt bedre.");
  }

  function eatItem(itemId: string) {
    const entry = edible.find((e) => e.item.id === itemId);
    if (!entry || !entry.canEat) {
      setLog(
        entry?.item.food.requiresBoil
          ? "Kan ikke spise Real uten kokeutstyr i kit."
          : "Kan ikke spise dette nå.",
      );
      return;
    }
    setEatSession({
      imageSrc: pickEatImage(),
      itemId,
      label: `${entry.item.brand} ${entry.item.name}`,
      stam: entry.stam,
    });
  }

  function finishEat() {
    if (!eatSession) return;
    if (!onConsumeFood(eatSession.itemId)) {
      setLog("Ingen mer av den maten igjen.");
      setEatSession(null);
      setPanel("arrived");
      return;
    }
    advanceClockMinutes(EAT_ACTION_MINUTES);
    const restore = eatSession.stam / 10;
    setPhysicalFatigue((p) => clampFatigue(p - restore * 0.35));
    setMentalFatigue((m) => clampFatigue(m - restore * 0.2));
    setLog(
      `Spiste ${eatSession.label} (+${eatSession.stam} stamina-hint, ${EAT_ACTION_MINUTES} min).`,
    );
    setEatSession(null);
    setPanel("arrived");
  }

  function finishForcedRest() {
    if (!forcedRest) return;
    advanceClockMinutes(FORCED_REST_MINUTES);
    setPhysicalFatigue(0.15);
    setMentalFatigue((m) => clampFatigue(m - 0.25));
    setLog(
      `Tvungen hvile ${FORCED_REST_MINUTES} min. Du er på beina igjen — ta det roligere.`,
    );
    setForcedRest(null);
    setPanel("arrived");
  }

  const inspectTrip =
    selected && map
      ? pathTravelMinutes(map.id, pos, selected, pace)
      : null;
  const selectedEffort = selected
    ? getCellEffort(map.id, selected)
    : null;

  if (flushCurrent) {
    return (
      <AtmospherePauseView
        key={flushCurrent.birdId}
        imageSrc={flushCurrent.imageSrc}
        title="Flukt!"
        subtitle={flushMessage(flushCurrent)}
        durationMinutes={2}
        clockMinutes={clockMinutes}
        onContinue={finishFlush}
        ariaLabel="Fugl fløy"
      />
    );
  }

  if (forcedRest) {
    return (
      <AtmospherePauseView
        imageSrc={forcedRest.imageSrc}
        title="Utkjørt…"
        subtitle={`Fysisk på null — tvungen pause ${FORCED_REST_MINUTES} min`}
        durationMinutes={FORCED_REST_MINUTES}
        clockMinutes={clockMinutes}
        onContinue={finishForcedRest}
        ariaLabel="Tvungen hvile"
      />
    );
  }

  if (eatSession) {
    return (
      <AtmospherePauseView
        imageSrc={eatSession.imageSrc}
        title="Spiser…"
        subtitle={eatSession.label}
        durationMinutes={EAT_ACTION_MINUTES}
        clockMinutes={clockMinutes}
        onContinue={finishEat}
        ariaLabel="Spiser"
      />
    );
  }

  if (shootSession) {
    return (
      <HuntShootView
        trueDistanceM={shootSession.trueDistanceM}
        measuredDistanceM={shootSession.measuredDistanceM}
        ballisticHold={shootSession.ballisticHold}
        crosswindMs={shootSession.crosswindMs}
        clockMinutes={clockMinutes}
        kitItems={kitItems}
        inventory={inventory}
        ammoAffinities={ammoAffinities}
        zeroingProfiles={zeroingProfiles}
        musicEnabled={musicEnabled}
        onAffinitiesChange={onAffinitiesChange}
        onConsumeAmmo={onConsumeAmmo}
        onEnsureZeroing={onEnsureZeroing}
        onAbort={abortShoot}
        onShotResult={onHuntShotResult}
      />
    );
  }

  if (spotSession) {
    return (
      <SpotView
        imageSrc={spotSession.imageSrc}
        birdPlacements={spotSession.birdPlacements}
        magnification={binosMagnification}
        lrfSpec={lrfSpec}
        clockMinutes={clockMinutes}
        hasBinos={hasBinos}
        hasLrf={hasBinos}
        binosLabel={binosLabel}
        onGameSeconds={addGameSeconds}
        onBirdObserved={onBirdObserved}
        onDone={finishSpot}
      />
    );
  }

  if (walkSession) {
    return (
      <WalkView
        imageSrc={walkSession.imageSrc}
        fromLabel={cellLabel(walkSession.from)}
        toLabel={cellLabel(walkSession.to)}
        travelMinutes={walkSession.minutes}
        clockMinutes={clockMinutes}
        paceLabel={getHuntPace(walkSession.paceId).label}
        onContinue={finishWalk}
      />
    );
  }

  return (
    <div className="hunt-map">
      <header className="hunt-map-hud">
        <div>
          <p className="intro-line intro-gift">
            Jakt — {terrain.name} ({terrain.region})
          </p>
          <p className="shop-row-note">
            <span className={dark ? "hunt-clock is-dark" : "hunt-clock"}>
              Kl {formatHuntClock(clockMinutes)}
            </span>
            {dark ? " · mørkt (skuddlyst slutt 17:00)" : " · skuddlyst til 17:00"}
            {" · "}
            Rute {cellLabel(pos)} · Effort {hereEffort}/5
            {" · "}
            Mental {pct(mentalFatigue)} · Fysisk{" "}
            {pct(physicalStaminaLeft(physicalFatigue))}
            {physicalFatigue >= 1 ? " (på null!)" : ""}
          </p>
          <p className="shop-row-note">{log}</p>
        </div>
        <button type="button" className="intro-button" onClick={onLeave}>
          Avslutt jakt
        </button>
      </header>

      <div className="hunt-map-layout">
        <div
          className="hunt-map-stage"
          style={
            {
              "--hunt-cols": map.cols,
              "--hunt-rows": map.rows,
            } as CSSProperties
          }
        >
          <div className="hunt-map-axis hunt-map-axis-y" aria-hidden>
            {Array.from({ length: map.rows }, (_, i) => {
              const rowFromBottom = map.rows - 1 - i;
              return <span key={i}>{rowLetter(rowFromBottom)}</span>;
            })}
          </div>

          <div className="hunt-map-canvas">
            <img
              src={terrainMapSrc(terrain)}
              alt={`Jaktkart ${getHuntMap(mapId).label}`}
              className="hunt-map-img"
              draggable={false}
            />

            <div className="hunt-map-grid">
              {cells.map((cell) => {
                const isPlayer = cell.row === pos.row && cell.col === pos.col;
                const isStart =
                  cell.row === map.start.row && cell.col === map.start.col;
                const isSelected =
                  selected &&
                  cell.row === selected.row &&
                  cell.col === selected.col;
                return (
                  <button
                    key={cell.label}
                    type="button"
                    className={[
                      "hunt-map-cell",
                      isPlayer ? "is-player" : "",
                      isStart ? "is-start" : "",
                      isSelected ? "is-selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={{
                      gridColumn: cell.col + 1,
                      gridRow: map.rows - cell.row,
                    }}
                    onClick={() =>
                      onCellClick({ row: cell.row, col: cell.col })
                    }
                    title={`${cell.label} · Effort ${cell.effort}/5`}
                  >
                    <span className="hunt-map-cell-label">
                      {cell.label}
                      <span className="hunt-map-cell-effort">
                        E{cell.effort}
                      </span>
                    </span>
                    {isPlayer ? (
                      <span className="hunt-map-player" aria-label="Du">
                        ●
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="hunt-map-axis hunt-map-axis-x" aria-hidden>
            {Array.from({ length: map.cols }, (_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
        </div>

        <aside className="hunt-side-panel">
          {panel === "inspect" && selected && selectedEffort != null && inspectTrip ? (
            <>
              <p className="intro-line intro-gift">
                Rute {cellLabel(selected)}
              </p>
              <p className="shop-row-note">
                Effort {selectedEffort}/5 — {describeEffort(selectedEffort)}
              </p>
              <p className="shop-row-note">
                {CELL_WIDTH_M} m · {baseMinutesForEffort(selectedEffort).toFixed(0)}{" "}
                min ved speed 1
              </p>
              <p className="shop-row-note">
                Fra {cellLabel(pos)}: {inspectTrip.steps} ruter ·{" "}
                {inspectTrip.minutes} min med «{pace.label}»
              </p>

              <fieldset className="hunt-pace-fieldset">
                <legend>Oppførsel / fart</legend>
                {HUNT_PACES.map((p) => {
                  const mins = pathTravelMinutes(map.id, pos, selected, p)
                    .minutes;
                  return (
                    <label key={p.id} className="hunt-pace-option">
                      <input
                        type="radio"
                        name="hunt-pace"
                        checked={paceId === p.id}
                        onChange={() => setPaceId(p.id)}
                      />
                      <span>
                        <strong>{p.label}</strong>
                        <span className="shop-row-note">
                          {mins} min · spot {pct(p.spottingProbability)} · spd{" "}
                          {p.speed}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              <div className="hunt-side-actions">
                <button type="button" className="intro-button" onClick={goHere}>
                  Go here
                </button>
                <button
                  type="button"
                  className="intro-button"
                  onClick={() => {
                    setSelected(null);
                    setPanel("arrived");
                  }}
                >
                  Avbryt
                </button>
              </div>
            </>
          ) : null}

          {panel === "arrived" ? (
            <>
              <p className="intro-line intro-gift">
                Du er i {cellLabel(pos)}
              </p>
              <p className="shop-row-note">
                Effort {hereEffort}/5 — {describeEffort(hereEffort)} ·{" "}
                {travelMinutesForCell(hereEffort, getHuntPace("normal"))} min
                normal her
              </p>
              <div className="hunt-side-actions hunt-side-actions-stack">
                <button
                  type="button"
                  className="intro-button"
                  onClick={beginSpot}
                >
                  Spot for birds
                </button>
                <button
                  type="button"
                  className="intro-button"
                  onClick={() => {
                    setLog("Velg en rute på kartet for å gå videre.");
                    setPanel("idle");
                  }}
                >
                  Move on
                </button>
                <button
                  type="button"
                  className="intro-button"
                  onClick={() => setPanel("eat")}
                >
                  Eat
                </button>
                <button type="button" className="intro-button" onClick={restTen}>
                  Rest 10 minutes
                </button>
              </div>
              <p className="shop-row-note">
                Tiur {formatBirdRating(terrain.tiurRating)} · Orrhane{" "}
                {formatBirdRating(terrain.orrhaneRating)} · mørkt kl{" "}
                {formatHuntClock(HUNT_DARK_MINUTES)}
              </p>
            </>
          ) : null}

          {panel === "idle" ? (
            <>
              <p className="intro-line intro-gift">Planlegg neste trekk</p>
              <p className="shop-row-note">
                Klikk en rute for stats og «Go here». Kl{" "}
                {formatHuntClock(clockMinutes)}.
              </p>
            </>
          ) : null}

          {panel === "eat" ? (
            <>
              <p className="intro-line intro-gift">Eat</p>
              <p className="shop-row-note">
                {EAT_ACTION_MINUTES} min per item. Mat fra kit/sekk:
              </p>
              {edible.length === 0 ? (
                <p className="shop-row-note">Ingen spiselig mat i kit.</p>
              ) : (
                <ul className="hunt-eat-list">
                  {edible.map(({ item, qty, stam, canEat }) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="intro-button"
                        disabled={!canEat}
                        onClick={() => eatItem(item.id)}
                      >
                        {item.brand} {item.name} ×{qty}
                        {canEat ? ` · +${stam} stam` : " · krever koking"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="intro-button"
                onClick={() => setPanel("arrived")}
              >
                Tilbake
              </button>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
