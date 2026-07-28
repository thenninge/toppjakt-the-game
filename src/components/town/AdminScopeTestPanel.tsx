"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { ScopeReticle } from "@/components/range/ScopeReticle";
import { ScopeOpticFit } from "@/components/range/ScopeOpticFit";
import { ScopeZoomRing } from "@/components/range/ScopeZoomRing";
import { ParallaxTurret } from "@/components/range/ParallaxTurret";
import { IlluminationTurret } from "@/components/range/IlluminationTurret";
import {
  ScopeElevationDial,
  ScopeWindageDial,
} from "@/components/range/ScopeTurrets";
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
import { angularMmAtDistance, clampElevationTurretMm } from "@/lib/player";
import { scopeFovDiameterScale } from "@/lib/optics/spec";
import {
  focusBlurHint,
  focusBlurPx,
  formatParallaxFocusM,
} from "@/lib/range/parallaxFocus";
import { BubbleLevel } from "@/components/range/BubbleLevel";
import {
  CANT_KEY_DEG_PER_SEC,
  nudgeCantDeg,
  rollEntryCantDeg,
} from "@/lib/range/cant";
import {
  turretStyleCssVars,
  turretStyleForScope,
} from "@/lib/optics/turretStyle";
import {
  SCOPE_FOV_CAL_HALF_MRAD,
  SCOPE_FOV_CAL_ZOOM,
  SCOPE_VIEWPORT_REF_PX,
  clampScopeZoom,
  RANGE_EASY_ZERO_SCALE,
} from "@/lib/range/precision";
import {
  getReticleDef,
  reticleDisplaySizePx,
  reticleOpticalCenter,
} from "@/lib/range/reticles";
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
  ccw: number | null;
  cw: number | null;
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
    useState<RangeTargetId>("tracking-test");
  const [birdId, setBirdId] = useState<BirdSpriteId>(
    () => birdIds[0] ?? "tiur-1",
  );
  const [distanceM, setDistanceM] = useState(100);
  const [easy10x, setEasy10x] = useState(false);
  const [zoom, setZoom] = useState(() => scope?.maxZoom ?? 27);
  const [aimMm, setAimMm] = useState({ x: 0, y: 0 });
  const [sessionZeroXMm, setSessionZeroXMm] = useState(0);
  const [sessionZeroYMm, setSessionZeroYMm] = useState(0);
  const [parallaxFocusM, setParallaxFocusM] = useState(100);
  const [reticleIllum, setReticleIllum] = useState(0);
  const [reticleRotDeg, setReticleRotDeg] = useState(0);
  const [opticalCenterX, setOpticalCenterX] = useState(0);
  const [opticalCenterY, setOpticalCenterY] = useState(0);
  const [centerTo1MilPx, setCenterTo1MilPx] = useState(55.5);
  const [zoomMagCal, setZoomMagCal] = useState(1);
  const [calMaxZoom, setCalMaxZoom] = useState(false);
  const [calHashmarks, setCalHashmarks] = useState(false);
  /** After «Lagre til repo», treat these as clean until scope change / HMR. */
  const [repoCalOverride, setRepoCalOverride] = useState<{
    rot: number;
    x: number;
    y: number;
    hashPx: number;
  } | null>(null);
  const [repoFovOverride, setRepoFovOverride] = useState<number | null>(null);
  const [cantDeg, setCantDeg] = useState(() => rollEntryCantDeg());
  const [aimDragging, setAimDragging] = useState(false);
  const [spriteScaleEpoch, setSpriteScaleEpoch] = useState(0);
  const [bakingScales, setBakingScales] = useState(false);
  const [bakingReticleCal, setBakingReticleCal] = useState(false);
  const [helpCross, setHelpCross] = useState(false);
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
    ccw: null,
    cw: null,
  });

  const cantDegRef = useRef(cantDeg);
  cantDegRef.current = cantDeg;

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

  /** Load catalog reticle calibration when switching scope / reticle. */
  useEffect(() => {
    const def = scope?.reticleId ? getReticleDef(scope.reticleId) : null;
    setReticleRotDeg(def?.imageRotationDeg ?? 0);
    setCenterTo1MilPx(def?.centerTo1MilPx ?? 55.5);
    setZoomMagCal(
      scope?.zoomMagCal != null && scope.zoomMagCal > 0
        ? scope.zoomMagCal
        : 1,
    );
    if (def) {
      const c = reticleOpticalCenter(def);
      setOpticalCenterX(c.x);
      setOpticalCenterY(c.y);
    } else {
      setOpticalCenterX(0);
      setOpticalCenterY(0);
    }
    setRepoCalOverride(null);
    setRepoFovOverride(null);
  }, [scopeId, scope?.reticleId, scope?.zoomMagCal]);

  useEffect(() => {
    setAimMm({ x: 0, y: 0 });
    keysRef.current = {
      up: null,
      down: null,
      left: null,
      right: null,
      ccw: null,
      cw: null,
    };
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
      if (dir) {
        e.preventDefault();
        if (keysRef.current[dir] != null) return;
        keysRef.current[dir] = performance.now();
        const step = SCOPE_AIM_TAP_MM * (distanceRef.current / 100);
        if (dir === "up") nudgeAim(0, -step);
        if (dir === "down") nudgeAim(0, step);
        if (dir === "left") nudgeAim(-step, 0);
        if (dir === "right") nudgeAim(step, 0);
        return;
      }
      if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        if (keysRef.current.ccw != null) return;
        keysRef.current.ccw = performance.now();
        setCantDeg((c) => nudgeCantDeg(c, -CANT_KEY_DEG_PER_SEC * 0.08));
        return;
      }
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        if (keysRef.current.cw != null) return;
        keysRef.current.cw = performance.now();
        setCantDeg((c) => nudgeCantDeg(c, CANT_KEY_DEG_PER_SEC * 0.08));
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "ArrowUp") keysRef.current.up = null;
      if (e.key === "ArrowDown") keysRef.current.down = null;
      if (e.key === "ArrowLeft") keysRef.current.left = null;
      if (e.key === "ArrowRight") keysRef.current.right = null;
      if (e.key === "q" || e.key === "Q") keysRef.current.ccw = null;
      if (e.key === "e" || e.key === "E") keysRef.current.cw = null;
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
      const cantCcw = scopeAimHoldMult(k.ccw, now);
      const cantCw = scopeAimHoldMult(k.cw, now);
      if (cantCcw > 0 || cantCw > 0) {
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
    const liveScope = { ...scope, zoomMagCal };
    const scales = zeroingTargetAndReticleScale({
      zoom,
      scope: liveScope,
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
    const liveScope = { ...scope, zoomMagCal };
    targetScale = birdScopeImageScale(
      zoom,
      liveScope,
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
    reticleImgScale = opticReticleImgScale(zoom, liveScope, false);
  }

  targetScaleRef.current = targetScale;
  pxPerMmRef.current = pxPerMm;

  const zeroXMm = angularMmAtDistance(sessionZeroXMm, distanceM);
  const zeroYMm = angularMmAtDistance(sessionZeroYMm, distanceM);
  const panPxX = (offsetX + (aimMm.x + zeroXMm) * pxPerMm) * targetScale;
  const panPxY = (offsetY + (aimMm.y + zeroYMm) * pxPerMm) * targetScale;

  const blurPx = focusBlurPx(distanceM, parallaxFocusM);
  const blurHint = focusBlurHint(blurPx);

  const fovDiameterScale = scope ? scopeFovDiameterScale(scope) : 1;
  const reticleDef = scope?.reticleId ? getReticleDef(scope.reticleId) : null;
  const clickUnit = scope?.clickUnit === "MOA" ? "MOA" : "MRAD";
  const catalogRotDeg =
    repoCalOverride?.rot ?? reticleDef?.imageRotationDeg ?? 0;
  const catalogCenter = repoCalOverride
    ? { x: repoCalOverride.x, y: repoCalOverride.y }
    : reticleDef
      ? reticleOpticalCenter(reticleDef)
      : { x: 0, y: 0 };
  const catalogHashPx =
    repoCalOverride?.hashPx ?? reticleDef?.centerTo1MilPx ?? 55.5;
  const catalogZoomMag =
    repoFovOverride ??
    (scope?.zoomMagCal != null && scope.zoomMagCal > 0
      ? scope.zoomMagCal
      : 1);
  /** Native px per 0.1 mil click (MRAD scopes). */
  const pxPerClick = centerTo1MilPx * 0.1;
  const midX = reticleDef ? reticleDef.nativeWidth / 2 : 0;
  const midY = reticleDef ? reticleDef.nativeHeight / 2 : 0;
  /** Positive = reticle shifted right / up on glass vs image midpoint. */
  const shiftRightClicks =
    reticleDef && pxPerClick > 0
      ? (midX - opticalCenterX) / pxPerClick
      : 0;
  const shiftUpClicks =
    reticleDef && pxPerClick > 0
      ? (opticalCenterY - midY) / pxPerClick
      : 0;
  const calDirty =
    !!reticleDef &&
    (reticleRotDeg !== catalogRotDeg ||
      Math.abs(opticalCenterX - catalogCenter.x) > 1e-6 ||
      Math.abs(opticalCenterY - catalogCenter.y) > 1e-6 ||
      Math.abs(centerTo1MilPx - catalogHashPx) > 1e-6);
  const fovDirty = Math.abs(zoomMagCal - catalogZoomMag) > 1e-6;

  const hashRingPxPerMil =
    scope && reticleDef && reticleImgScale > 0
      ? reticleDisplaySizePx(scope, zoom, reticleImgScale, {
          ...reticleDef,
          centerTo1MilPx,
        }).scale * centerTo1MilPx
      : 0;
  const glassRadiusPx =
    (SCOPE_VIEWPORT_REF_PX / 2) * fovDiameterScale;
  /** Centre→edge mils at current zoom (shared FOV lock @ 27× ±7.2). */
  const fovHalfMrad =
    (SCOPE_FOV_CAL_HALF_MRAD * SCOPE_FOV_CAL_ZOOM) /
    (Math.max(0.01, zoom) * Math.max(0.01, zoomMagCal));
  const fovRingPxPerMrad = glassRadiusPx / Math.max(0.01, fovHalfMrad);

  function round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  function round4(n: number) {
    return Math.round(n * 10000) / 10000;
  }

  function resetReticleCalToRepo() {
    setReticleRotDeg(catalogRotDeg);
    setOpticalCenterX(catalogCenter.x);
    setOpticalCenterY(catalogCenter.y);
    setCenterTo1MilPx(catalogHashPx);
  }

  async function bakeReticleCalToRepo() {
    if (!reticleDef) return;
    setBakingReticleCal(true);
    setBakeStatus("Skriver retikkel-kalibrering…");
    try {
      const res = await fetch("/api/admin/reticle-cal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reticleId: reticleDef.id,
          imageRotationDeg: reticleRotDeg,
          opticalCenterX,
          opticalCenterY,
          centerTo1MilPx,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        path?: string;
        imageRotationDeg?: number;
        opticalCenterX?: number;
        opticalCenterY?: number;
        centerTo1MilPx?: number;
      };
      if (!res.ok || !data.ok) {
        setBakeStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      if (typeof data.imageRotationDeg === "number") {
        setReticleRotDeg(data.imageRotationDeg);
      }
      if (typeof data.opticalCenterX === "number") {
        setOpticalCenterX(data.opticalCenterX);
      }
      if (typeof data.opticalCenterY === "number") {
        setOpticalCenterY(data.opticalCenterY);
      }
      if (typeof data.centerTo1MilPx === "number") {
        setCenterTo1MilPx(data.centerTo1MilPx);
      }
      setRepoCalOverride({
        rot: data.imageRotationDeg ?? reticleRotDeg,
        x: data.opticalCenterX ?? opticalCenterX,
        y: data.opticalCenterY ?? opticalCenterY,
        hashPx: data.centerTo1MilPx ?? centerTo1MilPx,
      });
      setBakeStatus(
        `OK → ${data.path ?? "reticles.ts"} (${reticleDef.id}). Commit + push.`,
      );
    } catch (err) {
      setBakeStatus(
        err instanceof Error ? err.message : "Klarte ikke å skrive filen.",
      );
    } finally {
      setBakingReticleCal(false);
    }
  }

  async function bakeFovCalToRepo() {
    if (!scopeId) return;
    setBakingReticleCal(true);
    setBakeStatus("Skriver FOV / max-zoom…");
    try {
      const res = await fetch("/api/admin/scope-fov-cal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeId, zoomMagCal }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        path?: string;
        zoomMagCal?: number;
      };
      if (!res.ok || !data.ok) {
        setBakeStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      if (typeof data.zoomMagCal === "number") {
        setZoomMagCal(data.zoomMagCal);
        setRepoFovOverride(data.zoomMagCal);
      }
      setBakeStatus(
        `OK → ${data.path ?? "catalog.ts"} zoomMagCal=${data.zoomMagCal}. Commit + push.`,
      );
    } catch (err) {
      setBakeStatus(
        err instanceof Error ? err.message : "Klarte ikke å skrive filen.",
      );
    } finally {
      setBakingReticleCal(false);
    }
  }

  function nudgeOpticalByClicks(dxClicks: number, dyClicks: number) {
    /* Right on glass → lower opticalCenterX; up on glass → higher opticalCenterY. */
    setOpticalCenterX((x) => round4(x - dxClicks * pxPerClick));
    setOpticalCenterY((y) => round4(y + dyClicks * pxPerClick));
  }

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
      viewportEl: e.currentTarget,
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
    setParallaxFocusM(100);
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

        {scope && reticleDef ? (
          <div className="admin-scope-cal">
            <p className="admin-scope-cal-hint">
              Live kalibrering. «Lagre til repo» skriver rotasjon / optisk
              senter / <code>centerTo1MilPx</code> til{" "}
              <code>reticles.ts</code>. «Lagre FOV» skriver{" "}
              <code>zoomMagCal</code> til <code>catalog.ts</code> (kun
              dev). Calibrate max zoom: mil-ringer til glasskant @ max.
              Hashmarks: mil-ringer på retikkel-hasher.
              {calDirty || fovDirty ? " · lokale endringer" : ""}
            </p>

            <div className="admin-spot-row admin-scope-rot-row">
              <label className="admin-spot-field admin-scope-rot-field">
                <span>Rotasjon {round2(reticleRotDeg)}° CW</span>
                <input
                  type="range"
                  className="admin-scope-rot-slider"
                  min={-2}
                  max={2}
                  step={0.01}
                  value={Math.min(2, Math.max(-2, reticleRotDeg))}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    setReticleRotDeg(round2(n));
                  }}
                  aria-label="Retikkel rotasjon grader clockwise"
                />
              </label>
              <label className="admin-spot-field admin-spot-scale">
                <span>°</span>
                <input
                  type="number"
                  className="admin-spot-scale-num"
                  step={0.01}
                  value={reticleRotDeg}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    setReticleRotDeg(round2(n));
                  }}
                  aria-label="Retikkel rotasjon tall"
                />
              </label>
              <button
                type="button"
                className="intro-button admin-spot-btn"
                title="−0.05° (CCW)"
                onClick={() => setReticleRotDeg((v) => round2(v - 0.05))}
              >
                −0.05°
              </button>
              <button
                type="button"
                className="intro-button admin-spot-btn"
                title="+0.05° (CW)"
                onClick={() => setReticleRotDeg((v) => round2(v + 0.05))}
              >
                +0.05°
              </button>
            </div>

            <div className="admin-spot-row">
              <label className="admin-spot-field admin-spot-scale">
                <span>Center X px</span>
                <input
                  type="number"
                  className="admin-spot-scale-num"
                  step={0.01}
                  value={round4(opticalCenterX)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    setOpticalCenterX(round4(n));
                  }}
                  aria-label="Optical center X native pixels"
                  title="opticalCenterX i reticles.ts — lavere X = retikkel til høyre på glass"
                />
              </label>
              <label className="admin-spot-field admin-spot-scale">
                <span>Center Y px</span>
                <input
                  type="number"
                  className="admin-spot-scale-num"
                  step={0.01}
                  value={round4(opticalCenterY)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    setOpticalCenterY(round4(n));
                  }}
                  aria-label="Optical center Y native pixels"
                  title="opticalCenterY i reticles.ts — høyere Y = retikkel opp på glass"
                />
              </label>
              <span className="admin-scope-cal-clicks">
                ≈ {shiftRightClicks >= 0 ? "+" : ""}
                {shiftRightClicks.toFixed(2)} klikk H /{" "}
                {shiftUpClicks >= 0 ? "+" : ""}
                {shiftUpClicks.toFixed(2)} klikk Opp
              </span>
            </div>

            <div className="admin-spot-row">
              <button
                type="button"
                className={
                  helpCross
                    ? "intro-button admin-spot-btn is-selected"
                    : "intro-button admin-spot-btn"
                }
                aria-pressed={helpCross}
                title="Grønt kors midt i glasset — align retikkel-senter"
                onClick={() => setHelpCross((v) => !v)}
              >
                Hjelpelinjer {helpCross ? "på" : "av"}
              </button>
              <button
                type="button"
                className={
                  calMaxZoom
                    ? "intro-button admin-spot-btn is-selected"
                    : "intro-button admin-spot-btn"
                }
                aria-pressed={calMaxZoom}
                title="FOV ved max zoom — mil-ringer til glasskant + zoomMagCal"
                onClick={() => {
                  setCalMaxZoom((v) => {
                    const next = !v;
                    if (next && scope) setZoom(scope.maxZoom);
                    return next;
                  });
                }}
              >
                Calibrate max zoom {calMaxZoom ? "på" : "av"}
              </button>
              <button
                type="button"
                className={
                  calHashmarks
                    ? "intro-button admin-spot-btn is-selected"
                    : "intro-button admin-spot-btn"
                }
                aria-pressed={calHashmarks}
                title="Hash spacing — centerTo1MilPx + mil-ringer på retikkel"
                onClick={() => setCalHashmarks((v) => !v)}
              >
                Calibrate reticle hashmarks {calHashmarks ? "på" : "av"}
              </button>
            </div>

            {calMaxZoom ? (
              <div className="admin-spot-row">
                <label className="admin-spot-field admin-scope-rot-field">
                  <span>
                    zoomMagCal {zoomMagCal.toFixed(3)} · FOV ±
                    {fovHalfMrad.toFixed(2)} mrad @ max
                  </span>
                  <input
                    type="range"
                    className="admin-scope-rot-slider"
                    min={0.7}
                    max={1.4}
                    step={0.005}
                    value={Math.min(1.4, Math.max(0.7, zoomMagCal))}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      setZoomMagCal(Math.round(n * 1000) / 1000);
                    }}
                    aria-label="FOV zoom mag cal"
                  />
                </label>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  onClick={() =>
                    setZoomMagCal((v) => Math.round((v - 0.01) * 1000) / 1000)
                  }
                >
                  −0.01
                </button>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  onClick={() =>
                    setZoomMagCal((v) => Math.round((v + 0.01) * 1000) / 1000)
                  }
                >
                  +0.01
                </button>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  disabled={!fovDirty}
                  onClick={() => setZoomMagCal(catalogZoomMag)}
                >
                  Nullstill FOV
                </button>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  disabled={!fovDirty || bakingReticleCal}
                  onClick={() => void bakeFovCalToRepo()}
                >
                  {bakingReticleCal ? "Skriver…" : "Lagre FOV til repo"}
                </button>
              </div>
            ) : null}

            {calHashmarks ? (
              <div className="admin-spot-row">
                <label className="admin-spot-field admin-scope-rot-field">
                  <span>centerTo1MilPx {centerTo1MilPx.toFixed(3)}</span>
                  <input
                    type="range"
                    className="admin-scope-rot-slider"
                    min={10}
                    max={120}
                    step={0.1}
                    value={Math.min(120, Math.max(10, centerTo1MilPx))}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      setCenterTo1MilPx(Math.round(n * 1000) / 1000);
                    }}
                    aria-label="Reticle center to 1 mil px"
                  />
                </label>
                <label className="admin-spot-field admin-spot-scale">
                  <span>px</span>
                  <input
                    type="number"
                    className="admin-spot-scale-num"
                    step={0.1}
                    value={centerTo1MilPx}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n) || n <= 0) return;
                      setCenterTo1MilPx(Math.round(n * 1000) / 1000);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  onClick={() =>
                    setCenterTo1MilPx(
                      (v) => Math.round((v - 0.5) * 1000) / 1000,
                    )
                  }
                >
                  −0.5
                </button>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  onClick={() =>
                    setCenterTo1MilPx(
                      (v) => Math.round((v + 0.5) * 1000) / 1000,
                    )
                  }
                >
                  +0.5
                </button>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  disabled={Math.abs(centerTo1MilPx - catalogHashPx) < 1e-6}
                  onClick={() => setCenterTo1MilPx(catalogHashPx)}
                >
                  Nullstill hash
                </button>
              </div>
            ) : null}

            <div className="admin-spot-row">
              <button
                type="button"
                className="intro-button admin-spot-btn"
                title="1 klikk venstre på glass"
                onClick={() => nudgeOpticalByClicks(-1, 0)}
              >
                ← 1
              </button>
              <button
                type="button"
                className="intro-button admin-spot-btn"
                title="1 klikk høyre på glass"
                onClick={() => nudgeOpticalByClicks(1, 0)}
              >
                1 →
              </button>
              <button
                type="button"
                className="intro-button admin-spot-btn"
                title="1 klikk opp på glass"
                onClick={() => nudgeOpticalByClicks(0, 1)}
              >
                ↑ 1
              </button>
              <button
                type="button"
                className="intro-button admin-spot-btn"
                title="1 klikk ned på glass"
                onClick={() => nudgeOpticalByClicks(0, -1)}
              >
                ↓ 1
              </button>
              <button
                type="button"
                className="intro-button admin-spot-btn"
                title="0.1 klikk høyre"
                onClick={() => nudgeOpticalByClicks(0.1, 0)}
              >
                0.1 →
              </button>
              <button
                type="button"
                className="intro-button admin-spot-btn"
                title="0.1 klikk opp"
                onClick={() => nudgeOpticalByClicks(0, 0.1)}
              >
                0.1 ↑
              </button>
              <button
                type="button"
                className="intro-button admin-spot-btn"
                disabled={!calDirty}
                title={`Hent rotasjon + center fra reticles.ts (repo: ${catalogRotDeg.toFixed(2)}° · ${catalogCenter.x.toFixed(2)}, ${catalogCenter.y.toFixed(2)})`}
                onClick={resetReticleCalToRepo}
              >
                Nullstill til repo
              </button>
              <button
                type="button"
                className="intro-button admin-spot-btn"
                disabled={!calDirty || bakingReticleCal || !reticleDef}
                title="Skriv imageRotationDeg + opticalCenterX/Y til reticles.ts"
                onClick={() => void bakeReticleCalToRepo()}
              >
                {bakingReticleCal ? "Skriver…" : "Lagre til repo"}
              </button>
            </div>
          </div>
        ) : null}

        <p className="admin-spot-meta">
          {scope
            ? `${zoom.toFixed(1)}× · ${paperUnit} · ${reticleDef?.label ?? scope.reticleId ?? "generic"}${fovDiameterScale > 1 ? " · premium FOV" : ""}${easy10x ? ` · 10×(×${RANGE_EASY_ZERO_SCALE})` : ""} · ${distanceM} m · fokus ${formatParallaxFocusM(parallaxFocusM)} · ${blurHint} · cant ${cantDeg.toFixed(1)}° · rot ${round2(reticleRotDeg)}° · cx ${round2(opticalCenterX)} cy ${round2(opticalCenterY)} · piltaster / drag`
            : "Ingen scope i katalog"}
          {subjectKind === "bird"
            ? ` · hunt-skala (scale ${spriteScalePercent}%) — samme som spotting/jakt`
            : ""}
          {bakeStatus ? ` · ${bakeStatus}` : ""}
        </p>
      </div>

      {scope ? (
        <div className="shooting-range admin-scope-test-range">
          <div
            className="admin-scope-tube-layout scope-tube-layout"
            style={turretStyleCssVars(turretStyleForScope(scopeId))}
            data-turret-style={turretStyleForScope(scopeId).id}
          >
            <div className="admin-scope-tube-elev scope-tube-elev">
              <ScopeElevationDial
                sessionZeroMm={sessionZeroYMm}
                onNudge={(d) =>
                  setSessionZeroYMm((y) =>
                    clampElevationTurretMm(y + d, scope),
                  )
                }
                clickUnit={clickUnit}
              />
            </div>
            <div className="admin-scope-tube-para scope-tube-para">
              <div className="scope-tube-para-stack">
                <IlluminationTurret
                  value={reticleIllum}
                  onChange={setReticleIllum}
                />
                <ParallaxTurret
                  focusM={parallaxFocusM}
                  onChange={setParallaxFocusM}
                />
              </div>
            </div>
            <div className="admin-scope-tube-optic scope-tube-optic">
              <div className="scope-stage">
                <ScopeOpticFit>
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
                            filter:
                              blurPx > 0.05
                                ? `blur(${blurPx.toFixed(2)}px)`
                                : undefined,
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
                            illumination={reticleIllum}
                            rotationDeg={reticleRotDeg}
                            opticalCenterPx={{
                              x: opticalCenterX,
                              y: opticalCenterY,
                            }}
                            centerTo1MilPx={centerTo1MilPx}
                          />
                        </div>
                        <div className="scope-vignette" aria-hidden />
                        {calMaxZoom && fovRingPxPerMrad > 0 ? (
                          <div
                            className="admin-scope-mil-rings is-fov"
                            aria-hidden
                          >
                            {Array.from(
                              {
                                length: Math.max(
                                  1,
                                  Math.floor(fovHalfMrad + 1e-6),
                                ),
                              },
                              (_, i) => i + 1,
                            ).map((m) => {
                              const d = 2 * m * fovRingPxPerMrad;
                              return (
                                <span
                                  key={`fov-${m}`}
                                  className="admin-scope-mil-rings-ring"
                                  data-mil={m}
                                  style={{ width: d, height: d }}
                                />
                              );
                            })}
                          </div>
                        ) : null}
                        {calHashmarks && hashRingPxPerMil > 0 ? (
                          <div
                            className="admin-scope-mil-rings is-hash"
                            aria-hidden
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(
                              (m) => {
                                const d = 2 * m * hashRingPxPerMil;
                                if (d > glassRadiusPx * 2.05) return null;
                                return (
                                  <span
                                    key={`hash-${m}`}
                                    className="admin-scope-mil-rings-ring"
                                    data-mil={m}
                                    style={{ width: d, height: d }}
                                  />
                                );
                              },
                            )}
                          </div>
                        ) : null}
                        {helpCross ? (
                          <div
                            className="admin-scope-help-cross"
                            aria-hidden
                          >
                            <span className="admin-scope-help-cross-h" />
                            <span className="admin-scope-help-cross-v" />
                            <span className="admin-scope-help-cross-dot" />
                          </div>
                        ) : null}
                      </div>
                      <ScopeZoomRing
                        scope={scope}
                        zoom={zoom}
                        onChange={(z) => setZoom(clampScopeZoom(z, scope))}
                      />
                      <BubbleLevel
                        visualId="ulf"
                        cantDeg={cantDeg}
                        onCantChange={setCantDeg}
                      />
                    </div>
                  </div>
                </ScopeOpticFit>
              </div>
            </div>
            <div className="admin-scope-tube-wind scope-tube-wind">
              <ScopeWindageDial
                sessionZeroMm={sessionZeroXMm}
                onNudge={(d) => setSessionZeroXMm((x) => x + d)}
                clickUnit={clickUnit}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
