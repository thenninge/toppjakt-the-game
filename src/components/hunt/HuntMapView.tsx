"use client";

import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties } from "react";
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
import { getHuntPace, HUNT_PACES, type HuntPaceId, prespotChanceForPace } from "@/lib/hunt/pace";
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
  fatigueFromEttersokMinutes,
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
  drawImageWithoutReplacement,
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
  forcedSpotImageForCell,
  forcedSpotImagesForMap,
  removeSpotImageFromDeck,
} from "@/lib/hunt/forcedSpotScenes";
import {
  ensureCloudScenesLoaded,
  isCloudSpotImage,
  subscribeCloudScenes,
} from "@/lib/hunt/cloudScenes";
import {
  getInventoryQty,
  getRifleRoundCount,
  type DopeCardEntry,
  type InventoryEntry,
  type ShotLogEntry,
  type ZeroingProfile,
} from "@/lib/player";
import { barrelWearMaterialFromCustom, barrelWearMoaScale } from "@/lib/rifle/barrelWear";
import {
  isAmmoItem,
  isBackpackItem,
  isBallisticsItem,
  isBipodItem,
  isCamoItem,
  isFoodItem,
  isLrfItem,
  isMiscItem,
  isMountItem,
  isRifleItem,
  isScopeItem,
  isSuppressorItem,
  isThermalItem,
  type ShopItem,
} from "@/lib/shop/types";
import { rollHawkeHuntZeroDriftMm } from "@/lib/mount/spec";
import { mmAt100ToScopeClicks } from "@/lib/optics/clicks";
import {
  COFFEE_RECOVERY,
  SHORT_REST_RECOVERY,
  THERMOS_CUPS_PER_FILL,
  TYRIBAL_RECOVERY,
  SIT_PAD_ITEM_ID,
  sitPadBodyGain,
  effectiveFoodRecovery,
  formatStaminaPct,
  kitCanBoil,
  isThermosFood,
} from "@/lib/food/spec";
import { isCamcorderMisc, isCamcorderTripodMisc, isChronographMisc, isFireStarterMisc, isHeadlampMisc } from "@/lib/misc/spec";
import {
  createCarcassFromHarvest,
  formatWeightKg as formatCarcassWeightKg,
  speciesLabelNb,
  type BirdHarvestInput,
  type GameCarcass,
} from "@/lib/hunt/carcass";
import { backpackRifleRaiseNerve, chestrigOpticsRaiseNerve, chestrigOpticsRaiseTransitionSec, computePackLoad, MOUNT_GUN_UNSPOTTED_NERVE } from "@/lib/kit/pack";
import { formatWeightKg } from "@/lib/shop/weights";
import { SpotView, type SpotMode, type SpotLrfHoldSolution } from "@/components/hunt/SpotView";
import { HuntShootView } from "@/components/hunt/HuntShootView";
import { HuntShotAarView } from "@/components/hunt/HuntShotAarView";
import {
  owlMilestoneForBagged,
  shouldOfferOwl,
  UGLE_FUNN_IMAGE,
  UGLE_FUNN_SUBTITLE,
  UGLE_FUNN_TITLE,
  lifetimeGamebirdsBagged,
} from "@/lib/hunt/owlEasterEgg";
import { WalkView } from "@/components/hunt/WalkView";
import { AtmospherePauseView } from "@/components/hunt/AtmospherePauseView";
import { ShotVideoView } from "@/components/hunt/ShotVideoView";
import { AwareAppView, type AwareShootStance, type AwareLeaveOpts } from "@/components/aware/AwareAppView";
import {
  BAGRIDER_REST_CALM_MULT,
  bipodSpecForShootRest,
  restProvidesWeaponCalm,
  shootRestLabelNb,
  type HuntShootRest,
} from "@/lib/hunt/shootRest";
import {
  computeFeltRecoil,
  computeRecoilDamping,
  shoulderedWeaponWeightKg,
} from "@/lib/range/recoil";
import { resolveBulletWeightGrains } from "@/lib/ammo/spec";
import { miscKitWeaponCalmGrams } from "@/lib/misc/spec";
import {
  applyMindCalmToPulse,
  applyPulseStim,
  bumpHeartRateBpm,
  exertionAfterWalk,
  initialPulseState,
  PULSE_SPOT_ORRE_BPM,
  PULSE_SPOT_TIUR_BPM,
  riseAwareSneak01,
  setPulseToResting,
  tickPulseState,
  type PulseState,
} from "@/lib/hunt/pulse";
import {
  kitCamoStatSum,
  clothingRestBodyGain,
} from "@/lib/camo/spec";
import {
  EMPTY_CUSTOMS_MODS,
  applyCustomCamoSneakPct,
  customsBeddingMoaDelta,
  customsCalmMultiplier,
  customsTriggerPullScale,
  type CustomsMods,
} from "@/lib/customs/spec";
import {
  barrelV0FactorForRifle,
  type InstalledCustomBarrel,
} from "@/lib/customs/customBarrel";
import {
  applyPostShotBirdFlush,
  bindBirdsToSpotImage,
  birdsInCell,
  flushAllBirdsFromCell,
  flushDirectionHeadline,
  flushMessage,
  GONE_BIRD_MENTAL_HIT,
  SHOOT_FLUSH_MIND_HIT,
  MISS_MIND_HIT,
  medianPlacementWidthPct,
  morphSpotBirdToOwl,
  panToCenterOnBird,
  pickFluktImage,
  resolveFlushesOnPath,
  rescaleSpriteWidthPct,
  spawnTiurOnMap,
  spookBird,
  visibleInSpotMode,
  type BirdVisualPlacement,
  type FlushEvent,
  type HuntBird,
} from "@/lib/hunt/birds";
import { getBirdSprite } from "@/lib/hunt/birdSprites";
import {
  CAMCORDER_SETUP_NERVE,
  camcorderSetupNerveFromMisc,
  resolveShotCamKind,
  type HuntShotResult,
} from "@/lib/hunt/shoot";
import { bearingFromSpotFrame } from "@/lib/hunt/spotCompass";
import { pickShotVideoForResult } from "@/lib/hunt/vids";
import {
  lrfOpticalMagnification,
  resolveOpticAperturePercent,
} from "@/lib/optics/spec";
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
import {
  kestrelSolveAmmo,
  type KestrelGunProfile,
} from "@/lib/ballistics/kestrelProfile";
import {
  isRealDataActive,
  realLoadForRifle,
  type RealLoadProfile,
} from "@/lib/ballistics/realLoad";
import type { GameRealism } from "@/lib/optics/turretStyle";
import type { ScopeAimControl } from "@/lib/range/scopeAimControl";
import {
  DEFAULT_FOCUS_TRIGGER_BAR_LENGTH,
  DEFAULT_SCOPE_ZOOM_ON_FOCUS,
  DEFAULT_ZEN_MODE,
  type FocusTriggerBarLength,
} from "@/lib/range/playerScopeSettings";
import {
  realismAutoSkuddpar,
  realismEttersokFindMult,
  realismNerveRateMult,
} from "@/lib/range/realismGameplay";
import { crosswindMs, fullValueWindageMs, type DayWeather } from "@/lib/weather/spec";
import {
  ENCOUNTER_NERVE,
  initialEncounterNerve,
  tickEncounterNerve,
} from "@/lib/game/nervousness";
import type { ShotHitFasit, ShotPair } from "@/lib/aware/types";
import { caliberBulletDiameterMm, computeWeaponCalmFactor } from "@/lib/range/precision";
import {
  CLOSE_RANGE_TREE_HENT_MAX_M,
  estimateVisibleShotPair,
  generateFleeObservation,
  impactFromShot,
  SWAROVSKI_EL_RANGE_ID,
} from "@/lib/aware/ettersok";
import {
  clearShotPairsStorage,
  loadShotPairsForHuntStart,
  saveShotPairsForTerrain,
  type AwareHuntState,
} from "@/lib/aware/shotPairStorage";
import {
  awareMapMaxMFor,
  awareMetersPerPctFor,
  cellCenterOnAwareMap,
  distanceMBetween,
  bearingDegFromTo,
  ensureCellPointOnAwareMap,
  isCellPointOnAwareMap,
  type CellPoint,
} from "@/lib/aware/cellGeometry";

export type HuntHudStatus = {
  clockMinutes: number;
  isDark: boolean;
  /** Cumulative map travel this hunt (meters). */
  distanceTravelledM: number;
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
  /** Heart rate BPM (60–180). */
  heartRateBpm: number;
};

type HuntMapViewProps = {
  terrainId: string;
  kitItems: ShopItem[];
  inventory: InventoryEntry[];
  ammoAffinities: Record<string, number>;
  zeroingProfiles: Record<string, ZeroingProfile>;
  /** Lifetime shots per rifle (barrel wear). */
  rifleRoundCounts?: Record<string, number>;
  customBarrels?: Record<string, InstalledCustomBarrel>;
  dopeCard?: DopeCardEntry[];
  /** Calibrated Kestrel AB profiles (MV / BC / dV/dT). */
  kestrelProfiles?: Record<string, KestrelGunProfile>;
  realLoadProfiles?: RealLoadProfile[];
  useRealDataInSimulation?: boolean;
  /** medium = classic HUD dials; high = tube-mounted realistic turrets. */
  realism?: GameRealism;
  /** Move target under reticle, or reticle over a fixed target. */
  scopeAimControl?: ScopeAimControl;
  /** Player Settings: focus immersion zoom. */
  scopeZoomOnFocus?: boolean;
  /** Player Settings: short vs long focus/trigger bars. */
  focusTriggerBarLength?: FocusTriggerBarLength;
  /** Player Settings: Zen — no passive / Deploy / anlegg nerve. */
  zenMode?: boolean;
  customsMods?: CustomsMods;
  weather: DayWeather;
  onAffinitiesChange: (next: Record<string, number>) => void;
  onConsumeAmmo: (ammoId: string, rifleId?: string) => boolean;
  onEnsureZeroing: (
    rifleId: string,
    scopeId: string,
    ammoId: string,
  ) => ZeroingProfile;
  /** Persist DOPE after hunt hits. */
  onAddDope?: (entry: Omit<DopeCardEntry, "id" | "atMs">) => void;
  /** Persist chronograph / series rows (range + hunt with chrono). */
  onLogSeries?: (entry: ShotLogEntry) => void;
  onConsumeFood: (itemId: string) => boolean;
  onBirdHarvested: (carcass: GameCarcass) => void;
  carcasses: GameCarcass[];
  onConsumeCarcasses: (carcassIds: string[]) => void;
  /**
   * Parkering / startcelle: empty the pack into the car (freezer) so further
   * walking is not weighed down by harvested birds.
   */
  onDepositCarcassesAtCar: () => void;
  onHudChange?: (hud: HuntHudStatus) => void;
  /**
   * Called when the hunter camps overnight. Consumes one jaktkort day.
   * Return false if the permit is used up (hunt should end).
   */
  onCampOvernight?: () => boolean;
  onLeave: (opts?: { skipJaktkortConsume?: boolean }) => void;
  /** Lifetime bagged tiur+orre — gates the owl easter egg. */
  lifetimeTiur?: number;
  lifetimeOrrhaner?: number;
  lifetimeUgle?: number;
  owlLastOfferedMilestone?: number | null;
  /** Persist that an owl observation slot was consumed (26 / 36 / …). */
  onOwlOffered?: (milestone: number) => void;
  /** Persist open-hunt skuddmarkør to PlayerStats (cleared on Dra på jakt / end). */
  onAwareHuntChange?: (next: AwareHuntState | null) => void;
  /** Headshot (yellow zone) — rename player to Pink Mist. */
  onHeadshotNickname?: () => void;
  /** Admin PIN unlocked — hunt AAR after every shot. */
  isAdmin?: boolean;
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
  /** Chronograph was deployed in Aware before this shot. */
  chronoActive?: boolean;
  /** Kestrel enviro measured in Aware before this shot. */
  kestrelEnviroActive?: boolean;
  /** Triggercam started in Aware before this shot. */
  triggercamActive?: boolean;
  /** Rifle was deployed in Aware before this shot. */
  gunDeployed?: boolean;
  /** Pack rest / deployed bipod for this shot. */
  rest?: HuntShootRest;
  /** CB bagrider stacked on sekk/bipod. */
  bagriderActive?: boolean;
  /**
   * Opened for turret dial / prep only — no live bird shot.
   * Fire disabled; Back to Aware keeps turrets.
   * With scanBirdPlacements, F marks a bird under the reticle → engage.
   */
  gunPrepOnly?: boolean;
  /**
   * Undiscovered birds on the same landscape (gun-prep scope scan).
   */
  scanBirdPlacements?: BirdVisualPlacement[];
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
  /** Camcorder was already deployed this encounter (not sticky across Til spotting). */
  returnCamcorderActive?: boolean;
  /** Chronograph was already deployed this encounter (not sticky across Til spotting). */
  returnChronoActive?: boolean;
  /** Kestrel enviro already measured — sticky across Til spotting. */
  returnKestrelEnviroActive?: boolean;
  /** Triggercam already started this encounter (not sticky across Til spotting). */
  returnTriggercamActive?: boolean;
  /** Rifle already deployed — sticky across Til spotting until Mount. */
  returnGunDeployed?: boolean;
  /** Rest choice already made — sticky across Til spotting with Deploy. */
  returnRest?: HuntShootRest;
  /** Bagrider stacked on returnRest — sticky with Deploy. */
  returnBagriderActive?: boolean;
  /**
   * Map/spot Aware without a live engage — Gun opens turret prep only.
   */
  gunPrepOnly?: boolean;
  /**
   * Post-shot: register skuddmarkør while bird aim marker is still visible
   * (60 s window). Shoot tab only — no Klar til skudd.
   */
  postShotSkuddpar?: boolean;
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
  /** Drink one cup from the thermos fill. */
  consumeCoffeeCup?: boolean;
  /**
   * Red Bull-style stim: mind → 100%, then drains back to pre-drink fatigue
   * over this many game minutes.
   */
  mindStimMinutes?: number;
  /** Temporary BPM boost (Red Bull / coffee). */
  pulseBoostBpm?: number;
  pulseBoostMinutes?: number;
};

type RedBullBuff = {
  /** Mental fatigue to return to (captured at drink). */
  restoreMentalFatigue: number;
  /** Clock minutes when the drink finished (crash start). */
  startedAtClockMin: number;
  /** Clock minutes when crash reaches restore level. */
  expiresAtClockMin: number;
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
  /** Null when bird was lost (no skuddmarkør). */
  aware: AwareSession | null;
  stayedCount: number;
  flushedCount: number;
  resultKind: HuntShotResult["kind"];
};

/**
 * After a contact shot without cam/pre-saved skuddmarkør: bird aim stays on
 * Aware for 60 real seconds so the player can register stand→tree via Shoot.
 */
type PostShotGhost = {
  expiresAtMs: number;
  imageSrc: string;
  bird: BirdVisualPlacement;
  /** Grid cell where the shot landed — sticky even if player walks during the window. */
  cell: HuntGridCell;
  cellLabel: string;
  stand: CellPoint;
  /** Aim / tree position (shown on Aware). */
  birdAim: CellPoint;
  /** True land / fall (hidden until Track). */
  impact: CellPoint;
  bearingDeg: number;
  trueDistanceM: number;
  measuredDistanceM: number;
  ballisticHold: BallisticHoldSolution | null;
  crosswindMs: number;
  densityRatio: number;
  rangeSource: "lrf" | "estimated";
  camcorderActive: boolean;
  gunDeployed: boolean;
  rest: HuntShootRest;
  bagriderActive?: boolean;
  harvestDraft: BirdHarvestInput;
  hitFasit: ShotHitFasit;
  fleeObservation?: ShotPair["fleeObservation"];
  resultKind: HuntShotResult["kind"];
  recoveryOnly: boolean;
};

/** Real-time window to register skuddmarkør after a shot. */
const POST_SHOT_SKUDDPAR_WINDOW_MS = 60_000;

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Stamina left (100% = fresh, 0% = exhausted / «på null»). */
function staminaLeft(fatigue: number): number {
  return clampFatigue(1 - fatigue);
}

/** Keep 70% of current mental stamina (= 30% setback). */
const ETTERSOK_ABANDON_MENTAL_KEEP = 0.7;
/** Finding a shot bird restores 33 percentage points of mind (= −0.33 fatigue). */
const FIND_BIRD_MIND_GAIN = 0.33;

/** −30 % mind for leaving a cell (or søk) without a find — same as Gi opp. */
function applyEttersokMentalSetback(mental: number): number {
  return clampFatigue(1 - staminaLeft(mental) * ETTERSOK_ABANDON_MENTAL_KEEP);
}

function birdNameNb(species: string | undefined): string {
  if (species === "orrhane") return "orrhane";
  if (species === "ugle") return "ugle";
  return "tiur";
}

