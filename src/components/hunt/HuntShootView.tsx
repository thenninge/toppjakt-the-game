"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FOCUS_HOLD_MS,
  TRIGGER_BAR_MS,
  caliberBulletDiameterMm,
  clampScopeZoom,
  combinedDispersionMoa,
  computeWeaponCalmFactor,
  effectiveCalmWithFocus,
  ensureAmmoAffinity,
  fatigueDispersionFactor,
  focusPhase,
  focusRemainingMs,
  rollTriggerTargetMs,
  sampleShotFromPoa,
  scopeImageScale,
  triggerPullErrorFactor,
  triggerPullOffsetMm,
  wobbleAmplitudeMm,
  RANGE_DISTANCE_M,
} from "@/lib/range/precision";
import {
  sampleTrajectory,
} from "@/lib/ballistics/trajectory";
import {
  exactBallisticHold,
  formatHoldClicks,
  type BallisticHoldSolution,
} from "@/lib/ballistics/solver";
import { ammoAtPowderTemp } from "@/lib/ballistics/powderTemp";
import { isSilentSuppressedShot } from "@/lib/ammo/spec";
import type { RangeShotAudioOptions } from "@/lib/range/audio";
import { ScopeReticle } from "@/components/range/ScopeReticle";
import { ScopeTurrets, type ScopeHudTab } from "@/components/range/ScopeTurrets";
import { ScopeZoomRing } from "@/components/range/ScopeZoomRing";
import { useTriggerBarPaint } from "@/components/range/useTriggerBarPaint";
import { useFocusBarPaint } from "@/components/range/useFocusBarPaint";
import { HuntShotConditions } from "@/components/hunt/HuntShotConditions";
import type { HuntRangeSource } from "@/components/hunt/HuntShotConditions";
import { KestrelFasitView } from "@/components/hunt/KestrelFasitView";
import { HuntShotAarView } from "@/components/hunt/HuntShotAarView";
import { useRangeAudio } from "@/components/range/useRangeAudio";
import {
  angularMmAtDistance,
  clampTurretMm,
  effectiveZeroOffsetMm,
  getInventoryQty,
  zeroingKey,
  type DopeCardEntry,
  type InventoryEntry,
  type ZeroingProfile,
} from "@/lib/player";
import { applyScopeClickError } from "@/lib/optics/spec";
import {
  isAmmoItem,
  isBipodItem,
  isRifleItem,
  isScopeItem,
  isStockItem,
  type ShopItem,
} from "@/lib/shop/types";
import {
  birdMmToNativePx,
  birdScopeImageScale,
  birdShotGeom,
  birdVitalOffsetFromImageCenterPx,
  classifyHuntShot,
  TIUR_INSTANT_KILL_DIAMETER_MM,
  TIUR_VITAL_DIAMETER_MM,
  TRIGGERCAM_ITEM_ID,
  type HuntShotResult,
} from "@/lib/hunt/shoot";
import type { BirdSpriteId } from "@/lib/hunt/birdSprites";
import { formatHuntClock } from "@/lib/hunt/travel";
import {
  ENCOUNTER_NERVE,
  ENVIRO_TIME_FACTOR,
  tickEncounterNerve,
} from "@/lib/game/nervousness";
import type { CSSProperties } from "react";

type HuntShootViewProps = {
  /** True ballistic distance (bird). */
  trueDistanceM: number;
  /** What LRF showed (player dials from this). */
  measuredDistanceM: number;
  /** LRF reading vs Aware Shoot estimate. */
  rangeSource?: HuntRangeSource;
  /** Exact BDX+Kestrel hold from perfect zero (null if not equipped). */
  ballisticHold?: BallisticHoldSolution | null;
  /** True local crosswind (m/s, +from left) for this shot bearing. */
  crosswindMs?: number;
  /** Atmosphere density ratio from live temperature. */
  densityRatio?: number;
  /** Live air / powder temperature (°C) for dV/dT + Enviro. */
  temperatureC?: number;
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
  /** CB Customs bedding MOA delta (negative = tighter). */
  customsMoaDelta?: number;
  onAffinitiesChange: (next: Record<string, number>) => void;
  onConsumeAmmo: (ammoId: string) => boolean;
  onEnsureZeroing: (
    rifleId: string,
    scopeId: string,
    ammoId: string,
  ) => ZeroingProfile;
  musicEnabled: boolean;
  /** Hunt BODY fatigue 0–1 (1 = exhausted). Cuts calm → more weapon shake. */
  physicalFatigue?: number;
  /** Hunt MIND fatigue 0–1 (1 = exhausted). Widens MOA envelope up to 2×. */
  mentalFatigue?: number;
  /** Same horizontal flip as spotting (placement.flip). */
  birdFlip?: boolean;
  /** Topp/target pair chosen at spot time. */
  birdSpriteId?: BirdSpriteId;
  /** Kit camo bird-spot factor (Aware / Enviro nerve). */
  camoBirdSpot?: number;
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
};

