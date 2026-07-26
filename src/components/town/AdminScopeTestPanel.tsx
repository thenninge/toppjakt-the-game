"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { ScopeReticle } from "@/components/range/ScopeReticle";
import { ScopeZoomRing } from "@/components/range/ScopeZoomRing";
import {
  allBirdSpriteIds,
  getBirdSprite,
  spriteIdsForSpecies,
  type BirdSpriteId,
} from "@/lib/hunt/birdSprites";
import {
  BIRD_SPRITE_SCALE_MAX,
  BIRD_SPRITE_SCALE_MIN,
  applyBakedBirdSpriteScales,
  exportEffectiveBirdSpriteScales,
  getBirdSpriteScalePercent,
  isBirdSpriteScaleDirty,
  isBirdSpriteSpeciesScaleDirty,
  setBirdSpriteScalePercent,
  subscribeBirdSpriteScales,
} from "@/lib/hunt/birdSpriteScale";
import {
  birdNativePxPerMm,
  birdScopeImageScale,
  birdShotGeom,
  birdVitalOffsetFromImageCenterPx,
} from "@/lib/hunt/shoot";
import { scopeFovDiameterScale } from "@/lib/optics/spec";
import { clampScopeZoom, RANGE_EASY_ZERO_SCALE } from "@/lib/range/precision";
import { getReticleDef } from "@/lib/range/reticles";
import {
  aimMmDeltaFromPointerDrag,
  clampAimMm,
  SCOPE_AIM_TAP_MM,
  scopeAimHoldMult,
} from "@/lib/range/scopePointerAim";
import {
  opticReticleImgScale,
  zeroingTargetAndReticleScale,
} from "@/lib/range/scopeViewScale";
import {
  RANGE_TARGET_IDS,
  getRangeTarget,
  targetBullseyeOffsetFromImageCenterPx,
  type RangeTargetId,
} from "@/lib/range/targets";
import { getCatalogByCategory } from "@/lib/shop/catalog";
import { isScopeItem, type ScopeShopItem } from "@/lib/shop/types";

type SubjectKind = "range" | "bird";

type AimKeys = {
  up: number | null;
  down: number | null;
  left: number | null;
  right: number | null;
};

type AdminScopeTestPanelProps = {
  onLeave?: () => void;
};

const DIST_MIN_M = 10;
const DIST_MAX_M = 1500;
const DIST_STEP_M = 1;
const AIM_SPEED_MM_PER_SEC = 22;

function clampDistanceM(raw: number): number {
  if (!Number.isFinite(raw)) return 100;
  return Math.min(DIST_MAX_M, Math.max(DIST_MIN_M, Math.round(raw)));
}

function scopeLabel(item: ScopeShopItem): string {
  return `${item.brand} ${item.name}`;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "SELECT" ||
    tag === "TEXTAREA" ||
    el.isContentEditable
  );
}

