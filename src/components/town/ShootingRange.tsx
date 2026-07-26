"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { LocationNav } from "@/components/town/LocationNav";
import { ExpandableSection } from "@/components/ui/ExpandableSection";
import {
  isAmmoItem,
  isBallisticsItem,
  isBipodItem,
  isLrfItem,
  isMiscItem,
  isRifleItem,
  isScopeItem,
  isStockItem,
  type ShopItem,
} from "@/lib/shop/types";
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
  SHOTS_PER_SERIES,
  TRIGGER_BAR_MS,
  caliberBulletDiameterMm,
  clampScopeZoom,
  combinedDispersionMoa,
  computeWeaponCalmFactor,
  effectiveCalmWithFocus,
  ensureAmmoAffinity,
  focusPhase,
  focusRemainingMs,
  measureGroup,
  RANGE_DISTANCE_M,
  RANGE_DISTANCES_M,
  rollTriggerTargetMs,
  sampleShotFromPoa,
  scopeImageScale,
  triggerPullErrorFactor,
  triggerPullOffsetMm,
  wobbleAmplitudeMm,
  type GroupMeasurement,
  type RangeDistanceM,
  type ShotImpact,
} from "@/lib/range/precision";
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
import type { ScopeClickUnit } from "@/lib/optics/spec";
import {
  DEFAULT_ZERO_DISTANCE_M,
  dropBelowLosMm,
} from "@/lib/ballistics/trajectory";
import { SeriesMeasureView } from "@/components/town/SeriesMeasureView";
import { ShotLogView } from "@/components/town/ShotLogView";
import { DopeCardView } from "@/components/town/DopeCardView";
import { MoaCompetitionView } from "@/components/town/MoaCompetitionView";
import { FieldImpactCompetitionView } from "@/components/town/FieldImpactCompetitionView";
import { ScopeReticle } from "@/components/range/ScopeReticle";
import { ScopeTurrets } from "@/components/range/ScopeTurrets";
import { RangeChronoPanel } from "@/components/range/RangeChronoPanel";
import { ScopeZoomRing } from "@/components/range/ScopeZoomRing";
import { useTriggerBarPaint } from "@/components/range/useTriggerBarPaint";
import { useFocusBarPaint } from "@/components/range/useFocusBarPaint";
import { HuntShotConditions } from "@/components/hunt/HuntShotConditions";
import { useRangeAudio } from "@/components/range/useRangeAudio";
import {
  angularMmAtDistance,
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
import { applyScopeClickError } from "@/lib/optics/spec";
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
import { isSilentSuppressedShot } from "@/lib/ammo/spec";
import type { RangeShotAudioOptions } from "@/lib/range/audio";
import { crosswindMs, type DayWeather } from "@/lib/weather/spec";
import { barrelWearMoaScale } from "@/lib/rifle/barrelWear";
import {
  rifleSpecWithCustomBarrel,
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
  /** Laderommet — load-test lane. */
  loadBenchRecipe?: LoadBenchRecipe | null;
  homeLoadedLots?: HomeLoadedLot[];
  armedLoadPlan?: ArmedLoadPlan | null;
  onArmHomeLot?: (lotId: string) => void;
  onDisarmLoadPlan?: () => void;
  musicEnabled: boolean;
  onLeave: () => void;
};

type AimKeys = {
  up: number | null;
  down: number | null;
  left: number | null;
  right: number | null;
};

const AIM_SPEED_MM_PER_SEC = 22;
/** While holding F: slower arrows for fine reticle placement. */
const FOCUS_AIM_SPEED_MULT = 0.28;
const DEFAULT_SCOPE_ZOOM = 12;

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
  loadBenchRecipe = null,
  homeLoadedLots = [],
  armedLoadPlan = null,
  onArmHomeLot,
  onDisarmLoadPlan,
  musicEnabled,
  onLeave,
}: ShootingRangeProps) {
  const [view, setView] = useState<"range" | "shotlog" | "dope">("range");
  const [lane, setLane] = useState<"zeroing" | "competitions" | "load-test">(
    "zeroing",
  );
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
        ? barrelWearMoaScale(getRifleRoundCount(rifleRoundCounts, rifle.id))
        : 1,
    [rifle, rifleRoundCounts],
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
    () => kitItems.find((i) => i.category === "suppressor") ?? null,
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
        (i) => isBallisticsItem(i) && i.ballistics.measuresCrosswind,
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
  const target = getRangeTarget(targetId);
  const [zoom, setZoom] = useState(DEFAULT_SCOPE_ZOOM);
  const [sessionZeroXMm, setSessionZeroXMm] = useState(0);
  const [sessionZeroYMm, setSessionZeroYMm] = useState(0);
  const [aimMm, setAimMm] = useState({ x: 0, y: 0 });
  const [shots, setShots] = useState<ShotImpact[]>([]);
  const [measurement, setMeasurement] = useState<GroupMeasurement | null>(
    null,
  );
  const [status, setStatus] = useState(
    "Hold F (fokus) → merke på avtrekksbar. Hold Space, slipp på merket.",
  );
  const [focusUi, setFocusUi] = useState<{
    phase: "idle" | "focused" | "fatigued";
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
    setFocusBarFatigued,
    resetFocusProgress,
  } = useFocusBarPaint();
  const scopeWorldRef = useRef<HTMLDivElement>(null);
  const mirageSceneRef = useRef<HTMLDivElement>(null);
  const mirageDisplaceRef = useRef<SVGFEDisplacementMapElement>(null);
  const targetScaleRef = useRef(1);
  const bullseyeOffRef = useRef({ x: 0, y: 0 });
  const imgNaturalWRef = useRef(target.nativeWidth);
  const targetPxPerMmRef = useRef(target.pxPerMm);
  const [recoilActive, setRecoilActive] = useState(false);
  const recoilClearRef = useRef<number | null>(null);

  const keysRef = useRef<AimKeys>({
    up: null,
    down: null,
    left: null,
    right: null,
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
  const fireShotRef = useRef(() => {});
  const playShotRef = useRef<
    (opts: boolean | RangeShotAudioOptions) => void
  >(() => {});
  const consumeAmmoRef = useRef(onConsumeAmmo);

  const { playShot } = useRangeAudio({ enabled: musicEnabled });

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
    ? kestrelSolveAmmo(selectedAmmo.ammo, selectedAmmo.id, kestrelProfiles)
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
    if (
      shotsLenRef.current >= SHOTS_PER_SERIES ||
      measurementRef.current
    ) {
      if (measurementRef.current) {
        setStatus("Målt ferdig — start ny serie for flere skudd.");
      } else {
        setStatus("Serien er full (5). Mål serie eller start ny.");
      }
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
      if (prev.length >= SHOTS_PER_SERIES) {
        return prev;
      }
      if (measurementRef.current) {
        return prev;
      }

      const { affinity, map, rolled } = ensureAmmoAffinity(
        ammoAffinities,
        rifle.id,
        selectedAmmo.id,
      );
      if (rolled) onAffinitiesChange(map);

      const w = wobbleRef.current;
      const dispersionInput = {
        rifle: rifleSpecWithCustomBarrel(
          rifle.rifle,
          customBarrels[rifle.id],
        ),
        ammo: selectedAmmo.ammo,
        stock: stock?.stock,
        affinity,
        customsMoaDelta,
        barrelWearScale,
        mirageFactor: mirageStrengthRef.current,
      };
      const envelopeMoa = combinedDispersionMoa(dispersionInput);
      const pull = triggerPullOffsetMm(
        triggerPullRef.current * customsTriggerPullScale,
        envelopeMoa,
        distanceRef.current,
      );
      const poa = {
        xMm: aimRef.current.x + w.x + pull.xMm,
        yMm: aimRef.current.y + w.y + pull.yMm,
      };
      const shot = sampleShotFromPoa(
        poa,
        dispersionInput,
        distanceRef.current,
        Math.random,
        {
          densityRatio,
          powderTempC: weather.live.temperatureC,
        },
      );
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
      const impact: ShotImpact = {
        xMm: shot.xMm + realizedZero.xMm,
        yMm: shot.yMm + realizedZero.yMm,
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
        `Skudd ${prev.length + 1}/${SHOTS_PER_SERIES} · ${pullNote}${chronoNote} · ${selectedAmmo.brand} ${selectedAmmo.name}`,
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
    paintFocusProgress(1);
    setFocusBarFatigued(false);
    setTriggerUi({
      pending: false,
      targetPct: markMs / TRIGGER_BAR_MS,
    });
    setStatus("Fokus — hold pusten. Slipp Space på merket i avtrekksbaren.");
  }

  function endFocus(abortReason: string) {
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
    const distFactor = distanceRef.current / RANGE_DISTANCE_M;
    const aimLimit = 80 * distFactor;
    const delta = aimMmDeltaFromPointerDrag({
      dxClientPx: e.clientX - drag.startX,
      dyClientPx: e.clientY - drag.startY,
      scale: targetScaleRef.current,
      pxPerMm: targetPxPerMmRef.current,
      sensitivity: focusRef.current.held ? FOCUS_AIM_SPEED_MULT : 1,
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
    if (shotsLenRef.current >= SHOTS_PER_SERIES || measurementRef.current) {
      setStatus(
        measurementRef.current
          ? "Målt ferdig — start ny serie."
          : "Serien er full (5).",
      );
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
      const distFactor = distanceRef.current / RANGE_DISTANCE_M;
      const aimLimit = 80 * distFactor;
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
        if (keysRef.current[dir] != null) return;
        keysRef.current[dir] = performance.now();
        const step = SCOPE_AIM_TAP_MM * (distanceRef.current / RANGE_DISTANCE_M);
        if (dir === "up") nudgeAim(0, -step);
        if (dir === "down") nudgeAim(0, step);
        if (dir === "left") nudgeAim(-step, 0);
        if (dir === "right") nudgeAim(step, 0);
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
        beginFocus(performance.now());
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        beginTrigger(performance.now());
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "ArrowUp") keysRef.current.up = null;
      if (e.key === "ArrowDown") keysRef.current.down = null;
      if (e.key === "ArrowLeft") keysRef.current.left = null;
      if (e.key === "ArrowRight") keysRef.current.right = null;
      if (e.key === "f" || e.key === "F") {
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
      const ax = aimRef.current.x + wobbleRef.current.x;
      const ay = aimRef.current.y + wobbleRef.current.y;
      const scale = targetScaleRef.current;
      const off = bullseyeOffRef.current;
      const pxPerMm = targetPxPerMmRef.current;
      const panPxX = (off.x + ax * pxPerMm) * scale;
      const panPxY = (off.y + ay * pxPerMm) * scale;
      el.style.transform = `translate(calc(-50% - ${panPxX}px), calc(-50% - ${panPxY}px)) scale(${scale})`;
    }

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = keysRef.current;
      let { x, y } = aimRef.current;
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
      const aimLimit = 80 * distFactor;
      x = Math.max(-aimLimit, Math.min(aimLimit, x));
      y = Math.max(-aimLimit, Math.min(aimLimit, y));
      aimRef.current = { x, y };

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

      const fPhase = focusPhase(focusRef.current, now);
      if (fPhase === "focused") {
        paintFocusProgress(
          focusRemainingMs(focusRef.current, now) / FOCUS_HOLD_MS,
        );
        setFocusBarFatigued(false);
      } else if (fPhase === "fatigued") {
        paintFocusProgress(1);
        setFocusBarFatigued(true);
      } else {
        paintFocusProgress(0);
        setFocusBarFatigued(false);
      }

      uiAccum += dt;
      if (uiAccum > 0.05) {
        uiAccum = 0;
        setFocusUi({
          phase: fPhase,
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

  const zoomScale = scope
    ? scopeImageScale(zoom, scope.scope, RANGE_DISTANCE_M)
    : 1;
  /** Target shrinks with distance (angular size). Reticle uses zoom-only
   * scale so mil/MOA hashes stay true angular. Per-skive visualScale fixes
   * board size. MOA paper ({@link MOA_RANGE_TARGET_SCALE}) makes 1 cm ≈ ¼ MOA. */
  const moaPaperScale = paperUnit === "MOA" ? MOA_RANGE_TARGET_SCALE : 1;
  const targetScale = scope
    ? scopeImageScale(zoom, scope.scope, distanceM) *
      target.visualScale *
      moaPaperScale
    : target.visualScale;
  const bullseyeOff = targetBullseyeOffsetFromImageCenterPx(target);
  targetScaleRef.current = targetScale;
  bullseyeOffRef.current = bullseyeOff;
  imgNaturalWRef.current = target.nativeWidth;
  targetPxPerMmRef.current = target.pxPerMm;

  const ballisticHint = selectedAmmo
    ? (() => {
        const d = dropBelowLosMm(selectedAmmo.ammo, distanceM);
        const clicks = clicksForDropMm(d, distanceM);
        if (distanceM <= DEFAULT_ZERO_DISTANCE_M || Math.abs(clicks) < 0.3) {
          return `Zero ${DEFAULT_ZERO_DISTANCE_M} m · drop ≈ 0 klikk`;
        }
        const mil = Math.abs(clicks / 10).toFixed(1);
        return `Zero ${DEFAULT_ZERO_DISTANCE_M} m · drop ≈ ${Math.round(clicks)} klikk (${mil} mil / ${(d / 10).toFixed(0)} cm)`;
      })()
    : null;

  function measureSeries() {
    if (shots.length < SHOTS_PER_SERIES) {
      setStatus(`Trenger ${SHOTS_PER_SERIES} skudd før måling.`);
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
    abortTrigger("");
    setStatus("Ny serie — hold Fokus, piltaster, hold Avtrekk.");
    wobblePhase.current = { a: Math.random() * 10, b: Math.random() * 10 };
    miragePhaseRef.current = createMiragePhase();
  }

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
    if (axis === "x") {
      setSessionZeroXMm((prev) => clampTurretMm(prev + deltaMm));
      return;
    }
    setSessionZeroYMm((prev) => clampTurretMm(prev + deltaMm));
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
      shotsNeeded: SHOTS_PER_SERIES,
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
            musicEnabled={musicEnabled}
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
            musicEnabled={musicEnabled}
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
      ? `Fokus ${(focusUi.remainingMs / 1000).toFixed(1)} s`
      : focusUi.phase === "fatigued"
        ? "Pust — ustabil (slipp fokus, prøv igjen)"
        : "Ingen fokus (hold F / knapp)";

  function handleFocusPointerDown(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    beginFocus(performance.now());
  }

  function handleFocusPointerUp(e: PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
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
            : "Velg avstand + ammo · dra i glasset for å sikte · dra zoom-ringen · F / Space-avtrekk"
        }
      />

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
          <p className="shop-row-note">100 m · CBA-skive (fast)</p>
        ) : ballisticHint ? (
          <p className="shop-row-note range-ballistic-hint">{ballisticHint}</p>
        ) : null}
      </header>

      {lane !== "load-test" ? (
      <section className="range-setup" aria-label="Serieoppsett">
        <ExpandableSection
          title="Baneoppsett"
          summary={`${distanceM} m · ${paperUnit === "MOA" ? "MOA" : "MIL"} · ${target.shortLabel}`}
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
              {RANGE_TARGET_IDS.map((id) => {
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
              })}
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
                        {a.brand} {a.name}
                      </span>
                      <span className="range-ammo-meta">
                        {a.ammo.caliber}
                        {" · "}
                        {a.ammo.projectileType}
                        {" · "}
                        v0 {a.ammo.v0}
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
          Serie {shots.length}/{SHOTS_PER_SERIES}
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
          enviroPanel={
            <HuntShotConditions
              rangeM={distanceM}
              rangeSource="range"
              shotBearingDeg={rangeShotBearingDeg}
              windFromDeg={weather.live.windFromDeg}
              windSpeedMs={weather.live.windSpeedMs}
              temperatureC={weather.live.temperatureC}
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
                  Math.abs(sessionZeroYMm) > MAX_TURRET_OFFSET_MM
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
          <div className="scope-stage-optic-row">
            <div className="range-side-rail range-side-rail--focus">
              <span
                className={
                  focusUi.phase === "focused"
                    ? "range-side-rail-label is-focused"
                    : focusUi.phase === "fatigued"
                      ? "range-side-rail-label is-fatigued"
                      : "range-side-rail-label"
                }
              >
                {focusLabel}
              </span>
              <div
                ref={focusBarRef}
                className={
                  focusUi.phase === "fatigued"
                    ? "range-focus-bar is-fatigued"
                    : "range-focus-bar"
                }
                aria-hidden
              >
                <div ref={focusFillRef} className="range-focus-fill" />
              </div>
            </div>

            <div className="scope-optic">
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
                onPointerDown={onAimPointerDown}
                onPointerMove={onAimPointerMove}
                onPointerUp={onAimPointerUp}
                onPointerCancel={onAimPointerUp}
                onPointerLeave={onAimPointerLeave}
                onLostPointerCapture={onAimPointerUp}
              >
                <div ref={scopeWorldRef} className="scope-world">
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
                <ScopeReticle
                  scope={scope.scope}
                  zoom={zoom}
                  imgScale={zoomScale}
                />
                <div className="scope-vignette" aria-hidden />
              </div>
              <ScopeZoomRing
                scope={scope.scope}
                zoom={zoom}
                onChange={(z) => setZoom(z)}
              />
            </div>

            <div className="range-side-rail range-side-rail--trigger">
              <span
                className={
                  triggerUi.pending
                    ? "range-side-rail-label is-trigger"
                    : "range-side-rail-label"
                }
              >
                {triggerUi.pending ? "Avtrekk…" : "Avtrekk"}
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
          </div>

          <div className="range-touch-controls" aria-label="Mobilkontroller">
            <button
              type="button"
              className={
                focusUi.phase === "focused"
                  ? "range-touch-btn range-touch-btn--focus is-active"
                  : focusUi.phase === "fatigued"
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
          </div>
        </div>
      )}

      {status ? <p className="shop-row-note">{status}</p> : null}

      <div className="range-actions">
        <button
          type="button"
          className="intro-button"
          disabled={shots.length < SHOTS_PER_SERIES || !!measurement}
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
    </div>
  );
}