export function HuntMapView({
  terrainId,
  kitItems,
  inventory,
  ammoAffinities,
  zeroingProfiles,
  rifleRoundCounts = {},
  customBarrels = {},
  dopeCard = [],
  kestrelProfiles = {},
  realLoadProfiles = [],
  useRealDataInSimulation = false,
  realism = "medium",
  scopeAimControl = "target",
  scopeZoomOnFocus = DEFAULT_SCOPE_ZOOM_ON_FOCUS,
  focusTriggerBarLength = DEFAULT_FOCUS_TRIGGER_BAR_LENGTH,
  zenMode = DEFAULT_ZEN_MODE,
  customsMods = EMPTY_CUSTOMS_MODS,
  weather,
  onAffinitiesChange,
  onConsumeAmmo,
  onEnsureZeroing,
  onAddDope,
  onLogSeries,
  onConsumeFood,
  onBirdHarvested,
  carcasses,
  onConsumeCarcasses,
  onDepositCarcassesAtCar,
  onHudChange,
  onCampOvernight,
  onLeave,
  lifetimeTiur = 0,
  lifetimeOrrhaner = 0,
  lifetimeUgle = 0,
  owlLastOfferedMilestone = null,
  onOwlOffered,
  onAwareHuntChange,
  onHeadshotNickname,
  isAdmin = false,
}: HuntMapViewProps) {
  const terrain = getHuntingTerrain(terrainId);
  const map = terrain ? getHuntMap(terrain.mapId) : null;
  const tiurSpawnCount = terrain ? tiurSpawnCountForTerrain(terrain) : 20;

  const [pos, setPos] = useState<HuntGridCell>(() =>
    map ? { ...map.start } : { row: 0, col: 0 },
  );
  /** Budget mount (Hawke): one random ±2 click drift for the whole hunt. */
  const mountHuntDriftMmRef = useRef(
    (() => {
      const mount = kitItems.find(isMountItem);
      if (!mount || mount.mount.tier !== "budget") {
        return { xMm: 0, yMm: 0 };
      }
      return rollHawkeHuntZeroDriftMm();
    })(),
  );
  const clockSecondsRef = useRef(HUNT_DAY_START_MINUTES * 60);
  const [clockMinutes, setClockMinutes] = useState(HUNT_DAY_START_MINUTES);
  const [distanceTravelledM, setDistanceTravelledM] = useState(0);
  const [mentalFatigue, setMentalFatigue] = useState(0);
  const [physicalFatigue, setPhysicalFatigue] = useState(0);
  const [pulse, setPulse] = useState<PulseState>(() => initialPulseState(0));
  const pulseRef = useRef(pulse);
  pulseRef.current = pulse;
  const [redBullBuff, setRedBullBuff] = useState<RedBullBuff | null>(null);
  const redBullBuffRef = useRef<RedBullBuff | null>(null);
  const [selected, setSelected] = useState<HuntGridCell | null>(null);
  const [paceId, setPaceId] = useState<HuntPaceId>("normal");
  const [panel, setPanel] = useState<PanelMode>("arrived");
  const [log, setLog] = useState(
    "Du er på parkeringsplassen. Klokka er 08:00 — skuddlys.",
  );
  const [walkSession, setWalkSession] = useState<WalkSession | null>(null);
  const [spotSession, setSpotSession] = useState<SpotSession | null>(null);
  const spotSessionRef = useRef(spotSession);
  spotSessionRef.current = spotSession;
  /**
   * After «Til spotting» from Aware: keep Engage live so the player can
   * re-open the same encounter without a new LRF (re-range after moving).
   */
  const [engageResume, setEngageResume] = useState<AwareSession | null>(null);
  /** Restore Track/Aware after gun-scope review (turrets / shot lookback). */
  const scopeReviewResumeRef = useRef<AwareSession | null>(null);
  /**
   * Rifle is out of the pack this cell — survives Til spotting / Back to Aware
   * so Deploy gun nerve is only paid once until Mount (or auto-mount).
   */
  const [fieldGunDeployed, setFieldGunDeployedState] = useState(false);
  /** Sync guard — setState alone can let mountFieldGun run twice in one tick. */
  const fieldGunDeployedRef = useRef(false);
  function setFieldGunDeployed(out: boolean) {
    fieldGunDeployedRef.current = out;
    setFieldGunDeployedState(out);
  }
  /**
   * Bird locked from gun-prep scope (F) — Aware opens only when player chooses.
   */
  const [scopeMarkedAware, setScopeMarkedAware] = useState<AwareSession | null>(
    null,
  );
  /** Spot image + bird seats sticky per cell for this hunt (until spooked / end hunt). */
  const [spotLayoutByCell, setSpotLayoutByCell] = useState<
    Record<string, SpotCellLayout>
  >({});
  /**
   * Spot landscapes drawn without replacement until the perch-marked pool
   * is empty, then reshuffled. Sticky per cell still reuses the same photo.
   */
  const spotImageDeckRef = useRef<string[]>([]);
  const lastSpotImageDrawnRef = useRef<string | null>(null);
  /** Aware map bearing/pos sticky per birdId until spooked. */
  const [birdMapContacts, setBirdMapContacts] = useState<
    Record<string, BirdMapContact>
  >({});
  /**
   * Last spotting LRF under reticle (bird or terrain). Drives Aware arrow
   * when opening Aware without an engaged bird.
   */
  const lastSpotLrfRef = useRef<{
    bearingDeg: number;
    distanceM: number;
  } | null>(null);
  /**
   * Last hunter stand on the Aware map per cell — so a second bird in the
   * same spot does not force you to re-walk to the safe cake slice.
   */
  const [awareStandByCell, setAwareStandByCell] = useState<
    Record<string, CellPoint>
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
  /**
   * Scope turret dial (mm @ 100 m) sticky for the whole hunt across engages.
   * Null until first shoot view writes a dial.
   */
  const huntScopeTurretsRef = useRef<{ x: number; y: number } | null>(null);
  /**
   * Parallax + illumination drums sticky across engages (like elevation/windage).
   * Null → defaults 100 m / OFF until first shoot view writes a dial.
   */
  const huntSideDrumsRef = useRef<{
    parallaxFocusM: number;
    reticleIllum: number;
  } | null>(null);
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
  /** 60 s real-time window to register skuddmarkør after a contact shot. */
  const [postShotGhost, setPostShotGhost] = useState<PostShotGhost | null>(
    null,
  );
  const [postShotGhostSecLeft, setPostShotGhostSecLeft] = useState(0);
  const [eatSession, setEatSession] = useState<EatSession | null>(null);
  /** Cups left in the thermos this hunt (refilled at trip start). */
  const [thermosCupsLeft, setThermosCupsLeft] = useState(THERMOS_CUPS_PER_FILL);
  const [forcedRest, setForcedRest] = useState<ForcedRestSession | null>(null);
  const [forcedCamp, setForcedCamp] = useState<ForcedCampPrompt | null>(null);
  const [campOvernight, setCampOvernight] = useState<CampOvernightSession | null>(
    null,
  );
  /** Skuddlys over — splash once, then race to the car. */
  const [endexReveal, setEndexReveal] = useState(false);
  const endexShownRef = useRef(false);
  /** Open hent/søk pairs forfeited once when clock passes 17:00. */
  const skuddlysForfeitRef = useRef(false);
  /**
   * Cell key already charged −30 % mind for leaving unfound birds this
   * departure (Til spotting → walk should not double-hit).
   */
  const leaveUnfoundMindCellRef = useRef<string | null>(null);
  /** Missed midnight at the car — lose catch, overnight. */
  const [lostCatchReveal, setLostCatchReveal] = useState(false);
  const midnightHandledRef = useRef(false);
  /** Extreme caution: spotted bird before it spotted you. */
  const [prespotReveal, setPrespotReveal] = useState<{
    /** Atmosphere splash (not the spot landscape). */
    imageSrc: string;
    /** Spot session already bound to the arrival cell — open as-is. */
    spot: SpotSession;
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
  const thermalItem = useMemo(
    () => kitItems.find(isThermalItem) ?? null,
    [kitItems],
  );
  const isHabrok = !!thermalItem?.thermal.isThermalBinocular;
  const hasBinos = !!binoItem || isHabrok;
  const binosLabel = binoItem
    ? `${binoItem.brand} ${binoItem.name}`
    : isHabrok && thermalItem
      ? `${thermalItem.brand} ${thermalItem.name}`
      : null;
  const binosMagnification = binoItem
    ? lrfOpticalMagnification(binoItem)
    : isHabrok
      ? (thermalItem?.thermal.magnification ?? 10)
      : DEFAULT_BINOS_MAGNIFICATION;
  /** Same world zoom SpotView uses for binos (mag × aperture), for pan-to-bird. */
  const binosWorldZoom = Math.max(
    1,
    binosMagnification *
      (resolveOpticAperturePercent(
        binoItem?.priceNok ?? thermalItem?.priceNok ?? 0,
        binoItem?.lrf.aperturePercent,
      ) /
        100),
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
    const t = thermalItem.thermal;
    /**
     * Condor: explicit false → range only (blocks Kestrel elev/wind HUD).
     * Habrok: true when catalog says so, else thermal-bino default.
     */
    const hasBallistics =
      t.integratedLrfHasBallistics === false
        ? false
        : (t.integratedLrfHasBallistics ?? !!t.isThermalBinocular);
    return {
      id: thermalItem.id,
      brand: thermalItem.brand,
      rangeErrorPercent: t.rangeErrorPercent ?? 2,
      hasOnboardBallistics: hasBallistics,
    };
  }, [thermalItem]);
  const kestrelItem = useMemo(
    () =>
      kitItems.find(
        (i) =>
          isBallisticsItem(i) &&
          i.ballistics.measuresCrosswind &&
          !i.ballistics.windSpeedDisplayOnly,
      ) ?? null,
    [kitItems],
  );
  /** Clas Ohlson-class: local wind speed display only (no crosswind fasit). */
  const windMeterItem = useMemo(
    () =>
      kitItems.find(
        (i) => isBallisticsItem(i) && !!i.ballistics.windSpeedDisplayOnly,
      ) ?? null,
    [kitItems],
  );
  /** AB-class meter (Kestrel 5700 Elite) — solver for elev/windage fasit. */
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
  /**
   * Exact AB fasit: AB meter (Kestrel Elite) + LRF that pairs for holds —
   * BDX / onboard-AB binos (Sig KILO3000, Geovid, …), or Habrok thermal binos.
   * Condor/other thermal spotters with LRF do not count as BDX pairing.
   * Fasit is shown; player dials turrets manually.
   */
  const hasExactBallistics = !!(
    abMeterItem &&
    (binoItem?.lrf.hasOnboardBallistics ||
      !!thermalItem?.thermal.isThermalBinocular)
  );
  /** LRF with onboard AB/BDX, or Habrok — used for Aware Kestrel messaging. */
  const hasBdxOrHabrokLrf = !!(
    binoItem?.lrf.hasOnboardBallistics ||
    !!thermalItem?.thermal.isThermalBinocular
  );
  const lrfSpec = useMemo(() => {
    if (binoItem?.lrf) {
      const base = hasExactBallistics
        ? { ...binoItem.lrf, rangeErrorPercent: 0 }
        : binoItem.lrf;
      return {
        ...base,
        id: binoItem.id,
        brand: binoItem.brand,
      };
    }
                // Habrok integrated LRF (no separate binos).
    if (thermalLrfSpec) {
      return {
        hasOnboardBallistics: hasExactBallistics,
        rangeErrorPercent: hasExactBallistics
          ? 0
          : thermalLrfSpec.rangeErrorPercent,
        magnification: thermalMagnification,
        id: thermalItem?.id,
        brand: thermalItem?.brand,
      };
    }
    return null;
  }, [
    binoItem,
    hasExactBallistics,
    thermalLrfSpec,
    thermalMagnification,
    thermalItem,
  ]);

  const scopeClickUnit = useMemo(() => {
    const scope = kitItems.find(isScopeItem);
    return scope?.scope.clickUnit ?? "MRAD";
  }, [kitItems]);

  const primaryAmmo = useMemo(
    () => kitItems.find(isAmmoItem) ?? null,
    [kitItems],
  );
  const kitIds = useMemo(() => kitItems.map((i) => i.id), [kitItems]);
  const inventoryItemIds = useMemo(
    () => inventory.map((e) => e.itemId),
    [inventory],
  );
  const huntRifle = useMemo(
    () => kitItems.find(isRifleItem) ?? null,
    [kitItems],
  );
  const realLoad = useMemo(
    () => realLoadForRifle(realLoadProfiles, huntRifle?.id),
    [realLoadProfiles, huntRifle],
  );
  const realSolveArg = useMemo(
    () => ({
      active: isRealDataActive({
        useRealDataInSimulation,
        kitIds,
        inventoryItemIds,
        realLoad,
        ammoId: primaryAmmo?.id,
      }),
      profile: realLoad,
    }),
    [
      useRealDataInSimulation,
      kitIds,
      inventoryItemIds,
      realLoad,
      primaryAmmo?.id,
    ],
  );

  /**
   * Onboard LRF / Kestrel-linked solution for spotting HUD.
   * With Kestrel: live crosswind + temp (accurate).
   * Without: forecast temp + full-value wind (onboard AB only).
   */
  const solveLrfHold = useCallback(
    (distanceM: number, shotBearingDeg: number): SpotLrfHoldSolution | null => {
      if (!primaryAmmo) return null;
      const onboard =
        !!binoItem?.lrf.hasOnboardBallistics ||
        !!(
          thermalItem?.thermal.isThermalBinocular ||
          thermalItem?.thermal.integratedLrfHasBallistics
        );
      /** Condor LRF is range-only — never pairs Kestrel for holds. */
      const thermalPairsKestrel =
        !!thermalLrfSpec?.hasOnboardBallistics;
      const kestrelLink =
        !!kestrelItem && (!!binoItem?.lrf || thermalPairsKestrel);
      if (!onboard && !kestrelLink) return null;
      if (!Number.isFinite(distanceM) || distanceM < 1) return null;

      const hasKestrel = !!kestrelItem;
      let cw: number;
      let tempC: number;
      if (hasKestrel) {
        cw = crosswindMs(
          weather.live.windSpeedMs,
          weather.live.windFromDeg,
          shotBearingDeg,
        );
        tempC = weather.live.temperatureC;
      } else {
        const forecastSigned = crosswindMs(
          weather.forecast.windSpeedMs,
          weather.forecast.windFromDeg,
          shotBearingDeg,
        );
        const full = fullValueWindageMs(weather.forecast.windSpeedMs);
        cw =
          forecastSigned === 0
            ? full
            : Math.sign(forecastSigned) * Math.abs(full);
        tempC = weather.forecast.temperatureC;
      }

      const density = densityRatioFromTempC(tempC);
      const solve = kestrelSolveAmmo(
        primaryAmmo.ammo,
        primaryAmmo.id,
        kestrelProfiles,
        realSolveArg,
      );
      const hold = exactBallisticHold(solve.ammo, distanceM, cw, {
        densityRatio: density,
        powderTempC: tempC,
        dvDtMpsPerC: solve.dvDtMpsPerC,
      });
      const elevClicksAbs = Math.abs(
        mmAt100ToScopeClicks(hold.dialYMmAt100, scopeClickUnit),
      );
      return {
        elevClicksAbs,
        elevMrad: Math.abs(hold.dialYMmAt100) / 100,
        elevDir: hold.dialYMmAt100 <= 0 ? "up" : "down",
        windMrad: Math.abs(hold.dialXMmAt100) / 100,
        windDir: hold.dialXMmAt100 >= 0 ? "right" : "left",
      };
    },
    [
      primaryAmmo,
      binoItem,
      thermalItem,
      thermalLrfSpec,
      kestrelItem,
      weather.live.windSpeedMs,
      weather.live.windFromDeg,
      weather.live.temperatureC,
      weather.forecast.windSpeedMs,
      weather.forecast.windFromDeg,
      weather.forecast.temperatureC,
      scopeClickUnit,
      kestrelProfiles,
      realSolveArg,
    ],
  );

  const solveElevClicks = useCallback(
    (distanceM: number, shotBearingDeg: number): number | null => {
      return solveLrfHold(distanceM, shotBearingDeg)?.elevClicksAbs ?? null;
    },
    [solveLrfHold],
  );
  const camoPieces = useMemo(
    () => kitItems.filter(isCamoItem).map((i) => i.camo),
    [kitItems],
  );
  const camoSneakPct = useMemo(
    () =>
      applyCustomCamoSneakPct(kitCamoStatSum(camoPieces, "sneakPct"), customsMods),
    [camoPieces, customsMods],
  );
  const clothingSpeedPct = useMemo(
    () => kitCamoStatSum(camoPieces, "speedPct"),
    [camoPieces],
  );
  const clothingFocusPct = useMemo(
    () => kitCamoStatSum(camoPieces, "focusPct"),
    [camoPieces],
  );
  const clothingRecoveryPct = useMemo(
    () => kitCamoStatSum(camoPieces, "recoveryPct"),
    [camoPieces],
  );
  const customsMoaDelta = customsBeddingMoaDelta(customsMods);
  const customsCalmMult = customsCalmMultiplier(customsMods);
  const triggerPullScale = customsTriggerPullScale(customsMods);
  const huntBarrelWearScale = useMemo(() => {
    const rifle = kitItems.find(isRifleItem);
    if (!rifle) return 1;
    return barrelWearMoaScale(
      getRifleRoundCount(rifleRoundCounts, rifle.id),
      barrelWearMaterialFromCustom(customBarrels[rifle.id]),
    );
  }, [kitItems, rifleRoundCounts, customBarrels]);
  const hasHeadlamp = useMemo(
    () =>
      kitItems.some(
        (i) => isMiscItem(i) && isHeadlampMisc(i.misc),
      ),
    [kitItems],
  );
  const camcorderBody = useMemo(() => {
    const found = kitItems.find(
      (i) => isMiscItem(i) && isCamcorderMisc(i.misc),
    );
    return found && isMiscItem(found) ? found : null;
  }, [kitItems]);
  const camcorderTripod = useMemo(() => {
    const found = kitItems.find(
      (i) => isMiscItem(i) && isCamcorderTripodMisc(i.misc),
    );
    return found && isMiscItem(found) ? found : null;
  }, [kitItems]);
  /** Deploy needs camera body + tripod. */
  const hasCamcorder = !!camcorderBody && !!camcorderTripod;
  const camcorderSetupNerve = camcorderTripod
    ? camcorderSetupNerveFromMisc(camcorderTripod.misc)
    : CAMCORDER_SETUP_NERVE;
  const hasBackpack = useMemo(
    () => kitItems.some(isBackpackItem),
    [kitItems],
  );
  const kitBipod = useMemo(
    () => kitItems.find(isBipodItem) ?? null,
    [kitItems],
  );
  const hasBipod = !!kitBipod;
  const bipodWeaponCalm = kitBipod?.bipod.weaponCalm ?? 5;
  const hasChronograph = useMemo(
    () =>
      kitItems.some((i) => isMiscItem(i) && isChronographMisc(i.misc)),
    [kitItems],
  );
  const shotCamKind = useMemo(
    () => resolveShotCamKind(kitItems.map((i) => i.id)),
    [kitItems],
  );
  const hasTriggercam = shotCamKind != null;
  const suppressorItem = useMemo(
    () => kitItems.find(isSuppressorItem) ?? null,
    [kitItems],
  );
  const hasSuppressor = !!suppressorItem;
  const suppressorSoundDb = suppressorItem?.suppressor.soundReductionDb ?? null;

  const packLoad = useMemo(
    () =>
      computePackLoad({
        kitItems,
        customsMods,
        customBarrels,
        carcasses,
      }),
    [kitItems, customsMods, customBarrels, carcasses],
  );

  function syncClockFromRef() {
    const sec = clockSecondsRef.current;
    if (!Number.isFinite(sec)) {
      clockSecondsRef.current = HUNT_DAY_START_MINUTES * 60;
    }
    setClockMinutes(Math.floor(clockSecondsRef.current / 60));
  }

  function syncRedBullMind() {
    const buff = redBullBuffRef.current;
    if (!buff) return;
    const now = clockSecondsRef.current / 60;
    if (now >= buff.expiresAtClockMin) {
      redBullBuffRef.current = null;
      setRedBullBuff(null);
      setMentalFatigue(buff.restoreMentalFatigue);
      setLog("Red Bull-crash ferdig — mind tilbake til før.");
      return;
    }
    const dur = Math.max(1 / 60, buff.expiresAtClockMin - buff.startedAtClockMin);
    const t = Math.min(1, Math.max(0, (now - buff.startedAtClockMin) / dur));
    // 100% mind → pre-drink level over the crash window.
    setMentalFatigue(clampFatigue(buff.restoreMentalFatigue * t));
  }

  function checkRedBullExpiry() {
    syncRedBullMind();
  }

  function tickPulse(opts: {
    gameMinutes: number;
    physicalFatigue: number;
    resting?: boolean;
    spotting?: boolean;
  }) {
    const clockMin = Math.floor(clockSecondsRef.current / 60);
    setPulse((prev) =>
      tickPulseState(prev, {
        gameMinutes: opts.gameMinutes,
        physicalFatigue: opts.physicalFatigue,
        clockMinutes: clockMin,
        resting: opts.resting,
        spotting: opts.spotting,
      }),
    );
  }

  function advanceClockMinutes(
    deltaMin: number,
    opts?: {
      physicalFatigue?: number;
      resting?: boolean;
      skipPulse?: boolean;
      spotting?: boolean;
    },
  ) {
    if (!Number.isFinite(deltaMin)) return;
    clockSecondsRef.current += deltaMin * 60;
    syncClockFromRef();
    checkRedBullExpiry();
    if (!opts?.skipPulse) {
      tickPulse({
        gameMinutes: Math.max(0, deltaMin),
        physicalFatigue: opts?.physicalFatigue ?? physicalFatigue,
        resting: opts?.resting,
        spotting: opts?.spotting,
      });
    }
  }

  function addGameSeconds(sec: number) {
    if (!Number.isFinite(sec) || sec === 0) return;
    clockSecondsRef.current += sec;
    syncClockFromRef();
    checkRedBullExpiry();
    tickPulse({
      gameMinutes: Math.abs(sec) / 60,
      physicalFatigue,
      resting: false,
      spotting: !!spotSessionRef.current,
    });
  }

  function onAwareSneakRealSec(realSec: number) {
    if (!(realSec > 0)) return;
    setPulse((prev) => {
      const awareSneak01 = riseAwareSneak01(prev.awareSneak01, realSec);
      return tickPulseState(
        { ...prev, awareSneak01 },
        {
          gameMinutes: realSec / 60,
          physicalFatigue,
          clockMinutes: Math.floor(clockSecondsRef.current / 60),
        },
      );
    });
  }

  // Prefetch Supabase spotting scenes into the perch/image pool.
  useEffect(() => {
    void ensureCloudScenesLoaded();
    return subscribeCloudScenes(() => {
      // Reshuffle on next draw so newly loaded cloud URLs enter the pool.
      spotImageDeckRef.current = [];
    });
  }, []);

  useEffect(() => {
    if (!map) return;
    setPos({ ...map.start });
    clockSecondsRef.current = HUNT_DAY_START_MINUTES * 60;
    setClockMinutes(HUNT_DAY_START_MINUTES);
    setDistanceTravelledM(0);
    setMentalFatigue(0);
    setPhysicalFatigue(0);
    setPulse(initialPulseState(0));
    setSelected(null);
    setPanel("arrived");
    setWalkSession(null);
    setSpotSession(null);
    setEngageResume(null);
    setShootSession(null);
    setAwareSession(null);
    setFieldGunDeployed(false);
    setScopeMarkedAware(null);
    huntScopeTurretsRef.current = null;
    huntSideDrumsRef.current = null;
    setPendingPostShot(null);
    setPostShotGhost(null);
    setPostShotGhostSecLeft(0);
    setSpotLayoutByCell({});
    spotImageDeckRef.current = [];
    lastSpotImageDrawnRef.current = null;
    setBirdMapContacts({});
    setBirdEncounter(null);
    latentSpotNerveRef.current = {};
    setShotPairs(loadShotPairsForHuntStart(terrainId));
    setFindHitAar(null);
    setEatSession(null);
    setThermosCupsLeft(THERMOS_CUPS_PER_FILL);
    setRedBullBuff(null);
    redBullBuffRef.current = null;
    setForcedRest(null);
    setForcedCamp(null);
    setCampOvernight(null);
    setEndexReveal(false);
    endexShownRef.current = false;
    skuddlysForfeitRef.current = false;
    leaveUnfoundMindCellRef.current = null;
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

  const onAwareHuntChangeRef = useRef(onAwareHuntChange);
  onAwareHuntChangeRef.current = onAwareHuntChange;

  useEffect(() => {
    saveShotPairsForTerrain(terrainId, shotPairs);
    onAwareHuntChangeRef.current?.(
      shotPairs.length > 0
        ? { terrainId, savedAtMs: Date.now(), pairs: shotPairs }
        : null,
    );
  }, [terrainId, shotPairs]);

  const postShotGhostRef = useRef(postShotGhost);
  postShotGhostRef.current = postShotGhost;

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
    // Don't leave found birds in limbo — bag them before clearing skuddmarkør.
    for (const pair of shotPairs) {
      if (pair.found === true && pair.harvestDraft) {
        onBirdHarvested(createCarcassFromHarvest(pair.harvestDraft));
      }
    }
    setShotPairs([]);
    clearShotPairsStorage();
    onAwareHuntChange?.(null);
    onLeave(opts);
  }

  useEffect(() => {
    function isTypingTarget(t: EventTarget | null): boolean {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable
      );
    }

    function mapHudIdle(): boolean {
      return (
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
      );
    }

    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;

      if (e.key === "Escape" && mapHudIdle()) {
        if (map && isAtParking(pos, map)) {
          leaveHunt();
        }
        return;
      }

      /** Same actions as Spot for birds / Aware / Eat / Study map buttons. */
      const hk = mapActionHotkeysRef.current;
      if (!mapHudIdle() || hk.panel !== "arrived" || hk.pendingPostShot) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = e.key.length === 1 ? e.key.toLowerCase() : "";
      if (k === "s") {
        if (!canHuntAtTime(hk.clockMinutes)) return;
        e.preventDefault();
        hk.beginSpot();
        return;
      }
      if (k === "a") {
        e.preventDefault();
        hk.openAwareOverview();
        return;
      }
      if (k === "r") {
        e.preventDefault();
        setPanel("eat");
        return;
      }
      if (k === "m") {
        e.preventDefault();
        setSelected(null);
        setPanel("study");
        setLog("Study map — klikk rundt på ruter. Go back avslutter.");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
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

  const mapActionHotkeysRef = useRef({
    panel: "arrived" as PanelMode,
    pendingPostShot: null as typeof pendingPostShot,
    clockMinutes,
    beginSpot: (() => {}) as (opts?: {
      reuseImageSrc?: string | null;
      initialMode?: SpotMode;
      focusBirdId?: string;
      distanceByBirdId?: Record<
        string,
        { distanceM: number; fromDistanceM?: number }
      >;
    }) => void,
    openAwareOverview: () => {},
  });

  function triggerLostCatchOvernight() {
    if (lostCatchReveal || campOvernight) return;
    midnightHandledRef.current = true;
    setSpotSession(null);
    setEngageResume(null);
    setShootSession(null);
    setAwareSession(null);
    setFieldGunDeployed(false);
    setScopeMarkedAware(null);
    setBirdEncounter(null);
    birdEncounterRef.current = null;
    latentSpotNerveRef.current = {};
    setFlushQueue([]);
    setPendingPostShot(null);
    setPostShotGhost(null);
    setPostShotGhostSecLeft(0);
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
        skuddlysForfeitRef.current = false;
      }
      return;
    }
    // Close hunt UIs — spotting / shooting ends with skuddlys.
    setSpotSession(null);
    setEngageResume(null);
    setShootSession(null);
    setBirdEncounter(null);
    birdEncounterRef.current = null;
    setFlushQueue([]);
    // Open hent/søk pairs are lost at 17:00 — once per skuddlys crossing.
    if (!skuddlysForfeitRef.current) {
      skuddlysForfeitRef.current = true;
      if (postShotGhostRef.current) {
        expirePostShotGhost();
      }
      forfeitOpenShotPairs("skuddlys");
      setAwareSession((prev) => (prev?.ettersokPairId ? null : prev));
      setPendingPostShot(null);
      setPostShotGhost(null);
      setPostShotGhostSecLeft(0);
    }

    if (!endexShownRef.current && !forcedCamp && !campOvernight && !walkSession) {
      endexShownRef.current = true;
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
    () => kitItems.some((i) => isFoodItem(i) && isThermosFood(i.food)),
    [kitItems],
  );

  const hasSitPad = useMemo(
    () => kitItems.some((i) => i.id === SIT_PAD_ITEM_ID),
    [kitItems],
  );

  const redBullActive =
    !!redBullBuff && clockMinutes < redBullBuff.expiresAtClockMin;
  /** While crashing, HUD uses live mentalFatigue (drains toward pre-drink). */
  const effectiveMentalFatigue = mentalFatigue;
  const redBullMinutesLeft = redBullActive
    ? Math.max(0, redBullBuff!.expiresAtClockMin - clockMinutes)
    : 0;

  const fireStarter = useMemo(() => {
    const item = kitItems.find(
      (i) => isMiscItem(i) && isFireStarterMisc(i.misc),
    );
    if (!item || !isMiscItem(item)) return null;
    const qty = getInventoryQty(inventory, item.id);
    if (qty <= 0) return null;
    return {
      itemId: item.id,
      qty,
      minutesSaved: Math.max(0, item.misc.tyribalMinutesSaved ?? 15),
    };
  }, [kitItems, inventory]);

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
      distanceTravelledM,
      mentalStamina: staminaLeft(effectiveMentalFatigue),
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
      heartRateBpm: pulse.heartRateBpm,
    });
  }, [
    clockMinutes,
    distanceTravelledM,
    effectiveMentalFatigue,
    physicalFatigue,
    pulse.heartRateBpm,
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
          camoSneakPct,
          nerveRateMult: realismNerveRateMult(realism),
          zenMode,
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
      const stillHere = birdsInCell(birdsRef.current, pos).some(
        (b) => b.id === enc.birdId,
      );
      if (!stillHere) {
        birdEncounterRef.current = null;
        setBirdEncounter(null);
        return;
      }
      const outcome = flushOne(enc.birdId, enc.distanceM, enc.nerve);
      if (outcome.flushed) return;
      const next: BirdEncounter = { ...enc, nerve: outcome.nerve };
      birdEncounterRef.current = next;
      setBirdEncounter(next);
    }, 200);
    return () => window.clearInterval(id);
  }, [inAwareOrShoot, spotOpen, discoveredActive, map, camoSneakPct, skuddlysOpen, pos, realism, zenMode]);

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
    let mental = effectiveMentalFatigue;
    let physical = physicalFatigue;
    const loadFactor = packLoad.fatigueLoadFactor;
    for (const cell of path) {
      const effort = getCellEffort(activeMap.id, cell);
      const gain = fatigueFromStep(
        effort,
        usedPace,
        loadFactor,
        clothingFocusPct,
      );
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

  /** Body/mind + distance from Track ettersøk / tree recovery. */
  function applyEttersokEffort(opts: { minutes: number; distanceM: number }) {
    const dist = Math.max(0, opts.distanceM);
    if (dist > 0) {
      setDistanceTravelledM((d) => d + dist);
    }
    const gain = fatigueFromEttersokMinutes(
      opts.minutes,
      pace,
      packLoad.fatigueLoadFactor,
      clothingFocusPct,
    );
    setMentalFatigue((m) => clampFatigue(m + gain.mental));
    setPhysicalFatigue((p) => {
      const next = clampFatigue(p + gain.physical);
      triggerForcedRestIfNeeded(next);
      return next;
    });
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
    const trip = pathTravelMinutes(
      activeMap.id,
      pos,
      selected,
      usedPace,
      clothingSpeedPct,
    );
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
    advanceClockMinutes(walkSession.minutes, { skipPulse: true });
    setDistanceTravelledM(
      (d) => d + walkSession.path.length * CELL_WIDTH_M,
    );
    const nextFatigue = fatigueAfterPath(walkSession.path, usedPace);
    setMentalFatigue(nextFatigue.mental);
    setPhysicalFatigue(nextFatigue.physical);
    setPulse((prev) => {
      const exertion01 = exertionAfterWalk(prev.exertion01, {
        physicalStrain: usedPace.physicalStrain,
        speed: usedPace.speed,
        pathCells: walkSession.path.length,
      });
      return tickPulseState(
        { ...prev, exertion01 },
        {
          gameMinutes: walkSession.minutes,
          physicalFatigue: nextFatigue.physical,
          clockMinutes: Math.floor(clockSecondsRef.current / 60),
        },
      );
    });
    const arrivedAt = { ...walkSession.to };
    const leftFrom = { ...walkSession.from };
    const leaveUnfoundNote = mindHitLeavingUnfoundCell(leftFrom);
    leaveUnfoundMindCellRef.current = null;
    setPos(arrivedAt);
    lastSpotLrfRef.current = null;
    const nowMins = Math.floor(clockSecondsRef.current / 60);
    const nowDark = isHuntDark(nowMins);
    const arrivedParking = isAtParking(arrivedAt, activeMap);

    /** Drop pack birds in the car — lighter for the next leg of the hunt. */
    let carStashNote = "";
    if (arrivedParking && carcasses.length > 0) {
      const n = carcasses.length;
      onDepositCarcassesAtCar();
      carStashNote =
        n === 1
          ? " La fuglen i bilen — sekken er lettere."
          : ` La ${n} fugler i bilen — sekken er lettere.`;
    }

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

    // Discovered encounter + HUD BIRD bar must not follow you into another cell.
    setEngageResume(null);
    // Leaving the cell with rifle out → auto-mount (stresses unspotted birds here).
    const mountBump = mountFieldGun({
      silent: true,
      cell: walkSession.from,
    });
    const encAfterWalk = birdEncounterRef.current;
    if (encAfterWalk) {
      const stillHere = birdsInCell(flush.birds, arrivedAt).some(
        (b) => b.id === encAfterWalk.birdId,
      );
      if (!stillHere) {
        setBirdEncounter(null);
        birdEncounterRef.current = null;
      }
    }

    const walkLog =
      `Gikk til ${cellLabel(walkSession.to)} på ${walkSession.minutes} min (${usedPace.label}, ${walkSession.path.length} ruter).` +
      carStashNote +
      leaveUnfoundNote +
      (mountBump > 0
        ? ` Gun auto-mount — ${mountBump === 1 ? "uspottet fugl" : `${mountBump} uspottede`} +${Math.round(MOUNT_GUN_UNSPOTTED_NERVE * 100)}% nerve.`
        : "") +
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
      setLog(
        flushMessage(flush.events[0]!) +
          (leaveUnfoundNote ? leaveUnfoundNote : ""),
      );
      return;
    }

    setLog(walkLog);
    const prespotChance = prespotChanceForPace(
      walkSession.paceId,
      clothingFocusPct,
    );
    if (
      !nowDark &&
      prespotChance > 0 &&
      hasBinos &&
      Math.random() < prespotChance
    ) {
      // Must use arrivedAt — setPos is async; bare `pos` is still the cell we left.
      const prepared = prepareSpotAtPos({
        birdList: flush.birds,
        cell: arrivedAt,
      });
      if (prepared && prepared.birdPlacements.length > 0) {
        const focus =
          prepared.birdPlacements[
            Math.floor(Math.random() * prepared.birdPlacements.length)
          ]!;
        pendingForcedRestRef.current = nextFatigue.physical >= 1;
        setPrespotReveal({
          imageSrc: pickPrespottedImage(),
          spot: {
            ...prepared,
            initialMode: "binos",
            initialPan: panToCenterOnBird(focus, binosWorldZoom),
          },
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
    // After post-shot companion flushes — keep shot log / pending Track UI.
    if (pendingPostShot || postShotGhostRef.current) {
      setPanel("arrived");
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
    setEngageResume(null);
    setShootSession(null);
    setAwareSession(null);
    setFieldGunDeployed(false);
    setScopeMarkedAware(null);
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

  /** Chestrig QR: bird-nerve when raising binos/thermal. */
  function applyChestrigQrOnOpticsRaise(
    placements: BirdVisualPlacement[],
  ): number {
    const qrBump = chestrigOpticsRaiseNerve(kitItems);
    if (qrBump <= 0 || placements.length === 0) return 0;
    const present = new Set(placements.map((p) => p.birdId));
    const next = { ...latentSpotNerveRef.current };
    for (const id of present) {
      const entry = next[id];
      if (!entry) continue;
      next[id] = {
        ...entry,
        nerve: Math.min(ENCOUNTER_NERVE.nerveCap, entry.nerve + qrBump),
      };
    }
    latentSpotNerveRef.current = next;

    const enc = birdEncounterRef.current;
    if (enc?.discovered && present.has(enc.birdId)) {
      const synced: BirdEncounter = {
        ...enc,
        nerve: Math.min(ENCOUNTER_NERVE.nerveCap, enc.nerve + qrBump),
      };
      birdEncounterRef.current = synced;
      setBirdEncounter(synced);
    }
    return qrBump;
  }

  /**
   * Put the rifle back in the pack. Unspotted birds in this cell get +30% nerve.
   * No-op if already mounted. Spotted/engaged bird is not bumped.
   */
  function mountFieldGun(opts?: { silent?: boolean; cell?: HuntGridCell }) {
    if (!fieldGunDeployedRef.current) return 0;
    setFieldGunDeployed(false);
    const at = opts?.cell ?? pos;
    const here = birdsInCell(birds, at);
    const spottedId =
      birdEncounterRef.current?.discovered
        ? birdEncounterRef.current.birdId
        : null;
    const next = { ...latentSpotNerveRef.current };
    let bumped = 0;
    for (const b of here) {
      if (spottedId && b.id === spottedId) continue;
      // Already LRF/eyes-locked into Aware contacts count as spotted.
      if (birdMapContacts[b.id]) continue;
      const entry = next[b.id] ?? {
        distanceM: b.distanceM,
        nerve: initialEncounterNerve(b.spookCount),
      };
      next[b.id] = {
        ...entry,
        nerve: Math.min(
          ENCOUNTER_NERVE.nerveCap,
          entry.nerve + MOUNT_GUN_UNSPOTTED_NERVE,
        ),
      };
      bumped += 1;
    }
    latentSpotNerveRef.current = next;
    if (!opts?.silent) {
      const pct = Math.round(MOUNT_GUN_UNSPOTTED_NERVE * 100);
      setLog(
        bumped > 0
          ? `Gun mounted — ${bumped === 1 ? "uspottet fugl" : `${bumped} uspottede fugler`} +${pct}% nervøsitet.`
          : "Gun mounted — rifla i sekken.",
      );
    }
    return bumped;
  }

  function maybeMorphOwlIntoSpot(
    birdList: HuntBird[],
    placements: BirdVisualPlacement[],
  ): { birds: HuntBird[]; placements: BirdVisualPlacement[] } {
    if (
      !shouldOfferOwl({
        lifetimeTiur,
        lifetimeOrrhaner,
        lifetimeUgle,
        owlLastOfferedMilestone,
      })
    ) {
      return { birds: birdList, placements };
    }
    if (placements.length === 0) {
      return { birds: birdList, placements };
    }
    const morphed = morphSpotBirdToOwl(birdList, placements);
    const milestone = owlMilestoneForBagged(
      lifetimeGamebirdsBagged(lifetimeTiur, lifetimeOrrhaner),
    );
    if (milestone != null) onOwlOffered?.(milestone);
    return morphed;
  }

  function prepareSpotAtPos(opts?: {
    reuseImageSrc?: string | null;
    birdList?: HuntBird[];
    /** Explicit cell — required when called in the same tick as setPos (async). */
    cell?: HuntGridCell;
    /**
     * After Aware walk: force perch distances to stand→bird geometry so the
     * next Spot LRF is not stuck on the original perch range.
     */
    distanceByBirdId?: Record<
      string,
      { distanceM: number; fromDistanceM?: number }
    >;
  }): SpotSession | null {
    if (!canHuntAtTime(clockMinutes)) return null;

    const birdList = opts?.birdList ?? birds;
    const at = opts?.cell ?? pos;
    const cellKey = `${at.row},${at.col}`;
    const marked = spotImagesWithPerches();
    const isUsableSpotSrc = (src: string) =>
      marked.length === 0 ||
      marked.includes(src) ||
      src.startsWith("/images/spot/") ||
      isCloudSpotImage(src);
    const forced = map ? forcedSpotImageForCell(map.id, at) : null;
    const reservedForced = map ? forcedSpotImagesForMap(map.id) : [];
    const preferred =
      !forced &&
      opts?.reuseImageSrc &&
      isUsableSpotSrc(opts.reuseImageSrc)
        ? opts.reuseImageSrc
        : null;
    const cached = spotLayoutByCell[cellKey];
    const cachedOk =
      cached &&
      isUsableSpotSrc(cached.imageSrc) &&
      (!forced || cached.imageSrc === forced)
        ? cached
        : null;
    const imageSrc =
      forced ??
      preferred ??
      cachedOk?.imageSrc ??
      (() => {
        const pool = marked.length > 0 ? marked : [];
        // Keep reserved forced scenes out of the live deck this cycle.
        for (const src of reservedForced) {
          removeSpotImageFromDeck(spotImageDeckRef.current, src);
        }
        const drawn = drawImageWithoutReplacement(
          spotImageDeckRef.current,
          pool.length > 0 ? pool : ["/images/spot/spot1.png"],
          {
            avoidSrc: lastSpotImageDrawnRef.current,
            // Forced cell images stay reserved until the deck reshuffles.
            excludeSrcs: reservedForced,
          },
        );
        lastSpotImageDrawnRef.current = drawn;
        return drawn;
      })();
    // Forced cell: consume from deck so the scene is not re-dealt randomly
    // before the spotting pool is exhausted / reshuffled.
    if (forced) {
      removeSpotImageFromDeck(spotImageDeckRef.current, forced);
      lastSpotImageDrawnRef.current = forced;
    }

    const here = birdsInCell(birdList, at);
    const hereIds = new Set(here.map((b) => b.id));

    function applyDistancePatches(
      placements: BirdVisualPlacement[],
    ): BirdVisualPlacement[] {
      const patches = opts?.distanceByBirdId;
      if (!patches) return placements;
      return placements.map((p) => {
        const patch = patches[p.birdId];
        if (!patch) return p;
        const nextDist = Math.max(40, Math.round(patch.distanceM));
        if (Math.abs(nextDist - p.distanceM) < 0.5) return p;
        const from = patch.fromDistanceM ?? p.distanceM;
        return {
          ...p,
          distanceM: nextDist,
          widthPct: rescaleSpriteWidthPct(p.widthPct, from, nextDist),
        };
      });
    }

    if (cachedOk && cachedOk.imageSrc === imageSrc) {
      const sticky = cachedOk.placements.filter((p) => hereIds.has(p.birdId));
      // Stale cache (birds flushed / replaced) with live birds here → rebind.
      if (sticky.length > 0 || here.length === 0) {
        const viewBearingDeg = Number.isFinite(cachedOk.viewBearingDeg)
          ? cachedOk.viewBearingDeg
          : rollSpotViewBearingDeg();
        const owl = maybeMorphOwlIntoSpot(birdList, sticky);
        const placements = applyDistancePatches(owl.placements);
        setSpotLayoutByCell((prev) => ({
          ...prev,
          [cellKey]: {
            imageSrc,
            placements,
            viewBearingDeg,
          },
        }));
        const syncedBirds = owl.birds.map((b) => {
          const p = placements.find((x) => x.birdId === b.id);
          return p ? { ...b, distanceM: p.distanceM, species: p.species } : b;
        });
        setBirds(syncedBirds);
        seedLatentSpotNerve(placements, syncedBirds);
        return {
          imageSrc,
          birdPlacements: placements,
          viewBearingDeg,
        };
      }
    }

    const viewBearingDeg = rollSpotViewBearingDeg();
    const bound = bindBirdsToSpotImage(birdList, at, imageSrc, {
      fillAllPerches: false,
    });
    const owl = maybeMorphOwlIntoSpot(bound.birds, bound.placements);
    const placements = applyDistancePatches(owl.placements);
    const syncedBirds = owl.birds.map((b) => {
      const p = placements.find((x) => x.birdId === b.id);
      return p ? { ...b, distanceM: p.distanceM, species: p.species } : b;
    });
    setSpotLayoutByCell((prev) => ({
      ...prev,
      [cellKey]: {
        imageSrc,
        placements,
        viewBearingDeg,
      },
    }));
    setBirds(syncedBirds);
    seedLatentSpotNerve(placements, syncedBirds);
    return {
      imageSrc,
      birdPlacements: placements,
      viewBearingDeg,
    };
  }

  function beginSpot(opts?: {
    reuseImageSrc?: string | null;
    initialMode?: SpotMode;
    focusBirdId?: string;
    distanceByBirdId?: Record<
      string,
      { distanceM: number; fromDistanceM?: number }
    >;
  }) {
    if (!canHuntAtTime(clockMinutes)) {
      setLog("Skuddlys over (17:00) — ingen jakt før i morgen.");
      return;
    }
    const prepared = prepareSpotAtPos({
      reuseImageSrc: opts?.reuseImageSrc,
      distanceByBirdId: opts?.distanceByBirdId,
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
      initialPan = panToCenterOnBird(focus, binosWorldZoom);
      initialMode = initialMode ?? "binos";
    }

    setSpotSession({
      ...prepared,
      initialMode,
      initialPan,
    });
    const qrBump = applyChestrigQrOnOpticsRaise(prepared.birdPlacements);
    if (qrBump > 0) {
      setLog(
        `Kikkert opp — chestrig QR: +${Math.round(qrBump * 100)}% bird-nerve.`,
      );
    }
  }

  function finishPrespotReveal() {
    if (!prespotReveal) return;
    const spot = prespotReveal.spot;
    setPrespotReveal(null);
    const qrBump = applyChestrigQrOnOpticsRaise(spot.birdPlacements);
    setLog(
      qrBump > 0
        ? `Du går forsiktig og observant og ser fuglen før den ser deg — kikkert klar (+${Math.round(qrBump * 100)}% nerve fra QR).`
        : "Du går forsiktig og observant og ser fuglen før den ser deg — kikkert klar.",
    );
    setSpotSession(spot);
  }

  function finishSpot(info: { mode: SpotMode; gameSeconds: number }) {
    const lookMin = info.gameSeconds / 60;
    const strain =
      (info.mode === "binos" || info.mode === "thermal"
        ? 0.02 * pace.mentalStrain
        : 0.015 * pace.mentalStrain) *
      Math.max(0, 1 - clothingFocusPct / 100);
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
      visibleInSpotMode(p.distanceM, info.mode, {
        eyesVisible: p.eyesVisible,
      }),
    );
    const hiddenFar =
      info.mode === "eyes"
        ? placements.filter(
            (p) =>
              !visibleInSpotMode(p.distanceM, "eyes", {
                eyesVisible: p.eyesVisible,
              }),
          )
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
    setEngageResume(null);
    if (pendingForcedRestRef.current) {
      pendingForcedRestRef.current = false;
      setForcedRest({ imageSrc: REST_TIRED_IMAGE });
    } else {
      setPanel("arrived");
    }
  }

  function onBirdObserved(
    info: {
      placement: BirdVisualPlacement;
      measuredDistanceM: number;
      gameSeconds: number;
      rangeSource: "lrf" | "estimated";
    },
    opts?: {
      /** Lock contact but stay in current UI (gun-scope mark). */
      deferOpen?: boolean;
      /** Restore Deploy gun when Aware finally opens. */
      returnGunDeployed?: boolean;
    },
  ): AwareSession | null {
    if (!canHuntAtTime(clockMinutes)) {
      setSpotSession(null);
      setEngageResume(null);
      setLog("Skuddlys over — du rekker ikke å gå til skudd nå.");
      if (!opts?.deferOpen) setPanel("arrived");
      return null;
    }
    const imageSrc =
      spotSession?.imageSrc ??
      shootSession?.imageSrc ??
      spotLayoutByCell[`${pos.row},${pos.col}`]?.imageSrc ??
      pickSpotImage();
    const viewBearingDeg =
      spotSession?.viewBearingDeg ??
      spotLayoutByCell[`${pos.row},${pos.col}`]?.viewBearingDeg ??
      rollSpotViewBearingDeg();
    if (spotSession?.imageSrc || imageSrc) {
      const cellKey = `${pos.row},${pos.col}`;
      const placements =
        spotSession?.birdPlacements ??
        shootSession?.scanBirdPlacements ??
        spotLayoutByCell[cellKey]?.placements ??
        [];
      setSpotLayoutByCell((prev) => {
        const cur = prev[cellKey];
        if (
          cur?.imageSrc === imageSrc &&
          cur.placements === placements
        ) {
          return prev;
        }
        return {
          ...prev,
          [cellKey]: {
            imageSrc,
            placements:
              placements.length > 0 ? placements : (cur?.placements ?? []),
            viewBearingDeg,
          },
        };
      });
    }
    const lookMin = info.gameSeconds / 60;
    setMentalFatigue((m) =>
      clampFatigue(
        m +
          0.02 *
            pace.mentalStrain *
            Math.max(0, 1 - clothingFocusPct / 100) *
            Math.max(1, lookMin),
      ),
    );
    const spotPulse =
      info.placement.species === "tiur"
        ? PULSE_SPOT_TIUR_BPM
        : info.placement.species === "orrhane"
          ? PULSE_SPOT_ORRE_BPM
          : 0;
    if (spotPulse > 0) {
      setPulse((prev) => bumpHeartRateBpm(prev, spotPulse));
    }
    const birdId = info.placement.birdId;
    const prior = birdMapContacts[birdId];
    const stand = recalledAwareStand();
    /**
     * After walking on Aware and returning to Spot, perch cache may lag.
     * Prefer stand→bird geometry whenever the bird seat is already known.
     */
    const placementTrue = info.placement.distanceM;
    const mPerPct = map ? awareMetersPerPctFor(map) : undefined;
    const maxM = map ? awareMapMaxMFor(map) : undefined;
    const trueDist =
      prior?.birdPos != null
        ? Math.max(
            40,
            Math.round(distanceMBetween(stand, prior.birdPos, mPerPct)),
          )
        : placementTrue;
    let measured: number;
    if (hasExactBallistics) {
      measured = Math.round(trueDist);
    } else if (
      info.rangeSource === "lrf" &&
      placementTrue > 0 &&
      Math.abs(trueDist - placementTrue) > 0.5
    ) {
      measured = Math.max(
        40,
        Math.round(trueDist * (info.measuredDistanceM / placementTrue)),
      );
    } else {
      measured = info.measuredDistanceM;
    }
    // Same bird → same Aware-map seat; first lock follows spotting compass + frame X.
    // Place at true range from the stand (cell centre) using this terrain's Aware scale
    // so green-bracket (240–300 m) etc. land at the correct map distance.
    const birdBearing =
      prior?.bearingDeg ??
      bearingFromSpotFrame(viewBearingDeg, info.placement.x);
    const rawBirdPos =
      prior?.birdPos ??
      birdMarkerOnAwareMap(trueDist, birdBearing, {
        origin: stand,
        maxM,
      });
    /**
     * Corner stands + long range can place the seat outside 0–100 %.
     * Ettersøk needs clickable track points — pull onto the stage and
     * recompute stand→bird range from the clamped seat.
     */
    const birdPos = ensureCellPointOnAwareMap(rawBirdPos);
    const lockedTrueDist = isCellPointOnAwareMap(rawBirdPos)
      ? trueDist
      : Math.max(
          40,
          Math.round(distanceMBetween(stand, birdPos, mPerPct)),
        );
    if (!prior || !isCellPointOnAwareMap(prior.birdPos)) {
      setBirdMapContacts((prev) => ({
        ...prev,
        [birdId]: { bearingDeg: birdBearing, birdPos },
      }));
    }
    // Measured range follows clamped geometry when the raw seat was off-map.
    if (lockedTrueDist !== trueDist) {
      if (hasExactBallistics) {
        measured = Math.round(lockedTrueDist);
      } else if (info.rangeSource === "lrf" && placementTrue > 0) {
        measured = Math.max(
          40,
          Math.round(lockedTrueDist * (info.measuredDistanceM / placementTrue)),
        );
      } else {
        measured = Math.round(lockedTrueDist);
      }
    }
    const cw = crosswindMs(
      weather.live.windSpeedMs,
      weather.live.windFromDeg,
      birdBearing,
    );
    const density = densityRatioFromTempC(weather.live.temperatureC);
    let hold: BallisticHoldSolution | null = null;
    if (hasExactBallistics && primaryAmmo) {
      const solve = kestrelSolveAmmo(
        primaryAmmo.ammo,
        primaryAmmo.id,
        kestrelProfiles,
        realSolveArg,
      );
      hold = exactBallisticHold(solve.ammo, measured, cw, {
        densityRatio: density,
        powderTempC: weather.live.temperatureC,
        dvDtMpsPerC: solve.dvDtMpsPerC,
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
      distanceM: lockedTrueDist,
      nerve: startNerve,
      discovered: true,
    };
    birdEncounterRef.current = enc;
    setBirdEncounter(enc);
    latentSpotNerveRef.current[birdId] = {
      distanceM: lockedTrueDist,
      nerve: startNerve,
    };

    if (!opts?.deferOpen) {
      setSpotSession(null);
      setEngageResume(null);
    }
    const cellCentre = map ? cellCenterOnAwareMap(pos, map) : { x: 50, y: 50 };
    const resumedStand =
      Math.abs(stand.x - cellCentre.x) > 0.5 ||
      Math.abs(stand.y - cellCentre.y) > 0.5;
    const session: AwareSession = {
      imageSrc,
      bird: {
        ...info.placement,
        distanceM: lockedTrueDist,
        widthPct:
          Math.abs(lockedTrueDist - placementTrue) > 0.5
            ? rescaleSpriteWidthPct(
                info.placement.widthPct,
                placementTrue,
                lockedTrueDist,
              )
            : info.placement.widthPct,
      },
      trueDistanceM: lockedTrueDist,
      measuredDistanceM: measured,
      ballisticHold: hold,
      crosswindMs: cw,
      birdBearingDeg: birdBearing,
      densityRatio: density,
      hunterPos: stand,
      birdPos,
      rangeSource: info.rangeSource,
      returnGunDeployed:
        !!opts?.returnGunDeployed || fieldGunDeployedRef.current,
      gunPrepOnly: false,
    };
    if (opts?.deferOpen) {
      return session;
    }
    setAwareSession(session);
    setLog(
      (resumedStand
          ? "Du står der du var sist i denne cella. "
          : "") +
        (info.rangeSource === "lrf"
          ? hold
            ? `LRF ${measured} m — fugl merket i Aware (${Math.round(birdBearing)}°). Kestrel fasit: ${formatHoldClicks(hold)}.`
            : `LRF ${measured} m — fugl merket i Aware (${Math.round(birdBearing)}°). Sjekk bakgrunn og vind.`
          : `Fugl merket i Aware (${Math.round(birdBearing)}° · ca. ${measured} m). Sjekk bakgrunn og vind.`),
    );
    return session;
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

  function rememberAwareStand(stand: CellPoint | null | undefined) {
    if (!stand) return;
    const key = `${pos.row},${pos.col}`;
    setAwareStandByCell((prev) => {
      const cur = prev[key];
      if (cur && Math.abs(cur.x - stand.x) < 0.05 && Math.abs(cur.y - stand.y) < 0.05) {
        return prev;
      }
      return { ...prev, [key]: { x: stand.x, y: stand.y } };
    });
  }

  function recalledAwareStand(): CellPoint {
    const key = `${pos.row},${pos.col}`;
    if (awareStandByCell[key]) return awareStandByCell[key]!;
    // Default: centre of the active hunt cell (not the full-map midpoint).
    return map
      ? cellCenterOnAwareMap(pos, map)
      : { x: 50, y: 50 };
  }

  /**
   * Unfinished hent/søk birds still in this cell (saved for later Track).
   */
  function unfinishedPairsInCell(cell: HuntGridCell): ShotPair[] {
    return shotPairs.filter(
      (p) =>
        p.cell.row === cell.row &&
        p.cell.col === cell.col &&
        p.found == null &&
        !!p.harvestDraft &&
        (p.resultKind === "instant_kill" ||
          p.resultKind === "vital_kill" ||
          p.resultKind === "ettersok"),
    );
  }

  /**
   * Leaving a kartrute / søk without finding open birds: same −30 % mind as
   * Gi opp, but pairs stay for later. Dedupes Til spotting → walk same leave.
   */
  function mindHitLeavingUnfoundCell(from: HuntGridCell): string {
    if (unfinishedPairsInCell(from).length === 0) return "";
    const key = `${from.row},${from.col}`;
    if (leaveUnfoundMindCellRef.current === key) return "";
    leaveUnfoundMindCellRef.current = key;
    setMentalFatigue((m) => applyEttersokMentalSetback(m));
    return " Du går fra en kartrute uten funn av fugl og mister 30 % mind.";
  }

  /**
   * Leave ettersøk / Track to spotting without giving up the bird.
   * Only {@link abandonEttersok} («Gi opp søket») marks the bird lost.
   * Leaving without a find still costs −30 % mind (same as Gi opp); bird stays.
   */
  function leaveEttersokToSpotting(opts?: AwareLeaveOpts) {
    rememberAwareStand(opts?.hunter);
    const session = awareSession;
    if (!session?.ettersokPairId) {
      backToSpotFromAware(opts);
      return;
    }
    const pair = shotPairs.find((p) => p.id === session.ettersokPairId);
    if (pair?.found === true) {
      harvestFoundPair(pair);
      mountFieldGun({ silent: true });
      setAwareSession(null);
      setPanel("arrived");
      setLog(
        session.recoveryOnly
          ? "Fugl hentet — i sekken."
          : "Ettersøk lyktes — fuglen er i sekken.",
      );
      return;
    }
    const mindNote =
      pair != null && pair.found == null
        ? mindHitLeavingUnfoundCell(pair.cell)
        : "";
    setAwareSession(null);
    if (canHuntAtTime(clockMinutes)) {
      beginSpot({
        reuseImageSrc: session.imageSrc,
        initialMode: "binos",
      });
      setLog(
        (session.recoveryOnly
          ? "Til spotting — husk å hente fuglen ved treet (Hent/søk)."
          : "Til spotting — søket er ikke avsluttet. Speid videre, eller åpne Hent/søk når du er klar.") +
          mindNote,
      );
      return;
    }
    setPanel("arrived");
    setLog(
      (session.recoveryOnly
        ? "Tilbake til kart — husk å hente fuglen ved treet (Hent/søk)."
        : "Tilbake til kart — søket er ikke avsluttet. Åpne Hent/søk når du er klar.") +
        mindNote,
    );
  }

  function abortAware(opts?: AwareLeaveOpts) {
    rememberAwareStand(opts?.hunter);
    if (awareSession?.ettersokPairId) {
      leaveEttersokToSpotting(opts);
      return;
    }
    setAwareSession(null);
    setEngageResume(null);
    setBirdEncounter(null);
    setLog("Du lukker Aware. Fuglen er fortsatt der.");
    setPanel("arrived");
  }

  /** Leave Aware stalk back to Spot — nerve keeps running; Engage stays live. */
  function backToSpotFromAware(opts?: AwareLeaveOpts) {
    rememberAwareStand(opts?.hunter);
    if (awareSession?.ettersokPairId) {
      leaveEttersokToSpotting(opts);
      return;
    }
    const session = awareSession;
    const hunter = opts?.hunter ?? recalledAwareStand();
    const stickyGun =
      opts?.gunDeployed ?? fieldGunDeployedRef.current;
    const stickyRest =
      stickyGun && opts?.rest && opts.rest !== "none" ? opts.rest : "none";
    const stickyBagrider =
      stickyGun && stickyRest !== "none" && !!opts?.bagriderActive;
    const stickyKestrel = !!opts?.kestrelEnviroReady;
    if (stickyGun) setFieldGunDeployed(true);
    /**
     * Across Til spotting: keep Deploy / sekk|tofot / Kestrel (nerve already paid).
     * Camcorder, chrono and triggercam must be set up again.
     */
    const stickyGear = {
      returnGunDeployed: stickyGun,
      returnRest: stickyRest as HuntShootRest,
      returnBagriderActive: stickyBagrider,
      returnKestrelEnviroActive: stickyKestrel,
      returnCamcorderActive: false,
      returnChronoActive: false,
      returnTriggercamActive: false,
    };
    let distanceByBirdId:
      | Record<string, { distanceM: number; fromDistanceM?: number }>
      | undefined;
    if (session?.birdPos) {
      const newDist = Math.max(
        40,
        Math.round(
          distanceMBetween(
            hunter,
            session.birdPos,
            map ? awareMetersPerPctFor(map) : undefined,
          ),
        ),
      );
      const fromDist = session.trueDistanceM || session.bird.distanceM;
      distanceByBirdId = {
        [session.bird.birdId]: {
          distanceM: newDist,
          fromDistanceM: fromDist,
        },
      };
      const nerve =
        birdEncounterRef.current?.birdId === session.bird.birdId
          ? birdEncounterRef.current.nerve
          : (latentSpotNerveRef.current[session.bird.birdId]?.nerve ??
            birdEncounterRef.current?.nerve ??
            0);
      const enc: BirdEncounter = {
        birdId: session.bird.birdId,
        distanceM: newDist,
        nerve,
        discovered: true,
      };
      birdEncounterRef.current = enc;
      setBirdEncounter(enc);
      latentSpotNerveRef.current[session.bird.birdId] = {
        distanceM: newDist,
        nerve,
      };
      // Snapshot for sticky Engage — reopen Aware without a new LRF.
      setEngageResume({
        ...session,
        hunterPos: hunter,
        trueDistanceM: newDist,
        bird: {
          ...session.bird,
          distanceM: newDist,
          widthPct: rescaleSpriteWidthPct(
            session.bird.widthPct,
            fromDist,
            newDist,
          ),
        },
        returnNerve: nerve,
        ...stickyGear,
      });
    } else if (session) {
      const nerve =
        birdEncounterRef.current?.birdId === session.bird.birdId
          ? birdEncounterRef.current.nerve
          : (session.returnNerve ?? birdEncounterRef.current?.nerve ?? 0);
      const enc: BirdEncounter = {
        birdId: session.bird.birdId,
        distanceM: session.trueDistanceM,
        nerve,
        discovered: true,
      };
      birdEncounterRef.current = enc;
      setBirdEncounter(enc);
      setEngageResume({
        ...session,
        hunterPos: hunter,
        returnNerve: nerve,
        ...stickyGear,
      });
    }
    setAwareSession(null);
    beginSpot({
      reuseImageSrc: session?.imageSrc,
      distanceByBirdId,
      // Do not focusBirdId / panToCenterOnBird — that would snap binos onto the
      // bird after Aware (cheat). Player must find it again in the landscape.
      initialMode: "binos",
    });
    setLog(
      stickyGun
        ? stickyRest !== "none"
          ? "Til spotting — gun/anlegg/Kestrel følger med. Camcorder, chrono og triggercam må settes opp på nytt."
          : "Til spotting — gun følger med. Camcorder, chrono og triggercam må settes opp på nytt."
        : "Til spotting — mål gjerne avstand på nytt. Engage er fortsatt aktiv.",
    );
  }

  /** Re-open Aware from sticky Engage (after Til spotting). */
  function resumeEngageFromSpot() {
    const session = engageResume;
    if (!session) return;
    if (!canHuntAtTime(clockMinutes)) {
      setLog("Skuddlys over — du rekker ikke å gå til skudd nå.");
      return;
    }
    const hunter = recalledAwareStand();
    let next: AwareSession = {
      ...session,
      hunterPos: hunter,
    };
    if (session.birdPos) {
      const newDist = Math.max(
        40,
        Math.round(
          distanceMBetween(
            hunter,
            session.birdPos,
            map ? awareMetersPerPctFor(map) : undefined,
          ),
        ),
      );
      const fromDist = session.trueDistanceM || session.bird.distanceM;
      next = {
        ...next,
        trueDistanceM: newDist,
        measuredDistanceM: session.measuredDistanceM,
        bird: {
          ...session.bird,
          distanceM: newDist,
          widthPct: rescaleSpriteWidthPct(
            session.bird.widthPct,
            fromDist,
            newDist,
          ),
        },
      };
      const nerve =
        birdEncounterRef.current?.birdId === session.bird.birdId
          ? birdEncounterRef.current.nerve
          : (session.returnNerve ?? 0);
      const enc: BirdEncounter = {
        birdId: session.bird.birdId,
        distanceM: newDist,
        nerve,
        discovered: true,
      };
      birdEncounterRef.current = enc;
      setBirdEncounter(enc);
      next = { ...next, returnNerve: nerve };
    } else {
      const nerve =
        birdEncounterRef.current?.birdId === session.bird.birdId
          ? birdEncounterRef.current.nerve
          : (session.returnNerve ?? 0);
      setBirdEncounter({
        birdId: session.bird.birdId,
        distanceM: session.trueDistanceM,
        nerve,
        discovered: true,
      });
      birdEncounterRef.current = {
        birdId: session.bird.birdId,
        distanceM: session.trueDistanceM,
        nerve,
        discovered: true,
      };
    }
    setSpotSession(null);
    setEngageResume(null);
    if (fieldGunDeployedRef.current) {
      next = {
        ...next,
        returnGunDeployed: true,
        returnRest: next.returnRest ?? session.returnRest ?? "none",
      };
    }
    setAwareSession(next);
    setLog("Tilbake til Aware — fortsett sneak / skudd.");
  }

  /**
   * Give up wounded ettersøk without a find — bird lost, mental stamina −30%.
   * Only via «Gi opp søket» for the active Track bird (not Til spotting).
   * Shows a dedicated pause view (like flukt) so the consequence is not buried in the log.
   */
  function abandonEttersok(pairId: string) {
    const pair = shotPairs.find((p) => p.id === pairId);
    if (pair && pair.found !== true) {
      setShotPairs((prev) =>
        prev.map((p) => (p.id === pairId ? { ...p, found: false } : p)),
      );
      setMentalFatigue((m) =>
        applyEttersokMentalSetback(m),
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

    if (stance?.scopeReview && stance.gunDeployed) {
      openScopeReviewFromAware(stance);
      return;
    }

    // Found birds must bag even after skuddlys — ettersøk often runs past 17:00.
    if (awareSession.ettersokPairId) {
      const pair = shotPairs.find((p) => p.id === awareSession.ettersokPairId);
      if (
        pair &&
        (pair.cell.row !== pos.row || pair.cell.col !== pos.col)
      ) {
        setLog(
          `Gå til ${cellLabel(pair.cell)} for å fortsette hent/søk. Du er i ${cellLabel(pos)}.`,
        );
        return;
      }
      if (pair?.found === true) {
        harvestFoundPair(pair);
        mountFieldGun({ silent: true });
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
        const mindNote =
          pair != null && pair.found == null
            ? mindHitLeavingUnfoundCell(pair.cell)
            : "";
        setLog(
          (pair?.found === false
            ? "Du fant ikke treet. Skuddmarkøren er lagret — åpne Hent/søk senere."
            : "Skuddmarkør lagret. Husk å hente fuglen ved treet (Hent/søk).") +
            mindNote,
        );
        setAwareSession(null);
        setPanel("arrived");
        return;
      }
      // Wounded bird still missing — abandoning ettersøk.
      abandonEttersok(awareSession.ettersokPairId);
      return;
    }
    if (!canHuntAtTime(clockMinutes) && !awareSession.gunPrepOnly) {
      setAwareSession(null);
      setLog("Skuddlys over (17:00) — ingen skudd i mørket.");
      setPanel("arrived");
      return;
    }
    const session = awareSession;
    const bearingDeg = stance?.bearingDeg ?? session.birdBearingDeg;
    const hunterStand =
      stance?.hunter ??
      session.hunterPos ??
      (map ? cellCenterOnAwareMap(pos, map) : { x: 50, y: 50 });
    const rawBirdPt =
      stance?.bird ??
      session.birdPos ??
      birdMarkerOnAwareMap(session.trueDistanceM, bearingDeg, {
        origin: hunterStand,
        maxM: map ? awareMapMaxMFor(map) : undefined,
      });
    if (!session.gunPrepOnly && !isCellPointOnAwareMap(rawBirdPt)) {
      setLog(
        "Fuglen er utenfor kartet — kan ikke skyte (ettersøk krever søkespor på kartet). Gå til en stand der fuglen ligger på kartet, eller Avbryt og lås på nytt.",
      );
      return;
    }
    const birdPt = ensureCellPointOnAwareMap(rawBirdPt);
    /**
     * Ballistics truth = stand → bird after walking to a safe Aware seat —
     * never the stale spotting LRF range.
     */
    const trueDistanceM = Math.max(
      40,
      Math.round(
        stance?.distanceM ??
          distanceMBetween(
            hunterStand,
            birdPt,
            map ? awareMetersPerPctFor(map) : undefined,
          ),
      ),
    );
    /** Keep original LRF scale bias on the new true range (unless AB is exact). */
    let measuredDistanceM = trueDistanceM;
    if (
      !hasExactBallistics &&
      session.rangeSource === "lrf" &&
      session.trueDistanceM > 0
    ) {
      const bias = session.measuredDistanceM / session.trueDistanceM;
      measuredDistanceM = Math.max(
        40,
        Math.round(trueDistanceM * bias),
      );
    }
    const cw = crosswindMs(
      weather.live.windSpeedMs,
      weather.live.windFromDeg,
      bearingDeg,
    );
    const density = densityRatioFromTempC(weather.live.temperatureC);
    let hold = session.ballisticHold;
    if (hasExactBallistics && primaryAmmo) {
      const solve = kestrelSolveAmmo(
        primaryAmmo.ammo,
        primaryAmmo.id,
        kestrelProfiles,
        realSolveArg,
      );
      hold = exactBallisticHold(solve.ammo, trueDistanceM, cw, {
        densityRatio: density,
        powderTempC: weather.live.temperatureC,
        dvDtMpsPerC: solve.dvDtMpsPerC,
      });
    }
    setAwareSession(null);
    const baseNerve = Math.max(
      0,
      stance?.birdNerve ?? birdEncounterRef.current?.nerve ?? 0,
    );
    const nerve = Math.min(ENCOUNTER_NERVE.nerveCap, baseNerve);
    rememberAwareStand(hunterStand);
    if (!session.gunPrepOnly) {
      setBirdEncounter((prev) => {
        const next: BirdEncounter = {
          birdId: session.bird.birdId,
          distanceM: trueDistanceM,
          nerve,
          discovered: true,
        };
        birdEncounterRef.current = prev
          ? { ...prev, distanceM: trueDistanceM, nerve, discovered: true }
          : next;
        return birdEncounterRef.current;
      });
    }
    const layoutKey = `${pos.row},${pos.col}`;
    const scanBirdPlacements = session.gunPrepOnly
      ? (spotLayoutByCell[layoutKey]?.placements.filter(
          (p) => p.birdId !== "aware-review",
        ) ?? [])
      : undefined;
    const prepBird =
      session.gunPrepOnly && scanBirdPlacements && scanBirdPlacements.length > 0
        ? {
            ...session.bird,
            distanceM: trueDistanceM,
            widthPct: medianPlacementWidthPct(scanBirdPlacements, 2),
            x: 50,
            y: 50,
          }
        : {
            ...session.bird,
            distanceM: trueDistanceM,
            // Keep perch/sprite factors; angular size tracks the new stand range.
            widthPct: rescaleSpriteWidthPct(
              session.bird.widthPct,
              session.trueDistanceM,
              trueDistanceM,
            ),
          };
    setShootSession({
      imageSrc: session.imageSrc,
      bird: prepBird,
      trueDistanceM,
      measuredDistanceM,
      ballisticHold: hold,
      crosswindMs: cw,
      densityRatio: density,
      bearingDeg,
      hunterPos: hunterStand,
      birdPos: birdPt,
      camcorderActive: !!stance?.camcorderActive,
      chronoActive: !!stance?.chronoActive,
      kestrelEnviroActive: !!stance?.kestrelEnviroActive,
      triggercamActive: !!stance?.triggercamActive,
      gunDeployed: !!stance?.gunDeployed,
      rest: stance?.rest ?? "none",
      bagriderActive: !!stance?.bagriderActive && (stance?.rest === "backpack" || stance?.rest === "bipod"),
      gunPrepOnly: !!session.gunPrepOnly,
      scanBirdPlacements,
      rangeSource: session.rangeSource,
      birdNerve: nerve,
    });
    const restNote =
      stance?.rest && stance.rest !== "none"
        ? ` · ${shootRestLabelNb(stance.rest, !!stance.bagriderActive)}-anlegg`
        : "";
    const prepNote = session.gunPrepOnly ? " · Gun (tårn-prep)" : "";
    setLog(
      hold
        ? `Bakgrunn OK · Kestrel fasit ${formatHoldClicks(hold)} — skru tårnene · ${Math.round(bearingDeg)}° · ${trueDistanceM} m${stance?.camcorderActive ? " · camcorder filmer" : ""}${stance?.chronoActive ? " · chrono klar" : ""}${stance?.kestrelEnviroActive ? " · enviro målt" : ""}${stance?.triggercamActive ? " · triggercam" : ""}${restNote}${prepNote}`
        : `Bakgrunn OK · skyteretning ${Math.round(bearingDeg)}° · ${trueDistanceM} m${
            session.rangeSource === "lrf" && measuredDistanceM !== trueDistanceM
              ? ` (LRF ${measuredDistanceM} m)`
              : ""
          } — sjekk vind og skru turrets${stance?.camcorderActive ? " · camcorder filmer" : ""}${stance?.chronoActive ? " · chrono klar" : ""}${stance?.kestrelEnviroActive ? " · enviro målt" : ""}${stance?.triggercamActive ? " · triggercam" : ""}${restNote}${prepNote}`,
    );
  }

  /**
   * Gun still deployed after engagement — open scope for distance / turret
   * review without ending Track or allowing a new Fire.
   */
  function openScopeReviewFromAware(stance: AwareShootStance) {
    if (!awareSession || !map) return;
    const session = awareSession;
    const hunterStand =
      stance.hunter ??
      session.hunterPos ??
      cellCenterOnAwareMap(pos, map);
    const bearingDeg = ((Math.round(stance.bearingDeg) % 360) + 360) % 360;
    const birdPt = ensureCellPointOnAwareMap(
      stance.bird ??
        session.birdPos ??
        birdMarkerOnAwareMap(stance.distanceM, bearingDeg, {
          origin: hunterStand,
          maxM: awareMapMaxMFor(map),
        }),
    );
    const trueDistanceM = Math.max(40, Math.round(stance.distanceM));
    const cw = crosswindMs(
      weather.live.windSpeedMs,
      weather.live.windFromDeg,
      bearingDeg,
    );
    const density = densityRatioFromTempC(weather.live.temperatureC);
    let hold = session.ballisticHold;
    if (hasExactBallistics && primaryAmmo) {
      const solve = kestrelSolveAmmo(
        primaryAmmo.ammo,
        primaryAmmo.id,
        kestrelProfiles,
        realSolveArg,
      );
      hold = exactBallisticHold(solve.ammo, trueDistanceM, cw, {
        densityRatio: density,
        powderTempC: weather.live.temperatureC,
        dvDtMpsPerC: solve.dvDtMpsPerC,
      });
    }
    scopeReviewResumeRef.current = {
      ...session,
      hunterPos: hunterStand,
      birdPos: birdPt,
      birdBearingDeg: bearingDeg,
      trueDistanceM,
      measuredDistanceM: trueDistanceM,
      ballisticHold: hold,
      crosswindMs: cw,
      densityRatio: density,
      returnGunDeployed: true,
      returnRest: stance.rest ?? "none",
      returnBagriderActive:
        !!stance.bagriderActive &&
        (stance.rest === "backpack" || stance.rest === "bipod"),
      returnCamcorderActive: !!stance.camcorderActive,
      returnChronoActive: !!stance.chronoActive,
      returnKestrelEnviroActive: !!stance.kestrelEnviroActive,
      returnTriggercamActive: !!stance.triggercamActive,
      returnNerve: stance.birdNerve ?? session.returnNerve,
    };
    const landscape = isSpotLandscapeSrc(session.imageSrc)
      ? session.imageSrc
      : spotLandscapeForCell(pos);
    const layoutKey = `${pos.row},${pos.col}`;
    const scanBirdPlacements =
      spotLayoutByCell[layoutKey]?.placements.filter(
        (p) => p.birdId !== "aware-review",
      ) ?? [];
    const sceneWidthPct = medianPlacementWidthPct(scanBirdPlacements, 2);
    setFieldGunDeployed(true);
    setAwareSession(null);
    setShootSession({
      imageSrc: landscape,
      bird: {
        ...session.bird,
        birdId: "aware-review",
        distanceM: trueDistanceM,
        x: 50,
        y: 50,
        widthPct: sceneWidthPct > 0 ? sceneWidthPct : 2,
      },
      trueDistanceM,
      measuredDistanceM: trueDistanceM,
      ballisticHold: hold,
      crosswindMs: cw,
      densityRatio: density,
      bearingDeg,
      hunterPos: hunterStand,
      birdPos: birdPt,
      camcorderActive: !!stance.camcorderActive,
      chronoActive: !!stance.chronoActive,
      kestrelEnviroActive: !!stance.kestrelEnviroActive,
      triggercamActive: !!stance.triggercamActive,
      gunDeployed: true,
      rest: stance.rest ?? "none",
      bagriderActive:
        !!stance.bagriderActive &&
        (stance.rest === "backpack" || stance.rest === "bipod"),
      gunPrepOnly: true,
      /** Show cell birds on the landscape; F-mark stays off while resuming Track. */
      scanBirdPlacements,
      rangeSource: session.rangeSource,
      birdNerve: 0,
    });
    setLog(
      `Gun scope — ${trueDistanceM} m / ${Math.round(bearingDeg)}° · skru tårn. Tilbake til Aware beholder Track.`,
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
    const resume = scopeReviewResumeRef.current;
    if (resume) {
      scopeReviewResumeRef.current = null;
      setShootSession(null);
      setScopeMarkedAware(null);
      setFieldGunDeployed(true);
      setAwareSession({
        ...resume,
        returnGunDeployed: true,
      });
      setLog("Tilbake til Aware — Track fortsatt åpen.");
      return;
    }
    setShootSession(null);
    setEngageResume(null);
    setScopeMarkedAware(null);
    if (!shootSession?.gunPrepOnly) {
      setBirdEncounter(null);
    }
    setLog(
      shootSession?.gunPrepOnly
        ? "Du senker våpenet — tilbake til kartet."
        : "Du senker våpenet. Fuglen er fortsatt der.",
    );
    setPanel("arrived");
  }

  /**
   * Gun-prep scope: F with reticle on bird → lock that bird as shoot target
   * (gun stays deployed; focus/trigger become active).
   */
  function onMarkBirdFromGunScope(info: {
    placement: BirdVisualPlacement;
    measuredDistanceM: number;
  }) {
    const session = onBirdObserved(
      {
        placement: info.placement,
        measuredDistanceM: info.measuredDistanceM,
        gameSeconds: 0,
        rangeSource: "estimated",
      },
      { deferOpen: true, returnGunDeployed: true },
    );
    if (!session) return;
    setScopeMarkedAware(session);
    setFieldGunDeployed(true);
    const prev = shootSession;
    setShootSession({
      imageSrc: session.imageSrc,
      bird: session.bird,
      trueDistanceM: session.trueDistanceM,
      measuredDistanceM: session.measuredDistanceM,
      ballisticHold: session.ballisticHold,
      crosswindMs: session.crosswindMs,
      densityRatio: session.densityRatio,
      bearingDeg: session.birdBearingDeg,
      hunterPos: session.hunterPos ?? prev?.hunterPos ?? recalledAwareStand(),
      birdPos:
        session.birdPos ??
        prev?.birdPos ??
        birdMarkerOnAwareMap(
          session.trueDistanceM,
          session.birdBearingDeg,
          {
            origin: session.hunterPos ?? prev?.hunterPos ?? recalledAwareStand(),
            maxM: map ? awareMapMaxMFor(map) : undefined,
          },
        ),
      camcorderActive: !!prev?.camcorderActive,
      chronoActive: !!prev?.chronoActive,
      kestrelEnviroActive: !!prev?.kestrelEnviroActive,
      triggercamActive: !!prev?.triggercamActive,
      gunDeployed: true,
      rest: prev?.rest ?? "none",
      gunPrepOnly: false,
      rangeSource: session.rangeSource,
      birdNerve:
        birdEncounterRef.current?.birdId === session.bird.birdId
          ? birdEncounterRef.current.nerve
          : (session.returnNerve ?? 0),
    });
    setLog(
      `Fugl merket i gun scope (${Math.round(session.birdBearingDeg)}° · ${session.measuredDistanceM} m) — fokus/avtrekk aktive.`,
    );
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

    const scopeResume = scopeReviewResumeRef.current;
    if (scopeResume) {
      scopeReviewResumeRef.current = null;
      setScopeMarkedAware(null);
      setFieldGunDeployed(true);
      setAwareSession({
        ...scopeResume,
        returnGunDeployed: true,
        returnRest: s.rest ?? scopeResume.returnRest ?? "none",
        returnBagriderActive:
          !!s.bagriderActive &&
          (s.rest === "backpack" || s.rest === "bipod"),
        returnCamcorderActive: !!s.camcorderActive,
        returnChronoActive: !!s.chronoActive,
        returnKestrelEnviroActive: !!s.kestrelEnviroActive,
        returnTriggercamActive: !!s.triggercamActive,
        returnNerve: scopeResume.returnNerve ?? nextNerve,
      });
      setLog("Tilbake til Aware — Track fortsatt åpen. Gun er deployed.");
      return;
    }

    // Gun-scope mark: open the locked bird with Deploy gun still active.
    if (s.gunPrepOnly && scopeMarkedAware) {
      const marked = scopeMarkedAware;
      setScopeMarkedAware(null);
      setEngageResume(null);
      setFieldGunDeployed(true);
      setAwareSession({
        ...marked,
        returnNerve:
          birdEncounterRef.current?.birdId === marked.bird.birdId
            ? birdEncounterRef.current.nerve
            : nextNerve,
        returnGunDeployed: true,
        returnCamcorderActive: !!s.camcorderActive,
        returnChronoActive: !!s.chronoActive,
        returnKestrelEnviroActive: !!s.kestrelEnviroActive,
        returnTriggercamActive: !!s.triggercamActive,
        returnRest: s.rest ?? "none",
        returnBagriderActive:
          !!s.bagriderActive &&
          (s.rest === "backpack" || s.rest === "bipod"),
        gunPrepOnly: false,
      });
      setLog(
        "Aware — fugl merket fra gun scope. Gun er deployed.",
      );
      return;
    }

    setScopeMarkedAware(null);
    const isPrepReview = !!s.gunPrepOnly && s.bird.birdId === "aware-review";
    if (!isPrepReview) {
      setBirdEncounter((prev) => {
        const next: BirdEncounter = {
          birdId: s.bird.birdId,
          distanceM: s.trueDistanceM,
          nerve: nextNerve,
          discovered: true,
        };
        return prev
          ? {
              ...prev,
              distanceM: s.trueDistanceM,
              nerve: nextNerve,
              discovered: true,
            }
          : next;
      });
      birdEncounterRef.current = {
        birdId: s.bird.birdId,
        distanceM: s.trueDistanceM,
        nerve: nextNerve,
        discovered: true,
      };
    } else {
      setBirdEncounter(null);
      birdEncounterRef.current = null;
    }
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
      returnNerve: isPrepReview ? undefined : nextNerve,
      returnCamcorderActive: !!s.camcorderActive,
      returnChronoActive: !!s.chronoActive,
      returnKestrelEnviroActive: !!s.kestrelEnviroActive,
      returnTriggercamActive: !!s.triggercamActive,
      returnGunDeployed: !!s.gunDeployed || !!s.rest || fieldGunDeployed,
      returnRest: s.rest ?? "none",
      returnBagriderActive:
        !!s.bagriderActive &&
        (s.rest === "backpack" || s.rest === "bipod"),
      gunPrepOnly: !!s.gunPrepOnly,
    });
    if (s.gunDeployed || s.rest || fieldGunDeployed) {
      setFieldGunDeployed(true);
    }
    setLog(
      s.gunPrepOnly
        ? "Tilbake til Aware — tårn lagret."
        : "Tilbake til Aware — fuglen er fortsatt der.",
    );
  }

  function openPendingPostShotTrack() {
    if (!pendingPostShot?.aware) return;
    const next = pendingPostShot.aware;
    setPendingPostShot(null);
    setPostShotGhost(null);
    // Still at the shot stand until Søk / Hent / leave cell — keep rifle out.
    setAwareSession({
      ...next,
      returnGunDeployed: fieldGunDeployedRef.current,
      returnRest: next.returnRest ?? "none",
    });
    setPanel("arrived");
  }

  /** Fallback when the 60 s register window expires.
   * Keeps hidden true land for Track — no visible skuddmarkør that spoils the seat.
   */
  function createFallbackPairFromGhost(g: PostShotGhost): ShotPair {
    /**
     * Temporary bird marker is gone. Store impact for ettersøk/hent only.
     * Visible target stays at stand until the player dials Shoot from memory.
     * Do not copy true range/bearing into the pair — that would autofill Shoot.
     */
    const impact = { ...g.impact };
    const stand = { ...g.stand };
    return {
      id: `pair-${Date.now()}`,
      atMs: Date.now(),
      cell: { ...g.cell },
      cellLabel: g.cellLabel,
      stand,
      target: { ...stand },
      impact,
      distanceM: 200,
      bearingDeg: 0,
      resultKind: g.resultKind,
      trackPoints: [],
      found: null,
      harvestDraft: g.harvestDraft,
      fleeObservation: g.fleeObservation,
      hitFasit: g.hitFasit,
      skuddparCommitted: false,
    };
  }

  function awareSessionFromGhost(
    g: PostShotGhost,
    pairId: string | null,
  ): AwareSession {
    return {
      imageSrc: g.imageSrc,
      bird: g.bird,
      trueDistanceM: g.trueDistanceM,
      measuredDistanceM: g.measuredDistanceM,
      ballisticHold: g.ballisticHold,
      crosswindMs: g.crosswindMs,
      densityRatio: g.densityRatio,
      birdBearingDeg: g.bearingDeg,
      hunterPos: g.stand,
      birdPos: pairId ? g.impact : g.birdAim,
      rangeSource: g.rangeSource,
      ettersokPairId: pairId,
      recoveryOnly: g.recoveryOnly,
      returnCamcorderActive: g.camcorderActive,
      returnGunDeployed: g.gunDeployed,
      returnRest: g.gunDeployed ? g.rest : "none",
      returnBagriderActive:
        g.gunDeployed &&
        !!g.bagriderActive &&
        (g.rest === "backpack" || g.rest === "bipod"),
      postShotSkuddpar: !pairId,
    };
  }

  /** 60 s window timed out — hide marker; keep bird for Track (no visible skuddmarkør). */
  function expirePostShotGhost() {
    const g = postShotGhostRef.current;
    if (!g) return;
    const pair = createFallbackPairFromGhost(g);
    setShotPairs((prev) => [pair, ...prev]);
    setPostShotGhost(null);
    setPostShotGhostSecLeft(0);
    setPendingPostShot((prev) =>
      prev
        ? {
            ...prev,
            aware: awareSessionFromGhost(g, pair.id),
          }
        : {
            aware: awareSessionFromGhost(g, pair.id),
            stayedCount: 0,
            flushedCount: 0,
            resultKind: g.resultKind,
          },
    );
    setLog(
      "Fuglemarkør borte — skuddmarkør ble ikke registrert. Fuglen ligger fortsatt til Hent/søk i denne cella; dial skuddmarkør fra hukommelse i Shoot når du vil.",
    );
    // If still in Aware registering, kick back to map.
    setAwareSession((prev) => (prev?.postShotSkuddpar ? null : prev));
  }

  /** Open Aware with bird aim marker to register skuddmarkør (Shoot). */
  function openPostShotSkuddparAware() {
    const g = postShotGhost;
    if (!g || Date.now() >= g.expiresAtMs) {
      expirePostShotGhost();
      return;
    }
    setAwareSession(awareSessionFromGhost(g, null));
    setPanel("arrived");
    setLog(
      `Registrer skuddmarkør — fugleposisjon synlig i ${Math.ceil((g.expiresAtMs - Date.now()) / 1000)} s. Shoot → stand → tre.`,
    );
  }

  function onPostShotSkuddparSaved(draft: {
    stand: CellPoint;
    target: CellPoint;
    distanceM: number;
    bearingDeg: number;
  }) {
    const g = postShotGhostRef.current;
    if (!g) return;
    const mPerPct = map ? awareMetersPerPctFor(map) : undefined;
    /**
     * Tree kills: Track marker + «Hent ved treet» must share the true seat.
     * A dialed 0° aim otherwise puts the overlay due north while Hent walks
     * to impact.
     */
    const treeKill = g.recoveryOnly;
    const target = treeKill ? { ...g.impact } : draft.target;
    const distanceM = treeKill
      ? Math.max(
          1,
          Math.round(distanceMBetween(draft.stand, target, mPerPct)),
        )
      : draft.distanceM;
    const bearingDeg = treeKill
      ? Math.round(bearingDegFromTo(draft.stand, target))
      : draft.bearingDeg;
    const pair: ShotPair = {
      id: `pair-${Date.now()}`,
      atMs: Date.now(),
      cell: { ...g.cell },
      cellLabel: g.cellLabel,
      stand: draft.stand,
      target,
      impact: g.impact,
      distanceM,
      bearingDeg,
      resultKind: g.resultKind,
      trackPoints: [],
      found: null,
      harvestDraft: g.harvestDraft,
      fleeObservation: g.fleeObservation,
      hitFasit: g.hitFasit,
      skuddparCommitted: true,
    };
    setShotPairs((prev) => [pair, ...prev]);
    setPostShotGhost(null);
    setPostShotGhostSecLeft(0);
    setPendingPostShot(null);
    // Still at the shot stand — remount only on Søk / Hent ved treet / leave cell.
    // Keep gun + rest from the shot (ghost) for the next engage.
    const keepGun = fieldGunDeployedRef.current || g.gunDeployed;
    setAwareSession({
      ...awareSessionFromGhost(g, pair.id),
      postShotSkuddpar: false,
      birdPos: g.impact,
      ettersokPairId: pair.id,
      returnGunDeployed: keepGun,
      returnRest: keepGun ? g.rest : "none",
      returnBagriderActive:
        keepGun &&
        !!g.bagriderActive &&
        (g.rest === "backpack" || g.rest === "bipod"),
    });
    setLog(
      `Skuddmarkør lagret: ${pair.distanceM} m / ${Math.round(pair.bearingDeg)}° — fortsett i Track (Hent/søk).`,
    );
  }

  // Post-shot skuddmarkør window countdown (real time).
  useEffect(() => {
    if (!postShotGhost) {
      setPostShotGhostSecLeft(0);
      return;
    }
    function tick() {
      const g = postShotGhostRef.current;
      if (!g) return;
      const leftMs = g.expiresAtMs - Date.now();
      if (leftMs <= 0) {
        expirePostShotGhost();
        return;
      }
      setPostShotGhostSecLeft(Math.ceil(leftMs / 1000));
    }
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postShotGhost]);

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
    const where = cellLabel(pair.cell);
    const here = pair.cell.row === pos.row && pair.cell.col === pos.col;
    return here
      ? `Hent/søk · ${where} (${bird})`
      : `Hent/søk · ${where} (${bird}) — gå dit`;
  }

  /** True when `src` is a spotting landscape (not a bird cutout sprite). */
  function isSpotLandscapeSrc(src: string): boolean {
    if (!src) return false;
    if (src.includes("/images/birds/")) return false;
    return (
      src.startsWith("/images/spot/") ||
      isCloudSpotImage(src) ||
      spotImagesWithPerches().includes(src)
    );
  }

  /**
   * Spotting scene for this cell — never a bird topp sprite.
   * Prefers sticky cell layout, then prepareSpot, then a fresh spot draw.
   */
  function spotLandscapeForCell(cell: HuntGridCell): string {
    const layoutKey = `${cell.row},${cell.col}`;
    const layout = spotLayoutByCell[layoutKey];
    if (layout?.imageSrc && isSpotLandscapeSrc(layout.imageSrc)) {
      return layout.imageSrc;
    }
    const prepared = prepareSpotAtPos({
      cell,
      reuseImageSrc: layout?.imageSrc ?? null,
    });
    if (prepared?.imageSrc && isSpotLandscapeSrc(prepared.imageSrc)) {
      return prepared.imageSrc;
    }
    return pickSpotImage();
  }

  /** Re-open Aware Track for a saved skuddmarkør — only when standing in that cell. */
  function openAwareForPair(pair: ShotPair) {
    const where = cellLabel(pair.cell);
    const bird = birdNameNb(pair.harvestDraft?.species);
    if (pair.cell.row !== pos.row || pair.cell.col !== pos.col) {
      setLog(
        `Gå til ${where} for å hente/søke etter ${bird}. Du er i ${cellLabel(pos)}.`,
      );
      return;
    }
    const spriteId = pair.hitFasit?.birdSpriteId ?? "tiur-1";
    const sprite = getBirdSprite(spriteId);
    const species = pair.harvestDraft?.species ?? sprite.species;
    const recoveryOnly =
      pair.resultKind === "instant_kill" || pair.resultKind === "vital_kill";
    const landscape = spotLandscapeForCell(pair.cell);
    const layout =
      spotLayoutByCell[`${pair.cell.row},${pair.cell.col}`];
    const sceneWidthPct = medianPlacementWidthPct(
      layout?.placements ?? [],
      2,
    );
    setPendingPostShot(null);
    setEngageResume(null);
    setBirdEncounter(null);
    leaveUnfoundMindCellRef.current = null;
    setAwareSession({
      imageSrc: landscape,
      bird: {
        birdId: pair.harvestDraft?.birdId ?? pair.id,
        species,
        spriteId,
        imageSrc: sprite.toppSrc,
        distanceM: pair.distanceM,
        x: 50,
        y: 50,
        widthPct: sceneWidthPct > 0 ? sceneWidthPct : 2,
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
      returnGunDeployed: fieldGunDeployedRef.current,
      returnRest: "none",
    });
    setPanel("arrived");
  }

  /**
   * Aware from map or Spot — skuddmarkør + last hunter stand.
   * Prefers unfinished Hent/søk, then sticky Engage, then live contact,
   * else field review (Gun = turret prep only).
   */
  function openAwareOverview() {
    setSpotSession(null);
    // Active 60 s post-shot window — reopen register Aware with bird marker.
    const ghost = postShotGhostRef.current;
    if (ghost && Date.now() < ghost.expiresAtMs) {
      openPostShotSkuddparAware();
      return;
    }
    // Prefer unfinished pairs in this cell (side list opens other cells).
    const hereUnfinished = unfinishedShotPairs.filter(
      (p) => p.cell.row === pos.row && p.cell.col === pos.col,
    );
    if (hereUnfinished.length > 0) {
      openAwareForPair(hereUnfinished[0]!);
      setLog("Aware — skuddmarkør klar for Hent/søk.");
      return;
    }
    if (engageResume) {
      resumeEngageFromSpot();
      return;
    }

    const stand = recalledAwareStand();
    const enc = birdEncounterRef.current;
    const layoutKey = `${pos.row},${pos.col}`;
    const layout = spotLayoutByCell[layoutKey];
    const hereIds = new Set(birdsInCell(birds, pos).map((b) => b.id));
    const contactIds = Object.keys(birdMapContacts);
    const birdId =
      enc?.birdId && hereIds.has(enc.birdId)
        ? enc.birdId
        : (contactIds.find((id) => hereIds.has(id)) ?? null);
    const contact = birdId ? birdMapContacts[birdId] : null;
    const placement = birdId
      ? layout?.placements.find((p) => p.birdId === birdId)
      : undefined;

    if (birdId && contact && placement && layout) {
      const birdPos = ensureCellPointOnAwareMap(contact.birdPos);
      if (!isCellPointOnAwareMap(contact.birdPos)) {
        setBirdMapContacts((prev) => ({
          ...prev,
          [birdId]: { ...contact, birdPos },
        }));
      }
      const dist = Math.max(
        40,
        Math.round(
          distanceMBetween(
            stand,
            birdPos,
            map ? awareMetersPerPctFor(map) : undefined,
          ),
        ),
      );
      const fromDist = placement.distanceM || enc?.distanceM || dist;
      const cw = crosswindMs(
        weather.live.windSpeedMs,
        weather.live.windFromDeg,
        contact.bearingDeg,
      );
      const density = densityRatioFromTempC(weather.live.temperatureC);
      let hold: BallisticHoldSolution | null = null;
      if (hasExactBallistics && primaryAmmo) {
        const solve = kestrelSolveAmmo(
          primaryAmmo.ammo,
          primaryAmmo.id,
          kestrelProfiles,
          realSolveArg,
        );
        hold = exactBallisticHold(solve.ammo, dist, cw, {
          densityRatio: density,
          powderTempC: weather.live.temperatureC,
          dvDtMpsPerC: solve.dvDtMpsPerC,
        });
      }
      const nerve =
        enc?.birdId === birdId
          ? enc.nerve
          : (latentSpotNerveRef.current[birdId]?.nerve ??
            initialEncounterNerve(
              birds.find((b) => b.id === birdId)?.spookCount ?? 0,
            ));
      setBirdEncounter({
        birdId,
        distanceM: dist,
        nerve,
        discovered: true,
      });
      birdEncounterRef.current = {
        birdId,
        distanceM: dist,
        nerve,
        discovered: true,
      };
      setAwareSession({
        imageSrc: layout.imageSrc,
        bird: {
          ...placement,
          distanceM: dist,
          widthPct: rescaleSpriteWidthPct(
            placement.widthPct,
            fromDist,
            dist,
          ),
        },
        trueDistanceM: dist,
        measuredDistanceM: dist,
        ballisticHold: hold,
        crosswindMs: cw,
        densityRatio: density,
        birdBearingDeg: contact.bearingDeg,
        hunterPos: stand,
        birdPos,
        rangeSource: "estimated",
        returnGunDeployed: fieldGunDeployedRef.current,
        returnRest: "none",
      });
      setLog(
        "Aware — siste stand og fuglekontakt. Skuddklar / Gun når bakgrunn er OK.",
      );
      setPanel("arrived");
      return;
    }

    // Field review: skuddmarkør + stand; Gun = turret prep and/or find bird in scope.
    const prepared = prepareSpotAtPos({
      reuseImageSrc: layout?.imageSrc ?? null,
    });
    const reviewLandscape =
      prepared?.imageSrc ??
      (layout?.imageSrc && layout.imageSrc.length > 0
        ? layout.imageSrc
        : null) ??
      pickSpotImage();
    const scanPlacements = prepared?.birdPlacements ?? layout?.placements ?? [];
    const sceneWidthPct = medianPlacementWidthPct(scanPlacements, 2);
    const lrfSample = lastSpotLrfRef.current;
    const bearing = lrfSample
      ? ((Math.round(lrfSample.bearingDeg) % 360) + 360) % 360
      : ((Math.round(
          prepared?.viewBearingDeg ?? layout?.viewBearingDeg ?? 0,
        ) % 360) +
          360) %
        360;
    const dist = Math.max(
      40,
      Math.round(lrfSample?.distanceM ?? 150),
    );
    const birdPos = ensureCellPointOnAwareMap(
      birdMarkerOnAwareMap(dist, bearing, {
        origin: stand,
        maxM: map ? awareMapMaxMFor(map) : undefined,
      }),
    );
    const sprite = getBirdSprite("tiur-1");
    setEngageResume(null);
    setBirdEncounter(null);
    birdEncounterRef.current = null;
    setAwareSession({
      imageSrc: reviewLandscape,
      bird: {
        birdId: "aware-review",
        species: "tiur",
        spriteId: "tiur-1",
        imageSrc: sprite.toppSrc,
        distanceM: dist,
        x: 50,
        y: 50,
        widthPct: sceneWidthPct,
      },
      trueDistanceM: dist,
      measuredDistanceM: dist,
      ballisticHold: null,
      crosswindMs: 0,
      densityRatio: 1,
      birdBearingDeg: bearing,
      hunterPos: stand,
      birdPos,
      rangeSource: lrfSample ? "lrf" : "estimated",
      gunPrepOnly: true,
      returnGunDeployed: fieldGunDeployedRef.current,
    });
    setLog(
      shotPairs.length > 0
        ? scanPlacements.length > 0
          ? lrfSample
            ? `Aware — LRF-retning ${bearing}° · skuddmarkør/stand. Deploy → Use gun scope, eller finn fugl (F).`
            : "Aware — skuddmarkør og stand. Deploy → Use gun scope, eller finn fugl (F)."
          : lrfSample
            ? `Aware — LRF-retning ${bearing}°. Deploy → Use gun scope for tårn.`
            : "Aware — skuddmarkør og siste stand. Deploy → Use gun scope for tårn."
        : scanPlacements.length > 0
          ? lrfSample
            ? `Aware — LRF-retning ${bearing}°. Deploy → Use gun scope, eller marker fugl med F.`
            : "Aware — siste stand. Deploy → Use gun scope, eller marker fugl med F."
          : lrfSample
            ? `Aware — LRF-retning ${bearing}°. Deploy → Use gun scope for å stille tårn.`
            : "Aware — siste stand. Deploy → Use gun scope for å stille tårn.",
    );
    setPanel("arrived");
  }

  mapActionHotkeysRef.current = {
    panel,
    pendingPostShot,
    clockMinutes,
    beginSpot,
    openAwareOverview,
  };

  function continueSpottingAfterShot() {
    if (!pendingPostShot) {
      beginSpot();
      return;
    }
    const stayed = pendingPostShot.stayedCount;
    const reuseImageSrc =
      pendingPostShot.aware?.imageSrc ??
      postShotGhost?.imageSrc ??
      spotLayoutByCell[`${pos.row},${pos.col}`]?.imageSrc ??
      null;
    // Keep postShotGhost for the full 60 s — spotting / leaving Aware must
    // not end the register window early.
    const ghostLeft = postShotGhost
      ? Math.max(0, Math.ceil((postShotGhost.expiresAtMs - Date.now()) / 1000))
      : 0;
    setLog(
      postShotGhost && ghostLeft > 0
        ? stayed > 0
          ? `Du speider videre — ${stayed === 1 ? "kanskje én fugl" : "kanskje noen fugler"} ble sittende. Fuglemarkør synlig i Aware i ${ghostLeft} s.`
          : `Du speider videre. Fuglemarkør synlig i Aware i ${ghostLeft} s — registrer skuddmarkør før tiden går ut.`
        : stayed > 0
          ? `Du speider videre — ${stayed === 1 ? "kanskje én fugl" : "kanskje noen fugler"} ble sittende.`
          : "Du speider videre.",
    );
    beginSpot({ reuseImageSrc });
  }

  /**
   * Mark unfinished recoveries lost (Gi opp / skuddlys / midnatt).
   * Engage / Fortsett spotting never forfeits — pairs stick in their shot cell
   * for the whole hunt day.
   */
  function forfeitOpenShotPairs(reason: "skuddlys" | "midnight"): number {
    const open = shotPairs.filter(
      (p) =>
        p.found == null &&
        !!p.harvestDraft &&
        (p.resultKind === "instant_kill" ||
          p.resultKind === "vital_kill" ||
          p.resultKind === "ettersok"),
    );
    if (open.length === 0) return 0;
    setShotPairs((prev) =>
      prev.map((p) =>
        open.some((o) => o.id === p.id)
          ? { ...p, found: false, harvestDraft: undefined }
          : p,
      ),
    );
    if (reason === "skuddlys") {
      setLog(
        open.length === 1
          ? "Skuddlys over — ufunnen fugl er tapt (hent/søk før 17:00 neste gang)."
          : `Skuddlys over — ${open.length} ufunne fugler er tapt.`,
      );
    }
    return open.length;
  }

  function onHuntShotResult(result: HuntShotResult) {
    if (!shootSession || !map) return;
    if (result.zone === "head") {
      onHeadshotNickname?.();
    }
    setBirdEncounter(null);
    setEngageResume(null);
    const id = shootSession.bird.birdId;
    const dist = result.measuredDistanceM;
    const stand = shootSession.hunterPos;
    rememberAwareStand(stand);
    // True bird marker from Aware — keep continuity into ettersøk.
    const birdPos = shootSession.birdPos;
    const camcorderOn = !!shootSession.camcorderActive;
    const triggercamOn = !!shootSession.triggercamActive;
    const elRangeOn = binoItem?.id === SWAROVSKI_EL_RANGE_ID;
    /** True land / fall (hidden). Visible skuddmarkør from cam or pre-saved pair. */
    let impact = birdPos;
    if (result.kind === "miss") {
      impact = impactFromShot({
        stand,
        bearingDeg: shootSession.bearingDeg,
        distanceM: result.trueDistanceM,
        metersPerPct: map ? awareMetersPerPctFor(map) : undefined,
      });
    }
    let fleeObservation: ShotPair["fleeObservation"];
    if (result.kind === "ettersok") {
      const rest = shootSession.rest ?? "none";
      const bagriderActive =
        !!shootSession.bagriderActive &&
        (rest === "backpack" || rest === "bipod");
      const bipodSpec = bipodSpecForShootRest(rest, {
        kitBipod: kitBipod?.bipod,
      });
      const weaponCalmBase = computeWeaponCalmFactor({
        hasBipod: restProvidesWeaponCalm(rest) && !!bipodSpec,
        bipod: bipodSpec,
        suppressorWeightGrams: suppressorItem?.weightGrams,
        extraCalmGrams: miscKitWeaponCalmGrams(
          kitItems.filter(isMiscItem).map((i) => i.misc),
          !!suppressorItem,
        ),
        customsCalmMult,
      });
      const weaponCalm = bagriderActive
        ? weaponCalmBase * BAGRIDER_REST_CALM_MULT
        : weaponCalmBase;
      const recoilDamping = computeRecoilDamping({
        soundReductionDb: suppressorSoundDb,
        customsMods,
      });
      const rifleItem = kitItems.find(isRifleItem) ?? null;
      const scopeItem = kitItems.find(isScopeItem) ?? null;
      const mountItem = kitItems.find(isMountItem) ?? null;
      const ammoItem = (() => {
        if (result.ammoId) {
          const hit = kitItems.find((i) => i.id === result.ammoId);
          if (hit && isAmmoItem(hit)) return hit;
        }
        return kitItems.find(isAmmoItem) ?? null;
      })();
      const weaponKg = rifleItem
        ? shoulderedWeaponWeightKg({
            rifleGrams: rifleItem.weightGrams,
            scopeGrams: scopeItem?.weightGrams,
            mountGrams: mountItem?.weightGrams,
            suppressorGrams: suppressorItem?.weightGrams,
            bipodGrams: rest === "bipod" ? kitBipod?.weightGrams : 0,
          })
        : null;
      const grains = ammoItem
        ? resolveBulletWeightGrains(
            ammoItem.ammo,
            `${ammoItem.brand} ${ammoItem.name}`,
          )
        : null;
      const v0 =
        result.v0 ??
        (ammoItem && rifleItem
          ? ammoItem.ammo.v0 *
            barrelV0FactorForRifle(rifleItem.id, customBarrels[rifleItem.id])
          : null);
      const feltRecoil = computeFeltRecoil({
        weaponCalm,
        recoilDamping,
        fatigue: { physicalFatigue },
        bulletWeightGrains: grains,
        v0Mps: v0,
        weaponWeightKg: weaponKg,
      });
      const flee = generateFleeObservation({
        birdAtShot: birdPos,
        hitZone: result.zone === "vital" ? "vital" : "body",
        hasTriggercam: triggercamOn,
        hasCamcorder: camcorderOn,
        feltRecoil,
        metersPerPct: map ? awareMetersPerPctFor(map) : undefined,
      });
      impact = flee.landPos;
      fleeObservation = flee.observation;
    }
    // Track / Hent only work on the Aware stage — never store off-map land.
    impact = ensureCellPointOnAwareMap(impact);
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

    const autoVisible = realismAutoSkuddpar(realism)
      ? estimateVisibleShotPair({
          stand,
          trueAim: result.kind === "miss" ? impact : birdPos,
          hasTriggercam: false,
          hasCamcorder: false,
          hasElRange: true,
          metersPerPct: map ? awareMetersPerPctFor(map) : undefined,
          maxDistanceM: map ? awareMapMaxMFor(map) : undefined,
        })
      : estimateVisibleShotPair({
          stand,
          trueAim: result.kind === "miss" ? impact : birdPos,
          hasTriggercam: triggercamOn,
          hasCamcorder: camcorderOn,
          hasElRange: elRangeOn,
          metersPerPct: map ? awareMetersPerPctFor(map) : undefined,
          maxDistanceM: map ? awareMapMaxMFor(map) : undefined,
        });

    /** Pre-saved Shoot skuddmarkør on this cell (no harvest yet) — no-cam fallback. */
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
      const treeKill =
        result.kind === "instant_kill" || result.kind === "vital_kill";
      const mPerPct = map ? awareMetersPerPctFor(map) : undefined;
      /** Tree drop stays at the seat — don't offset aim with cam noise. */
      const pairTarget = treeKill ? impact : autoVisible.target;
      const pairDist = treeKill
        ? Math.max(
            1,
            Math.round(distanceMBetween(stand, impact, mPerPct)),
          )
        : autoVisible.distanceM;
      const pairBearing = treeKill
        ? Math.round(bearingDegFromTo(stand, impact))
        : autoVisible.bearingDeg;
      pair = {
        id: `pair-${Date.now()}`,
        atMs: Date.now(),
        cell: { ...pos },
        cellLabel: cellLabel(pos),
        stand,
        target: pairTarget,
        impact,
        distanceM: pairDist,
        bearingDeg: pairBearing,
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
        realismAutoSkuddpar(realism)
          ? " Realism Low: skuddmarkør lagret automatisk (eksakt)."
          : autoVisible.source === "el_range"
            ? " EL Range lagret skuddmarkør (eksakt)."
            : autoVisible.source === "camcorder"
              ? " Camcorder lagret skuddmarkør (±10 m)."
              : " Triggercam lagret skuddmarkør (±30 m).";
    } else if (manualPair && result.kind !== "miss") {
      const treeKill =
        result.kind === "instant_kill" || result.kind === "vital_kill";
      const mPerPct = map ? awareMetersPerPctFor(map) : undefined;
      pair = {
        ...manualPair,
        impact,
        ...(treeKill
          ? {
              target: { ...impact },
              distanceM: Math.max(
                1,
                Math.round(distanceMBetween(stand, impact, mPerPct)),
              ),
              bearingDeg: Math.round(bearingDegFromTo(stand, impact)),
            }
          : {}),
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
      pairNote = " Skuddmarkør fra Shoot er koblet til skuddet.";
    } else if (
      (result.kind === "instant_kill" || result.kind === "vital_kill") &&
      result.trueDistanceM < CLOSE_RANGE_TREE_HENT_MAX_M
    ) {
      // Close-range tree kill: always allow «Hent ved treet» without cam/skuddmarkør.
      const distanceM = Math.max(
        1,
        Math.round(
          distanceMBetween(
            stand,
            birdPos,
            map ? awareMetersPerPctFor(map) : undefined,
          ),
        ),
      );
      const bearingDeg = Math.round(bearingDegFromTo(stand, birdPos));
      pair = {
        id: `pair-${Date.now()}`,
        atMs: Date.now(),
        cell: { ...pos },
        cellLabel: cellLabel(pos),
        stand,
        target: birdPos,
        impact: birdPos,
        distanceM,
        bearingDeg,
        resultKind: result.kind,
        trackPoints: [],
        found: null,
        harvestDraft,
        hitFasit,
        skuddparCommitted: true,
      };
      setShotPairs((prev) => [pair!, ...prev]);
      pairNote = ` Nærhold (<${CLOSE_RANGE_TREE_HENT_MAX_M} m): hent ved treet uten lagret skuddmarkør.`;
    } else if (result.kind !== "miss") {
      // No cam / no pre-save: 60 s window to register skuddmarkør on Aware.
      pair = null;
      pairNote =
        " Registrer skuddmarkør i Aware innen 60 s (fuglemarkør synlig — også hvis du går til spotting). Etter det forsvinner markøren — fuglen ligger fortsatt til ettersøk, men uten synlig skuddmarkør.";
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
      soundReductionDb: suppressorSoundDb,
    });
    nextBirds = flush.birds;
    setBirds(nextBirds);
    if (flush.events.length > 0) {
      // After shot video (if any), show «Fuglen flyr» per companion / miss fly-out.
      setFlushQueue(flush.events);
    }

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
              : hasSuppressor && suppressorSoundDb != null
                ? ` (lyddemper ${suppressorSoundDb} dB)`
                : hasSuppressor
                  ? " (lyddemper)"
                  : ""
          }.`
        : flush.flushedIds.length > 0
          ? hasSuppressor
            ? " Fuglene i ruta letter (skuddlyd gjennom demperen)."
            : " Fuglene i ruta letter av skuddlyden."
          : silentShot
            ? " Stille skudd (subsonisk + lyddemper) — fuglene merker det ikke."
            : "";

    if (isContact) {
      const recoveryOnly =
        result.kind === "instant_kill" || result.kind === "vital_kill";
      const needsSkuddparWindow = !pair;
      if (needsSkuddparWindow) {
        // Don't overwrite a previous ghost — commit it first (all-day Track).
        if (postShotGhostRef.current) {
          expirePostShotGhost();
        }
        setPostShotGhost({
          expiresAtMs: Date.now() + POST_SHOT_SKUDDPAR_WINDOW_MS,
          imageSrc: shootSession.imageSrc,
          bird: shootSession.bird,
          cell: { ...pos },
          cellLabel: cellLabel(pos),
          stand,
          birdAim: birdPos,
          impact,
          bearingDeg: shootSession.bearingDeg,
          trueDistanceM: shootSession.trueDistanceM,
          measuredDistanceM: shootSession.measuredDistanceM,
          ballisticHold: shootSession.ballisticHold,
          crosswindMs: shootSession.crosswindMs,
          densityRatio: shootSession.densityRatio,
          rangeSource: shootSession.rangeSource,
          camcorderActive: camcorderOn,
          gunDeployed: !!shootSession.gunDeployed,
          rest: shootSession.rest ?? "none",
          bagriderActive: !!shootSession.bagriderActive,
          harvestDraft,
          hitFasit,
          fleeObservation,
          resultKind: result.kind,
          recoveryOnly,
        });
        setPostShotGhostSecLeft(
          Math.ceil(POST_SHOT_SKUDDPAR_WINDOW_MS / 1000),
        );
      } else {
        setPostShotGhost(null);
      }
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
            returnGunDeployed:
              !!shootSession.gunDeployed || fieldGunDeployedRef.current,
            returnRest:
              shootSession.gunDeployed
                ? (shootSession.rest ?? "none")
                : "none",
            returnBagriderActive:
              !!shootSession.gunDeployed &&
              !!shootSession.bagriderActive &&
              (shootSession.rest === "backpack" ||
                shootSession.rest === "bipod"),
          }
        : null;
      const logMsg =
        result.kind === "instant_kill"
          ? result.zone === "head"
            ? `Headshot — Pink Mist! ${dist} m.${pairNote}${stayNote}`
            : result.zone === "neck"
              ? `Du bommet vel? men hadde flaks. Skuddet traff likevel i vital sone. ${dist} m.${pairNote}${stayNote}`
              : `Instant kill på ${dist} m.${pairNote}${stayNote}`
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
      } else if (flush.events.length > 0) {
        setLog(flushMessage(flush.events[0]!));
      }
      return;
    }

    const missLog =
      `Bom på ${dist} m.${stayNote || " Fuglen letter."}` +
      (flush.stayedIds.length > 0 ? " Du kan spotte videre." : "");
    setMentalFatigue((m) => clampFatigue(m + MISS_MIND_HIT));
    setLog(
      flush.events.length > 0 ? flushMessage(flush.events[0]!) : missLog,
    );
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
      mindStimMinutes: entry.item.food.temporaryMindFullMinutes,
      pulseBoostBpm: entry.item.food.pulseBoostBpm,
      pulseBoostMinutes:
        entry.item.food.pulseBoostMinutes ??
        entry.item.food.temporaryMindFullMinutes,
    });
  }

  function drinkCoffee() {
    if (!hasThermos) {
      setLog("Ingen termos i kit — ingen kaffe.");
      return;
    }
    if (thermosCupsLeft <= 0) {
      setLog("Termosen er tom — 5 kopper var det.");
      return;
    }
    setEatSession({
      imageSrc: pickEatImage(),
      itemId: null,
      label: COFFEE_RECOVERY.label,
      bodyGain: COFFEE_RECOVERY.bodyGain,
      mindGain: COFFEE_RECOVERY.mindGain,
      minutes: COFFEE_RECOVERY.minutes,
      consumeCoffeeCup: true,
    });
  }

  function restBodyGain(base: number): number {
    return clothingRestBodyGain(
      sitPadBodyGain(base, hasSitPad),
      clothingRecoveryPct,
    );
  }

  function takeShortRest() {
    setEatSession({
      imageSrc: pickEatImage(),
      itemId: null,
      label: SHORT_REST_RECOVERY.label,
      bodyGain: restBodyGain(SHORT_REST_RECOVERY.bodyGain),
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
    const minutes = fireStarter
      ? Math.max(1, TYRIBAL_RECOVERY.minutes - fireStarter.minutesSaved)
      : TYRIBAL_RECOVERY.minutes;
    setEatSession({
      imageSrc: pickFireImage(),
      itemId: fireStarter?.itemId ?? null,
      label: TYRIBAL_RECOVERY.label,
      bodyGain: restBodyGain(TYRIBAL_RECOVERY.bodyGain),
      mindGain: 1,
      mindToFull: true,
      minutes,
    });
  }

  function applyEatPulseBoost(
    session: EatSession,
    nextPhysical: number,
  ) {
    const isTyribal = session.label === TYRIBAL_RECOVERY.label;
    const clockMin = Math.floor(clockSecondsRef.current / 60);

    if (isTyribal) {
      setPulse((prev) =>
        tickPulseState(setPulseToResting(prev), {
          gameMinutes: 0,
          physicalFatigue: nextPhysical,
          clockMinutes: clockMin,
          resting: true,
        }),
      );
      return;
    }

    const mindToFull =
      !!session.mindToFull ||
      !!(session.mindStimMinutes && session.mindStimMinutes > 0);
    const mindGain = mindToFull ? 1 : Math.max(0, session.mindGain);

    setPulse((prev) => {
      let next = prev;
      if (mindGain > 0 || mindToFull) {
        next = applyMindCalmToPulse(next, {
          mindGain,
          mindToFull,
        });
      }
      const boost = session.pulseBoostBpm ?? 0;
      const mins =
        session.pulseBoostMinutes ??
        session.mindStimMinutes ??
        0;
      // Caffeine stim only when mind did not snap to floor (Red Bull → 50).
      if (boost > 0 && mins > 0 && !mindToFull) {
        next = applyPulseStim(next, {
          boostBpm: boost,
          durationGameMin: mins,
          clockMinutes: clockMin,
          physicalFatigue: nextPhysical,
        });
      }
      return tickPulseState(next, {
        gameMinutes: 0,
        physicalFatigue: nextPhysical,
        clockMinutes: clockMin,
        resting: true,
      });
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
    if (eatSession.consumeCoffeeCup) {
      if (thermosCupsLeft <= 0) {
        setLog("Termosen er tom.");
        setEatSession(null);
        setPanel("arrived");
        return;
      }
      setThermosCupsLeft((n) => Math.max(0, n - 1));
    }

    if (eatSession.mindStimMinutes && eatSession.mindStimMinutes > 0) {
      const restore =
        redBullBuffRef.current?.restoreMentalFatigue ?? mentalFatigue;
      // Drop active buff without crashing — refreshing the stim window.
      redBullBuffRef.current = null;
      setRedBullBuff(null);
      advanceClockMinutes(eatSession.minutes, {
        resting: true,
        skipPulse: true,
      });
      const nextPhysical = clampFatigue(
        physicalFatigue - eatSession.bodyGain,
      );
      setPhysicalFatigue(nextPhysical);
      const afterMin = clockSecondsRef.current / 60;
      const buff: RedBullBuff = {
        restoreMentalFatigue: restore,
        startedAtClockMin: afterMin,
        expiresAtClockMin: afterMin + eatSession.mindStimMinutes,
      };
      redBullBuffRef.current = buff;
      setRedBullBuff(buff);
      setMentalFatigue(0);
      applyEatPulseBoost(eatSession, nextPhysical);
      const pulseNote = " · Puls → 50 (mind 100%)";
      setLog(
        `${eatSession.label}: Mind → 100% · crash tilbake på ${eatSession.mindStimMinutes} min · ${eatSession.minutes} min${pulseNote}.`,
      );
      setEatSession(null);
      setPanel("arrived");
      return;
    }

    advanceClockMinutes(eatSession.minutes, {
      resting: true,
      skipPulse: true,
    });
    const nextPhysical = clampFatigue(physicalFatigue - eatSession.bodyGain);
    setPhysicalFatigue(nextPhysical);
    if (eatSession.mindToFull) {
      setMentalFatigue(0);
    } else {
      setMentalFatigue((m) => clampFatigue(m - eatSession.mindGain));
    }
    applyEatPulseBoost(eatSession, nextPhysical);
    const bodyTxt = formatStaminaPct(eatSession.bodyGain);
    const mindTxt = eatSession.mindToFull
      ? "Mind 100%"
      : `Mind +${formatStaminaPct(eatSession.mindGain)}`;
    const fireNote =
      eatSession.label === TYRIBAL_RECOVERY.label
        ? ` ${TYRIBAL_RECOVERY.note}`
        : "";
    const coffeeLeft = eatSession.consumeCoffeeCup
      ? Math.max(0, thermosCupsLeft - 1)
      : null;
    const coffeeNote =
      coffeeLeft != null
        ? ` (${coffeeLeft}/${THERMOS_CUPS_PER_FILL} kaffe igjen).`
        : "";
    const pulseNote =
      eatSession.label === TYRIBAL_RECOVERY.label
        ? " · Puls → hvilepuls"
        : eatSession.mindToFull || eatSession.mindGain > 0
          ? eatSession.mindToFull
            ? " · Puls → 50"
            : ` · Puls −${Math.round(eatSession.mindGain * 50)}`
          : eatSession.pulseBoostBpm && eatSession.pulseBoostBpm > 0
            ? ` · Puls +${eatSession.pulseBoostBpm}`
            : "";
    setLog(
      `${eatSession.label}: Body +${bodyTxt} · ${mindTxt} · ${eatSession.minutes} min.${fireNote}${coffeeNote}${pulseNote}`,
    );
    setEatSession(null);
    setPanel("arrived");
  }

  function finishForcedRest() {
    if (!forcedRest) return;
    advanceClockMinutes(FORCED_REST_MINUTES, {
      physicalFatigue: 0.15,
      resting: true,
    });
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
    const nextPhysical = clampFatigue(physicalFatigue - 0.35);
    advanceClockMinutes(session.durationMinutes, {
      physicalFatigue: nextPhysical,
      resting: true,
    });
    setPhysicalFatigue(nextPhysical);
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
      ? pathTravelMinutes(map.id, pos, selected, pace, clothingSpeedPct)
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
        subtitle={
          eatSession.mindStimMinutes
            ? `Mind → 100% · crash tilbake på ${eatSession.mindStimMinutes} min`
            : `Body +${formatStaminaPct(eatSession.bodyGain)} · ${
                eatSession.mindToFull
                  ? "Mind → 100%"
                  : `Mind +${formatStaminaPct(eatSession.mindGain)}`
              }`
        }
        durationMinutes={eatSession.minutes}
        clockMinutes={clockMinutes}
        onContinue={finishEat}
        ariaLabel="Eat / Rest"
      />
    );
  }

  if (findReveal) {
    const isUgle = findReveal.pair.harvestDraft?.species === "ugle";
    return (
      <AtmospherePauseView
        imageSrc={findReveal.imageSrc}
        title={isUgle ? UGLE_FUNN_TITLE : "Du fant fuglen! Godt utført ettersøk."}
        subtitle={
          isUgle
            ? UGLE_FUNN_SUBTITLE
            : "Fuglen er i sekken."
        }
        durationMinutes={0}
        holdMs={isUgle ? 7000 : 4500}
        clockMinutes={clockMinutes}
        onContinue={() => {
          const pair = findReveal.pair;
          setFindReveal(null);
          harvestFoundPair(pair);
          // Bagging ends the engagement — rifle stays in the pack.
          mountFieldGun({ silent: true });
          setAwareSession((prev) =>
            prev
              ? {
                  ...prev,
                  returnGunDeployed: false,
                  returnRest: "none",
                  returnBagriderActive: false,
                }
              : prev,
          );
          if (pair.hitFasit) setFindHitAar(pair);
        }}
        skipLabel="Fortsett"
        ariaLabel={isUgle ? "Ugle funnet" : "Fugl funnet"}
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
        hasKestrelInKit={!!kestrelItem}
        hasWindMeterInKit={!!windMeterItem && !kestrelItem}
        windMeterErrorPercent={
          windMeterItem && isBallisticsItem(windMeterItem)
            ? windMeterItem.ballistics.windErrorPercent
            : 18
        }
        windMeterBrand={windMeterItem?.brand}
        windMeterName={windMeterItem?.name}
        initialSessionZeroMm={huntScopeTurretsRef.current}
        onSessionZeroChange={(xMm, yMm) => {
          huntScopeTurretsRef.current = { x: xMm, y: yMm };
        }}
        initialSideDrums={huntSideDrumsRef.current}
        onSideDrumsChange={(parallaxFocusM, reticleIllum) => {
          huntSideDrumsRef.current = { parallaxFocusM, reticleIllum };
        }}
        crosswindMs={shootSession.crosswindMs}
        densityRatio={shootSession.densityRatio}
        temperatureC={weather.live.temperatureC}
        forecastTemperatureC={weather.forecast.temperatureC}
        shotBearingDeg={shootSession.bearingDeg}
        windFromDeg={weather.live.windFromDeg}
        windSpeedMs={weather.live.windSpeedMs}
        clockMinutes={clockMinutes}
        kitItems={kitItems}
        inventory={inventory}
        ammoAffinities={ammoAffinities}
        zeroingProfiles={zeroingProfiles}
        dopeCard={dopeCard}
        kestrelProfiles={kestrelProfiles}
        realLoadProfiles={realLoadProfiles}
        useRealDataInSimulation={useRealDataInSimulation}
        realism={realism}
        scopeAimControl={scopeAimControl}
        scopeZoomOnFocus={scopeZoomOnFocus}
        focusTriggerBarLength={focusTriggerBarLength}
        zenMode={zenMode}
        customsMoaDelta={customsMoaDelta}
        customsCalmMult={customsCalmMult}
        recoilDamping={computeRecoilDamping({
          soundReductionDb: suppressorSoundDb,
          customsMods,
        })}
        customsTriggerPullScale={triggerPullScale}
        barrelWearScale={huntBarrelWearScale}
        customBarrels={customBarrels}
        mountHuntDriftMm={mountHuntDriftMmRef.current}
        physicalFatigue={physicalFatigue}
        mentalFatigue={effectiveMentalFatigue}
        heartRateBpm={pulse.heartRateBpm}
        birdFlip={!!shootSession.bird.flip}
        birdSpriteId={shootSession.bird.spriteId}
        landscapeSrc={shootSession.imageSrc}
        landscapeFocusX={shootSession.bird.x}
        landscapeFocusY={shootSession.bird.y}
        landscapeBirdWidthPct={shootSession.bird.widthPct}
        camoSneakPct={camoSneakPct}
        birdNerve={shootSession.birdNerve}
        onAffinitiesChange={onAffinitiesChange}
        onConsumeAmmo={onConsumeAmmo}
        onEnsureZeroing={onEnsureZeroing}
        onAddDope={onAddDope}
        onLogSeries={onLogSeries}
        chronoActive={!!shootSession.chronoActive}
        kestrelEnviroActive={!!shootSession.kestrelEnviroActive}
        triggercamActive={!!shootSession.triggercamActive}
        isAdmin={isAdmin}
        shootRest={shootSession.rest ?? "none"}
        shootBagriderActive={!!shootSession.bagriderActive}
        gunPrepOnly={!!shootSession.gunPrepOnly}
        scanBirdPlacements={shootSession.scanBirdPlacements}
        scopeMarkedBirdId={scopeMarkedAware?.bird.birdId ?? null}
        onMarkBirdFromScope={
          shootSession.gunPrepOnly &&
          !scopeMarkedAware &&
          !scopeReviewResumeRef.current
            ? onMarkBirdFromGunScope
            : undefined
        }
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
          setMentalFatigue((m) =>
            clampFatigue(m + SHOOT_FLUSH_MIND_HIT),
          );
          queueNervousFlush(result.event);
          setLog(
            "Fuglen flyr rett før du er klar til avtrekk.. ingen sigar på deg. Bitterheten river. 30% redusert morale.",
          );
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
        camoSneakPct={camoSneakPct}
        initialBirdNerve={
          awareSession.returnNerve ??
          birdEncounter?.nerve ??
          initialEncounterNerve(
            birds.find((b) => b.id === awareSession.bird.birdId)?.spookCount ??
              0,
          )
        }
        initialCamcorderReady={!!awareSession.returnCamcorderActive}
        initialChronoReady={!!awareSession.returnChronoActive}
        initialKestrelEnviroReady={!!awareSession.returnKestrelEnviroActive}
        initialTriggercamReady={!!awareSession.returnTriggercamActive}
        initialGunDeployed={
          fieldGunDeployed || !!awareSession.returnGunDeployed
        }
        initialRest={awareSession.returnRest ?? "none"}
        initialBagriderActive={!!awareSession.returnBagriderActive}
        gunPrepOnly={!!awareSession.gunPrepOnly}
        hasLrf={hasBinos}
        ammo={primaryAmmo?.ammo ?? null}
        hasKestrel={!!kestrelItem}
        hasBdx={hasBdxOrHabrokLrf}
        hasCamcorder={hasCamcorder}
        camcorderSetupNerve={camcorderSetupNerve}
        hasChronograph={hasChronograph}
        hasTriggercam={hasTriggercam}
        shotCamKind={shotCamKind}
        hasBackpack={hasBackpack}
        hasBipod={hasBipod}
        hasBagrider={!!customsMods.bagrider}
        bipodWeaponCalm={bipodWeaponCalm}
        gunDeployNerve={backpackRifleRaiseNerve(kitItems)}
        onGunDeployed={() => {
          setFieldGunDeployed(true);
          setAwareSession((prev) =>
            prev ? { ...prev, returnGunDeployed: true } : prev,
          );
        }}
        onMountGun={() => {
          mountFieldGun();
          // Keep session sticky in sync — otherwise find-reveal remount
          // OR`s stale returnGunDeployed and resurrects «Use gun scope».
          setAwareSession((prev) =>
            prev
              ? {
                  ...prev,
                  returnGunDeployed: false,
                  returnRest: "none",
                  returnBagriderActive: false,
                }
              : prev,
          );
        }}
        clockMinutes={clockMinutes}
        realism={realism}
        zenMode={zenMode}
        shotPairs={shotPairs}
        focusPairId={awareSession.ettersokPairId ?? null}
        onShotPairsChange={setShotPairs}
        onGameSeconds={addGameSeconds}
        onAwareSneakRealSec={onAwareSneakRealSec}
        onEttersokEffort={applyEttersokEffort}
        onProceedToShoot={proceedFromAware}
        onAbandonSearch={abandonEttersok}
        onBirdFlushed={onAwareBirdFlushed}
        onNerveChange={(nerve) => {
          setBirdEncounter((prev) => {
            if (!prev) return prev;
            const next = { ...prev, nerve };
            birdEncounterRef.current = next;
            const latent = latentSpotNerveRef.current[prev.birdId];
            if (latent) {
              latentSpotNerveRef.current[prev.birdId] = {
                ...latent,
                nerve,
              };
            }
            return next;
          });
        }}
        abortLabel="Til spotting"
        onAbort={
          awareSession.postShotSkuddpar
            ? (opts) => {
                rememberAwareStand(opts?.hunter);
                setAwareSession(null);
                // Keep the 60 s ghost — spotting must not end the register window.
                const g = postShotGhostRef.current;
                const left = g
                  ? Math.max(
                      0,
                      Math.ceil((g.expiresAtMs - Date.now()) / 1000),
                    )
                  : 0;
                beginSpot({
                  reuseImageSrc: awareSession.imageSrc,
                  initialMode: "binos",
                });
                setLog(
                  left > 0
                    ? `Til spotting — fuglemarkør synlig i Aware i ${left} s. Åpne Aware for å registrere skuddmarkør.`
                    : "Til spotting.",
                );
              }
            : awareSession.ettersokPairId
              ? leaveEttersokToSpotting
              : backToSpotFromAware
        }
        postShotSkuddparMode={!!awareSession.postShotSkuddpar}
        postShotSkuddparSecLeft={postShotGhostSecLeft}
        onPostShotSkuddparSaved={onPostShotSkuddparSaved}
        onPairFound={(pair, opts) => {
          if (opts?.hunter) rememberAwareStand(opts.hunter);
          setMentalFatigue((m) => clampFatigue(m - FIND_BIRD_MIND_GAIN));
          setFindReveal({
            imageSrc:
              pair.harvestDraft?.species === "ugle"
                ? UGLE_FUNN_IMAGE
                : pickFunnImage(),
            pair,
          });
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
        isThermalBinocular={isHabrok}
        thermalMinZoom={thermalItem?.thermal.minZoom ?? 5}
        thermalMaxZoom={thermalItem?.thermal.maxZoom ?? 22}
        hasThermalOutline={!!thermalItem?.thermal.hasOutlineMode}
        hasThermalFusion={!!thermalItem?.thermal.hasFusionMode}
        binosPriceNok={binoItem?.priceNok ?? (isHabrok ? thermalItem?.priceNok ?? 0 : 0)}
        binosAperturePercent={binoItem?.lrf.aperturePercent ?? null}
        thermalPriceNok={thermalItem?.priceNok ?? 0}
        opticsRaiseTransitionSec={chestrigOpticsRaiseTransitionSec(kitItems)}
        clockMinutes={clockMinutes}
        hasBinos={hasBinos}
        hasThermal={hasThermal}
        hasLrf={!!lrfSpec}
        hasKestrel={!!kestrelItem}
        scopeClickUnit={scopeClickUnit}
        binosLabel={binosLabel}
        thermalLabel={thermalLabel}
        thermalBatteryGameSec={thermalBatteryGameSec}
        thermalBatteryMaxGameSec={thermalBatteryMaxGameSec}
        realism={realism}
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
        solveLrfHold={solveLrfHold}
        solveElevClicks={solveElevClicks}
        onBirdObserved={onBirdObserved}
        onLrfSample={(sample) => {
          lastSpotLrfRef.current = {
            bearingDeg: sample.bearingDeg,
            distanceM: sample.distanceM,
          };
        }}
        onResumeEngage={
          engageResume ? () => resumeEngageFromSpot() : undefined
        }
        engageResumeActive={!!engageResume}
        onOpenAware={openAwareOverview}
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
            Mental {pct(staminaLeft(effectiveMentalFatigue))}
            {redBullActive ? ` (Red Bull crash ${redBullMinutesLeft} min)` : ""} ·
            Fysisk{" "}
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
                  const mins = pathTravelMinutes(
                    map.id,
                    pos,
                    selected,
                    p,
                    clothingSpeedPct,
                  )
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
                    setPanel("study");
                    setLog(
                      "Study map — klikk rundt på ruter. Go back avslutter.",
                    );
                  }}
                >
                  Study
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
                    {postShotGhost
                      ? `Fugleposisjon synlig i Aware i ${postShotGhostSecLeft} s — registrer skuddmarkør (Shoot) før tiden går ut.`
                      : pendingPostShot.resultKind === "ettersok"
                        ? "Ettersøk venter. Speid videre om du vil, eller åpne Hent/søk."
                        : "Skuddmarkør lagret. Speid videre om noen ble sittende, eller åpne Hent/søk."}
                  </p>
                  {postShotGhost ? (
                    <button
                      type="button"
                      className="intro-button"
                      onClick={openPostShotSkuddparAware}
                    >
                      Registrer skuddmarkør ({postShotGhostSecLeft} s)
                    </button>
                  ) : null}
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
                      title="S"
                    >
                      Spot for birds
                    </button>
                    <button
                      type="button"
                      className="intro-button"
                      onClick={() => openAwareOverview()}
                      title="A"
                    >
                      Aware
                    </button>
                    <button
                      type="button"
                      className="intro-button"
                      onClick={() => setPanel("eat")}
                      title="R"
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
                      title="M"
                    >
                      Study map
                    </button>
                  </div>
                  {unfinishedShotPairs.length > 0 ? (
                    <div className="hunt-side-actions hunt-side-actions-stack">
                      <p className="shop-row-note">
                        {unfinishedShotPairs.length === 1
                          ? "1 skuddmarkør venter på Hent/søk:"
                          : `${unfinishedShotPairs.length} skuddmarkører venter på Hent/søk:`}
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
                      const mins = pathTravelMinutes(
                    map.id,
                    pos,
                    selected,
                    p,
                    clothingSpeedPct,
                  )
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
                            : item.food.temporaryMindFullMinutes
                              ? `Mind → 100% · crash ${item.food.temporaryMindFullMinutes} min tilbake · ${recovery?.minutes ?? item.food.minutes} min`
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
                    disabled={!hasThermos || thermosCupsLeft <= 0}
                    onClick={drinkCoffee}
                  >
                    <span className="hunt-eat-option-title">
                      {COFFEE_RECOVERY.label}
                    </span>
                    <span className="hunt-eat-option-meta">
                      {!hasThermos
                        ? "Krever termos i kit"
                        : thermosCupsLeft <= 0
                          ? "Termos tom (5/5 drukket)"
                          : `Body +${formatStaminaPct(COFFEE_RECOVERY.bodyGain)} · Mind +${formatStaminaPct(COFFEE_RECOVERY.mindGain)} · ${COFFEE_RECOVERY.minutes} min · ${thermosCupsLeft}/${THERMOS_CUPS_PER_FILL} igjen`}
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
                      {formatStaminaPct(restBodyGain(SHORT_REST_RECOVERY.bodyGain))}{" "}
                      · Mind +
                      {formatStaminaPct(SHORT_REST_RECOVERY.mindGain)} ·{" "}
                      {SHORT_REST_RECOVERY.minutes} min
                      {hasSitPad ? " · sittpute ×1.2 body" : ""}
                      {clothingRecoveryPct !== 0
                        ? ` · klær ${clothingRecoveryPct > 0 ? "+" : ""}${clothingRecoveryPct}% body`
                        : ""}
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
                      {formatStaminaPct(restBodyGain(TYRIBAL_RECOVERY.bodyGain))}{" "}
                      ·{" "}
                      {fireStarter
                        ? `${TYRIBAL_RECOVERY.minutes - fireStarter.minutesSaved} min (−${fireStarter.minutesSaved} med brikker · ${fireStarter.qty} bål igjen)`
                        : `${TYRIBAL_RECOVERY.minutes} min`}
                      {hasSitPad ? " · sittpute ×1.2 body" : ""}
                      {clothingRecoveryPct !== 0
                        ? ` · klær ${clothingRecoveryPct > 0 ? "+" : ""}${clothingRecoveryPct}% body`
                        : ""} ·{" "}
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
