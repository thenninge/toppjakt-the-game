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
  canHuntAtTime,
  canWalkAtNight,
  CELL_WIDTH_M,
  clampFatigue,
  describeEffort,
  EAT_ACTION_MINUTES,
  fatigueFromStep,
  formatHuntClock,
  getCellEffort,
  HUNT_DAY_START_MINUTES,
  HUNT_DARK_MINUTES,
  isAtParking,
  isHuntDark,
  isStrandedAtNight,
  minutesUntilDawn,
  pathTravelMinutes,
  REST_ACTION_MINUTES,
  travelMinutesForCell,
  type EffortScore,
} from "@/lib/hunt/travel";
import {
  CAMP_NIGHT_IMAGE,
  FORCED_REST_MINUTES,
  isBakedSpotImage,
  pickEatImage,
  pickSpotImage,
  pickWalkImage,
  REST_TIRED_IMAGE,
  SPOT_TEST_IMAGE,
} from "@/lib/hunt/images";
import {
  getInventoryQty,
  type InventoryEntry,
  type ZeroingProfile,
} from "@/lib/player";
import {
  isAmmoItem,
  isBallisticsItem,
  isCamoItem,
  isFoodItem,
  isLrfItem,
  isMiscItem,
  isThermalItem,
  type ShopItem,
} from "@/lib/shop/types";
import { kitCanBoil, effectiveFoodStamina } from "@/lib/food/spec";
import { isHeadlampMisc } from "@/lib/misc/spec";
import {
  createCarcassFromHarvest,
  speciesLabelNb,
  type BirdHarvestInput,
  type GameCarcass,
} from "@/lib/hunt/carcass";
import { SpotView, type SpotMode } from "@/components/hunt/SpotView";
import { HuntShootView } from "@/components/hunt/HuntShootView";
import { WalkView } from "@/components/hunt/WalkView";
import { AtmospherePauseView } from "@/components/hunt/AtmospherePauseView";
import { AwareAppView, type AwareShootStance } from "@/components/aware/AwareAppView";
import { kitBirdSpotFactor } from "@/lib/camo/spec";
import {
  flushMessage,
  GONE_BIRD_MENTAL_HIT,
  placementsForBirdsInCell,
  resolveFlushesOnPath,
  spawnTiurOnMap,
  spookBird,
  visibleInSpotMode,
  type BirdVisualPlacement,
  type FlushEvent,
  type HuntBird,
} from "@/lib/hunt/birds";
import type { HuntShotResult } from "@/lib/hunt/shoot";
import { lrfOpticalMagnification } from "@/lib/optics/spec";
import { DEFAULT_BINOS_MAGNIFICATION } from "@/lib/hunt/images";
import {
  densityRatioFromTempC,
  exactBallisticHold,
  formatHoldClicks,
  birdMarkerOnAwareMap,
  type BallisticHoldSolution,
} from "@/lib/ballistics/solver";
import { crosswindMs, type DayWeather } from "@/lib/weather/spec";
import type { ShotPair } from "@/lib/aware/types";
import { impactFromShot } from "@/lib/aware/ettersok";
import type { CellPoint } from "@/lib/aware/cellGeometry";

export type HuntHudStatus = {
  clockMinutes: number;
  isDark: boolean;
  /** Remaining mental stamina 0–1 (1 = fresh). */
  mentalStamina: number;
  /** Remaining physical stamina 0–1 (1 = fresh). */
  physicalStamina: number;
};

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
  onBirdHarvested: (carcass: GameCarcass) => void;
  carcasses: GameCarcass[];
  onConsumeCarcasses: (carcassIds: string[]) => void;
  onHudChange?: (hud: HuntHudStatus) => void;
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
  ballisticHold: BallisticHoldSolution | null;
  crosswindMs: number;
  densityRatio: number;
  /** Firing bearing toward bird (deg). */
  bearingDeg: number;
  /** Cell-local markers — must match Aware → ettersøk. */
  hunterPos: CellPoint;
  birdPos: CellPoint;
};