type Keys = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

const AIM_SPEED_MM_PER_SEC = 22;
const DEFAULT_SCOPE_ZOOM = 12;

/**
 * Hunt shoot: same scope loop as the range, tiurtopp1 as target,
 * vital zones, ballistics at true distance.
 */
export function HuntShootView({
  trueDistanceM,
  measuredDistanceM,
  rangeSource = "estimated",
  ballisticHold = null,
  crosswindMs = 0,
  densityRatio = 1,
  temperatureC = 15,
  shotBearingDeg = 0,
  windFromDeg = 0,
  windSpeedMs = 0,
  clockMinutes,
  kitItems,
  inventory,
  ammoAffinities,
  zeroingProfiles,
  dopeCard = [],
  customsMoaDelta = 0,
  onAffinitiesChange,
  onConsumeAmmo,
  onEnsureZeroing,
  musicEnabled,
  physicalFatigue = 0,
  mentalFatigue = 0,
  birdFlip = false,
  birdSpriteId = "tiur-1",
  camoBirdSpot = 0.5,
  birdNerve = 0,
  onAbort,
  onShotResult,
  onGameSeconds,
  onBirdFlushedFromWait,
  onNerveChange,
  onBackToAware,
}: HuntShootViewProps) {
  const shotGeom = useMemo(() => birdShotGeom(birdSpriteId), [birdSpriteId]);
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
  const ammoOptions = useMemo(
    () => kitItems.filter(isAmmoItem),
    [kitItems],
  );

  const ready = !!(rifle && scope && ammoOptions.length > 0);

  const [ammoId, setAmmoId] = useState(ammoOptions[0]?.id ?? "");
  const [zoom, setZoom] = useState(DEFAULT_SCOPE_ZOOM);
  const [sessionZeroXMm, setSessionZeroXMm] = useState(() =>
    ballisticHold
      ? clampTurretMm(Math.round(ballisticHold.dialXMmAt100))
      : 0,
  );
  const [sessionZeroYMm, setSessionZeroYMm] = useState(() =>
    ballisticHold
      ? clampTurretMm(Math.round(ballisticHold.dialYMmAt100))
      : 0,
  );
  const [status, setStatus] = useState(
    ballisticHold
      ? `Kestrel AB dialt: ${formatHoldClicks(ballisticHold)} · F = fokus+merke · slipp Space på merket.`
      : "Skru elevation + windage · F = fokus+merke · slipp Space på merket.",
  );
  const [hudTab, setHudTab] = useState<ScopeHudTab>("overhead");
  const hudTabRef = useRef(hudTab);
  hudTabRef.current = hudTab;
  const birdNerveRef = useRef(
    Math.min(ENCOUNTER_NERVE.nerveCap, Math.max(0, birdNerve)),
  );
  const camoBirdSpotRef = useRef(camoBirdSpot);
  camoBirdSpotRef.current = camoBirdSpot;
  const onGameSecondsRef = useRef(onGameSeconds);
  onGameSecondsRef.current = onGameSeconds;
  const onBirdFlushedFromWaitRef = useRef(onBirdFlushedFromWait);
  onBirdFlushedFromWaitRef.current = onBirdFlushedFromWait;
  const onNerveChangeRef = useRef(onNerveChange);
  onNerveChangeRef.current = onNerveChange;
  const onBackToAwareRef = useRef(onBackToAware);
  onBackToAwareRef.current = onBackToAware;
  const [focusUi, setFocusUi] = useState<{
    phase: "idle" | "focused" | "fatigued";
    remainingMs: number;
  }>({ phase: "idle", remainingMs: 0 });
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
    setFocusBarFatigued,
    resetFocusProgress,
  } = useFocusBarPaint();
  const scopeWorldRef = useRef<HTMLDivElement>(null);
  const targetScaleRef = useRef(1);
  const vitalOffRef = useRef({ x: 0, y: 0 });
  const geomRef = useRef(shotGeom);
  geomRef.current = shotGeom;
  const [recoilActive, setRecoilActive] = useState(false);
  const [fired, setFired] = useState(false);
  const [lastImpact, setLastImpact] = useState<{
    xMm: number;
    yMm: number;
    diameterMm: number;
  } | null>(null);
  const [replay, setReplay] = useState<HuntShotResult | null>(null);

  // Shoot HUD: same still-nerve rate as Aware (real seconds). Enviro only speeds the clock.
  useEffect(() => {
    if (fired) return;
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
        camoBirdSpot: camoBirdSpotRef.current,
      });
      birdNerveRef.current = tick.nerve;
      onNerveChangeRef.current?.(tick.nerve);
      if (tick.flushes) {
        onBirdFlushedFromWaitRef.current?.();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [fired]);

  function leaveToAware() {
    if (firedRef.current) return;
    const nerve = birdNerveRef.current;
    if (onBackToAwareRef.current) {
      onBackToAwareRef.current(nerve);
      return;
    }
    onAbort();
  }

  const hasTriggercam = kitItems.some((i) => i.id === TRIGGERCAM_ITEM_ID);

  const keysRef = useRef<Keys>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const aimRef = useRef({ x: 0, y: 0 });
  const wobbleRef = useRef({ x: 0, y: 0 });
  const distanceRef = useRef(trueDistanceM);
  const crosswindRef = useRef(crosswindMs);
  const firedRef = useRef(false);
  const wobblePhase = useRef({ a: Math.random() * 10, b: Math.random() * 10 });
  const weaponCalmRef = useRef(1);
  const fatigueRef = useRef({
    physicalFatigue: physicalFatigue,
    mentalFatigue: mentalFatigue,
  });
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
  const recoilClearRef = useRef<number | null>(null);

  const { playShot } = useRangeAudio({ enabled: musicEnabled });

  const selectedAmmo = ammoOptions.find((a) => a.id === ammoId) ?? null;
  const ammoRemaining = selectedAmmo
    ? getInventoryQty(inventory, selectedAmmo.id)
    : 0;
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
        trueDistanceM,
      )
    : {
        xMm: angularMmAtDistance(sessionZeroXMm, trueDistanceM),
        yMm: angularMmAtDistance(sessionZeroYMm, trueDistanceM),
      };

  const calmFactor = useMemo(
    () =>
      computeWeaponCalmFactor({
        hasBipod: !!bipod,
        bipod: bipod?.bipod,
        suppressorWeightGrams: suppressor?.weightGrams,
      }),
    [bipod, suppressor],
  );

  useEffect(() => {
    weaponCalmRef.current = calmFactor;
  }, [calmFactor]);
  useEffect(() => {
    fatigueRef.current = { physicalFatigue, mentalFatigue };
  }, [physicalFatigue, mentalFatigue]);
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

  const densityRef = useRef(densityRatio);
  useEffect(() => {
    densityRef.current = densityRatio;
  }, [densityRatio]);
  const powderTempRef = useRef(temperatureC);
  useEffect(() => {
    powderTempRef.current = temperatureC;
  }, [temperatureC]);

  /** Kestrel AB auto-dials elev + windage from fasit. */
  useEffect(() => {
    if (!ballisticHold || !selectedAmmo || fired) return;
    const hold = exactBallisticHold(
      selectedAmmo.ammo,
      measuredDistanceM,
      crosswindMs,
      { densityRatio, powderTempC: temperatureC },
    );
    setSessionZeroXMm(clampTurretMm(Math.round(hold.dialXMmAt100)));
    setSessionZeroYMm(clampTurretMm(Math.round(hold.dialYMmAt100)));
    setStatus(`Kestrel AB dialt: ${formatHoldClicks(hold)} · hold F · Space.`);
  }, [
    ammoId,
    selectedAmmo,
    measuredDistanceM,
    crosswindMs,
    densityRatio,
    temperatureC,
    ballisticHold,
    fired,
  ]);
  useEffect(() => {
    if (!rifle || !scope || !selectedAmmo) return;
    onEnsureZeroing(rifle.id, scope.id, selectedAmmo.id);
  }, [rifle, scope, selectedAmmo, onEnsureZeroing]);

  useEffect(() => {
    if (scope) {
      setZoom(clampScopeZoom(DEFAULT_SCOPE_ZOOM, scope.scope));
    }
  }, [scope]);

  fireShotRef.current = () => {
    if (!ready || !rifle || !selectedAmmo || !scope || firedRef.current) return;
    if (getInventoryQty(inventory, selectedAmmo.id) <= 0) {
      setStatus("Tom for ammo.");
      return;
    }
    if (!consumeAmmoRef.current(selectedAmmo.id)) {
      setStatus("Tom for ammo.");
      return;
    }

    const { affinity, map, rolled } = ensureAmmoAffinity(
      ammoAffinities,
      rifle.id,
      selectedAmmo.id,
    );
    if (rolled) onAffinitiesChange(map);

    const w = wobbleRef.current;
    const dispersionInput = {
      rifle: rifle.rifle,
      ammo: selectedAmmo.ammo,
      stock: stock?.stock,
      affinity,
      customsMoaDelta,
      dispersionScale: fatigueDispersionFactor(fatigueRef.current),
    };
    const envelopeMoa = combinedDispersionMoa(dispersionInput);
    const pull = triggerPullOffsetMm(
      triggerPullRef.current,
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
        densityRatio: densityRef.current,
        powderTempC: powderTempRef.current,
      },
    );
    // Spin is already in `shot`; add local wind drift separately.
    const windMm = exactBallisticHold(
      selectedAmmo.ammo,
      distanceRef.current,
      crosswindRef.current,
      {
        densityRatio: densityRef.current,
        powderTempC: powderTempRef.current,
      },
    ).windDriftMm;
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
    const impact = {
      xMm: shot.xMm + realizedZero.xMm + windMm,
      yMm: shot.yMm + realizedZero.yMm,
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
      }, 320);
    });

    const { kind, zone } = classifyHuntShot(
      impact.xMm,
      impact.yMm,
      selectedAmmo.ammo.damageFactor,
      Math.random,
      shotGeom,
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
    setStatus(
      kind === "instant_kill"
        ? pullLabel + "Instant kill (grønn sone)!"
        : kind === "vital_kill"
          ? pullLabel + "Vitalt treff — fuglen faller."
          : kind === "ettersok"
            ? zone === "vital"
              ? pullLabel + "Vitalt treff, men trenger ettersøk…"
              : pullLabel + "Treff i kroppen — ettersøk."
            : pullLabel + "Bom.",
    );
    if (hasTriggercam) {
      setReplay(result);
    } else {
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
    if (focusRef.current.held || firedRef.current) return;
    focusRef.current = { held: true, startedAtMs: nowMs };
    const markMs = rollTriggerTargetMs();
    triggerMarkRef.current = markMs;
    resetTriggerProgress();
    paintFocusProgress(1);
    setFocusBarFatigued(false);
    setTriggerUi({
      pending: false,
      targetPct: markMs / TRIGGER_BAR_MS,
    });
  }

  function endFocus() {
    focusRef.current = { held: false, startedAtMs: 0 };
    if (triggerRef.current.held) {
      abortTrigger("Fokus sluppet — avtrekk avbrutt.");
    }
    triggerMarkRef.current = null;
    resetTriggerProgress();
    resetFocusProgress();
    setTriggerUi({ pending: false, targetPct: 0 });
  }

  function beginTrigger(nowMs: number) {
    if (firedRef.current) return;
    if (triggerRef.current.held) return;
    if (!focusRef.current.held || triggerMarkRef.current == null) {
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
    if (!trig.held || trig.startedAtMs == null || markMs == null) {
      triggerRef.current = { held: false, startedAtMs: null };
      resetTriggerProgress();
      setTriggerUi((prev) => ({
        ...prev,
        pending: false,
      }));
      return;
    }
    if (!focusRef.current.held) {
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (!firedRef.current) leaveToAware();
        return;
      }
      if (!ready || firedRef.current) return;
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
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        beginFocus(performance.now());
      } else if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        beginTrigger(performance.now());
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        if (scope) {
          setZoom((z) => clampScopeZoom(z + 0.5, scope.scope));
        }
      } else if (e.key === "-") {
        e.preventDefault();
        if (scope) {
          setZoom((z) => clampScopeZoom(z - 0.5, scope.scope));
        }
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "ArrowUp") keysRef.current.up = false;
      if (e.key === "ArrowDown") keysRef.current.down = false;
      if (e.key === "ArrowLeft") keysRef.current.left = false;
      if (e.key === "ArrowRight") keysRef.current.right = false;
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
  }, [ready, scope, onAbort, onBackToAware]);

  useEffect(() => {
    if (!ready || fired) return;
    let raf = 0;
    let last = performance.now();
    let uiAccum = 0;

    function paintScopeWorld() {
      const el = scopeWorldRef.current;
      if (!el) return;
      const ax = aimRef.current.x + wobbleRef.current.x;
      const ay = aimRef.current.y + wobbleRef.current.y;
      const scale = targetScaleRef.current;
      const vo = vitalOffRef.current;
      const g = geomRef.current;
      const panPxX = (vo.x + birdMmToNativePx(ax, g)) * scale;
      const panPxY = (vo.y + birdMmToNativePx(ay, g)) * scale;
      el.style.transform = `translate(calc(-50% - ${panPxX}px), calc(-50% - ${panPxY}px)) scale(${scale})`;
    }

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = keysRef.current;
      let { x, y } = aimRef.current;
      const distFactor = distanceRef.current / 100;
      const speed = AIM_SPEED_MM_PER_SEC * distFactor * dt;
      if (k.left) x -= speed;
      if (k.right) x += speed;
      if (k.up) y -= speed;
      if (k.down) y += speed;
      const aimLimit = 120 * distFactor;
      x = Math.max(-aimLimit, Math.min(aimLimit, x));
      y = Math.max(-aimLimit, Math.min(aimLimit, y));
      aimRef.current = { x, y };

      const calm = effectiveCalmWithFocus(
        weaponCalmRef.current,
        focusRef.current,
        now,
        fatigueRef.current,
      );
      const amp = wobbleAmplitudeMm(calm, distanceRef.current);
      const t = now / 1000;
      const ph = wobblePhase.current;
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
        const prog = Math.min(1, elapsed / TRIGGER_BAR_MS);
        paintTriggerProgress(prog);
        if (elapsed >= TRIGGER_BAR_MS) {
          releaseTrigger(trig.startedAtMs + TRIGGER_BAR_MS);
        }
      }

      const fPhase = focusPhase(focusRef.current, now);
      if (fPhase === "focused") {
        paintFocusProgress(focusRemainingMs(focusRef.current, now) / FOCUS_HOLD_MS);
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
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, fired]);

  function nudgeZero(axis: "x" | "y", deltaMm: number) {
    if (fired) return;
    if (axis === "x") {
      setSessionZeroXMm((prev) => clampTurretMm(prev + deltaMm));
      return;
    }
    setSessionZeroYMm((prev) => clampTurretMm(prev + deltaMm));
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

  const reticleScale = scopeImageScale(zoom, scope.scope, RANGE_DISTANCE_M);
  const targetScale = birdScopeImageScale(
    zoom,
    scope.scope,
    trueDistanceM,
    shotGeom.nativeW,
  );
  const vitalBase = birdVitalOffsetFromImageCenterPx(shotGeom);
  // Flipped sprite mirrors vital X around image centre — keep reticle on chest.
  const vitalOff = birdFlip
    ? { x: -vitalBase.x, y: vitalBase.y }
    : vitalBase;
  targetScaleRef.current = targetScale;
  vitalOffRef.current = vitalOff;

  const activeHold =
    ballisticHold && selectedAmmo
      ? exactBallisticHold(
          selectedAmmo.ammo,
          measuredDistanceM,
          crosswindMs,
          { densityRatio, powderTempC: temperatureC },
        )
      : null;

  if (replay && lastImpact) {
    return (
      <HuntShotAarView
        title="Triggercam — after action"
        birdFlip={birdFlip}
        birdSpriteId={birdSpriteId}
        hit={{
          xMm: lastImpact.xMm,
          yMm: lastImpact.yMm,
          diameterMm: lastImpact.diameterMm,
          zone: replay.zone,
          kind: replay.kind,
        }}
        subtitle={`${status} · treff ${lastImpact.xMm >= 0 ? "+" : ""}${lastImpact.xMm.toFixed(0)} mm side / ${
          lastImpact.yMm >= 0 ? "+" : ""
        }${lastImpact.yMm.toFixed(0)} mm høyde (fra vital-senter) · sone ${replay.zone}`}
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
        <p className="intro-line intro-gift">Fugl observert — skyt!</p>
        <p className="shop-row-note">
          Kl {formatHuntClock(clockMinutes)}
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
          vital grønn Ø{TIUR_INSTANT_KILL_DIAMETER_MM} mm / rød Ø
          {TIUR_VITAL_DIAMETER_MM} mm
          {activeHold ? " · Kestrel i kit (fane)" : null}
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
                {a.brand} {a.name} · {getInventoryQty(inventory, a.id)} igjen
              </option>
            ))}
          </select>
        </label>
        <span className="range-shot-count">Patroner {ammoRemaining}</span>
        <span className="shop-row-note">
          Zoom {zoom.toFixed(1)}× — dra ringen over kikkerten (kl. 8→12→4)
        </span>
      </div>

      <div className="hunt-shoot-dope-row">
        <ScopeTurrets
          sessionZeroXMm={sessionZeroXMm}
          sessionZeroYMm={sessionZeroYMm}
          onNudge={nudgeZero}
          disabled={fired}
          onHudTabChange={setHudTab}
          enviroPanel={
            <HuntShotConditions
              rangeM={measuredDistanceM}
              rangeSource={rangeSource}
              shotBearingDeg={shotBearingDeg}
              windFromDeg={windFromDeg}
              windSpeedMs={windSpeedMs}
              temperatureC={temperatureC}
              hasKestrel={!!activeHold}
              dopeCard={dopeCard}
              ammoId={ammoId}
              rifleId={rifle?.id ?? null}
              ammo={selectedAmmo?.ammo ?? null}
              ammoLabel={
                selectedAmmo
                  ? `${selectedAmmo.brand} ${selectedAmmo.name}`
                  : "Ammo"
              }
            />
          }
          kestrelPanel={
            activeHold ? (
              <KestrelFasitView
                hold={activeHold}
                shotBearingDeg={shotBearingDeg}
                windFromDeg={windFromDeg}
                windSpeedMs={windSpeedMs}
              />
            ) : undefined
          }
          actions={
            <button
              type="button"
              className="intro-button sheriff-secondary"
              disabled={fired}
              onClick={leaveToAware}
            >
              Back to Aware
            </button>
          }
        />
      </div>

      <div className="scope-stage" tabIndex={0}>
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
              {focusUi.phase === "focused"
                ? `Fokus ${(focusUi.remainingMs / 1000).toFixed(1)}s`
                : focusUi.phase === "fatigued"
                  ? "Utmatt"
                  : "Fokus"}
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
                recoilActive ? "scope-viewport is-recoiling" : "scope-viewport"
              }
            >
              <div ref={scopeWorldRef} className="scope-world">
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
              </div>
              <ScopeReticle
                scope={scope.scope}
                zoom={zoom}
                imgScale={reticleScale}
              />
            </div>
            <ScopeZoomRing
              scope={scope.scope}
              zoom={zoom}
              onChange={(z) => setZoom(z)}
              disabled={fired}
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
                <span className="range-trigger-mark" aria-hidden />
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
            disabled={fired}
            onPointerDown={(e) => {
              e.preventDefault();
              beginFocus(performance.now());
            }}
            onPointerUp={endFocus}
            onPointerCancel={endFocus}
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
            disabled={fired}
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
