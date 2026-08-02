"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
} from "react";
import {
  caliberBulletDiameterMm,
  clampScopeZoom,
  combinedDispersionMoa,
  computeWeaponCalmFactor,
  effectiveCalmWithFocus,
  ensureAmmoAffinity,
  fatigueDispersionFactor,
  focusCalmMultiplier,
  focusPhase,
  focusRemainingMs,
  focusShouldAbort,
  rollTriggerTargetMs,
  sampleRealSystemGroupMoa,
  sampleShotFromPoa,
  triggerPullErrorFactor,
  triggerPullOffsetMm,
  wobbleAmplitudeMm,
  TRIGGER_PERFECT_BAND_MS,
} from "@/lib/range/precision";
import {
  DEFAULT_REALISM_CONTROLS,
  getRealismControls,
  subscribeRealismControls,
} from "@/lib/range/realismControls";
import {
  computeFeltRecoil,
  recoilKickScale,
  shoulderedWeaponWeightKg,
} from "@/lib/range/recoil";
import { resolveBulletWeightGrains, isSilentSuppressedShot } from "@/lib/ammo/spec";
import {
  advancePulsePhase,
  formatPulseBpm,
  pulseKickOffset,
  pulseVerticalAmpMm,
} from "@/lib/hunt/pulse";
import { opticReticleImgScale } from "@/lib/range/scopeViewScale";
import {
  rifleSpecWithCustomBarrel,
  barrelV0FactorForRifle,
  type InstalledCustomBarrel,
} from "@/lib/customs/customBarrel";
import {
  sampleTrajectory,
} from "@/lib/ballistics/trajectory";
import {
  exactBallisticHold,
  formatHoldClicks,
  type BallisticHoldSolution,
} from "@/lib/ballistics/solver";
import { ammoAtPowderTemp } from "@/lib/ballistics/powderTemp";
import { kestrelSolveAmmo, type KestrelGunProfile } from "@/lib/ballistics/kestrelProfile";
import {
  isRealDataActive,
  realLoadForRifle,
  interpolateRealDropCm,
  displayAmmoBrandName,
  type RealLoadProfile,
} from "@/lib/ballistics/realLoad";
import type { RangeShotAudioOptions } from "@/lib/range/audio";
import { ScopeReticle } from "@/components/range/ScopeReticle";
import { ScopeOpticFit } from "@/components/range/ScopeOpticFit";
import { ScopeFocusZoom } from "@/components/range/ScopeFocusZoom";
import {
  ScopeElevationDial,
  ScopeTurrets,
  ScopeWindageDial,
  turretNudgeMoved,
  type ScopeHudTab,
} from "@/components/range/ScopeTurrets";
import { ScopeZoomRing } from "@/components/range/ScopeZoomRing";
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
  showBubbleLevelHud,
} from "@/lib/range/cant";
import type { GameRealism } from "@/lib/optics/turretStyle";
import {
  realismAutoTurretDial,
  realismDispersionMult,
  realismLevelKey,
  realismNerveRateMult,
} from "@/lib/range/realismGameplay";
import { useTriggerBarPaint } from "@/components/range/useTriggerBarPaint";
import { useFocusBarPaint } from "@/components/range/useFocusBarPaint";
import { HuntShotConditions } from "@/components/hunt/HuntShotConditions";
import type { HuntRangeSource } from "@/components/hunt/HuntShotConditions";
import { KestrelFasitView } from "@/components/hunt/KestrelFasitView";
import { WindMeterView } from "@/components/hunt/WindMeterView";
import { HuntShotAarView } from "@/components/hunt/HuntShotAarView";
import { useRangeAudio } from "@/components/range/useRangeAudio";
import {
  angularMmAtDistance,
  clampElevationTurretMm,
  clampTurretMm,
  dopeClicksToMmAt100,
  effectiveZeroOffsetMm,
  getInventoryQty,
  mmAt100ToClicks,
  formatDopeElevationClicks,
  formatDopeWindageClicks,
  zeroingKey,
  type DopeCardEntry,
  type InventoryEntry,
  type ShotLogEntry,
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
import {
  isAmmoItem,
  isBipodItem,
  isLrfItem,
  isMiscItem,
  isMountItem,
  isRifleItem,
  isScopeItem,
  isStockItem,
  type ShopItem,
} from "@/lib/shop/types";
import { miscKitWeaponCalmGrams } from "@/lib/misc/spec";
import { mmAt100ToScopeClicks } from "@/lib/optics/clicks";
import {
  birdMmToNativePx,
  birdNativePxPerMm,
  birdScopeImageScale,
  birdShotGeom,
  birdVitalOffsetFromImageCenterPx,
  classifyHuntShot,
  formatHuntImpactOffsetMm,
  HEADSHOT_AAR_TEXT,
  NECK_LUCKY_KILL_TEXT,
  SCOPE_VIEWPORT_REF_PX,
  isShotCamItemId,
  type HuntAdminShotDebug,
  type HuntShotResult,
} from "@/lib/hunt/shoot";
import {
  resolveBirdSpriteIdForNerve,
  type BirdSpriteId,
} from "@/lib/hunt/birdSprites";
import {
  findBirdNearLandscapePoint,
  type BirdVisualPlacement,
} from "@/lib/hunt/birds";
import {
  BAGRIDER_REST_CALM_MULT,
  bipodSpecForShootRest,
  restProvidesWeaponCalm,
  type HuntShootRest,
} from "@/lib/hunt/shootRest";
import { formatHuntClock } from "@/lib/hunt/travel";
import {
  aimMmDeltaFromPointerDrag,
  clampAimMm,
  SCOPE_AIM_TAP_FOV_FRAC,
  SCOPE_AIM_TAP_MM,
  scopeAimHoldMult,
} from "@/lib/range/scopePointerAim";
import {
  DEFAULT_SCOPE_AIM_CONTROL,
  scopeAimPaintMm,
  scopeMoveReticleActive,
  type ScopeAimControl,
} from "@/lib/range/scopeAimControl";
import {
  ENCOUNTER_NERVE,
  ENVIRO_TIME_FACTOR,
  tickEncounterNerve,
} from "@/lib/game/nervousness";
import { BirdNerveBar } from "@/components/hunt/BirdNerveBar";

type HuntShootViewProps = {
  /** True ballistic distance (bird). */
  trueDistanceM: number;
  /** What LRF showed (player dials from this). */
  measuredDistanceM: number;
  /** LRF reading vs Aware Shoot estimate. */
  rangeSource?: HuntRangeSource;
  /**
   * Exact BDX+Kestrel hold from perfect zero (null if not equipped).
   * Shown as fasit — player dials turrets manually.
   */
  ballisticHold?: BallisticHoldSolution | null;
  /**
   * Kestrel (crosswind meter) in hunt kit — show Kestrel fasit tab.
   */
  hasKestrelInKit?: boolean;
  /**
   * Budget wind meter (Clas Ohlson) — «Vindmåler» tab, speed only.
   */
  hasWindMeterInKit?: boolean;
  windMeterErrorPercent?: number;
  windMeterBrand?: string;
  windMeterName?: string;
  /** True local crosswind (m/s, +from left) for this shot bearing. */
  crosswindMs?: number;
  /** Atmosphere density ratio from live temperature. */
  densityRatio?: number;
  /** Live air / powder temperature (°C) for dV/dT + Enviro. */
  temperatureC?: number;
  /** Forecast / værmelding temp for EL Range atmosphere. */
  forecastTemperatureC?: number;
  /** Shot bearing toward bird (for Kestrel LCD). */
  shotBearingDeg?: number;
  windFromDeg?: number;
  windSpeedMs?: number;
  clockMinutes: number;
  kitItems: ShopItem[];
  inventory: InventoryEntry[];
  ammoAffinities: Record<string, number>;
  zeroingProfiles: Record<string, ZeroingProfile>;
  dopeCard?: DopeCardEntry[];
  kestrelProfiles?: Record<string, KestrelGunProfile>;
  realLoadProfiles?: RealLoadProfile[];
  useRealDataInSimulation?: boolean;
  /** Persist DOPE after a hit (rifle×ammo×distance upsert). */
  onAddDope?: (entry: Omit<DopeCardEntry, "id" | "atMs">) => void;
  /**
   * Chronograph armed in Aware — log realized v0 + air temp to shotlog on fire.
   */
  chronoActive?: boolean;
  /**
   * Kestrel enviro measured in Aware — ballistics app auto-prefills wind/temp.
   * On shooting range (no Aware), omit / true when Kestrel is in kit.
   */
  kestrelEnviroActive?: boolean;
  /** Triggercam started in Aware — AAR replay after the shot. */
  triggercamActive?: boolean;
  /**
   * Admin PIN session — AAR after every shot (hit or miss) with aim/POA
   * markers and effect breakdown.
   */
  isAdmin?: boolean;
  /**
   * Aware rest choice. Bipod calm only when `"bipod"`; backpack uses
   * synthetic calm=20. Default `"none"` = no bipod/bag rest calm.
   */
  shootRest?: HuntShootRest;
  /** CB bagrider stacked on sekk/bipod (never alone). */
  shootBagriderActive?: boolean;
  /**
   * Turret dial / prep only — no live bird shot (from map Aware overview).
   */
  gunPrepOnly?: boolean;
  /**
   * Undiscovered birds on the landscape — gun-prep scan; F marks under reticle.
   */
  scanBirdPlacements?: BirdVisualPlacement[];
  /** Bird id locked with F in gun-prep — stay in scope until Aware. */
  scopeMarkedBirdId?: string | null;
  /** Gun-prep: reticle on bird + F → discover / open Aware engage. */
  onMarkBirdFromScope?: (info: {
    placement: BirdVisualPlacement;
    measuredDistanceM: number;
  }) => void;
  /** Persist chronograph row (hunt shot with Xero set up). */
  onLogSeries?: (entry: ShotLogEntry) => void;
  /** CB Customs bedding MOA delta (negative = tighter). */
  customsMoaDelta?: number;
  /** CB Customs calm multiplier (e.g. bagrider 1.15). */
  customsCalmMult?: number;
  /** Combined recoil-damping multiplier (suppressor dB × CB rear gear). */
  recoilDamping?: number;
  /** CB Customs trigger tuning — scale on bad-break POI (1 = stock, 0.5 = tuned). */
  customsTriggerPullScale?: number;
  /** Barrel wear multiplier on rifle MOA (1 = fresh … 2 = worn). */
  barrelWearScale?: number;
  /** Per-rifle CB Customs CNC blanks. */
  customBarrels?: Record<string, InstalledCustomBarrel>;
  onAffinitiesChange: (next: Record<string, number>) => void;
  onConsumeAmmo: (ammoId: string, rifleId?: string) => boolean;
  onEnsureZeroing: (
    rifleId: string,
    scopeId: string,
    ammoId: string,
  ) => ZeroingProfile;
  /** Hawke / budget mount: fixed ±2 click POI drift for this hunt. */
  mountHuntDriftMm?: { xMm: number; yMm: number };
  /** Hunt BODY fatigue 0–1 (1 = exhausted). Cuts calm → more weapon shake. */
  physicalFatigue?: number;
  /** Hunt MIND fatigue 0–1 (1 = exhausted). Widens MOA envelope up to 2×. */
  mentalFatigue?: number;
  /** Heart rate BPM (60–180) — marked vertical gun shake. */
  heartRateBpm?: number;
  /** Same horizontal flip as spotting (placement.flip). */
  birdFlip?: boolean;
  /** Topp/target pair chosen at spot time. */
  birdSpriteId?: BirdSpriteId;
  /** Spotting landscape behind the bird (same photo as SpotView). */
  landscapeSrc?: string;
  /** Bird position on the spot photo (%, same as SpotView placement). */
  landscapeFocusX?: number;
  landscapeFocusY?: number;
  /** Bird width as % of landscape (same as SpotView placement.widthPct). */
  landscapeBirdWidthPct?: number;
  /** Kit camo bird-spot factor (Aware / Enviro nerve). */
  camoSneakPct?: number;
  /** Bird nerve carried from Aware (0–cap). */
  birdNerve?: number;
  onAbort: () => void;
  onShotResult: (result: HuntShotResult) => void;
  /** Advance hunt clock (Enviro tab runs at 5×). */
  onGameSeconds?: (sec: number) => void;
  /** Bird flushed when combined nerve (distance/camo) hits threshold. */
  onBirdFlushedFromWait?: () => void;
  /** Live nerve for global HUD BIRD bar (0–cap). */
  onNerveChange?: (nerve: number) => void;
  /**
   * Leave shoot back to Aware with current nerve (Back to Aware).
   * Prefer this over plain abort when returning to the stalk map.
   */
  onBackToAware?: (nerve: number) => void;
  /**
   * Turret dial carried across engages in the same hunt (mm @ 100 m).
   * When set, restores instead of resetting to zero.
   */
  initialSessionZeroMm?: { x: number; y: number } | null;
  /** Persist dial changes for the rest of this hunt. */
  onSessionZeroChange?: (xMm: number, yMm: number) => void;
  /**
   * Parallax / illumination drums sticky across engages in the same hunt.
   * Null → defaults: 100 m focus, illumination off.
   */
  initialSideDrums?: { parallaxFocusM: number; reticleIllum: number } | null;
  /** Persist side-drum changes for the rest of this hunt. */
  onSideDrumsChange?: (parallaxFocusM: number, reticleIllum: number) => void;
  /**
   * medium = classic HUD dials; high = tube-mounted realistic turrets.
   */
  realism?: GameRealism;
  /** Move target under reticle, or reticle over a fixed target. */
  scopeAimControl?: ScopeAimControl;
};

type AimKeys = {
  up: number | null;
  down: number | null;
  left: number | null;
  right: number | null;
  /** Q — counterclockwise (bubble → right). */
  ccw: number | null;
  /** E — clockwise (bubble → left). */
  cw: number | null;
};

const AIM_SPEED_MM_PER_SEC = 44;
/** Landscape acquire: fraction of scope FOV panned per second (at hold start). */
const LANDSCAPE_AIM_FOV_FRAC = 0.36;
/**
 * While holding F: fine reticle placement for continuous pan.
 * Tap step uses {@link FOCUS_AIM_TAP_MULT} instead.
 */
const FOCUS_AIM_SPEED_MULT = 0.14;
/** Arrow tap while F held — fraction of the unfocused tap step. */
const FOCUS_AIM_TAP_MULT = 0.15;
const DEFAULT_SCOPE_ZOOM = 12;
/** Side-focus default when no prior engagement this hunt. */
const DEFAULT_PARALLAX_FOCUS_M = 100;
/** Illumination default — off (black etched). */
const DEFAULT_RETICLE_ILLUM = 0;

/** Aim (mm from vital) that puts landscape centre under the reticle. */
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
  const sceneW = opts.nativeW * (100 / Math.max(0.05, opts.widthPct));
  const sceneH = sceneW / Math.max(0.25, opts.landAspect);
  const ox = (opts.birdXPct / 100) * sceneW - sceneW / 2;
  const oy = (opts.birdYPct / 100) * sceneH - sceneH / 2;
  const pxPerMm = opts.nativeH / opts.spriteHeightMm;
  return {
    x: -(ox + opts.vitalOff.x) / pxPerMm,
    y: -(oy + opts.vitalOff.y) / pxPerMm,
  };
}

