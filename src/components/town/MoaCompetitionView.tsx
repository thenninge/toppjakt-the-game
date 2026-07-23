"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
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
  TRIGGER_BAR_MS,
  caliberBulletDiameterMm,
  clampScopeZoom,
  combinedDispersionMoa,
  computeWeaponCalmFactor,
  effectiveCalmWithFocus,
  ensureAmmoAffinity,
  focusPhase,
  focusRemainingMs,
  rollTriggerTargetMs,
  sampleShotFromPoa,
  scopeImageScale,
  triggerPullErrorFactor,
  triggerPullOffsetMm,
  wobbleAmplitudeMm,
  type ShotImpact,
} from "@/lib/range/precision";
import { ScopeReticle } from "@/components/range/ScopeReticle";
import { ScopeTurrets } from "@/components/range/ScopeTurrets";
import { ScopeZoomRing } from "@/components/range/ScopeZoomRing";
import { useTriggerBarPaint } from "@/components/range/useTriggerBarPaint";
import { useFocusBarPaint } from "@/components/range/useFocusBarPaint";
import { useRangeAudio } from "@/components/range/useRangeAudio";
import {
  angularMmAtDistance,
  clampTurretMm,
  effectiveZeroOffsetMm,
  getInventoryQty,
  zeroingKey,
  type InventoryEntry,
  type ZeroingProfile,
} from "@/lib/player";
import { applyScopeClickError } from "@/lib/optics/spec";
import { densityRatioFromTempC } from "@/lib/ballistics/solver";
import { isSilentSuppressedShot } from "@/lib/ammo/spec";
import type { RangeShotAudioOptions } from "@/lib/range/audio";
import type { DayWeather } from "@/lib/weather/spec";
import {
  MOA_COMP_DISTANCE_M,
  MOA_COMP_ENTRY_FEE_NOK,
  MOA_COMP_IMG_SRC,
  MOA_COMP_NATIVE_H,
  MOA_COMP_NATIVE_W,
  MOA_COMP_PAYOUT_TIERS,
  MOA_COMP_SHOT_COUNT,
  MOA_COMP_TARGETS,
  finalizeMoaComp,
  formatMoaCompScore,
  moaCompMmToPx,
  moaCompScopeImageScale,
  moaCompTargetPosMm,
  nearestEmptyTargetIndex,
  scoreMoaCompShot,
  type MoaCompResult,
  type MoaCompShot,
} from "@/lib/range/moaComp";

type MoaCompetitionViewProps = {
  balance: number;
  kitItems: ShopItem[];
  inventory: InventoryEntry[];
  ammoAffinities: Record<string, number>;
  zeroingProfiles: Record<string, ZeroingProfile>;
  weather: DayWeather;
  customsMoaDelta?: number;
  musicEnabled: boolean;
  onAffinitiesChange: (next: Record<string, number>) => void;
  onConsumeAmmo: (ammoId: string) => boolean;
  onEnsureZeroing: (
    rifleId: string,
    scopeId: string,
    ammoId: string,
  ) => ZeroingProfile;
  /** Charge entry fee; return false if insufficient funds. */
  onPayEntryFee: (amountNok: number) => boolean;
  onAwardPayout: (amountNok: number) => void;
  onBack: () => void;
};

type Keys = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

type Phase = "lobby" | "shooting" | "result";

const AIM_SPEED_MM_PER_SEC = 55;
/** Enough to pan the whole STD sheet under the reticle. */
const AIM_LIMIT_MM = 220;
const DEFAULT_SCOPE_ZOOM = 12;

