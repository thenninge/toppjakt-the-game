"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent } from "react";
import {
  isAmmoItem,
  isBipodItem,
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
import { miscKitWeaponCalmGrams, miscKitMirageMult, isChamberCoolerMisc } from "@/lib/misc/spec";
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
  TRIGGER_PERFECT_BAND_MS,
  rollTriggerTargetMs,
  sampleShotFromPoa,
  triggerPullErrorFactor,
  triggerPullOffsetMm,
  wobbleAmplitudeMm,
} from "@/lib/range/precision";
import {
  createMiragePhase,
  mirageStrengthAtTime,
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
import { ScopeReticle } from "@/components/range/ScopeReticle";
import { ScopeFocusZoom } from "@/components/range/ScopeFocusZoom";
import { ScopeOpticFit } from "@/components/range/ScopeOpticFit";
import {
  ScopeElevationDial,
  ScopeTurrets,
  ScopeWindageDial,
  turretNudgeMoved,
} from "@/components/range/ScopeTurrets";
import { ScopeZoomRing } from "@/components/range/ScopeZoomRing";
import { MaybeScopeTube } from "@/components/range/ScopeTubeLayout";
import { useTriggerBarPaint } from "@/components/range/useTriggerBarPaint";
import { useFocusBarPaint } from "@/components/range/useFocusBarPaint";
import { useRangeAudio } from "@/components/range/useRangeAudio";
import {
  DEFAULT_REALISM_CONTROLS,
  getRealismControls,
  subscribeRealismControls,
} from "@/lib/range/realismControls";
import {
  realismDispersionMult,
  realismLevelKey,
} from "@/lib/range/realismGameplay";
import type { GameRealism } from "@/lib/optics/turretStyle";
import {
  angularMmAtDistance,
  clampElevationTurretMm,
  clampTurretMm,
  getInventoryQty,
  getRifleRoundCount,
  type DopeCardEntry,
  type InventoryEntry,
  type ZeroingProfile,
} from "@/lib/player";
import {
  applyScopeClickError,
  scopeEffectiveZoomRange,
  scopeElevationClicksPerRev,
  scopeFocusViewportBoost,
  scopeFocusZoomBoost,
  scopeFovDiameterScale,
  scopeWindageClicksPerRev,
} from "@/lib/optics/spec";
import { densityRatioFromTempC, exactBallisticHold } from "@/lib/ballistics/solver";
import { isSilentSuppressedShot } from "@/lib/ammo/spec";
import type { RangeShotAudioOptions } from "@/lib/range/audio";
import type { DayWeather } from "@/lib/weather/spec";
import { crosswindMs } from "@/lib/weather/spec";
import { barrelWearMaterialFromCustom, barrelWearMoaScale } from "@/lib/rifle/barrelWear";
import type { KestrelGunProfile } from "@/lib/ballistics/kestrelProfile";
import { kestrelSolveAmmo } from "@/lib/ballistics/kestrelProfile";
import {
  birdNativePxPerMm,
  birdScopeImageScale,
  birdShotGeom,
  birdVitalOffsetFromImageCenterPx,
  classifyHuntShot,
  formatHuntImpactOffsetMm,
  SCOPE_VIEWPORT_REF_PX,
  isShotCamItemId,
} from "@/lib/hunt/shoot";
import { opticReticleImgScale } from "@/lib/range/scopeViewScale";
import {
  aimMmDeltaFromPointerDrag,
} from "@/lib/range/scopePointerAim";
import {
  rifleSpecWithCustomBarrel,
  barrelV0FactorForRifle,
  type InstalledCustomBarrel,
} from "@/lib/customs/customBarrel";
import {
  FIELD_IMPACT_DISTANCES_M,
  FIELD_IMPACT_ENTRY_FEE_NOK,
  FIELD_IMPACT_LANDSCAPE_SRC,
  FIELD_IMPACT_PAYOUT_TIERS,
  FIELD_IMPACT_SHOT_BEARING_DEG,
  FIELD_IMPACT_STAGE_COUNT,
  buildFieldImpactHoldCard,
  fieldImpactStageFromLayout,
  finalizeFieldImpact,
  formatFieldImpactElapsed,
  rollFieldImpactRound,
  type FieldImpactHoldCard,
  type FieldImpactResult,
  type FieldImpactRoundLayout,
  type FieldImpactStageHit,
  type FieldImpactStageLayout,
} from "@/lib/range/fieldImpactComp";
import { HuntShotAarView } from "@/components/hunt/HuntShotAarView";
import { ShooterAuxTurrets } from "@/components/range/ShooterAuxTurrets";
import { ParallaxTurret } from "@/components/range/ParallaxTurret";
import { IlluminationTurret } from "@/components/range/IlluminationTurret";
import { BubbleLevel } from "@/components/range/BubbleLevel";
import { resolveBubbleLevelFromKit } from "@/lib/range/bubbleLevel";
import { focusBlurPx } from "@/lib/range/parallaxFocus";
import {
  CANT_KEY_DEG_PER_SEC,
  composeCantedImpactMm,
  initialCantDeg,
  isCantGameplayActive,
  nudgeCantDeg,
  showBubbleLevelHud,
} from "@/lib/range/cant";

type FieldImpactCompetitionViewProps = {
  balance: number;
  kitItems: ShopItem[];
  inventory: InventoryEntry[];
  ammoAffinities: Record<string, number>;
  zeroingProfiles: Record<string, ZeroingProfile>;
  dopeCard: DopeCardEntry[];
  rifleRoundCounts?: Record<string, number>;
  customBarrels?: Record<string, InstalledCustomBarrel>;
  kestrelProfiles?: Record<string, KestrelGunProfile>;
  weather: DayWeather;
  customsMoaDelta?: number;
  customsCalmMult?: number;
  customsTriggerPullScale?: number;
  onAffinitiesChange: (next: Record<string, number>) => void;
  onConsumeAmmo: (ammoId: string, rifleId?: string) => boolean;
  onEnsureZeroing: (
    rifleId: string,
    scopeId: string,
    ammoId: string,
  ) => ZeroingProfile;
  onPayEntryFee: (amountNok: number) => boolean;
  onAwardPayout: (amountNok: number) => void;
  onBack: () => void;
  /** medium = HUD dials; high = tube-mounted realistic turrets. */
  realism?: GameRealism;
};

type Keys = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  ccw: boolean;
  cw: boolean;
};

type Phase = "lobby" | "shooting" | "result" | "aar";

const LANDSCAPE_AIM_FOV_FRAC = 0.36;
const FOCUS_AIM_SPEED_MULT = 0.14;
const DEFAULT_SCOPE_ZOOM = 12;
const IMPACT_FLASH_MS = 900;
/** Losby photo aspect ≈ 1024×606. */
const DEFAULT_LAND_ASPECT = 1024 / 606;

/** Aim (mm from vital) that puts a landscape % under the reticle. */
function aimMmForLandscapeLookAt(opts: {
  nativeW: number;
  nativeH: number;
  spriteHeightMm: number;
  widthPct: number;
  landAspect: number;
  birdXPct: number;
  birdYPct: number;
  lookXPct: number;
  lookYPct: number;
  vitalOff: { x: number; y: number };
}): { x: number; y: number } {
  const sceneW = opts.nativeW * (100 / Math.max(0.05, opts.widthPct));
  const sceneH = sceneW / Math.max(0.25, opts.landAspect);
  const pxPerMm = opts.nativeH / opts.spriteHeightMm;
  const aimPxX =
    ((opts.lookXPct - opts.birdXPct) / 100) * sceneW - opts.vitalOff.x;
  const aimPxY =
    ((opts.lookYPct - opts.birdYPct) / 100) * sceneH - opts.vitalOff.y;
  return { x: aimPxX / pxPerMm, y: aimPxY / pxPerMm };
}

