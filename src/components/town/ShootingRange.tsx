"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { LocationNav } from "@/components/town/LocationNav";
import {
  isAmmoItem,
  isBipodItem,
  isRifleItem,
  isScopeItem,
  isStockItem,
  type ShopItem,
} from "@/lib/shop/types";
import {
  FOCUS_HOLD_MS,
  SHOTS_PER_SERIES,
  TRIGGER_BAR_MS,
  caliberBulletDiameterMm,
  cbaBullseyeOffsetFromImageCenterPx,
  clampScopeZoom,
  combinedDispersionMoa,
  computeWeaponCalmFactor,
  effectiveCalmWithFocus,
  ensureAmmoAffinity,
  focusPhase,
  focusRemainingMs,
  measureGroup,
  mmToPx,
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
  DEFAULT_ZERO_DISTANCE_M,
  dropBelowLosMm,
} from "@/lib/ballistics/trajectory";
import { SeriesMeasureView } from "@/components/town/SeriesMeasureView";
import { ShotLogView } from "@/components/town/ShotLogView";
import { ScopeReticle } from "@/components/range/ScopeReticle";
import { useRangeAudio } from "@/components/range/useRangeAudio";
import {
  angularMmAtDistance,
  clampTurretMm,
  clicksForDropMm,
  effectiveZeroOffsetMm,
  getInventoryQty,
  MAX_TURRET_OFFSET_MM,
  ZERO_CLICK_MM,
  zeroingKey,
  type InventoryEntry,
  type ShotLogEntry,
  type ZeroingProfile,
} from "@/lib/player";

type ShootingRangeProps = {
  kitItems: ShopItem[];
  inventory: InventoryEntry[];
  ammoAffinities: Record<string, number>;
  zeroingProfiles: Record<string, ZeroingProfile>;
  shotLog: ShotLogEntry[];
  onAffinitiesChange: (next: Record<string, number>) => void;
  onConsumeAmmo: (ammoId: string) => boolean;
  onEnsureZeroing: (
    rifleId: string,
    scopeId: string,
    ammoId: string,
  ) => ZeroingProfile;
  onSaveZeroing: (key: string, sessionXMm: number, sessionYMm: number) => void;
  onLogSeries: (entry: ShotLogEntry) => void;
  musicEnabled: boolean;
  onLeave: () => void;
};

type Keys = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

const AIM_SPEED_MM_PER_SEC = 22;
const DEFAULT_SCOPE_ZOOM = 12;
const IMG_SRC = "/range/cba-detail.png";
const IMG_NATURAL_W = 949;
const IMG_NATURAL_H = 1024;

