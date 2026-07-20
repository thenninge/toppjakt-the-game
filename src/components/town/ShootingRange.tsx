"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  TRIGGER_DELAY_MAX_MS,
  caliberBulletDiameterMm,
  cbaBullseyeOffsetFromImageCenterPx,
  clampScopeZoom,
  computeWeaponCalmFactor,
  effectiveCalmWithFocus,
  ensureAmmoAffinity,
  focusPhase,
  focusRemainingMs,
  measureGroup,
  mmToPx,
  RANGE_DISTANCE_M,
  sampleShotFromPoa,
  scopeImageScale,
  wobbleAmplitudeMm,
  type GroupMeasurement,
  type ShotImpact,
} from "@/lib/range/precision";
import { SeriesMeasureView } from "@/components/town/SeriesMeasureView";
import { ScopeReticle } from "@/components/range/ScopeReticle";
import { useRangeAudio } from "@/components/range/useRangeAudio";
import { getInventoryQty, type InventoryEntry } from "@/lib/player";

type ShootingRangeProps = {
  kitItems: ShopItem[];
  inventory: InventoryEntry[];
  ammoAffinities: Record<string, number>;
  onAffinitiesChange: (next: Record<string, number>) => void;
  onConsumeAmmo: (ammoId: string) => boolean;
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
  onAffinitiesChange,
  onConsumeAmmo,
  musicEnabled,
  onLeave,
}: ShootingRangeProps) {
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
  const [aimMm, setAimMm] = useState({ x: 0, y: 0 });
  const [wobbleMm, setWobbleMm] = useState({ x: 0, y: 0 });
  const [shots, setShots] = useState<ShotImpact[]>([]);
  const [measurement, setMeasurement] = useState<GroupMeasurement | null>(
    null,
  );
  const [status, setStatus] = useState(
    "Hold F (fokus/pust), sikte med piltaster, hold Space for avtrekk.",
  );
  const [focusUi, setFocusUi] = useState<{
    phase: "idle" | "focused" | "fatigued";
    remainingMs: number;
  }>({ phase: "idle", remainingMs: 0 });
  const [triggerUi, setTriggerUi] = useState<{
    pending: boolean;
    /** 0–1 while holding Space toward break. */
    progress: number;
  }>({ pending: false, progress: 0 });
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
  const wobblePhase = useRef({ a: Math.random() * 10, b: Math.random() * 10 });
  const weaponCalmRef = useRef(1);
  const focusRef = useRef({ held: false, startedAtMs: 0 });
  const triggerRef = useRef<{
    held: boolean;
    fireAtMs: number | null;
    startedAtMs: number | null;
  }>({ held: false, fireAtMs: null, startedAtMs: null });
  const fireShotRef = useRef(() => {});
  const playShotRef = useRef<(hasSuppressor: boolean) => void>(() => {});
  const consumeAmmoRef = useRef(onConsumeAmmo);

  const { playShot } = useRangeAudio({ enabled: musicEnabled });

  const selectedAmmo = ammoOptions.find((a) => a.id === ammoId) ?? null;
  const ammoRemaining = selectedAmmo
    ? getInventoryQty(inventory, selectedAmmo.id)
    : 0;

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
        RANGE_DISTANCE_M,
      );
      const impact: ShotImpact = {
        xMm: shot.xMm,
        yMm: shot.yMm,
        diameterMm: caliberBulletDiameterMm(selectedAmmo.ammo.caliber),
      };
      setStatus(
        `Skudd ${prev.length + 1}/${SHOTS_PER_SERIES} · ${selectedAmmo.brand} ${selectedAmmo.name}`,
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
    triggerRef.current = { held: false, fireAtMs: null, startedAtMs: null };
    setTriggerUi({ pending: false, progress: 0 });
    if (reason) setStatus(reason);
  }

  function beginTrigger(nowMs: number) {
    if (triggerRef.current.fireAtMs != null) return;
    if (shotsLenRef.current >= SHOTS_PER_SERIES || measurementRef.current) {
      setStatus(
        measurementRef.current
          ? "Målt ferdig — start ny serie."
          : "Serien er full (5).",
      );
      return;
    }
    if (!focusRef.current.held) {
      setStatus("Hold F (pust/fokus) før du tar avtrekk.");
      return;
    }
    if (ammoRemaining <= 0) {
      setStatus("Tom for ammo — kjøp mer hos Pike Pro.");
      return;
    }
    const delay = Math.max(40, Math.random() * TRIGGER_DELAY_MAX_MS);
    triggerRef.current = {
      held: true,
      fireAtMs: nowMs + delay,
      startedAtMs: nowMs,
    };
    setTriggerUi({ pending: true, progress: 0 });
    setStatus("Avtrekk… hold Space");
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
        if (!focusRef.current.held) {
          focusRef.current = {
            held: true,
            startedAtMs: performance.now(),
          };
          setStatus("Fokus — hold pusten. 8 s ro før det blir verre.");
        }
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
        focusRef.current = { held: false, startedAtMs: 0 };
        if (triggerRef.current.fireAtMs != null) {
          abortTrigger("Fokus sluppet — avtrekk avbrutt.");
        }
      }
      if (e.key === " " || e.code === "Space") {
        if (triggerRef.current.fireAtMs != null) {
          abortTrigger("Avtrekk sluppet — skudd avbrutt.");
        } else {
          triggerRef.current.held = false;
          setTriggerUi({ pending: false, progress: 0 });
        }
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
      const speed = AIM_SPEED_MM_PER_SEC * dt;
      if (k.left) x -= speed;
      if (k.right) x += speed;
      if (k.up) y -= speed;
      if (k.down) y += speed;
      x = Math.max(-80, Math.min(80, x));
      y = Math.max(-80, Math.min(80, y));
      aimRef.current = { x, y };
      setAimMm({ x, y });

      const calm = effectiveCalmWithFocus(
        weaponCalmRef.current,
        focusRef.current,
        now,
      );
      const amp = wobbleAmplitudeMm(calm);
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
      if (trig.held && trig.fireAtMs != null && now >= trig.fireAtMs) {
        if (!focusRef.current.held) {
          abortTrigger("Mistet fokus under avtrekk.");
        } else {
          triggerRef.current = {
            held: false,
            fireAtMs: null,
            startedAtMs: null,
          };
          setTriggerUi({ pending: false, progress: 1 });
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
        if (
          trig.held &&
          trig.fireAtMs != null &&
          trig.startedAtMs != null
        ) {
          const span = Math.max(1, trig.fireAtMs - trig.startedAtMs);
          const progress = Math.min(
            1,
            Math.max(0, (now - trig.startedAtMs) / span),
          );
          setTriggerUi({ pending: true, progress });
        } else if (!trig.held) {
          setTriggerUi((prev) =>
            prev.pending || prev.progress > 0
              ? { pending: false, progress: 0 }
              : prev,
          );
        }
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, measurement]);

  const imgScale = scope ? scopeImageScale(zoom, scope.scope) : 1;
  const displayAimX = aimMm.x + wobbleMm.x;
  const displayAimY = aimMm.y + wobbleMm.y;
  // POA: pan so the point under the reticle is aim+wobble relative to bullseye
  // (bullseye ≠ PNG center — offset measured on cba-detail.png).
  const bullseyeOff = cbaBullseyeOffsetFromImageCenterPx(
    IMG_NATURAL_W,
    IMG_NATURAL_H,
  );
  const panPxX =
    (bullseyeOff.x + mmToPx(displayAimX, IMG_NATURAL_W)) * imgScale;
  const panPxY =
    (bullseyeOff.y + mmToPx(displayAimY, IMG_NATURAL_W)) * imgScale;

  function measureSeries() {
    if (shots.length < SHOTS_PER_SERIES) {
      setStatus(`Trenger ${SHOTS_PER_SERIES} skudd før måling.`);
      return;
    }
    const m = measureGroup(shots);
    setMeasurement(m);
    if (m) {
      setStatus("Serie målt — se stillbilde og stats under.");
    }
  }

  function newSeries() {
    setShots([]);
    setMeasurement(null);
    abortTrigger("");
    setStatus("Ny serie — hold F (fokus), piltaster, hold Space (avtrekk).");
    wobblePhase.current = { a: Math.random() * 10, b: Math.random() * 10 };
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
        <button type="button" className="intro-button" onClick={onLeave}>
          Ferdig
        </button>
      </div>
    );
  }

  const focusLabel =
    focusUi.phase === "focused"
      ? `Fokus ${(focusUi.remainingMs / 1000).toFixed(1)} s`
      : focusUi.phase === "fatigued"
        ? "Pust — ustabil (slipp F, prøv igjen)"
        : "Ingen fokus (hold F)";

  return (
    <div className="shooting-range">
      <LocationNav
        onBackToTown={onLeave}
        hint="F fokus/pust · piltaster sikte · hold Space avtrekk (0–1 s) · +/− zoom"
      />

      <header className="shop-header">
        <p className="intro-line intro-gift">Shooting Range — CBA 100 m</p>
        <p className="shop-row-note">
          {rifle.brand} {rifle.name}
          {" · "}
          {scope.brand} {scope.name} ({zoom.toFixed(1)}× / {scope.scope.minZoom}
          –{scope.scope.maxZoom}×)
          {" · "}
          kit-calm {calmFactor.toFixed(2)}
          {bipod ? " (bipod)" : " (uten bipod)"}
          {suppressor ? " + can" : ""}
        </p>
      </header>

      <div className="range-toolbar">
        <label className="shop-filter">
          Ammo
          <select
            value={ammoId}
            disabled={shots.length > 0 && !measurement}
            onChange={(e) => {
              setAmmoId(e.target.value);
              setStatus("Ammo byttet — klar for serie.");
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
                transform: `translate(calc(-50% - ${panPxX}px), calc(-50% - ${panPxY}px)) scale(${imgScale})`,
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
            <ScopeReticle scope={scope.scope} zoom={zoom} imgScale={imgScale} />
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
                {triggerUi.pending ? "Avtrekk…" : "Avtrekk (hold Space)"}
              </span>
              <div
                className="range-trigger-bar"
                aria-hidden
                style={{
                  ["--trigger-pct" as string]: `${triggerUi.progress * 100}%`,
                }}
              />
            </div>
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
          onClick={onLeave}
        >
          Ferdig
        </button>
      </div>
    </div>
  );
}
