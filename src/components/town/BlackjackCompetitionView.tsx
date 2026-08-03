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
  CBA_DIAMOND_CENTER_TO_TIP_PX,
  FOCUS_HOLD_MS,
  TRIGGER_BAR_MS,
  RANGE_EASY_ZERO_SCALE,
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
  DEFAULT_SCOPE_AIM_CONTROL,
  scopeAimPaintMm,
  scopeMoveReticleActive,
  type ScopeAimControl,
} from "@/lib/range/scopeAimControl";
import {
  DEFAULT_FOCUS_TRIGGER_BAR_LENGTH,
  DEFAULT_SCOPE_ZOOM_ON_FOCUS,
  type FocusTriggerBarLength,
} from "@/lib/range/playerScopeSettings";
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
  decodeReticleIllumination,
  scopeEffectiveZoomRange,
  scopeElevationClicksPerRev,
  scopeFocusViewportBoost,
  scopeFocusZoomBoost,
  scopeFovDiameterScale,
  scopeIlluminationBipolar,
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
  BLACKJACK_DISTANCE_M,
  BLACKJACK_DISTANCE_YD,
  BLACKJACK_ENTRY_FEE_NOK,
  BLACKJACK_LANDSCAPE_SRC,
  BLACKJACK_LOBBY_VISUAL_SCALE,
  BLACKJACK_PAINT_FLAKE_SCALE,
  BLACKJACK_PAYOUT_TIERS,
  BLACKJACK_SHOT_BEARING_DEG,
  BLACKJACK_TIME_LIMIT_MS,
  applyBlackjackPlateHit,
  blackjackNeededPlateIndices,
  blackjackPlateAt,
  blackjackPlateGeom,
  blackjackRunPhaseLabelNb,
  buildBlackjackHoldCard,
  buildBlackjackRack,
  findBlackjackPlateHit,
  finalizeBlackjack,
  formatBlackjackClock,
  formatBlackjackElapsed,
  initialBlackjackProgress,
  type BlackjackHitLog,
  type BlackjackHoldCard,
  type BlackjackPlateLayout,
  type BlackjackProgress,
  type BlackjackRackLayout,
  type BlackjackResult,
} from "@/lib/range/blackjackComp";
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

type BlackjackCompetitionViewProps = {
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
  /** Move target under reticle, or reticle over a fixed target. */
  scopeAimControl?: ScopeAimControl;
  scopeZoomOnFocus?: boolean;
  focusTriggerBarLength?: FocusTriggerBarLength;
};

type Keys = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  ccw: boolean;
  cw: boolean;
};

type Phase = "lobby" | "shooting" | "result";

type PlateAimGeom = ReturnType<typeof blackjackPlateGeom>;

const LANDSCAPE_AIM_FOV_FRAC = 0.36;
const FOCUS_AIM_SPEED_MULT = 0.14;
const DEFAULT_SCOPE_ZOOM = 12;
const HIT_FLASH_MS = 900;
/** Losby photo aspect ≈ 1024×606. */
const DEFAULT_LAND_ASPECT = 1024 / 606;

/** Aim (mm from plate centre) that puts a landscape % under the reticle. */
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

/** Aim that puts landscape centre under the reticle. */
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

/** Scope image scale matching plate geom (angular mm ↔ landscape %). */
function plateScopeImageScale(
  zoom: number,
  scope: Parameters<typeof opticReticleImgScale>[1],
  distanceM: number,
  geom: Pick<PlateAimGeom, "nativeH" | "spriteHeightMm">,
): number {
  const milScreenPx =
    CBA_DIAMOND_CENTER_TO_TIP_PX *
    opticReticleImgScale(Math.max(1, zoom), scope);
  const pxPerMm = geom.nativeH / Math.max(1e-6, geom.spriteHeightMm);
  return Math.max(
    0.01,
    milScreenPx / (Math.max(1, distanceM) * Math.max(1e-9, pxPerMm)),
  );
}

function plateClassName(
  plate: BlackjackPlateLayout,
  neededIndices: ReadonlySet<number>,
  hitIndices: ReadonlySet<number>,
  swinging: boolean,
): string {
  const parts = ["blackjack-plate"];
  if (neededIndices.has(plate.index)) parts.push("is-needed");
  if (hitIndices.has(plate.index)) parts.push("is-hit");
  if (swinging) parts.push("is-swinging");
  return parts.join(" ");
}

function plateStyle(plate: BlackjackPlateLayout): CSSProperties {
  return {
    left: `${plate.x}%`,
    top: `${plate.y}%`,
    width: `${plate.widthPct}%`,
    aspectRatio: "1",
    transform: "translate(-50%, -50%)",
  };
}