export function ShootingRange({
  kitItems,
  inventory,
  ammoAffinities,
  zeroingProfiles,
  shotLog,
  onAffinitiesChange,
  onConsumeAmmo,
  onEnsureZeroing,
  onSaveZeroing,
  onLogSeries,
  musicEnabled,
  onLeave,
}: ShootingRangeProps) {
  const [view, setView] = useState<"range" | "shotlog">("range");
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
  const [distanceM, setDistanceM] = useState<RangeDistanceM>(RANGE_DISTANCE_M);
  const [zoom, setZoom] = useState(DEFAULT_SCOPE_ZOOM);
  const [sessionZeroXMm, setSessionZeroXMm] = useState(0);
  const [sessionZeroYMm, setSessionZeroYMm] = useState(0);
  const [aimMm, setAimMm] = useState({ x: 0, y: 0 });
  const [wobbleMm, setWobbleMm] = useState({ x: 0, y: 0 });
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
    /** 0–1 while holding Space toward break. */
    progress: number;
    /** 0–1 mark on bar while focused. */
    targetPct: number;
  }>({ pending: false, progress: 0, targetPct: 0 });
  const [recoilActive, setRecoilActive] = useState(false);
  const recoilClearRef = useRef<number | null>(null);

  const keysRef = useRef<Keys>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const aimRef = useRef(aimMm);
  const wobbleRef = useRef(wobbleMm);
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
  const playShotRef = useRef<(hasSuppressor: boolean) => void>(() => {});
  const consumeAmmoRef = useRef(onConsumeAmmo);

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
        distanceM,
      )
    : {
        xMm: angularMmAtDistance(sessionZeroXMm, distanceM),
        yMm: angularMmAtDistance(sessionZeroYMm, distanceM),
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
    if (scope) {
      setZoom(clampScopeZoom(DEFAULT_SCOPE_ZOOM, scope.scope));
    }
  }, [scope]);

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
    wobbleRef.current = wobbleMm;
  }, [wobbleMm]);

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
    if (!ready || !rifle || !selectedAmmo) return;
    if (getInventoryQty(inventory, selectedAmmo.id) <= 0) {
      setStatus("Tom for ammo — kjøp mer hos Pike Pro.");
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
    if (!consumeAmmoRef.current(selectedAmmo.id)) {
      setStatus("Tom for ammo — kjøp mer hos Pike Pro.");
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
        rifle: rifle.rifle,
        ammo: selectedAmmo.ammo,
        stock: stock?.stock,
        affinity,
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
      );
      const impact: ShotImpact = {
        xMm: shot.xMm + effectiveZero.xMm,
        yMm: shot.yMm + effectiveZero.yMm,
        diameterMm: caliberBulletDiameterMm(selectedAmmo.ammo.caliber),
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
      setStatus(
        `Skudd ${prev.length + 1}/${SHOTS_PER_SERIES} · ${pullNote} · ${selectedAmmo.brand} ${selectedAmmo.name}`,
      );
      playShotRef.current(!!suppressor);
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
      return [...prev, impact];
    });
  };

  function abortTrigger(reason: string) {
    triggerRef.current = { held: false, startedAtMs: null };
    setTriggerUi((prev) => ({
      pending: false,
      progress: 0,
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
    setTriggerUi({
      pending: false,
      progress: 0,
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
    setTriggerUi({ pending: false, progress: 0, targetPct: 0 });
  }

  function releaseTrigger(nowMs: number) {
    const trig = triggerRef.current;
    const markMs = triggerMarkRef.current;
    if (!trig.held || trig.startedAtMs == null) {
      triggerRef.current = { held: false, startedAtMs: null };
      setTriggerUi((prev) => ({
        ...prev,
        pending: false,
        progress: 0,
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
    setTriggerUi((prev) => ({
      pending: false,
      progress: 0,
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
      setStatus("Tom for ammo — kjøp mer hos Pike Pro.");
      return;
    }
    triggerRef.current = {
      held: true,
      startedAtMs: nowMs,
    };
    setTriggerUi((prev) => ({ ...prev, pending: true, progress: 0 }));
    setStatus("Avtrekk… slipp Space på merket");
  }

  // Keyboard
  useEffect(() => {
    if (!ready) return;

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
      } else if (e.key === "+" || e.key === "=") {
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
      if (e.key === "ArrowUp") keysRef.current.up = false;
      if (e.key === "ArrowDown") keysRef.current.down = false;
      if (e.key === "ArrowLeft") keysRef.current.left = false;
      if (e.key === "ArrowRight") keysRef.current.right = false;
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

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = keysRef.current;
      let { x, y } = aimRef.current;
      const distFactor = distanceRef.current / RANGE_DISTANCE_M;
      const speed = AIM_SPEED_MM_PER_SEC * distFactor * dt;
      if (k.left) x -= speed;
      if (k.right) x += speed;
      if (k.up) y -= speed;
      if (k.down) y += speed;
      const aimLimit = 80 * distFactor;
      x = Math.max(-aimLimit, Math.min(aimLimit, x));
      y = Math.max(-aimLimit, Math.min(aimLimit, y));
      aimRef.current = { x, y };
      setAimMm({ x, y });

      const calm = effectiveCalmWithFocus(
        weaponCalmRef.current,
        focusRef.current,
        now,
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
      if (trig.held && trig.startedAtMs != null) {
        const elapsed = now - trig.startedAtMs;
        const progress = Math.min(1, Math.max(0, elapsed / TRIGGER_BAR_MS));
        setTriggerUi((prev) => ({
          ...prev,
          pending: true,
          progress,
        }));
        if (elapsed >= TRIGGER_BAR_MS) {
          releaseTrigger(trig.startedAtMs + TRIGGER_BAR_MS);
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
  }, [ready, measurement]);

  const zoomScale = scope
    ? scopeImageScale(zoom, scope.scope, RANGE_DISTANCE_M)
    : 1;
  /** Target shrinks with distance (angular size). Reticle uses zoom-only
   * scale so mil hashes stay true angular — a fixed mil error is the same
   * screen size at every distance. */
  const targetScale = scope
    ? scopeImageScale(zoom, scope.scope, distanceM)
    : 1;
  const displayAimX = aimMm.x + wobbleMm.x;
  const displayAimY = aimMm.y + wobbleMm.y;
  // POA: pan so the point under the reticle is aim+wobble relative to bullseye
  // (bullseye ≠ PNG center — offset measured on cba-detail.png).
  const bullseyeOff = cbaBullseyeOffsetFromImageCenterPx(
    IMG_NATURAL_W,
    IMG_NATURAL_H,
  );
  const panPxX =
    (bullseyeOff.x + mmToPx(displayAimX, IMG_NATURAL_W)) * targetScale;
  const panPxY =
    (bullseyeOff.y + mmToPx(displayAimY, IMG_NATURAL_W)) * targetScale;

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
        zeroXMm: effectiveZero.xMm,
        zeroYMm: effectiveZero.yMm,
        savedZeroXMm: zeroProfile?.savedXMm ?? 0,
        savedZeroYMm: zeroProfile?.savedYMm ?? 0,
        sessionZeroXMm,
        sessionZeroYMm,
      };
      onLogSeries(entry);
      setStatus("Serie målt og logget — se stillbilde eller Shotlog.");
    }
  }

  function newSeries() {
    setShots([]);
    setMeasurement(null);
    abortTrigger("");
    setStatus("Ny serie — hold Fokus, piltaster, hold Avtrekk.");
    wobblePhase.current = { a: Math.random() * 10, b: Math.random() * 10 };
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
    setAimMm({ x: 0, y: 0 });
    setShots([]);
    setMeasurement(null);
    abortTrigger("");
    setStatus(`Avstand satt til ${next} m — ny serie.`);
  }

  if (view === "shotlog") {
    return (
      <ShotLogView
        entries={shotLog}
        onBack={() => setView("range")}
        backLabel="← Tilbake til skytebanen"
      />
    );
  }

  if (!ready) {
    return (
      <div className="shooting-range">
        <LocationNav onBackToTown={onLeave} />
        <p className="intro-line intro-gift">Shooting Range</p>
        <p className="intro-line">
          Du mangler noe i kit. Ta med rifle, kikkert og minst én ammo fra
          Home — så tester vi.
        </p>
        {!rifle ? <p className="shop-row-note">Mangler: rifle</p> : null}
        {!scope ? <p className="shop-row-note">Mangler: scope</p> : null}
        {ammoOptions.length === 0 ? (
          <p className="shop-row-note">Mangler: ammo</p>
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
        hint="F = fokus + avtrekksmerke · piltaster · hold/slipp Space på merket (3 s bar) · +/− zoom"
      />

      <header className="shop-header">
        <p className="intro-line intro-gift">
          Shooting Range — CBA {distanceM} m
        </p>
        <p className="shop-row-note">
          {rifle.brand} {rifle.name}
          {" · "}
          {scope.brand} {scope.name} ({zoom.toFixed(1)}× / {scope.scope.minZoom}
          –{scope.scope.maxZoom}×)
          {" · "}
          kit-calm {calmFactor.toFixed(2)}
          {bipod ? " (bipod)" : " (uten bipod)"}
          {suppressor ? " + can" : ""}
          {ballisticHint ? ` · ${ballisticHint}` : ""}
        </p>
      </header>

      <div className="range-toolbar">
        <label className="shop-filter">
          Avstand
          <select
            value={distanceM}
            disabled={shots.length > 0 && !measurement}
            onChange={(e) =>
              changeDistance(Number(e.target.value) as RangeDistanceM)
            }
          >
            {RANGE_DISTANCES_M.map((d) => (
              <option key={d} value={d}>
                {d} m
              </option>
            ))}
          </select>
        </label>
        <label className="shop-filter">
          Ammo
          <select
            value={ammoId}
            disabled={shots.length > 0 && !measurement}
            onChange={(e) => {
              changeAmmo(e.target.value);
            }}
          >
            {ammoOptions.map((a) => {
              const rounds = getInventoryQty(inventory, a.id);
              return (
                <option key={a.id} value={a.id}>
                  {a.brand} {a.name} ({a.ammo.caliber}) · {rounds} igjen
                </option>
              );
            })}
          </select>
        </label>
        <span
          className={
            ammoRemaining <= 0
              ? "range-shot-count is-empty"
              : "range-shot-count"
          }
        >
          Patroner {ammoRemaining}
        </span>
        <span className="range-shot-count">
          Skudd {shots.length}/{SHOTS_PER_SERIES}
        </span>
        <span className="range-shot-count">
          Zero {effectiveZero.xMm.toFixed(0)}mm side /{" "}
          {effectiveZero.yMm.toFixed(0)}mm hoyde
        </span>
        <label className="shop-filter range-zoom-slider">
          Zoom {zoom.toFixed(1)}×
          <input
            type="range"
            min={scope.scope.minZoom}
            max={scope.scope.maxZoom}
            step={0.1}
            value={zoom}
            onChange={(e) =>
              setZoom(clampScopeZoom(Number(e.target.value), scope.scope))
            }
          />
          <span className="range-zoom-ends">
            {scope.scope.minZoom}× – {scope.scope.maxZoom}×
          </span>
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
            onClick={() => nudgeZero("x", -ZERO_CLICK_MM)}
          >
            Windage L
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
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
            onClick={() => nudgeZero("y", -ZERO_CLICK_MM)}
          >
            Elevation U
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={() => nudgeZero("y", ZERO_CLICK_MM)}
          >
            Elevation D
          </button>
        </div>
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
      </div>

      {measurement ? (
        <SeriesMeasureView
          shots={shots}
          measurement={measurement}
          imageSrc={IMG_SRC}
          imageWidth={IMG_NATURAL_W}
          imageHeight={IMG_NATURAL_H}
        />
      ) : (
        <div className="scope-stage" tabIndex={0}>
          <div
            className={
              recoilActive
                ? "scope-viewport is-recoiling"
                : "scope-viewport"
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
                className="scope-target"
                src={IMG_SRC}
                alt="CBA blink"
                draggable={false}
                width={IMG_NATURAL_W}
                height={IMG_NATURAL_H}
              />
              {shots.map((s, i) => {
                const hx = bullseyeOff.x + mmToPx(s.xMm, IMG_NATURAL_W);
                const hy = bullseyeOff.y + mmToPx(s.yMm, IMG_NATURAL_W);
                const d = mmToPx(s.diameterMm, IMG_NATURAL_W);
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
            </div>
            <ScopeReticle
              scope={scope.scope}
              zoom={zoom}
              imgScale={zoomScale}
            />
            <div className="scope-vignette" aria-hidden />
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
                {focusLabel}
              </span>
              <div
                className={
                  focusUi.phase === "fatigued"
                    ? "range-focus-bar is-fatigued"
                    : "range-focus-bar"
                }
                aria-hidden
                style={{
                  ["--focus-pct" as string]:
                    focusUi.phase === "focused"
                      ? `${(focusUi.remainingMs / FOCUS_HOLD_MS) * 100}%`
                      : focusUi.phase === "fatigued"
                        ? "100%"
                        : "0%",
                }}
              />
            </div>
            <div className="range-timer-row">
              <span
                className={
                  triggerUi.pending
                    ? "range-focus is-trigger"
                    : "range-focus"
                }
              >
                {triggerUi.pending
                  ? "Avtrekk… slipp på merket"
                  : "Avtrekk (hold/slipp Space)"}
              </span>
              <div
                className="range-trigger-bar"
                aria-hidden
                style={{
                  ["--trigger-pct" as string]: `${triggerUi.progress * 100}%`,
                  ["--trigger-mark-pct" as string]: `${triggerUi.targetPct * 100}%`,
                }}
              >
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
