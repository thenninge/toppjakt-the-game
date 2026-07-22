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
  tiurSpawnCountForTerrain,
} from "@/lib/hunt/terrain";
import { getHuntPace, HUNT_PACES, type HuntPaceId, EXTREME_CAUTION_PRESPOT_CHANCE } from "@/lib/hunt/pace";
import {
  baseMinutesForEffort,
  canHuntAtTime,
  canWalkAtNight,
  CELL_WIDTH_M,
  clampFatigue,
  describeEffort,
  estimatedBirdChancePct,
  describeBirdChance,
  fatigueFromStep,
  formatHuntClock,
  getCellEffort,
  HUNT_DAY_START_MINUTES,
  HUNT_DARK_MINUTES,
  isAtParking,
  isHuntDark,
  missedCarByMidnight,
  minutesUntilDawn,
  pathTravelMinutes,
  travelMinutesForCell,
  type EffortScore,
} from "@/lib/hunt/travel";
import {
  ENDEX_SUNSET_IMAGE,
  FORCED_REST_MINUTES,
  isBakedSpotImage,
  pickEatImage,
  pickFireImage,
  pickFunnImage,
  pickPrespottedImage,
  pickSpotImage,
  pickWalkImage,
  REST_TIRED_IMAGE,
} from "@/lib/hunt/images";
import { getCellSeatCounts } from "@/lib/hunt/mapPlacements";
import { spotImagesWithPerches } from "@/lib/hunt/spotPerches";
import {
  getInventoryQty,
  type DopeCardEntry,
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
import {
  COFFEE_RECOVERY,
  SHORT_REST_RECOVERY,
  THERMOS_ITEM_ID,
  TYRIBAL_RECOVERY,
  effectiveFoodRecovery,
  formatStaminaPct,
  kitCanBoil,
} from "@/lib/food/spec";
import { isCamcorderMisc, isHeadlampMisc } from "@/lib/misc/spec";
import {
  createCarcassFromHarvest,
  formatWeightKg as formatCarcassWeightKg,
  speciesLabelNb,
  type BirdHarvestInput,
  type GameCarcass,
} from "@/lib/hunt/carcass";
import { computePackLoad } from "@/lib/kit/pack";
import { formatWeightKg } from "@/lib/shop/weights";
import { SpotView, type SpotMode } from "@/components/hunt/SpotView";
import { HuntShootView } from "@/components/hunt/HuntShootView";
import { HuntShotAarView } from "@/components/hunt/HuntShotAarView";
import { WalkView } from "@/components/hunt/WalkView";
import { AtmospherePauseView } from "@/components/hunt/AtmospherePauseView";
import { ShotVideoView } from "@/components/hunt/ShotVideoView";
import { AwareAppView, type AwareShootStance } from "@/components/aware/AwareAppView";
import { kitBirdSpotFactor } from "@/lib/camo/spec";
import {
  EMPTY_CUSTOMS_MODS,
  applyCustomCamoBirdSpot,
  customsBeddingMoaDelta,
  type CustomsMods,
} from "@/lib/customs/spec";
import {
  applyPostShotBirdFlush,
  bindBirdsToSpotImage,
  birdsInCell,
  flushAllBirdsFromCell,
  flushDirectionHeadline,
  flushMessage,
  GONE_BIRD_MENTAL_HIT,
  panToCenterOnBird,
  pickFluktImage,
  resolveFlushesOnPath,
  spawnTiurOnMap,
  spookBird,
  visibleInSpotMode,
  type BirdVisualPlacement,
  type FlushEvent,
  type HuntBird,
} from "@/lib/hunt/birds";
import { getBirdSprite } from "@/lib/hunt/birdSprites";
import {
  CAMCORDER_ITEM_ID,
  TRIGGERCAM_ITEM_ID,
  type HuntShotResult,
} from "@/lib/hunt/shoot";
import { bearingFromSpotFrame } from "@/lib/hunt/spotCompass";
import { pickShotVideoForResult } from "@/lib/hunt/vids";
import { lrfOpticalMagnification } from "@/lib/optics/spec";
import {
  DEFAULT_BINOS_MAGNIFICATION,
  SPOT_TIME_FACTOR_THERMAL,
  THERMAL_BATTERY_GAME_MINUTES,
} from "@/lib/hunt/images";
import {
  densityRatioFromTempC,
  exactBallisticHold,
  formatHoldClicks,
  birdMarkerOnAwareMap,
  type BallisticHoldSolution,
} from "@/lib/ballistics/solver";
import { crosswindMs, type DayWeather } from "@/lib/weather/spec";
import {
  ENCOUNTER_NERVE,
  initialEncounterNerve,
  tickEncounterNerve,
} from "@/lib/game/nervousness";
import type { ShotHitFasit, ShotPair } from "@/lib/aware/types";
import { caliberBulletDiameterMm } from "@/lib/range/precision";
import {
  estimateVisibleShotPair,
  generateFleeObservation,
  impactFromShot,
  SHOT_PAIR_MANUAL_DEFAULT_BEARING_DEG,
  SHOT_PAIR_MANUAL_DEFAULT_DISTANCE_M,
} from "@/lib/aware/ettersok";
import {
  clearShotPairsStorage,
  loadShotPairsForHuntStart,
  saveShotPairsForTerrain,
} from "@/lib/aware/shotPairStorage";
import type { CellPoint } from "@/lib/aware/cellGeometry";

export type HuntHudStatus = {
  clockMinutes: number;
  isDark: boolean;
  /** Remaining mental stamina 0–1 (1 = fresh). */
  mentalStamina: number;
  /** Remaining physical stamina 0–1 (1 = fresh). */
  physicalStamina: number;
  /**
   * Remaining thermal battery 0–1 (1 = full).
   * Null when kit has no thermal.
   */
  thermalBattery: number | null;
  /**
   * Live bird nerve 0–1 (1 = flush) after LRF/click lock.
   * Null when no active bird encounter.
   */
  birdNerve: number | null;
};

type HuntMapViewProps = {
  terrainId: string;
  kitItems: ShopItem[];
  inventory: InventoryEntry[];
  ammoAffinities: Record<string, number>;
  zeroingProfiles: Record<string, ZeroingProfile>;
  dopeCard?: DopeCardEntry[];
  customsMods?: CustomsMods;
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
  /**
   * Called when the hunter camps overnight. Consumes one jaktkort day.
   * Return false if the permit is used up (hunt should end).
   */
  onCampOvernight?: () => boolean;
  onLeave: (opts?: { skipJaktkortConsume?: boolean }) => void;
};

type PanelMode = "idle" | "inspect" | "arrived" | "eat" | "study";

type WalkSession = {
  imageSrc: string;
  from: HuntGridCell;
  to: HuntGridCell;
  minutes: number;
  path: HuntGridCell[];
  paceId: HuntPaceId;
};

type SpotCellLayout = {
  imageSrc: string;
  placements: BirdVisualPlacement[];
  /**
   * Compass degrees the landscape faces (0 = N). Sticky with the photo
   * so spotting → Aware / ettersøk share the same general direction.
   */
  viewBearingDeg: number;
};

/** Roll a stable 8-wind view bearing for a new spot landscape. */
function rollSpotViewBearingDeg(random: () => number = Math.random): number {
  return Math.floor(random() * 8) * 45;
}

/** Live-bird nerve — may run hidden in Spot before discovery. */
type BirdEncounter = {
  birdId: string;
  distanceM: number;
  /** Raw nerve 0–cap (HUD shows nerve / flushThreshold when discovered). */
  nerve: number;
  /** False until LRF/click lock — BIRD bar stays hidden. */
  discovered: boolean;
};

type LatentSpotNerve = {
  distanceM: number;
  nerve: number;
};

/** Aware-map seat for a live bird — sticky until spook / end hunt. */
type BirdMapContact = {
  bearingDeg: number;
  birdPos: CellPoint;
};

type SpotSession = {
  imageSrc: string;
  birdPlacements: BirdVisualPlacement[];
  /** Landscape facing — shown on the spotting compass. */
  viewBearingDeg: number;
  /** Extreme-caution auto-spot: open in binos on the bird. */
  initialMode?: SpotMode;
  initialPan?: { x: number; y: number };
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
  /** Camcorder was deployed in Aware before this shot. */
  camcorderActive?: boolean;
  /** Where the displayed range came from. */
  rangeSource: "lrf" | "estimated";
  /** Bird nerve carried from Aware (distance/move/cam already baked in). */
  birdNerve: number;
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
  /** LRF lock vs eyes estimate for this contact. */
  rangeSource: "lrf" | "estimated";
  ettersokPairId?: string | null;
  /**
   * Kill already counted (instant/vital) — Track is only for finding the tree.
   * False/undefined = wounded ettersøk; harvest on found.
   */
  recoveryOnly?: boolean;
  /** Nerve to restore when returning from shoot (Back to Aware). */
  returnNerve?: number;
  /** Camcorder was already deployed this encounter. */
  returnCamcorderActive?: boolean;
};

type EatSession = {
  imageSrc: string;
  /** Inventory item to consume, or null for coffee / tyribål. */
  itemId: string | null;
  label: string;
  bodyGain: number;
  mindGain: number;
  mindToFull?: boolean;
  minutes: number;
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

/** After kill / ettersøk: choose spotting vs Track before Aware opens. */
type PendingPostShot = {
  /** Null when bird was lost (no skuddpar). */
  aware: AwareSession | null;
  stayedCount: number;
  flushedCount: number;
  resultKind: HuntShotResult["kind"];
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Stamina left (100% = fresh, 0% = exhausted / «på null»). */
function staminaLeft(fatigue: number): number {
  return clampFatigue(1 - fatigue);
}

/** Keep 70% of current mental stamina (= 30% setback). */
const ETTERSOK_ABANDON_MENTAL_KEEP = 0.7;

function birdNameNb(species: string | undefined): string {
  return species === "orrhane" ? "orrhane" : "tiur";
}

export function HuntMapView({
  terrainId,
  kitItems,
  inventory,
  ammoAffinities,
  zeroingProfiles,
  dopeCard = [],
  customsMods = EMPTY_CUSTOMS_MODS,
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
  onCampOvernight,
  onLeave,
}: HuntMapViewProps) {
  const terrain = getHuntingTerrain(terrainId);
  const map = terrain ? getHuntMap(terrain.mapId) : null;
  const tiurSpawnCount = terrain ? tiurSpawnCountForTerrain(terrain) : 20;

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
  /** Spot image + bird seats sticky per cell for this hunt (until spooked / end hunt). */
  const [spotLayoutByCell, setSpotLayoutByCell] = useState<
    Record<string, SpotCellLayout>
  >({});
  /** Aware map bearing/pos sticky per birdId until spooked. */
  const [birdMapContacts, setBirdMapContacts] = useState<
    Record<string, BirdMapContact>
  >({});
  /** Live bird encounter for HUD BIRD bar + background nerve tick. */
  const [birdEncounter, setBirdEncounter] = useState<BirdEncounter | null>(
    null,
  );
  const birdEncounterRef = useRef<BirdEncounter | null>(null);
  birdEncounterRef.current = birdEncounter;
  /** Per-bird nerve while spotting (before/without discovery). */
  const latentSpotNerveRef = useRef<Record<string, LatentSpotNerve>>({});
  const [shootSession, setShootSession] = useState<ShootSession | null>(null);
  const [awareSession, setAwareSession] = useState<AwareSession | null>(null);
  const [shotPairs, setShotPairs] = useState<ShotPair[]>([]);
  /** Hit fasit overlay after finding a dead bird (with or without Triggercam). */
  const [findHitAar, setFindHitAar] = useState<ShotPair | null>(null);
  /** Ettersøk find reveal (funn image) before optional AAR. */
  const [findReveal, setFindReveal] = useState<{
    imageSrc: string;
    pair: ShotPair;
  } | null>(null);
  /** Abandon ettersøk — full-screen pause (same pattern as flukt). */
  const [abandonReveal, setAbandonReveal] = useState<{
    imageSrc: string;
    subtitle: string;
  } | null>(null);
  /** Post-shot kill / hit / miss clip before Aware or map. */
  const [shotVideo, setShotVideo] = useState<{
    videoSrc: string;
    title: string;
    subtitle?: string;
  } | null>(null);
  /** After video: choose «fortsett spotting» vs Track / ettersøk. */
  const [pendingPostShot, setPendingPostShot] =
    useState<PendingPostShot | null>(null);
  const [eatSession, setEatSession] = useState<EatSession | null>(null);
  const [forcedRest, setForcedRest] = useState<ForcedRestSession | null>(null);
  const [forcedCamp, setForcedCamp] = useState<ForcedCampPrompt | null>(null);
  const [campOvernight, setCampOvernight] = useState<CampOvernightSession | null>(
    null,
  );
  /** Skuddlys over — splash once, then race to the car. */
  const [endexReveal, setEndexReveal] = useState(false);
  const endexShownRef = useRef(false);
  /** Missed midnight at the car — lose catch, overnight. */
  const [lostCatchReveal, setLostCatchReveal] = useState(false);
  const midnightHandledRef = useRef(false);
  /** Extreme caution: spotted bird before it spotted you. */
  const [prespotReveal, setPrespotReveal] = useState<{
    imageSrc: string;
    focusBirdId: string;
  } | null>(null);
  const [birds, setBirds] = useState<HuntBird[]>(() =>
    map
      ? spawnTiurOnMap(map, tiurSpawnCount, Math.random, {
          tiurRating: terrain?.tiurRating,
          orrhaneRating: terrain?.orrhaneRating,
        })
      : [],
  );
  const birdsRef = useRef(birds);
  birdsRef.current = birds;
  const [flushQueue, setFlushQueue] = useState<FlushEvent[]>([]);
  const flushCurrent = flushQueue[0] ?? null;
  const pendingForcedRestRef = useRef(false);
  /** Thermal battery remaining as game-seconds (full = THERMAL_BATTERY_GAME_MINUTES). */
  const thermalBatteryMaxGameSec = THERMAL_BATTERY_GAME_MINUTES * 60;
  const [thermalBatteryGameSec, setThermalBatteryGameSec] = useState(
    thermalBatteryMaxGameSec,
  );
  const thermalBatteryGameSecRef = useRef(thermalBatteryGameSec);
  thermalBatteryGameSecRef.current = thermalBatteryGameSec;

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
  const thermalTimeFactor = (() => {
    const raw = thermalItem?.thermal.timeFactor;
    return Number.isFinite(raw) && (raw as number) > 0
      ? (raw as number)
      : SPOT_TIME_FACTOR_THERMAL;
  })();
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
      applyCustomCamoBirdSpot(
        kitBirdSpotFactor(
          kitItems.filter(isCamoItem).map((i) => i.camo),
          false,
        ),
        customsMods,
      ),
    [kitItems, customsMods],
  );
  const customsMoaDelta = customsBeddingMoaDelta(customsMods);
  const hasHeadlamp = useMemo(
    () =>
      kitItems.some(
        (i) => isMiscItem(i) && isHeadlampMisc(i.misc),
      ),
    [kitItems],
  );
  const hasCamcorder = useMemo(
    () =>
      kitItems.some(
        (i) =>
          i.id === CAMCORDER_ITEM_ID ||
          (isMiscItem(i) && isCamcorderMisc(i.misc)),
      ),
    [kitItems],
  );
  const hasTriggercam = useMemo(
    () => kitItems.some((i) => i.id === TRIGGERCAM_ITEM_ID),
    [kitItems],
  );
  const hasSuppressor = useMemo(
    () => kitItems.some((i) => i.category === "suppressor"),
    [kitItems],
  );

  const packLoad = useMemo(
    () =>
      computePackLoad({
        kitItems,
        customsMods,
        carcasses,
      }),
    [kitItems, customsMods, carcasses],
  );

  function syncClockFromRef() {
    const sec = clockSecondsRef.current;
    if (!Number.isFinite(sec)) {
      clockSecondsRef.current = HUNT_DAY_START_MINUTES * 60;
    }
    setClockMinutes(Math.floor(clockSecondsRef.current / 60));
  }

  function advanceClockMinutes(deltaMin: number) {
    if (!Number.isFinite(deltaMin)) return;
    clockSecondsRef.current += deltaMin * 60;
    syncClockFromRef();
  }

  function addGameSeconds(sec: number) {
    if (!Number.isFinite(sec) || sec === 0) return;
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
    setPendingPostShot(null);
    setSpotLayoutByCell({});
    setBirdMapContacts({});
    setBirdEncounter(null);
    latentSpotNerveRef.current = {};
    setShotPairs(loadShotPairsForHuntStart(terrainId));
    setFindHitAar(null);
    setEatSession(null);
    setForcedRest(null);
    setForcedCamp(null);
    setCampOvernight(null);
    setEndexReveal(false);
    endexShownRef.current = false;
    setLostCatchReveal(false);
    midnightHandledRef.current = false;
    setBirds(
      spawnTiurOnMap(map, tiurSpawnCount, Math.random, {
        tiurRating: terrain?.tiurRating,
        orrhaneRating: terrain?.orrhaneRating,
      }),
    );
    setFlushQueue([]);
    pendingForcedRestRef.current = false;
    setLog("Du er på parkeringsplassen. Klokka er 08:00 — skuddlys.");
  }, [terrainId, map, tiurSpawnCount, terrain?.tiurRating, terrain?.orrhaneRating]);

  useEffect(() => {
    saveShotPairsForTerrain(terrainId, shotPairs);
  }, [terrainId, shotPairs]);

  function leaveHunt(opts?: {
    skipJaktkortConsume?: boolean;
    /** Forced exit (e.g. jaktkort brukt opp etter overnatting) — skip parking gate. */
    force?: boolean;
  }) {
    if (!opts?.force && map && !isAtParking(pos, map)) {
      setLog(
        `Du må tilbake til bilen (${cellLabel(map.start)}) for å avslutte jakten.`,
      );
      return;
    }
    // Don't leave found birds in limbo — bag them before clearing skuddpar.
    for (const pair of shotPairs) {
      if (pair.found === true && pair.harvestDraft) {
        onBirdHarvested(createCarcassFromHarvest(pair.harvestDraft));
      }
    }
    clearShotPairsStorage();
    onLeave(opts);
  }

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
        !flushCurrent &&
        !endexReveal &&
        !lostCatchReveal &&
        !prespotReveal
      ) {
        if (map && isAtParking(pos, map)) {
          leaveHunt();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    onLeave,
    map,
    pos,
    spotSession,
    shootSession,
    awareSession,
    walkSession,
    eatSession,
    forcedRest,
    forcedCamp,
    campOvernight,
    flushCurrent,
    endexReveal,
    lostCatchReveal,
    prespotReveal,
  ]);

  function triggerLostCatchOvernight() {
    if (lostCatchReveal || campOvernight) return;
    midnightHandledRef.current = true;
    setSpotSession(null);
    setShootSession(null);
    setAwareSession(null);
    setBirdEncounter(null);
    birdEncounterRef.current = null;
    latentSpotNerveRef.current = {};
    setFlushQueue([]);
    setPendingPostShot(null);
    setEndexReveal(false);
    setForcedCamp(null);
    setSelected(null);
    setPanel("arrived");
    setShotPairs((prev) =>
      prev.map((p) =>
        p.found == null && p.harvestDraft
          ? { ...p, found: false, harvestDraft: undefined }
          : p,
      ),
    );
    setLostCatchReveal(true);
    setLog("Midnatt — du nådde ikke bilen. Fangsten går tapt.");
  }

  /**
   * Skuddlys → mørke: one Endex splash, close spotting/shoot.
   * Without headlamp you may still walk to parking (not elsewhere).
   * No bird-flush theatre after dark.
   */
  useEffect(() => {
    if (!map) return;
    if (!isHuntDark(clockMinutes)) {
      if (canHuntAtTime(clockMinutes)) {
        endexShownRef.current = false;
        midnightHandledRef.current = false;
      }
      return;
    }
    // Close hunt UIs — spotting / shooting ends with skuddlys.
    setSpotSession(null);
    setShootSession(null);
    setBirdEncounter(null);
    birdEncounterRef.current = null;
    setFlushQueue([]);
    setAwareSession((prev) => (prev?.ettersokPairId ? prev : null));

    if (!endexShownRef.current && !forcedCamp && !campOvernight && !walkSession) {
      endexShownRef.current = true;
      setPendingPostShot(null);
      setEndexReveal(true);
      setLog("Skuddlys over — kom deg til bilen før midnatt.");
    }

    if (
      !midnightHandledRef.current &&
      !walkSession &&
      !campOvernight &&
      !lostCatchReveal &&
      !endexReveal &&
      missedCarByMidnight(clockMinutes, isAtParking(pos, map))
    ) {
      triggerLostCatchOvernight();
    }
  }, [
    clockMinutes,
    map,
    pos,
    forcedCamp,
    campOvernight,
    walkSession,
    lostCatchReveal,
    endexReveal,
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

  const hasThermos = useMemo(
    () => kitItems.some((i) => i.id === THERMOS_ITEM_ID),
    [kitItems],
  );

  const edible = useMemo(() => {
    const canBoil = kitCanBoil(
      kitItems.filter(isFoodItem).map((i) => i.food),
    );
    return kitItems
      .filter(isFoodItem)
      .filter((item) => item.food.kind === "meal" || item.food.kind === "ready")
      .map((item) => {
        const qty = getInventoryQty(inventory, item.id);
        const recovery = effectiveFoodRecovery(item.food, canBoil);
        return {
          item,
          qty,
          recovery,
          canEat: qty > 0 && recovery != null,
          needsBoil: item.food.requiresBoil && !canBoil,
        };
      })
      .filter((x) => x.qty > 0);
  }, [kitItems, inventory]);

  useEffect(() => {
    onHudChange?.({
      clockMinutes,
      isDark: isHuntDark(clockMinutes),
      mentalStamina: staminaLeft(mentalFatigue),
      physicalStamina: staminaLeft(physicalFatigue),
      thermalBattery: hasThermal
        ? thermalBatteryMaxGameSec > 0
          ? thermalBatteryGameSec / thermalBatteryMaxGameSec
          : 0
        : null,
      birdNerve:
        birdEncounter?.discovered
          ? Math.min(
              1,
              Math.max(
                0,
                birdEncounter.nerve / ENCOUNTER_NERVE.flushThreshold,
              ),
            )
          : null,
    });
  }, [
    clockMinutes,
    mentalFatigue,
    physicalFatigue,
    thermalBatteryGameSec,
    thermalBatteryMaxGameSec,
    hasThermal,
    birdEncounter,
    onHudChange,
  ]);

  // Spot/map nerve — only during skuddlys (no flush theatre after dark).
  const inAwareOrShoot = !!(awareSession || shootSession);
  const spotOpen = !!spotSession;
  const discoveredActive = !!(birdEncounter?.discovered);
  const skuddlysOpen = canHuntAtTime(clockMinutes);
  useEffect(() => {
    if (!skuddlysOpen || inAwareOrShoot || !map) return;
    if (!spotOpen && !discoveredActive) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const realSec = Math.min(0.5, (now - last) / 1000);
      last = now;
      if (realSec <= 0) return;

      const flushOne = (birdId: string, distanceM: number, nerve: number) => {
        const tick = tickEncounterNerve(nerve, realSec, {
          distanceM,
          isMoving: false,
          moveHoldSec: 0,
          camoBirdSpot,
        });
        if (!tick.flushes) return { nerve: tick.nerve, flushed: false as const };
        const result = spookBird(birdsRef.current, birdId, map);
        setBirds(result.birds);
        setSpotLayoutByCell((prev) => {
          const layouts: Record<string, SpotCellLayout> = {};
          for (const [key, layout] of Object.entries(prev)) {
            layouts[key] = {
              ...layout,
              placements: layout.placements.filter((p) => p.birdId !== birdId),
            };
          }
          return layouts;
        });
        setBirdMapContacts((prev) => {
          if (!(birdId in prev)) return prev;
          const contacts = { ...prev };
          delete contacts[birdId];
          return contacts;
        });
        delete latentSpotNerveRef.current[birdId];
        const enc = birdEncounterRef.current;
        if (enc?.birdId === birdId) {
          birdEncounterRef.current = null;
          setBirdEncounter(null);
        }
        queueNervousFlush(result.event);
        return { nerve: tick.nerve, flushed: true as const };
      };

      if (spotOpen) {
        const latent = latentSpotNerveRef.current;
        const discovered = birdEncounterRef.current;
        for (const birdId of Object.keys(latent)) {
          const entry = latent[birdId]!;
          // Discovered bird is ticked via encounter below when on map; in spot sync both.
          const baseNerve =
            discovered?.birdId === birdId ? discovered.nerve : entry.nerve;
          const outcome = flushOne(birdId, entry.distanceM, baseNerve);
          if (outcome.flushed) return;
          latent[birdId] = { ...entry, nerve: outcome.nerve };
          if (discovered?.birdId === birdId) {
            const next: BirdEncounter = {
              ...discovered,
              nerve: outcome.nerve,
              distanceM: entry.distanceM,
            };
            birdEncounterRef.current = next;
            setBirdEncounter(next);
          }
        }
        return;
      }

      const enc = birdEncounterRef.current;
      if (!enc?.discovered) return;
      const outcome = flushOne(enc.birdId, enc.distanceM, enc.nerve);
      if (outcome.flushed) return;
      const next: BirdEncounter = { ...enc, nerve: outcome.nerve };
      birdEncounterRef.current = next;
      setBirdEncounter(next);
    }, 200);
    return () => window.clearInterval(id);
  }, [inAwareOrShoot, spotOpen, discoveredActive, map, camoBirdSpot, skuddlysOpen]);

  if (!terrain || !map) {
    return (
      <div className="hunt-map">
        <p className="intro-line">Ugyldig jaktterreng.</p>
        <button type="button" className="intro-button" onClick={() => leaveHunt()}>
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
    const loadFactor = packLoad.fatigueLoadFactor;
    for (const cell of path) {
      const effort = getCellEffort(activeMap.id, cell);
      const gain = fatigueFromStep(effort, usedPace, loadFactor);
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

    // Study map: browse cells freely; only «Go back» leaves the mode.
    if (panel === "study") {
      if (cell.row === pos.row && cell.col === pos.col) {
        setSelected(null);
        return;
      }
      setSelected(cell);
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
    if (
      !canWalkAtNight(hasHeadlamp, clockMinutes, {
        destinationIsParking: destAtParking,
      })
    ) {
      setLog(
        "For mørkt uten hodelykt — bare bilen er trygg. Gå til parkeringen, eller camp ute.",
      );
      return;
    }
    if (
      !hasHeadlamp &&
      isHuntDark(arrivalMin) &&
      !destAtParking
    ) {
      setLog(
        "Turen tar for lang tid — uten hodelykt må du være ved bilen før 17:00 (eller gå direkte dit nå).",
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
    const nowMins = Math.floor(clockSecondsRef.current / 60);
    const nowDark = isHuntDark(nowMins);
    const arrivedParking = isAtParking(walkSession.to, activeMap);

    // After skuddlys: no flush events / «fuglen flyr» while racing to the car.
    const flush = nowDark
      ? { birds, events: [] as FlushEvent[] }
      : resolveFlushesOnPath(
          birds,
          walkSession.path,
          walkSession.paceId,
          activeMap,
        );
    setBirds(flush.birds);
    if (flush.events.length > 0) {
      const gone = new Set(flush.events.map((e) => e.birdId));
      setSpotLayoutByCell((prev) => {
        const next: Record<string, SpotCellLayout> = {};
        for (const [key, layout] of Object.entries(prev)) {
          next[key] = {
            ...layout,
            placements: layout.placements.filter((p) => !gone.has(p.birdId)),
          };
        }
        return next;
      });
      setBirdMapContacts((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const rid of gone) {
          if (rid in next) {
            delete next[rid];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }

    const walkLog =
      `Gikk til ${cellLabel(walkSession.to)} på ${walkSession.minutes} min (${usedPace.label}, ${walkSession.path.length} ruter).` +
      (nowDark
        ? arrivedParking
          ? " Mørkt — du nådde bilen. Endex for i dag."
          : " Det er mørkt — skuddlys er over. Rekker du bilen før midnatt?"
        : "");

    setWalkSession(null);

    if (missedCarByMidnight(nowMins, arrivedParking)) {
      triggerLostCatchOvernight();
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
    if (
      !nowDark &&
      walkSession.paceId === "extreme-caution" &&
      hasBinos &&
      Math.random() < EXTREME_CAUTION_PRESPOT_CHANCE
    ) {
      const prepared = prepareSpotAtPos({ birdList: flush.birds });
      if (prepared && prepared.birdPlacements.length > 0) {
        const focus =
          prepared.birdPlacements[
            Math.floor(Math.random() * prepared.birdPlacements.length)
          ]!;
        pendingForcedRestRef.current = nextFatigue.physical >= 1;
        setPrespotReveal({
          imageSrc: pickPrespottedImage(),
          focusBirdId: focus.birdId,
        });
        return;
      }
    }

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

  /**
   * Nerve flush from Spot / Aware / Shoot — always leave encounter UIs and
   * play the «Fuglen flyr» splash with flight direction.
   */
  function queueNervousFlush(event: FlushEvent | null) {
    setSpotSession(null);
    setAwareSession(null);
    setShootSession(null);
    setBirdEncounter(null);
    birdEncounterRef.current = null;
    if (!event) {
      setLog("Fuglen ble for nervøs — den letter.");
      setPanel("arrived");
      return;
    }
    if (event.gone) {
      setMentalFatigue((m) => clampFatigue(m + GONE_BIRD_MENTAL_HIT));
    }
    setFlushQueue([event]);
    setLog(`Fuglen ble for nervøs — ${flushMessage(event)}`);
  }

  function seedLatentSpotNerve(
    placements: BirdVisualPlacement[],
    birdList: HuntBird[],
  ) {
    const next = { ...latentSpotNerveRef.current };
    const present = new Set(placements.map((p) => p.birdId));
    for (const p of placements) {
      const existing = next[p.birdId];
      if (existing) {
        next[p.birdId] = { ...existing, distanceM: p.distanceM };
      } else {
        const spook =
          birdList.find((b) => b.id === p.birdId)?.spookCount ?? 0;
        next[p.birdId] = {
          distanceM: p.distanceM,
          nerve: initialEncounterNerve(spook),
        };
      }
    }
    for (const id of Object.keys(next)) {
      if (present.has(id)) continue;
      const enc = birdEncounterRef.current;
      if (enc?.discovered && enc.birdId === id) continue;
      delete next[id];
    }
    latentSpotNerveRef.current = next;
  }

  /**
   * Bind birds in the current cell to a spot landscape (sticky per cell).
   * Returns null when hunting is closed; otherwise session payload.
   */
  function prepareSpotAtPos(opts?: {
    reuseImageSrc?: string | null;
    birdList?: HuntBird[];
  }): SpotSession | null {
    if (!canHuntAtTime(clockMinutes)) return null;

    const birdList = opts?.birdList ?? birds;
    const cellKey = `${pos.row},${pos.col}`;
    const marked = spotImagesWithPerches();
    const isUsableSpotSrc = (src: string) =>
      marked.length === 0 ||
      marked.includes(src) ||
      src.startsWith("/images/spot/");
    const preferred =
      opts?.reuseImageSrc && isUsableSpotSrc(opts.reuseImageSrc)
        ? opts.reuseImageSrc
        : null;
    const cached = spotLayoutByCell[cellKey];
    const cachedOk =
      cached && isUsableSpotSrc(cached.imageSrc) ? cached : null;
    const imageSrc =
      preferred ??
      cachedOk?.imageSrc ??
      (marked.length > 0
        ? marked[Math.floor(Math.random() * marked.length)]!
        : pickSpotImage());

    const here = birdsInCell(birdList, pos);
    const hereIds = new Set(here.map((b) => b.id));

    if (cachedOk && cachedOk.imageSrc === imageSrc) {
      const sticky = cachedOk.placements.filter((p) => hereIds.has(p.birdId));
      const viewBearingDeg = Number.isFinite(cachedOk.viewBearingDeg)
        ? cachedOk.viewBearingDeg
        : rollSpotViewBearingDeg();
      setSpotLayoutByCell((prev) => ({
        ...prev,
        [cellKey]: { imageSrc, placements: sticky, viewBearingDeg },
      }));
      const syncedBirds = birdList.map((b) => {
        const p = sticky.find((x) => x.birdId === b.id);
        return p ? { ...b, distanceM: p.distanceM } : b;
      });
      setBirds(syncedBirds);
      seedLatentSpotNerve(sticky, syncedBirds);
      return { imageSrc, birdPlacements: sticky, viewBearingDeg };
    }

    const viewBearingDeg = rollSpotViewBearingDeg();
    const bound = bindBirdsToSpotImage(birdList, pos, imageSrc, {
      fillAllPerches: false,
    });
    setSpotLayoutByCell((prev) => ({
      ...prev,
      [cellKey]: { imageSrc, placements: bound.placements, viewBearingDeg },
    }));
    setBirds(bound.birds);
    seedLatentSpotNerve(bound.placements, bound.birds);
    return {
      imageSrc,
      birdPlacements: bound.placements,
      viewBearingDeg,
    };
  }

  function beginSpot(opts?: {
    reuseImageSrc?: string | null;
    initialMode?: SpotMode;
    focusBirdId?: string;
  }) {
    if (!canHuntAtTime(clockMinutes)) {
      setLog("Skuddlys over (17:00) — ingen jakt før i morgen.");
      return;
    }
    const prepared = prepareSpotAtPos({
      reuseImageSrc: opts?.reuseImageSrc,
    });
    if (!prepared) {
      setLog("Skuddlys over (17:00) — ingen jakt før i morgen.");
      return;
    }

    let initialPan: { x: number; y: number } | undefined;
    let initialMode = opts?.initialMode;
    if (opts?.focusBirdId && prepared.birdPlacements.length > 0) {
      const focus =
        prepared.birdPlacements.find((p) => p.birdId === opts.focusBirdId) ??
        prepared.birdPlacements[0]!;
      initialPan = panToCenterOnBird(focus, binosMagnification);
      initialMode = initialMode ?? "binos";
    }

    setSpotSession({
      ...prepared,
      initialMode,
      initialPan,
    });
  }

  function finishPrespotReveal() {
    if (!prespotReveal) return;
    const focusBirdId = prespotReveal.focusBirdId;
    setPrespotReveal(null);
    setLog(
      "Du går forsiktig og observant og ser fuglen før den ser deg — kikkert klar.",
    );
    beginSpot({ initialMode: "binos", focusBirdId });
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
        `${modeLabel} (${timeLabel})${bakedNote}: Ingen fugl synlig med øynene (rød/lilla). Prøv kikkert — det kan være noe lenger unna.`,
      );
    } else {
      setLog(
        `${modeLabel} (${timeLabel})${bakedNote}: Ingen fugl i denne ruta.`,
      );
    }
    setSpotSession(null);
    if (pendingForcedRestRef.current) {
      pendingForcedRestRef.current = false;
      setForcedRest({ imageSrc: REST_TIRED_IMAGE });
    } else {
      setPanel("arrived");
    }
  }

  function onBirdObserved(info: {
    placement: BirdVisualPlacement;
    measuredDistanceM: number;
    gameSeconds: number;
    rangeSource: "lrf" | "estimated";
  }) {
    if (!canHuntAtTime(clockMinutes)) {
      setSpotSession(null);
      setLog("Skuddlys over — du rekker ikke å gå til skudd nå.");
      setPanel("arrived");
      return;
    }
    const forfeitNote = forfeitUncommittedShotPairs();
    const imageSrc = spotSession?.imageSrc ?? pickSpotImage();
    const viewBearingDeg =
      spotSession?.viewBearingDeg ??
      spotLayoutByCell[`${pos.row},${pos.col}`]?.viewBearingDeg ??
      rollSpotViewBearingDeg();
    if (spotSession?.imageSrc) {
      const cellKey = `${pos.row},${pos.col}`;
      setSpotLayoutByCell((prev) => {
        const cur = prev[cellKey];
        if (cur?.imageSrc === spotSession.imageSrc) return prev;
        return {
          ...prev,
          [cellKey]: {
            imageSrc: spotSession.imageSrc,
            placements: spotSession.birdPlacements,
            viewBearingDeg,
          },
        };
      });
    }
    const lookMin = info.gameSeconds / 60;
    setMentalFatigue((m) =>
      clampFatigue(m + 0.02 * pace.mentalStrain * Math.max(1, lookMin)),
    );
    const trueDist = info.placement.distanceM;
    const measured = hasExactBallistics
      ? Math.round(trueDist)
      : info.measuredDistanceM;
    const birdId = info.placement.birdId;
    const prior = birdMapContacts[birdId];
    // Same bird → same Aware-map seat; first lock follows spotting compass + frame X.
    const birdBearing =
      prior?.bearingDeg ??
      bearingFromSpotFrame(viewBearingDeg, info.placement.x);
    const birdPos =
      prior?.birdPos ?? birdMarkerOnAwareMap(measured, birdBearing);
    if (!prior) {
      setBirdMapContacts((prev) => ({
        ...prev,
        [birdId]: { bearingDeg: birdBearing, birdPos },
      }));
    }
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
        powderTempC: weather.live.temperatureC,
      });
    }

    const spooked =
      birds.find((b) => b.id === birdId)?.spookCount ?? 0;
    const activeEnc = birdEncounterRef.current;
    const latent = latentSpotNerveRef.current[birdId];
    const startNerve =
      activeEnc?.birdId === birdId
        ? activeEnc.nerve
        : (latent?.nerve ?? initialEncounterNerve(spooked));
    const enc: BirdEncounter = {
      birdId,
      distanceM: trueDist,
      nerve: startNerve,
      discovered: true,
    };
    birdEncounterRef.current = enc;
    setBirdEncounter(enc);
    latentSpotNerveRef.current[birdId] = {
      distanceM: trueDist,
      nerve: startNerve,
    };

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
      birdPos,
      rangeSource: info.rangeSource,
    });
    setLog(
      (forfeitNote ? `${forfeitNote} ` : "") +
        (info.rangeSource === "lrf"
          ? hold
            ? `LRF ${measured} m — fugl merket i Aware (${Math.round(birdBearing)}°). Kestrel fasit: ${formatHoldClicks(hold)}.`
            : `LRF ${measured} m — fugl merket i Aware (${Math.round(birdBearing)}°). Sjekk bakgrunn og vind.`
          : `Fugl merket i Aware (${Math.round(birdBearing)}° · ca. ${measured} m). Sjekk bakgrunn og vind.`),
    );
  }

  /**
   * Put a found bird in the meat bag. Idempotent — clears harvestDraft so
   * Track / Avbryt / leaveHunt cannot double-harvest or drop the carcass.
   */
  function harvestFoundPair(pair: ShotPair | null | undefined): boolean {
    if (!pair || pair.found !== true) return false;
    const live = shotPairs.find((p) => p.id === pair.id);
    const draft = live?.harvestDraft ?? (!live ? pair.harvestDraft : undefined);
    if (!draft) return false;
    onBirdHarvested(createCarcassFromHarvest(draft));
    setShotPairs((prev) =>
      prev.map((p) =>
        p.id === pair.id ? { ...p, harvestDraft: undefined } : p,
      ),
    );
    return true;
  }

  function abortAware() {
    if (awareSession?.ettersokPairId) {
      const pair = shotPairs.find((p) => p.id === awareSession.ettersokPairId);
      if (pair?.found === true) {
        harvestFoundPair(pair);
        setAwareSession(null);
        setPanel("arrived");
        setLog(
          awareSession.recoveryOnly
            ? "Fugl hentet — i sekken."
            : "Ettersøk lyktes — fuglen er i sekken.",
        );
        return;
      }
      if (!awareSession.recoveryOnly) {
        abandonEttersok(awareSession.ettersokPairId);
        return;
      }
    }
    setAwareSession(null);
    setBirdEncounter(null);
    setLog("Du lukker Aware. Fuglen er fortsatt der.");
    setPanel("arrived");
  }

  /** Leave Aware stalk back to Spot — nerve keeps running. */
  function backToSpotFromAware() {
    if (awareSession?.ettersokPairId) {
      abortAware();
      return;
    }
    setAwareSession(null);
    beginSpot();
    setLog("Tilbake til spotting — fuglen er fortsatt nervøs.");
  }

  /**
   * Give up wounded ettersøk without a find — bird lost, mental stamina −30%.
   * Shows a dedicated pause view (like flukt) so the consequence is not buried in the log.
   */
  function abandonEttersok(pairId: string) {
    const pair = shotPairs.find((p) => p.id === pairId);
    if (pair && pair.found !== true) {
      setShotPairs((prev) =>
        prev.map((p) => (p.id === pairId ? { ...p, found: false } : p)),
      );
      setMentalFatigue((m) =>
        clampFatigue(1 - staminaLeft(m) * ETTERSOK_ABANDON_MENTAL_KEEP),
      );
      const bird = birdNameNb(pair.harvestDraft?.species);
      setAbandonReveal({
        imageSrc: pickFluktImage(),
        subtitle:
          `Fuglen er tapt og det setter deg tilbake mentalt 30 %. ` +
          `Du gir opp søket etter ${bird}.`,
      });
    } else {
      setLog("Ettersøk avsluttet.");
    }
    setAwareSession(null);
    setPanel("arrived");
  }

  function proceedFromAware(stance?: AwareShootStance) {
    if (!awareSession) return;
    // Found birds must bag even after skuddlys — ettersøk often runs past 17:00.
    if (awareSession.ettersokPairId) {
      const pair = shotPairs.find((p) => p.id === awareSession.ettersokPairId);
      if (pair?.found === true) {
        harvestFoundPair(pair);
        setLog(
          awareSession.recoveryOnly
            ? "Fugl hentet ved treet — i sekken."
            : "Ettersøk lyktes — fuglen er i sekken.",
        );
        setAwareSession(null);
        setPanel("arrived");
        return;
      }
      if (awareSession.recoveryOnly) {
        setLog(
          pair?.found === false
            ? "Du fant ikke treet. Skuddparet er lagret — åpne Hent/søk senere."
            : "Skuddpar lagret. Husk å hente fuglen ved treet (Hent/søk).",
        );
        setAwareSession(null);
        setPanel("arrived");
        return;
      }
      // Wounded bird still missing — abandoning ettersøk.
      abandonEttersok(awareSession.ettersokPairId);
      return;
    }
    if (!canHuntAtTime(clockMinutes)) {
      setAwareSession(null);
      setLog("Skuddlys over (17:00) — ingen skudd i mørket.");
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
        powderTempC: weather.live.temperatureC,
      });
    }
    setAwareSession(null);
    const nerve = Math.max(0, stance?.birdNerve ?? birdEncounterRef.current?.nerve ?? 0);
    setBirdEncounter((prev) => {
      const next: BirdEncounter = {
        birdId: session.bird.birdId,
        distanceM,
        nerve,
        discovered: true,
      };
      birdEncounterRef.current = prev
        ? { ...prev, distanceM, nerve, discovered: true }
        : next;
      return birdEncounterRef.current;
    });
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
      camcorderActive: !!stance?.camcorderActive,
      rangeSource: session.rangeSource,
      birdNerve: nerve,
    });
    setLog(
      hold
        ? `Bakgrunn OK · Kestrel dialt inn ${formatHoldClicks(hold)} · ${Math.round(bearingDeg)}° · ${distanceM} m${stance?.camcorderActive ? " · camcorder filmer" : ""}`
        : `Bakgrunn OK · skyteretning ${Math.round(bearingDeg)}° · ${distanceM} m — sjekk vind og skru turrets${stance?.camcorderActive ? " · camcorder filmer" : ""}`,
    );
  }

  function onAwareBirdFlushed(_nervousness: number) {
    if (!awareSession || !map) return;
    const id = awareSession.bird.birdId;
    const result = spookBird(birds, id, map);
    setBirds(result.birds);
    setSpotLayoutByCell((prev) => {
      const next: Record<string, SpotCellLayout> = {};
      for (const [key, layout] of Object.entries(prev)) {
        next[key] = {
          ...layout,
          placements: layout.placements.filter((p) => p.birdId !== id),
        };
      }
      return next;
    });
    setBirdMapContacts((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    queueNervousFlush(result.event);
  }

  function abortShoot() {
    setShootSession(null);
    setBirdEncounter(null);
    setLog("Du senker våpenet. Fuglen er fortsatt der.");
    setPanel("arrived");
  }

  /** Leave shoot HUD back to the same Aware stalk (nerve carried over). */
  function returnToAwareFromShoot(nerve: number) {
    if (!shootSession) return;
    const s = shootSession;
    const nextNerve = Math.min(
      ENCOUNTER_NERVE.nerveCap,
      Math.max(0, nerve),
    );
    setShootSession(null);
    setBirdEncounter((prev) => {
      const next: BirdEncounter = {
        birdId: s.bird.birdId,
        distanceM: s.trueDistanceM,
        nerve: nextNerve,
        discovered: true,
      };
      return prev
        ? { ...prev, distanceM: s.trueDistanceM, nerve: nextNerve, discovered: true }
        : next;
    });
    birdEncounterRef.current = {
      birdId: s.bird.birdId,
      distanceM: s.trueDistanceM,
      nerve: nextNerve,
      discovered: true,
    };
    setAwareSession({
      imageSrc: s.imageSrc,
      bird: s.bird,
      trueDistanceM: s.trueDistanceM,
      measuredDistanceM: s.measuredDistanceM,
      ballisticHold: s.ballisticHold,
      crosswindMs: s.crosswindMs,
      densityRatio: s.densityRatio,
      birdBearingDeg: s.bearingDeg,
      hunterPos: s.hunterPos,
      birdPos: s.birdPos,
      rangeSource: s.rangeSource,
      returnNerve: nextNerve,
      returnCamcorderActive: !!s.camcorderActive,
    });
    setLog("Tilbake til Aware — fuglen er fortsatt der.");
  }

  function openPendingPostShotTrack() {
    if (!pendingPostShot?.aware) return;
    const next = pendingPostShot.aware;
    setPendingPostShot(null);
    setAwareSession(next);
    setPanel("arrived");
  }

  /** Unfinished kill/ettersøk pairs — still need Track (hent / søk). */
  const unfinishedShotPairs = useMemo(
    () =>
      shotPairs.filter(
        (p) =>
          p.found == null &&
          !!p.harvestDraft &&
          (p.resultKind === "instant_kill" ||
            p.resultKind === "vital_kill" ||
            p.resultKind === "ettersok"),
      ),
    [shotPairs],
  );

  function trackLabelForPair(pair: ShotPair): string {
    const bird = birdNameNb(pair.harvestDraft?.species);
    return `Hent/søk · ${pair.cellLabel} (${bird})`;
  }

  /** Re-open Aware Track for a saved skuddpar (after fortsett spotting etc.). */
  function openAwareForPair(pair: ShotPair) {
    const spriteId = pair.hitFasit?.birdSpriteId ?? "tiur-1";
    const sprite = getBirdSprite(spriteId);
    const species = pair.harvestDraft?.species ?? sprite.species;
    const recoveryOnly =
      pair.resultKind === "instant_kill" || pair.resultKind === "vital_kill";
    setPendingPostShot(null);
    setBirdEncounter(null);
    if (pair.cell.row !== pos.row || pair.cell.col !== pos.col) {
      setPos({ ...pair.cell });
      setLog(`Du går til ${pair.cellLabel} for å hente/søke etter fuglen.`);
    }
    setAwareSession({
      imageSrc: sprite.toppSrc,
      bird: {
        birdId: pair.harvestDraft?.birdId ?? pair.id,
        species,
        spriteId,
        imageSrc: sprite.toppSrc,
        distanceM: pair.distanceM,
        x: 50,
        y: 50,
        widthPct: 8,
        flip: !!pair.hitFasit?.birdFlip,
      },
      trueDistanceM: pair.distanceM,
      measuredDistanceM: pair.distanceM,
      ballisticHold: null,
      crosswindMs: 0,
      densityRatio: 1,
      birdBearingDeg: pair.bearingDeg,
      hunterPos: { ...pair.stand },
      birdPos: { ...pair.impact },
      rangeSource: "estimated",
      ettersokPairId: pair.id,
      recoveryOnly,
    });
    setPanel("arrived");
  }

  function continueSpottingAfterShot() {
    if (!pendingPostShot) {
      beginSpot();
      return;
    }
    const stayed = pendingPostShot.stayedCount;
    const reuseImageSrc =
      pendingPostShot.aware?.imageSrc ??
      spotLayoutByCell[`${pos.row},${pos.col}`]?.imageSrc ??
      null;
    setPendingPostShot(null);
    setLog(
      stayed > 0
        ? `Du speider videre — ${stayed === 1 ? "kanskje én fugl" : "kanskje noen fugler"} ble sittende.`
        : "Du speider videre.",
    );
    beginSpot({ reuseImageSrc });
  }

  /**
   * Uncommitted recoveries (no cam / no saved skuddpar) are lost when you
   * engage another bird — not when you only continue spotting.
   */
  function forfeitUncommittedShotPairs(): string | null {
    const lost = shotPairs.filter(
      (p) =>
        !!p.harvestDraft &&
        p.found == null &&
        p.skuddparCommitted === false &&
        (p.resultKind === "instant_kill" ||
          p.resultKind === "vital_kill" ||
          p.resultKind === "ettersok"),
    );
    if (lost.length === 0) return null;
    setShotPairs((prev) =>
      prev.map((p) =>
        lost.some((l) => l.id === p.id)
          ? { ...p, found: false, harvestDraft: undefined }
          : p,
      ),
    );
    setMentalFatigue((m) =>
      clampFatigue(1 - staminaLeft(m) * ETTERSOK_ABANDON_MENTAL_KEEP),
    );
    const n = lost.length;
    return n === 1
      ? "Du gikk videre til ny fugl uten lagret skuddpar — forrige fugl er tapt."
      : `Du gikk videre til ny fugl uten lagret skuddpar — ${n} fugler tapt.`;
  }

  function onHuntShotResult(result: HuntShotResult) {
    if (!shootSession || !map) return;
    setBirdEncounter(null);
    const id = shootSession.bird.birdId;
    const dist = result.measuredDistanceM;
    const stand = shootSession.hunterPos;
    // True bird marker from Aware — keep continuity into ettersøk.
    const birdPos = shootSession.birdPos;
    const camcorderOn = !!shootSession.camcorderActive;
    /** True land / fall (hidden). Visible skuddpar from cam or pre-saved pair. */
    let impact = birdPos;
    if (result.kind === "miss") {
      impact = impactFromShot({
        stand,
        bearingDeg: shootSession.bearingDeg,
        distanceM: result.trueDistanceM,
      });
    }
    let fleeObservation: ShotPair["fleeObservation"];
    if (result.kind === "ettersok") {
      const flee = generateFleeObservation({
        birdAtShot: birdPos,
        hitZone: result.zone === "vital" ? "vital" : "body",
        hasTriggercam,
        hasCamcorder: camcorderOn,
      });
      impact = flee.landPos;
      fleeObservation = flee.observation;
    }
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
    const hitFasit: ShotHitFasit = {
      xMm: result.xMm,
      yMm: result.yMm,
      diameterMm: caliberBulletDiameterMm(result.caliber ?? "6.5×55"),
      zone: result.zone,
      kind: result.kind,
      birdSpriteId: shootSession.bird.spriteId,
      birdFlip: !!shootSession.bird.flip,
    };

    const autoVisible = estimateVisibleShotPair({
      stand,
      trueAim: result.kind === "miss" ? impact : birdPos,
      hasTriggercam,
      hasCamcorder: camcorderOn,
    });

    /** Pre-saved Shoot skuddpar on this cell (no harvest yet) — no-cam fallback. */
    const manualPair = shotPairs.find(
      (p) =>
        p.cell.row === pos.row &&
        p.cell.col === pos.col &&
        !p.harvestDraft &&
        p.found == null,
    );

    let pair: ShotPair | null = null;
    let pairNote = "";

    if (autoVisible) {
      pair = {
        id: `pair-${Date.now()}`,
        atMs: Date.now(),
        cell: { ...pos },
        cellLabel: cellLabel(pos),
        stand,
        target: autoVisible.target,
        impact,
        distanceM: autoVisible.distanceM,
        bearingDeg: autoVisible.bearingDeg,
        resultKind: result.kind,
        trackPoints: [],
        found: null,
        harvestDraft,
        fleeObservation,
        hitFasit,
        skuddparCommitted: true,
      };
      setShotPairs((prev) => [pair!, ...prev]);
      pairNote =
        autoVisible.source === "camcorder"
          ? " Camcorder lagret skuddpar (±10 m)."
          : " Triggercam lagret skuddpar (±30 m).";
    } else if (manualPair && result.kind !== "miss") {
      pair = {
        ...manualPair,
        impact,
        resultKind: result.kind,
        harvestDraft,
        fleeObservation,
        hitFasit,
        found: null,
        skuddparCommitted: true,
      };
      setShotPairs((prev) =>
        prev.map((p) => (p.id === manualPair.id ? pair! : p)),
      );
      pairNote = " Skuddpar fra Shoot er koblet til skuddet.";
    } else if (result.kind !== "miss") {
      // No cam / no pre-save: still allow Track for THIS bird until you shoot another.
      const bearingDeg = SHOT_PAIR_MANUAL_DEFAULT_BEARING_DEG;
      const distanceM = SHOT_PAIR_MANUAL_DEFAULT_DISTANCE_M;
      const target = impactFromShot({ stand, bearingDeg, distanceM });
      pair = {
        id: `pair-${Date.now()}`,
        atMs: Date.now(),
        cell: { ...pos },
        cellLabel: cellLabel(pos),
        stand,
        target,
        impact,
        distanceM,
        bearingDeg,
        resultKind: result.kind,
        trackPoints: [],
        found: null,
        harvestDraft,
        fleeObservation,
        hitFasit,
        skuddparCommitted: false,
      };
      setShotPairs((prev) => [pair!, ...prev]);
      pairNote =
        " Ingen lagret skuddpar — du kan fortsatt hente/søke, men skyt ikke flere før du er ferdig (eller lagre skuddpar / bruk cam).";
    }

    const clip = pickShotVideoForResult(result.kind);
    const isContact =
      result.kind === "instant_kill" ||
      result.kind === "vital_kill" ||
      result.kind === "ettersok";

    // Remove shot / wounded bird from the map, then flush the rest.
    let nextBirds = isContact
      ? birds.filter((b) => b.id !== id)
      : birds;
    const silentShot = !!result.silentShot;
    const flush = applyPostShotBirdFlush({
      birds: nextBirds,
      cell: pos,
      map,
      excludeBirdId: isContact ? id : undefined,
      hasSuppressor,
      silentShot,
    });
    nextBirds = flush.birds;
    setBirds(nextBirds);

    const removedIds = new Set<string>([
      ...(isContact ? [id] : []),
      ...flush.flushedIds,
    ]);
    if (removedIds.size > 0) {
      setSpotLayoutByCell((prev) => {
        const next: Record<string, SpotCellLayout> = {};
        for (const [key, layout] of Object.entries(prev)) {
          next[key] = {
            ...layout,
            placements: layout.placements.filter(
              (p) => !removedIds.has(p.birdId),
            ),
          };
        }
        return next;
      });
      setBirdMapContacts((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const rid of removedIds) {
          if (rid in next) {
            delete next[rid];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }

    const stayNote =
      flush.stayedIds.length > 0
        ? ` ${flush.stayedIds.length === 1 ? "Én fugl" : `${flush.stayedIds.length} fugler`} ble sittende${
            silentShot
              ? " (subsonisk + lyddemper — stille)"
              : hasSuppressor
                ? " (lyddemper)"
                : ""
          }.`
        : flush.flushedIds.length > 0
          ? hasSuppressor
            ? " Fuglene i ruta letter (lyddemper demper litt — ikke nok)."
            : " Fuglene i ruta letter av skuddlyden."
          : silentShot
            ? " Stille skudd (subsonisk + lyddemper) — fuglene merker det ikke."
            : "";

    if (isContact) {
      const recoveryOnly =
        result.kind === "instant_kill" || result.kind === "vital_kill";
      const aware: AwareSession | null = pair
        ? {
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
            rangeSource: shootSession.rangeSource,
            ettersokPairId: pair.id,
            recoveryOnly,
          }
        : null;
      const logMsg =
        result.kind === "instant_kill"
          ? `Instant kill på ${dist} m.${pairNote}${stayNote}`
          : result.kind === "vital_kill"
            ? `Vitalt treff på ${dist} m.${pairNote}${stayNote}`
            : fleeObservation
              ? `Treff — ettersøk! Flukt ${fleeObservation.compassLabel}.${pairNote}${stayNote}`
              : `Treff — ettersøk!${pairNote}${stayNote}`;
      setLog(logMsg);
      setShootSession(null);
      setPendingPostShot({
        aware,
        stayedCount: flush.stayedIds.length,
        flushedCount: flush.flushedIds.length,
        resultKind: result.kind,
      });
      setPanel("arrived");
      if (clip) {
        setShotVideo({
          videoSrc: clip.src,
          title: clip.title,
          subtitle: logMsg,
        });
      }
      return;
    }

    const missLog =
      `Bom på ${dist} m.${stayNote || " Fuglen letter."}` +
      (flush.stayedIds.length > 0 ? " Du kan spotte videre." : "");
    setLog(missLog);
    setShootSession(null);
    setPanel("arrived");
    if (flush.stayedIds.length > 0) {
      setPendingPostShot(null);
    }
    if (clip) {
      setShotVideo({
        videoSrc: clip.src,
        title: clip.title,
        subtitle: missLog,
      });
    }
  }

  function eatItem(itemId: string) {
    const entry = edible.find((e) => e.item.id === itemId);
    if (!entry || !entry.canEat || !entry.recovery) {
      setLog(
        entry?.needsBoil
          ? "Kan ikke spise Real uten kokeutstyr i kit."
          : "Kan ikke spise dette nå.",
      );
      return;
    }
    setEatSession({
      imageSrc: pickEatImage(),
      itemId,
      label: `${entry.item.brand} ${entry.item.name}`,
      bodyGain: entry.recovery.bodyGain,
      mindGain: entry.recovery.mindGain,
      minutes: entry.recovery.minutes,
    });
  }

  function drinkCoffee() {
    if (!hasThermos) {
      setLog("Ingen termos i kit — ingen kaffe.");
      return;
    }
    setEatSession({
      imageSrc: pickEatImage(),
      itemId: null,
      label: COFFEE_RECOVERY.label,
      bodyGain: COFFEE_RECOVERY.bodyGain,
      mindGain: COFFEE_RECOVERY.mindGain,
      minutes: COFFEE_RECOVERY.minutes,
    });
  }

  function takeShortRest() {
    setEatSession({
      imageSrc: pickEatImage(),
      itemId: null,
      label: SHORT_REST_RECOVERY.label,
      bodyGain: SHORT_REST_RECOVERY.bodyGain,
      mindGain: SHORT_REST_RECOVERY.mindGain,
      minutes: SHORT_REST_RECOVERY.minutes,
    });
  }

  function lightTyribal() {
    if (map) {
      const flushed = flushAllBirdsFromCell(birds, pos, map);
      if (flushed.flushedCount > 0) {
        setBirds(flushed.birds);
      }
    }
    setEatSession({
      imageSrc: pickFireImage(),
      itemId: null,
      label: TYRIBAL_RECOVERY.label,
      bodyGain: TYRIBAL_RECOVERY.bodyGain,
      mindGain: 1,
      mindToFull: true,
      minutes: TYRIBAL_RECOVERY.minutes,
    });
  }

  function finishEat() {
    if (!eatSession) return;
    if (eatSession.itemId) {
      if (!onConsumeFood(eatSession.itemId)) {
        setLog("Ingen mer av den maten igjen.");
        setEatSession(null);
        setPanel("arrived");
        return;
      }
    }
    advanceClockMinutes(eatSession.minutes);
    setPhysicalFatigue((p) => clampFatigue(p - eatSession.bodyGain));
    if (eatSession.mindToFull) {
      setMentalFatigue(0);
    } else {
      setMentalFatigue((m) => clampFatigue(m - eatSession.mindGain));
    }
    const bodyTxt = formatStaminaPct(eatSession.bodyGain);
    const mindTxt = eatSession.mindToFull
      ? "Mind 100%"
      : `Mind +${formatStaminaPct(eatSession.mindGain)}`;
    const fireNote =
      eatSession.label === TYRIBAL_RECOVERY.label
        ? ` ${TYRIBAL_RECOVERY.note}`
        : "";
    setLog(
      `${eatSession.label}: Body +${bodyTxt} · ${mindTxt} · ${eatSession.minutes} min.${fireNote}`,
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
        ? `Du overlevde på ${ateCount} ${ateCount === 1 ? "fugl" : "fugler"} fra sekken — fangsten er tapt for Vebjørn.`
        : "Tom sekk — kald og sulten natt under stjernene.";
    const duration = Math.max(1, minutesUntilDawn(clockMinutes));
    setForcedCamp(null);
    setLostCatchReveal(false);
    setCampOvernight({
      imageSrc: pickFireImage(),
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
    setCampOvernight(null);
    setForcedCamp(null);

    const canContinue = onCampOvernight ? onCampOvernight() : true;
    if (!canContinue) {
      setLog(
        "Jaktkortet er brukt opp etter natta — tilbake til bilen. Kjøp nytt kort på inatur.no.",
      );
      leaveHunt({ skipJaktkortConsume: true, force: true });
      return;
    }

    setLog(
      `Morgen — kl ${formatHuntClock(mins)}. Skuddlys igjen til 17:00. Kom deg til bilen før mørket.`,
    );
    setPanel("arrived");
  }

  const inspectTrip =
    selected && map
      ? pathTravelMinutes(map.id, pos, selected, pace)
      : null;
  const selectedEffort = selected
    ? getCellEffort(map.id, selected)
    : null;
  const selectedBirdChance =
    selected && map && terrain
      ? estimatedBirdChancePct(
          map.id,
          selected,
          (terrain.tiurRating + terrain.orrhaneRating) / 2,
          isAtParking(selected, map),
        )
      : null;
  const selectedSeatCounts =
    selected && map ? getCellSeatCounts(map.id, selected) : null;

  if (shotVideo) {
    return (
      <ShotVideoView
        videoSrc={shotVideo.videoSrc}
        title={shotVideo.title}
        subtitle={shotVideo.subtitle}
        onContinue={() => setShotVideo(null)}
        skipLabel="Fortsett"
        ariaLabel={shotVideo.title}
      />
    );
  }

  if (abandonReveal) {
    return (
      <AtmospherePauseView
        imageSrc={abandonReveal.imageSrc}
        title="Ettersøk avsluttet"
        subtitle={abandonReveal.subtitle}
        durationMinutes={0}
        holdMs={5500}
        clockMinutes={clockMinutes}
        onContinue={() => {
          setLog(abandonReveal.subtitle);
          setAbandonReveal(null);
        }}
        skipLabel="Fortsett"
        ariaLabel="Ettersøk avsluttet"
      />
    );
  }

  if (endexReveal) {
    return (
      <AtmospherePauseView
        imageSrc={ENDEX_SUNSET_IMAGE}
        title="Endex for i dag"
        subtitle="Solen er nede og skuddlyset borte — du må komme deg til bilen før midnatt."
        durationMinutes={0}
        holdMs={6500}
        clockMinutes={clockMinutes}
        onContinue={() => {
          setEndexReveal(false);
          setPanel("arrived");
          setLog(
            hasHeadlamp
              ? "Mørkt ute — hodelykt i kit. Rekker du bilen før midnatt?"
              : "Mørkt uten hodelykt — bare parkeringen er trygg. Rekker du bilen før midnatt, eller camp ute?",
          );
        }}
        skipLabel="Videre"
        ariaLabel="Skuddlys over"
      />
    );
  }

  if (lostCatchReveal) {
    return (
      <AtmospherePauseView
        imageSrc={pickFireImage()}
        title="Fangsten går tapt"
        subtitle={
          "Du må overnatte ute og overleve på fuglene i sekken — fangsten går tapt. " +
          "Håper du har med bra dunjakke og stilongs."
        }
        durationMinutes={0}
        holdMs={7000}
        clockMinutes={clockMinutes}
        onContinue={() => {
          setLostCatchReveal(false);
          beginCampOvernight();
        }}
        skipLabel="Overnatt"
        ariaLabel="Fangsten går tapt"
      />
    );
  }

  if (flushCurrent) {
    return (
      <AtmospherePauseView
        key={flushCurrent.birdId}
        imageSrc={flushCurrent.imageSrc}
        title="Fuglen flyr!"
        highlight={flushDirectionHeadline(flushCurrent)}
        subtitle={flushMessage(flushCurrent)}
        durationMinutes={2}
        holdMs={5000}
        clockMinutes={clockMinutes}
        onContinue={finishFlush}
        ariaLabel="Fuglen flyr"
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
                    {speciesLabelNb(c.species)} ·{" "}
                    {formatCarcassWeightKg(c.weightKg)}
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
        title={eatSession.label}
        subtitle={`Body +${formatStaminaPct(eatSession.bodyGain)} · ${
          eatSession.mindToFull
            ? "Mind → 100%"
            : `Mind +${formatStaminaPct(eatSession.mindGain)}`
        }`}
        durationMinutes={eatSession.minutes}
        clockMinutes={clockMinutes}
        onContinue={finishEat}
        ariaLabel="Eat / Rest"
      />
    );
  }

  if (findReveal) {
    return (
      <AtmospherePauseView
        imageSrc={findReveal.imageSrc}
        title="Du fant fuglen! Godt utført ettersøk."
        subtitle="Fuglen er i sekken — klar for Vebjørn på kjøttmarkedet."
        durationMinutes={0}
        holdMs={4500}
        clockMinutes={clockMinutes}
        onContinue={() => {
          const pair = findReveal.pair;
          setFindReveal(null);
          harvestFoundPair(pair);
          if (pair.hitFasit) setFindHitAar(pair);
        }}
        skipLabel="Fortsett"
        ariaLabel="Fugl funnet"
      />
    );
  }

  if (findHitAar?.hitFasit) {
    const hit = findHitAar.hitFasit;
    return (
      <HuntShotAarView
        title="Fasit — treffpunkt"
        hit={hit}
        birdFlip={!!hit.birdFlip}
        birdSpriteId={hit.birdSpriteId ?? "tiur-1"}
        continueLabel="Tilbake til Track"
        onContinue={() => setFindHitAar(null)}
      />
    );
  }

  if (shootSession) {
    return (
      <HuntShootView
        trueDistanceM={shootSession.trueDistanceM}
        measuredDistanceM={shootSession.measuredDistanceM}
        rangeSource={shootSession.rangeSource}
        ballisticHold={shootSession.ballisticHold}
        crosswindMs={shootSession.crosswindMs}
        densityRatio={shootSession.densityRatio}
        temperatureC={weather.live.temperatureC}
        shotBearingDeg={shootSession.bearingDeg}
        windFromDeg={weather.live.windFromDeg}
        windSpeedMs={weather.live.windSpeedMs}
        clockMinutes={clockMinutes}
        kitItems={kitItems}
        inventory={inventory}
        ammoAffinities={ammoAffinities}
        zeroingProfiles={zeroingProfiles}
        dopeCard={dopeCard}
        customsMoaDelta={customsMoaDelta}
        musicEnabled={musicEnabled}
        physicalFatigue={physicalFatigue}
        mentalFatigue={mentalFatigue}
        birdFlip={!!shootSession.bird.flip}
        birdSpriteId={shootSession.bird.spriteId}
        camoBirdSpot={camoBirdSpot}
        birdNerve={shootSession.birdNerve}
        onAffinitiesChange={onAffinitiesChange}
        onConsumeAmmo={onConsumeAmmo}
        onEnsureZeroing={onEnsureZeroing}
        onAbort={abortShoot}
        onBackToAware={returnToAwareFromShoot}
        onShotResult={onHuntShotResult}
        onGameSeconds={addGameSeconds}
        onBirdFlushedFromWait={() => {
          if (!shootSession || !map) return;
          const id = shootSession.bird.birdId;
          const result = spookBird(birds, id, map);
          setBirds(result.birds);
          setSpotLayoutByCell((prev) => {
            const next: Record<string, SpotCellLayout> = {};
            for (const [key, layout] of Object.entries(prev)) {
              next[key] = {
                ...layout,
                placements: layout.placements.filter((p) => p.birdId !== id),
              };
            }
            return next;
          });
          setBirdMapContacts((prev) => {
            if (!(id in prev)) return prev;
            const next = { ...prev };
            delete next[id];
            return next;
          });
          queueNervousFlush(result.event);
        }}
        onNerveChange={(nerve) => {
          setBirdEncounter((prev) => {
            if (!prev) return prev;
            const next = { ...prev, nerve };
            birdEncounterRef.current = next;
            return next;
          });
        }}
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
        rangeSource={awareSession.rangeSource}
        initialHunter={awareSession.hunterPos ?? null}
        initialBird={awareSession.birdPos ?? null}
        weather={weather}
        camoBirdSpot={camoBirdSpot}
        initialBirdNerve={
          awareSession.returnNerve ??
          birdEncounter?.nerve ??
          initialEncounterNerve(
            birds.find((b) => b.id === awareSession.bird.birdId)?.spookCount ??
              0,
          )
        }
        initialCamcorderReady={!!awareSession.returnCamcorderActive}
        hasLrf={hasBinos}
        ammo={primaryAmmo?.ammo ?? null}
        hasKestrel={!!kestrelItem}
        hasBdx={!!binoItem?.lrf.hasOnboardBallistics}
        hasCamcorder={hasCamcorder}
        hasTriggercam={hasTriggercam}
        clockMinutes={clockMinutes}
        shotPairs={shotPairs}
        focusPairId={awareSession.ettersokPairId ?? null}
        onShotPairsChange={setShotPairs}
        onGameSeconds={addGameSeconds}
        onProceedToShoot={proceedFromAware}
        onBirdFlushed={onAwareBirdFlushed}
        onNerveChange={(nerve) => {
          setBirdEncounter((prev) => {
            if (!prev) return prev;
            const next = { ...prev, nerve };
            birdEncounterRef.current = next;
            return next;
          });
        }}
        abortLabel={awareSession.ettersokPairId ? "Avbryt" : "Back to Spot"}
        onAbort={
          awareSession.ettersokPairId ? abortAware : backToSpotFromAware
        }
        onPairFound={(pair) => {
          setFindReveal({ imageSrc: pickFunnImage(), pair });
        }}
      />
    );
  }

  if (spotSession) {
    return (
      <SpotView
        imageSrc={spotSession.imageSrc}
        birdPlacements={spotSession.birdPlacements}
        viewBearingDeg={spotSession.viewBearingDeg}
        magnification={binosMagnification}
        lrfSpec={lrfSpec}
        thermalMagnification={thermalMagnification}
        thermalPixelFactor={thermalPixelFactor}
        thermalTimeFactor={thermalTimeFactor}
        thermalLrfSpec={thermalLrfSpec}
        binosPriceNok={binoItem?.priceNok ?? 0}
        thermalPriceNok={thermalItem?.priceNok ?? 0}
        clockMinutes={clockMinutes}
        hasBinos={hasBinos}
        hasThermal={hasThermal}
        hasLrf={hasBinos}
        binosLabel={binosLabel}
        thermalLabel={thermalLabel}
        thermalBatteryGameSec={thermalBatteryGameSec}
        thermalBatteryMaxGameSec={thermalBatteryMaxGameSec}
        onThermalBatteryDrain={(wantGameSec) => {
          if (!Number.isFinite(wantGameSec) || wantGameSec <= 0) {
            return thermalBatteryGameSecRef.current;
          }
          const next = Math.max(
            0,
            thermalBatteryGameSecRef.current - wantGameSec,
          );
          thermalBatteryGameSecRef.current = next;
          setThermalBatteryGameSec(next);
          return next;
        }}
        onGameSeconds={addGameSeconds}
        onBirdObserved={onBirdObserved}
        onDone={finishSpot}
        initialMode={spotSession.initialMode}
        initialPan={spotSession.initialPan}
      />
    );
  }

  if (prespotReveal) {
    return (
      <AtmospherePauseView
        imageSrc={prespotReveal.imageSrc}
        title="Fugl spottet"
        subtitle="Du går forsiktig og observant og ser fuglen før den ser deg."
        durationMinutes={0}
        holdMs={4500}
        clockMinutes={clockMinutes}
        onContinue={finishPrespotReveal}
        skipLabel="Til kikkert"
        ariaLabel="Fugl spottet før den ser deg"
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
            {" · "}
            Sekk {formatWeightKg(packLoad.totalGrams)}
            {packLoad.carcassGrams > 0
              ? ` (${formatCarcassWeightKg(packLoad.carcassGrams / 1000)} vilt${
                  packLoad.fatigueLoadFactor > 1.02
                    ? ` · +${Math.round((packLoad.fatigueLoadFactor - 1) * 100)}% fatigue`
                    : ""
                })`
              : ""}
          </p>
          <p className="shop-row-note">{log}</p>
        </div>
        <button
          type="button"
          className="intro-button"
          disabled={!atParking}
          title={
            atParking
              ? "Avslutt jakt og kjør hjem"
              : `Gå tilbake til bilen (${cellLabel(map.start)}) for å avslutte`
          }
          onClick={() => leaveHunt()}
        >
          Avslutt jakt
        </button>
      </header>

      <div className="hunt-map-layout">
        <div className="hunt-map-main">
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

          {selected && panel === "study" ? (
            <div className="hunt-map-cell-blowup">
              <p className="hunt-map-cell-blowup-label">
                Rute {cellLabel(selected)} — nærbilde
              </p>
              <div
                className="hunt-map-cell-blowup-frame"
                style={
                  {
                    "--hunt-cols": map.cols,
                    "--hunt-rows": map.rows,
                    "--blowup-col": selected.col,
                    "--blowup-row-from-top": map.rows - 1 - selected.row,
                  } as CSSProperties
                }
              >
                <img
                  key={`${map.id}-${selected.row}-${selected.col}`}
                  src={terrainMapSrc(terrain)}
                  alt={`Forstørret rute ${cellLabel(selected)}`}
                  className="hunt-map-cell-blowup-img"
                  draggable={false}
                />
              </div>
            </div>
          ) : null}
        </div>

        <aside className="hunt-side-panel">
          {panel === "inspect" && selected && selectedEffort != null && inspectTrip ? (
            <>
              <p className="intro-line intro-gift">
                Rute {cellLabel(selected)}
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
                  {dark
                    ? "Uten hodelykt: bare bilen er trygg nå — gå dit, eller camp ute."
                    : `Uten hodelykt: vær ved bilen før ${formatHuntClock(HUNT_DARK_MINUTES)} — ellers camp ute og spis fuglene dine.`}
                </p>
              ) : null}

              <div className="hunt-side-actions">
                <button
                  type="button"
                  className="intro-button"
                  onClick={goHere}
                  disabled={
                    selected == null ||
                    !canWalkAtNight(hasHeadlamp, clockMinutes, {
                      destinationIsParking: isAtParking(selected, map),
                    }) ||
                    (!hasHeadlamp &&
                      inspectTrip != null &&
                      isHuntDark(clockMinutes + inspectTrip.minutes) &&
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
              {pendingPostShot ? (
                <div className="hunt-side-actions hunt-side-actions-stack">
                  <p className="shop-row-note">
                    {pendingPostShot.resultKind === "ettersok"
                      ? "Ettersøk venter. Speid videre om du vil, eller åpne Hent/søk."
                      : "Skuddpar lagret. Speid videre om noen ble sittende, eller åpne Hent/søk."}
                  </p>
                  <button
                    type="button"
                    className="intro-button"
                    onClick={continueSpottingAfterShot}
                    disabled={!huntingAllowed}
                  >
                    Fortsett spotting
                  </button>
                  {pendingPostShot.aware ? (
                    <button
                      type="button"
                      className="intro-button"
                      onClick={openPendingPostShotTrack}
                    >
                      Hent/søk
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <div className="hunt-side-actions hunt-side-actions-stack">
                    <button
                      type="button"
                      className="intro-button"
                      onClick={() => beginSpot()}
                      disabled={!huntingAllowed}
                    >
                      Spot for birds
                    </button>
                    <button
                      type="button"
                      className="intro-button"
                      onClick={() => setPanel("eat")}
                    >
                      Eat/Rest
                    </button>
                    <button
                      type="button"
                      className="intro-button"
                      onClick={() => {
                        setSelected(null);
                        setPanel("study");
                        setLog(
                          "Study map — klikk rundt på ruter. Go back avslutter.",
                        );
                      }}
                    >
                      Study map
                    </button>
                  </div>
                  {unfinishedShotPairs.length > 0 ? (
                    <div className="hunt-side-actions hunt-side-actions-stack">
                      <p className="shop-row-note">
                        {unfinishedShotPairs.length === 1
                          ? "1 skuddpar venter på Hent/søk:"
                          : `${unfinishedShotPairs.length} skuddpar venter på Hent/søk:`}
                      </p>
                      {unfinishedShotPairs.map((pair) => (
                        <button
                          key={pair.id}
                          type="button"
                          className="intro-button"
                          onClick={() => openAwareForPair(pair)}
                        >
                          {trackLabelForPair(pair)}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <p className="shop-row-note">
                    Klikk en rute for pace og «Go here», eller bruk Study map
                    for detaljer og zoom. Tiur{" "}
                    {formatBirdRating(terrain.tiurRating)} · Orrhane{" "}
                    {formatBirdRating(terrain.orrhaneRating)} · mørkt kl{" "}
                    {formatHuntClock(HUNT_DARK_MINUTES)}
                    {!huntingAllowed ? " · skuddlys over" : ""}
                    {hasHeadlamp ? " · hodelykt i kit" : " · ingen hodelykt"}
                  </p>
                  {dark && !atParking ? (
                    <div className="hunt-side-actions hunt-side-actions-stack">
                      <button
                        type="button"
                        className="intro-button"
                        onClick={() => triggerLostCatchOvernight()}
                      >
                        Camp ute (fangst tapt)
                      </button>
                    </div>
                  ) : null}
                  {dark && atParking ? (
                    <p className="shop-row-note">
                      Du er ved bilen etter skuddlys — trygt. Avslutt jakt når du
                      er klar.
                    </p>
                  ) : null}
                </>
              )}
            </>
          ) : null}

          {panel === "study" ? (
            <>
              <p className="intro-line intro-gift">Study map</p>
              {selected && selectedEffort != null && inspectTrip ? (
                <>
                  <p className="intro-line">
                    Rute {cellLabel(selected)}
                  </p>
                  <p className="shop-row-note">
                    Effort {selectedEffort}/5 — {describeEffort(selectedEffort)}
                  </p>
                  {selectedBirdChance != null ? (
                    <p className="shop-row-note">
                      Fuglesannsynlighet ~{selectedBirdChance}% (
                      {describeBirdChance(selectedBirdChance)})
                      {selectedSeatCounts && selectedSeatCounts.total > 0
                        ? ` · ${selectedSeatCounts.total} sitteplass${selectedSeatCounts.total === 1 ? "" : "er"} (tiur ${selectedSeatCounts.tiur} · orre ${selectedSeatCounts.orrhane})`
                        : selectedSeatCounts
                          ? " · ingen markerte sitteplasser"
                          : ""}
                    </p>
                  ) : null}
                  <p className="shop-row-note">
                    {CELL_WIDTH_M} m ·{" "}
                    {baseMinutesForEffort(selectedEffort).toFixed(0)} min ved
                    speed 1
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
                            name="hunt-pace-study"
                            checked={paceId === p.id}
                            onChange={() => setPaceId(p.id)}
                          />
                          <span>
                            <strong>{p.label}</strong>
                            <span className="shop-row-note">
                              {mins} min · spot {pct(p.spottingProbability)} ·
                              spd {p.speed}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>

                  {!hasHeadlamp ? (
                    <p className="shop-row-note">
                      {dark
                        ? "Uten hodelykt: bare bilen er trygg nå — gå dit, eller camp ute."
                        : `Uten hodelykt: vær ved bilen før ${formatHuntClock(HUNT_DARK_MINUTES)} — ellers camp ute og spis fuglene dine.`}
                    </p>
                  ) : null}

                  <div className="hunt-side-actions">
                    <button
                      type="button"
                      className="intro-button"
                      onClick={goHere}
                      disabled={
                        !canWalkAtNight(hasHeadlamp, clockMinutes, {
                          destinationIsParking: isAtParking(selected, map),
                        }) ||
                        (!hasHeadlamp &&
                          isHuntDark(clockMinutes + inspectTrip.minutes) &&
                          !isAtParking(selected, map))
                      }
                    >
                      Go here
                    </button>
                  </div>
                  <p className="shop-row-note">
                    Klikk andre ruter for å sammenligne. «Go back» avslutter
                    Study map.
                  </p>
                </>
              ) : (
                <p className="shop-row-note">
                  Klikk rundt på ruter for effort, fuglesannsynlighet og
                  nærbilde. Du er i {cellLabel(pos)}. Kl{" "}
                  {formatHuntClock(clockMinutes)}.
                </p>
              )}
              <button
                type="button"
                className="intro-button"
                onClick={() => {
                  setSelected(null);
                  setPanel("arrived");
                }}
              >
                Go back
              </button>
            </>
          ) : null}

          {panel === "idle" ? (
            <>
              <p className="intro-line intro-gift">Planlegg neste trekk</p>
              <p className="shop-row-note">
                Åpne «Study map» for å studere ruter. Kl{" "}
                {formatHuntClock(clockMinutes)}.
              </p>
              <button
                type="button"
                className="intro-button"
                onClick={() => setPanel("arrived")}
              >
                Go back
              </button>
            </>
          ) : null}

          {panel === "eat" ? (
            <>
              <p className="intro-line intro-gift">Eat / Rest</p>
              <p className="shop-row-note">
                Body / Mind = andel av full stamina. Velg handling:
              </p>

              <p className="hunt-eat-section">Mat i kit</p>
              {edible.length === 0 ? (
                <p className="shop-row-note">Ingen spiselig mat i kit.</p>
              ) : (
                <ul className="hunt-eat-list">
                  {edible.map(({ item, qty, recovery, canEat, needsBoil }) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="intro-button hunt-eat-option"
                        disabled={!canEat}
                        onClick={() => eatItem(item.id)}
                      >
                        <span className="hunt-eat-option-title">
                          {item.brand} {item.name} ×{qty}
                        </span>
                        <span className="hunt-eat-option-meta">
                          {needsBoil
                            ? "Krever koking (brenner + gass)"
                            : recovery
                              ? `Body +${formatStaminaPct(recovery.bodyGain)} · Mind +${formatStaminaPct(recovery.mindGain)} · ${recovery.minutes} min`
                              : "—"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <p className="hunt-eat-section">Drikke</p>
              <ul className="hunt-eat-list">
                <li>
                  <button
                    type="button"
                    className="intro-button hunt-eat-option"
                    disabled={!hasThermos}
                    onClick={drinkCoffee}
                  >
                    <span className="hunt-eat-option-title">
                      {COFFEE_RECOVERY.label}
                    </span>
                    <span className="hunt-eat-option-meta">
                      {hasThermos
                        ? `Body +${formatStaminaPct(COFFEE_RECOVERY.bodyGain)} · Mind +${formatStaminaPct(COFFEE_RECOVERY.mindGain)} · ${COFFEE_RECOVERY.minutes} min`
                        : "Krever termos i kit"}
                    </span>
                  </button>
                </li>
              </ul>

              <p className="hunt-eat-section">Hvile</p>
              <ul className="hunt-eat-list">
                <li>
                  <button
                    type="button"
                    className="intro-button hunt-eat-option"
                    onClick={takeShortRest}
                  >
                    <span className="hunt-eat-option-title">
                      {SHORT_REST_RECOVERY.label}
                    </span>
                    <span className="hunt-eat-option-meta">
                      Body +
                      {formatStaminaPct(SHORT_REST_RECOVERY.bodyGain)} · Mind +
                      {formatStaminaPct(SHORT_REST_RECOVERY.mindGain)} ·{" "}
                      {SHORT_REST_RECOVERY.minutes} min
                    </span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="intro-button hunt-eat-option"
                    onClick={lightTyribal}
                  >
                    <span className="hunt-eat-option-title">
                      {TYRIBAL_RECOVERY.label}
                    </span>
                    <span className="hunt-eat-option-meta">
                      Mind → 100% · Body +
                      {formatStaminaPct(TYRIBAL_RECOVERY.bodyGain)} ·{" "}
                      {TYRIBAL_RECOVERY.minutes} min ·{" "}
                      {TYRIBAL_RECOVERY.note}
                    </span>
                  </button>
                </li>
              </ul>

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