/** Aim that puts landscape centre under the reticle (find the bird). */
function aimMmForLandscapeCenter(opts: {
  nativeW: number;
  nativeH: number;
  spriteHeightMm: number;
  widthPct: number;
  landAspect: number;
  birdXPct: number;
  birdYPct: number;
  vitalOff: { x: number; y: number };
}): { x: number; y: number } {
  return aimMmForLandscapeLookAt({
    ...opts,
    lookXPct: 50,
    lookYPct: 50,
  });
}

/** Landscape % currently under optical centre. */
function landscapePctUnderReticle(opts: {
  aimMm: { x: number; y: number };
  seat: { x: number; y: number; widthPct: number };
  nativeW: number;
  nativeH: number;
  spriteHeightMm: number;
  landAspect: number;
  vitalOff: { x: number; y: number };
}): { xPct: number; yPct: number } {
  const sceneW = opts.nativeW * (100 / Math.max(0.05, opts.seat.widthPct));
  const sceneH = sceneW / Math.max(0.25, opts.landAspect);
  const pxPerMm = opts.nativeH / opts.spriteHeightMm;
  const aimPxX = opts.aimMm.x * pxPerMm;
  const aimPxY = opts.aimMm.y * pxPerMm;
  return {
    xPct: opts.seat.x + ((opts.vitalOff.x + aimPxX) / sceneW) * 100,
    yPct: opts.seat.y + ((opts.vitalOff.y + aimPxY) / sceneH) * 100,
  };
}

function speciesLabelNb(species: FieldImpactStageLayout["species"]): string {
  if (species === "orrhane") return "orre";
  if (species === "ugle") return "ugle";
  return "tiur";
}