/** Landscape % under optical centre — inverse of {@link paintScopeWorld} pan. */
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

/**
 * Hunt shoot: same scope loop as the range, tiurtopp1 as target,
 * vital zones, ballistics at true distance.
 */
export function HuntShootView({
  trueDistanceM,
  measuredDistanceM,
  rangeSource = "estimated",
  ballisticHold = null,
  hasKestrelInKit = false,
  hasWindMeterInKit = false,
  windMeterErrorPercent = 18,
  windMeterBrand,
  windMeterName,
  crosswindMs = 0,
  densityRatio = 1,
  temperatureC = 15,
  forecastTemperatureC,
  shotBearingDeg = 0,
  windFromDeg = 0,
  windSpeedMs = 0,
  clockMinutes,
  kitItems,
  inventory,
  ammoAffinities,
  zeroingProfiles,
  dopeCard = [],
  kestrelProfiles = {},
  realLoadProfiles = [],
  useRealDataInSimulation = false,
  onAddDope,
  chronoActive = false,
  kestrelEnviroActive = true,
  triggercamActive = false,
  isAdmin = false,
  shootRest = "none",
  shootBagriderActive = false,
  gunPrepOnly = false,
  scanBirdPlacements = [],
  scopeMarkedBirdId = null,
  onMarkBirdFromScope,
  onLogSeries,
  customsMoaDelta = 0,
  customsCalmMult = 1,
  recoilDamping = 1,
  customsTriggerPullScale = 1,
  barrelWearScale = 1,
  customBarrels = {},
  onAffinitiesChange,
  onConsumeAmmo,
  onEnsureZeroing,
  mountHuntDriftMm = { xMm: 0, yMm: 0 },
  physicalFatigue = 0,
  mentalFatigue = 0,
  heartRateBpm = 60,
  birdFlip = false,
  birdSpriteId = "tiur-1",
  landscapeSrc,
  landscapeFocusX = 50,
  landscapeFocusY = 50,
  landscapeBirdWidthPct,
  camoSneakPct = 0,
  birdNerve = 0,
  onAbort,
  onShotResult,
  onGameSeconds,
  onBirdFlushedFromWait,
  onNerveChange,
  onBackToAware,
  initialSessionZeroMm = null,
  onSessionZeroChange,
  initialSideDrums = null,
  onSideDrumsChange,
  realism = "medium",
  scopeAimControl = DEFAULT_SCOPE_AIM_CONTROL,
}: HuntShootViewProps) {
  const [nerveUi, setNerveUi] = useState(() =>
    Math.min(ENCOUNTER_NERVE.nerveCap, Math.max(0, birdNerve)),
  );
  const activeSpriteId = useMemo(
    () =>
      resolveBirdSpriteIdForNerve(
        birdSpriteId,
        nerveUi,
        ENCOUNTER_NERVE.flushThreshold,
      ),
    [birdSpriteId, nerveUi],
  );
  const shotGeom = useMemo(
    () => birdShotGeom(activeSpriteId),
    [activeSpriteId],
  );
  const mmToPx = (mm: number) => birdMmToNativePx(mm, shotGeom);
  const rifle = useMemo(
    () => kitItems.find(isRifleItem) ?? null,
    [kitItems],
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

  const ready = !!(rifle && scope && ammoOptions.length > 0);

  const [ammoId, setAmmoId] = useState(ammoOptions[0]?.id ?? "");
  const [zoom, setZoom] = useState(DEFAULT_SCOPE_ZOOM);
  const restoreTurrets = initialSessionZeroMm != null;
  const [sessionZeroXMm, setSessionZeroXMm] = useState(() =>
    initialSessionZeroMm
      ? clampTurretMm(Math.round(initialSessionZeroMm.x))
      : 0,
  );
  const [sessionZeroYMm, setSessionZeroYMm] = useState(() =>
    initialSessionZeroMm
      ? clampElevationTurretMm(
          Math.round(initialSessionZeroMm.y),
          scope?.scope,
        )
      : 0,
  );
  /**
   * Side drums sticky across engages (same as elevation/windage).
   * Defaults when nothing saved yet: 100 m / illumination off.
   */
  const [parallaxFocusM, setParallaxFocusM] = useState(() => {
    const saved = initialSideDrums?.parallaxFocusM;
    return saved != null && Number.isFinite(saved)
      ? saved
      : DEFAULT_PARALLAX_FOCUS_M;
  });
  const [reticleIllum, setReticleIllum] = useState(() => {
    const saved = initialSideDrums?.reticleIllum;
    if (saved == null || !Number.isFinite(saved)) return DEFAULT_RETICLE_ILLUM;
    return Math.max(0, Math.min(1, saved));
  });
  const realismControls = useSyncExternalStore(
    subscribeRealismControls,
    getRealismControls,
    () => DEFAULT_REALISM_CONTROLS,
  );
  const realismLevel = realismLevelKey(realism);
  const features = realismControls.features[realismLevel];
  const isRealismLow = realismLevel === "low";
  const params = realismControls.params;
  const tubeMode = features.tubeTurrets;
  const railsOnly =
    !tubeMode && (features.focusHold || features.triggerTiming);
  const blurPx = features.parallaxBlur
    ? focusBlurPx(trueDistanceM, parallaxFocusM) * params.parallaxBlurMult
    : 0;
  const illumOn = features.illumination;
  const illumDecoded = decodeReticleIllumination(
    reticleIllum,
    scope?.scope,
  );
  const illumBipolar = scopeIlluminationBipolar(scope?.scope);
  const featuresRef = useRef(features);
  featuresRef.current = features;
  const triggerBarMsRef = useRef(params.triggerBarMs);
  triggerBarMsRef.current = params.triggerBarMs;
  const focusAbortMsRef = useRef(params.focusAbortMs);
  focusAbortMsRef.current = params.focusAbortMs;
  const [status, setStatus] = useState(
    restoreTurrets
      ? "Tårn som sist · F = fokus+merke · slipp Space på merket."
      : ballisticHold
        ? `Kestrel AB fasit: ${formatHoldClicks(ballisticHold)} — skru tårnene · F = fokus+merke · slipp Space på merket.`
        : "Skru elevation + windage · F = fokus+merke · slipp Space på merket.",
  );
  const onSessionZeroChangeRef = useRef(onSessionZeroChange);
  onSessionZeroChangeRef.current = onSessionZeroChange;
  const onSideDrumsChangeRef = useRef(onSideDrumsChange);
  onSideDrumsChangeRef.current = onSideDrumsChange;
  const [hudTab, setHudTab] = useState<ScopeHudTab>("shooter");
  const hudTabRef = useRef(hudTab);
  hudTabRef.current = hudTab;
  const birdNerveRef = useRef(
    Math.min(ENCOUNTER_NERVE.nerveCap, Math.max(0, birdNerve)),
  );
  const camoSneakPctRef = useRef(camoSneakPct);
  camoSneakPctRef.current = camoSneakPct;
  const onGameSecondsRef = useRef(onGameSeconds);
  onGameSecondsRef.current = onGameSeconds;
  const onBirdFlushedFromWaitRef = useRef(onBirdFlushedFromWait);
  onBirdFlushedFromWaitRef.current = onBirdFlushedFromWait;
  const onNerveChangeRef = useRef(onNerveChange);
  onNerveChangeRef.current = onNerveChange;
  const onBackToAwareRef = useRef(onBackToAware);
  onBackToAwareRef.current = onBackToAware;
  const [focusUi, setFocusUi] = useState<{
    phase: "idle" | "settling" | "focused" | "fatigued";
    remainingMs: number;
  }>({ phase: "idle", remainingMs: 0 });
  /** Drives focus-zoom re-render when F is held. */
  const [focusHeld, setFocusHeld] = useState(false);
  const [triggerUi, setTriggerUi] = useState({
    pending: false,
    targetPct: 0,
  });
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
  const frozenBaseAimRef = useRef({ x: 0, y: 0 });
  const aimControlRef = useRef<ScopeAimControl>(scopeAimControl);
  aimControlRef.current = scopeAimControl;
  const targetScaleRef = useRef(1);
  const focusZoomBoostRef = useRef(1);
  const vitalOffRef = useRef({ x: 0, y: 0 });
  const geomRef = useRef(shotGeom);
  geomRef.current = shotGeom;
  /** Bird seat on landscape (%, widthPct) — same as SpotView placement. */
  const birdSeatRef = useRef({
    x: landscapeFocusX,
    y: landscapeFocusY,
    widthPct: landscapeBirdWidthPct ?? 2,
  });
  birdSeatRef.current = {
    x: landscapeFocusX,
    y: landscapeFocusY,
    widthPct: Math.max(0.05, landscapeBirdWidthPct ?? 2),
  };
  /** Landscape aspect (w/h); updated on image load. */
  const [landAspect, setLandAspect] = useState(4 / 3);
  const landAspectRef = useRef(landAspect);
  landAspectRef.current = landAspect;
  const landscapeSrcRef = useRef(landscapeSrc);
  landscapeSrcRef.current = landscapeSrc;
  const gunPrepOnlyRef = useRef(gunPrepOnly);
  gunPrepOnlyRef.current = gunPrepOnly;
  const scanBirdPlacementsRef = useRef(scanBirdPlacements);
  scanBirdPlacementsRef.current = scanBirdPlacements;
  const onMarkBirdFromScopeRef = useRef(onMarkBirdFromScope);
  onMarkBirdFromScopeRef.current = onMarkBirdFromScope;
  const [recoilActive, setRecoilActive] = useState(false);
  const [fired, setFired] = useState(false);
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
  const [lastImpact, setLastImpact] = useState<{
    xMm: number;
    yMm: number;
    diameterMm: number;
  } | null>(null);
  const [replay, setReplay] = useState<HuntShotResult | null>(null);
  const [adminDebug, setAdminDebug] = useState<HuntAdminShotDebug | null>(
    null,
  );

  // Shoot HUD: same still-nerve rate as Aware (real seconds). Enviro only speeds the clock.
  useEffect(() => {
    if (fired || gunPrepOnly) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const realSec = Math.min(0.5, (now - last) / 1000);
      last = now;
      if (realSec <= 0) return;
      if (hudTabRef.current === "enviro") {
        onGameSecondsRef.current?.(realSec * ENVIRO_TIME_FACTOR);
      }
      const tick = tickEncounterNerve(birdNerveRef.current, realSec, {
        distanceM: distanceRef.current,
        isMoving: false,
        moveHoldSec: 0,
        camoSneakPct: camoSneakPctRef.current,
        nerveRateMult: realismNerveRateMult(realism),
      });
      birdNerveRef.current = tick.nerve;
      setNerveUi(tick.nerve);
      onNerveChangeRef.current?.(tick.nerve);
      if (tick.flushes) {
        onBirdFlushedFromWaitRef.current?.();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [fired, gunPrepOnly, realism]);

  function leaveToAware() {
    if (firedRef.current) return;
    const nerve = birdNerveRef.current;
    if (onBackToAwareRef.current) {
      onBackToAwareRef.current(nerve);
      return;
    }
    onAbort();
  }

  const hasTriggercam =
    triggercamActive && kitItems.some((i) => isShotCamItemId(i.id));
  const shotCamInKit = kitItems.some((i) => isShotCamItemId(i.id));
  const zoomRange = scope
    ? scopeEffectiveZoomRange(scope.scope, shotCamInKit)
    : { minZoom: 1, maxZoom: 1 };

  const keysRef = useRef<AimKeys>({
    up: null,
    down: null,
    left: null,
    right: null,
    ccw: null,
    cw: null,
  });
  const aimRef = useRef({ x: 0, y: 0 });
  const hasPannedRef = useRef(false);
  const aimDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const [aimDragging, setAimDragging] = useState(false);
  const wobbleRef = useRef({ x: 0, y: 0 });
  const distanceRef = useRef(trueDistanceM);
  const crosswindRef = useRef(crosswindMs);
  const firedRef = useRef(false);
  const wobblePhase = useRef({ a: Math.random() * 10, b: Math.random() * 10 });
  /** Integrated beat phase (cycles) — rate = BPM/60 so it matches the pulse meter. */
  const pulsePhaseRef = useRef(Math.random());
  const weaponCalmRef = useRef(1);
  const fatigueRef = useRef({
    physicalFatigue: physicalFatigue,
    mentalFatigue: mentalFatigue,
  });
  const heartRateBpmRef = useRef(heartRateBpm);
  const shootRestRef = useRef(shootRest);
  const shootBagriderRef = useRef(shootBagriderActive);
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
  const playShotRef = useRef<
    (opts: boolean | RangeShotAudioOptions) => void
  >(() => {});
  const consumeAmmoRef = useRef(onConsumeAmmo);
  const barrelWearScaleRef = useRef(barrelWearScale);
  const recoilClearRef = useRef<number | null>(null);

  const { playShot } = useRangeAudio({ enabled: true, ambient: false });

  const selectedAmmo = ammoOptions.find((a) => a.id === ammoId) ?? null;
  const kitIds = useMemo(() => kitItems.map((i) => i.id), [kitItems]);
  const inventoryItemIds = useMemo(
    () => inventory.map((e) => e.itemId),
    [inventory],
  );
  const realLoad = useMemo(
    () => realLoadForRifle(realLoadProfiles, rifle?.id),
    [realLoadProfiles, rifle],
  );
  const realSolveArg = useMemo(
    () => ({
      active: isRealDataActive({
        useRealDataInSimulation,
        kitIds,
        inventoryItemIds,
        realLoad,
        ammoId: selectedAmmo?.id,
      }),
      profile: realLoad,
    }),
    [
      useRealDataInSimulation,
      kitIds,
      inventoryItemIds,
      realLoad,
      selectedAmmo?.id,
    ],
  );
  const ballisticsAmmo = useMemo(() => {
    if (!selectedAmmo) return null;
    return kestrelSolveAmmo(
      selectedAmmo.ammo,
      selectedAmmo.id,
      kestrelProfiles,
      realSolveArg,
    );
  }, [selectedAmmo, kestrelProfiles, realSolveArg]);
  const ballisticsAmmoRef = useRef(ballisticsAmmo);
  ballisticsAmmoRef.current = ballisticsAmmo;

  useEffect(() => {
    if (!realismAutoTurretDial(realism)) return;
    if (fired || gunPrepOnly || !scope || !selectedAmmo || !ballisticsAmmo) return;
    const hold = exactBallisticHold(
      ballisticsAmmo.ammo,
      measuredDistanceM,
      crosswindMs,
      {
        densityRatio,
        powderTempC: temperatureC,
        dvDtMpsPerC: ballisticsAmmo.dvDtMpsPerC,
        cantDeg: liveCantDeg(),
      },
    );
    setSessionZeroXMm(clampTurretMm(Math.round(hold.dialXMmAt100)));
    setSessionZeroYMm(
      clampElevationTurretMm(Math.round(hold.dialYMmAt100), scope.scope),
    );
  }, [
    realism,
    fired,
    gunPrepOnly,
    scope,
    selectedAmmo,
    ballisticsAmmo,
    measuredDistanceM,
    crosswindMs,
    densityRatio,
    temperatureC,
    cantDeg,
  ]);

  const ammoRemaining = selectedAmmo
    ? getInventoryQty(inventory, selectedAmmo.id)
    : 0;
  const comboKey =
    rifle && scope && selectedAmmo
      ? zeroingKey(rifle.id, scope.id, selectedAmmo.id)
      : null;
  const zeroProfile = comboKey ? zeroingProfiles[comboKey] ?? null : null;
  const effectiveZero = zeroProfile
    ? (() => {
        const z = effectiveZeroOffsetMm(
          zeroProfile,
          sessionZeroXMm,
          sessionZeroYMm,
          trueDistanceM,
        );
        return {
          xMm:
            z.xMm +
            angularMmAtDistance(mountHuntDriftMm.xMm, trueDistanceM),
          yMm:
            z.yMm +
            angularMmAtDistance(mountHuntDriftMm.yMm, trueDistanceM),
        };
      })()
    : {
        xMm:
          angularMmAtDistance(sessionZeroXMm, trueDistanceM) +
          angularMmAtDistance(mountHuntDriftMm.xMm, trueDistanceM),
        yMm:
          angularMmAtDistance(sessionZeroYMm, trueDistanceM) +
          angularMmAtDistance(mountHuntDriftMm.yMm, trueDistanceM),
      };

  const calmFactor = useMemo(() => {
    const bipodSpec = bipodSpecForShootRest(shootRest, {
      kitBipod: bipod?.bipod,
    });
    const base = computeWeaponCalmFactor({
      hasBipod: restProvidesWeaponCalm(shootRest) && !!bipodSpec,
      bipod: bipodSpec,
      suppressorWeightGrams: suppressor?.weightGrams,
      extraCalmGrams: miscKitWeaponCalmGrams(
        kitItems.filter(isMiscItem).map((i) => i.misc),
        !!suppressor,
      ),
      customsCalmMult,
    });
    const bagriderOn =
      shootBagriderActive &&
      (shootRest === "backpack" || shootRest === "bipod");
    return bagriderOn ? base * BAGRIDER_REST_CALM_MULT : base;
  }, [
    shootRest,
    shootBagriderActive,
    bipod,
    suppressor,
    kitItems,
    customsCalmMult,
  ]);

  useEffect(() => {
    weaponCalmRef.current = calmFactor;
  }, [calmFactor]);

  const feltRecoil = useMemo(() => {
    const weaponKg =
      rifle != null
        ? shoulderedWeaponWeightKg({
            rifleGrams: rifle.weightGrams,
            scopeGrams: scope?.weightGrams,
            mountGrams: mount?.weightGrams,
            suppressorGrams: suppressor?.weightGrams,
            bipodGrams:
              shootRest === "bipod" ? bipod?.weightGrams : 0,
          })
        : null;
    const grains =
      selectedAmmo != null
        ? resolveBulletWeightGrains(
            selectedAmmo.ammo,
            `${selectedAmmo.brand} ${selectedAmmo.name}`,
          )
        : null;
    const v0 =
      selectedAmmo != null && rifle != null
        ? selectedAmmo.ammo.v0 *
          barrelV0FactorForRifle(rifle.id, customBarrels?.[rifle.id])
        : null;
    return computeFeltRecoil({
      weaponCalm: calmFactor,
      recoilDamping,
      fatigue: { physicalFatigue },
      bulletWeightGrains: grains,
      v0Mps: v0,
      weaponWeightKg: weaponKg,
    });
  }, [
    calmFactor,
    recoilDamping,
    physicalFatigue,
    rifle,
    scope,
    mount,
    suppressor,
    bipod,
    shootRest,
    selectedAmmo,
    customBarrels,
  ]);
  const recoilKick = recoilKickScale(feltRecoil, realism);
  useEffect(() => {
    fatigueRef.current = { physicalFatigue, mentalFatigue };
  }, [physicalFatigue, mentalFatigue]);
  useEffect(() => {
    heartRateBpmRef.current = heartRateBpm;
  }, [heartRateBpm]);
  useEffect(() => {
    shootRestRef.current = shootRest;
  }, [shootRest]);
  useEffect(() => {
    shootBagriderRef.current = shootBagriderActive;
  }, [shootBagriderActive]);
  useEffect(() => {
    distanceRef.current = trueDistanceM;
  }, [trueDistanceM]);
  useEffect(() => {
    crosswindRef.current = crosswindMs;
  }, [crosswindMs]);
  useEffect(() => {
    playShotRef.current = playShot;
  }, [playShot]);
  useEffect(() => {
    consumeAmmoRef.current = onConsumeAmmo;
  }, [onConsumeAmmo]);
  useEffect(() => {
    barrelWearScaleRef.current = barrelWearScale;
  }, [barrelWearScale]);

  const densityRef = useRef(densityRatio);
  useEffect(() => {
    densityRef.current = densityRatio;
  }, [densityRatio]);
  const powderTempRef = useRef(temperatureC);
  useEffect(() => {
    powderTempRef.current = temperatureC;
  }, [temperatureC]);

  useEffect(() => {
    onSessionZeroChangeRef.current?.(sessionZeroXMm, sessionZeroYMm);
  }, [sessionZeroXMm, sessionZeroYMm]);
  useEffect(() => {
    onSideDrumsChangeRef.current?.(parallaxFocusM, reticleIllum);
  }, [parallaxFocusM, reticleIllum]);
  useEffect(() => {
    if (!rifle || !scope || !selectedAmmo) return;
    onEnsureZeroing(rifle.id, scope.id, selectedAmmo.id);
  }, [rifle, scope, selectedAmmo, onEnsureZeroing]);

  useEffect(() => {
    if (scope) {
      setZoom(clampScopeZoom(DEFAULT_SCOPE_ZOOM, zoomRange));
    }
  }, [scope, zoomRange.minZoom, zoomRange.maxZoom]);

  useEffect(() => {
    setZoom((z) => clampScopeZoom(z, zoomRange));
  }, [zoomRange.minZoom, zoomRange.maxZoom]);

  fireShotRef.current = () => {
    if (gunPrepOnly) {
      setStatus(
        scopeMarkedBirdId
          ? "Fugl merket — fokus og avtrekk er aktive."
          : "Gun-prep — ingen skudd. Marker fugl med F, eller gå via LRF/Engage.",
      );
      return;
    }
    if (!ready || !rifle || !selectedAmmo || !scope || firedRef.current) return;
    if (getInventoryQty(inventory, selectedAmmo.id) <= 0) {
      setStatus("Tom for ammo.");
      return;
    }
    if (!consumeAmmoRef.current(selectedAmmo.id, rifle.id)) {
      setStatus("Tom for ammo.");
      return;
    }

    const { affinity, map, rolled } = ensureAmmoAffinity(
      ammoAffinities,
      rifle.id,
      selectedAmmo.id,
    );
    if (rolled) onAffinitiesChange(map);

    const usingReal = !!realSolveArg.active;
    const w = wobbleRef.current;
    const simAmmo = ballisticsAmmoRef.current?.ammo ?? selectedAmmo.ammo;
    const simDvDt = ballisticsAmmoRef.current?.dvDtMpsPerC;
    const dispersionInput = {
      rifle: rifleSpecWithCustomBarrel(rifle.rifle, customBarrels[rifle.id]),
      ammo: simAmmo,
      stock: stock?.stock,
      affinity,
      customsMoaDelta,
      barrelWearScale: barrelWearScaleRef.current,
      dispersionScale: usingReal
        ? 1
        : fatigueDispersionFactor(fatigueRef.current),
      envelopeMult: realismDispersionMult(realism),
      mirageFactor: usingReal ? 0 : undefined,
      // Measured real-load MV already includes this rifle's barrel.
      barrelV0Factor: usingReal
        ? 1
        : barrelV0FactorForRifle(rifle.id, customBarrels[rifle.id]),
    };
    let poa: { xMm: number; yMm: number };
    let seriesGroupEnvelopeMoa: number | null = null;
    let pullMm = { xMm: 0, yMm: 0 };
    let envelopeMoaAtFire = 0;
    const mindScale = usingReal
      ? 1
      : fatigueDispersionFactor(fatigueRef.current);
    if (usingReal) {
      poa = { xMm: aimRef.current.x, yMm: aimRef.current.y };
      const mean = simAmmo.systemGroupMoaOverride;
      const best = simAmmo.systemGroupMoaBest;
      if (
        mean != null &&
        best != null &&
        Number.isFinite(mean) &&
        Number.isFinite(best)
      ) {
        seriesGroupEnvelopeMoa = sampleRealSystemGroupMoa(mean, best);
      }
      envelopeMoaAtFire =
        seriesGroupEnvelopeMoa != null && seriesGroupEnvelopeMoa > 0
          ? seriesGroupEnvelopeMoa
          : combinedDispersionMoa(dispersionInput);
    } else {
      envelopeMoaAtFire = combinedDispersionMoa(dispersionInput);
      const pull = triggerPullOffsetMm(
        triggerPullRef.current * customsTriggerPullScale,
        envelopeMoaAtFire,
        distanceRef.current,
      );
      pullMm = pull;
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
        densityRatio: densityRef.current,
        powderTempC: powderTempRef.current,
        dvDtMpsPerC: simDvDt,
        seriesGroupEnvelopeMoa,
        skipMirage: usingReal,
      },
    );
    let dropMm = shot.dropBelowLosMm;
    if (usingReal && realLoad) {
      const tableCm = interpolateRealDropCm(realLoad, distanceRef.current);
      if (tableCm != null) {
        dropMm = tableCm * 10;
      }
    }
    // Spin is already in `shot`; add local wind drift separately.
    const hold = exactBallisticHold(
      simAmmo,
      distanceRef.current,
      crosswindRef.current,
      {
        densityRatio: densityRef.current,
        powderTempC: powderTempRef.current,
        dvDtMpsPerC: simDvDt,
        cantDeg: liveCantDeg(),
      },
    );
    const windageMm = shot.spinDriftMm + hold.windDriftMm;
    const scatterXMm = shot.xMm - poa.xMm - shot.spinDriftMm;
    const scatterYMm = shot.yMm - poa.yMm - shot.dropBelowLosMm;
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
    const canted = composeCantedImpactMm({
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
    const impact = {
      xMm:
        canted.xMm +
        angularMmAtDistance(mountHuntDriftMm.xMm, distanceRef.current),
      yMm:
        canted.yMm +
        angularMmAtDistance(mountHuntDriftMm.yMm, distanceRef.current),
      diameterMm: caliberBulletDiameterMm(selectedAmmo.ammo.caliber),
    };

    firedRef.current = true;
    setFired(true);
    setLastImpact(impact);
    const silentShot = isSilentSuppressedShot(
      !!suppressor,
      selectedAmmo.ammo,
    );
    playShotRef.current({
      hasSuppressor: !!suppressor,
      silent: silentShot,
      afterShot: false,
    });
    setRecoilActive(false);
    window.requestAnimationFrame(() => {
      setRecoilActive(true);
      if (recoilClearRef.current != null) {
        window.clearTimeout(recoilClearRef.current);
      }
      recoilClearRef.current = window.setTimeout(() => {
        setRecoilActive(false);
        recoilClearRef.current = null;
      }, 400);
    });

    const { kind, zone } = classifyHuntShot(
      impact.xMm,
      impact.yMm,
      selectedAmmo.ammo.damageFactor,
      Math.random,
      shotGeom,
      birdFlip,
    );
    const ammoLive = ammoAtPowderTemp(
      selectedAmmo.ammo,
      powderTempRef.current,
    );
    const impactVelocityMps = sampleTrajectory(
      ammoLive,
      distanceRef.current,
      { densityRatio: densityRef.current },
    ).velocityMps;
    const result: HuntShotResult = {
      kind,
      zone,
      xMm: impact.xMm,
      yMm: impact.yMm,
      trueDistanceM: distanceRef.current,
      measuredDistanceM,
      damageFactor: selectedAmmo.ammo.damageFactor,
      impactVelocityMps,
      ammoId: selectedAmmo.id,
      ammoLabel: `${selectedAmmo.brand} ${selectedAmmo.name}`,
      caliber: selectedAmmo.ammo.caliber,
      projectileType: selectedAmmo.ammo.projectileType,
      v0: ammoLive.v0,
      subsonic: !!selectedAmmo.ammo.subsonic,
      silentShot,
    };
    const pullFactor = triggerPullRef.current;
    const pullLabel =
      pullFactor <= 0
        ? "Rent avtrekk · "
        : pullFactor < 0.35
          ? "OK avtrekk · "
          : pullFactor < 0.7
            ? "Rykk i avtrekket · "
            : "Elendig avtrekk · ";
    // Auto-DOPE on hit: snapshot what you dialed at measured range.
    let dopeNote = "";
    if (
      onAddDope &&
      rifle &&
      scope &&
      (kind === "instant_kill" ||
        kind === "vital_kill" ||
        kind === "ettersok")
    ) {
      onAddDope({
        rifleId: rifle.id,
        scopeId: scope.id,
        ammoId: selectedAmmo.id,
        ammoLabel: `${selectedAmmo.brand} ${selectedAmmo.name}`,
        distanceM: Math.round(measuredDistanceM),
        elevationClicks: mmAt100ToClicks(sessionZeroYMm),
        windageClicks: mmAt100ToClicks(sessionZeroXMm),
      });
      dopeNote = ` · DOPE @ ${Math.round(measuredDistanceM)} m`;
    }
    let chronoNote = "";
    if (chronoActive && onLogSeries && rifle && scope && Number.isFinite(shot.v0)) {
      const entry: ShotLogEntry = {
        id: `hunt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        atMs: Date.now(),
        rifleId: rifle.id,
        scopeId: scope.id,
        ammoId: selectedAmmo.id,
        rifleLabel: `${rifle.brand} ${rifle.name}`,
        scopeLabel: `${scope.brand} ${scope.name}`,
        ammoLabel: `${selectedAmmo.brand} ${selectedAmmo.name} (${selectedAmmo.ammo.caliber})`,
        distanceM: Math.round(distanceRef.current),
        shotCount: 1,
        extremeSpreadMm: 0,
        groupMoa: 0,
        meanRadiusMm: 0,
        poiXMm: impact.xMm,
        poiYMm: impact.yMm,
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
        chronoV0Mps: [shot.v0],
        chronoTemperatureC: powderTempRef.current,
        chronoSource: "field",
      };
      onLogSeries(entry);
      chronoNote = ` · Xero ${shot.v0.toFixed(0)} m/s @ ${powderTempRef.current.toFixed(0)}°C`;
    }
    setStatus(
      (kind === "instant_kill"
        ? zone === "head"
          ? pullLabel + "Headshot — Pink Mist!"
          : zone === "neck"
            ? pullLabel +
              "Du bommet vel? men hadde flaks. Skuddet traff likevel i vital sone."
            : pullLabel + "Instant kill (grønn sone)!"
        : kind === "vital_kill"
          ? pullLabel + "Vitalt treff — fuglen faller."
          : kind === "ettersok"
            ? zone === "vital"
              ? pullLabel + "Vitalt treff, men trenger ettersøk…"
              : pullLabel + "Treff i kroppen — ettersøk."
            : pullLabel + "Bom.") +
        dopeNote +
        chronoNote,
    );

    const showAar = hasTriggercam || isAdmin;
    if (showAar) {
      if (isAdmin) {
        const fatigue = fatigueRef.current;
        setAdminDebug({
          aimMm: { x: aimRef.current.x, y: aimRef.current.y },
          poaMm: { x: poa.xMm, y: poa.yMm },
          impactMm: { x: impact.xMm, y: impact.yMm },
          effects: {
            v0SampledMps: shot.v0,
            v0NominalMps: ammoLive.v0,
            deltaV0Mps: shot.deltaV0,
            dropBelowLosMm: dropMm,
            spinDriftMm: shot.spinDriftMm,
            windDriftMm: hold.windDriftMm,
            crosswindMs: crosswindRef.current,
            windSpeedMs,
            windFromDeg,
            shotBearingDeg,
            densityRatio: densityRef.current,
            temperatureC: powderTempRef.current,
            envelopeMoa: envelopeMoaAtFire,
            mindDispersionScale: mindScale,
            mentalFatigue: fatigue.mentalFatigue,
            physicalFatigue: fatigue.physicalFatigue,
            heartRateBpm: heartRateBpmRef.current,
            weaponCalm: weaponCalmRef.current,
            angularScatterMoa: { x: shot.xMoa, y: shot.yMoa },
            scatterMm: { x: scatterXMm, y: scatterYMm },
            wobbleMm: usingReal ? { x: 0, y: 0 } : { x: w.x, y: w.y },
            triggerPull: triggerPullRef.current,
            triggerPullMm: { x: pullMm.xMm, y: pullMm.yMm },
            zeroMm: { x: realizedZero.xMm, y: realizedZero.yMm },
            mountDriftMm: {
              x: angularMmAtDistance(
                mountHuntDriftMm.xMm,
                distanceRef.current,
              ),
              y: angularMmAtDistance(
                mountHuntDriftMm.yMm,
                distanceRef.current,
              ),
            },
            cantDeg: liveCantDeg(),
            trueDistanceM: distanceRef.current,
            measuredDistanceM,
          },
        });
      } else {
        setAdminDebug(null);
      }
      setReplay(result);
    } else {
      setAdminDebug(null);
      window.setTimeout(() => onShotResult(result), 900);
    }
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
    if (!featuresRef.current.focusHold) return;
    if (gunPrepOnlyRef.current) return;
    if (focusRef.current.held || firedRef.current) return;
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
    setTriggerUi({
      pending: false,
      targetPct: markMs / triggerBarMsRef.current,
    });
  }

  function endFocus() {
    focusRef.current = { held: false, startedAtMs: 0 };
    setFocusHeld(false);
    if (triggerRef.current.held) {
      abortTrigger("Fokus sluppet — avtrekk avbrutt.");
    }
    triggerMarkRef.current = null;
    resetTriggerProgress();
    resetFocusProgress();
    setTriggerUi({ pending: false, targetPct: 0 });
  }

  function aimLimitsMm(): { limitX: number; limitY: number; pxPerMm: number } {
    const g = geomRef.current;
    const seat = birdSeatRef.current;
    const pxPerMm = birdNativePxPerMm(g);
    if (landscapeSrcRef.current) {
      const sceneW = g.nativeW * (100 / seat.widthPct);
      const sceneH = sceneW / Math.max(0.25, landAspectRef.current);
      return {
        pxPerMm,
        limitX: (sceneW * 0.55) / pxPerMm,
        limitY: (sceneH * 0.55) / pxPerMm,
      };
    }
    const distFactor = distanceRef.current / 100;
    const limit = 120 * distFactor;
    return { pxPerMm, limitX: limit, limitY: limit };
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
    if (firedRef.current) return;
    // Ignore non-primary mouse (right-click) and multi-touch extras.
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
    // Trackpad/mouse can drop button-up outside the element — stop if no buttons.
    if (e.pointerType === "mouse" && e.buttons === 0) {
      endAimDrag(e.currentTarget, e.pointerId);
      return;
    }
    const { pxPerMm, limitX, limitY } = aimLimitsMm();
    const delta = aimMmDeltaFromPointerDrag({
      dxClientPx: e.clientX - drag.startX,
      dyClientPx: e.clientY - drag.startY,
      scale: targetScaleRef.current,
      pxPerMm,
      sensitivity: focusRef.current.held ? FOCUS_AIM_SPEED_MULT : 1,
      invert: scopeMoveReticleActive(
        aimControlRef.current,
        focusRef.current.held,
      ),
      viewportEl: e.currentTarget,
    });
    aimRef.current = clampAimMm(
      drag.origX + delta.x,
      drag.origY + delta.y,
      limitX,
      limitY,
    );
    hasPannedRef.current = true;
  }

  function onAimPointerUp(e: PointerEvent<HTMLDivElement>) {
    endAimDrag(e.currentTarget, e.pointerId);
  }

  function onAimPointerLeave(e: PointerEvent<HTMLDivElement>) {
    // Leaving the glass ends aim-drag (stuck :active / phantom left-button).
    endAimDrag(e.currentTarget, aimDragRef.current?.pointerId);
  }

  function beginTrigger(nowMs: number) {
    if (firedRef.current) return;
    if (triggerRef.current.held) return;
    if (focusShotSpentRef.current) {
      setStatus("Ett skudd per fokus — slipp F og fokusér på nytt.");
      return;
    }
    const feats = featuresRef.current;
    if (!feats.triggerTiming) {
      // Instant perfect break when trigger timing is disabled.
      if (feats.focusHold && !focusRef.current.held) {
        setStatus("Hold F (fokus) først — da settes avtrekkspunktet.");
        return;
      }
      triggerPullRef.current = 0;
      focusShotSpentRef.current = true;
      triggerMarkRef.current = null;
      fireShotRef.current();
      return;
    }
    if (!feats.focusHold) {
      // No focus gate — seed the mark on first Space press.
      if (triggerMarkRef.current == null) {
        const markMs = rollTriggerTargetMs();
        triggerMarkRef.current = markMs;
        setTriggerUi({
          pending: false,
          targetPct: markMs / triggerBarMsRef.current,
        });
      }
      focusRef.current = { held: true, startedAtMs: nowMs };
      setFocusHeld(true);
    } else if (!focusRef.current.held || triggerMarkRef.current == null) {
      setStatus("Hold F (fokus) først — da settes avtrekkspunktet.");
      return;
    }
    triggerRef.current = { held: true, startedAtMs: nowMs };
    paintTriggerProgress(0);
    setTriggerUi((prev) => ({ ...prev, pending: true }));
    setStatus("Avtrekk — slipp Space på merket.");
  }

  function releaseTrigger(nowMs: number) {
    const trig = triggerRef.current;
    const markMs = triggerMarkRef.current;
    const barMs = triggerBarMsRef.current;
    if (!trig.held || trig.startedAtMs == null || markMs == null) {
      triggerRef.current = { held: false, startedAtMs: null };
      resetTriggerProgress();
      setTriggerUi((prev) => ({
        ...prev,
        pending: false,
      }));
      return;
    }
    if (featuresRef.current.focusHold && !focusRef.current.held) {
      abortTrigger("Mistet fokus under avtrekk.");
      return;
    }
    const elapsed = Math.min(
      barMs,
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
    setTriggerUi((prev) => ({
      pending: false,
      targetPct: prev.targetPct,
    }));
    focusShotSpentRef.current = true;
    triggerMarkRef.current = null;
    fireShotRef.current();
  }

  useEffect(() => {
    function nudgeAim(dxMm: number, dyMm: number) {
      const { limitX, limitY } = aimLimitsMm();
      const next = clampAimMm(
        aimRef.current.x + dxMm,
        aimRef.current.y + dyMm,
        limitX,
        limitY,
      );
      aimRef.current = next;
      hasPannedRef.current = true;
    }

    function arrowTapMm(): number {
      if (landscapeSrcRef.current) {
        const scale = Math.max(0.01, targetScaleRef.current);
        const pxPerMm = birdNativePxPerMm(geomRef.current);
        const visibleScenePx = SCOPE_VIEWPORT_REF_PX / scale;
        return ((visibleScenePx * SCOPE_AIM_TAP_FOV_FRAC) / pxPerMm);
      }
      return SCOPE_AIM_TAP_MM * (distanceRef.current / 100);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (!firedRef.current) leaveToAware();
        return;
      }
      if (!ready || firedRef.current) return;
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
        const step =
          arrowTapMm() *
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
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        if (e.repeat) return;
        if (
          gunPrepOnlyRef.current &&
          onMarkBirdFromScopeRef.current &&
          landscapeSrcRef.current
        ) {
          const scans = scanBirdPlacementsRef.current;
          if (scans.length > 0) {
            const g = geomRef.current;
            const seat = birdSeatRef.current;
            const pt = landscapePctUnderReticle({
              aimMm: {
                x: aimRef.current.x + wobbleRef.current.x,
                y: aimRef.current.y + wobbleRef.current.y,
              },
              seat,
              nativeW: g.nativeW,
              nativeH: g.nativeH,
              spriteHeightMm: g.spriteHeightMm,
              landAspect: landAspectRef.current,
              vitalOff: vitalOffRef.current,
            });
            const hit = findBirdNearLandscapePoint(scans, pt.xPct, pt.yPct);
            if (hit) {
              onMarkBirdFromScopeRef.current({
                placement: hit,
                measuredDistanceM: Math.round(hit.distanceM),
              });
              setStatus(
                "Fugl merket — fokus og avtrekk er aktive.",
              );
              return;
            }
            setStatus("Ingen fugl under sikte — panorer videre, F for å markere.");
            return;
          }
        }
        beginFocus(performance.now());
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        beginTrigger(performance.now());
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        if (scope) {
          setZoom((z) => clampScopeZoom(z + 0.5, zoomRange));
        }
      } else if (e.key === "-") {
        e.preventDefault();
        if (scope) {
          setZoom((z) => clampScopeZoom(z - 0.5, zoomRange));
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "ArrowUp") keysRef.current.up = null;
      if (e.key === "ArrowDown") keysRef.current.down = null;
      if (e.key === "ArrowLeft") keysRef.current.left = null;
      if (e.key === "ArrowRight") keysRef.current.right = null;
      if (e.key === "q" || e.key === "Q") keysRef.current.ccw = null;
      if (e.key === "e" || e.key === "E") keysRef.current.cw = null;
      if (e.key === "f" || e.key === "F") endFocus();
      if (e.key === " " || e.code === "Space") {
        if (triggerRef.current.held) {
          releaseTrigger(performance.now());
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [ready, scope, onAbort, onBackToAware, zoomRange.minZoom, zoomRange.maxZoom]);

  useEffect(() => {
    if (!ready || fired) return;
    let raf = 0;
    let last = performance.now();
    let uiAccum = 0;

    function paintScopeWorld() {
      const el = scopeWorldRef.current;
      if (!el) return;
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
      const vo = vitalOffRef.current;
      const g = geomRef.current;
      const seat = birdSeatRef.current;
      const aimPxX = birdMmToNativePx(ax, g);
      const aimPxY = birdMmToNativePx(ay, g);

      if (landscapeSrc) {
        // Scene sized so bird at widthPct% equals native topp width — hit math unchanged.
        const sceneW = g.nativeW * (100 / seat.widthPct);
        const sceneH = sceneW / Math.max(0.25, landAspectRef.current);
        const birdCx = (seat.x / 100) * sceneW;
        const birdCy = (seat.y / 100) * sceneH;
        const ox = birdCx - sceneW / 2;
        const oy = birdCy - sceneH / 2;
        const panPxX = (ox + vo.x + aimPxX) * scale;
        const panPxY = (oy + vo.y + aimPxY) * scale;
        el.style.transform =
          `translate(calc(-50% - ${panPxX}px), calc(-50% - ${panPxY}px)) ` +
          `scale(${scale})`;
      } else {
        const panPxX = (vo.x + aimPxX) * scale;
        const panPxY = (vo.y + aimPxY) * scale;
        el.style.transform =
          `translate(calc(-50% - ${panPxX}px), calc(-50% - ${panPxY}px)) ` +
          `scale(${scale})`;
      }

      const reticleEl = scopeReticleOffsetRef.current;
      if (reticleEl) {
        const cant = cantActiveRef.current ? cantDegRef.current : 0;
        const cantRot =
          Math.abs(cant) > 0.02 ? `rotate(${cant.toFixed(3)}deg)` : "";
        const rx = birdMmToNativePx(paint.reticleX, g) * scale;
        const ry = birdMmToNativePx(paint.reticleY, g) * scale;
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
      const distFactor = distanceRef.current / 100;
      const g = geomRef.current;
      const seat = birdSeatRef.current;
      const pxPerMm = birdNativePxPerMm(g);
      const scale = targetScaleRef.current;

      let speed: number;
      let limitX: number;
      let limitY: number;
      if (landscapeSrcRef.current) {
        // Scene pan in mm — slower acquire; focus multiplies further below.
        const visibleScenePx =
          SCOPE_VIEWPORT_REF_PX /
          Math.max(0.01, scale * focusZoomBoostRef.current);
        speed = ((visibleScenePx * LANDSCAPE_AIM_FOV_FRAC) / pxPerMm) * dt;
        const sceneW = g.nativeW * (100 / seat.widthPct);
        const sceneH = sceneW / Math.max(0.25, landAspectRef.current);
        limitX = (sceneW * 0.55) / pxPerMm;
        limitY = (sceneH * 0.55) / pxPerMm;
      } else {
        speed = AIM_SPEED_MM_PER_SEC * distFactor * dt;
        limitX = 120 * distFactor;
        limitY = limitX;
      }
      if (focusRef.current.held) {
        speed *= FOCUS_AIM_SPEED_MULT;
      }
      const mx = scopeAimHoldMult(k.left, now);
      const myL = scopeAimHoldMult(k.right, now);
      const myU = scopeAimHoldMult(k.up, now);
      const myD = scopeAimHoldMult(k.down, now);
      if (mx > 0) x -= speed * mx;
      if (myL > 0) x += speed * myL;
      if (myU > 0) y -= speed * myU;
      if (myD > 0) y += speed * myD;
      if (mx > 0 || myL > 0 || myU > 0 || myD > 0) {
        hasPannedRef.current = true;
      }
      x = Math.max(-limitX, Math.min(limitX, x));
      y = Math.max(-limitY, Math.min(limitY, y));
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

      if (
        featuresRef.current.focusHold &&
        focusShouldAbort(focusRef.current, now)
      ) {
        endFocus();
        setStatus(
          `Fokus brutt etter ${(focusAbortMsRef.current / 1000).toFixed(0)} s — slipp F og start på nytt.`,
        );
      }

      const calm = effectiveCalmWithFocus(
        weaponCalmRef.current,
        focusRef.current,
        now,
        fatigueRef.current,
      );
      const amp = wobbleAmplitudeMm(calm, distanceRef.current);
      const t = now / 1000;
      const ph = wobblePhase.current;
      const fPhase = focusPhase(focusRef.current, now);
      const focusHeld = focusRef.current.held;
      const focusElapsed = focusHeld
        ? now - focusRef.current.startedAtMs
        : 0;
      const restOn =
        shootRestRef.current === "bipod" ||
        shootRestRef.current === "backpack";
      const bagriderOn =
        restOn && !!shootBagriderRef.current;
      const pulseAmp = pulseVerticalAmpMm(
        heartRateBpmRef.current,
        distanceRef.current,
        {
          rest: restOn,
          bagrider: bagriderOn,
          focusCalmMult: focusHeld
            ? focusCalmMultiplier(focusElapsed)
            : 1,
        },
      );
      pulsePhaseRef.current = advancePulsePhase(
        pulsePhaseRef.current,
        heartRateBpmRef.current,
        dt,
      );
      const pulseY = pulseKickOffset(pulsePhaseRef.current) * pulseAmp;
      wobbleRef.current = {
        x:
          Math.sin(t * 2.1 + ph.a) * amp * 0.55 +
          Math.sin(t * 5.3 + ph.b) * amp * 0.35 +
          Math.sin(t * 11.0) * amp * 0.15,
        y:
          Math.cos(t * 1.7 + ph.b) * amp * 0.55 +
          Math.cos(t * 4.6 + ph.a) * amp * 0.35 +
          Math.sin(t * 9.5 + 1) * amp * 0.15 +
          pulseY,
      };

      paintScopeWorld();

      const trig = triggerRef.current;
      if (trig.held && trig.startedAtMs != null) {
        const elapsed = now - trig.startedAtMs;
        const barMs = triggerBarMsRef.current;
        const prog = Math.min(1, elapsed / barMs);
        paintTriggerProgress(prog);
        if (elapsed >= barMs) {
          releaseTrigger(trig.startedAtMs + barMs);
        }
      }

      if (focusRef.current.held) {
        const elapsed = now - focusRef.current.startedAtMs;
        paintFocusProgress(
          focusRemainingMs(focusRef.current, now) / focusAbortMsRef.current,
          elapsed,
        );
      } else {
        paintFocusProgress(0);
      }

      uiAccum += dt;
      if (uiAccum > 0.05) {
        uiAccum = 0;
        setFocusUi({
          phase: fPhase,
          remainingMs: focusRemainingMs(focusRef.current, now),
        });
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, fired, landscapeSrc, scopeAimControl]);

  // Start with landscape centre in the glass — player must find the bird.
  useEffect(() => {
    if (!landscapeSrc) {
      aimRef.current = { x: 0, y: 0 };
      frozenBaseAimRef.current = { x: 0, y: 0 };
      hasPannedRef.current = false;
      return;
    }
    if (hasPannedRef.current) return;
    const g = shotGeom;
    const vitalBase = birdVitalOffsetFromImageCenterPx(g);
    const vitalOff =
      gunPrepOnly
        ? { x: 0, y: 0 }
        : birdFlip
          ? { x: -vitalBase.x, y: vitalBase.y }
          : vitalBase;
    const widthPct = Math.max(0.05, landscapeBirdWidthPct ?? 2);
    const center = aimMmForLandscapeCenter({
      nativeW: g.nativeW,
      nativeH: g.nativeH,
      spriteHeightMm: g.spriteHeightMm,
      widthPct,
      landAspect,
      birdXPct: landscapeFocusX,
      birdYPct: landscapeFocusY,
      vitalOff,
    });
    aimRef.current = center;
    frozenBaseAimRef.current = { ...center };
  }, [
    landscapeSrc,
    landscapeBirdWidthPct,
    landscapeFocusX,
    landscapeFocusY,
    landAspect,
    shotGeom,
    birdFlip,
    gunPrepOnly,
  ]);

  function nudgeZero(axis: "x" | "y", deltaMm: number): boolean {
    if (fired) return false;
    if (axis === "x") {
      return turretNudgeMoved(setSessionZeroXMm, (prev) =>
        clampTurretMm(prev + deltaMm),
      );
    }
    return turretNudgeMoved(setSessionZeroYMm, (prev) =>
      clampElevationTurretMm(prev + deltaMm, scope?.scope),
    );
  }

  if (!ready || !rifle || !scope) {
    return (
      <div className="spot-view" role="dialog" aria-modal="true">
        <p className="intro-line">Mangler rifle, scope eller ammo i kit.</p>
        <button type="button" className="intro-button" onClick={leaveToAware}>
          Back to Aware
        </button>
      </div>
    );
  }

  const birdWidthPct = Math.max(0.05, landscapeBirdWidthPct ?? 2);
  const focusZoomBoost = scopeFocusZoomBoost(scope.scope, focusHeld);
  const focusViewportBoost = scopeFocusViewportBoost(scope.scope, focusHeld);
  const targetScale = birdScopeImageScale(
      zoom,
      scope.scope,
      trueDistanceM,
      shotGeom.nativeW,
      birdSpriteId,
      // Landscape hunt: use placement width (perch/sprite scales) not bare 1/d.
      landscapeSrc ? birdWidthPct : undefined,
    );
  /** FFP reticle: optic zoom only — not bird size/distance. */
  const reticleScale = opticReticleImgScale(zoom, scope.scope);
  const vitalBase = birdVitalOffsetFromImageCenterPx(shotGeom);
  // Flipped sprite mirrors vital X around image centre — keep reticle on chest.
  // Gun-prep scan has no vital seat — optical centre = landscape aim.
  const vitalOff = gunPrepOnly
    ? { x: 0, y: 0 }
    : birdFlip
      ? { x: -vitalBase.x, y: vitalBase.y }
      : vitalBase;
  targetScaleRef.current = targetScale;
  focusZoomBoostRef.current = focusZoomBoost;
  vitalOffRef.current = vitalOff;

  const sceneW = landscapeSrc
    ? shotGeom.nativeW * (100 / birdWidthPct)
    : shotGeom.nativeW;
  const sceneH = landscapeSrc ? sceneW / landAspect : shotGeom.nativeH;

  const abFasitHold =
    ballisticHold && selectedAmmo && ballisticsAmmo
      ? exactBallisticHold(
          ballisticsAmmo.ammo,
          measuredDistanceM,
          crosswindMs,
          {
            densityRatio,
            powderTempC: temperatureC,
            dvDtMpsPerC: ballisticsAmmo.dvDtMpsPerC,
            cantDeg: liveCantDeg(),
          },
        )
      : null;
  /** Kestrel LCD: AB fasit when paired, else reference solution with meter only. */
  const kestrelDisplayHold =
    abFasitHold ??
    (hasKestrelInKit && selectedAmmo && ballisticsAmmo
      ? exactBallisticHold(
          ballisticsAmmo.ammo,
          measuredDistanceM,
          crosswindMs,
          {
            densityRatio,
            powderTempC: temperatureC,
            dvDtMpsPerC: ballisticsAmmo.dvDtMpsPerC,
            cantDeg: liveCantDeg(),
          },
        )
      : null);

  if (replay && lastImpact) {
    return (
      <HuntShotAarView
        title={
          isAdmin
            ? hasTriggercam
              ? "Admin AAR · Triggercam"
              : "Admin AAR — after action"
            : "Triggercam — after action"
        }
        birdFlip={birdFlip}
        birdSpriteId={birdSpriteId}
        adminDebug={adminDebug}
        hit={{
          xMm: lastImpact.xMm,
          yMm: lastImpact.yMm,
          diameterMm: lastImpact.diameterMm,
          zone: replay.zone,
          kind: replay.kind,
        }}
        subtitle={
          replay.zone === "head"
            ? HEADSHOT_AAR_TEXT
            : replay.zone === "neck"
              ? NECK_LUCKY_KILL_TEXT
              : `${status} · treff ${formatHuntImpactOffsetMm(lastImpact.xMm, lastImpact.yMm)} (fra vital-senter) · sone ${replay.zone}`
        }
        onContinue={() => onShotResult(replay)}
      />
    );
  }

  return (
    <div
      className="shooting-range hunt-shoot"
      role="dialog"
      aria-modal="true"
      aria-label="Skytemodus"
    >
      <header className="shop-header">
        <p className="intro-line intro-gift">
          {gunPrepOnly ? "Gun — tårn / prep" : "Fugl observert — skyt!"}
        </p>
        <p className="shop-row-note">
          Kl {formatHuntClock(clockMinutes)}
          {gunPrepOnly ? (
            <>
              {" "}
              · Still tårn manuelt
              {scopeMarkedBirdId
                ? " · Fugl merket"
                : scanBirdPlacements.length > 0
                  ? " · Finn fugl i glasset — F for å markere (aktiverer fokus/avtrekk)"
                  : " · Aware lagrer dial (ingen skudd uten mål)"}
            </>
          ) : (
            <>
              {rangeSource === "lrf" ? (
                <>
                  {" · "}
                  <span className="lrf-range-callout">
                    LRF: {measuredDistanceM} m
                  </span>
                </>
              ) : (
                <> · Estimat {measuredDistanceM} m</>
              )}
              {" · "}
              Puls {formatPulseBpm(heartRateBpm)}
              {" · "}
              vital grønn Ø{shotGeom.instantDiameterMm} mm / rød Ø
              {shotGeom.vitalDiameterMm} mm
              {abFasitHold
                ? " · Kestrel AB fasit (skru tårn)"
                : hasKestrelInKit
                  ? " · Kestrel i kit (fane)"
                  : hasWindMeterInKit
                    ? " · Vindmåler i kit (fane)"
                    : null}
            </>
          )}
        </p>
        <p className="shop-row-note">
          {rifle.brand} {rifle.name} · {scope.brand} {scope.name} (
          {zoom.toFixed(1)}×) · {status}
        </p>
      </header>

      <div className="range-toolbar">
        <label className="shop-filter">
          Ammo
          <select
            value={ammoId}
            disabled={fired}
            onChange={(e) => setAmmoId(e.target.value)}
          >
            {ammoOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {displayAmmoBrandName({
                  ammoId: a.id,
                  brand: a.brand,
                  name: a.name,
                })}{" "}
                · {getInventoryQty(inventory, a.id)} igjen
              </option>
            ))}
          </select>
        </label>
        <span className="range-shot-count">Patroner {ammoRemaining}</span>
        <span className="shop-row-note">
          Zoom {zoom.toFixed(1)}× — dra i glasset for å sikte · dra ringen (kl. 8→12→4)
        </span>
      </div>

      <div className="hunt-shoot-dope-row">
        <ScopeTurrets
          sessionZeroXMm={sessionZeroXMm}
          sessionZeroYMm={sessionZeroYMm}
          onNudge={nudgeZero}
          disabled={fired}
          clickUnit={scope?.scope.clickUnit ?? "MRAD"}
          elevationClicksPerRev={scopeElevationClicksPerRev(scope?.scope)}
          windageClicksPerRev={scopeWindageClicksPerRev(scope?.scope)}
          hideShooterDials={tubeMode}
          onHudTabChange={setHudTab}
          meterTabLabel={
            hasKestrelInKit ? "Kestrel" : hasWindMeterInKit ? "Vindmåler" : "Kestrel"
          }
          enviroPanel={
            <HuntShotConditions
              rangeM={measuredDistanceM}
              rangeSource={rangeSource}
              shotBearingDeg={shotBearingDeg}
              windFromDeg={windFromDeg}
              windSpeedMs={windSpeedMs}
              temperatureC={temperatureC}
              forecastTemperatureC={forecastTemperatureC ?? temperatureC}
              hasKestrel={hasKestrelInKit && kestrelEnviroActive}
              dopeCard={dopeCard}
              ammoId={ammoId}
              rifleId={rifle?.id ?? null}
              ammo={ballisticsAmmo?.ammo ?? null}
              ammoLabel={
                selectedAmmo
                  ? displayAmmoBrandName({
                      ammoId: selectedAmmo.id,
                      brand: selectedAmmo.brand,
                      name: selectedAmmo.name,
                    })
                  : "Ammo"
              }
              clickUnit={scope?.scope.clickUnit ?? "MRAD"}
              lrfId={lrfItem?.id ?? null}
              lrfBrand={lrfItem?.brand ?? null}
              lrfLabel={
                lrfItem ? `${lrfItem.brand} ${lrfItem.name}` : null
              }
              lrfElevClicks={
                lrfItem?.lrf.hasOnboardBallistics && ballisticsAmmo
                  ? Math.abs(
                      mmAt100ToScopeClicks(
                        (ballisticHold ??
                          exactBallisticHold(
                            ballisticsAmmo.ammo,
                            measuredDistanceM,
                            crosswindMs,
                            {
                              densityRatio,
                              powderTempC: temperatureC,
                              dvDtMpsPerC: ballisticsAmmo.dvDtMpsPerC,
                              cantDeg: liveCantDeg(),
                            },
                          )
                        ).dialYMmAt100,
                        scope?.scope.clickUnit ?? "MRAD",
                      ),
                    )
                  : null
              }
              dopeDialDisabled={fired}
              onUseDope={(entry) => {
                if (fired) return;
                const unit = scope?.scope.clickUnit ?? "MRAD";
                setSessionZeroXMm(
                  clampTurretMm(dopeClicksToMmAt100(entry.windageClicks)),
                );
                setSessionZeroYMm(
                  clampElevationTurretMm(
                    dopeClicksToMmAt100(entry.elevationClicks),
                    scope.scope,
                  ),
                );
                setStatus(
                  `DOPE @ ${entry.distanceM} m dialt · elev ${formatDopeElevationClicks(entry.elevationClicks, unit)}${
                    entry.windageClicks
                      ? ` · wind ${formatDopeWindageClicks(entry.windageClicks, unit)}`
                      : ""
                  } · hold F · Space.`,
                );
              }}
            />
          }
          kestrelPanel={
            hasKestrelInKit ? (
              kestrelDisplayHold ? (
                <div className="hunt-kestrel-panel">
                  {!abFasitHold ? (
                    <p className="shop-row-note">
                      Kestrel i kit — ingen BDX/AB-kobling til LRF. Fasit vises;
                      dial Enviro/tårn manuelt.
                    </p>
                  ) : (
                    <p className="shop-row-note">
                      Kestrel AB fasit — skru elevation/windage manuelt (ingen
                      auto-dial).
                    </p>
                  )}
                  <KestrelFasitView
                    baseDistanceM={measuredDistanceM}
                    solveHold={(distanceM) =>
                      exactBallisticHold(
                        ballisticsAmmo!.ammo,
                        distanceM,
                        crosswindMs,
                        {
                          densityRatio,
                          powderTempC: temperatureC,
                          dvDtMpsPerC: ballisticsAmmo!.dvDtMpsPerC,
                          cantDeg: liveCantDeg(),
                        },
                      )
                    }
                    shotBearingDeg={shotBearingDeg}
                    windFromDeg={windFromDeg}
                    windSpeedMs={windSpeedMs}
                    clickUnit={scope?.scope.clickUnit ?? "MRAD"}
                  />
                </div>
              ) : (
                <p className="shop-row-note">
                  Kestrel i kit — velg ammo for fasit.
                </p>
              )
            ) : hasWindMeterInKit ? (
              <WindMeterView
                windFromDeg={windFromDeg}
                windSpeedMs={windSpeedMs}
                windErrorPercent={windMeterErrorPercent}
                brand={windMeterBrand}
                name={windMeterName}
              />
            ) : undefined
          }
          actions={
            <>
              <button
                type="button"
                className="intro-button sheriff-secondary"
                disabled={fired}
                onClick={() => {
                  setSessionZeroXMm(0);
                  setSessionZeroYMm(0);
                  setStatus("Tårn nullstilt (0 / 0).");
                }}
                title="Sett elev/windage til 0"
              >
                Nullstill tårn
              </button>
              <button
                type="button"
                className="intro-button sheriff-secondary"
                disabled={fired}
                onClick={leaveToAware}
              >
                {gunPrepOnly && scopeMarkedBirdId ? "Aware" : "Back to Aware"}
              </button>
            </>
          }
        />
      </div>

      <div className="scope-stage" tabIndex={0}>
        {!fired && !gunPrepOnly ? (
          <BirdNerveBar
            className="hunt-scope-nerve"
            nerve={nerveUi}
            threshold={ENCOUNTER_NERVE.flushThreshold}
          />
        ) : null}
        <MaybeScopeTube
          enabled={tubeMode}
          railsOnly={railsOnly && !gunPrepOnly}
          scopeId={scope.id}
          elevation={
            <ScopeElevationDial
              sessionZeroMm={sessionZeroYMm}
              onNudge={(d) =>
                turretNudgeMoved(setSessionZeroYMm, (y) =>
                  clampElevationTurretMm(y + d, scope.scope),
                )
              }
              clickUnit={scope.scope.clickUnit ?? "MRAD"}
              clicksPerRev={scopeElevationClicksPerRev(scope.scope)}
              disabled={fired}
            />
          }
          parallax={
            <div className="scope-tube-para-stack">
              {illumOn ? (
                <IlluminationTurret
                  value={reticleIllum}
                  onChange={setReticleIllum}
                  disabled={fired}
                  bipolar={illumBipolar}
                />
              ) : null}
              <ParallaxTurret
                focusM={parallaxFocusM}
                onChange={setParallaxFocusM}
                disabled={fired}
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
              clickUnit={scope.scope.clickUnit ?? "MRAD"}
              clicksPerRev={scopeWindageClicksPerRev(scope.scope)}
              disabled={fired}
            />
          }
          focusRail={
            (tubeMode || railsOnly) && !gunPrepOnly && features.focusHold ? (
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
                  {focusUi.phase === "focused"
                    ? `Stabil ${(focusUi.remainingMs / 1000).toFixed(1)}s`
                    : focusUi.phase === "settling"
                      ? "Settler…"
                      : focusUi.phase === "fatigued"
                        ? "Ustabil"
                        : "Fokus"}
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
            (tubeMode || railsOnly) && !gunPrepOnly && features.triggerTiming ? (
              <div className="range-side-rail range-side-rail--trigger">
                <span
                  className={
                    triggerUi.pending
                      ? "range-side-rail-label is-trigger"
                      : "range-side-rail-label"
                  }
                >
                  Avtrekk
                </span>
                <div
                  className="range-trigger-bar"
                  style={
                    {
                      ["--trigger-mark-pct" as string]: `${triggerUi.targetPct * 100}%`,
                    } as CSSProperties
                  }
                >
                  <div ref={triggerFillRef} className="range-trigger-fill" />
                  {triggerUi.targetPct > 0 ? (
                    isRealismLow ? (
                      <>
                        {(() => {
                          const barMs = Math.max(1, triggerBarMsRef.current);
                          const halfPct =
                            (TRIGGER_PERFECT_BAND_MS * 2) / barMs * 100;
                          const targetPct = triggerUi.targetPct * 100;
                          const lo = Math.max(0, Math.min(100, targetPct - halfPct));
                          const hi = Math.max(0, Math.min(100, targetPct + halfPct));
                          return (
                            <>
                              <span
                                className="range-trigger-mark"
                                aria-hidden
                                style={
                                  {
                                    ["--trigger-mark-pct" as string]: `${lo}%`,
                                  } as CSSProperties
                                }
                              />
                              <span
                                className="range-trigger-mark"
                                aria-hidden
                                style={
                                  {
                                    ["--trigger-mark-pct" as string]: `${hi}%`,
                                  } as CSSProperties
                                }
                              />
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      <span className="range-trigger-mark" aria-hidden />
                    )
                  ) : null}
                </div>
              </div>
            ) : null
          }
        >
          <ScopeOpticFit>
            <div className="scope-stage-optic-row">
              <div
                className={[
                  "scope-optic",
                  scopeFovDiameterScale(scope.scope) > 1
                    ? "is-fov-premium"
                    : "",
                  focusViewportBoost > 1 ? "is-focus-immersive" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={
                  focusViewportBoost > 1
                    ? ({
                        ["--focus-viewport-scale" as string]:
                          focusViewportBoost,
                      } as CSSProperties)
                    : undefined
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
              <ScopeFocusZoom scale={focusZoomBoost}>
              <div className="scope-cant-roll">
              <div
                ref={scopeWorldRef}
                className="scope-world"
                style={
                  blurPx > 0.05
                    ? { filter: `blur(${blurPx.toFixed(2)}px)` }
                    : undefined
                }
              >
                {landscapeSrc ? (
                  <div
                    className="hunt-scope-scene"
                    style={{ width: sceneW, height: sceneH }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="hunt-scope-landscape"
                      src={landscapeSrc}
                      alt=""
                      draggable={false}
                      aria-hidden
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                          setLandAspect(img.naturalWidth / img.naturalHeight);
                        }
                      }}
                    />
                    {gunPrepOnly && scanBirdPlacements.length > 0
                      ? [...scanBirdPlacements]
                          .slice()
                          .sort((a, b) => b.distanceM - a.distanceM)
                          .map((p) => {
                            const geom = birdShotGeom(p.spriteId);
                            return (
                              <div
                                key={p.birdId}
                                className="hunt-scope-bird-wrap"
                                style={{
                                  left: `${p.x}%`,
                                  top: `${p.y}%`,
                                  width: `${Math.max(0.05, p.widthPct)}%`,
                                  aspectRatio: `${geom.nativeW} / ${geom.nativeH}`,
                                }}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  className="scope-target hunt-tiur-target"
                                  src={p.imageSrc}
                                  alt=""
                                  draggable={false}
                                  width={geom.nativeW}
                                  height={geom.nativeH}
                                  style={{
                                    width: "100%",
                                    height: "100%",
                                    transform: p.flip
                                      ? "scaleX(-1)"
                                      : undefined,
                                  }}
                                />
                              </div>
                            );
                          })
                      : null}
                    {!gunPrepOnly ? (
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
                          className="scope-target hunt-tiur-target"
                          src={shotGeom.displaySrc}
                          alt="Fugl"
                          draggable={false}
                          width={shotGeom.nativeW}
                          height={shotGeom.nativeH}
                          style={{
                            width: "100%",
                            height: "100%",
                        transform: birdFlip ? "scaleX(-1)" : undefined,
                          }}
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
                    ) : null}
                  </div>
                ) : gunPrepOnly ? null : (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className="scope-target hunt-tiur-target"
                      src={shotGeom.displaySrc}
                      alt="Fugl"
                      draggable={false}
                      width={shotGeom.nativeW}
                      height={shotGeom.nativeH}
                      style={{
                        width: shotGeom.nativeW,
                        height: shotGeom.nativeH,
                        transform: birdFlip ? "scaleX(-1)" : undefined,
                      }}
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
                  </>
                )}
              </div>
              </div>
              <div
                ref={scopeReticleOffsetRef}
                className="scope-reticle-offset"
              >
                <ScopeReticle
                  scope={scope.scope}
                  zoom={zoom}
                  imgScale={reticleScale}
                  illumination={illumOn ? illumDecoded.intensity : 0}
                  illuminationColor={illumDecoded.color}
                />
              </div>
              </ScopeFocusZoom>
            </div>
            <ScopeZoomRing
              scope={zoomRange}
              zoom={zoom}
              onChange={(z) => setZoom(clampScopeZoom(z, zoomRange))}
              disabled={fired}
            />
            {bubbleHud ? (
              <BubbleLevel
                visualId={bubbleLevel!.visualId}
                cantDeg={cantDeg}
                onCantChange={setCantDeg}
                disabled={fired}
              />
            ) : null}
          </div>

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
            disabled={fired}
            onPointerDown={(e) => {
              e.preventDefault();
              if (
                gunPrepOnly &&
                onMarkBirdFromScope &&
                landscapeSrc &&
                scanBirdPlacements.length > 0
              ) {
                const g = shotGeom;
                const seat = birdSeatRef.current;
                const pt = landscapePctUnderReticle({
                  aimMm: {
                    x: aimRef.current.x + wobbleRef.current.x,
                    y: aimRef.current.y + wobbleRef.current.y,
                  },
                  seat,
                  nativeW: g.nativeW,
                  nativeH: g.nativeH,
                  spriteHeightMm: g.spriteHeightMm,
                  landAspect: landAspectRef.current,
                  vitalOff: vitalOffRef.current,
                });
                const hit = findBirdNearLandscapePoint(
                  scanBirdPlacements,
                  pt.xPct,
                  pt.yPct,
                );
                if (hit) {
                  onMarkBirdFromScope({
                    placement: hit,
                    measuredDistanceM: Math.round(hit.distanceM),
                  });
                  setStatus("Fugl merket — fokus og avtrekk er aktive.");
                  return;
                }
                setStatus(
                  "Ingen fugl under sikte — panorer videre, F for å markere.",
                );
                return;
              }
              beginFocus(performance.now());
            }}
            onPointerUp={endFocus}
            onPointerCancel={endFocus}
          >
            {gunPrepOnly ? "Merk (F)" : "Fokus"}
          </button>
          <button
            type="button"
            className={
              triggerUi.pending
                ? "range-touch-btn range-touch-btn--trigger is-active"
                : "range-touch-btn range-touch-btn--trigger"
            }
            disabled={fired || gunPrepOnly}
            onPointerDown={(e) => {
              e.preventDefault();
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
            Avtrekk
          </button>
        </div>
      </div>
    </div>
  );
}