type AwareSession = {
  imageSrc: string;
  bird: BirdVisualPlacement;
  trueDistanceM: number;
  measuredDistanceM: number;
  ballisticHold: BallisticHoldSolution | null;
  crosswindMs: number;
  densityRatio: number;
  birdBearingDeg: number;
  hunterPos?: CellPoint;
  birdPos?: CellPoint;
  ettersokPairId?: string | null;
  /**
   * Kill already counted (instant/vital) — Track is only for finding the tree.
   * False/undefined = wounded ettersøk; harvest on found.
   */
  recoveryOnly?: boolean;
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

type ForcedCampPrompt = {
  imageSrc: string;
};

type CampOvernightSession = {
  imageSrc: string;
  durationMinutes: number;
  subtitle: string;
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Stamina left (100% = fresh, 0% = exhausted / «på null»). */
function staminaLeft(fatigue: number): number {
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
  onBirdHarvested,
  carcasses,
  onConsumeCarcasses,
  onHudChange,
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
    "Du er på parkeringsplassen. Klokka er 08:00 — skuddlys.",
  );
  const [walkSession, setWalkSession] = useState<WalkSession | null>(null);
  const [spotSession, setSpotSession] = useState<SpotSession | null>(null);
  const [shootSession, setShootSession] = useState<ShootSession | null>(null);
  const [awareSession, setAwareSession] = useState<AwareSession | null>(null);
  const [shotPairs, setShotPairs] = useState<ShotPair[]>([]);
  const [eatSession, setEatSession] = useState<EatSession | null>(null);
  const [forcedRest, setForcedRest] = useState<ForcedRestSession | null>(null);
  const [forcedCamp, setForcedCamp] = useState<ForcedCampPrompt | null>(null);
  const [campOvernight, setCampOvernight] = useState<CampOvernightSession | null>(
    null,
  );
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
  const thermalItem = useMemo(
    () => kitItems.find(isThermalItem) ?? null,
    [kitItems],
  );
  const hasThermal = !!thermalItem;
  const thermalLabel = thermalItem
    ? `${thermalItem.brand} ${thermalItem.name}`
    : null;
  const thermalMagnification = thermalItem?.thermal.magnification ?? 3;
  const thermalPixelFactor = thermalItem?.thermal.pixelFactor ?? 10;
  const thermalLrfSpec = useMemo(() => {
    if (!thermalItem?.thermal.hasIntegratedLrf) return null;
    return {
      rangeErrorPercent: thermalItem.thermal.rangeErrorPercent ?? 2,
    };
  }, [thermalItem]);
  const kestrelItem = useMemo(
    () =>
      kitItems.find(
        (i) => isBallisticsItem(i) && i.ballistics.measuresCrosswind,
      ) ?? null,
    [kitItems],
  );
  /** AB-class meter (Kestrel 5700 Elite) + BDX → exact elev+windage fasit. */
  const abMeterItem = useMemo(
    () =>
      kitItems.find(
        (i) =>
          isBallisticsItem(i) &&
          i.ballistics.measuresCrosswind &&
          !!i.ballistics.solver,
      ) ?? null,
    [kitItems],
  );
  /** BDX/AB + local AB meter → exact range and holds from perfect zero. */
  const hasExactBallistics = !!(
    binoItem?.lrf.hasOnboardBallistics && abMeterItem
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
  const camoBirdSpot = useMemo(
    () =>
      kitBirdSpotFactor(
        kitItems.filter(isCamoItem).map((i) => i.camo),
        false,
      ),
    [kitItems],
  );
  const hasHeadlamp = useMemo(
    () =>
      kitItems.some(
        (i) => isMiscItem(i) && isHeadlampMisc(i.misc),
      ),
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
    setAwareSession(null);
    setShotPairs([]);
    setEatSession(null);
    setForcedRest(null);
    setForcedCamp(null);
    setCampOvernight(null);
    setBirds(spawnTiurOnMap(map));
    setFlushQueue([]);
    pendingForcedRestRef.current = false;
    setLog("Du er på parkeringsplassen. Klokka er 08:00 — skuddlys.");
  }, [terrainId, map]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === "Escape" &&
        !spotSession &&
        !shootSession &&
        !awareSession &&
        !walkSession &&
        !eatSession &&
        !forcedRest &&
        !forcedCamp &&
        !campOvernight &&
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
    awareSession,
    walkSession,
    eatSession,
    forcedRest,
    forcedCamp,
    campOvernight,
    flushCurrent,
  ]);

  function triggerStrandedCamp(reason: string) {
    setSpotSession(null);
    setAwareSession(null);
    setShootSession(null);
    setSelected(null);
    setPanel("arrived");
    setForcedCamp({ imageSrc: CAMP_NIGHT_IMAGE });
    setLog(reason);
  }

  useEffect(() => {
    if (!map || walkSession || forcedCamp || campOvernight || flushCurrent) return;
    const atParking = isAtParking(pos, map);
    if (!isStrandedAtNight(clockMinutes, hasHeadlamp, atParking)) return;
    triggerStrandedCamp(
      "Mørket — uten hodelykt må du campe. Spis fuglene dine og legg deg.",
    );
  }, [
    clockMinutes,
    hasHeadlamp,
    pos,
    map,
    walkSession,
    forcedCamp,
    campOvernight,
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

  useEffect(() => {
    onHudChange?.({
      clockMinutes,
      isDark: isHuntDark(clockMinutes),
      mentalStamina: staminaLeft(mentalFatigue),
      physicalStamina: staminaLeft(physicalFatigue),
    });
  }, [
    clockMinutes,
    mentalFatigue,
    physicalFatigue,
    onHudChange,
  ]);

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
  const huntingAllowed = canHuntAtTime(clockMinutes);
  const atParking = isAtParking(pos, activeMap);
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
      forcedCamp ||
      campOvernight ||
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

    const destAtParking = isAtParking(selected, activeMap);
    const arrivalMin = clockMinutes + trip.minutes;
    if (!canWalkAtNight(hasHeadlamp, clockMinutes)) {
      setLog("For mørkt å gå uten hodelykt. Camp her eller kom deg til bilen.");
      return;
    }
    if (
      !hasHeadlamp &&
      isHuntDark(arrivalMin) &&
      !destAtParking
    ) {
      setLog(
        "Turen tar for lang tid — uten hodelykt må du være ved bilen før 17:00.",
      );
      return;
    }

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
      (nowDark ? " Det er mørkt — skuddlys er over." : "");

    setWalkSession(null);

    if (
      isStrandedAtNight(
        Math.floor(clockSecondsRef.current / 60),
        hasHeadlamp,
        isAtParking(walkSession.to, activeMap),
      )
    ) {
      triggerStrandedCamp(
        "Du kom ikke til bilen før mørket. Uten hodelykt må du campe her.",
      );
      return;
    }

    if (flush.events.length > 0) {
      pendingForcedRestRef.current = nextFatigue.physical >= 1;
      const goneHits = flush.events.filter((e) => e.gone).length;
      if (goneHits > 0) {
        setMentalFatigue((m) =>
          clampFatigue(m + goneHits * GONE_BIRD_MENTAL_HIT),
        );
      }
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
    if (!canHuntAtTime(clockMinutes)) {
      setLog("Skuddlys over (17:00) — ingen jakt før i morgen.");
      return;
    }
    // Start tile: hand-composited spot_test landscape + same sprite placement
    // as other cells (so perch height / FOV can be judged on this photo).
    const atStart =
      !!map && pos.row === map.start.row && pos.col === map.start.col;
    setSpotSession({
      imageSrc: atStart ? SPOT_TEST_IMAGE : pickSpotImage(),
      birdPlacements: placementsForBirdsInCell(birds, pos),
    });
  }

  function finishSpot(info: { mode: SpotMode; gameSeconds: number }) {
    const lookMin = info.gameSeconds / 60;
    const strain =
      info.mode === "binos" || info.mode === "thermal"
        ? 0.02 * pace.mentalStrain
        : 0.015 * pace.mentalStrain;
    setMentalFatigue((m) => clampFatigue(m + strain * Math.max(1, lookMin)));

    const timeLabel =
      lookMin >= 1
        ? `${lookMin.toFixed(1)} min`
        : `${Math.round(info.gameSeconds)} s`;
    const modeLabel =
      info.mode === "binos"
        ? "Binos"
        : info.mode === "thermal"
          ? "Termisk"
          : "Øyne";
    const imageSrc = spotSession?.imageSrc ?? "";
    const placements = spotSession?.birdPlacements ?? [];
    const bakedNote = isBakedSpotImage(imageSrc)
      ? " [spot_test]"
      : "";

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
        `${modeLabel} (${timeLabel})${bakedNote}: Du ser ${visible.length === 1 ? "en tiur" : `${visible.length} tiurer`} i trærne (${dists}).`,
      );
    } else if (hiddenFar.length > 0) {
      setLog(
        `${modeLabel} (${timeLabel})${bakedNote}: Ingen fugl synlig med øynene. Prøv kikkert — det kan være noe lenger unna.`,
      );
    } else {
      setLog(
        `${modeLabel} (${timeLabel})${bakedNote}: Ingen fugl i denne ruta.`,
      );
    }
    setSpotSession(null);
    setPanel("arrived");
  }

  function onBirdObserved(info: {
    placement: BirdVisualPlacement;
    measuredDistanceM: number;
    gameSeconds: number;
  }) {
    if (!canHuntAtTime(clockMinutes)) {
      setSpotSession(null);
      setLog("Skuddlys over — du rekker ikke å gå til skudd nå.");
      setPanel("arrived");
      return;
    }
    const imageSrc = spotSession?.imageSrc ?? pickSpotImage();
    const lookMin = info.gameSeconds / 60;
    setMentalFatigue((m) =>
      clampFatigue(m + 0.02 * pace.mentalStrain * Math.max(1, lookMin)),
    );
    const trueDist = info.placement.distanceM;
    const measured = hasExactBallistics
      ? Math.round(trueDist)
      : info.measuredDistanceM;
    // Random shot direction for this contact (LRF gives distance only).
    const birdBearing = Math.random() * 360;
    const cw = crosswindMs(
      weather.live.windSpeedMs,
      weather.live.windFromDeg,
      birdBearing,
    );
    const density = densityRatioFromTempC(weather.live.temperatureC);
    let hold: BallisticHoldSolution | null = null;
    if (hasExactBallistics && primaryAmmo) {
      hold = exactBallisticHold(primaryAmmo.ammo, measured, cw, {
        densityRatio: density,
      });
    }

    setSpotSession(null);
    setAwareSession({
      imageSrc,
      bird: info.placement,
      trueDistanceM: trueDist,
      measuredDistanceM: measured,
      ballisticHold: hold,
      crosswindMs: cw,
      birdBearingDeg: birdBearing,
      densityRatio: density,
      hunterPos: { x: 50, y: 50 },
      birdPos: birdMarkerOnAwareMap(measured, birdBearing),
    });
    setLog(
      hold
        ? `LRF ${measured} m — fugl merket i Aware (${Math.round(birdBearing)}°). Kestrel fasit: ${formatHoldClicks(hold)}.`
        : `LRF ${measured} m — fugl merket i Aware (${Math.round(birdBearing)}°). Sjekk bakgrunn og vind.`,
    );
  }

  function abortAware() {
    setAwareSession(null);
    setLog("Du lukker Aware. Fuglen er fortsatt der.");
    setPanel("arrived");
  }

  function proceedFromAware(stance?: AwareShootStance) {
    if (!awareSession) return;
    if (!canHuntAtTime(clockMinutes)) {
      setAwareSession(null);
      setLog("Skuddlys over (17:00) — ingen skudd i mørket.");
      setPanel("arrived");
      return;
    }
    if (awareSession.ettersokPairId) {
      const pair = shotPairs.find((p) => p.id === awareSession.ettersokPairId);
      const recoveryOnly = !!awareSession.recoveryOnly;
      if (pair?.found === true) {
        if (!recoveryOnly && pair.harvestDraft) {
          onBirdHarvested(createCarcassFromHarvest(pair.harvestDraft));
        }
        setLog(
          recoveryOnly
            ? "Fugl hentet ved treet. Skuddpar beholdt — nyttig når flere fugler er skutt."
            : "Ettersøk lyktes — fuglen er din. Skuddpar lagret i Aware Track.",
        );
      } else if (pair?.found === false) {
        setLog(
          recoveryOnly
            ? "Du fant ikke treet. Skuddparet er lagret — åpne Track senere."
            : "Ettersøk mislyktes — fuglen er tapt. Sporene er logget.",
        );
      } else {
        setLog(
          recoveryOnly
            ? "Skuddpar lagret. Husk å hente fuglen ved treet (Track)."
            : "Du avslutter ettersøk uten søk. Fuglen er trolig tapt.",
        );
      }
      setAwareSession(null);
      setPanel("arrived");
      return;
    }
    const session = awareSession;
    const bearingDeg = stance?.bearingDeg ?? session.birdBearingDeg;
    const distanceM = Math.max(
      40,
      Math.round(stance?.distanceM ?? session.measuredDistanceM),
    );
    const cw = crosswindMs(
      weather.live.windSpeedMs,
      weather.live.windFromDeg,
      bearingDeg,
    );
    const density = densityRatioFromTempC(weather.live.temperatureC);
    let hold = session.ballisticHold;
    if (hasExactBallistics && primaryAmmo) {
      hold = exactBallisticHold(primaryAmmo.ammo, distanceM, cw, {
        densityRatio: density,
      });
    }
    setAwareSession(null);
    setShootSession({
      imageSrc: session.imageSrc,
      bird: {
        ...session.bird,
        distanceM,
      },
      trueDistanceM: distanceM,
      measuredDistanceM: distanceM,
      ballisticHold: hold,
      crosswindMs: cw,
      densityRatio: density,
      bearingDeg,
      hunterPos: stance?.hunter ?? session.hunterPos ?? { x: 50, y: 50 },
      birdPos: stance?.bird ?? session.birdPos ?? birdMarkerOnAwareMap(distanceM, bearingDeg),
    });
    setLog(
      hold
        ? `Bakgrunn OK · Kestrel dialt inn ${formatHoldClicks(hold)} · ${Math.round(bearingDeg)}° · ${distanceM} m · cw ${cw.toFixed(1)} m/s`
        : `Bakgrunn OK · skyteretning ${Math.round(bearingDeg)}° · ${distanceM} m · crosswind ${cw.toFixed(1)} m/s — skru elev + windage!`,
    );
  }

  function onAwareBirdFlushed(_nervousness: number) {
    if (!awareSession || !map) return;
    const id = awareSession.bird.birdId;
    const result = spookBird(birds, id, map);
    setBirds(result.birds);
    setAwareSession(null);
    if (!result.event) {
      setPanel("arrived");
      return;
    }
    if (result.event.gone) {
      setMentalFatigue((m) => clampFatigue(m + GONE_BIRD_MENTAL_HIT));
    }
    setFlushQueue([result.event]);
    setLog(flushMessage(result.event));
  }

  function abortShoot() {
    setShootSession(null);
    setLog("Du senker våpenet. Fuglen er fortsatt der.");
    setPanel("arrived");
  }

  function onHuntShotResult(result: HuntShotResult) {
    if (!shootSession || !map) return;
    const id = shootSession.bird.birdId;
    const dist = result.measuredDistanceM;
    const stand = shootSession.hunterPos;
    // True bird marker from Aware — keep continuity into ettersøk.
    // Soft hits: slight scatter so søk isn't pixel-perfect.
    const birdPos = shootSession.birdPos;
    const impact =
      result.kind === "miss"
        ? impactFromShot({
            stand,
            bearingDeg: shootSession.bearingDeg,
            distanceM: result.trueDistanceM,
          })
        : result.kind === "ettersok"
          ? {
              x: Math.max(
                2,
                Math.min(98, birdPos.x + (Math.random() - 0.5) * 4),
              ),
              y: Math.max(
                2,
                Math.min(98, birdPos.y + (Math.random() - 0.5) * 4),
              ),
            }
          : birdPos;
    const harvestDraft: BirdHarvestInput = {
      birdId: id,
      species: shootSession.bird.species,
      zone: result.zone,
      damageFactor: result.damageFactor ?? 0.5,
      distanceM: result.trueDistanceM,
      impactVelocityMps: result.impactVelocityMps ?? 550,
      ammoId: result.ammoId,
      ammoLabel: result.ammoLabel,
      caliber: result.caliber,
      projectileType: result.projectileType,
      v0: result.v0,
    };
    const pair: ShotPair = {
      id: `pair-${Date.now()}`,
      atMs: Date.now(),
      cell: { ...pos },
      cellLabel: cellLabel(pos),
      stand,
      impact,
      distanceM: Math.round(result.trueDistanceM),
      bearingDeg: shootSession.bearingDeg,
      resultKind: result.kind,
      trackPoints: [],
      found: null,
      harvestDraft,
    };
    setShotPairs((prev) => [pair, ...prev]);

    // Always open Aware Track with skuddpar — even instant kill:
    // hard to find the right tree, especially with several birds.
    if (
      result.kind === "instant_kill" ||
      result.kind === "vital_kill" ||
      result.kind === "ettersok"
    ) {
      setBirds((prev) => prev.filter((b) => b.id !== id));
      const recoveryOnly =
        result.kind === "instant_kill" || result.kind === "vital_kill";
      if (recoveryOnly) {
        onBirdHarvested(createCarcassFromHarvest(harvestDraft));
      }
      setShootSession(null);
      setAwareSession({
        imageSrc: shootSession.imageSrc,
        bird: shootSession.bird,
        trueDistanceM: shootSession.trueDistanceM,
        measuredDistanceM: shootSession.measuredDistanceM,
        ballisticHold: shootSession.ballisticHold,
        crosswindMs: shootSession.crosswindMs,
        densityRatio: shootSession.densityRatio,
        birdBearingDeg: shootSession.bearingDeg,
        hunterPos: stand,
        birdPos: impact,
        ettersokPairId: pair.id,
        recoveryOnly,
      });
      setLog(
        result.kind === "instant_kill"
          ? `Instant kill på ${dist} m — skuddpar lagret. Finn treet i Track.`
          : result.kind === "vital_kill"
            ? `Vitalt treff på ${dist} m — skuddpar lagret. Finn treet i Track.`
            : `Treff — ettersøk! Aware Track åpnet med stand/fugl-posisjon.`,
      );
      return;
    }

    setLog(
      `Bom på ${dist} m. Skuddpar logget (stand + estimat). Åpne Shoot/Track ved behov.`,
    );
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

  function beginCampOvernight() {
    const ids = carcasses.map((c) => c.id);
    const ateCount = ids.length;
    if (ateCount > 0) {
      onConsumeCarcasses(ids);
    }
    const subtitle =
      ateCount > 0
        ? `Du spiste ${ateCount} ${ateCount === 1 ? "fugl" : "fugler"} fra sekken — ikke noe å selge på Vebjørn i morgen.`
        : "Tom sekk — sulten natt under stjernene.";
    const duration = Math.max(1, minutesUntilDawn(clockMinutes));
    setForcedCamp(null);
    setCampOvernight({
      imageSrc: CAMP_NIGHT_IMAGE,
      durationMinutes: duration,
      subtitle,
    });
  }

  function finishCampOvernight() {
    if (!campOvernight) return;
    const session = campOvernight;
    advanceClockMinutes(session.durationMinutes);
    setPhysicalFatigue((p) => clampFatigue(p - 0.35));
    setMentalFatigue((m) => clampFatigue(m - 0.2));
    const mins = Math.floor(clockSecondsRef.current / 60);
    setLog(
      `Morgen — kl ${formatHuntClock(mins)}. Skuddlys igjen til 17:00. Kom deg til bilen før mørket.`,
    );
    setCampOvernight(null);
    setForcedCamp(null);
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
        holdMs={5000}
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

  if (forcedCamp) {
    return (
      <div
        className="walk-view"
        role="dialog"
        aria-modal="true"
        aria-label="Tvungen camp"
      >
        <div className="walk-view-frame">
          <img
            src={forcedCamp.imageSrc}
            alt=""
            className="walk-view-img"
            draggable={false}
          />
          <div className="walk-view-veil" aria-hidden />
          <div className="walk-view-copy">
            <p className="intro-line intro-gift">Camp — mørkt ute</p>
            <p className="intro-line">
              Uten hodelykt kommer du ikke videre. Du må spise det du har med av
              fugl og legge deg til morgenen.
            </p>
            {carcasses.length > 0 ? (
              <ul className="hunt-eat-list">
                {carcasses.map((c) => (
                  <li key={c.id} className="shop-row-note">
                    {speciesLabelNb(c.species)} · {formatHuntClock(clockMinutes)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="shop-row-note">Ingen fugl i sekken — sulten natt.</p>
            )}
            <button
              type="button"
              className="intro-button"
              onClick={beginCampOvernight}
            >
              Spis fuglene og legg deg
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (campOvernight) {
    return (
      <AtmospherePauseView
        imageSrc={campOvernight.imageSrc}
        title="Camping under stjernene"
        subtitle={campOvernight.subtitle}
        durationMinutes={campOvernight.durationMinutes}
        clockMinutes={clockMinutes}
        onContinue={finishCampOvernight}
        ariaLabel="Camp over natten"
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
        densityRatio={shootSession.densityRatio}
        shotBearingDeg={shootSession.bearingDeg}
        windFromDeg={weather.live.windFromDeg}
        windSpeedMs={weather.live.windSpeedMs}
        clockMinutes={clockMinutes}
        kitItems={kitItems}
        inventory={inventory}
        ammoAffinities={ammoAffinities}
        zeroingProfiles={zeroingProfiles}
        musicEnabled={musicEnabled}
        physicalFatigue={physicalFatigue}
        mentalFatigue={mentalFatigue}
        onAffinitiesChange={onAffinitiesChange}
        onConsumeAmmo={onConsumeAmmo}
        onEnsureZeroing={onEnsureZeroing}
        onAbort={abortShoot}
        onShotResult={onHuntShotResult}
      />
    );
  }

  if (awareSession && map) {
    return (
      <AwareAppView
        map={map}
        cell={pos}
        birdDistanceM={awareSession.measuredDistanceM}
        birdBearingDeg={awareSession.birdBearingDeg}
        initialHunter={awareSession.hunterPos ?? null}
        initialBird={awareSession.birdPos ?? null}
        weather={weather}
        camoBirdSpot={camoBirdSpot}
        hasLrf={hasBinos}
        ammo={primaryAmmo?.ammo ?? null}
        hasKestrel={!!kestrelItem}
        hasBdx={!!binoItem?.lrf.hasOnboardBallistics}
        clockMinutes={clockMinutes}
        shotPairs={shotPairs}
        focusPairId={awareSession.ettersokPairId ?? null}
        onShotPairsChange={setShotPairs}
        onGameSeconds={addGameSeconds}
        onProceedToShoot={proceedFromAware}
        onBirdFlushed={onAwareBirdFlushed}
        onAbort={abortAware}
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
        thermalMagnification={thermalMagnification}
        thermalPixelFactor={thermalPixelFactor}
        thermalLrfSpec={thermalLrfSpec}
        clockMinutes={clockMinutes}
        hasBinos={hasBinos}
        hasThermal={hasThermal}
        hasLrf={hasBinos}
        binosLabel={binosLabel}
        thermalLabel={thermalLabel}
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
            {dark ? " · mørkt (skuddlys slutt 17:00)" : " · skuddlys til 17:00"}
            {" · "}
            Rute {cellLabel(pos)} · Effort {hereEffort}/5
            {" · "}
            Mental {pct(staminaLeft(mentalFatigue))} · Fysisk{" "}
            {pct(staminaLeft(physicalFatigue))}
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

              {!hasHeadlamp && inspectTrip ? (
                <p className="shop-row-note">
                  Uten hodelykt: vær ved bilen før{" "}
                  {formatHuntClock(HUNT_DARK_MINUTES)} — ellers camp ute og spis
                  fuglene dine.
                </p>
              ) : null}

              <div className="hunt-side-actions">
                <button
                  type="button"
                  className="intro-button"
                  onClick={goHere}
                  disabled={
                    !canWalkAtNight(hasHeadlamp, clockMinutes) ||
                    (!hasHeadlamp &&
                      inspectTrip != null &&
                      isHuntDark(clockMinutes + inspectTrip.minutes) &&
                      selected != null &&
                      !isAtParking(selected, map))
                  }
                >
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
                  disabled={!huntingAllowed}
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
                {!huntingAllowed ? " · skuddlys over" : ""}
                {hasHeadlamp ? " · hodelykt i kit" : " · ingen hodelykt"}
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
