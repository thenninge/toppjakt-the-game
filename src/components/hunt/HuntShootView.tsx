"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FOCUS_HOLD_MS,
  TRIGGER_DELAY_MAX_MS,
  caliberBulletDiameterMm,
  clampScopeZoom,
  computeWeaponCalmFactor,
  effectiveCalmWithFocus,
  ensureAmmoAffinity,
  focusPhase,
  focusRemainingMs,
  sampleShotFromPoa,
  scopeImageScale,
  wobbleAmplitudeMm,
  RANGE_DISTANCE_M,
} from "@/lib/range/precision";
import {
  dropBelowLosMm,
  sampleTrajectory,
} from "@/lib/ballistics/trajectory";
import {
  exactBallisticHold,
  formatHoldClicks,
  type BallisticHoldSolution,
} from "@/lib/ballistics/solver";
import { ScopeReticle } from "@/components/range/ScopeReticle";
import { KestrelFasitView } from "@/components/hunt/KestrelFasitView";
import { useRangeAudio } from "@/components/range/useRangeAudio";
import {
  angularMmAtDistance,
  clampTurretMm,
  clicksForDropMm,
  effectiveZeroOffsetMm,
  getInventoryQty,
  ZERO_CLICK_MM,
  zeroingKey,
  type InventoryEntry,
  type ZeroingProfile,
} from "@/lib/player";
import {
  isAmmoItem,
  isBipodItem,
  isRifleItem,
  isScopeItem,
  isStockItem,
  type ShopItem,
} from "@/lib/shop/types";
import {
  classifyHuntShot,
  TIUR_IMAGE_NATIVE_H,
  TIUR_IMAGE_NATIVE_W,
  TIUR_INSTANT_KILL_DIAMETER_MM,
  TIUR_TARGET_SRC,
  TIUR_VITAL_DIAMETER_MM,
  TRIGGERCAM_ITEM_ID,
  tiurMmToNativePx,
  tiurScopeImageScale,
  tiurVitalOffsetFromImageCenterPx,
  type HuntShotResult,
} from "@/lib/hunt/shoot";
import { formatHuntClock } from "@/lib/hunt/travel";
import type { CSSProperties } from "react";