export function FieldImpactCompetitionView({
  balance,
  kitItems,
  inventory,
  ammoAffinities,
  zeroingProfiles: _zeroingProfiles,
  dopeCard,
  rifleRoundCounts = {},
  customBarrels = {},
  kestrelProfiles = {},
  weather,
  customsMoaDelta = 0,
  customsCalmMult = 1,
  customsTriggerPullScale = 1,
  onAffinitiesChange,
  onConsumeAmmo,
  onEnsureZeroing,
  onPayEntryFee,
  onAwardPayout,
  onBack,
  realism = "medium",
}: FieldImpactCompetitionViewProps) {
  const realismControls = useSyncExternalStore(
    subscribeRealismControls,
    getRealismControls,
    () => DEFAULT_REALISM_CONTROLS,
  );
  const realismLevel = realismLevelKey(realism);
  const features = realismControls.features[realismLevel];
  const isRealismLow = realismLevel === "low";
  const tubeMode = features.tubeTurrets;
  const illumOn = features.illumination;
  const params = realismControls.params;
  const bubbleLevel = useMemo(
    () => resolveBubbleLevelFromKit(kitItems),
    [kitItems],
  );
  const cantActive = isCantGameplayActive(realism);
  const cantActiveRef = useRef(cantActive);
  cantActiveRef.current = cantActive;
  const bubbleHud = showBubbleLevelHud(realism, !!bubbleLevel);
  const [cantDeg, setCantDeg] = useState(() => initialCantDeg(realism));
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

  const rifle = useMemo(() => kitItems.find(isRifleItem) ?? null, [kitItems]);
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
  const scope = useMemo(() => kitItems.find(isScopeItem) ?? null, [kitItems]);
  const shotCamInKit = useMemo(
    () => kitItems.some((i) => isShotCamItemId(i.id)),
    [kitItems],
  );
  const zoomRange = useMemo(
    () =>
      scope
        ? scopeEffectiveZoomRange(scope.scope, shotCamInKit)
        : { minZoom: 1, maxZoom: 1 },
    [
      scope,
      shotCamInKit,
      scope?.scope.minZoom,
      scope?.scope.maxZoom,
      scope?.scope.triggercamZoomRestrict,
      scope?.scope.triggercamMinZoom,
      scope?.scope.triggercamMaxZoom,
    ],
  );
  const stock = useMemo(() => kitItems.find(isStockItem) ?? null, [kitItems]);
  const bipod = useMemo(() => kitItems.find(isBipodItem) ?? null, [kitItems]);
  const suppressor = useMemo(
    () => kitItems.find(isSuppressorItem) ?? null,
    [kitItems],
  );
  const mount = useMemo(() => kitItems.find(isMountItem) ?? null, [kitItems]);
  const ammoOptions = useMemo(() => kitItems.filter(isAmmoItem), [kitItems]);
  const ready = !!(rifle && scope && ammoOptions.length > 0);
  const densityRatio = densityRatioFromTempC(weather.live.temperatureC);
  const crosswind = crosswindMs(
    weather.live.windSpeedMs,
    weather.live.windFromDeg,
    FIELD_IMPACT_SHOT_BEARING_DEG,
  );

  const [parallaxFocusM, setParallaxFocusM] = useState(Infinity);
  const [reticleIllum, setReticleIllum] = useState(0.45);

  const [phase, setPhase] = useState<Phase>("lobby");
  const [ammoId, setAmmoId] = useState(ammoOptions[0]?.id ?? "");
  const [zoom, setZoom] = useState(DEFAULT_SCOPE_ZOOM);
  const [sessionZeroXMm, setSessionZeroXMm] = useState(0);
  const [sessionZeroYMm, setSessionZeroYMm] = useState(0);
  const [aimMm, setAimMm] = useState({ x: 0, y: 0 });
  const [roundLayout, setRoundLayout] = useState<FieldImpactRoundLayout | null>(
    null,
  );
  const [stageIndex, setStageIndex] = useState(0);
  const [shotsFired, setShotsFired] = useState(0);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [elapsedUiMs, setElapsedUiMs] = useState(0);
  const [result, setResult] = useState<FieldImpactResult | null>(null);
  const [stageHits, setStageHits] = useState<FieldImpactStageHit[]>([]);
  const [aarIndex, setAarIndex] = useState(0);
  const stageHitsRef = useRef<FieldImpactStageHit[]>([]);
  const [impactFlash, setImpactFlash] = useState(false);
  const [lastImpact, setLastImpact] = useState<{
    xMm: number;
    yMm: number;
    diameterMm: number;
  } | null>(null);
  const [status, setStatus] = useState(
    "5 feltfigurer på Losby · tilfeldig sete + tiur/orre/ugle · kun tid.",
  );
  const [focusUi, setFocusUi] = useState<{
    phase: "idle" | "settling" | "focused" | "fatigued";
    remainingMs: number;
  }>({ phase: "idle", remainingMs: 0 });
  const [focusHeld, setFocusHeld] = useState(false);
  const [triggerUi, setTriggerUi] = useState<{
    pending: boolean;
    targetPct: number;
  }>({ pending: false, targetPct: 0 });
  const [recoilActive, setRecoilActive] = useState(false);

  const selectedAmmo = ammoOptions.find((a) => a.id === ammoId) ?? null;
  const ammoRemaining = selectedAmmo
    ? getInventoryQty(inventory, selectedAmmo.id)
    : 0;
  const clickUnit = scope?.scope.clickUnit ?? "MRAD";

  const stage = fieldImpactStageFromLayout(roundLayout, stageIndex);
  const shotGeom = useMemo(
    () => (stage ? birdShotGeom(stage.spriteId) : null),
    [stage],
  );
  const distanceM = stage?.distanceM ?? 100;
  const blurPx = features.parallaxBlur
    ? focusBlurPx(distanceM, parallaxFocusM) * params.parallaxBlurMult
    : 0;
  const birdWidthPct = stage?.widthPct ?? 2;
  const landscapeFocusX = stage?.x ?? 50;
  const landscapeFocusY = stage?.y ?? 50;
  const [landAspect, setLandAspect] = useState(DEFAULT_LAND_ASPECT);

  const holdCard: FieldImpactHoldCard | null = useMemo(() => {
    if (!rifle || !selectedAmmo || !stage) return null;
    return buildFieldImpactHoldCard({
      rifleId: rifle.id,
      ammoId: selectedAmmo.id,
      ammo: selectedAmmo.ammo,
      distanceM: stage.distanceM,
      dopeCard,
      weather,
      clickUnit,
      kestrelProfiles,
      customBarrel: customBarrels[rifle.id] ?? null,
    });
  }, [
    rifle,
    selectedAmmo,
    stage,
    dopeCard,
    weather,
    clickUnit,
    kestrelProfiles,
    customBarrels,
  ]);

  const lobbyCards = useMemo(() => {
    if (!rifle || !selectedAmmo) return [];
    return FIELD_IMPACT_DISTANCES_M.map((d) =>
      buildFieldImpactHoldCard({
        rifleId: rifle.id,
        ammoId: selectedAmmo.id,
        ammo: selectedAmmo.ammo,
        distanceM: d,
        dopeCard,
        weather,
        clickUnit,
        kestrelProfiles,
        customBarrel: customBarrels[rifle.id] ?? null,
      }),
    );
  }, [rifle, selectedAmmo, dopeCard, weather, clickUnit, kestrelProfiles, customBarrels]);

  const calmFactor = useMemo(
    () =>
      computeWeaponCalmFactor({
        hasBipod: !!bipod,
        bipod: bipod?.bipod,
        suppressorWeightGrams: suppressor?.weightGrams,
        extraCalmGrams: miscKitWeaponCalmGrams(
          kitItems.filter(isMiscItem).map((i) => i.misc),
          !!suppressor,
        ),
        customsCalmMult,
      }),
    [bipod, suppressor, kitItems, customsCalmMult],
  );
  const recoilKick = useMemo(() => {
    if (!rifle || !selectedAmmo) return 1;
    const damping = computeRecoilDamping({
      soundReductionDb: suppressor?.suppressor.soundReductionDb ?? null,
    });
    const grains = resolveBulletWeightGrains(
      selectedAmmo.ammo,
      `${selectedAmmo.brand} ${selectedAmmo.name}`,
    );
    const v0 =
      selectedAmmo.ammo.v0 *
      barrelV0FactorForRifle(rifle.id, customBarrels[rifle.id]);
    const felt = computeFeltRecoil({
      weaponCalm: calmFactor,
      recoilDamping: damping,
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
    customBarrels,
  ]);

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
  const gearMirageMult = useMemo(
    () =>
      miscKitMirageMult(
        kitItems.filter(isMiscItem).map((i) => i.misc),
        !!suppressor,
      ),
    [kitItems, suppressor],
  );
  const [barrelHeat01, setBarrelHeat01] = useState(0);
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
    fanOn: false,
    hasSuppressor: !!suppressor,
    gearMirageMult,
  };
  const mirageStrengthRef = useRef(0);
  const miragePhaseRef = useRef<MiragePhase>(createMiragePhase());
  const weatherTempRef = useRef(weather.live.temperatureC);
  weatherTempRef.current = weather.live.temperatureC;
  const mirageSceneRef = useRef<HTMLDivElement>(null);
  const mirageDisplaceRef = useRef<SVGFEDisplacementMapElement>(null);

  const keysRef = useRef<Keys>({
    up: false,
    down: false,
    left: false,
    right: false,
    ccw: false,
    cw: false,
  });
  const aimRef = useRef(aimMm);
  const aimDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const wobbleRef = useRef({ x: 0, y: 0 });
  const wobblePhase = useRef({ a: Math.random() * 10, b: Math.random() * 10 });
  const weaponCalmRef = useRef(calmFactor);
  const focusRef = useRef({ held: false, startedAtMs: 0 });
  /** One shot max per F-hold / focus period. */
  const focusShotSpentRef = useRef(false);
  const triggerMarkRef = useRef<number | null>(null);
  const triggerRef = useRef<{
    held: boolean;
    startedAtMs: number | null;
  }>({ held: false, startedAtMs: null });
  const triggerPullRef = useRef(0);
  const fireShotRef = useRef(() => {});
  const playShotRef = useRef<(opts: boolean | RangeShotAudioOptions) => void>(
    () => {},
  );
  const consumeAmmoRef = useRef(onConsumeAmmo);
  const recoilClearRef = useRef<number | null>(null);
  const impactFlashClearRef = useRef<number | null>(null);
  const scopeWorldRef = useRef<HTMLDivElement>(null);
  const scopeStageRef = useRef<HTMLDivElement>(null);
  const targetScaleRef = useRef(1);
  const birdSeatRef = useRef({
    x: landscapeFocusX,
    y: landscapeFocusY,
    widthPct: Math.max(0.05, birdWidthPct),
  });
  birdSeatRef.current = {
    x: landscapeFocusX,
    y: landscapeFocusY,
    widthPct: Math.max(0.05, birdWidthPct),
  };
  const landAspectRef = useRef(landAspect);
  landAspectRef.current = landAspect;
  /** False until the player pans — allows re-center when landAspect loads. */
  const hasPannedRef = useRef(false);
  const geomRef = useRef(shotGeom);
  // Sync every render (same as HuntShootView) — useEffect is too late for
  // rAF paint / fire between stage advance and the next commit.
  geomRef.current = shotGeom;
  const distanceRef = useRef(distanceM);
  distanceRef.current = distanceM;
  const stageIndexRef = useRef(0);
  stageIndexRef.current = stageIndex;
  const shotsFiredRef = useRef(0);
  shotsFiredRef.current = shotsFired;
  const startMsRef = useRef<number | null>(null);
  startMsRef.current = startMs;
  const phaseRef = useRef<Phase>("lobby");
  phaseRef.current = phase;
  const ammoRemainingRef = useRef(0);
  ammoRemainingRef.current = ammoRemaining;
  const advancingRef = useRef(false);
  const densityRef = useRef(densityRatio);
  densityRef.current = densityRatio;
  const powderTempRef = useRef(weather.live.temperatureC);
  powderTempRef.current = weather.live.temperatureC;
  const crosswindRef = useRef(crosswind);
  crosswindRef.current = crosswind;
  const barrelWearScaleRef = useRef(barrelWearScale);
  barrelWearScaleRef.current = barrelWearScale;
  const roundLayoutRef = useRef(roundLayout);
  roundLayoutRef.current = roundLayout;

  const { playShot } = useRangeAudio({ enabled: true, ambient: false });
  const {
    fillRef: triggerFillRef,
    paintTriggerProgress,
    resetTriggerProgress,
  } = useTriggerBarPaint();
  const {
    focusFillRef,
    focusBarRef,
    paintFocusProgress,
    resetFocusProgress,
  } = useFocusBarPaint();

  useEffect(() => {
    weaponCalmRef.current = calmFactor;
  }, [calmFactor]);
  useEffect(() => {
    aimRef.current = aimMm;
  }, [aimMm]);
  useEffect(() => {
    playShotRef.current = playShot;
  }, [playShot]);
  useEffect(() => {
    consumeAmmoRef.current = onConsumeAmmo;
  }, [onConsumeAmmo]);

  useEffect(() => {
    if (scope) {
      setZoom(clampScopeZoom(DEFAULT_SCOPE_ZOOM, zoomRange));
    }
  }, [scope, zoomRange.minZoom, zoomRange.maxZoom]);

  useEffect(() => {
    if (!scope) return;
    setZoom((z) => clampScopeZoom(z, zoomRange));
  }, [scope, zoomRange.minZoom, zoomRange.maxZoom]);

  useEffect(() => {
    if (!rifle || !scope || !selectedAmmo) return;
    onEnsureZeroing(rifle.id, scope.id, selectedAmmo.id);
  }, [rifle, scope, selectedAmmo, onEnsureZeroing]);

  useEffect(() => {
    return () => {
      if (recoilClearRef.current != null) {
        window.clearTimeout(recoilClearRef.current);
      }
      if (impactFlashClearRef.current != null) {
        window.clearTimeout(impactFlashClearRef.current);
      }
    };
  }, []);

  /** Keep rAF / fireShot refs aligned with a stage before React re-renders. */
  function applyStageToLiveRefs(st: FieldImpactStageLayout) {
    geomRef.current = birdShotGeom(st.spriteId);
    distanceRef.current = st.distanceM;
    birdSeatRef.current = {
      x: st.x,
      y: st.y,
      widthPct: Math.max(0.05, st.widthPct),
    };
  }

  function aimForStageLayout(
    st: FieldImpactStageLayout,
    aspect: number,
  ): { x: number; y: number } {
    const g = birdShotGeom(st.spriteId);
    const vitalOff = birdVitalOffsetFromImageCenterPx(g);
    return aimMmForLandscapeCenter({
      nativeW: g.nativeW,
      nativeH: g.nativeH,
      spriteHeightMm: g.spriteHeightMm,
      widthPct: st.widthPct,
      landAspect: aspect,
      birdXPct: st.x,
      birdYPct: st.y,
      vitalOff,
    });
  }

  /** Keep the same landscape look-point when the stage bird/seat changes. */
  function aimPreservingLandscapeLook(
    next: FieldImpactStageLayout,
  ): { x: number; y: number } {
    const prevG = geomRef.current;
    const prevSeat = birdSeatRef.current;
    const look =
      prevG != null
        ? landscapePctUnderReticle({
            aimMm: aimRef.current,
            seat: prevSeat,
            nativeW: prevG.nativeW,
            nativeH: prevG.nativeH,
            spriteHeightMm: prevG.spriteHeightMm,
            landAspect: landAspectRef.current,
            vitalOff: birdVitalOffsetFromImageCenterPx(prevG),
          })
        : { xPct: 50, yPct: 50 };
    applyStageToLiveRefs(next);
    const g = geomRef.current!;
    const vitalOff = birdVitalOffsetFromImageCenterPx(g);
    return aimMmForLandscapeLookAt({
      nativeW: g.nativeW,
      nativeH: g.nativeH,
      spriteHeightMm: g.spriteHeightMm,
      widthPct: next.widthPct,
      landAspect: landAspectRef.current,
      birdXPct: next.x,
      birdYPct: next.y,
      lookXPct: look.xPct,
      lookYPct: look.yPct,
      vitalOff,
    });
  }

  /** Re-center on landscape centre until the player pans (aspect load). */
  useEffect(() => {
    if (phase !== "shooting" || !stage) return;
    if (hasPannedRef.current) return;
    const aim0 = aimForStageLayout(stage, landAspect);
    setAimMm(aim0);
    aimRef.current = aim0;
  }, [phase, stage, landAspect]);

  function startRound() {
    if (!ready || !selectedAmmo || !rifle) return;
    if (getInventoryQty(inventory, selectedAmmo.id) <= 0) {
      setStatus("Tom for ammo — kjøp mer hos XXL.");
      return;
    }
    if (!onPayEntryFee(FIELD_IMPACT_ENTRY_FEE_NOK)) {
      setStatus("Ikke nok penger til startavgift.");
      return;
    }
    const layout = rollFieldImpactRound();
    const first = layout.stages[0]!;
    applyStageToLiveRefs(first);
    roundLayoutRef.current = layout;
    const aim0 = aimForStageLayout(first, landAspectRef.current);
    const now = performance.now();
    hasPannedRef.current = false;
    setRoundLayout(layout);
    setPhase("shooting");
    setStageIndex(0);
    setShotsFired(0);
    setStartMs(now);
    setElapsedUiMs(0);
    setResult(null);
    setStageHits([]);
    stageHitsRef.current = [];
    setAarIndex(0);
    setLastImpact(null);
    setImpactFlash(false);
    setAimMm(aim0);
    aimRef.current = aim0;
    advancingRef.current = false;
    setSessionZeroXMm(0);
    setSessionZeroYMm(0);
    const entryCant = initialCantDeg(realism);
    cantDegRef.current = entryCant;
    setCantDeg(entryCant);
    barrelHeatStateRef.current = createBarrelHeatState();
    miragePhaseRef.current = createMiragePhase();
    mirageStrengthRef.current = 0;
    setBarrelHeat01(0);
    setStatus(
      `Hold 1/5 · ${speciesLabelNb(first.species)} @ ${first.distanceM} m — dial etter kortet.`,
    );
    window.requestAnimationFrame(() => {
      if (
        document.activeElement instanceof HTMLElement &&
        document.activeElement !== scopeStageRef.current
      ) {
        document.activeElement.blur();
      }
      scopeStageRef.current?.focus();
    });
  }

  fireShotRef.current = () => {
    if (phaseRef.current !== "shooting") return;
    if (advancingRef.current) return;
    if (!ready || !rifle || !selectedAmmo || !scope) return;
    const g = geomRef.current;
    if (!g) return;
    if (getInventoryQty(inventory, selectedAmmo.id) <= 0) {
      setStatus("Tom for ammo — kjøp mer hos XXL.");
      return;
    }

    const { affinity, map, rolled } = ensureAmmoAffinity(
      ammoAffinities,
      rifle.id,
      selectedAmmo.id,
    );
    if (rolled) onAffinitiesChange(map);

    const solve = kestrelSolveAmmo(
      selectedAmmo.ammo,
      selectedAmmo.id,
      kestrelProfiles,
    );
    const w = wobbleRef.current;
    const dispersionInput = {
      rifle: rifleSpecWithCustomBarrel(rifle.rifle, customBarrels[rifle.id]),
      ammo: solve.ammo,
      stock: stock?.stock,
      affinity,
      customsMoaDelta,
      barrelWearScale: barrelWearScaleRef.current,
      mirageFactor: mirageStrengthRef.current,
      barrelV0Factor: barrelV0FactorForRifle(
        rifle.id,
        customBarrels[rifle.id],
      ),
      envelopeMult: realismDispersionMult(realism),
    };
    const envelopeMoa = combinedDispersionMoa(dispersionInput);
    const dist = distanceRef.current;
    const pull = triggerPullOffsetMm(
      triggerPullRef.current * customsTriggerPullScale,
      envelopeMoa,
      dist,
    );
    const poa = {
      xMm: aimRef.current.x + w.x + pull.xMm,
      yMm: aimRef.current.y + w.y + pull.yMm,
    };
    const shot = sampleShotFromPoa(poa, dispersionInput, dist, Math.random, {
      densityRatio: densityRef.current,
      powderTempC: powderTempRef.current,
      dvDtMpsPerC: solve.dvDtMpsPerC,
    });
    const barrelV0 = barrelV0FactorForRifle(
      rifle.id,
      customBarrels[rifle.id],
    );
    const windMm = exactBallisticHold(
      solve.ammo,
      dist,
      crosswindRef.current,
      {
        densityRatio: densityRef.current,
        powderTempC: powderTempRef.current,
        dvDtMpsPerC: solve.dvDtMpsPerC,
        v0Scale: barrelV0,
      },
    ).windDriftMm;
    const clickErr = scope.scope.clickErrorPercent ?? 0;
    // Hold card assumes a perfect 100 m zero. Ignore profile base/saved so
    // leftover range dials cannot turn "28 Ned" into a ~22-click real need.
    const realizedZero = {
      xMm: angularMmAtDistance(
        applyScopeClickError(sessionZeroXMm, clickErr),
        dist,
      ),
      yMm: angularMmAtDistance(
        applyScopeClickError(sessionZeroYMm, clickErr),
        dist,
      ),
    };
    const windageMm = shot.spinDriftMm + windMm;
    const scatterXMm = shot.xMm - poa.xMm - shot.spinDriftMm;
    const scatterYMm = shot.yMm - poa.yMm - shot.dropBelowLosMm;
    const canted = composeCantedImpactMm({
      poaXMm: poa.xMm,
      poaYMm: poa.yMm,
      zeroXMm: realizedZero.xMm,
      zeroYMm: realizedZero.yMm,
      scatterXMm,
      scatterYMm,
      dropMm: shot.dropBelowLosMm,
      windageMm,
      cantDeg: liveCantDeg(),
    });
    const impact = {
      xMm: canted.xMm,
      yMm: canted.yMm,
      diameterMm: caliberBulletDiameterMm(selectedAmmo.ammo.caliber),
    };

    if (!consumeAmmoRef.current(selectedAmmo.id, rifle.id)) {
      setStatus("Tom for ammo — kjøp mer hos XXL.");
      return;
    }

    barrelHeatStateRef.current = bumpBarrelHeatTarget(
      barrelHeatStateRef.current,
      barrelHeatProfileRef.current,
    );

    playShotRef.current({
      hasSuppressor: !!suppressor,
      silent: isSilentSuppressedShot(!!suppressor, selectedAmmo.ammo),
    });
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

    const nextShots = shotsFiredRef.current + 1;
    setShotsFired(nextShots);
    setLastImpact(impact);

    const { zone, kind } = classifyHuntShot(
      impact.xMm,
      impact.yMm,
      selectedAmmo.ammo.damageFactor,
      Math.random,
      g,
    );
    const hit = zone !== "none";
    if (!hit) {
      setStatus(
        `Bom · hold ${stageIndexRef.current + 1}/${FIELD_IMPACT_STAGE_COUNT} — prøv igjen.`,
      );
      return;
    }

    const st = fieldImpactStageFromLayout(
      roundLayoutRef.current,
      stageIndexRef.current,
    );
    if (st) {
      const logged: FieldImpactStageHit = {
        distanceM: st.distanceM,
        spriteId: st.spriteId,
        species: st.species,
        xMm: impact.xMm,
        yMm: impact.yMm,
        diameterMm: impact.diameterMm,
        zone,
        kind,
      };
      stageHitsRef.current = [...stageHitsRef.current, logged];
      setStageHits(stageHitsRef.current);
    }

    advancingRef.current = true;
    setImpactFlash(true);
    if (impactFlashClearRef.current != null) {
      window.clearTimeout(impactFlashClearRef.current);
    }

    const nextStage = stageIndexRef.current + 1;
    const finishNow = nextStage >= FIELD_IMPACT_STAGE_COUNT;
    if (finishNow) {
      const started = startMsRef.current ?? performance.now();
      const elapsed = performance.now() - started;
      const hits = stageHitsRef.current;
      const fin = finalizeFieldImpact({
        elapsedMs: elapsed,
        shotsFired: nextShots,
        stagesHit: FIELD_IMPACT_STAGE_COUNT,
        stageHits: hits,
      });
      // Stop clock on last hit; show IMPACT briefly, then result.
      impactFlashClearRef.current = window.setTimeout(() => {
        setImpactFlash(false);
        impactFlashClearRef.current = null;
        setResult(fin);
        if (fin.payoutNok > 0) onAwardPayout(fin.payoutNok);
        setPhase("result");
        setStatus(
          `Ferdig — ${formatFieldImpactElapsed(elapsed)}${
            fin.tierLabel ? ` · ${fin.tierLabel}` : " · ingen premie"
          }.`,
        );
        advancingRef.current = false;
      }, IMPACT_FLASH_MS);
      return;
    }

    impactFlashClearRef.current = window.setTimeout(() => {
      setImpactFlash(false);
      impactFlashClearRef.current = null;
      const layout = roundLayoutRef.current;
      const next = fieldImpactStageFromLayout(layout, nextStage);
      setStageIndex(nextStage);
      setLastImpact(null);
      if (next) {
        const aimNext = aimPreservingLandscapeLook(next);
        hasPannedRef.current = true;
        setAimMm(aimNext);
        aimRef.current = aimNext;
        setStatus(
          `Hold ${nextStage + 1}/${FIELD_IMPACT_STAGE_COUNT} · ${speciesLabelNb(next.species)} @ ${next.distanceM} m — dial etter kortet.`,
        );
      } else {
        setStatus(
          `Hold ${nextStage + 1}/${FIELD_IMPACT_STAGE_COUNT} · dial etter kortet.`,
        );
      }
      advancingRef.current = false;
    }, IMPACT_FLASH_MS);
  };

  function abortTrigger(reason: string) {
    triggerRef.current = { held: false, startedAtMs: null };
    resetTriggerProgress();
    setTriggerUi((prev) => ({ pending: false, targetPct: prev.targetPct }));
    if (reason) setStatus(reason);
  }

  function beginFocus(nowMs: number) {
    if (focusRef.current.held) return;
    focusRef.current = { held: true, startedAtMs: nowMs };
    focusShotSpentRef.current = false;
    setFocusHeld(true);
    const markMs = rollTriggerTargetMs();
    triggerMarkRef.current = markMs;
    resetTriggerProgress();
    paintFocusProgress(1, 0);
    setTriggerUi({ pending: false, targetPct: markMs / TRIGGER_BAR_MS });
    setStatus("Fokus — hold pusten. Slipp Space på merket.");
  }

  function endFocus(abortReason: string) {
    if (!focusRef.current.held) return;
    focusRef.current = { held: false, startedAtMs: 0 };
    setFocusHeld(false);
    if (triggerRef.current.held) abortTrigger(abortReason);
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
    if (el && el.hasPointerCapture(drag.pointerId)) {
      try {
        el.releasePointerCapture(drag.pointerId);
      } catch {
        /* already released */
      }
    }
  }

  function onAimPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (phase !== "shooting") return;
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
  }

  function onAimPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = aimDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    // Trackpad/mouse can drop button-up outside the element — stop if no buttons.
    if (e.pointerType === "mouse" && e.buttons === 0) {
      endAimDrag(e.currentTarget, e.pointerId);
      return;
    }
    const g = geomRef.current;
    if (!g) return;
    const delta = aimMmDeltaFromPointerDrag({
      dxClientPx: e.clientX - drag.startX,
      dyClientPx: e.clientY - drag.startY,
      scale: targetScaleRef.current,
      pxPerMm: birdNativePxPerMm(g),
      viewportEl: e.currentTarget,
    });
    const seat = birdSeatRef.current;
    const sceneW = g.nativeW * (100 / seat.widthPct);
    const sceneH = sceneW / Math.max(0.25, landAspectRef.current);
    const pxPerMm = birdNativePxPerMm(g);
    const limitX = (sceneW * 0.55) / pxPerMm;
    const limitY = (sceneH * 0.55) / pxPerMm;
    aimRef.current = {
      x: Math.max(-limitX, Math.min(limitX, drag.origX + delta.x)),
      y: Math.max(-limitY, Math.min(limitY, drag.origY + delta.y)),
    };
    hasPannedRef.current = true;
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
      setTriggerUi((prev) => ({ ...prev, pending: false }));
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
    const perfectBandMs = isRealismLow
      ? TRIGGER_PERFECT_BAND_MS * 2
      : TRIGGER_PERFECT_BAND_MS;
    triggerPullRef.current = triggerPullErrorFactor(elapsed, markMs, {
      perfectBandMs,
    });
    triggerRef.current = { held: false, startedAtMs: null };
    resetTriggerProgress();
    setTriggerUi((prev) => ({ pending: false, targetPct: prev.targetPct }));
    focusShotSpentRef.current = true;
    triggerMarkRef.current = null;
    fireShotRef.current();
  }

  function beginTrigger(nowMs: number) {
    if (triggerRef.current.held) return;
    if (phaseRef.current !== "shooting") return;
    if (advancingRef.current) return;
    if (focusShotSpentRef.current) {
      setStatus("Ett skudd per fokus — slipp F og fokusér på nytt.");
      return;
    }
    if (!focusRef.current.held || triggerMarkRef.current == null) {
      setStatus("Hold F (fokus) før avtrekk.");
      return;
    }
    if (ammoRemainingRef.current <= 0) {
      setStatus("Tom for ammo — kjøp mer hos XXL.");
      return;
    }
    triggerRef.current = { held: true, startedAtMs: nowMs };
    paintTriggerProgress(0);
    setTriggerUi((prev) => ({ ...prev, pending: true }));
    setStatus("Avtrekk… slipp Space på merket");
  }

  useEffect(() => {
    if (phase !== "shooting" || !ready) return;

    function blurActiveButton() {
      const el = document.activeElement;
      if (el instanceof HTMLButtonElement) el.blur();
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        keysRef.current.up = true;
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        keysRef.current.down = true;
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        keysRef.current.left = true;
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        keysRef.current.right = true;
      } else if (e.key === "q" || e.key === "Q") {
        if (!cantActiveRef.current) return;
        e.preventDefault();
        keysRef.current.ccw = true;
      } else if (e.key === "e" || e.key === "E") {
        if (!cantActiveRef.current) return;
        e.preventDefault();
        keysRef.current.cw = true;
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        if (e.repeat) return;
        blurActiveButton();
        beginFocus(performance.now());
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        if (e.repeat) return;
        blurActiveButton();
        beginTrigger(performance.now());
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "ArrowUp") keysRef.current.up = false;
      else if (e.key === "ArrowDown") keysRef.current.down = false;
      else if (e.key === "ArrowLeft") keysRef.current.left = false;
      else if (e.key === "ArrowRight") keysRef.current.right = false;
      else if (e.key === "q" || e.key === "Q") keysRef.current.ccw = false;
      else if (e.key === "e" || e.key === "E") keysRef.current.cw = false;
      else if (e.key === "f" || e.key === "F") {
        endFocus("Fokus sluppet — avtrekk avbrutt.");
      } else if (e.key === " " || e.code === "Space") {
        releaseTrigger(performance.now());
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      keysRef.current = {
        up: false,
        down: false,
        left: false,
        right: false,
        ccw: false,
        cw: false,
      };
    };
  }, [phase, ready]);

  useEffect(() => {
    if (phase !== "shooting" || !ready) return;
    let raf = 0;
    let last = performance.now();
    let uiAccum = 0;

    function paintScopeWorld() {
      const el = scopeWorldRef.current;
      const g = geomRef.current;
      if (!el || !g) return;
      const ax = aimRef.current.x + wobbleRef.current.x;
      const ay = aimRef.current.y + wobbleRef.current.y;
      const scale = targetScaleRef.current;
      const pxPerMm = birdNativePxPerMm(g);
      const vo = birdVitalOffsetFromImageCenterPx(g);
      const seat = birdSeatRef.current;
      const sceneW = g.nativeW * (100 / seat.widthPct);
      const sceneH = sceneW / Math.max(0.25, landAspectRef.current);
      const birdCx = (seat.x / 100) * sceneW;
      const birdCy = (seat.y / 100) * sceneH;
      const ox = birdCx - sceneW / 2;
      const oy = birdCy - sceneH / 2;
      const aimPxX = ax * pxPerMm;
      const aimPxY = ay * pxPerMm;
      const panPxX = (ox + vo.x + aimPxX) * scale;
      const panPxY = (oy + vo.y + aimPxY) * scale;
      el.style.transform = `translate(calc(-50% - ${panPxX}px), calc(-50% - ${panPxY}px)) scale(${scale})`;
    }

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = keysRef.current;
      let { x, y } = aimRef.current;
      const g = geomRef.current;
      const seat = birdSeatRef.current;
      const pxPerMm = g ? birdNativePxPerMm(g) : 1;
      const scale = targetScaleRef.current;
      const visibleScenePx = SCOPE_VIEWPORT_REF_PX / Math.max(0.01, scale);
      let speed = ((visibleScenePx * LANDSCAPE_AIM_FOV_FRAC) / pxPerMm) * dt;
      if (focusRef.current.held) {
        speed *= FOCUS_AIM_SPEED_MULT;
      }
      const sceneW = g ? g.nativeW * (100 / seat.widthPct) : 1000;
      const sceneH = sceneW / Math.max(0.25, landAspectRef.current);
      const limitX = (sceneW * 0.55) / pxPerMm;
      const limitY = (sceneH * 0.55) / pxPerMm;
      if (k.left) x -= speed;
      if (k.right) x += speed;
      if (k.up) y -= speed;
      if (k.down) y += speed;
      if (k.left || k.right || k.up || k.down) {
        hasPannedRef.current = true;
      }
      x = Math.max(-limitX, Math.min(limitX, x));
      y = Math.max(-limitY, Math.min(limitY, y));
      aimRef.current = { x, y };

      if (cantActiveRef.current && (k.ccw || k.cw)) {
        let next = cantDegRef.current;
        if (k.ccw) {
          next = nudgeCantDeg(next, -CANT_KEY_DEG_PER_SEC * dt);
        }
        if (k.cw) {
          next = nudgeCantDeg(next, CANT_KEY_DEG_PER_SEC * dt);
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
        paintTriggerProgress(
          Math.min(1, Math.max(0, elapsed / TRIGGER_BAR_MS)),
        );
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
        const started = startMsRef.current;
        if (started != null) {
          setElapsedUiMs(now - started);
        }
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, ready]);

  /** Same truth as hunt / admin: bird FOV scale + zoom-only FFP reticle. */
  const focusZoomBoost = scope
    ? scopeFocusZoomBoost(scope.scope, focusHeld)
    : 1;
  const focusViewportBoost = scope
    ? scopeFocusViewportBoost(scope.scope, focusHeld)
    : 1;
  const targetScale = scope && shotGeom
    ? birdScopeImageScale(
        zoom,
        scope.scope,
        distanceM,
        shotGeom.nativeW,
        shotGeom.spriteId,
        birdWidthPct,
      )
    : 1;
  const reticleScale = scope
    ? opticReticleImgScale(zoom, scope.scope)
    : 1;
  targetScaleRef.current = targetScale;

  const vitalOff = shotGeom
    ? birdVitalOffsetFromImageCenterPx(shotGeom)
    : { x: 0, y: 0 };
  const mmToPx = (mm: number) =>
    shotGeom ? mm * birdNativePxPerMm(shotGeom) : 0;
  const sceneW = shotGeom
    ? shotGeom.nativeW * (100 / Math.max(0.05, birdWidthPct))
    : 0;
  const sceneH = sceneW / Math.max(0.25, landAspect);

  const focusLabel =
    focusUi.phase === "focused"
      ? `Stabil ${(focusUi.remainingMs / 1000).toFixed(1)} s`
      : focusUi.phase === "settling"
        ? `Settler inn… ${(focusUi.remainingMs / 1000).toFixed(1)} s`
        : focusUi.phase === "fatigued"
          ? "Ustabil — slipp før 7 s / start på nytt"
          : "Ingen fokus (hold F)";

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

  if (!ready) {
    return (
      <div className="field-impact-comp">
        <p className="intro-line">
          IMPACT krever rifle, scope og ammo i kit.
        </p>
        <button type="button" className="intro-button" onClick={onBack}>
          ← Tilbake
        </button>
      </div>
    );
  }

  if (phase === "lobby") {
    return (
      <div className="field-impact-comp">
        <header className="shop-header">
          <p className="intro-line intro-gift">IMPACT! — Losby feltfigurer</p>
          <p className="shop-row-note">
            Fem tilfeldige seter på 100–500 m. Hver firkant kan være tiur, orre
            eller ugle. Dial etter kortet — kun tid teller.
          </p>
          <p className="shop-row-note">
            Saldo {balance.toLocaleString("nb-NO")} kr · startavgift{" "}
            {FIELD_IMPACT_ENTRY_FEE_NOK} kr
          </p>
        </header>

        <div className="field-impact-lobby-range">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={FIELD_IMPACT_LANDSCAPE_SRC}
            alt="Losby feltbane"
            className="field-impact-lobby-range-img"
            draggable={false}
          />
        </div>

        <div className="field-impact-card-preview">
          <p className="range-setup-label">Holdkort (auto fra DOPE / ballistikk)</p>
          <ul className="field-impact-card-list">
            {lobbyCards.map((c, i) => (
              <li key={c.distanceM}>
                <span className="field-impact-card-hold">
                  Hold {i + 1} · Avstand {c.distanceM} m
                </span>
                <span className="field-impact-card-clicks">
                  Klikk {c.elevLabel} · {c.windLabel}
                </span>
                <span className="field-impact-card-src">
                  {c.source === "DOPE"
                    ? `DOPE${c.dopeDistanceM != null && c.dopeDistanceM !== c.distanceM ? ` @ ${c.dopeDistanceM} m` : ""}`
                    : "ballistikk"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="moa-comp-tiers">
          <p className="range-setup-label">Premier (tid)</p>
          <ul className="moa-comp-tier-list">
            {FIELD_IMPACT_PAYOUT_TIERS.map((t) => (
              <li key={t.maxSeconds}>
                {t.label}: {t.payoutNok.toLocaleString("nb-NO")} kr
              </li>
            ))}
            <li>Over 120 s: ingen premie</li>
          </ul>
        </div>

        <div className="range-setup-block">
          <p className="range-setup-label">Ammunisjon</p>
          <ul className="range-ammo-list">
            {ammoOptions.map((a) => {
              const rounds = getInventoryQty(inventory, a.id);
              return (
                <li key={a.id}>
                  <button
                    type="button"
                    className={
                      a.id === ammoId
                        ? "range-ammo-option is-selected"
                        : "range-ammo-option"
                    }
                    onClick={() => setAmmoId(a.id)}
                  >
                    <span className="range-ammo-main">
                      <span className="range-ammo-name">
                        {a.brand} {a.name}
                      </span>
                      <span className="range-ammo-meta">
                        {a.ammo.caliber} · {rounds} stk
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {status ? <p className="shop-row-note">{status}</p> : null}

        <div className="range-actions">
          <button type="button" className="intro-button" onClick={startRound}>
            Start ({FIELD_IMPACT_ENTRY_FEE_NOK} kr)
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={onBack}
          >
            ← Tilbake
          </button>
        </div>
      </div>
    );
  }

  if (phase === "aar" && result && result.stageHits.length > 0) {
    const hit =
      result.stageHits[aarIndex] ?? result.stageHits[0]!;
    const n = result.stageHits.length;
    return (
      <div className="field-impact-comp field-impact-aar">
        <HuntShotAarView
          title={`Fasit · hold ${aarIndex + 1}/${n} · ${hit.distanceM} m`}
          subtitle={`Treff ${formatHuntImpactOffsetMm(hit.xMm, hit.yMm)} · sone ${hit.zone} · ${speciesLabelNb(hit.species)}`}
          continueLabel={
            aarIndex + 1 < n ? "Neste hold →" : "Tilbake til resultat"
          }
          birdSpriteId={hit.spriteId}
          birdClassName="field-impact-target-orange"
          hit={{
            xMm: hit.xMm,
            yMm: hit.yMm,
            diameterMm: hit.diameterMm,
            zone: hit.zone,
            kind: hit.kind,
          }}
          onContinue={() => {
            if (aarIndex + 1 < n) {
              setAarIndex((i) => i + 1);
            } else {
              setPhase("result");
            }
          }}
        />
      </div>
    );
  }

  if (phase === "result" && result) {
    return (
      <div className="field-impact-comp">
        <header className="shop-header">
          <p className="intro-line intro-gift">IMPACT! — resultat</p>
          <p className="shop-row-note">
            Tid:{" "}
            <strong>{formatFieldImpactElapsed(result.elapsedMs)}</strong>
            {result.tierLabel ? ` · ${result.tierLabel}` : " · ingen premie"}
            {" · "}
            {result.shotsFired} skudd
          </p>
          <p className="shop-row-note">
            Premie {result.payoutNok.toLocaleString("nb-NO")} kr − avgift{" "}
            {result.entryFeeNok} kr ={" "}
            <strong>
              {result.netNok >= 0 ? "+" : ""}
              {result.netNok.toLocaleString("nb-NO")} kr
            </strong>
          </p>
        </header>

        {result.stageHits.length > 0 ? (
          <ul className="field-impact-hit-log" aria-label="Treffpunkt per hold">
            {result.stageHits.map((h, i) => (
              <li key={`${h.distanceM}-${i}`}>
                <button
                  type="button"
                  className="intro-button sheriff-secondary field-impact-hit-log-btn"
                  onClick={() => {
                    setAarIndex(i);
                    setPhase("aar");
                  }}
                >
                  Hold {i + 1} · {h.distanceM} m · {speciesLabelNb(h.species)} ·{" "}
                  {formatHuntImpactOffsetMm(h.xMm, h.yMm)} · {h.zone}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="range-actions">
          {result.stageHits.length > 0 ? (
            <button
              type="button"
              className="intro-button"
              onClick={() => {
                setAarIndex(0);
                setPhase("aar");
              }}
            >
              Se fasit (alle hold)
            </button>
          ) : null}
          <button
            type="button"
            className="intro-button"
            onClick={() => {
              setPhase("lobby");
              setResult(null);
              setStageHits([]);
              stageHitsRef.current = [];
              setStatus("Klar for ny runde?");
            }}
          >
            Ny runde
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={onBack}
          >
            ← Competitions
          </button>
        </div>
      </div>
    );
  }

  // —— shooting ——
  return (
    <div className="field-impact-comp field-impact-comp--live">
      <header className="shop-header">
        <p className="intro-line intro-gift">
          IMPACT · hold {stageIndex + 1}/{FIELD_IMPACT_STAGE_COUNT} ·{" "}
          {formatFieldImpactElapsed(elapsedUiMs)}
        </p>
        <p className="shop-row-note">
          {stage ? `${speciesLabelNb(stage.species)} · ` : null}
          {rifle!.brand} {rifle!.name} · {selectedAmmo?.brand}{" "}
          {selectedAmmo?.name} · {ammoRemaining} igjen · {distanceM} m
        </p>
      </header>

      {holdCard ? (
        <div className="field-impact-hold-slip" aria-live="polite">
          <span className="field-impact-hold-slip-main">
            Avstand {holdCard.distanceM} m · Klikk {holdCard.elevLabel} ·{" "}
            {holdCard.windLabel}
          </span>
          <span className="field-impact-hold-slip-src">
            {holdCard.source === "DOPE" ? "DOPE" : "ballistikk + dV/dT"}
          </span>
        </div>
      ) : null}

      <div className="scope-stage" tabIndex={0} ref={scopeStageRef}>
        <BarrelHeatBar
          className="range-barrel-heat"
          heat01={barrelHeat01}
        />
        <MaybeScopeTube
          enabled={tubeMode}
          scopeId={scope!.id}
          elevation={
            <ScopeElevationDial
              sessionZeroMm={sessionZeroYMm}
              onNudge={(d) =>
                turretNudgeMoved(setSessionZeroYMm, (y) =>
                  clampElevationTurretMm(y + d, scope!.scope),
                )
              }
              clickUnit={clickUnit}
              clicksPerRev={scopeElevationClicksPerRev(scope!.scope)}
            />
          }
          parallax={
            <div className="scope-tube-para-stack">
              {illumOn ? (
                <IlluminationTurret
                  value={reticleIllum}
                  onChange={setReticleIllum}
                />
              ) : null}
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
                turretNudgeMoved(setSessionZeroXMm, (x) =>
                  clampTurretMm(x + d),
                )
              }
              clickUnit={clickUnit}
              clicksPerRev={scopeWindageClicksPerRev(scope!.scope)}
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
              </div>
            ) : null
          }
          triggerRail={
            tubeMode ? (
              <div className="range-side-rail range-side-rail--trigger">
                <span
                  className={
                    triggerUi.pending
                      ? "range-side-rail-label is-pending"
                      : "range-side-rail-label"
                  }
                >
                  Avtrekk
                </span>
                <div
                  className="range-trigger-bar"
                  style={{
                    ["--trigger-mark-pct" as string]: `${triggerUi.targetPct * 100}%`,
                  }}
                  aria-hidden
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
          </div>
          ) : null}

          <div
            className={[
              "scope-optic",
              scope && scopeFovDiameterScale(scope.scope) > 1
                ? "is-fov-premium"
                : "",
              focusViewportBoost > 1 ? "is-focus-immersive" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={
              focusViewportBoost > 1
                ? ({
                    ["--focus-viewport-scale" as string]: focusViewportBoost,
                  } as CSSProperties)
                : undefined
            }
          >
            <div
                className={
                  recoilActive
                    ? "scope-viewport is-recoiling"
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
              <ScopeFocusZoom scale={focusZoomBoost}>
              <div
                ref={scopeWorldRef}
                className="scope-world"
                style={
                  blurPx > 0.05
                    ? { filter: `blur(${blurPx.toFixed(2)}px)` }
                    : undefined
                }
              >
                <div ref={mirageSceneRef} className="scope-world-scene">
                  {shotGeom ? (
                    <div
                      className="hunt-scope-scene"
                      style={{ width: sceneW, height: sceneH }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="hunt-scope-landscape"
                        src={FIELD_IMPACT_LANDSCAPE_SRC}
                        alt=""
                        draggable={false}
                        aria-hidden
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                            setLandAspect(
                              img.naturalWidth / img.naturalHeight,
                            );
                          }
                        }}
                      />
                      <div
                        className="hunt-scope-bird-wrap"
                        style={{
                          left: `${landscapeFocusX}%`,
                          top: `${landscapeFocusY}%`,
                          width: `${birdWidthPct}%`,
                          aspectRatio: `${shotGeom.nativeW} / ${shotGeom.nativeH}`,
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          className="scope-target hunt-tiur-target field-impact-target-orange"
                          src={shotGeom.displaySrc}
                          alt="Feltfigur"
                          draggable={false}
                          width={shotGeom.nativeW}
                          height={shotGeom.nativeH}
                          style={{ width: "100%", height: "100%" }}
                        />
                        {lastImpact ? (
                          <span
                            className="bullet-hole"
                            style={{
                              width: mmToPx(lastImpact.diameterMm),
                              height: mmToPx(lastImpact.diameterMm),
                              left: `calc(50% + ${vitalOff.x + mmToPx(lastImpact.xMm)}px)`,
                              top: `calc(50% + ${vitalOff.y + mmToPx(lastImpact.yMm)}px)`,
                              marginLeft: -mmToPx(lastImpact.diameterMm) / 2,
                              marginTop: -mmToPx(lastImpact.diameterMm) / 2,
                            }}
                          />
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  <div className="scope-mirage-shimmer" aria-hidden />
                </div>
              </div>
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
                className="scope-reticle-offset"
                style={
                  Math.abs(cantDeg) > 0.02
                    ? { transform: `rotate(${cantDeg.toFixed(3)}deg)` }
                    : undefined
                }
              >
                <ScopeReticle
                  scope={scope!.scope}
                  zoom={zoom}
                  imgScale={reticleScale}
                  illumination={(tubeMode ? illumOn : true) ? reticleIllum : 0}
                />
              </div>
              </ScopeFocusZoom>
              {impactFlash ? (
                <div className="field-impact-flash" aria-live="assertive">
                  IMPACT! - TREFF!
                </div>
              ) : null}
            </div>
            <ScopeZoomRing
              scope={zoomRange}
              zoom={zoom}
              onChange={(z) => setZoom(clampScopeZoom(z, zoomRange))}
            />
            {bubbleHud ? (
              <BubbleLevel
                visualId={bubbleLevel!.visualId}
                cantDeg={cantDeg}
                onCantChange={setCantDeg}
              />
            ) : null}
          </div>

          {!tubeMode ? (
          <div className="range-side-rail range-side-rail--trigger">
            <span
              className={
                triggerUi.pending
                  ? "range-side-rail-label is-pending"
                  : "range-side-rail-label"
              }
            >
              Avtrekk
            </span>
            <div
              className="range-trigger-bar"
              style={{
                ["--trigger-mark-pct" as string]: `${triggerUi.targetPct * 100}%`,
              }}
              aria-hidden
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
            onPointerDown={handleTriggerPointerDown}
            onPointerUp={handleTriggerPointerUp}
            onPointerCancel={handleTriggerPointerUp}
            onContextMenu={(e) => e.preventDefault()}
          >
            Avtrekk
          </button>
        </div>
      </div>

      <div className="range-turret-wrap">
        <ScopeTurrets
          sessionZeroXMm={sessionZeroXMm}
          sessionZeroYMm={sessionZeroYMm}
          clickUnit={clickUnit}
          elevationClicksPerRev={scopeElevationClicksPerRev(scope?.scope)}
          windageClicksPerRev={scopeWindageClicksPerRev(scope?.scope)}
          hideShooterDials={tubeMode}
          shooterAuxTurrets={
            !tubeMode ? (
              <ShooterAuxTurrets
                parallaxFocusM={parallaxFocusM}
                onParallaxChange={setParallaxFocusM}
                reticleIllum={reticleIllum}
                onIllumChange={setReticleIllum}
              />
            ) : null
          }
          onNudge={(axis, deltaMm) => {
            if (axis === "x") {
              return turretNudgeMoved(setSessionZeroXMm, (v) =>
                clampTurretMm(v + deltaMm),
              );
            }
            return turretNudgeMoved(setSessionZeroYMm, (v) =>
              clampElevationTurretMm(v + deltaMm, scope?.scope),
            );
          }}
        />
      </div>

      {status ? <p className="shop-row-note">{status}</p> : null}
    </div>
  );
}