/** Admin: free scope + target/bird pick — same glass math as 100 m zeroing. */
export function AdminScopeTestPanel(_props: AdminScopeTestPanelProps) {
  const scopeItems = useMemo(
    () => getCatalogByCategory("scope").filter(isScopeItem),
    [],
  );
  const birdIds = useMemo(() => allBirdSpriteIds(), []);

  const [scopeId, setScopeId] = useState(
    () =>
      scopeItems.find((s) => s.id === "scope-zco-527-mct")?.id ??
      scopeItems[0]?.id ??
      "",
  );
  const scopeItem = scopeItems.find((s) => s.id === scopeId) ?? null;
  const scope = scopeItem?.scope ?? null;

  const [subjectKind, setSubjectKind] = useState<SubjectKind>("range");
  const [rangeTargetId, setRangeTargetId] =
    useState<RangeTargetId>("cba-100");
  const [birdId, setBirdId] = useState<BirdSpriteId>(
    () => birdIds[0] ?? "tiur-1",
  );
  const [distanceM, setDistanceM] = useState(100);
  const [easy10x, setEasy10x] = useState(false);
  const [zoom, setZoom] = useState(() => scope?.maxZoom ?? 27);
  const [aimMm, setAimMm] = useState({ x: 0, y: 0 });
  const [aimDragging, setAimDragging] = useState(false);
  const [spriteScaleEpoch, setSpriteScaleEpoch] = useState(0);
  const [bakingScales, setBakingScales] = useState(false);
  const [bakeStatus, setBakeStatus] = useState<string | null>(null);
  const [spriteScalePercent, setSpriteScalePercentUi] = useState(() =>
    getBirdSpriteScalePercent(birdId),
  );

  useEffect(() => {
    return subscribeBirdSpriteScales(() => {
      setSpriteScaleEpoch((n) => n + 1);
    });
  }, []);

  /** Keep slider + preview in sync when switching birds or after bake/HMR. */
  useEffect(() => {
    void spriteScaleEpoch;
    setSpriteScalePercentUi(getBirdSpriteScalePercent(birdId));
  }, [birdId, spriteScaleEpoch]);

  const birdSpecies = getBirdSprite(birdId).species;
  const speciesScaleDirty = isBirdSpriteSpeciesScaleDirty(birdSpecies);
  const activeScaleDirty = isBirdSpriteScaleDirty(birdId);

  const aimRef = useRef(aimMm);
  const aimDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const targetScaleRef = useRef(1);
  const pxPerMmRef = useRef(1);
  const distanceRef = useRef(distanceM);
  const subjectKindRef = useRef(subjectKind);
  const keysRef = useRef<AimKeys>({
    up: null,
    down: null,
    left: null,
    right: null,
  });

  useEffect(() => {
    aimRef.current = aimMm;
  }, [aimMm]);

  useEffect(() => {
    distanceRef.current = distanceM;
  }, [distanceM]);

  useEffect(() => {
    subjectKindRef.current = subjectKind;
  }, [subjectKind]);

  /** Snap to engraved max power when switching scope — matches range calibration. */
  useEffect(() => {
    if (!scope) return;
    setZoom(scope.maxZoom);
  }, [scopeId, scope]);

  useEffect(() => {
    setAimMm({ x: 0, y: 0 });
    keysRef.current = { up: null, down: null, left: null, right: null };
  }, [subjectKind, rangeTargetId, birdId, distanceM, scopeId]);

  /** Arrow keys — same tap + hold ramp as shooting range. */
  useEffect(() => {
    function aimLimits(): { limitX: number; limitY: number } {
      const distFactor = distanceRef.current / 100;
      const limit =
        subjectKindRef.current === "bird"
          ? 120 * distFactor
          : 80 * distFactor;
      return { limitX: limit, limitY: limit };
    }

    function applyAim(x: number, y: number) {
      const { limitX, limitY } = aimLimits();
      const next = clampAimMm(x, y, limitX, limitY);
      aimRef.current = next;
      setAimMm(next);
    }

    function nudgeAim(dxMm: number, dyMm: number) {
      applyAim(aimRef.current.x + dxMm, aimRef.current.y + dyMm);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
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
      if (!dir) return;
      e.preventDefault();
      if (keysRef.current[dir] != null) return;
      keysRef.current[dir] = performance.now();
      const step = SCOPE_AIM_TAP_MM * (distanceRef.current / 100);
      if (dir === "up") nudgeAim(0, -step);
      if (dir === "down") nudgeAim(0, step);
      if (dir === "left") nudgeAim(-step, 0);
      if (dir === "right") nudgeAim(step, 0);
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "ArrowUp") keysRef.current.up = null;
      if (e.key === "ArrowDown") keysRef.current.down = null;
      if (e.key === "ArrowLeft") keysRef.current.left = null;
      if (e.key === "ArrowRight") keysRef.current.right = null;
    }

    let raf = 0;
    let last = performance.now();

    function tick(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const k = keysRef.current;
      const mx = scopeAimHoldMult(k.left, now);
      const mr = scopeAimHoldMult(k.right, now);
      const mu = scopeAimHoldMult(k.up, now);
      const md = scopeAimHoldMult(k.down, now);
      if (mx > 0 || mr > 0 || mu > 0 || md > 0) {
        const distFactor = distanceRef.current / 100;
        const speed = AIM_SPEED_MM_PER_SEC * distFactor * dt;
        let { x, y } = aimRef.current;
        if (mx > 0) x -= speed * mx;
        if (mr > 0) x += speed * mr;
        if (mu > 0) y -= speed * mu;
        if (md > 0) y += speed * md;
        applyAim(x, y);
      }
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cancelAnimationFrame(raf);
    };
  }, []);

  const rangeTarget = getRangeTarget(rangeTargetId);
  const birdGeom = useMemo(() => birdShotGeom(birdId), [birdId]);

  const paperUnit = scope?.clickUnit === "MOA" ? "MOA" : "MRAD";

  let targetScale = 1;
  let pxPerMm = 1;
  let offsetX = 0;
  let offsetY = 0;
  let imgSrc = "";
  let imgW = 1;
  let imgH = 1;
  let imgAlt = "";
  let reticleImgScale = 0;

  if (scope && subjectKind === "range") {
    const scales = zeroingTargetAndReticleScale({
      zoom,
      scope,
      distanceM,
      target: rangeTarget,
      paperUnit,
      trackingLane: rangeTargetId === "tracking-test",
      easy10x,
    });
    targetScale = scales.targetScale;
    reticleImgScale = scales.reticleImgScale;
    pxPerMm = rangeTarget.pxPerMm;
    const off = targetBullseyeOffsetFromImageCenterPx(rangeTarget);
    offsetX = off.x;
    offsetY = off.y;
    imgSrc = rangeTarget.src;
    imgW = rangeTarget.nativeWidth;
    imgH = rangeTarget.nativeHeight;
    imgAlt = rangeTarget.label;
  } else if (scope && subjectKind === "bird") {
    targetScale = birdScopeImageScale(
      zoom,
      scope,
      distanceM,
      birdGeom.nativeW,
      birdId,
    );
    pxPerMm = birdNativePxPerMm(birdGeom);
    const off = birdVitalOffsetFromImageCenterPx(birdGeom);
    offsetX = off.x;
    offsetY = off.y;
    imgSrc = birdGeom.displaySrc;
    imgW = birdGeom.nativeW;
    imgH = birdGeom.nativeH;
    imgAlt = birdId;
    // Same optic zoom as skive — reticle must not track bird size/distance.
    reticleImgScale = opticReticleImgScale(zoom, scope, false);
  }

  targetScaleRef.current = targetScale;
  pxPerMmRef.current = pxPerMm;

  const panPxX = (offsetX + aimMm.x * pxPerMm) * targetScale;
  const panPxY = (offsetY + aimMm.y * pxPerMm) * targetScale;

  const fovDiameterScale = scope ? scopeFovDiameterScale(scope) : 1;
  const reticleDef = scope?.reticleId ? getReticleDef(scope.reticleId) : null;

  function aimLimitsMm(): { limitX: number; limitY: number } {
    const distFactor = distanceM / 100;
    const limit = subjectKind === "bird" ? 120 * distFactor : 80 * distFactor;
    return { limitX: limit, limitY: limit };
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
    const { limitX, limitY } = aimLimitsMm();
    const delta = aimMmDeltaFromPointerDrag({
      dxClientPx: e.clientX - drag.startX,
      dyClientPx: e.clientY - drag.startY,
      scale: targetScaleRef.current,
      pxPerMm: pxPerMmRef.current,
      sensitivity: 1,
    });
    const next = clampAimMm(
      drag.origX + delta.x,
      drag.origY + delta.y,
      limitX,
      limitY,
    );
    aimRef.current = next;
    setAimMm(next);
  }

  function matchRange100m() {
    setSubjectKind("range");
    setRangeTargetId("cba-100");
    setDistanceM(100);
    setEasy10x(false);
    if (scope) setZoom(scope.maxZoom);
    setAimMm({ x: 0, y: 0 });
  }

  async function bakeActiveSpeciesScales() {
    const species = getBirdSprite(birdId).species;
    const all = exportEffectiveBirdSpriteScales();
    const ids = spriteIdsForSpecies(species);
    const scales = Object.fromEntries(
      ids.map((id) => [id, all[id] ?? getBirdSpriteScalePercent(id)]),
    );
    setBakingScales(true);
    setBakeStatus("Skriver…");
    try {
      const res = await fetch("/api/admin/sprite-scales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ species, scales }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        sprites?: number;
        scales?: Record<string, number>;
      };
      if (!res.ok || !data.ok) {
        setBakeStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      applyBakedBirdSpriteScales(
        (data.scales ?? scales) as Partial<Record<BirdSpriteId, number>>,
      );
      setBakeStatus(
        `OK ${data.sprites} ${species}-sprites → repo. Commit + push.`,
      );
    } catch (err) {
      setBakeStatus(
        err instanceof Error ? err.message : "Klarte ikke å skrive filen.",
      );
    } finally {
      setBakingScales(false);
    }
  }

  return (
    <div className="admin-scope-test">
      <div className="admin-spot-controls">
        <div className="admin-spot-row">
          <label className="admin-spot-field admin-spot-field-wide">
            <span>Scope</span>
            <select
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
            >
              {scopeItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {scopeLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-spot-row">
          <label className="admin-spot-field">
            <span>Subject</span>
            <select
              value={subjectKind}
              onChange={(e) =>
                setSubjectKind(e.target.value as SubjectKind)
              }
            >
              <option value="range">Skyteskive</option>
              <option value="bird">Fugl</option>
            </select>
          </label>

          {subjectKind === "range" ? (
            <label className="admin-spot-field">
              <span>Skive</span>
              <select
                value={rangeTargetId}
                onChange={(e) =>
                  setRangeTargetId(e.target.value as RangeTargetId)
                }
              >
                {RANGE_TARGET_IDS.map((id) => {
                  const t = getRangeTarget(id);
                  return (
                    <option key={id} value={id}>
                      {t.label}
                    </option>
                  );
                })}
              </select>
            </label>
          ) : (
            <>
              <label className="admin-spot-field">
                <span>Sprite</span>
                <select
                  value={birdId}
                  onChange={(e) =>
                    setBirdId(e.target.value as BirdSpriteId)
                  }
                >
                  {birdIds.map((id) => {
                    const s = getBirdSprite(id);
                    return (
                      <option key={id} value={id}>
                        {s.species} · {id}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="admin-spot-field admin-scope-sprite-scale">
                <span>
                  Scale {spriteScalePercent}%
                  {activeScaleDirty ? " · lokal" : ""}
                </span>
                <input
                  type="range"
                  className="admin-scope-sprite-scale-slider"
                  min={BIRD_SPRITE_SCALE_MIN}
                  max={BIRD_SPRITE_SCALE_MAX}
                  step={1}
                  value={spriteScalePercent}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    // Local state first — bake writes the catalog file and can
                    // HMR-break the scale pub/sub; slider must still update.
                    const next = setBirdSpriteScalePercent(birdId, n);
                    setSpriteScalePercentUi(next);
                    setSpriteScaleEpoch((prev) => prev + 1);
                  }}
                  aria-label="Sprite scale prosent"
                  title="Samme scale som Spotting / hunt — mål mrad og juster til sann størrelse"
                />
                <span className="admin-scope-sprite-scale-ends" aria-hidden>
                  {BIRD_SPRITE_SCALE_MIN}–{BIRD_SPRITE_SCALE_MAX}
                </span>
              </label>
              <button
                type="button"
                className="intro-button admin-spot-btn"
                disabled={!speciesScaleDirty || bakingScales}
                onClick={() => void bakeActiveSpeciesScales()}
                title={
                  speciesScaleDirty
                    ? `Skriv alle ${birdSpecies}-scales til birdSpriteScaleCatalog.ts`
                    : `Ingen lokale ${birdSpecies}-endringer`
                }
              >
                {bakingScales ? "Skriver…" : "Lagre til repo"}
              </button>
            </>
          )}

          <label className="admin-spot-field admin-spot-scale">
            <span>Avstand m</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              min={DIST_MIN_M}
              max={DIST_MAX_M}
              step={DIST_STEP_M}
              value={distanceM}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                setDistanceM(clampDistanceM(n));
              }}
              aria-label="Avstand i meter"
            />
          </label>

          <button
            type="button"
            className="intro-button admin-spot-btn"
            onClick={() => setAimMm({ x: 0, y: 0 })}
          >
            Sentrer
          </button>
          <button
            type="button"
            className="intro-button admin-spot-btn"
            title="CBA 100 m, max zoom, 10× av — samme glass som zeroing-banen"
            onClick={matchRange100m}
          >
            = Range 100 m
          </button>
        </div>

        {subjectKind === "range" && rangeTargetId !== "tracking-test" ? (
          <div className="admin-spot-row">
            <button
              type="button"
              className={
                easy10x
                  ? "intro-button admin-spot-btn is-selected"
                  : "intro-button admin-spot-btn"
              }
              aria-pressed={easy10x}
              title="10× større blink (samme som skytebane 10×)"
              onClick={() => setEasy10x((v) => !v)}
            >
              10× {easy10x ? "på" : "av"}
            </button>
            {scope ? (
              <button
                type="button"
                className="intro-button admin-spot-btn"
                onClick={() => setZoom(scope.maxZoom)}
              >
                Max {scope.maxZoom}×
              </button>
            ) : null}
          </div>
        ) : null}

        <p className="admin-spot-meta">
          {scope
            ? `${zoom.toFixed(1)}× · ${paperUnit} · ${reticleDef?.label ?? scope.reticleId ?? "generic"}${fovDiameterScale > 1 ? " · premium FOV" : ""}${easy10x ? ` · 10×(×${RANGE_EASY_ZERO_SCALE})` : ""} · ${distanceM} m · piltaster / drag`
            : "Ingen scope i katalog"}
          {subjectKind === "bird"
            ? ` · hunt-skala (scale ${spriteScalePercent}%) — samme som spotting/jakt`
            : ""}
          {bakeStatus ? ` · ${bakeStatus}` : ""}
        </p>
      </div>

      {scope ? (
        <div className="shooting-range admin-scope-test-range">
          <div className="scope-stage">
            <div className="scope-stage-optic-row">
              <div
                className={
                  fovDiameterScale > 1
                    ? "scope-optic is-fov-premium"
                    : "scope-optic"
                }
              >
                <div
                  className={
                    aimDragging
                      ? "scope-viewport is-aim-dragging"
                      : "scope-viewport"
                  }
                  onPointerDown={onAimPointerDown}
                  onPointerMove={onAimPointerMove}
                  onPointerUp={(e) =>
                    endAimDrag(e.currentTarget, e.pointerId)
                  }
                  onPointerCancel={(e) =>
                    endAimDrag(e.currentTarget, e.pointerId)
                  }
                  onPointerLeave={(e) =>
                    endAimDrag(
                      e.currentTarget,
                      aimDragRef.current?.pointerId,
                    )
                  }
                  onLostPointerCapture={(e) =>
                    endAimDrag(e.currentTarget, e.pointerId)
                  }
                >
                  <div
                    className="scope-world"
                    style={{
                      transform: `translate(calc(-50% - ${panPxX}px), calc(-50% - ${panPxY}px)) scale(${targetScale})`,
                    }}
                  >
                    <div className="scope-world-scene">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className={
                          subjectKind === "bird"
                            ? "scope-target hunt-tiur-target"
                            : "scope-target"
                        }
                        src={imgSrc}
                        alt={imgAlt}
                        draggable={false}
                        width={imgW}
                        height={imgH}
                        style={{ width: imgW }}
                      />
                    </div>
                  </div>
                  <div className="scope-reticle-offset">
                    <ScopeReticle
                      scope={scope}
                      zoom={zoom}
                      imgScale={reticleImgScale}
                    />
                  </div>
                  <div className="scope-vignette" aria-hidden />
                </div>
                <ScopeZoomRing
                  scope={scope}
                  zoom={zoom}
                  onChange={(z) => setZoom(clampScopeZoom(z, scope))}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