type HuntShootViewProps = {
  /** True ballistic distance (bird). */
  trueDistanceM: number;
  /** What LRF showed (player dials from this). */
  measuredDistanceM: number;
  /** Exact BDX+Kestrel hold from perfect zero (null if not equipped). */
  ballisticHold?: BallisticHoldSolution | null;
  /** True local crosswind (m/s, +from left) for this shot bearing. */
  crosswindMs?: number;
  /** Atmosphere density ratio from live temperature. */
  densityRatio?: number;
  /** Shot bearing toward bird (for Kestrel LCD). */
  shotBearingDeg?: number;
  windFromDeg?: number;
  windSpeedMs?: number;
  clockMinutes: number;
  kitItems: ShopItem[];
  inventory: InventoryEntry[];
  ammoAffinities: Record<string, number>;
  zeroingProfiles: Record<string, ZeroingProfile>;
  onAffinitiesChange: (next: Record<string, number>) => void;
  onConsumeAmmo: (ammoId: string) => boolean;
  onEnsureZeroing: (
    rifleId: string,
    scopeId: string,
    ammoId: string,
  ) => ZeroingProfile;
  musicEnabled: boolean;
  /** Hunt BODY fatigue 0–1 (1 = exhausted). Increases weapon shake. */
  physicalFatigue?: number;
  /** Hunt MIND fatigue 0–1 (1 = exhausted). Increases weapon shake. */
  mentalFatigue?: number;
  onAbort: () => void;
  onShotResult: (result: HuntShotResult) => void;
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
  ballisticHold = null,
  crosswindMs = 0,
  densityRatio = 1,
  shotBearingDeg = 0,
  windFromDeg = 0,
  windSpeedMs = 0,
  clockMinutes,
  kitItems,
  inventory,
  ammoAffinities,
  zeroingProfiles,
  onAffinitiesChange,
  onConsumeAmmo,
  onEnsureZeroing,
  musicEnabled,
  physicalFatigue = 0,
  mentalFatigue = 0,
  onAbort,
  onShotResult,
}: HuntShootViewProps) {
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
  const [aimMm, setAimMm] = useState({ x: 0, y: 0 });
  const [wobbleMm, setWobbleMm] = useState({ x: 0, y: 0 });
  const [status, setStatus] = useState(
    ballisticHold
      ? `Kestrel AB dialt: ${formatHoldClicks(ballisticHold)} · hold F · Space.`
      : "Skru elevation + windage (vind × skyteretning) · hold F · Space.",
  );
  const [focusUi, setFocusUi] = useState<{
    phase: "idle" | "focused" | "fatigued";
    remainingMs: number;
  }>({ phase: "idle", remainingMs: 0 });
  const [triggerUi, setTriggerUi] = useState({
    pending: false,
    progress: 0,
  });
  const [recoilActive, setRecoilActive] = useState(false);
  const [fired, setFired] = useState(false);
  const [lastImpact, setLastImpact] = useState<{
    xMm: number;
    yMm: number;
    diameterMm: number;
  } | null>(null);
  const [replay, setReplay] = useState<HuntShotResult | null>(null);

  const hasTriggercam = kitItems.some((i) => i.id === TRIGGERCAM_ITEM_ID);

  const keysRef = useRef<Keys>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const aimRef = useRef(aimMm);
  const wobbleRef = useRef(wobbleMm);
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
  const triggerRef = useRef<{
    held: boolean;
    fireAtMs: number | null;
    startedAtMs: number | null;
  }>({ held: false, fireAtMs: null, startedAtMs: null });
  const fireShotRef = useRef(() => {});
  const playShotRef = useRef<(hasSuppressor: boolean) => void>(() => {});
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
  const zeroClicksX = Math.round(sessionZeroXMm / ZERO_CLICK_MM);
  const zeroClicksY = Math.round(sessionZeroYMm / ZERO_CLICK_MM);

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
    aimRef.current = aimMm;
  }, [aimMm]);
  useEffect(() => {
    wobbleRef.current = wobbleMm;
  }, [wobbleMm]);
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

  /** Kestrel AB auto-dials elev + windage from fasit. */
  useEffect(() => {
    if (!ballisticHold || !selectedAmmo || fired) return;
    const hold = exactBallisticHold(
      selectedAmmo.ammo,
      measuredDistanceM,
      crosswindMs,
      { densityRatio },
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
    const poa = {
      xMm: aimRef.current.x + w.x,
      yMm: aimRef.current.y + w.y,
    };
    const shot = sampleShotFromPoa(
      poa,
      {
        rifle: rifle.rifle,
        ammo: selectedAmmo.ammo,
        stock: stock?.stock,
        affinity,
      },
      distanceRef.current,
      Math.random,
      { densityRatio: densityRef.current },
    );
    // Spin is already in `shot`; add local wind drift separately.
    const windMm = exactBallisticHold(
      selectedAmmo.ammo,
      distanceRef.current,
      crosswindRef.current,
      { densityRatio: densityRef.current },
    ).windDriftMm;
    const impact = {
      xMm: shot.xMm + effectiveZero.xMm + windMm,
      yMm: shot.yMm + effectiveZero.yMm,
      diameterMm: caliberBulletDiameterMm(selectedAmmo.ammo.caliber),
    };

    firedRef.current = true;
    setFired(true);
    setLastImpact(impact);
    playShotRef.current(!!suppressor);
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
    );
    const impactVelocityMps = sampleTrajectory(
      selectedAmmo.ammo,
      distanceRef.current,
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
      v0: selectedAmmo.ammo.v0,
    };
    setStatus(
      kind === "instant_kill"
        ? "Instant kill (grønn sone)!"
        : kind === "vital_kill"
          ? "Vitalt treff — fuglen faller."
          : kind === "ettersok"
            ? zone === "vital"
              ? "Vitalt treff, men trenger ettersøk…"
              : "Treff i kroppen — ettersøk."
            : "Bom.",
    );
    if (hasTriggercam) {
      setReplay(result);
    } else {
      window.setTimeout(() => onShotResult(result), 900);
    }
  };

  function abortTrigger(reason: string) {
    triggerRef.current = { held: false, fireAtMs: null, startedAtMs: null };
    setTriggerUi({ pending: false, progress: 0 });
    if (reason) setStatus(reason);
  }

  function beginFocus(nowMs: number) {
    if (focusRef.current.held || firedRef.current) return;
    focusRef.current = { held: true, startedAtMs: nowMs };
  }

  function endFocus() {
    focusRef.current = { held: false, startedAtMs: 0 };
  }

  function beginTrigger(nowMs: number) {
    if (firedRef.current) return;
    if (triggerRef.current.held) return;
    const delay = Math.random() * TRIGGER_DELAY_MAX_MS;
    triggerRef.current = {
      held: true,
      fireAtMs: nowMs + delay,
      startedAtMs: nowMs,
    };
    setTriggerUi({ pending: true, progress: 0 });
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (!firedRef.current) onAbort();
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
        if (triggerRef.current.held && triggerRef.current.fireAtMs != null) {
          const now = performance.now();
          if (now < triggerRef.current.fireAtMs) {
            abortTrigger("Avtrekk avbrutt.");
          }
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [ready, scope, onAbort]);

  useEffect(() => {
    if (!ready || fired) return;
    let raf = 0;
    let last = performance.now();
    let uiAccum = 0;

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
      setAimMm({ x, y });

      const calm = effectiveCalmWithFocus(
        weaponCalmRef.current,
        focusRef.current,
        now,
        fatigueRef.current,
      );
      const amp = wobbleAmplitudeMm(calm, distanceRef.current);
      const t = now / 1000;
      const ph = wobblePhase.current;
      const nextWobble = {
        x:
          Math.sin(t * 2.1 + ph.a) * amp * 0.55 +
          Math.sin(t * 5.3 + ph.b) * amp * 0.35 +
          Math.sin(t * 11.0) * amp * 0.15,
        y:
          Math.cos(t * 1.7 + ph.b) * amp * 0.55 +
          Math.cos(t * 4.6 + ph.a) * amp * 0.35 +
          Math.sin(t * 9.5 + 1) * amp * 0.15,
      };
      wobbleRef.current = nextWobble;
      setWobbleMm(nextWobble);

      const trig = triggerRef.current;
      if (trig.held && trig.fireAtMs != null && trig.startedAtMs != null) {
        const prog = Math.min(
          1,
          (now - trig.startedAtMs) / (trig.fireAtMs - trig.startedAtMs),
        );
        setTriggerUi({ pending: true, progress: prog });
        if (now >= trig.fireAtMs) {
          triggerRef.current = {
            held: false,
            fireAtMs: null,
            startedAtMs: null,
          };
          setTriggerUi({ pending: false, progress: 0 });
          fireShotRef.current();
        }
      }

      uiAccum += dt;
      if (uiAccum > 0.05) {
        uiAccum = 0;
        setFocusUi({
          phase: focusPhase(focusRef.current, now),
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
        <button type="button" className="intro-button" onClick={onAbort}>
          Avbryt
        </button>
      </div>
    );
  }

  const reticleScale = scopeImageScale(zoom, scope.scope, RANGE_DISTANCE_M);
  const targetScale = tiurScopeImageScale(
    zoom,
    scope.scope,
    trueDistanceM,
  );
  const displayAimX = aimMm.x + wobbleMm.x;
  const displayAimY = aimMm.y + wobbleMm.y;
  const vitalOff = tiurVitalOffsetFromImageCenterPx();
  const panPxX =
    (vitalOff.x + tiurMmToNativePx(displayAimX)) * targetScale;
  const panPxY =
    (vitalOff.y + tiurMmToNativePx(displayAimY)) * targetScale;

  const dropMmBelieved = selectedAmmo
    ? dropBelowLosMm(selectedAmmo.ammo, measuredDistanceM)
    : 0;
  const dropClicks = clicksForDropMm(dropMmBelieved, measuredDistanceM);
  const activeHold =
    ballisticHold && selectedAmmo
      ? exactBallisticHold(
          selectedAmmo.ammo,
          measuredDistanceM,
          crosswindMs,
          { densityRatio },
        )
      : null;

  if (replay && lastImpact) {
    const aarScale = 2.4;
    const vitalOffAar = tiurVitalOffsetFromImageCenterPx();
    const greenD = tiurMmToNativePx(TIUR_INSTANT_KILL_DIAMETER_MM) * aarScale;
    const redD = tiurMmToNativePx(TIUR_VITAL_DIAMETER_MM) * aarScale;
    const holeD = Math.max(
      6,
      tiurMmToNativePx(lastImpact.diameterMm) * aarScale,
    );
    const hitX =
      (TIUR_IMAGE_NATIVE_W / 2 +
        vitalOffAar.x +
        tiurMmToNativePx(lastImpact.xMm)) *
      aarScale;
    const hitY =
      (TIUR_IMAGE_NATIVE_H / 2 +
        vitalOffAar.y +
        tiurMmToNativePx(lastImpact.yMm)) *
      aarScale;
    const zoneCx =
      (TIUR_IMAGE_NATIVE_W / 2 + vitalOffAar.x) * aarScale;
    const zoneCy =
      (TIUR_IMAGE_NATIVE_H / 2 + vitalOffAar.y) * aarScale;

    return (
      <div
        className="shooting-range hunt-shoot"
        role="dialog"
        aria-modal="true"
        aria-label="Triggercam replay"
      >
        <header className="shop-header">
          <p className="intro-line intro-gift">Triggercam — after action</p>
          <p className="shop-row-note">
            {status} · treff {lastImpact.xMm >= 0 ? "+" : ""}
            {lastImpact.xMm.toFixed(0)} mm side /{" "}
            {lastImpact.yMm >= 0 ? "+" : ""}
            {lastImpact.yMm.toFixed(0)} mm høyde (fra vital-senter)
            {" · "}
            sone {replay.zone}
          </p>
        </header>
        <div className="triggercam-aar">
          <div
            className="triggercam-aar-frame"
            style={{
              width: TIUR_IMAGE_NATIVE_W * aarScale,
              height: TIUR_IMAGE_NATIVE_H * aarScale,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={TIUR_TARGET_SRC}
              alt="Tiur"
              className="triggercam-aar-bird"
              width={TIUR_IMAGE_NATIVE_W * aarScale}
              height={TIUR_IMAGE_NATIVE_H * aarScale}
              draggable={false}
            />
            <span
              className="triggercam-zone triggercam-zone--vital"
              style={{
                width: redD,
                height: redD,
                left: zoneCx,
                top: zoneCy,
                marginLeft: -redD / 2,
                marginTop: -redD / 2,
              }}
            />
            <span
              className="triggercam-zone triggercam-zone--instant"
              style={{
                width: greenD,
                height: greenD,
                left: zoneCx,
                top: zoneCy,
                marginLeft: -greenD / 2,
                marginTop: -greenD / 2,
              }}
            />
            <span
              className="bullet-hole triggercam-aar-hole"
              style={{
                width: holeD,
                height: holeD,
                left: hitX,
                top: hitY,
                marginLeft: -holeD / 2,
                marginTop: -holeD / 2,
              }}
            />
          </div>
          <p className="spot-binos-hint">
            Rød ring = vital · grønn = instant kill · rødt hull = treffpunkt
          </p>
          <button
            type="button"
            className="intro-button"
            onClick={() => onShotResult(replay)}
          >
            Fortsett
          </button>
        </div>
      </div>
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
          Kl {formatHuntClock(clockMinutes)} · LRF {measuredDistanceM} m
          {" · "}
          vital grønn Ø{TIUR_INSTANT_KILL_DIAMETER_MM} mm / rød Ø
          {TIUR_VITAL_DIAMETER_MM} mm
          {activeHold ? (
            <>
              {" · "}
              Kestrel fasit: {formatHoldClicks(activeHold)}
              {" · "}
              crosswind {crosswindMs >= 0 ? "+" : ""}
              {crosswindMs.toFixed(1)} m/s
            </>
          ) : (
            <>
              {" · "}
              drop ≈ {Math.round(dropClicks)} klikk (
              {(Math.abs(dropClicks) / 10).toFixed(1)} mil)
              {" · "}
              crosswind {crosswindMs >= 0 ? "+" : ""}
              {crosswindMs.toFixed(1)} m/s
            </>
          )}
        </p>
        <p className="shop-row-note">
          {rifle.brand} {rifle.name} · {scope.brand} {scope.name} (
          {zoom.toFixed(1)}×) · {status}
        </p>
      </header>

      {activeHold ? (
        <KestrelFasitView
          hold={activeHold}
          shotBearingDeg={shotBearingDeg}
          windFromDeg={windFromDeg}
          windSpeedMs={windSpeedMs}
        />
      ) : null}

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
        <label className="shop-filter range-zoom-slider">
          Zoom {zoom.toFixed(1)}×
          <input
            type="range"
            min={scope.scope.minZoom}
            max={scope.scope.maxZoom}
            step={0.1}
            value={zoom}
            disabled={fired}
            onChange={(e) =>
              setZoom(clampScopeZoom(Number(e.target.value), scope.scope))
            }
          />
        </label>
      </div>

      <div className="range-zero-panel">
        <div className="range-zero-group">
          <span className="shop-row-note">
            Windage:{" "}
            {zeroClicksX === 0
              ? "0.0 mil"
              : `${Math.abs(zeroClicksX / 10).toFixed(1)} mil ${
                  zeroClicksX < 0 ? "L" : "R"
                }`}
          </span>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            disabled={fired}
            onClick={() => nudgeZero("x", -ZERO_CLICK_MM)}
          >
            Windage L
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            disabled={fired}
            onClick={() => nudgeZero("x", ZERO_CLICK_MM)}
          >
            Windage R
          </button>
        </div>
        <div className="range-zero-group">
          <span className="shop-row-note">
            Elevation:{" "}
            {zeroClicksY === 0
              ? "0.0 mil"
              : `${Math.abs(zeroClicksY / 10).toFixed(1)} mil ${
                  zeroClicksY < 0 ? "U" : "D"
                }`}
          </span>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            disabled={fired}
            onClick={() => nudgeZero("y", -ZERO_CLICK_MM)}
          >
            Elevation U
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            disabled={fired}
            onClick={() => nudgeZero("y", ZERO_CLICK_MM)}
          >
            Elevation D
          </button>
        </div>
        <button
          type="button"
          className="intro-button sheriff-secondary"
          disabled={fired}
          onClick={onAbort}
        >
          Avbryt
        </button>
      </div>

      <div className="scope-stage" tabIndex={0}>
        <div
          className={
            recoilActive ? "scope-viewport is-recoiling" : "scope-viewport"
          }
        >
          <div
            className="scope-world"
            style={{
              transform: `translate(calc(-50% - ${panPxX}px), calc(-50% - ${panPxY}px)) scale(${targetScale})`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="scope-target hunt-tiur-target"
              src={TIUR_TARGET_SRC}
              alt="Tiur"
              draggable={false}
              width={TIUR_IMAGE_NATIVE_W}
              height={TIUR_IMAGE_NATIVE_H}
              style={{ width: TIUR_IMAGE_NATIVE_W, height: TIUR_IMAGE_NATIVE_H }}
            />
            {lastImpact ? (
              <span
                className="bullet-hole"
                style={{
                  width: tiurMmToNativePx(lastImpact.diameterMm),
                  height: tiurMmToNativePx(lastImpact.diameterMm),
                  left: `calc(50% + ${vitalOff.x + tiurMmToNativePx(lastImpact.xMm)}px)`,
                  top: `calc(50% + ${vitalOff.y + tiurMmToNativePx(lastImpact.yMm)}px)`,
                  marginLeft: -tiurMmToNativePx(lastImpact.diameterMm) / 2,
                  marginTop: -tiurMmToNativePx(lastImpact.diameterMm) / 2,
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

        <div className="range-timer-stack">
          <div className="range-timer-row">
            <span
              className={
                focusUi.phase === "focused"
                  ? "range-focus is-focused"
                  : focusUi.phase === "fatigued"
                    ? "range-focus is-fatigued"
                    : "range-focus"
              }
            >
              {focusUi.phase === "focused"
                ? `Fokus ${(focusUi.remainingMs / 1000).toFixed(1)} s`
                : focusUi.phase === "fatigued"
                  ? "Utmatt"
                  : "Fokus (F)"}
            </span>
            <div
              className={
                focusUi.phase === "fatigued"
                  ? "range-focus-bar is-fatigued"
                  : "range-focus-bar"
              }
            >
              <span
                style={{
                  width:
                    focusUi.phase === "focused"
                      ? `${(focusUi.remainingMs / FOCUS_HOLD_MS) * 100}%`
                      : focusUi.phase === "fatigued"
                        ? "100%"
                        : "0%",
                }}
              />
            </div>
          </div>
          <div className="range-timer-row">
            <span
              className={
                triggerUi.pending ? "range-focus is-trigger" : "range-focus"
              }
            >
              Avtrekk
            </span>
            <div
              className="range-trigger-bar"
              style={
                {
                  ["--trigger-pct" as string]: `${triggerUi.progress * 100}%`,
                } as CSSProperties
              }
            />
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
              if (
                triggerRef.current.held &&
                triggerRef.current.fireAtMs != null &&
                performance.now() < triggerRef.current.fireAtMs
              ) {
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