function MoaCompSheet({
  shots,
  highlightWorst,
}: {
  shots: MoaCompShot[];
  highlightWorst?: number;
}) {
  const shotOn = new Set(shots.map((s) => s.targetIndex));
  return (
    <div
      className="moa-comp-sheet"
      style={{
        aspectRatio: `${MOA_COMP_NATIVE_W} / ${MOA_COMP_NATIVE_H}`,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={MOA_COMP_IMG_SRC}
        alt="MOA-konkurranse STD 100 m"
        className="moa-comp-sheet-img"
        draggable={false}
        width={MOA_COMP_NATIVE_W}
        height={MOA_COMP_NATIVE_H}
      />
      {MOA_COMP_TARGETS.map((t, i) => (
        <span
          key={`ring-${i}`}
          className={
            i === highlightWorst
              ? "moa-comp-target-ring is-worst"
              : shotOn.has(i)
                ? "moa-comp-target-ring is-done"
                : "moa-comp-target-ring"
          }
          style={{
            left: `${(t.xPx / MOA_COMP_NATIVE_W) * 100}%`,
            top: `${(t.yPx / MOA_COMP_NATIVE_H) * 100}%`,
          }}
          aria-hidden
        />
      ))}
      {shots.map((s) => {
        const t = MOA_COMP_TARGETS[s.targetIndex]!;
        const hx = t.xPx + moaCompMmToPx(s.xMm);
        const hy = t.yPx + moaCompMmToPx(s.yMm);
        const d = Math.max(5, moaCompMmToPx(s.diameterMm));
        return (
          <span
            key={`sheet-hole-${s.targetIndex}`}
            className={
              s.targetIndex === highlightWorst
                ? "moa-comp-sheet-hole is-worst"
                : "moa-comp-sheet-hole"
            }
            style={{
              left: `${(hx / MOA_COMP_NATIVE_W) * 100}%`,
              top: `${(hy / MOA_COMP_NATIVE_H) * 100}%`,
              width: `${(d / MOA_COMP_NATIVE_W) * 100}%`,
            }}
            title={`#${s.targetIndex + 1} · ${formatMoaCompScore(s.radiusMoa)}`}
          />
        );
      })}
    </div>
  );
}

export function MoaCompetitionView({
  balance,
  kitItems,
  inventory,
  ammoAffinities,
  zeroingProfiles,
  weather,
  customsMoaDelta = 0,
  musicEnabled,
  onAffinitiesChange,
  onConsumeAmmo,
  onEnsureZeroing,
  onPayEntryFee,
  onAwardPayout,
  onBack,
}: MoaCompetitionViewProps) {
  const rifle = useMemo(() => kitItems.find(isRifleItem) ?? null, [kitItems]);
  const scope = useMemo(() => kitItems.find(isScopeItem) ?? null, [kitItems]);
  const stock = useMemo(() => kitItems.find(isStockItem) ?? null, [kitItems]);
  const bipod = useMemo(() => kitItems.find(isBipodItem) ?? null, [kitItems]);
  const suppressor = useMemo(
    () => kitItems.find((i) => i.category === "suppressor") ?? null,
    [kitItems],
  );
  const ammoOptions = useMemo(() => kitItems.filter(isAmmoItem), [kitItems]);
  const ready = !!(rifle && scope && ammoOptions.length > 0);
  const densityRatio = densityRatioFromTempC(weather.live.temperatureC);

  const [phase, setPhase] = useState<Phase>("lobby");
  const [ammoId, setAmmoId] = useState(ammoOptions[0]?.id ?? "");
  const [zoom, setZoom] = useState(DEFAULT_SCOPE_ZOOM);
  const [sessionZeroXMm, setSessionZeroXMm] = useState(0);
  const [sessionZeroYMm, setSessionZeroYMm] = useState(0);
  const [aimMm, setAimMm] = useState(() => {
    const p = moaCompTargetPosMm(0);
    return { x: p.xMm, y: p.yMm };
  });
  const [shots, setShots] = useState<MoaCompShot[]>([]);
  const [result, setResult] = useState<MoaCompResult | null>(null);
  const [status, setStatus] = useState(
    "10 skudd — ett per blink. Flytt våpenet selv mellom blinkene. Kun worst teller.",
  );
  const [focusUi, setFocusUi] = useState<{
    phase: "idle" | "focused" | "fatigued";
    remainingMs: number;
  }>({ phase: "idle", remainingMs: 0 });
  const [triggerUi, setTriggerUi] = useState<{
    pending: boolean;
    targetPct: number;
  }>({ pending: false, targetPct: 0 });
  const [recoilActive, setRecoilActive] = useState(false);

  const selectedAmmo = ammoOptions.find((a) => a.id === ammoId) ?? null;
  const ammoRemaining = selectedAmmo
    ? getInventoryQty(inventory, selectedAmmo.id)
    : 0;
  const comboKey =
    rifle && scope && selectedAmmo
      ? zeroingKey(rifle.id, scope.id, selectedAmmo.id)
      : null;
  const zeroProfile = comboKey ? zeroingProfiles[comboKey] ?? null : null;

  const calmFactor = useMemo(
    () =>
      computeWeaponCalmFactor({
        hasBipod: !!bipod,
        bipod: bipod?.bipod,
        suppressorWeightGrams: suppressor?.weightGrams,
      }),
    [bipod, suppressor],
  );

  const keysRef = useRef<Keys>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const aimRef = useRef(aimMm);
  const wobbleRef = useRef({ x: 0, y: 0 });
  const wobblePhase = useRef({ a: Math.random() * 10, b: Math.random() * 10 });
  const weaponCalmRef = useRef(calmFactor);
  const focusRef = useRef({ held: false, startedAtMs: 0 });
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
  const scopeWorldRef = useRef<HTMLDivElement>(null);
  const scopeStageRef = useRef<HTMLDivElement>(null);
  const targetScaleRef = useRef(1);
  const shotsLenRef = useRef(0);
  const shotsRef = useRef<MoaCompShot[]>([]);
  const phaseRef = useRef<Phase>("lobby");
  const ammoRemainingRef = useRef(0);

  const { playShot } = useRangeAudio({ enabled: musicEnabled });
  const {
    fillRef: triggerFillRef,
    paintTriggerProgress,
    resetTriggerProgress,
  } = useTriggerBarPaint();
  const {
    focusBarRef,
    focusFillRef,
    paintFocusProgress,
    resetFocusProgress,
    setFocusBarFatigued,
  } = useFocusBarPaint();

  useEffect(() => {
    aimRef.current = aimMm;
  }, [aimMm]);
  useEffect(() => {
    weaponCalmRef.current = calmFactor;
  }, [calmFactor]);
  useEffect(() => {
    playShotRef.current = playShot;
  }, [playShot]);
  useEffect(() => {
    consumeAmmoRef.current = onConsumeAmmo;
  }, [onConsumeAmmo]);
  useEffect(() => {
    shotsLenRef.current = shots.length;
    shotsRef.current = shots;
  }, [shots]);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    ammoRemainingRef.current = ammoRemaining;
  }, [ammoRemaining]);

  useEffect(() => {
    if (!ammoId && ammoOptions[0]) setAmmoId(ammoOptions[0].id);
  }, [ammoId, ammoOptions]);

  useEffect(() => {
    if (!rifle || !scope || !selectedAmmo) return;
    onEnsureZeroing(rifle.id, scope.id, selectedAmmo.id);
    setSessionZeroXMm(0);
    setSessionZeroYMm(0);
  }, [rifle, scope, selectedAmmo, onEnsureZeroing]);

  function startRound() {
    if (!ready || !selectedAmmo) return;
    if (ammoRemaining < MOA_COMP_SHOT_COUNT) {
      setStatus(
        `Trenger ${MOA_COMP_SHOT_COUNT} skudd i eska — du har ${ammoRemaining}.`,
      );
      return;
    }
    if (balance < MOA_COMP_ENTRY_FEE_NOK) {
      setStatus(
        `Startavgift ${MOA_COMP_ENTRY_FEE_NOK} kr — saldo ${balance.toLocaleString("nb-NO")} kr.`,
      );
      return;
    }
    if (!onPayEntryFee(MOA_COMP_ENTRY_FEE_NOK)) {
      setStatus("Kunne ikke trekke startavgift.");
      return;
    }
    setShots([]);
    setResult(null);
    const p = moaCompTargetPosMm(0);
    const startAim = { x: p.xMm, y: p.yMm };
    setAimMm(startAim);
    aimRef.current = startAim;
    focusRef.current = { held: false, startedAtMs: 0 };
    triggerRef.current = { held: false, startedAtMs: null };
    triggerMarkRef.current = null;
    setPhase("shooting");
    setStatus(
      `Skudd 0/${MOA_COMP_SHOT_COUNT} — pil-taster flytter sikte mellom blinkene. F fokus, Space avtrekk.`,
    );
    // Blur Start button so Space does not re-activate it; focus the stage.
    window.requestAnimationFrame(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      scopeStageRef.current?.focus();
    });
  }

  fireShotRef.current = () => {
    if (phaseRef.current !== "shooting") return;
    if (!ready || !rifle || !selectedAmmo || !scope) return;
    if (shotsLenRef.current >= MOA_COMP_SHOT_COUNT) return;
    if (getInventoryQty(inventory, selectedAmmo.id) <= 0) {
      setStatus("Tom for ammo — kjøp mer hos XXL.");
      return;
    }

    const used = new Set(shotsRef.current.map((s) => s.targetIndex));
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
    };
    const envelopeMoa = combinedDispersionMoa(dispersionInput);
    const pull = triggerPullOffsetMm(
      triggerPullRef.current,
      envelopeMoa,
      MOA_COMP_DISTANCE_M,
    );
    // aimMm is POA on the sheet (mm from image centre).
    const poa = {
      xMm: aimRef.current.x + w.x + pull.xMm,
      yMm: aimRef.current.y + w.y + pull.yMm,
    };
    const shot = sampleShotFromPoa(
      poa,
      dispersionInput,
      MOA_COMP_DISTANCE_M,
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
          MOA_COMP_DISTANCE_M,
          { clickErrorPercent: clickErr },
        )
      : {
          xMm: angularMmAtDistance(
            applyScopeClickError(sessionZeroXMm, clickErr),
            MOA_COMP_DISTANCE_M,
          ),
          yMm: angularMmAtDistance(
            applyScopeClickError(sessionZeroYMm, clickErr),
            MOA_COMP_DISTANCE_M,
          ),
        };
    const absImpact = {
      xMm: shot.xMm + realizedZero.xMm,
      yMm: shot.yMm + realizedZero.yMm,
      diameterMm: caliberBulletDiameterMm(selectedAmmo.ammo.caliber),
    };
    const idx = nearestEmptyTargetIndex(absImpact.xMm, absImpact.yMm, used);
    if (idx < 0) {
      setStatus("Alle blink er skutt.");
      return;
    }
    if (!consumeAmmoRef.current(selectedAmmo.id)) {
      setStatus("Tom for ammo — kjøp mer hos XXL.");
      return;
    }
    const bull = moaCompTargetPosMm(idx);
    const scored = scoreMoaCompShot(idx, {
      xMm: absImpact.xMm - bull.xMm,
      yMm: absImpact.yMm - bull.yMm,
      diameterMm: absImpact.diameterMm,
    });

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

    setShots((prev) => {
      const next = [...prev, scored];
      if (next.length >= MOA_COMP_SHOT_COUNT) {
        const fin = finalizeMoaComp(next);
        setResult(fin);
        if (fin.payoutNok > 0) onAwardPayout(fin.payoutNok);
        setPhase("result");
        setStatus(
          `Ferdig — worst ${formatMoaCompScore(fin.worstMoa)}${
            fin.tierLabel ? ` · ${fin.tierLabel}` : " · ingen premie"
          }.`,
        );
      } else {
        setStatus(
          `Skudd ${next.length}/${MOA_COMP_SHOT_COUNT} · blink ${idx + 1}: ${formatMoaCompScore(scored.radiusMoa)} — flytt til neste blink.`,
        );
      }
      return next;
    });
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
    const markMs = rollTriggerTargetMs();
    triggerMarkRef.current = markMs;
    resetTriggerProgress();
    paintFocusProgress(1);
    setFocusBarFatigued(false);
    setTriggerUi({ pending: false, targetPct: markMs / TRIGGER_BAR_MS });
    setStatus("Fokus — hold pusten. Slipp Space på merket.");
  }

  function endFocus(abortReason: string) {
    if (!focusRef.current.held) return;
    focusRef.current = { held: false, startedAtMs: 0 };
    if (triggerRef.current.held) abortTrigger(abortReason);
    triggerMarkRef.current = null;
    resetTriggerProgress();
    resetFocusProgress();
    setTriggerUi({ pending: false, targetPct: 0 });
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
    triggerPullRef.current = triggerPullErrorFactor(elapsed, markMs);
    triggerRef.current = { held: false, startedAtMs: null };
    resetTriggerProgress();
    setTriggerUi((prev) => ({ pending: false, targetPct: prev.targetPct }));
    fireShotRef.current();
  }

  function beginTrigger(nowMs: number) {
    if (triggerRef.current.held) return;
    if (phaseRef.current !== "shooting") return;
    if (shotsLenRef.current >= MOA_COMP_SHOT_COUNT) return;
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
      else if (e.key === "f" || e.key === "F") {
        endFocus("Fokus sluppet — avtrekk avbrutt.");
      } else if (e.key === " " || e.code === "Space") {
        releaseTrigger(performance.now());
      }
    }
    // Capture so Space/F are not eaten by focused tab/action buttons.
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      keysRef.current = { up: false, down: false, left: false, right: false };
    };
  }, [phase, ready]);

  useEffect(() => {
    if (phase !== "shooting" || !ready) return;
    let raf = 0;
    let last = performance.now();
    let uiAccum = 0;

    function paintScopeWorld() {
      const el = scopeWorldRef.current;
      if (!el) return;
      const ax = aimRef.current.x + wobbleRef.current.x;
      const ay = aimRef.current.y + wobbleRef.current.y;
      const scale = targetScaleRef.current;
      // aimMm is sheet position from image centre — pan so POA sits under reticle.
      const panPxX = moaCompMmToPx(ax) * scale;
      const panPxY = moaCompMmToPx(ay) * scale;
      el.style.transform = `translate(calc(-50% - ${panPxX}px), calc(-50% - ${panPxY}px)) scale(${scale})`;
    }

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = keysRef.current;
      let { x, y } = aimRef.current;
      const speed = AIM_SPEED_MM_PER_SEC * dt;
      if (k.left) x -= speed;
      if (k.right) x += speed;
      if (k.up) y -= speed;
      if (k.down) y += speed;
      x = Math.max(-AIM_LIMIT_MM, Math.min(AIM_LIMIT_MM, x));
      y = Math.max(-AIM_LIMIT_MM, Math.min(AIM_LIMIT_MM, y));
      aimRef.current = { x, y };

      const calm = effectiveCalmWithFocus(
        weaponCalmRef.current,
        focusRef.current,
        now,
      );
      const amp = wobbleAmplitudeMm(calm, MOA_COMP_DISTANCE_M);
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
        paintTriggerProgress(
          Math.min(1, Math.max(0, elapsed / TRIGGER_BAR_MS)),
        );
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
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, ready]);

  // Reticle: CBA-tuned scale (true mils). Paper: boosted to match zeroing size.
  const zoomScale = scope
    ? scopeImageScale(zoom, scope.scope, MOA_COMP_DISTANCE_M)
    : 1;
  const targetScale = scope
    ? moaCompScopeImageScale(zoom, scope.scope, MOA_COMP_DISTANCE_M)
    : 1;
  targetScaleRef.current = targetScale;

  const focusLabel =
    focusUi.phase === "focused"
      ? `Fokus ${(focusUi.remainingMs / 1000).toFixed(1)} s`
      : focusUi.phase === "fatigued"
        ? "Pust — ustabil"
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
      <div className="moa-comp">
        <p className="intro-line">
          MOA-konkurranse krever rifle, scope og ammo i kit.
        </p>
        <button type="button" className="intro-button" onClick={onBack}>
          ← Tilbake
        </button>
      </div>
    );
  }

  if (phase === "lobby") {
    return (
      <div className="moa-comp">
        <header className="shop-header">
          <p className="intro-line intro-gift">MOA-konkurranse · STD 100 m</p>
          <p className="shop-row-note">
            Ett skudd i hver av 10 blink. Score = dårligste skudd. Nest-ytre
            sirkel = 1 MOA. Ruter = 1 cm.
          </p>
          <p className="shop-row-note">
            Saldo {balance.toLocaleString("nb-NO")} kr · startavgift{" "}
            {MOA_COMP_ENTRY_FEE_NOK} kr
          </p>
        </header>

        <MoaCompSheet shots={[]} />

        <div className="moa-comp-tiers">
          <p className="range-setup-label">Premier (worst MOA)</p>
          <ul className="moa-comp-tier-list">
            {MOA_COMP_PAYOUT_TIERS.map((t) => (
              <li key={t.maxWorstMoa}>
                {t.label}: {t.payoutNok.toLocaleString("nb-NO")} kr
              </li>
            ))}
            <li>Over 1.25 MOA: ingen premie</li>
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
            Start ({MOA_COMP_ENTRY_FEE_NOK} kr)
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
      <div className="moa-comp">
        <header className="shop-header">
          <p className="intro-line intro-gift">Resultat</p>
          <p className="shop-row-note">
            Score (worst):{" "}
            <strong>{formatMoaCompScore(result.worstMoa)}</strong>
            {" · "}
            beste {formatMoaCompScore(result.bestMoa)}
            {result.tierLabel ? ` · ${result.tierLabel}` : " · ingen premie"}
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

        <MoaCompSheet
          shots={result.shots}
          highlightWorst={result.worstTargetIndex}
        />

        <ul className="moa-comp-shot-list">
          {result.shots.map((s) => (
            <li
              key={s.targetIndex}
              className={
                s.targetIndex === result.worstTargetIndex ? "is-worst" : ""
              }
            >
              Blink {s.targetIndex + 1}: {formatMoaCompScore(s.radiusMoa)}
              {s.targetIndex === result.worstTargetIndex ? " ← worst" : ""}
            </li>
          ))}
        </ul>

        <div className="range-actions">
          <button
            type="button"
            className="intro-button"
            onClick={() => {
              setPhase("lobby");
              setResult(null);
              setShots([]);
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
    <div className="moa-comp moa-comp--live">
      <header className="shop-header">
        <p className="intro-line intro-gift">
          MOA · {shots.length}/{MOA_COMP_SHOT_COUNT} skudd
        </p>
        <p className="shop-row-note">
          {rifle!.brand} {rifle!.name} · {selectedAmmo?.brand}{" "}
          {selectedAmmo?.name} · {ammoRemaining} igjen · 100 m · pil-taster
          flytter sikte
        </p>
      </header>

      <div className="moa-comp-live-sheet">
        <MoaCompSheet shots={shots} />
      </div>

      <div className="scope-stage" tabIndex={0} ref={scopeStageRef}>
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
                  ? "scope-viewport is-recoiling"
                  : "scope-viewport"
              }
            >
              <div ref={scopeWorldRef} className="scope-world">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="scope-target"
                  src={MOA_COMP_IMG_SRC}
                  alt="MOA-blink"
                  draggable={false}
                  width={MOA_COMP_NATIVE_W}
                  height={MOA_COMP_NATIVE_H}
                />
                {shots.map((s) => {
                  const bull = moaCompTargetPosMm(s.targetIndex);
                  const hx = moaCompMmToPx(bull.xMm + s.xMm);
                  const hy = moaCompMmToPx(bull.yMm + s.yMm);
                  const d = moaCompMmToPx(s.diameterMm);
                  return (
                    <span
                      key={`hole-${s.targetIndex}`}
                      className="bullet-hole"
                      style={{
                        left: `calc(50% + ${hx}px)`,
                        top: `calc(50% + ${hy}px)`,
                        width: `${d}px`,
                        height: `${d}px`,
                        marginLeft: `${-d / 2}px`,
                        marginTop: `${-d / 2}px`,
                      }}
                    />
                  );
                })}
              </div>
              <ScopeReticle
                scope={scope!.scope}
                zoom={zoom}
                imgScale={zoomScale}
              />
              <div className="scope-vignette" aria-hidden />
            </div>
            <ScopeZoomRing
              scope={scope!.scope}
              zoom={zoom}
              onChange={(z) => setZoom(clampScopeZoom(z, scope!.scope))}
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
          onNudge={(axis, deltaMm) => {
            if (axis === "x") {
              setSessionZeroXMm((v) => clampTurretMm(v + deltaMm));
            } else {
              setSessionZeroYMm((v) => clampTurretMm(v + deltaMm));
            }
          }}
        />
      </div>

      {status ? <p className="shop-row-note">{status}</p> : null}
    </div>
  );
}