/** Paint flake size/pos as % of plate — independent of which plate is “focused”. */
function paintChipStyle(chip: {
  xMm: number;
  yMm: number;
  diameterMm: number;
  sizeMm: number;
  rotDeg: number;
}): CSSProperties {
  const sizePct = (chip.diameterMm / Math.max(1e-6, chip.sizeMm)) * 100;
  const xPct = (chip.xMm / Math.max(1e-6, chip.sizeMm)) * 100;
  const yPct = (chip.yMm / Math.max(1e-6, chip.sizeMm)) * 100;
  return {
    width: `${sizePct}%`,
    height: `${sizePct}%`,
    left: `calc(50% + ${xPct}%)`,
    top: `calc(50% + ${yPct}%)`,
    marginLeft: `${-sizePct / 2}%`,
    marginTop: `${-sizePct / 2}%`,
    transform: `rotate(${chip.rotDeg}deg)`,
  };
}

export function BlackjackCompetitionView({
  balance,
  kitItems,
  inventory,
  ammoAffinities,
  zeroingProfiles: _zeroingProfiles,
  dopeCard: _dopeCard,
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
  scopeAimControl = DEFAULT_SCOPE_AIM_CONTROL,
  scopeZoomOnFocus = DEFAULT_SCOPE_ZOOM_ON_FOCUS,
  focusTriggerBarLength = DEFAULT_FOCUS_TRIGGER_BAR_LENGTH,
}: BlackjackCompetitionViewProps) {
  const realismControls = useSyncExternalStore(
    subscribeRealismControls,
    getRealismControls,
    () => DEFAULT_REALISM_CONTROLS,
  );
  const realismLevel = realismLevelKey(realism);
  const features = realismControls.features[realismLevel];
  const isRealismLow = realismLevel === "low";
  const tubeMode = features.tubeTurrets;
  const railsOnly =
    !tubeMode && (features.focusHold || features.triggerTiming);
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
  const mountFitsScope =
    !!scope &&
    !!mount &&
    mount.mount.tubeDiameterMm === scope.scope.tubeDiameterMm;
  const ready = !!(rifle && scope && mountFitsScope && ammoOptions.length > 0);
  const densityRatio = densityRatioFromTempC(weather.live.temperatureC);
  const crosswind = crosswindMs(
    weather.live.windSpeedMs,
    weather.live.windFromDeg,
    BLACKJACK_SHOT_BEARING_DEG,
  );

  const [parallaxFocusM, setParallaxFocusM] = useState(Infinity);
  const [reticleIllum, setReticleIllum] = useState(0.45);
  const illumDecoded = decodeReticleIllumination(
    reticleIllum,
    scope?.scope,
  );
  const illumBipolar = scopeIlluminationBipolar(scope?.scope);

  const [phase, setPhase] = useState<Phase>("lobby");
  const [ammoId, setAmmoId] = useState(ammoOptions[0]?.id ?? "");
  const [zoom, setZoom] = useState(DEFAULT_SCOPE_ZOOM);
  /**
   * Same 10× helper as shooting-range zeroing: larger blink + matching reticle.
   * Turret stays 1 klikk per knepp ({@link RANGE_EASY_ZERO_SCALE}).
   */
  const [easy10x, setEasy10x] = useState(false);
  const [sessionZeroXMm, setSessionZeroXMm] = useState(0);
  const [sessionZeroYMm, setSessionZeroYMm] = useState(0);
  const [aimMm, setAimMm] = useState({ x: 0, y: 0 });
  const [rack, setRack] = useState<BlackjackRackLayout | null>(null);
  const [progress, setProgress] = useState<BlackjackProgress>(() =>
    initialBlackjackProgress(),
  );
  /** Score HUD updates immediately; plate/phase wait for hit flash. */
  const [scoreUi, setScoreUi] = useState(0);
  const [shotsFired, setShotsFired] = useState(0);
  const [startMs, setStartMs] = useState<number | null>(null);
  const [elapsedUiMs, setElapsedUiMs] = useState(0);
  const [result, setResult] = useState<BlackjackResult | null>(null);
  const [hitLog, setHitLog] = useState<BlackjackHitLog[]>([]);
  const hitLogRef = useRef<BlackjackHitLog[]>([]);
  const [impactFlash, setImpactFlash] = useState(false);
  const [flashLabel, setFlashLabel] = useState("TREFF!");
  /** Paint flakes that stay on steel plates for the round. */
  const [paintChips, setPaintChips] = useState<
    {
      id: string;
      plateIndex: number;
      xMm: number;
      yMm: number;
      /** Flake diameter (bullet Ø × {@link BLACKJACK_PAINT_FLAKE_SCALE}). */
      diameterMm: number;
      sizeMm: number;
      rotDeg: number;
    }[]
  >([]);
  const [swingPlateIndex, setSwingPlateIndex] = useState<number | null>(null);
  const [status, setStatus] = useState(
    "BlackJack Challenge · 6 plater @ ~500 yd · 2 min.",
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

  const lobbyRack = useMemo(
    () => buildBlackjackRack(BLACKJACK_DISTANCE_M, {
      visualScale: BLACKJACK_LOBBY_VISUAL_SCALE,
    }),
    [],
  );
  const activePlate = blackjackPlateAt(rack, progress.nextPlateIndex);
  /** Fixed 12″ plate — scene/aim scale never jumps when scoring advances. */
  const refPlate = rack?.plates[0] ?? null;
  const shotGeom = useMemo(
    () => (refPlate ? blackjackPlateGeom(refPlate.sizeMm) : null),
    [refPlate],
  );
  const distanceM = BLACKJACK_DISTANCE_M;
  const blurPx = features.parallaxBlur
    ? focusBlurPx(distanceM, parallaxFocusM) * params.parallaxBlurMult
    : 0;
  const plateWidthPct = refPlate?.widthPct ?? 2;
  const landscapeFocusX = refPlate?.x ?? 50;
  const landscapeFocusY = refPlate?.y ?? 50;
  const [landAspect, setLandAspect] = useState(DEFAULT_LAND_ASPECT);

  const holdCard: BlackjackHoldCard | null = useMemo(() => {
    if (!rifle || !selectedAmmo) return null;
    return buildBlackjackHoldCard({
      rifleId: rifle.id,
      ammoId: selectedAmmo.id,
      ammo: selectedAmmo.ammo,
      distanceM: BLACKJACK_DISTANCE_M,
      weather,
      clickUnit,
      kestrelProfiles,
      customBarrel: customBarrels[rifle.id] ?? null,
    });
  }, [
    rifle,
    selectedAmmo,
    weather,
    clickUnit,
    kestrelProfiles,
    customBarrels,
  ]);

  const lobbyHold = useMemo(() => {
    if (!rifle || !selectedAmmo) return null;
    return buildBlackjackHoldCard({
      rifleId: rifle.id,
      ammoId: selectedAmmo.id,
      ammo: selectedAmmo.ammo,
      distanceM: BLACKJACK_DISTANCE_M,
      weather,
      clickUnit,
      kestrelProfiles,
      customBarrel: customBarrels[rifle.id] ?? null,
    });
  }, [rifle, selectedAmmo, weather, clickUnit, kestrelProfiles, customBarrels]);

  const hitIndices = useMemo(() => {
    const mask =
      progress.runPhase === "forward"
        ? progress.forwardHitMask
        : progress.runPhase === "reverse"
          ? progress.reverseHitMask
          : 0;
    const s = new Set<number>();
    for (let i = 0; i < 6; i++) {
      if (mask & (1 << i)) s.add(i);
    }
    return s;
  }, [progress]);
  const neededIndices = useMemo(
    () => blackjackNeededPlateIndices(progress),
    [progress],
  );

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
    return recoilKickScale(felt, realism);
  }, [
    rifle,
    scope,
    mount,
    suppressor,
    bipod,
    selectedAmmo,
    calmFactor,
    customBarrels,
    realism,
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
  const flightResolveRef = useRef<number | null>(null);
  const swingClearRef = useRef<number | null>(null);
  const scopeWorldRef = useRef<HTMLDivElement>(null);
  const scopeReticleOffsetRef = useRef<HTMLDivElement>(null);
  const frozenBaseAimRef = useRef({ x: 0, y: 0 });
  const aimControlRef = useRef<ScopeAimControl>(scopeAimControl);
  aimControlRef.current = scopeAimControl;
  const scopeStageRef = useRef<HTMLDivElement>(null);
  const targetScaleRef = useRef(1);
  const plateSeatRef = useRef({
    x: landscapeFocusX,
    y: landscapeFocusY,
    widthPct: Math.max(0.05, plateWidthPct),
  });
  plateSeatRef.current = {
    x: landscapeFocusX,
    y: landscapeFocusY,
    widthPct: Math.max(0.05, plateWidthPct),
  };
  const landAspectRef = useRef(landAspect);
  landAspectRef.current = landAspect;
  /** False until the player pans — allows re-center when landAspect loads. */
  const hasPannedRef = useRef(false);
  const geomRef = useRef<PlateAimGeom | null>(shotGeom);
  // Sync every render — useEffect is too late for rAF paint / fire.
  geomRef.current = shotGeom;
  const distanceRef = useRef(distanceM);
  distanceRef.current = distanceM;
  const shotsFiredRef = useRef(0);
  shotsFiredRef.current = shotsFired;
  const startMsRef = useRef<number | null>(null);
  startMsRef.current = startMs;
  const phaseRef = useRef<Phase>("lobby");
  phaseRef.current = phase;
  const ammoRemainingRef = useRef(0);
  ammoRemainingRef.current = ammoRemaining;
  const advancingRef = useRef(false);
  const finishingRef = useRef(false);
  const densityRef = useRef(densityRatio);
  densityRef.current = densityRatio;
  const powderTempRef = useRef(weather.live.temperatureC);
  powderTempRef.current = weather.live.temperatureC;
  const crosswindRef = useRef(crosswind);
  crosswindRef.current = crosswind;
  const barrelWearScaleRef = useRef(barrelWearScale);
  barrelWearScaleRef.current = barrelWearScale;
  const rackRef = useRef(rack);
  rackRef.current = rack;
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const onAwardPayoutRef = useRef(onAwardPayout);
  onAwardPayoutRef.current = onAwardPayout;

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
      if (flightResolveRef.current != null) {
        window.clearTimeout(flightResolveRef.current);
      }
      if (swingClearRef.current != null) {
        window.clearTimeout(swingClearRef.current);
      }
    };
  }, []);

  /** Scene/aim always anchored on the 12″ reference plate. */
  function applyRefToLiveRefs(ref: BlackjackPlateLayout) {
    geomRef.current = blackjackPlateGeom(ref.sizeMm);
    distanceRef.current = BLACKJACK_DISTANCE_M;
    plateSeatRef.current = {
      x: ref.x,
      y: ref.y,
      widthPct: Math.max(0.05, ref.widthPct),
    };
  }

  function aimForRefPlate(
    ref: BlackjackPlateLayout,
    aspect: number,
  ): { x: number; y: number } {
    const g = blackjackPlateGeom(ref.sizeMm);
    return aimMmForLandscapeCenter({
      nativeW: g.nativeW,
      nativeH: g.nativeH,
      spriteHeightMm: g.spriteHeightMm,
      widthPct: ref.widthPct,
      landAspect: aspect,
      birdXPct: ref.x,
      birdYPct: ref.y,
      vitalOff: g.vitalOff,
    });
  }

  function triggerPlateSwing(plateIndex: number) {
    setSwingPlateIndex(plateIndex);
    if (swingClearRef.current != null) {
      window.clearTimeout(swingClearRef.current);
    }
    swingClearRef.current = window.setTimeout(() => {
      setSwingPlateIndex(null);
      swingClearRef.current = null;
    }, 650);
  }

  function finishRound(opts: { timedOut: boolean }) {
    if (finishingRef.current) return;
    if (phaseRef.current !== "shooting") return;
    finishingRef.current = true;
    advancingRef.current = true;
    if (impactFlashClearRef.current != null) {
      window.clearTimeout(impactFlashClearRef.current);
      impactFlashClearRef.current = null;
    }
    if (flightResolveRef.current != null) {
      window.clearTimeout(flightResolveRef.current);
      flightResolveRef.current = null;
    }
    setImpactFlash(false);

    const prog = progressRef.current;
    const started = startMsRef.current ?? performance.now();
    const elapsed = opts.timedOut
      ? BLACKJACK_TIME_LIMIT_MS
      : Math.min(BLACKJACK_TIME_LIMIT_MS, performance.now() - started);
    const fin = finalizeBlackjack({
      score: prog.score,
      elapsedMs: elapsed,
      shotsFired: shotsFiredRef.current,
      hits: hitLogRef.current.length,
      blackjacks: prog.blackjacks,
      completedForward: prog.completedForward,
      completedReverse: prog.completedReverse,
      timedOut: opts.timedOut,
      hitLog: hitLogRef.current,
    });
    setResult(fin);
    if (fin.payoutNok > 0) onAwardPayoutRef.current(fin.payoutNok);
    phaseRef.current = "result";
    setPhase("result");
    setStatus(
      opts.timedOut
        ? `Tid ute — ${fin.score} poeng · ${formatBlackjackElapsed(elapsed)}${
            fin.tierLabel ? ` · ${fin.tierLabel}` : " · ingen premie"
          }.`
        : `Ferdig — ${fin.score} poeng · ${formatBlackjackElapsed(elapsed)}${
            fin.tierLabel ? ` · ${fin.tierLabel}` : " · ingen premie"
          }.`,
    );
    advancingRef.current = false;
  }

  /** Re-center on landscape centre until the player pans (aspect load). */
  useEffect(() => {
    if (phase !== "shooting" || !refPlate) return;
    if (hasPannedRef.current) return;
    const aim0 = aimForRefPlate(refPlate, landAspect);
    setAimMm(aim0);
    aimRef.current = aim0;
    frozenBaseAimRef.current = { ...aim0 };
  }, [phase, refPlate, landAspect]);

  function startRound() {
    if (!ready || !selectedAmmo || !rifle) return;
    if (getInventoryQty(inventory, selectedAmmo.id) <= 0) {
      setStatus("Tom for ammo — kjøp mer hos XXL.");
      return;
    }
    if (!onPayEntryFee(BLACKJACK_ENTRY_FEE_NOK)) {
      setStatus("Ikke nok penger til startavgift.");
      return;
    }
    const nextRack = buildBlackjackRack();
    const ref = nextRack.plates[0]!;
    const prog0 = initialBlackjackProgress();
    applyRefToLiveRefs(ref);
    rackRef.current = nextRack;
    progressRef.current = prog0;
    const aim0 = aimForRefPlate(ref, landAspectRef.current);
    const now = performance.now();
    hasPannedRef.current = false;
    finishingRef.current = false;
    setRack(nextRack);
    setProgress(prog0);
    setScoreUi(0);
    setPhase("shooting");
    setShotsFired(0);
    setStartMs(now);
    setElapsedUiMs(0);
    setResult(null);
    setHitLog([]);
    hitLogRef.current = [];
    setPaintChips([]);
    setSwingPlateIndex(null);
    setImpactFlash(false);
    setFlashLabel("TREFF!");
    if (flightResolveRef.current != null) {
      window.clearTimeout(flightResolveRef.current);
      flightResolveRef.current = null;
    }
    if (impactFlashClearRef.current != null) {
      window.clearTimeout(impactFlashClearRef.current);
      impactFlashClearRef.current = null;
    }
    if (swingClearRef.current != null) {
      window.clearTimeout(swingClearRef.current);
      swingClearRef.current = null;
    }
    setAimMm(aim0);
    aimRef.current = aim0;
    frozenBaseAimRef.current = { ...aim0 };
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
      `Freefire · hint ${ref.label} · ${blackjackRunPhaseLabelNb(prog0.runPhase)}`,
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
    if (advancingRef.current || finishingRef.current) return;
    if (!ready || !rifle || !selectedAmmo || !scope) return;
    const g = geomRef.current;
    if (!g) return;
    const rackNow = rackRef.current;
    const ref = rackNow?.plates[0];
    if (!rackNow || !ref) return;
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
    const bulletDiameterMm = caliberBulletDiameterMm(selectedAmmo.ammo.caliber);
    const impact = {
      xMm: canted.xMm,
      yMm: canted.yMm,
      diameterMm: bulletDiameterMm,
    };
    const paintDiameterMm = bulletDiameterMm * BLACKJACK_PAINT_FLAKE_SCALE;
    const flightMs = Math.max(
      50,
      Math.round((shot.timeOfFlightS || 0) * 1000),
    );

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
      }, 400);
    });

    const nextShots = shotsFiredRef.current + 1;
    setShotsFired(nextShots);

    // Wait for projectile TOF before TREFF/BOM (and paint flake).
    advancingRef.current = true;
    setStatus(
      `Skudd i luften… ${shot.timeOfFlightS.toFixed(2)} s til ${BLACKJACK_DISTANCE_YD} yd`,
    );
    if (flightResolveRef.current != null) {
      window.clearTimeout(flightResolveRef.current);
    }
    if (impactFlashClearRef.current != null) {
      window.clearTimeout(impactFlashClearRef.current);
      impactFlashClearRef.current = null;
    }

    const rackAtFire = rackNow;
    const refAtFire = ref;
    flightResolveRef.current = window.setTimeout(() => {
      flightResolveRef.current = null;
      if (finishingRef.current || phaseRef.current !== "shooting") {
        advancingRef.current = false;
        return;
      }

      const found = findBlackjackPlateHit(
        rackAtFire,
        { x: impact.xMm, y: impact.yMm },
        refAtFire,
        landAspectRef.current,
      );
      if (!found) {
        setStatus("Bom");
        advancingRef.current = false;
        return;
      }

      const hitPlate = found.plate;
      triggerPlateSwing(hitPlate.index);
      setPaintChips((chips) => [
        ...chips,
        {
          id: `${nextShots}-${hitPlate.index}-${found.localXMm.toFixed(2)}-${found.localYMm.toFixed(2)}`,
          plateIndex: hitPlate.index,
          xMm: found.localXMm,
          yMm: found.localYMm,
          diameterMm: paintDiameterMm,
          sizeMm: hitPlate.sizeMm,
          rotDeg: (nextShots * 47 + hitPlate.index * 13) % 360,
        },
      ]);

      const prev = progressRef.current;
      const applied = applyBlackjackPlateHit(prev, hitPlate.index);
      if (!applied) {
        setStatus("Bom");
        advancingRef.current = false;
        return;
      }

      if (!applied.scored) {
        setStatus(
          `Treff ${hitPlate.label} — ingen poeng (${blackjackRunPhaseLabelNb(prev.runPhase)})`,
        );
        advancingRef.current = false;
        return;
      }

      const started = startMsRef.current ?? performance.now();
      const logged: BlackjackHitLog = {
        plateIndex: hitPlate.index,
        sizeInch: hitPlate.sizeInch,
        pointsAwarded: applied.pointsAwarded,
        xMm: found.localXMm,
        yMm: found.localYMm,
        diameterMm: impact.diameterMm,
        runPhase: prev.runPhase,
        elapsedMs: performance.now() - started,
      };
      hitLogRef.current = [...hitLogRef.current, logged];
      setHitLog(hitLogRef.current);
      progressRef.current = applied.next;
      setProgress(applied.next);
      setScoreUi(applied.next.score);

      const isBlackjack =
        applied.next.blackjacks > prev.blackjacks ||
        applied.pointsAwarded >= 21;
      setFlashLabel(isBlackjack ? "BLACKJACK!" : "TREFF!");
      setImpactFlash(true);

      const hintPlate = blackjackPlateAt(
        rackRef.current,
        applied.next.nextPlateIndex,
      );
      impactFlashClearRef.current = window.setTimeout(() => {
        setImpactFlash(false);
        impactFlashClearRef.current = null;
        if (finishingRef.current || phaseRef.current !== "shooting") {
          advancingRef.current = false;
          return;
        }
        setStatus(
          hintPlate
            ? `Hint: ${hintPlate.label} · ${blackjackRunPhaseLabelNb(applied.next.runPhase)} · ${applied.next.score} poeng`
            : `${blackjackRunPhaseLabelNb(applied.next.runPhase)} · ${applied.next.score} poeng`,
        );
        advancingRef.current = false;
      }, HIT_FLASH_MS);
    }, flightMs);
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
    if (aimControlRef.current === "reticle") {
      frozenBaseAimRef.current = {
        x: aimRef.current.x,
        y: aimRef.current.y,
      };
    }
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
      invert: scopeMoveReticleActive(
        aimControlRef.current,
        focusRef.current.held,
      ),
      viewportEl: e.currentTarget,
    });
    const seat = plateSeatRef.current;
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
    if (advancingRef.current || finishingRef.current) return;
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
      const paint = scopeAimPaintMm({
        aimControl: aimControlRef.current,
        focusHeld: focusRef.current.held,
        aim: aimRef.current,
        wobble: wobbleRef.current,
        frozenBase: frozenBaseAimRef.current,
      });
      const ax = paint.worldX;
      const ay = paint.worldY;
      const scale = targetScaleRef.current;
      const pxPerMm = birdNativePxPerMm(g);
      const vo = g.vitalOff;
      const seat = plateSeatRef.current;
      const sceneW = g.nativeW * (100 / seat.widthPct);
      const sceneH = sceneW / Math.max(0.25, landAspectRef.current);
      const plateCx = (seat.x / 100) * sceneW;
      const plateCy = (seat.y / 100) * sceneH;
      const ox = plateCx - sceneW / 2;
      const oy = plateCy - sceneH / 2;
      const aimPxX = ax * pxPerMm;
      const aimPxY = ay * pxPerMm;
      const panPxX = (ox + vo.x + aimPxX) * scale;
      const panPxY = (oy + vo.y + aimPxY) * scale;
      el.style.transform = `translate(calc(-50% - ${panPxX}px), calc(-50% - ${panPxY}px)) scale(${scale})`;

      const reticleEl = scopeReticleOffsetRef.current;
      if (reticleEl) {
        const cant = cantActiveRef.current ? cantDegRef.current : 0;
        const cantRot =
          Math.abs(cant) > 0.02 ? `rotate(${cant.toFixed(3)}deg)` : "";
        const rx = paint.reticleX * pxPerMm * scale;
        const ry = paint.reticleY * pxPerMm * scale;
        const move =
          Math.abs(rx) > 0.01 || Math.abs(ry) > 0.01
            ? `translate(${rx}px, ${ry}px)`
            : "";
        reticleEl.style.transform = [move, cantRot].filter(Boolean).join(" ");
      }
    }

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = keysRef.current;
      let { x, y } = aimRef.current;
      const g = geomRef.current;
      const seat = plateSeatRef.current;
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
          const elapsed = now - started;
          setElapsedUiMs(elapsed);
          if (elapsed >= BLACKJACK_TIME_LIMIT_MS) {
            finishRound({ timedOut: true });
          }
        }
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, ready, scopeAimControl]);

  const focusZoomBoost = scope
    ? scopeFocusZoomBoost(scope.scope, focusHeld, scopeZoomOnFocus)
    : 1;
  const focusViewportBoost = scope
    ? scopeFocusViewportBoost(scope.scope, focusHeld, scopeZoomOnFocus)
    : 1;
  const easyBoost = easy10x ? RANGE_EASY_ZERO_SCALE : 1;
  const targetScale =
    scope && shotGeom
      ? plateScopeImageScale(zoom, scope.scope, distanceM, shotGeom) *
        easyBoost
      : 1;
  const reticleScale = scope
    ? opticReticleImgScale(zoom, scope.scope, easy10x)
    : 1;
  targetScaleRef.current = targetScale;

  const sceneW = shotGeom
    ? shotGeom.nativeW * (100 / Math.max(0.05, plateWidthPct))
    : 0;
  const sceneH = sceneW / Math.max(0.25, landAspect);

  const remainingMs = Math.max(0, BLACKJACK_TIME_LIMIT_MS - elapsedUiMs);
  const nextPlateLabel = activePlate?.label ?? "—";
  const hudHint =
    progress.runPhase === "extras"
      ? `Ekstra BlackJack på 2″`
      : `Hint ${nextPlateLabel} (valgfri rekkefølge)`;

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
      <div className="blackjack-comp">
        <p className="intro-line">
          BlackJack Challenge krever rifle, scope, matchende kikkertmontasje og
          ammo i kit.
        </p>
        <button type="button" className="intro-button" onClick={onBack}>
          ← Tilbake
        </button>
      </div>
    );
  }

  if (phase === "lobby") {
    return (
      <div className="blackjack-comp">
        <header className="shop-header">
          <p className="intro-line intro-gift">BlackJack Challenge</p>
          <p className="shop-row-note">
            2 minutter · ~{BLACKJACK_DISTANCE_YD} yd ({BLACKJACK_DISTANCE_M} m)
            · alle blinker aktive, valgfri rekkefølge. Hver blink 1× i frem-pass
            (1–6 = 21), så revers (42), deretter +21 per treff på 2″. Kortest tid
            ved poenglikhet.
          </p>
          <p className="shop-row-note">
            Charity-event à la Cortina Precision (~$100 / {BLACKJACK_ENTRY_FEE_NOK}{" "}
            kr). Ethical Hunter cold-bore på ~500 yd følger i en senere runde.
          </p>
          <p className="shop-row-note">
            Saldo {balance.toLocaleString("nb-NO")} kr · startavgift{" "}
            {BLACKJACK_ENTRY_FEE_NOK} kr
          </p>
        </header>

        <div className="blackjack-lobby-range">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BLACKJACK_LANDSCAPE_SRC}
            alt="Losby feltbane"
            className="blackjack-lobby-range-img"
            draggable={false}
          />
          <div className="blackjack-rack" aria-hidden>
            <span className="blackjack-yards-label">
              {BLACKJACK_DISTANCE_YD} yards
            </span>
            {lobbyRack.plates.map((p) => (
              <div
                key={p.index}
                className="blackjack-plate"
                style={plateStyle(p)}
              >
                <div className="blackjack-plate-face" />
              </div>
            ))}
          </div>
        </div>

        {lobbyHold ? (
          <div className="blackjack-hold-slip field-impact-hold-slip">
            <span className="field-impact-hold-slip-main">
              Holdkort · {lobbyHold.distanceM} m · Klikk {lobbyHold.elevLabel} ·{" "}
              {lobbyHold.windLabel}
            </span>
            <span className="field-impact-hold-slip-src">ballistikk</span>
          </div>
        ) : null}

        <div className="moa-comp-tiers">
          <p className="range-setup-label">Premier (poeng)</p>
          <ul className="moa-comp-tier-list">
            {BLACKJACK_PAYOUT_TIERS.map((t) => (
              <li key={t.minScore}>
                {t.label}: {t.payoutNok.toLocaleString("nb-NO")} kr
              </li>
            ))}
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
            Start ({BLACKJACK_ENTRY_FEE_NOK} kr)
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

  if (phase === "result" && result) {
    return (
      <div className="blackjack-comp">
        <header className="shop-header">
          <p className="intro-line intro-gift">BlackJack Challenge — resultat</p>
          <p className="shop-row-note">
            Poeng: <strong>{result.score}</strong>
            {" · "}
            Tid:{" "}
            <strong>{formatBlackjackElapsed(result.elapsedMs)}</strong>
            {result.timedOut ? " (tid ute)" : null}
            {result.tierLabel ? ` · ${result.tierLabel}` : " · ingen premie"}
          </p>
          <p className="shop-row-note">
            BlackJack ×{result.blackjacks} · {result.hits} treff ·{" "}
            {result.shotsFired} skudd
            {result.completedForward ? " · frem OK" : null}
            {result.completedReverse ? " · revers OK" : null}
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

        {result.hitLog.length > 0 ? (
          <ul className="field-impact-hit-log" aria-label="Treffliste">
            {result.hitLog.map((h, i) => (
              <li key={`${h.plateIndex}-${i}`}>
                #{i + 1} · {h.sizeInch}″ · +{h.pointsAwarded} ·{" "}
                {blackjackRunPhaseLabelNb(h.runPhase)} ·{" "}
                {h.xMm.toFixed(0)}/{h.yMm.toFixed(0)} mm
              </li>
            ))}
          </ul>
        ) : (
          <p className="shop-row-note">Ingen treff denne runden.</p>
        )}

        <div className="range-actions">
          <button
            type="button"
            className="intro-button"
            onClick={() => {
              setPhase("lobby");
              setResult(null);
              setHitLog([]);
              hitLogRef.current = [];
              setRack(null);
              setProgress(initialBlackjackProgress());
              progressRef.current = initialBlackjackProgress();
              setScoreUi(0);
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
    <div className="blackjack-comp blackjack-comp--live">
      <header className="shop-header">
        <p className="intro-line intro-gift">
          BlackJack · {scoreUi} poeng ·{" "}
          {formatBlackjackClock(remainingMs)}
        </p>
        <p className="shop-row-note">
          {hudHint} · {blackjackRunPhaseLabelNb(progress.runPhase)}
          {" · "}
          {rifle!.brand} {rifle!.name} · {selectedAmmo?.brand}{" "}
          {selectedAmmo?.name} · {ammoRemaining} igjen · {distanceM} m
        </p>
      </header>

      {holdCard ? (
        <div
          className="blackjack-hold-slip field-impact-hold-slip"
          aria-live="polite"
        >
          <span className="field-impact-hold-slip-main">
            Avstand {holdCard.distanceM} m · Klikk {holdCard.elevLabel} ·{" "}
            {holdCard.windLabel}
          </span>
          <span className="field-impact-hold-slip-src">
            ballistikk + dV/dT
          </span>
        </div>
      ) : null}

      <div className="scope-stage" tabIndex={0} ref={scopeStageRef}>
        <BarrelHeatBar
          className="range-barrel-heat"
          heat01={barrelHeat01}
        />
        <ScopeOpticFit>
        <MaybeScopeTube
          enabled={tubeMode}
          railsOnly={railsOnly}
          barLength={focusTriggerBarLength}
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
                  bipolar={illumBipolar}
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
            (tubeMode || railsOnly) && features.focusHold ? (
              <button
                type="button"
                className="range-side-rail range-side-rail--focus is-hold-control"
                aria-label="Hold for fokus (F)"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  beginFocus(performance.now());
                }}
                onPointerUp={() => endFocus("")}
                onPointerCancel={() => endFocus("")}
              >
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
              </button>
            ) : null
          }
          triggerRail={
            (tubeMode || railsOnly) && features.triggerTiming ? (
              <button
                type="button"
                className="range-side-rail range-side-rail--trigger is-hold-control"
                aria-label="Hold for avtrekk (Space)"
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  beginTrigger(performance.now());
                }}
                onPointerUp={() => {
                  if (triggerRef.current.held) {
                    releaseTrigger(performance.now());
                  }
                }}
                onPointerCancel={() => {
                  if (triggerRef.current.held) {
                    abortTrigger("Avtrekk avbrutt.");
                  }
                }}
              >
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
              </button>
            ) : null
          }
        >
        <div className="scope-stage-optic-row">
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
                  {shotGeom && rack ? (
                    <div
                      className="hunt-scope-scene"
                      style={{ width: sceneW, height: sceneH }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="hunt-scope-landscape"
                        src={BLACKJACK_LANDSCAPE_SRC}
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
                      {rack.plates.map((p) => (
                        <div
                          key={p.index}
                          className={plateClassName(
                            p,
                            neededIndices,
                            hitIndices,
                            swingPlateIndex === p.index,
                          )}
                          style={plateStyle(p)}
                        >
                          <div className="blackjack-plate-face">
                            {paintChips
                              .filter((c) => c.plateIndex === p.index)
                              .map((c) => (
                                <span
                                  key={c.id}
                                  className="blackjack-paint-chip"
                                  style={paintChipStyle(c)}
                                />
                              ))}
                          </div>
                        </div>
                      ))}
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
                ref={scopeReticleOffsetRef}
                className="scope-reticle-offset"
              >
                <ScopeReticle
                  scope={scope!.scope}
                  zoom={zoom}
                  imgScale={reticleScale}
                  illumination={
                    (tubeMode ? illumOn : true) ? illumDecoded.intensity : 0
                  }
                  illuminationColor={illumDecoded.color}
                />
              </div>
              </ScopeFocusZoom>
              {impactFlash ? (
                <div className="blackjack-flash" aria-live="assertive">
                  {flashLabel}
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
          </div>
        </div>
        </MaybeScopeTube>
        </ScopeOpticFit>

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
                bipolar={illumBipolar}
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
