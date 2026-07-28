"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { LocationNav } from "@/components/town/LocationNav";
import { ExpandableSection } from "@/components/ui/ExpandableSection";
import { FavoriteKitPanel } from "@/components/town/FavoriteKitPanel";
import {
  isAmmoItem,
  isBallisticsItem,
  isBipodItem,
  isLrfItem,
  isMiscItem,
  isMountItem,
  isRifleItem,
  isScopeItem,
  isStockItem,
  isSuppressorItem,
  type ShopItem,
} from "@/lib/shop/types";
import { resolveBulletWeightGrains } from "@/lib/ammo/spec";
import {
  computeFeltRecoil,
  computeRecoilDamping,
  recoilKickScale,
  shoulderedWeaponWeightKg,
} from "@/lib/range/recoil";
import {
  isChronographMisc,
  isRangeFanMisc,
  isChamberCoolerMisc,
  miscKitMirageMult,
  miscKitWeaponCalmGrams,
} from "@/lib/misc/spec";
import {
  mirageStrengthAtTime,
  createMiragePhase,
  type MiragePhase,
} from "@/lib/range/mirage";
import {
  bumpBarrelHeatTarget,
  createBarrelHeatState,
  tickBarrelHeat,
  barrelHeatForRifle,
  mirageFromBarrelHeat,
  type BarrelHeatState,
} from "@/lib/range/barrelHeat";
import { BarrelHeatBar } from "@/components/range/BarrelHeatBar";
import {
  FOCUS_HOLD_MS,
  TRIGGER_BAR_MS,
  caliberBulletDiameterMm,
  clampScopeZoom,
  combinedDispersionMoa,
  computeWeaponCalmFactor,
  effectiveCalmWithFocus,
  ensureAmmoAffinity,
  focusPhase,
  focusRemainingMs,
  focusShouldAbort,
  measureGroup,
  RANGE_DISTANCE_M,
  RANGE_DISTANCES_M,
  RANGE_EASY_ZERO_SCALE,
  rollTriggerTargetMs,
  sampleRealSystemGroupMoa,
  sampleShotFromPoa,
  triggerPullErrorFactor,
  triggerPullOffsetMm,
  wobbleAmplitudeMm,
  type GroupMeasurement,
  type RangeDistanceM,
  type ShotImpact,
} from "@/lib/range/precision";
import { zeroingTargetAndReticleScale } from "@/lib/range/scopeViewScale";
import {
  DEFAULT_TARGET_BY_DISTANCE,
  RANGE_TARGET_IDS,
  getRangeTarget,
  mmToPxOnTarget,
  targetBullseyeOffsetFromImageCenterPx,
  type RangeTargetId,
} from "@/lib/range/targets";
import {
  aimMmDeltaFromPointerDrag,
  clampAimMm,
  SCOPE_AIM_TAP_MM,
  scopeAimHoldMult,
} from "@/lib/range/scopePointerAim";
import {
  MOA_RANGE_TARGET_SCALE,
  mmAt100ToScopeClicks,
} from "@/lib/optics/clicks";
import { MM_PER_MOA_AT_100M } from "@/lib/ballistics/dispersion";
import type { ScopeClickUnit } from "@/lib/optics/spec";
import { scopeFovDiameterScale } from "@/lib/optics/spec";
import type { GameRealism } from "@/lib/optics/turretStyle";
import {
  DEFAULT_ZERO_DISTANCE_M,
} from "@/lib/ballistics/trajectory";
import { SeriesMeasureView } from "@/components/town/SeriesMeasureView";
import { ShotLogView } from "@/components/town/ShotLogView";
import { DopeCardView } from "@/components/town/DopeCardView";
import { MoaCompetitionView } from "@/components/town/MoaCompetitionView";
import { FieldImpactCompetitionView } from "@/components/town/FieldImpactCompetitionView";
import { ScopeReticle } from "@/components/range/ScopeReticle";
import { ScopeOpticFit } from "@/components/range/ScopeOpticFit";
import {
  ScopeElevationDial,
  ScopeTurrets,
  ScopeWindageDial,
} from "@/components/range/ScopeTurrets";
import { MaybeScopeTube } from "@/components/range/ScopeTubeLayout";
import { ParallaxTurret } from "@/components/range/ParallaxTurret";
import { IlluminationTurret } from "@/components/range/IlluminationTurret";
import { focusBlurPx } from "@/lib/range/parallaxFocus";
import { BubbleLevel } from "@/components/range/BubbleLevel";
import { resolveBubbleLevelFromKit } from "@/lib/range/bubbleLevel";
import {
  composeCantedImpactMm,
  CANT_KEY_DEG_PER_SEC,
  initialCantDeg,
  isCantGameplayActive,
  nudgeCantDeg,
} from "@/lib/range/cant";
import { RangeChronoPanel } from "@/components/range/RangeChronoPanel";
import { ScopeZoomRing } from "@/components/range/ScopeZoomRing";
import { useTriggerBarPaint } from "@/components/range/useTriggerBarPaint";
import { useFocusBarPaint } from "@/components/range/useFocusBarPaint";
import { HuntShotConditions } from "@/components/hunt/HuntShotConditions";
import { useRangeAudio } from "@/components/range/useRangeAudio";
import {
  angularMmAtDistance,
  clampElevationTurretMm,
  clampTurretMm,
  clicksForDropMm,
  effectiveZeroOffsetMm,
  getInventoryQty,
  getRifleRoundCount,
  MAX_TURRET_OFFSET_MM,
  mmAt100ToClicks,
  ZERO_CLICK_MM,
  zeroingKey,
  type InventoryEntry,
  type ShotLogEntry,
  type DopeCardEntry,
  type ZeroingProfile,
} from "@/lib/player";
import { applyScopeClickError, rollScopeClickScale } from "@/lib/optics/spec";
import {
  densityRatioFromTempC,
  exactBallisticHold,
} from "@/lib/ballistics/solver";
import {
  chronographKindFromKitIds,
  computeChronoSeriesStats,
  kestrelSolveAmmo,
  profileFromChronoSeries,
  type KestrelGunProfile,
} from "@/lib/ballistics/kestrelProfile";
import {
  isRealDataActive,
  realLoadForRifle,
  resolveZeroingDropMm,
  applyRealLoadToAmmo,
  interpolateRealDropCm,
  displayV0MpsForAmmo,
  displayAmmoBrandName,
  type RealLoadProfile,
} from "@/lib/ballistics/realLoad";
import { isSilentSuppressedShot } from "@/lib/ammo/spec";
import type { RangeShotAudioOptions } from "@/lib/range/audio";
import { crosswindMs, type DayWeather } from "@/lib/weather/spec";
import { barrelWearMaterialFromCustom, barrelWearMoaScale } from "@/lib/rifle/barrelWear";
import {
  rifleSpecWithCustomBarrel,
  barrelV0FactorForRifle,
  type InstalledCustomBarrel,
} from "@/lib/customs/customBarrel";
import {
  RangeLoadTestBoard,
  liveChronoFromShots,
} from "@/components/range/RangeLoadTestBoard";
import type { LoadBenchRecipe } from "@/lib/reloading/recipe";
import type { ArmedLoadPlan } from "@/lib/reloading/loadPhysics";
import type { HomeLoadedLot } from "@/lib/reloading/homeLoadedAmmo";

type ShootingRangeProps = {
  kitItems: ShopItem[];
  inventory: InventoryEntry[];
  ammoAffinities: Record<string, number>;
  zeroingProfiles: Record<string, ZeroingProfile>;
  rifleRoundCounts?: Record<string, number>;
  customBarrels?: Record<string, InstalledCustomBarrel>;
  shotLog: ShotLogEntry[];
  dopeCard: DopeCardEntry[];
  /** Live day weather (same as hunt) for Enviro / App. */
  weather: DayWeather;
  /** CB Customs bedding MOA delta (negative = tighter). */
  customsMoaDelta?: number;
  /** CB Customs calm multiplier (e.g. bagrider 1.15). */
  customsCalmMult?: number;
  /** CB Customs trigger tuning — scale on bad-break POI (1 = stock, 0.5 = tuned). */
  customsTriggerPullScale?: number;
  /** Full CB mods — favorite-kit weight display (fluting / stock slim). */
  customsMods?: import("@/lib/customs/spec").CustomsMods;
  balance: number;
  onPayCompetitionFee: (amountNok: number) => boolean;
  onAwardCompetitionPayout: (amountNok: number) => void;
  onAffinitiesChange: (next: Record<string, number>) => void;
  onConsumeAmmo: (ammoId: string, rifleId?: string) => boolean;
  onEnsureZeroing: (
    rifleId: string,
    scopeId: string,
    ammoId: string,
  ) => ZeroingProfile;
  onSaveZeroing: (key: string, sessionXMm: number, sessionYMm: number) => void;
  onAddDope: (entry: Omit<DopeCardEntry, "id" | "atMs">) => void;
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
  onLogSeries: (entry: ShotLogEntry) => void;
  /** Persist load-test chrono/group onto a hjemmeladd lot (survives ammo switch). */
  onPersistHomeLotMeasure?: (
    lotId: string,
    measure: {
      meanV0Mps: number | null;
      highV0Mps: number | null;
      lowV0Mps: number | null;
      stdevV0Mps: number | null;
      groupMoa: number | null;
      extremeSpreadMm: number | null;
      seriesId?: string | null;
    },
  ) => void;
  /** Calibrated Kestrel AB gun profiles (MV / BC / dV/dT). */
  kestrelProfiles?: Record<string, KestrelGunProfile>;
  onUpsertKestrelProfile?: (profile: KestrelGunProfile) => void;
  realLoadProfiles?: RealLoadProfile[];
  useRealDataInSimulation?: boolean;
  /** medium = classic HUD dials; high = tube-mounted realistic turrets. */
  realism?: GameRealism;
  /** Laderommet — load-test lane. */
  loadBenchRecipe?: LoadBenchRecipe | null;
  homeLoadedLots?: HomeLoadedLot[];
  armedLoadPlan?: ArmedLoadPlan | null;
  onArmHomeLot?: (lotId: string) => void;
  onDisarmLoadPlan?: () => void;
  favoriteKitIds?: string[];
  onPackFavoriteKit?: () => void;
  onRemoveFavoriteItem?: (itemId: string) => void;
  onLeave: () => void;
};

type AimKeys = {
  up: number | null;
  down: number | null;
  left: number | null;
  right: number | null;
  ccw: number | null;
  cw: number | null;
};

const AIM_SPEED_MM_PER_SEC = 22;
/**
 * Old ±80 mm @ 100 m ≈ paper-only. Zeroing/load-test need free pan past the
 * board (look around the lane). ~35 mil each way @ 100 m.
 */
const ZEROING_AIM_LIMIT_MM_AT_100M = 3500;
/** While holding F: slower arrows for fine reticle placement. */
const FOCUS_AIM_SPEED_MULT = 0.28;
/** Arrow tap while F held — fraction of the unfocused tap step. */
const FOCUS_AIM_TAP_MULT = 0.15;
const DEFAULT_SCOPE_ZOOM = 12;

function zeroingAimLimitMm(distanceM: number): number {
  return ZEROING_AIM_LIMIT_MM_AT_100M * (distanceM / RANGE_DISTANCE_M);
}

export function ShootingRange({
  kitItems,
  inventory,
  ammoAffinities,
  zeroingProfiles,
  rifleRoundCounts = {},
  customBarrels = {},
  shotLog,
  dopeCard,
  weather,
  customsMoaDelta = 0,
  customsCalmMult = 1,
  customsTriggerPullScale = 1,
  customsMods,
  balance,
  onPayCompetitionFee,
  onAwardCompetitionPayout,
  onAffinitiesChange,
  onConsumeAmmo,
  onEnsureZeroing,
  onSaveZeroing,
  onAddDope,
  onUpdateDope,
  onRemoveDope,
  onLogSeries,
  onPersistHomeLotMeasure,
  kestrelProfiles = {},
  onUpsertKestrelProfile,
  realLoadProfiles = [],
  useRealDataInSimulation = false,
  realism = "medium",
  loadBenchRecipe = null,
  homeLoadedLots = [],
  armedLoadPlan = null,
  onArmHomeLot,
  onDisarmLoadPlan,
  favoriteKitIds = [],
  onPackFavoriteKit,
  onRemoveFavoriteItem,
  onLeave,
}: ShootingRangeProps) {
  const [view, setView] = useState<"range" | "shotlog" | "dope">("range");
  const [lane, setLane] = useState<
    "zeroing" | "tracking-test" | "competitions" | "load-test"
  >("zeroing");
  const laneRef = useRef(lane);
  laneRef.current = lane;
  const [compId, setCompId] = useState<"lobby" | "moa-std" | "field-impact">(
    "lobby",
  );
  const rifle = useMemo(
    () => kitItems.find(isRifleItem) ?? null,
    [kitItems],
  );
  const barrelWearScale = useMemo(
    () =>
      rifle
        ? barrelWearMoaScale(
            getRifleRoundCount(rifleRoundCounts, rifle.id),
            barrelWearMaterialFromCustom(customBarrels[rifle.id]),
          )
        : 1,
    [rifle, rifleRoundCounts, customBarrels],
  );
  const scope = useMemo(
    () => kitItems.find(isScopeItem) ?? null,
    [kitItems],
  );
  const stock = useMemo(
    () => kitItems.find(isStockItem) ?? null,
    [kitItems],
  );
  const bipod = useMemo(
    () => kitItems.find(isBipodItem) ?? null,
    [kitItems],
  );
  const suppressor = useMemo(
    () => kitItems.find(isSuppressorItem) ?? null,
    [kitItems],
  );
  const mount = useMemo(
    () => kitItems.find(isMountItem) ?? null,
    [kitItems],
  );
  const ammoOptions = useMemo(
    () => kitItems.filter(isAmmoItem),
    [kitItems],
  );
  const lrfItem = useMemo(
    () => kitItems.find(isLrfItem) ?? null,
    [kitItems],
  );
  const hasKestrel = useMemo(
    () =>
      kitItems.some(
        (i) =>
          isBallisticsItem(i) &&
          i.ballistics.measuresCrosswind &&
          !i.ballistics.windSpeedDisplayOnly,
      ),
    [kitItems],
  );
  const chronographKind = useMemo(
    () =>
      chronographKindFromKitIds(
        kitItems
          .filter((i) => isMiscItem(i) && isChronographMisc(i.misc))
          .map((i) => i.id),
      ),
    [kitItems],
  );
  const hasChronograph = chronographKind != null;
  const ownsRangeFan = useMemo(
    () =>
      inventory.some(
        (e) => e.itemId === "misc-bordvifte-batteri" && e.qty > 0,
      ) || kitItems.some((i) => isMiscItem(i) && isRangeFanMisc(i.misc)),
    [inventory, kitItems],
  );
  const hasChamberCooler = useMemo(
    () =>
      inventory.some(
        (e) => e.itemId === "misc-magnetospeed-riflekuhl" && e.qty > 0,
      ) ||
      kitItems.some((i) => isMiscItem(i) && isChamberCoolerMisc(i.misc)),
    [inventory, kitItems],
  );
  const chamberCoolMult = hasChamberCooler ? 2 : 1;
  const chamberCoolMultRef = useRef(chamberCoolMult);
  chamberCoolMultRef.current = chamberCoolMult;
  const kitMiscSpecs = useMemo(
    () => kitItems.filter(isMiscItem).map((i) => i.misc),
    [kitItems],
  );
  const gearMirageMult = useMemo(
    () => miscKitMirageMult(kitMiscSpecs, !!suppressor),
    [kitMiscSpecs, suppressor],
  );
  const miscCalmGrams = useMemo(
    () => miscKitWeaponCalmGrams(kitMiscSpecs, !!suppressor),
    [kitMiscSpecs, suppressor],
  );
  const [fanOn, setFanOn] = useState(false);
  useEffect(() => {
    if (!ownsRangeFan && fanOn) setFanOn(false);
  }, [ownsRangeFan, fanOn]);
  const [barrelHeat01, setBarrelHeat01] = useState(0);
  const [mirageStrength, setMirageStrength] = useState(0);
  const barrelHeatStateRef = useRef<BarrelHeatState>(createBarrelHeatState());
  const barrelHeatProfile = useMemo(
    () =>
      barrelHeatForRifle(
        rifle?.id,
        rifle ? customBarrels[rifle.id] : undefined,
      ),
    [rifle, customBarrels],
  );
  const barrelHeatProfileRef = useRef(barrelHeatProfile);
  barrelHeatProfileRef.current = barrelHeatProfile;
  const mirageOptsRef = useRef({
    fanOn: false,
    hasSuppressor: false,
    gearMirageMult: 1,
  });
  mirageOptsRef.current = {
    fanOn: fanOn && ownsRangeFan,
    hasSuppressor: !!suppressor,
    gearMirageMult,
  };
  const mirageMidpoint = mirageFromBarrelHeat(barrelHeat01, mirageOptsRef.current);
  const mirageStrengthRef = useRef(0);
  const miragePhaseRef = useRef<MiragePhase>(createMiragePhase());
  const weatherTempRef = useRef(weather.live.temperatureC);
  weatherTempRef.current = weather.live.temperatureC;
  /** Indoor/outdoor range lane — fixed shot bearing for Enviro / App. */
  const rangeShotBearingDeg = 0;
  const densityRatio = densityRatioFromTempC(weather.live.temperatureC);

  /** Rifle + scope keep you on the range; empty ammo is a soft status, not eject. */
  const gearReady = !!(rifle && scope);
  const hasAmmo = ammoOptions.length > 0;
  const ready = gearReady;

  const [ammoId, setAmmoId] = useState(ammoOptions[0]?.id ?? "");
  const [distanceM, setDistanceM] = useState<RangeDistanceM>(RANGE_DISTANCE_M);
  const [targetId, setTargetId] = useState<RangeTargetId>(
    DEFAULT_TARGET_BY_DISTANCE[RANGE_DISTANCE_M],
  );
  /** Paper grid: MOA (×0.727) or MIL (1 cm = 0.1 mil). Default = reticle. */
  const reticleUnit: ScopeClickUnit = scope?.scope.clickUnit ?? "MRAD";
  const [paperUnit, setPaperUnit] = useState<ScopeClickUnit>(reticleUnit);
  /**
   * 10× helper: larger paper (undo ×0.1 true-angular) for readable innskyting.
   * Turret stays 1 klikk per knepp. Off for tracking-test.
   */
  const [easy10x, setEasy10x] = useState(false);
  const target = getRangeTarget(targetId);
  const [zoom, setZoom] = useState(DEFAULT_SCOPE_ZOOM);
  const [sessionZeroXMm, setSessionZeroXMm] = useState(0);
  const [sessionZeroYMm, setSessionZeroYMm] = useState(0);
  const [parallaxFocusM, setParallaxFocusM] = useState(100);
  const [reticleIllum, setReticleIllum] = useState(0);
  const tubeMode = realism === "high";
  const blurPx = tubeMode ? focusBlurPx(distanceM, parallaxFocusM) : 0;
  const [aimMm, setAimMm] = useState({ x: 0, y: 0 });
  const [shots, setShots] = useState<ShotImpact[]>([]);
  const [measurement, setMeasurement] = useState<GroupMeasurement | null>(
    null,
  );
  const [status, setStatus] = useState(
    "Hold F (fokus) → merke på avtrekksbar. Hold Space, slipp på merket.",
  );
  const [focusUi, setFocusUi] = useState<{
    phase: "idle" | "settling" | "focused" | "fatigued";
    remainingMs: number;
  }>({ phase: "idle", remainingMs: 0 });
  const [triggerUi, setTriggerUi] = useState<{
    pending: boolean;
    /** 0–1 mark on bar while focused. */
    targetPct: number;
  }>({ pending: false, targetPct: 0 });
  const { fillRef: triggerFillRef, paintTriggerProgress, resetTriggerProgress } =
    useTriggerBarPaint();
  const {
    focusFillRef,
    focusBarRef,
    paintFocusProgress,
    resetFocusProgress,
  } = useFocusBarPaint();
  const scopeWorldRef = useRef<HTMLDivElement>(null);
  const scopeReticleOffsetRef = useRef<HTMLDivElement>(null);
  const mirageSceneRef = useRef<HTMLDivElement>(null);
  const mirageDisplaceRef = useRef<SVGFEDisplacementMapElement>(null);
  const targetScaleRef = useRef(1);
  const bullseyeOffRef = useRef({ x: 0, y: 0 });
  const imgNaturalWRef = useRef(target.nativeWidth);
  const targetPxPerMmRef = useRef(target.pxPerMm);
  const targetPxPerMmYRef = useRef(target.pxPerMmY ?? target.pxPerMm);
  /** Tracking test: stable realized click scale per axis (± clickErrorPercent). */
  const trackingClickScaleRef = useRef({ x: 1, y: 1 });
  const [recoilActive, setRecoilActive] = useState(false);
  const bubbleLevel = useMemo(
    () => resolveBubbleLevelFromKit(kitItems),
    [kitItems],
  );
  const cantActive = isCantGameplayActive(realism, !!bubbleLevel);
  const cantActiveRef = useRef(cantActive);
  cantActiveRef.current = cantActive;
  const [cantDeg, setCantDeg] = useState(() =>
    initialCantDeg(realism, !!resolveBubbleLevelFromKit(kitItems)),
  );
  const cantDegRef = useRef(cantDeg);
  cantDegRef.current = cantDeg;
  const liveCantDeg = () =>
    cantActiveRef.current ? cantDegRef.current : 0;

  useEffect(() => {
    if (cantActive) return;
    if (cantDegRef.current === 0) return;
    cantDegRef.current = 0;
    setCantDeg(0);
  }, [cantActive]);
  const recoilClearRef = useRef<number | null>(null);
  /** Tracking test: freeze reticle (ignore F release until unlock). */
  const [trackingLocked, setTrackingLocked] = useState(false);
  const trackingLockedRef = useRef(false);
  trackingLockedRef.current = trackingLocked;
  const fHeldRef = useRef(false);
  const sessionZeroXRef = useRef(0);
  const sessionZeroYRef = useRef(0);
  sessionZeroXRef.current = sessionZeroXMm;
  sessionZeroYRef.current = sessionZeroYMm;

  const keysRef = useRef<AimKeys>({
    up: null,
    down: null,
    left: null,
    right: null,
    ccw: null,
    cw: null,
  });
  const aimRef = useRef(aimMm);
  const aimDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [aimDragging, setAimDragging] = useState(false);
  const wobbleRef = useRef({ x: 0, y: 0 });
  const measurementRef = useRef(measurement);
  const shotsLenRef = useRef(0);
  const distanceRef = useRef(distanceM);
  const wobblePhase = useRef({ a: Math.random() * 10, b: Math.random() * 10 });
  const weaponCalmRef = useRef(1);
  const focusRef = useRef({ held: false, startedAtMs: 0 });
  const triggerMarkRef = useRef<number | null>(null);
  const triggerRef = useRef<{
    held: boolean;
    startedAtMs: number | null;
  }>({ held: false, startedAtMs: null });
  const triggerPullRef = useRef(0);
  /** CB Real loads: one sampled series envelope for the whole group. */
  const realSeriesEnvelopeMoaRef = useRef<number | null>(null);
  const fireShotRef = useRef(() => {});
  const playShotRef = useRef<
    (opts: boolean | RangeShotAudioOptions) => void
  >(() => {});
  const consumeAmmoRef = useRef(onConsumeAmmo);

  const kitIds = useMemo(() => kitItems.map((i) => i.id), [kitItems]);
  const inventoryItemIds = useMemo(
    () => inventory.map((e) => e.itemId),
    [inventory],
  );

  const { playShot } = useRangeAudio({ enabled: true });

  const selectedAmmo = ammoOptions.find((a) => a.id === ammoId) ?? null;
  const ammoRemaining = selectedAmmo
    ? getInventoryQty(inventory, selectedAmmo.id)
    : 0;
  const seriesChronoVelocities = useMemo(
    () =>
      shots
        .map((s) => s.v0Mps)
        .filter((v): v is number => v != null && Number.isFinite(v) && v > 0),
    [shots],
  );
  const kestrelAmmoSolve = selectedAmmo
    ? kestrelSolveAmmo(
        selectedAmmo.ammo,
        selectedAmmo.id,
        kestrelProfiles,
        {
          active: isRealDataActive({
            useRealDataInSimulation,
            kitIds,
            inventoryItemIds,
            realLoad: realLoadForRifle(realLoadProfiles, rifle?.id),
            ammoId: selectedAmmo.id,
          }),
          profile: realLoadForRifle(realLoadProfiles, rifle?.id),
        },
      )
    : null;
  const comboKey =
    rifle && scope && selectedAmmo
      ? zeroingKey(rifle.id, scope.id, selectedAmmo.id)
      : null;
  const zeroProfile = comboKey ? zeroingProfiles[comboKey] ?? null : null;
  const effectiveZero = zeroProfile
    ? effectiveZeroOffsetMm(
        zeroProfile,
        sessionZeroXMm,
        sessionZeroYMm,
        distanceM,
      )
    : {
        xMm: angularMmAtDistance(sessionZeroXMm, distanceM),
        yMm: angularMmAtDistance(sessionZeroYMm, distanceM),
      };

  const calmFactor = useMemo(
    () =>
      computeWeaponCalmFactor({
        hasBipod: !!bipod,
        bipod: bipod?.bipod,
        suppressorWeightGrams: suppressor?.weightGrams,
        extraCalmGrams: miscCalmGrams,
        customsCalmMult,
      }),
    [bipod, suppressor, miscCalmGrams, customsCalmMult],
  );
  const recoilDamping = useMemo(
    () =>
      computeRecoilDamping({
        soundReductionDb: suppressor?.suppressor.soundReductionDb ?? null,
        customsMods: customsMods ?? null,
      }),
    [suppressor, customsMods],
  );
  const recoilKick = useMemo(() => {
    if (!rifle || !selectedAmmo) return 1;
    const grains = resolveBulletWeightGrains(
      selectedAmmo.ammo,
      `${selectedAmmo.brand} ${selectedAmmo.name}`,
    );
    const v0 =
      selectedAmmo.ammo.v0 *
      barrelV0FactorForRifle(rifle.id, customBarrels[rifle.id]);
    const felt = computeFeltRecoil({
      weaponCalm: calmFactor,
      recoilDamping,
      bulletWeightGrains: grains,
      v0Mps: v0,
      weaponWeightKg: shoulderedWeaponWeightKg({
        rifleGrams: rifle.weightGrams,
        scopeGrams: scope?.weightGrams,
        mountGrams: mount?.weightGrams,
        suppressorGrams: suppressor?.weightGrams,
        bipodGrams: bipod?.weightGrams,
      }),
    });
    return recoilKickScale(felt);
  }, [
    rifle,
    scope,
    mount,
    suppressor,
    bipod,
    selectedAmmo,
    calmFactor,
    recoilDamping,
    customBarrels,
  ]);
  useEffect(() => {
    weaponCalmRef.current = calmFactor;
  }, [calmFactor]);

  useEffect(() => {
    if (scope) {
      setZoom(clampScopeZoom(DEFAULT_SCOPE_ZOOM, scope.scope));
    }
  }, [scope]);

  /** New scope → paper grid defaults to that reticle's unit. */
  useEffect(() => {
    setPaperUnit(reticleUnit);
  }, [scope?.id, reticleUnit]);

  useEffect(() => {
    if (!ammoId && ammoOptions[0]) setAmmoId(ammoOptions[0].id);
  }, [ammoId, ammoOptions]);

  useEffect(() => {
    aimRef.current = aimMm;
  }, [aimMm]);
  useEffect(() => {
    distanceRef.current = distanceM;
  }, [distanceM]);

  useEffect(() => {
    measurementRef.current = measurement;
  }, [measurement]);

  useEffect(() => {
    shotsLenRef.current = shots.length;
  }, [shots.length]);

  useEffect(() => {
    playShotRef.current = playShot;
  }, [playShot]);

  useEffect(() => {
    consumeAmmoRef.current = onConsumeAmmo;
  }, [onConsumeAmmo]);

  useEffect(() => {
    if (!rifle || !scope || !selectedAmmo) return;
    onEnsureZeroing(rifle.id, scope.id, selectedAmmo.id);
    setSessionZeroXMm(0);
    setSessionZeroYMm(0);
  }, [rifle, scope, selectedAmmo, onEnsureZeroing]);

  fireShotRef.current = () => {
    if (!ready || !rifle || !selectedAmmo || !scope) return;
    if (getInventoryQty(inventory, selectedAmmo.id) <= 0) {
      setStatus(
        lane === "load-test"
          ? "Tom for hjemmeladd ammo — lad mer i Laderommet."
          : "Tom for ammo — kjøp mer hos XXL.",
      );
      return;
    }
    if (measurementRef.current) {
      setStatus("Målt ferdig — start ny serie for flere skudd.");
      return;
    }
    if (!consumeAmmoRef.current(selectedAmmo.id, rifle.id)) {
      setStatus(
        lane === "load-test"
          ? "Tom for hjemmeladd ammo — lad mer i Laderommet."
          : "Tom for ammo — kjøp mer hos XXL.",
      );
      return;
    }

    setShots((prev) => {
      if (measurementRef.current) {
        return prev;
      }

      const { affinity, map, rolled } = ensureAmmoAffinity(
        ammoAffinities,
        rifle.id,
        selectedAmmo.id,
      );
      if (rolled) onAffinitiesChange(map);

      const realLoad = realLoadForRifle(realLoadProfiles, rifle.id);
      const usingReal = isRealDataActive({
        useRealDataInSimulation,
        kitIds,
        inventoryItemIds,
        realLoad,
        ammoId: selectedAmmo.id,
      });
      const sim = kestrelSolveAmmo(
        selectedAmmo.ammo,
        selectedAmmo.id,
        kestrelProfiles,
        {
          active: usingReal,
          profile: realLoad,
        },
      );
      // Measured MV is already for this rifle — do not re-scale by barrel length.
      const simAmmo =
        usingReal && realLoad
          ? applyRealLoadToAmmo(selectedAmmo.ammo, realLoad)
          : sim.ammo;
      const simDvDt = usingReal && realLoad ? realLoad.dvDtMpsPerC : sim.dvDtMpsPerC;
      const dispersionInput = {
        rifle: rifleSpecWithCustomBarrel(
          rifle.rifle,
          customBarrels[rifle.id],
        ),
        ammo: simAmmo,
        stock: stock?.stock,
        affinity,
        customsMoaDelta,
        barrelWearScale,
        mirageFactor: usingReal ? 0 : mirageStrengthRef.current,
        barrelV0Factor: usingReal
          ? 1
          : barrelV0FactorForRifle(rifle.id, customBarrels[rifle.id]),
      };
      let poa: { xMm: number; yMm: number };
      let seriesGroupEnvelopeMoa: number | null = null;
      if (usingReal) {
        // Measured groups already include shooter error — no wobble/trigger on POA.
        poa = { xMm: aimRef.current.x, yMm: aimRef.current.y };
        const mean = simAmmo.systemGroupMoaOverride;
        const best = simAmmo.systemGroupMoaBest;
        if (
          mean != null &&
          best != null &&
          Number.isFinite(mean) &&
          Number.isFinite(best)
        ) {
          if (realSeriesEnvelopeMoaRef.current == null) {
            realSeriesEnvelopeMoaRef.current = sampleRealSystemGroupMoa(
              mean,
              best,
            );
          }
          seriesGroupEnvelopeMoa = realSeriesEnvelopeMoaRef.current;
        }
      } else {
        const w = wobbleRef.current;
        const envelopeMoa = combinedDispersionMoa(dispersionInput);
        const pull = triggerPullOffsetMm(
          triggerPullRef.current * customsTriggerPullScale,
          envelopeMoa,
          distanceRef.current,
        );
        poa = {
          xMm: aimRef.current.x + w.x + pull.xMm,
          yMm: aimRef.current.y + w.y + pull.yMm,
        };
      }
      const shot = sampleShotFromPoa(
        poa,
        dispersionInput,
        distanceRef.current,
        Math.random,
        {
          densityRatio,
          powderTempC: weather.live.temperatureC,
          dvDtMpsPerC: simDvDt,
          seriesGroupEnvelopeMoa,
          skipMirage: usingReal,
        },
      );
      // Drop card @ 0 °C wins over live physics when filled.
      let dropMm = shot.dropBelowLosMm;
      if (usingReal && realLoad) {
        const tableCm = interpolateRealDropCm(realLoad, distanceRef.current);
        if (tableCm != null) {
          dropMm = tableCm * 10;
        }
      }
      const clickErr = scope.scope.clickErrorPercent ?? 0;
      const realizedZero = zeroProfile
        ? effectiveZeroOffsetMm(
            zeroProfile,
            sessionZeroXMm,
            sessionZeroYMm,
            distanceRef.current,
            { clickErrorPercent: clickErr },
          )
        : {
            xMm: angularMmAtDistance(
              applyScopeClickError(sessionZeroXMm, clickErr),
              distanceRef.current,
            ),
            yMm: angularMmAtDistance(
              applyScopeClickError(sessionZeroYMm, clickErr),
              distanceRef.current,
            ),
          };
      const windageMm = shot.spinDriftMm;
      const scatterXMm = shot.xMm - poa.xMm - shot.spinDriftMm;
      const scatterYMm = shot.yMm - poa.yMm - shot.dropBelowLosMm;
      const impactBase = composeCantedImpactMm({
        poaXMm: poa.xMm,
        poaYMm: poa.yMm,
        zeroXMm: realizedZero.xMm,
        zeroYMm: realizedZero.yMm,
        scatterXMm,
        scatterYMm,
        dropMm,
        windageMm,
        cantDeg: liveCantDeg(),
      });
      const impact: ShotImpact = {
        xMm: impactBase.xMm,
        yMm: impactBase.yMm,
        diameterMm: caliberBulletDiameterMm(selectedAmmo.ammo.caliber),
        v0Mps: shot.v0,
      };
      const pullFactor = triggerPullRef.current;
      const pullNote =
        pullFactor <= 0
          ? "rent avtrekk"
          : pullFactor < 0.35
            ? "OK avtrekk"
            : pullFactor < 0.7
              ? "rykk"
              : "elendig avtrekk";
      const chronoNote =
        hasChronograph && chronographKind
          ? ` · ${chronographKind === "xero" ? "Xero" : "TB"} ${shot.v0.toFixed(0)} m/s`
          : "";
      setStatus(
        `Skudd ${prev.length + 1} · ${pullNote}${chronoNote} · ${selectedAmmo.brand} ${selectedAmmo.name}`,
      );
      playShotRef.current({
        hasSuppressor: !!suppressor,
        silent: isSilentSuppressedShot(!!suppressor, selectedAmmo.ammo),
      });
      // Recoil shake
      if (recoilClearRef.current != null) {
        window.clearTimeout(recoilClearRef.current);
      }
      setRecoilActive(false);
      window.requestAnimationFrame(() => {
        setRecoilActive(true);
        recoilClearRef.current = window.setTimeout(() => {
          setRecoilActive(false);
          recoilClearRef.current = null;
        }, 320);
      });
      const nextShots = [...prev, impact];
      barrelHeatStateRef.current = bumpBarrelHeatTarget(
        barrelHeatStateRef.current,
        barrelHeatProfileRef.current,
      );
      // Don't snap the bar — RAF catch-up paints the glide.
      const lotId = armedLoadPlan?.homeLotId;
      if (lane === "load-test" && lotId && onPersistHomeLotMeasure) {
        const chrono = hasChronograph
          ? liveChronoFromShots(nextShots.map((s) => s.v0Mps))
          : {
              meanV0Mps: null as number | null,
              highV0Mps: null as number | null,
              lowV0Mps: null as number | null,
              stdevV0Mps: null as number | null,
            };
        const group =
          nextShots.length >= 2
            ? measureGroup(nextShots, distanceRef.current)
            : null;
        queueMicrotask(() => {
          onPersistHomeLotMeasure(lotId, {
            meanV0Mps: chrono.meanV0Mps,
            highV0Mps: chrono.highV0Mps,
            lowV0Mps: chrono.lowV0Mps,
            stdevV0Mps: chrono.stdevV0Mps,
            groupMoa: group?.groupMoa ?? null,
            extremeSpreadMm: group?.extremeSpreadMm ?? null,
            seriesId: `lt-${lotId}-${nextShots.length}`,
          });
        });
      }
      return nextShots;
    });
  };

  function abortTrigger(reason: string) {
    triggerRef.current = { held: false, startedAtMs: null };
    resetTriggerProgress();
    setTriggerUi((prev) => ({
      pending: false,
      targetPct: prev.targetPct,
    }));
    if (reason) setStatus(reason);
  }

  function beginFocus(nowMs: number) {
    if (focusRef.current.held) return;
    focusRef.current = {
      held: true,
      startedAtMs: nowMs,
    };
    const markMs = rollTriggerTargetMs();
    triggerMarkRef.current = markMs;
    resetTriggerProgress();
    paintFocusProgress(1, 0);
    setTriggerUi({
      pending: false,
      targetPct: markMs / TRIGGER_BAR_MS,
    });
    setStatus(
      trackingLockedRef.current
        ? "Låst — turrets flytter crosshairs. Unlock for å slippe."
        : "Fokus — hold pusten. Slipp Space på merket i avtrekksbaren.",
    );
  }

  function endFocus(abortReason: string) {
    if (trackingLockedRef.current) {
      // Lock holds calm: F release / Fokus-up does nothing until Unlock.
      if (triggerRef.current.held) {
        abortTrigger(abortReason);
      }
      return;
    }
    if (!focusRef.current.held) return;
    focusRef.current = { held: false, startedAtMs: 0 };
    if (triggerRef.current.held) {
      abortTrigger(abortReason);
    }
    triggerMarkRef.current = null;
    resetTriggerProgress();
    resetFocusProgress();
    setTriggerUi({ pending: false, targetPct: 0 });
  }

  function setTrackingLock(next: boolean) {
    trackingLockedRef.current = next;
    setTrackingLocked(next);
    if (next) {
      beginFocus(performance.now());
      setStatus(
        "Lock på — blinken står stille, crosshairs følger turret (U→ned, L→høyre).",
      );
      return;
    }
    if (!fHeldRef.current) {
      endFocus("Unlock — fokus sluppet.");
    }
    setStatus("Unlock — hold F for fokus, eller lås igjen.");
  }

  function endAimDrag(
    el?: HTMLDivElement | null,
    pointerId?: number,
  ) {
    const drag = aimDragRef.current;
    if (!drag) return;
    if (pointerId != null && drag.pointerId !== pointerId) return;
    aimDragRef.current = null;
    setAimDragging(false);
    if (el && el.hasPointerCapture(drag.pointerId)) {
      try {
        el.releasePointerCapture(drag.pointerId);
      } catch {
        /* already released */
      }
    }
  }

  function onAimPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (measurementRef.current) return;
    if (laneRef.current === "tracking-test") return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    aimDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: aimRef.current.x,
      origY: aimRef.current.y,
    };
    setAimDragging(true);
  }

  function onAimPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = aimDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (e.pointerType === "mouse" && e.buttons === 0) {
      endAimDrag(e.currentTarget, e.pointerId);
      return;
    }
    const aimLimit = zeroingAimLimitMm(distanceRef.current);
    const delta = aimMmDeltaFromPointerDrag({
      dxClientPx: e.clientX - drag.startX,
      dyClientPx: e.clientY - drag.startY,
      scale: targetScaleRef.current,
      pxPerMm: targetPxPerMmRef.current,
      sensitivity: focusRef.current.held ? FOCUS_AIM_SPEED_MULT : 1,
      viewportEl: e.currentTarget,
    });
    aimRef.current = clampAimMm(
      drag.origX + delta.x,
      drag.origY + delta.y,
      aimLimit,
    );
  }

  function onAimPointerUp(e: PointerEvent<HTMLDivElement>) {
    endAimDrag(e.currentTarget, e.pointerId);
  }

  function onAimPointerLeave(e: PointerEvent<HTMLDivElement>) {
    endAimDrag(e.currentTarget, aimDragRef.current?.pointerId);
  }

  function releaseTrigger(nowMs: number) {
    const trig = triggerRef.current;
    const markMs = triggerMarkRef.current;
    if (!trig.held || trig.startedAtMs == null) {
      triggerRef.current = { held: false, startedAtMs: null };
      resetTriggerProgress();
      setTriggerUi((prev) => ({
        ...prev,
        pending: false,
      }));
      return;
    }
    if (!focusRef.current.held || markMs == null) {
      abortTrigger("Mistet fokus under avtrekk.");
      return;
    }
    const elapsed = Math.min(
      TRIGGER_BAR_MS,
      Math.max(0, nowMs - trig.startedAtMs),
    );
    triggerPullRef.current = triggerPullErrorFactor(elapsed, markMs);
    triggerRef.current = { held: false, startedAtMs: null };
    resetTriggerProgress();
    setTriggerUi((prev) => ({
      pending: false,
      targetPct: prev.targetPct,
    }));
    fireShotRef.current();
  }

  function beginTrigger(nowMs: number) {
    if (triggerRef.current.held) return;
    if (measurementRef.current) {
      setStatus("Målt ferdig — start ny serie.");
      return;
    }
    if (!focusRef.current.held || triggerMarkRef.current == null) {
      setStatus("Hold F (pust/fokus) før du tar avtrekk — da settes merket.");
      return;
    }
    if (ammoRemaining <= 0) {
      setStatus("Tom for ammo — kjøp mer hos XXL.");
      return;
    }
    triggerRef.current = {
      held: true,
      startedAtMs: nowMs,
    };
    paintTriggerProgress(0);
    setTriggerUi((prev) => ({ ...prev, pending: true }));
    setStatus("Avtrekk… slipp Space på merket");
  }

  // Keyboard
  useEffect(() => {
    if (!ready) return;

    function nudgeAim(dxMm: number, dyMm: number) {
      const aimLimit = zeroingAimLimitMm(distanceRef.current);
      aimRef.current = clampAimMm(
        aimRef.current.x + dxMm,
        aimRef.current.y + dyMm,
        aimLimit,
      );
    }

    function onKeyDown(e: KeyboardEvent) {
      const dir =
        e.key === "ArrowUp"
          ? "up"
          : e.key === "ArrowDown"
            ? "down"
            : e.key === "ArrowLeft"
              ? "left"
              : e.key === "ArrowRight"
                ? "right"
                : null;
      if (dir) {
        e.preventDefault();
        if (laneRef.current === "tracking-test") return;
        if (keysRef.current[dir] != null) return;
        keysRef.current[dir] = performance.now();
        const step =
          SCOPE_AIM_TAP_MM *
          (distanceRef.current / RANGE_DISTANCE_M) *
          (focusRef.current.held ? FOCUS_AIM_TAP_MULT : 1);
        if (dir === "up") nudgeAim(0, -step);
        if (dir === "down") nudgeAim(0, step);
        if (dir === "left") nudgeAim(-step, 0);
        if (dir === "right") nudgeAim(step, 0);
        return;
      }
      if (e.key === "q" || e.key === "Q") {
        if (!cantActiveRef.current) return;
        e.preventDefault();
        if (keysRef.current.ccw != null) return;
        keysRef.current.ccw = performance.now();
        setCantDeg((c) => nudgeCantDeg(c, -CANT_KEY_DEG_PER_SEC * 0.08));
        return;
      }
      if (e.key === "e" || e.key === "E") {
        if (!cantActiveRef.current) return;
        e.preventDefault();
        if (keysRef.current.cw != null) return;
        keysRef.current.cw = performance.now();
        setCantDeg((c) => nudgeCantDeg(c, CANT_KEY_DEG_PER_SEC * 0.08));
        return;
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        if (!scope) return;
        setZoom((z) => clampScopeZoom(z + 0.5, scope.scope));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        if (!scope) return;
        setZoom((z) => clampScopeZoom(z - 0.5, scope.scope));
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        if (e.repeat) return;
        fHeldRef.current = true;
        beginFocus(performance.now());
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        if (laneRef.current === "tracking-test") return;
        beginTrigger(performance.now());
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "ArrowUp") keysRef.current.up = null;
      if (e.key === "ArrowDown") keysRef.current.down = null;
      if (e.key === "ArrowLeft") keysRef.current.left = null;
      if (e.key === "ArrowRight") keysRef.current.right = null;
      if (e.key === "q" || e.key === "Q") keysRef.current.ccw = null;
      if (e.key === "e" || e.key === "E") keysRef.current.cw = null;
      if (e.key === "f" || e.key === "F") {
        fHeldRef.current = false;
        endFocus("Fokus sluppet — avtrekk avbrutt.");
      }
      if (e.key === " " || e.code === "Space") {
        releaseTrigger(performance.now());
      }
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [ready, scope]);

  // Aim + wobble + trigger resolve (paused while reviewing measured series)
  useEffect(() => {
    if (!ready || measurement) return;
    let raf = 0;
    let last = performance.now();
    let uiAccum = 0;

    function paintScopeWorld() {
      const el = scopeWorldRef.current;
      if (!el) return;
      const tracking = laneRef.current === "tracking-test";
      const ax = tracking ? 0 : aimRef.current.x + wobbleRef.current.x;
      const ay = tracking ? 0 : aimRef.current.y + wobbleRef.current.y;
      const scale = targetScaleRef.current;
      const off = bullseyeOffRef.current;
      const pxPerMm = targetPxPerMmRef.current;
      const panPxX = (off.x + ax * pxPerMm) * scale;
      const panPxY = (off.y + ay * pxPerMm) * scale;
      el.style.transform = `translate(calc(-50% - ${panPxX}px), calc(-50% - ${panPxY}px)) scale(${scale})`;

      const reticleEl = scopeReticleOffsetRef.current;
      if (reticleEl) {
        if (!tracking) {
          reticleEl.style.transform = "";
        } else {
          const dist = distanceRef.current;
          const sx = trackingClickScaleRef.current.x;
          const sy = trackingClickScaleRef.current.y;
          // Realized dial (perfect scopes: scale 1 → exactly 10 mm / 0.1 mrad per click).
          const zeroXmm = angularMmAtDistance(
            sessionZeroXRef.current * sx,
            dist,
          );
          const zeroYmm = angularMmAtDistance(
            sessionZeroYRef.current * sy,
            dist,
          );
          const ppmX = targetPxPerMmRef.current;
          const ppmY = targetPxPerMmYRef.current;
          // Invert: Up dial (neg Y) → reticle down; Left dial (neg X) → reticle right.
          let ox = -zeroXmm * ppmX * scale;
          let oy = -zeroYmm * ppmY * scale;
          if (!trackingLockedRef.current) {
            ox -= wobbleRef.current.x * ppmX * scale;
            oy -= wobbleRef.current.y * ppmY * scale;
          }
          reticleEl.style.transform = `translate(${ox}px, ${oy}px)`;
        }
      }
    }

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = keysRef.current;
      let { x, y } = aimRef.current;
      const tracking = laneRef.current === "tracking-test";
      if (tracking) {
        x = 0;
        y = 0;
        k.up = null;
        k.down = null;
        k.left = null;
        k.right = null;
      } else {
        const distFactor = distanceRef.current / RANGE_DISTANCE_M;
        let speed = AIM_SPEED_MM_PER_SEC * distFactor * dt;
        if (focusRef.current.held) {
          speed *= FOCUS_AIM_SPEED_MULT;
        }
        const mx = scopeAimHoldMult(k.left, now);
        const mr = scopeAimHoldMult(k.right, now);
        const mu = scopeAimHoldMult(k.up, now);
        const md = scopeAimHoldMult(k.down, now);
        if (mx > 0) x -= speed * mx;
        if (mr > 0) x += speed * mr;
        if (mu > 0) y -= speed * mu;
        if (md > 0) y += speed * md;
        const aimLimit = zeroingAimLimitMm(distanceRef.current);
        x = Math.max(-aimLimit, Math.min(aimLimit, x));
        y = Math.max(-aimLimit, Math.min(aimLimit, y));
      }
      aimRef.current = { x, y };

      const cantCcw = scopeAimHoldMult(k.ccw, now);
      const cantCw = scopeAimHoldMult(k.cw, now);
      if (cantActiveRef.current && (cantCcw > 0 || cantCw > 0)) {
        let next = cantDegRef.current;
        if (cantCcw > 0) {
          next = nudgeCantDeg(next, -CANT_KEY_DEG_PER_SEC * dt * cantCcw);
        }
        if (cantCw > 0) {
          next = nudgeCantDeg(next, CANT_KEY_DEG_PER_SEC * dt * cantCw);
        }
        if (next !== cantDegRef.current) {
          cantDegRef.current = next;
          setCantDeg(next);
        }
      }

      if (focusShouldAbort(focusRef.current, now)) {
        endFocus("Fokus brutt etter 7 s — slipp F og start på nytt.");
      }

      const calm = effectiveCalmWithFocus(
        weaponCalmRef.current,
        focusRef.current,
        now,
      );
      const t = now / 1000;
      const ph = wobblePhase.current;

      barrelHeatStateRef.current = tickBarrelHeat(
        barrelHeatStateRef.current,
        barrelHeatProfileRef.current,
        weatherTempRef.current,
        dt,
        chamberCoolMultRef.current,
      );

      const mirageMid = mirageFromBarrelHeat(
        barrelHeatStateRef.current.heat01,
        mirageOptsRef.current,
      );
      const mirage = mirageStrengthAtTime(
        mirageMid,
        t,
        miragePhaseRef.current,
      );
      mirageStrengthRef.current = mirage;

      const scene = mirageSceneRef.current;
      if (scene) {
        if (mirage > 0.015) {
          scene.style.setProperty("--mirage", mirage.toFixed(3));
          scene.classList.add("is-mirage");
          scene.classList.toggle("is-mirage-heavy", mirage > 1.1);
          scene.classList.remove("is-mirage-porridge");
        } else {
          scene.classList.remove(
            "is-mirage",
            "is-mirage-heavy",
            "is-mirage-porridge",
          );
          scene.style.removeProperty("--mirage");
        }
      }
      const displace = mirageDisplaceRef.current;
      if (displace) {
        displace.setAttribute("scale", String(Math.round(mirage * 56)));
      }

      if (tracking && trackingLockedRef.current) {
        wobbleRef.current = { x: 0, y: 0 };
      } else {
        const amp = wobbleAmplitudeMm(calm, distanceRef.current);
        wobbleRef.current = {
          x:
            Math.sin(t * 2.1 + ph.a) * amp * 0.55 +
            Math.sin(t * 5.3 + ph.b) * amp * 0.35 +
            Math.sin(t * 11.0) * amp * 0.15,
          y:
            Math.cos(t * 1.7 + ph.b) * amp * 0.55 +
            Math.cos(t * 4.6 + ph.a) * amp * 0.35 +
            Math.sin(t * 9.5 + 1) * amp * 0.15,
        };
      }

      paintScopeWorld();

      const trig = triggerRef.current;
      if (trig.held && trig.startedAtMs != null) {
        const elapsed = now - trig.startedAtMs;
        const progress = Math.min(1, Math.max(0, elapsed / TRIGGER_BAR_MS));
        paintTriggerProgress(progress);
        if (elapsed >= TRIGGER_BAR_MS) {
          releaseTrigger(trig.startedAtMs + TRIGGER_BAR_MS);
        }
      }

      if (focusRef.current.held) {
        const elapsed = now - focusRef.current.startedAtMs;
        paintFocusProgress(
          focusRemainingMs(focusRef.current, now) / FOCUS_HOLD_MS,
          elapsed,
        );
      } else {
        paintFocusProgress(0);
      }

      uiAccum += dt;
      if (uiAccum > 0.05) {
        uiAccum = 0;
        setFocusUi({
          phase: focusPhase(focusRef.current, now),
          remainingMs: focusRemainingMs(focusRef.current, now),
        });
        setBarrelHeat01(barrelHeatStateRef.current.heat01);
        setMirageStrength(mirageStrengthRef.current);
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, measurement]);

  /** Target shrinks with distance (angular size). Per-skive visualScale fixes
   * board size. Zeroing/load: ×0.1 so physical mm match true mils.
   * Tracking already true-mil. MOA paper ({@link MOA_RANGE_TARGET_SCALE}). */
  const { targetScale, reticleImgScale } = scope
    ? zeroingTargetAndReticleScale({
        zoom,
        scope: scope.scope,
        distanceM,
        target,
        paperUnit,
        trackingLane: lane === "tracking-test",
        easy10x,
      })
    : { targetScale: target.visualScale, reticleImgScale: 0 };
  const bullseyeOff = targetBullseyeOffsetFromImageCenterPx(target);
  targetScaleRef.current = targetScale;
  const fovDiameterScale = scope
    ? scopeFovDiameterScale(scope.scope)
    : 1;
  bullseyeOffRef.current = bullseyeOff;
  imgNaturalWRef.current = target.nativeWidth;
  targetPxPerMmRef.current = target.pxPerMm;
  targetPxPerMmYRef.current = target.pxPerMmY ?? target.pxPerMm;

  const activeRealLoad = realLoadForRifle(realLoadProfiles, rifle?.id);
  const usingCbRealLoads = !!(
    selectedAmmo &&
    isRealDataActive({
      useRealDataInSimulation,
      kitIds,
      inventoryItemIds,
      realLoad: activeRealLoad,
      ammoId: selectedAmmo.id,
    })
  );

  const ballisticHint = selectedAmmo
    ? (() => {
        const solveAmmo = kestrelAmmoSolve?.ammo ?? selectedAmmo.ammo;
        const dropMm = resolveZeroingDropMm({
          ammo: solveAmmo,
          distanceM,
          realLoad: activeRealLoad,
          usingReal: usingCbRealLoads,
          densityRatio,
        });
        // 0.1 mil clicks — not mm-at-100 (that is 10× larger).
        const clicks = clicksForDropMm(dropMm, distanceM);
        if (distanceM <= DEFAULT_ZERO_DISTANCE_M || Math.abs(clicks) < 0.05) {
          return `Zero ${DEFAULT_ZERO_DISTANCE_M} m · drop ≈ 0 klikk`;
        }
        const mil = (Math.abs(dropMm) / Math.max(1, distanceM)).toFixed(2);
        const tag = usingCbRealLoads ? "CB Real loads · " : "";
        const clicksTxt = Math.abs(clicks)
          .toFixed(1)
          .replace(".", ",");
        return `${tag}Zero ${DEFAULT_ZERO_DISTANCE_M} m · drop ≈ ${clicksTxt} klikk (${mil} mil / ${(dropMm / 10).toFixed(0)} cm)`;
      })()
    : null;

  const cbRealDropRows =
    usingCbRealLoads && selectedAmmo
      ? RANGE_DISTANCES_M.map((distanceMRow) => {
          const solveAmmo = kestrelAmmoSolve?.ammo ?? selectedAmmo.ammo;
          const dropMm = resolveZeroingDropMm({
            ammo: solveAmmo,
            distanceM: distanceMRow,
            realLoad: activeRealLoad,
            usingReal: true,
            densityRatio,
          });
          const mmAt100 = (dropMm * 100) / Math.max(1, distanceMRow);
          const clicks = mmAt100 / ZERO_CLICK_MM;
          return { distanceM: distanceMRow, dropMm, clicks };
        })
      : null;

  function measureSeries() {
    if (shots.length < 1) {
      setStatus("Skyt minst ett skudd før måling.");
      return;
    }
    if (!rifle || !scope || !selectedAmmo) return;
    const m = measureGroup(shots, distanceM);
    setMeasurement(m);
    if (m) {
      const chronoV0Mps = hasChronograph
        ? shots
            .map((s) => s.v0Mps)
            .filter((v): v is number => v != null && Number.isFinite(v))
        : undefined;
      const entry: ShotLogEntry = {
        id: `series-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        atMs: Date.now(),
        rifleId: rifle.id,
        scopeId: scope.id,
        ammoId: selectedAmmo.id,
        rifleLabel: `${rifle.brand} ${rifle.name}`,
        scopeLabel: `${scope.brand} ${scope.name}`,
        ammoLabel: `${selectedAmmo.brand} ${selectedAmmo.name} (${selectedAmmo.ammo.caliber})`,
        distanceM,
        shotCount: m.shotCount,
        extremeSpreadMm: m.extremeSpreadMm,
        groupMoa: m.groupMoa,
        meanRadiusMm: m.meanRadiusMm,
        poiXMm: m.poiXMm,
        poiYMm: m.poiYMm,
        // mm-at-100 m (same unit as saved/session) — mils via formatZeroAxisMm
        zeroXMm:
          (zeroProfile?.baseXMm ?? 0) +
          (zeroProfile?.savedXMm ?? 0) +
          sessionZeroXMm,
        zeroYMm:
          (zeroProfile?.baseYMm ?? 0) +
          (zeroProfile?.savedYMm ?? 0) +
          sessionZeroYMm,
        savedZeroXMm: zeroProfile?.savedXMm ?? 0,
        savedZeroYMm: zeroProfile?.savedYMm ?? 0,
        sessionZeroXMm,
        sessionZeroYMm,
        ...(chronoV0Mps && chronoV0Mps.length > 0
          ? {
              chronoV0Mps,
              chronoTemperatureC: weather.live.temperatureC,
              chronoSource: "range" as const,
            }
          : {}),
      };
      onLogSeries(entry);
      setStatus(
        chronoV0Mps && chronoV0Mps.length > 0
          ? `Serie målt og logget · Xero snitt ${(
              chronoV0Mps.reduce((a, b) => a + b, 0) / chronoV0Mps.length
            ).toFixed(0)} m/s @ ${weather.live.temperatureC.toFixed(0)}°C`
          : "Serie målt og logget — se stillbilde eller Shotlog.",
      );
    }
  }

  function newSeries() {
    setShots([]);
    setMeasurement(null);
    realSeriesEnvelopeMoaRef.current = null;
    setCantDeg(initialCantDeg(realism, cantActiveRef.current));
    abortTrigger("");
    setStatus("Ny serie — hold Fokus, piltaster, hold Avtrekk.");
    wobblePhase.current = { a: Math.random() * 10, b: Math.random() * 10 };
    miragePhaseRef.current = createMiragePhase();
  }

  useEffect(() => {
    if (shots.length === 0) realSeriesEnvelopeMoaRef.current = null;
  }, [shots.length]);

  /**
   * Write current series stats onto a hjemmeladd lot so the Load test table
   * keeps values when switching ammo.
   */
  function persistLoadTestSeriesToLot(
    lotId: string,
    seriesShots: ShotImpact[],
  ) {
    if (!lotId || seriesShots.length === 0 || !onPersistHomeLotMeasure) return;
    const chrono = hasChronograph
      ? liveChronoFromShots(seriesShots.map((s) => s.v0Mps))
      : {
          meanV0Mps: null,
          highV0Mps: null,
          lowV0Mps: null,
          stdevV0Mps: null,
        };
    const group =
      seriesShots.length >= 2 ? measureGroup(seriesShots, distanceM) : null;
    onPersistHomeLotMeasure(lotId, {
      meanV0Mps: chrono.meanV0Mps,
      highV0Mps: chrono.highV0Mps,
      lowV0Mps: chrono.lowV0Mps,
      stdevV0Mps: chrono.stdevV0Mps,
      groupMoa: group?.groupMoa ?? null,
      extremeSpreadMm: group?.extremeSpreadMm ?? null,
      seriesId: `lt-${Date.now().toString(36)}`,
    });
  }

  function nudgeZero(axis: "x" | "y", deltaMm: number) {
    // 10× only scales the paper/reticle — never the turret click size.
    if (axis === "x") {
      setSessionZeroXMm((prev) => clampTurretMm(prev + deltaMm));
      return;
    }
    setSessionZeroYMm((prev) =>
      clampElevationTurretMm(prev + deltaMm, scope?.scope),
    );
  }

  function saveCurrentZero() {
    if (!comboKey) return;
    onSaveZeroing(comboKey, sessionZeroXMm, sessionZeroYMm);
    setSessionZeroXMm(0);
    setSessionZeroYMm(0);
    setStatus("Zero lagret for denne våpen/kikkert/ammo-kombinasjonen.");
  }

  function addCurrentToDope() {
    if (!rifle || !scope || !selectedAmmo) return;
    const elev = mmAt100ToClicks(sessionZeroYMm);
    const wind = mmAt100ToClicks(sessionZeroXMm);
    onAddDope({
      rifleId: rifle.id,
      scopeId: scope.id,
      ammoId: selectedAmmo.id,
      ammoLabel: `${selectedAmmo.brand} ${selectedAmmo.name}`,
      distanceM,
      elevationClicks: elev,
      windageClicks: wind,
    });
    const elevTxt =
      elev === 0 ? "0 elev" : `${Math.abs(elev)} ${elev < 0 ? "U" : "D"}`;
    const windTxt =
      wind === 0 ? "" : ` · ${Math.abs(wind)} ${wind < 0 ? "L" : "R"}`;
    setStatus(
      `DOPE: ${selectedAmmo.name} @ ${distanceM} m → ${elevTxt}${windTxt}`,
    );
  }

  function changeAmmo(nextAmmoId: string) {
    if (nextAmmoId === ammoId) return;
    setAmmoId(nextAmmoId);
    setShots([]);
    setMeasurement(null);
    abortTrigger("");
    setStatus(
      "Ammo byttet — zero for denne ammoen (om lagret) er hentet tilbake automatisk.",
    );
  }

  function changeDistance(next: RangeDistanceM) {
    if (next === distanceM) return;
    setDistanceM(next);
    setTargetId(DEFAULT_TARGET_BY_DISTANCE[next]);
    setAimMm({ x: 0, y: 0 });
    aimRef.current = { x: 0, y: 0 };
    wobbleRef.current = { x: 0, y: 0 };
    setShots([]);
    setMeasurement(null);
    abortTrigger("");
    setStatus(`Avstand satt til ${next} m — ny serie.`);
  }

  function changeTarget(next: RangeTargetId) {
    if (next === targetId) return;
    setTargetId(next);
    setAimMm({ x: 0, y: 0 });
    aimRef.current = { x: 0, y: 0 };
    wobbleRef.current = { x: 0, y: 0 };
    setShots([]);
    setMeasurement(null);
    abortTrigger("");
    const def = DEFAULT_TARGET_BY_DISTANCE[distanceM];
    setStatus(
      next === def
        ? `Skive: ${getRangeTarget(next).label} (default for ${distanceM} m).`
        : `Skive: ${getRangeTarget(next).label} (avvik fra ${distanceM} m-default).`,
    );
  }

  function changePaperUnit(next: ScopeClickUnit) {
    if (next === paperUnit) return;
    setPaperUnit(next);
    setAimMm({ x: 0, y: 0 });
    aimRef.current = { x: 0, y: 0 };
    wobbleRef.current = { x: 0, y: 0 };
    setShots([]);
    setMeasurement(null);
    abortTrigger("");
    setStatus(
      next === "MOA"
        ? `MOA-skive (×${MOA_RANGE_TARGET_SCALE}) — 1 cm ≈ 0,25 MOA.`
        : "MIL-skive — 1 cm ≈ 0,1 mil.",
    );
  }

  const setupLocked = shots.length > 0 && !measurement;

  if (view === "shotlog") {
    return (
      <ShotLogView
        entries={shotLog}
        rifleRoundCounts={rifleRoundCounts}
        customBarrels={customBarrels}
        onBack={() => setView("range")}
        backLabel="← Tilbake til skytebanen"
      />
    );
  }

  if (view === "dope") {
    return (
      <DopeCardView
        entries={dopeCard}
        onUpdate={onUpdateDope}
        onRemove={onRemoveDope}
        onBack={() => setView("range")}
        backLabel="← Tilbake til skytebanen"
        hasKestrel={hasKestrel}
        kestrelProfiles={kestrelProfiles}
        onUpsertKestrelProfile={onUpsertKestrelProfile}
      />
    );
  }

  const laneTabs = (
    <div className="range-lane-tabs" role="tablist" aria-label="Skytebane">
      <button
        type="button"
        role="tab"
        aria-selected={lane === "zeroing"}
        className={
          lane === "zeroing" ? "range-lane-tab is-active" : "range-lane-tab"
        }
        onClick={() => {
          setLane("zeroing");
          setCompId("lobby");
        }}
      >
        Zeroing
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={lane === "tracking-test"}
        className={
          lane === "tracking-test"
            ? "range-lane-tab is-active"
            : "range-lane-tab"
        }
        onClick={() => {
          setLane("tracking-test");
          setCompId("lobby");
        }}
      >
        Tracking test
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={lane === "load-test"}
        className={
          lane === "load-test" ? "range-lane-tab is-active" : "range-lane-tab"
        }
        onClick={() => {
          setLane("load-test");
          setCompId("lobby");
        }}
      >
        Load test
        {homeLoadedLots.filter(
          (l) =>
            !loadBenchRecipe || l.caliberKey === loadBenchRecipe.caliberKey,
        ).length > 0
          ? ` (${
              homeLoadedLots.filter(
                (l) =>
                  !loadBenchRecipe ||
                  l.caliberKey === loadBenchRecipe.caliberKey,
              ).length
            })`
          : ""}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={lane === "competitions"}
        className={
          lane === "competitions"
            ? "range-lane-tab is-active"
            : "range-lane-tab"
        }
        onClick={() => setLane("competitions")}
      >
        Competitions
      </button>
    </div>
  );

  function armLoadTestLot(lot: HomeLoadedLot) {
    if (!onArmHomeLot) return;
    const prevLotId = armedLoadPlan?.homeLotId ?? null;
    if (
      prevLotId &&
      prevLotId !== lot.id &&
      shots.length > 0 &&
      !measurement
    ) {
      persistLoadTestSeriesToLot(prevLotId, shots);
    }
    onArmHomeLot(lot.id);
    setAmmoId(lot.id);
    setShots([]);
    setMeasurement(null);
    abortTrigger("");
    setStatus(
      `Load test aktiv: ${lot.powderGrains.toFixed(1)} gr · ${lot.roundsRemaining} igjen — skyt serie og mål.`,
    );
  }

  const loadTestLive = useMemo(() => {
    if (lane !== "load-test" || measurement) return null;
    const prelim =
      shots.length >= 2 ? measureGroup(shots, distanceM) : null;
    const chrono = hasChronograph
      ? liveChronoFromShots(shots.map((s) => s.v0Mps))
      : {
          meanV0Mps: null,
          highV0Mps: null,
          lowV0Mps: null,
          stdevV0Mps: null,
        };
    return {
      shotCount: shots.length,
      ...chrono,
      groupMoa: prelim && shots.length >= 2 ? prelim.groupMoa : null,
    };
  }, [lane, measurement, shots, distanceM, hasChronograph]);

  // Load test: always 100 m + standard CBA board.
  useEffect(() => {
    if (lane !== "load-test") return;
    if (distanceM !== 100) setDistanceM(100);
    if (targetId !== "cba-100") setTargetId("cba-100");
    if (paperUnit !== "MRAD") setPaperUnit("MRAD");
  }, [lane, distanceM, targetId, paperUnit]);

  // Tracking test: fixed template @ 100 m, start dial at 0, unlock.
  useEffect(() => {
    if (lane !== "tracking-test") {
      if (trackingLockedRef.current) {
        trackingLockedRef.current = false;
        setTrackingLocked(false);
      }
      if (targetId === "tracking-test") {
        setTargetId(DEFAULT_TARGET_BY_DISTANCE[distanceM] ?? "cba-100");
      }
      return;
    }
    if (distanceM !== 100) setDistanceM(100);
    if (targetId !== "tracking-test") setTargetId("tracking-test");
    if (paperUnit !== "MRAD") setPaperUnit("MRAD");
    setSessionZeroXMm(0);
    setSessionZeroYMm(0);
    setAimMm({ x: 0, y: 0 });
    aimRef.current = { x: 0, y: 0 };
    wobbleRef.current = { x: 0, y: 0 };
    setShots([]);
    setMeasurement(null);
    trackingLockedRef.current = false;
    setTrackingLocked(false);
    const errPct = scope?.scope.clickErrorPercent ?? 0;
    trackingClickScaleRef.current = {
      x: rollScopeClickScale(errPct),
      y: rollScopeClickScale(errPct),
    };
    const perfect = errPct <= 0;
    setStatus(
      perfect
        ? "Tracking test — 1 klikk = 1 cm-rute. Lock, skru 5 klikk til 5U/5R (eller 20 til 20U)."
        : `Tracking test — klikk-avvik ±${errPct}%. Lock og skru 5 klikk: treffer du 5U/5R?`,
    );
  }, [lane, scope?.id]);

  if (lane === "competitions") {
    if (compId === "moa-std") {
      return (
        <div className="shooting-range">
          <LocationNav
            onBackToTown={onLeave}
            hint="MOA-konkurranse på Losby — 10 skudd, worst shot teller"
          />
          {laneTabs}
          <MoaCompetitionView
            balance={balance}
            kitItems={kitItems}
            inventory={inventory}
            ammoAffinities={ammoAffinities}
            zeroingProfiles={zeroingProfiles}
            rifleRoundCounts={rifleRoundCounts}
            customBarrels={customBarrels}
            weather={weather}
            customsMoaDelta={customsMoaDelta}
            customsCalmMult={customsCalmMult}
            customsTriggerPullScale={customsTriggerPullScale}
            onAffinitiesChange={onAffinitiesChange}
            onConsumeAmmo={onConsumeAmmo}
            onEnsureZeroing={onEnsureZeroing}
            onPayEntryFee={onPayCompetitionFee}
            onAwardPayout={onAwardCompetitionPayout}
            onBack={() => setCompId("lobby")}
          />
        </div>
      );
    }

    if (compId === "field-impact") {
      return (
        <div className="shooting-range">
          <LocationNav
            onBackToTown={onLeave}
            hint="IMPACT! Losby — 5 feltfigurer, kun tid teller"
          />
          {laneTabs}
          <FieldImpactCompetitionView
            balance={balance}
            kitItems={kitItems}
            inventory={inventory}
            ammoAffinities={ammoAffinities}
            zeroingProfiles={zeroingProfiles}
            dopeCard={dopeCard}
            rifleRoundCounts={rifleRoundCounts}
            customBarrels={customBarrels}
            kestrelProfiles={kestrelProfiles}
            weather={weather}
            customsMoaDelta={customsMoaDelta}
            customsCalmMult={customsCalmMult}
            customsTriggerPullScale={customsTriggerPullScale}
            onAffinitiesChange={onAffinitiesChange}
            onConsumeAmmo={onConsumeAmmo}
            onEnsureZeroing={onEnsureZeroing}
            onPayEntryFee={onPayCompetitionFee}
            onAwardPayout={onAwardCompetitionPayout}
            onBack={() => setCompId("lobby")}
          />
        </div>
      );
    }

    return (
      <div className="shooting-range">
        <LocationNav
          onBackToTown={onLeave}
          hint="Entre konkurranser og tjen penger"
        />
        {laneTabs}
        <header className="shop-header">
          <p className="intro-line intro-gift">Competitions</p>
          <p className="shop-row-note">
            Saldo {balance.toLocaleString("nb-NO")} kr
          </p>
        </header>
        <ul className="moa-comp-event-list">
          <li className="moa-comp-event">
            <div className="moa-comp-event-main">
              <span className="moa-comp-event-title">
                MOA-konkurranse på Losby
              </span>
              <span className="moa-comp-event-meta">
                100 m · 10 blink · score = worst shot · start 100 kr
              </span>
            </div>
            <button
              type="button"
              className="intro-button"
              disabled={!ready || !hasAmmo}
              onClick={() => setCompId("moa-std")}
            >
              Entre
            </button>
          </li>
          <li className="moa-comp-event">
            <div className="moa-comp-event-main">
              <span className="moa-comp-event-title">IMPACT! — Losby feltfigurer</span>
              <span className="moa-comp-event-meta">
                100–500 m · tilfeldig sete · tiur/orre/ugle · kun tid · 150 kr
              </span>
            </div>
            <button
              type="button"
              className="intro-button"
              disabled={!ready || !hasAmmo}
              onClick={() => setCompId("field-impact")}
            >
              Entre
            </button>
          </li>
        </ul>
        {!ready ? (
          <p className="shop-row-note">
            Trenger rifle, scope og ammo i kit for å delta.
          </p>
        ) : null}
        <div className="range-actions">
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={onLeave}
          >
            Ferdig
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="shooting-range">
        <LocationNav onBackToTown={onLeave} />
        <p className="intro-line intro-gift">Shooting Range</p>
        <p className="intro-line">
          Du mangler rifle eller kikkert i kit. Ta med dem fra Home — så tester
          vi.
        </p>
        {!rifle ? <p className="shop-row-note">Mangler: rifle</p> : null}
        {!scope ? <p className="shop-row-note">Mangler: scope</p> : null}
        {onPackFavoriteKit && onRemoveFavoriteItem ? (
          <FavoriteKitPanel
            favoriteKitIds={favoriteKitIds}
            kit={kitItems.map((i) => i.id)}
            ownedItemIds={
              new Set(
                inventory.filter((e) => e.qty > 0).map((e) => e.itemId),
              )
            }
            onPackFavoriteKit={onPackFavoriteKit}
            onRemoveFavoriteItem={onRemoveFavoriteItem}
            customsMods={customsMods}
            customBarrels={customBarrels}
            hint="Pakker favoritt-jaktkittet og bytter ut det som ligger i kit nå."
          />
        ) : null}
        <div className="range-actions">
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={() => setView("shotlog")}
          >
            Shotlog ({shotLog.length})
          </button>
          <button type="button" className="intro-button" onClick={onLeave}>
            Ferdig
          </button>
        </div>
      </div>
    );
  }

  const focusLabel =
    focusUi.phase === "focused"
      ? `Stabil ${(focusUi.remainingMs / 1000).toFixed(1)} s`
      : focusUi.phase === "settling"
        ? `Settler inn… ${(focusUi.remainingMs / 1000).toFixed(1)} s`
        : focusUi.phase === "fatigued"
          ? "Ustabil — slipp før 7 s / start på nytt"
          : "Ingen fokus (hold F / knapp)";

  function handleFocusPointerDown(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    fHeldRef.current = true;
    beginFocus(performance.now());
  }

  function handleFocusPointerUp(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    fHeldRef.current = false;
    endFocus("Fokus sluppet — avtrekk avbrutt.");
  }

  function handleTriggerPointerDown(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    beginTrigger(performance.now());
  }

  function handleTriggerPointerUp(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    releaseTrigger(performance.now());
  }

  return (
    <div className="shooting-range">
      <LocationNav
        onBackToTown={onLeave}
        hint={
          lane === "load-test"
            ? "Load test @ 100 m CBA · velg ladning · F / Space-avtrekk · mål serie"
            : lane === "tracking-test"
              ? "Tracking test @ 100 m · F fokus · Lock · turret flytter crosshairs (U↓ L→)"
              : "Velg avstand + ammo · dra i glasset for å sikte · dra zoom-ringen · F / Space-avtrekk"
        }
      />

      {onPackFavoriteKit && onRemoveFavoriteItem ? (
        <FavoriteKitPanel
          favoriteKitIds={favoriteKitIds}
          kit={kitItems.map((i) => i.id)}
          ownedItemIds={
            new Set(inventory.filter((e) => e.qty > 0).map((e) => e.itemId))
          }
          onPackFavoriteKit={onPackFavoriteKit}
          onRemoveFavoriteItem={onRemoveFavoriteItem}
          customsMods={customsMods}
          customBarrels={customBarrels}
          hint="Etter nulling med ekstra ammo/gear: pakk favoritt-jaktkittet før du drar."
        />
      ) : null}

      {laneTabs}

      {lane === "load-test" && loadBenchRecipe ? (
        <RangeLoadTestBoard
          caliberKey={loadBenchRecipe.caliberKey}
          homeLoadedLots={homeLoadedLots}
          armedLoadPlan={armedLoadPlan}
          hasChronograph={hasChronograph}
          live={loadTestLive}
          onArmLot={armLoadTestLot}
          onDisarm={() => {
            const lotId = armedLoadPlan?.homeLotId;
            if (lotId && shots.length > 0 && !measurement) {
              persistLoadTestSeriesToLot(lotId, shots);
            }
            onDisarmLoadPlan?.();
          }}
        />
      ) : null}

      <header className="shop-header">
        <p className="intro-line intro-gift">
          {lane === "load-test"
            ? "Shooting Range — Load test"
            : lane === "tracking-test"
              ? "Shooting Range — Tracking test"
              : "Shooting Range — Zeroing"}
        </p>
        <p className="shop-row-note">
          {rifle.brand} {rifle.name}
          {" · "}
          {scope.brand} {scope.name}
          {" · "}
          kit-calm {calmFactor.toFixed(2)}
          {bipod ? " · bipod" : " · uten bipod"}
          {suppressor ? " · can" : ""}
        </p>
        {lane === "load-test" ? (
          <p className="shop-row-note">100 m · CBA-skive (fast) · 1 mil = 100 mm</p>
        ) : lane === "tracking-test" ? (
          <p className="shop-row-note">
            100 m · 1 cm-rute = 1 klikk · retikkel i ekte mrad · 1 mil = 10 cm
          </p>
        ) : (
          <>
            <p className="shop-row-note">
              Hold-over aktiv · retikkel og skive deler samme vinkel
              {paperUnit === "MOA"
                ? ` · 1 MOA ≈ ${(MM_PER_MOA_AT_100M * (distanceM / 100)).toFixed(0)} mm`
                : ` · 1 mil = ${distanceM} mm`}
              {" · "}
              diamant 10 mm = 1 klikk
              {fovDiameterScale > 1 ? " · premium FOV" : ""}
            </p>
            {ballisticHint ? (
              <p className="shop-row-note range-ballistic-hint">{ballisticHint}</p>
            ) : null}
            {cbRealDropRows ? (
              <div className="range-cb-real-drops" aria-label="CB Real loads dropp">
                <p className="range-setup-label">CB Real loads — dropp</p>
                <div className="range-cb-real-drops-grid">
                  {cbRealDropRows.map((row) => (
                    <div
                      key={row.distanceM}
                      className={
                        row.distanceM === distanceM
                          ? "range-cb-real-drop is-active"
                          : "range-cb-real-drop"
                      }
                    >
                      <span>{row.distanceM} m</span>
                      <strong>
                        {row.distanceM <= DEFAULT_ZERO_DISTANCE_M
                          ? "0"
                          : Math.round(row.clicks)}{" "}
                        klikk
                      </strong>
                      <span className="shop-row-note">
                        {(row.dropMm / 10).toFixed(0)} cm
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </header>

      {lane !== "load-test" && lane !== "tracking-test" ? (
      <section className="range-setup" aria-label="Serieoppsett">
        <ExpandableSection
          title="Baneoppsett"
          summary={`${distanceM} m · ${paperUnit === "MOA" ? "MOA" : "MIL"} · ${target.shortLabel}${easy10x ? " · 10×" : ""}`}
        >
          <div className="range-setup-block">
            <p className="range-setup-label" id="range-distance-label">
              Avstand
            </p>
            <div
              className="range-segment"
              role="group"
              aria-labelledby="range-distance-label"
            >
              {RANGE_DISTANCES_M.map((d) => (
                <button
                  key={d}
                  type="button"
                  className={
                    distanceM === d
                      ? "range-seg-btn is-active"
                      : "range-seg-btn"
                  }
                  disabled={setupLocked}
                  aria-pressed={distanceM === d}
                  onClick={() => changeDistance(d)}
                >
                  <span className="range-seg-value">{d}</span>
                  <span className="range-seg-unit">m</span>
                </button>
              ))}
            </div>
          </div>

          <div className="range-setup-block">
            <p className="range-setup-label" id="range-paper-label">
              Rutenett
              {paperUnit === reticleUnit ? (
                <span className="range-setup-lock"> · matcher retikkel</span>
              ) : (
                <span className="range-setup-lock"> · avvik fra retikkel</span>
              )}
            </p>
            <div
              className="range-segment"
              role="group"
              aria-labelledby="range-paper-label"
            >
              <button
                type="button"
                className={
                  paperUnit === "MRAD"
                    ? "range-seg-btn is-active"
                    : "range-seg-btn"
                }
                disabled={setupLocked}
                aria-pressed={paperUnit === "MRAD"}
                title="1 cm ≈ 0,1 mil"
                onClick={() => changePaperUnit("MRAD")}
              >
                <span className="range-seg-value">MIL</span>
                <span className="range-seg-unit">1 cm</span>
              </button>
              <button
                type="button"
                className={
                  paperUnit === "MOA"
                    ? "range-seg-btn is-active"
                    : "range-seg-btn"
                }
                disabled={setupLocked}
                aria-pressed={paperUnit === "MOA"}
                title={`1 cm ≈ 0,25 MOA (×${MOA_RANGE_TARGET_SCALE})`}
                onClick={() => changePaperUnit("MOA")}
              >
                <span className="range-seg-value">MOA</span>
                <span className="range-seg-unit">¼</span>
              </button>
            </div>
            {paperUnit === "MOA" ? (
              <p className="shop-row-note range-moa-paper-hint">
                MOA-skive: skalert ×{MOA_RANGE_TARGET_SCALE} slik at 1 cm-ruten ≈
                7,27 mm ≈ 0,25 MOA (ett klikk). Retikkel er {reticleUnit}
                {paperUnit !== reticleUnit ? " — skive avviker fra default" : ""}.
              </p>
            ) : paperUnit !== reticleUnit ? (
              <p className="shop-row-note range-moa-paper-hint">
                MIL-skive valgt mens retikkelet er MOA — 1 cm ≈ 0,1 mil.
              </p>
            ) : null}
          </div>

          <div className="range-setup-block">
            <p className="range-setup-label" id="range-easy10x-label">
              Innskyting
            </p>
            <div
              className="range-segment"
              role="group"
              aria-labelledby="range-easy10x-label"
            >
              <button
                type="button"
                className={
                  easy10x ? "range-seg-btn is-active" : "range-seg-btn"
                }
                disabled={setupLocked}
                aria-pressed={easy10x}
                title="10× større blink (turret forblir 1 klikk per knepp)"
                onClick={() => {
                  setEasy10x((v) => {
                    const next = !v;
                    setStatus(
                      next
                        ? "10× på — blink ×10, turret 1 klikk per knepp."
                        : "10× av — ekte vinkel og 1 klikk per knepp.",
                    );
                    return next;
                  });
                }}
              >
                <span className="range-seg-value">10×</span>
                <span className="range-seg-unit">
                  {easy10x ? "på" : "av"}
                </span>
              </button>
            </div>
            {easy10x ? (
              <p className="shop-row-note range-moa-paper-hint">
                Blink ×{RANGE_EASY_ZERO_SCALE} (lesbar). Turret = 1 klikk per
                knepp.
              </p>
            ) : null}
          </div>

          <div className="range-setup-block">
            <p className="range-setup-label" id="range-target-label">
              Skive
              {targetId !== DEFAULT_TARGET_BY_DISTANCE[distanceM] ? (
                <span className="range-setup-lock"> · avvik fra default</span>
              ) : null}
            </p>
            <div
              className="range-segment"
              role="group"
              aria-labelledby="range-target-label"
            >
              {RANGE_TARGET_IDS.filter((id) => id !== "tracking-test").map(
                (id) => {
                const t = getRangeTarget(id);
                const isDefault = id === DEFAULT_TARGET_BY_DISTANCE[distanceM];
                return (
                  <button
                    key={id}
                    type="button"
                    className={
                      targetId === id
                        ? "range-seg-btn is-active"
                        : "range-seg-btn"
                    }
                    disabled={setupLocked}
                    aria-pressed={targetId === id}
                    title={
                      isDefault
                        ? `Default for ${distanceM} m`
                        : t.label
                    }
                    onClick={() => changeTarget(id)}
                  >
                    <span className="range-seg-value">{t.shortLabel}</span>
                    <span className="range-seg-unit">
                      {isDefault ? "def" : "m"}
                    </span>
                  </button>
                );
              },
              )}
            </div>
          </div>
        </ExpandableSection>

        <div className="range-setup-block">
          <div className="range-setup-label-row">
            <p className="range-setup-label" id="range-ammo-label">
              Ammunisjon
            </p>
            <span
              className={
                ammoRemaining <= 0
                  ? "range-shot-count is-empty"
                  : "range-shot-count"
              }
            >
              {ammoRemaining} i eske
            </span>
          </div>
          <ul
            className="range-ammo-list"
            role="listbox"
            aria-labelledby="range-ammo-label"
          >
            {ammoOptions.map((a) => {
              const rounds = getInventoryQty(inventory, a.id);
              const selected = a.id === ammoId;
              const empty = rounds <= 0;
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    className={
                      selected
                        ? "range-ammo-option is-selected"
                        : empty
                          ? "range-ammo-option is-empty"
                          : "range-ammo-option"
                    }
                    disabled={setupLocked || (empty && !selected)}
                    onClick={() => changeAmmo(a.id)}
                  >
                    <span className="range-ammo-main">
                      <span className="range-ammo-name">
                        {displayAmmoBrandName({
                          ammoId: a.id,
                          brand: a.brand,
                          name: a.name,
                        })}
                      </span>
                      <span className="range-ammo-meta">
                        {a.ammo.caliber}
                        {" · "}
                        {a.ammo.projectileType}
                        {" · "}
                        v0{" "}
                        {displayV0MpsForAmmo({
                          ammoId: a.id,
                          catalogV0: a.ammo.v0,
                          rifleId: rifle?.id,
                          realLoadProfiles,
                        })}
                      </span>
                    </span>
                    <span
                      className={
                        empty
                          ? "range-ammo-qty is-empty"
                          : "range-ammo-qty"
                      }
                    >
                      {rounds}
                      <span className="range-ammo-qty-label">stk</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {setupLocked ? (
            <p className="range-setup-lock">
              Serie i gang — trykk «Ny serie» for å bytte avstand eller ammo.
            </p>
          ) : null}
        </div>
      </section>
      ) : null}

      <div className="range-status-strip">
        <span className="range-shot-count">
          Serie {shots.length} skudd
        </span>
        <span className="shop-row-note">
          Zero {effectiveZero.xMm.toFixed(0)} mm side /{" "}
          {effectiveZero.yMm.toFixed(0)} mm høyde
        </span>
        {ownsRangeFan && fanOn ? (
          <span className="shop-row-note">Vifte på · −70 % mirage</span>
        ) : mirageMidpoint > 0.01 || mirageStrength > 0.02 ? (
          <span
            className={
              barrelHeat01 >= 0.9
                ? "shop-row-note range-mirage-warn"
                : "shop-row-note"
            }
          >
            Mirage · {Math.round(mirageStrength * 100)}%
            {mirageMidpoint > 0.005
              ? ` (mid ~${Math.round(mirageMidpoint * 100)}%)`
              : ""}
            {suppressor ? " · med can" : " · uten can (×0,6)"}
            {gearMirageMult < 0.999
              ? ` · gear ×${gearMirageMult.toFixed(2)}`
              : ""}
            {!ownsRangeFan ? " · kjøp bordvifte" : ""}
          </span>
        ) : (
          <span className="shop-row-note">
            Pipe {barrelHeatProfile.classLabel} ·{" "}
            {barrelHeatProfile.heatPerShotPct}%/skudd
            {hasChamberCooler ? " · RifleKuhl ×2 kjøling" : ""}
            {suppressor ? "" : " · uten can"}
          </span>
        )}
        <span className="shop-row-note">
          Zoom {zoom.toFixed(1)}× ({scope.scope.minZoom}–{scope.scope.maxZoom}×)
          — dra i glasset for å sikte · dra ringen (kl. 8→12→4)
        </span>
      </div>

      <div className="hunt-shoot-dope-row">
        <ScopeTurrets
          sessionZeroXMm={sessionZeroXMm}
          sessionZeroYMm={sessionZeroYMm}
          onNudge={nudgeZero}
          clickUnit={scope.scope.clickUnit}
          hideShooterDials={tubeMode}
          enviroPanel={
            <HuntShotConditions
              rangeM={distanceM}
              rangeSource="range"
              shotBearingDeg={rangeShotBearingDeg}
              windFromDeg={weather.live.windFromDeg}
              windSpeedMs={weather.live.windSpeedMs}
              temperatureC={weather.live.temperatureC}
              forecastTemperatureC={weather.forecast.temperatureC}
              hasKestrel={hasKestrel}
              dopeCard={dopeCard}
              ammoId={ammoId}
              rifleId={rifle?.id ?? null}
              ammo={kestrelAmmoSolve?.ammo ?? selectedAmmo?.ammo ?? null}
              ammoLabel={
                selectedAmmo
                  ? `${selectedAmmo.brand} ${selectedAmmo.name}`
                  : "Ammo"
              }
              clickUnit={scope.scope.clickUnit}
              lrfId={lrfItem?.id ?? null}
              lrfBrand={lrfItem?.brand ?? null}
              lrfLabel={
                lrfItem ? `${lrfItem.brand} ${lrfItem.name}` : null
              }
              lrfElevClicks={
                lrfItem?.lrf.hasOnboardBallistics &&
                selectedAmmo &&
                kestrelAmmoSolve
                  ? Math.abs(
                      mmAt100ToScopeClicks(
                        exactBallisticHold(
                          kestrelAmmoSolve.ammo,
                          distanceM,
                          crosswindMs(
                            weather.live.windSpeedMs,
                            weather.live.windFromDeg,
                            rangeShotBearingDeg,
                          ),
                          {
                            densityRatio,
                            powderTempC: weather.live.temperatureC,
                            dvDtMpsPerC: kestrelAmmoSolve.dvDtMpsPerC,
                            cantDeg: liveCantDeg(),
                          },
                        ).dialYMmAt100,
                        scope.scope.clickUnit,
                      ),
                    )
                  : null
              }
            />
          }
          chronoPanel={
            chronographKind ? (
              <RangeChronoPanel
                kind={chronographKind}
                velocitiesMps={seriesChronoVelocities}
                temperatureC={weather.live.temperatureC}
                ammoLabel={
                  selectedAmmo
                    ? `${selectedAmmo.brand} ${selectedAmmo.name}`
                    : "Ammo"
                }
                ammoId={selectedAmmo?.id ?? null}
                bc={selectedAmmo?.ammo.bc}
                bcModel={selectedAmmo?.ammo.bcModel}
                existingProfile={
                  selectedAmmo
                    ? (kestrelProfiles[selectedAmmo.id] ?? null)
                    : null
                }
                hasKestrel={hasKestrel}
                onUpdateKestrel={() => {
                  if (
                    !onUpsertKestrelProfile ||
                    !selectedAmmo ||
                    !chronographKind
                  ) {
                    return;
                  }
                  const stats = computeChronoSeriesStats(
                    seriesChronoVelocities,
                  );
                  if (!stats) return;
                  const existing = kestrelProfiles[selectedAmmo.id] ?? null;
                  onUpsertKestrelProfile(
                    profileFromChronoSeries({
                      ammoId: selectedAmmo.id,
                      meanMps: stats.meanMps,
                      measuredTempC: weather.live.temperatureC,
                      caliber: selectedAmmo.ammo.caliber,
                      bc:
                        chronographKind === "true_ballistic"
                          ? selectedAmmo.ammo.bc
                          : existing?.bc,
                      existing,
                    }),
                  );
                  setStatus(
                    `Kestrel oppdatert: ${stats.meanMps.toFixed(1)} m/s avg → profil @ 15 °C`,
                  );
                }}
              />
            ) : undefined
          }
          actions={
            <>
              <button
                type="button"
                className="intro-button"
                disabled={
                  !comboKey ||
                  (sessionZeroXMm === 0 && sessionZeroYMm === 0) ||
                  Math.abs(sessionZeroXMm) > MAX_TURRET_OFFSET_MM ||
                  Math.abs(sessionZeroYMm) > ZEROING_AIM_LIMIT_MM_AT_100M
                }
                onClick={saveCurrentZero}
              >
                Lagre zero
              </button>
              <button
                type="button"
                className="intro-button sheriff-secondary"
                disabled={!rifle || !scope || !selectedAmmo}
                onClick={addCurrentToDope}
                title="Lagre ammo + avstand + klikk til felt-DOPE"
              >
                Add to DOPE
              </button>
              <button
                type="button"
                className="intro-button sheriff-secondary"
                onClick={() => setView("dope")}
              >
                Se/edit DOPE ({dopeCard.length})
              </button>
            </>
          }
        />
      </div>

      {measurement ? (
        <SeriesMeasureView
          shots={shots}
          measurement={measurement}
          target={target}
        />
      ) : (
        <div className="scope-stage" tabIndex={0}>
          <BarrelHeatBar
            className="range-barrel-heat"
            heat01={barrelHeat01}
          />
          <MaybeScopeTube
            enabled={tubeMode}
            scopeId={scope.id}
            elevation={
              <ScopeElevationDial
                sessionZeroMm={sessionZeroYMm}
                onNudge={(d) =>
                  setSessionZeroYMm((y) =>
                    clampElevationTurretMm(y + d, scope.scope),
                  )
                }
                clickUnit={scope.scope.clickUnit}
              />
            }
            parallax={
              <div className="scope-tube-para-stack">
                <IlluminationTurret
                  value={reticleIllum}
                  onChange={setReticleIllum}
                />
                <ParallaxTurret
                  focusM={parallaxFocusM}
                  onChange={setParallaxFocusM}
                />
              </div>
            }
            windage={
              <ScopeWindageDial
                sessionZeroMm={sessionZeroXMm}
                onNudge={(d) =>
                  setSessionZeroXMm((x) => clampTurretMm(x + d))
                }
                clickUnit={scope.scope.clickUnit}
              />
            }
            focusRail={
              tubeMode ? (
                <div className="range-side-rail range-side-rail--focus">
                  <span
                    className={
                      focusUi.phase === "focused"
                        ? "range-side-rail-label is-focused"
                        : focusUi.phase === "settling" ||
                            focusUi.phase === "fatigued"
                          ? "range-side-rail-label is-fatigued"
                          : "range-side-rail-label"
                    }
                  >
                    {focusLabel}
                  </span>
                  <div
                    ref={focusBarRef}
                    className="range-focus-bar"
                    aria-hidden
                  >
                    <div ref={focusFillRef} className="range-focus-fill" />
                  </div>
                  {lane === "tracking-test" ? (
                    <button
                      type="button"
                      className={
                        trackingLocked
                          ? "intro-button range-tracking-lock is-active"
                          : "intro-button sheriff-secondary range-tracking-lock"
                      }
                      aria-pressed={trackingLocked}
                      onClick={() => setTrackingLock(!trackingLocked)}
                    >
                      {trackingLocked ? "Unlock" : "Lock"}
                    </button>
                  ) : null}
                </div>
              ) : null
            }
            triggerRail={
              tubeMode ? (
                <div className="range-side-rail range-side-rail--trigger">
                  <span
                    className={
                      triggerUi.pending
                        ? "range-side-rail-label is-trigger"
                        : "range-side-rail-label"
                    }
                  >
                    {lane === "tracking-test"
                      ? "—"
                      : triggerUi.pending
                        ? "Avtrekk…"
                        : "Avtrekk"}
                  </span>
                  <div
                    className="range-trigger-bar"
                    aria-hidden
                    style={{
                      ["--trigger-mark-pct" as string]: `${triggerUi.targetPct * 100}%`,
                    }}
                  >
                    <div ref={triggerFillRef} className="range-trigger-fill" />
                    {triggerUi.targetPct > 0 ? (
                      <span className="range-trigger-mark" />
                    ) : null}
                  </div>
                </div>
              ) : null
            }
          >
            <ScopeOpticFit>
              <div className="scope-stage-optic-row">
                {!tubeMode ? (
                  <div className="range-side-rail range-side-rail--focus">
                    <span
                      className={
                        focusUi.phase === "focused"
                          ? "range-side-rail-label is-focused"
                          : focusUi.phase === "settling" ||
                              focusUi.phase === "fatigued"
                            ? "range-side-rail-label is-fatigued"
                            : "range-side-rail-label"
                      }
                    >
                      {focusLabel}
                    </span>
                    <div
                      ref={focusBarRef}
                      className="range-focus-bar"
                      aria-hidden
                    >
                      <div ref={focusFillRef} className="range-focus-fill" />
                    </div>
                    {lane === "tracking-test" ? (
                      <button
                        type="button"
                        className={
                          trackingLocked
                            ? "intro-button range-tracking-lock is-active"
                            : "intro-button sheriff-secondary range-tracking-lock"
                        }
                        aria-pressed={trackingLocked}
                        onClick={() => setTrackingLock(!trackingLocked)}
                      >
                        {trackingLocked ? "Unlock" : "Lock"}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div
                  className={
                    fovDiameterScale > 1
                      ? "scope-optic is-fov-premium"
                      : "scope-optic"
                  }
                >
              <div
                className={
                  recoilActive
                    ? aimDragging
                      ? "scope-viewport is-recoiling is-aim-dragging"
                      : "scope-viewport is-recoiling"
                    : aimDragging
                      ? "scope-viewport is-aim-dragging"
                      : "scope-viewport"
                }
                style={
                  {
                    ["--recoil-kick" as string]: recoilKick,
                  } as CSSProperties
                }
                onPointerDown={onAimPointerDown}
                onPointerMove={onAimPointerMove}
                onPointerUp={onAimPointerUp}
                onPointerCancel={onAimPointerUp}
                onPointerLeave={onAimPointerLeave}
                onLostPointerCapture={onAimPointerUp}
              >
                <div ref={scopeWorldRef} className="scope-world"
                style={blurPx > 0.05 ? { filter: `blur(${blurPx.toFixed(2)}px)` } : undefined}>
                  <div ref={mirageSceneRef} className="scope-world-scene">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="scope-target"
                      src={target.src}
                      alt={target.label}
                      draggable={false}
                      width={target.nativeWidth}
                      height={target.nativeHeight}
                      style={{ width: target.nativeWidth }}
                    />
                    {shots.map((s, i) => {
                      const hx =
                        bullseyeOff.x +
                        mmToPxOnTarget(s.xMm, target, target.nativeWidth);
                      const hy =
                        bullseyeOff.y +
                        mmToPxOnTarget(s.yMm, target, target.nativeWidth);
                      const d = mmToPxOnTarget(
                        s.diameterMm,
                        target,
                        target.nativeWidth,
                      );
                      return (
                        <span
                          key={`hole-${i}`}
                          className="bullet-hole"
                          style={{
                            left: `calc(50% + ${hx}px)`,
                            top: `calc(50% + ${hy}px)`,
                            width: `${d}px`,
                            height: `${d}px`,
                            marginLeft: `${-d / 2}px`,
                            marginTop: `${-d / 2}px`,
                          }}
                          title={`#${i + 1} · Ø ${s.diameterMm.toFixed(1)} mm`}
                        />
                      );
                    })}
                    <div className="scope-mirage-shimmer" aria-hidden />
                  </div>
                </div>
                {/* SVG filter: warps only the world scene (blink), not the reticle. */}
                <svg
                  className="scope-mirage-defs"
                  width="0"
                  height="0"
                  aria-hidden
                >
                  <defs>
                    <filter
                      id="range-mirage-distort"
                      x="-8%"
                      y="-8%"
                      width="116%"
                      height="116%"
                      colorInterpolationFilters="sRGB"
                    >
                      <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.014 0.045"
                        numOctaves="2"
                        seed="3"
                        result="noise"
                      >
                        <animate
                          attributeName="baseFrequency"
                          dur="2.8s"
                          values="0.014 0.045;0.02 0.055;0.012 0.038;0.014 0.045"
                          repeatCount="indefinite"
                        />
                      </feTurbulence>
                      <feDisplacementMap
                        ref={mirageDisplaceRef}
                        in="SourceGraphic"
                        in2="noise"
                        scale={0}
                        xChannelSelector="R"
                        yChannelSelector="G"
                      />
                    </filter>
                  </defs>
                </svg>
                <div
                  ref={scopeReticleOffsetRef}
                  className="scope-reticle-offset"
                >
                  <ScopeReticle
                    scope={scope.scope}
                    zoom={zoom}
                    imgScale={reticleImgScale}
                    illumination={tubeMode ? reticleIllum : 0}
                  />
                </div>
                <div className="scope-vignette" aria-hidden />
              </div>
              <ScopeZoomRing
                scope={scope.scope}
                zoom={zoom}
                onChange={(z) => setZoom(z)}
              />
              {cantActive && bubbleLevel ? (
                <BubbleLevel
                  visualId={bubbleLevel.visualId}
                  cantDeg={cantDeg}
                  onCantChange={setCantDeg}
                  disabled={!!measurement}
                />
              ) : null}
            </div>

            {lane !== "tracking-test" ? (
              <div className="range-scope-10x-slot">
                <button
                  type="button"
                  className={
                    easy10x
                      ? "range-easy10x-chip range-easy10x-by-scope is-active"
                      : "range-easy10x-chip range-easy10x-by-scope"
                  }
                  aria-pressed={easy10x}
                  title="10× større blink (turret forblir 1 klikk per knepp)"
                  onClick={() => {
                    setEasy10x((v) => {
                      const next = !v;
                      setStatus(
                        next
                          ? "10× på — blink ×10, turret 1 klikk per knepp."
                          : "10× av — ekte vinkel og 1 klikk per knepp.",
                      );
                      return next;
                    });
                  }}
                >
                  10×
                </button>
              </div>
            ) : null}

                {!tubeMode ? (
                  <div className="range-side-rail range-side-rail--trigger">
                    <span
                      className={
                        triggerUi.pending
                          ? "range-side-rail-label is-trigger"
                          : "range-side-rail-label"
                      }
                    >
                      {lane === "tracking-test"
                        ? "—"
                        : triggerUi.pending
                          ? "Avtrekk…"
                          : "Avtrekk"}
                    </span>
                    <div
                      className="range-trigger-bar"
                      aria-hidden
                      style={{
                        ["--trigger-mark-pct" as string]: `${triggerUi.targetPct * 100}%`,
                      }}
                    >
                      <div ref={triggerFillRef} className="range-trigger-fill" />
                      {triggerUi.targetPct > 0 ? (
                        <span className="range-trigger-mark" />
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </ScopeOpticFit>
          </MaybeScopeTube>

          <div className="range-touch-controls" aria-label="Mobilkontroller">
            <button
              type="button"
              className={
                focusUi.phase === "focused"
                  ? "range-touch-btn range-touch-btn--focus is-active"
                  : focusUi.phase === "settling" ||
                      focusUi.phase === "fatigued"
                    ? "range-touch-btn range-touch-btn--focus is-fatigued"
                    : "range-touch-btn range-touch-btn--focus"
              }
              aria-pressed={focusUi.phase !== "idle"}
              onPointerDown={handleFocusPointerDown}
              onPointerUp={handleFocusPointerUp}
              onPointerCancel={handleFocusPointerUp}
              onContextMenu={(e) => e.preventDefault()}
            >
              Fokus
            </button>
            {lane === "tracking-test" ? (
              <button
                type="button"
                className={
                  trackingLocked
                    ? "range-touch-btn range-touch-btn--focus is-active"
                    : "range-touch-btn range-touch-btn--focus"
                }
                aria-pressed={trackingLocked}
                onClick={() => setTrackingLock(!trackingLocked)}
                onContextMenu={(e) => e.preventDefault()}
              >
                {trackingLocked ? "Unlock" : "Lock"}
              </button>
            ) : (
              <button
                type="button"
                className={
                  triggerUi.pending
                    ? "range-touch-btn range-touch-btn--trigger is-active"
                    : "range-touch-btn range-touch-btn--trigger"
                }
                aria-pressed={triggerUi.pending}
                onPointerDown={handleTriggerPointerDown}
                onPointerUp={handleTriggerPointerUp}
                onPointerCancel={handleTriggerPointerUp}
                onContextMenu={(e) => e.preventDefault()}
              >
                Avtrekk
              </button>
            )}
          </div>
        </div>
      )}

      {status ? <p className="shop-row-note">{status}</p> : null}

      {lane !== "tracking-test" ? (
      <div className="range-actions">
        <button
          type="button"
          className="intro-button"
          disabled={shots.length < 1 || !!measurement}
          onClick={measureSeries}
        >
          Mål serie
        </button>
        <button type="button" className="intro-button" onClick={newSeries}>
          Ny serie
        </button>
        <button
          type="button"
          className={
            fanOn && ownsRangeFan
              ? "intro-button range-fan-btn is-on"
              : "intro-button sheriff-secondary range-fan-btn"
          }
          disabled={!ownsRangeFan}
          title={
            ownsRangeFan
              ? fanOn
                ? "Skru av bordvifte"
                : "Skru på bordvifte (−70 % mirage)"
              : "Kjøp bordvifte batteridrevet på XXL (299 kr)"
          }
          onClick={() => setFanOn((v) => !v)}
        >
          {ownsRangeFan
            ? fanOn
              ? "Vifte: på"
              : "Skru på vifte"
            : "Skru på vifte"}
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
          onClick={onLeave}
        >
          Ferdig
        </button>
      </div>
      ) : (
        <div className="range-actions">
          <button
            type="button"
            className="intro-button"
            onClick={() => {
              setSessionZeroXMm(0);
              setSessionZeroYMm(0);
              setStatus("Turret nullstilt til 0 / 0.");
            }}
          >
            Nullstill turret
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={onLeave}
          >
            Ferdig
          </button>
        </div>
      )}
    </div>
  );
}
