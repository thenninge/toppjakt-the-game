"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { ScopeReticle } from "@/components/range/ScopeReticle";
import { ScopeOpticFit } from "@/components/range/ScopeOpticFit";
import { ScopeFocusZoom } from "@/components/range/ScopeFocusZoom";
import { ScopeZoomRing } from "@/components/range/ScopeZoomRing";
import { ParallaxTurret } from "@/components/range/ParallaxTurret";
import { IlluminationTurret } from "@/components/range/IlluminationTurret";
import {
  ScopeElevationDial,
  ScopeWindageDial,
  turretNudgeMoved,
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
import { spriteWidthPctForDistance } from "@/lib/hunt/birds";
import {
  perchesForSpotImage,
  spotImagesWithPerches,
} from "@/lib/hunt/spotPerches";
import {
  angularMmAtDistance,
  clampElevationTurretMm,
  clampTurretMm,
} from "@/lib/player";
import {
  DEFAULT_FOCUS_VIEWPORT_SCALE,
  DEFAULT_FOCUS_ZOOM_MULTIPLIER,
  FOCUS_VIEWPORT_SCALE_MAX,
  FOCUS_VIEWPORT_SCALE_MIN,
  FOCUS_ZOOM_MULTIPLIER_MAX,
  FOCUS_ZOOM_MULTIPLIER_MIN,
  scopeEffectiveZoomRange,
  scopeElevationClicksPerRev,
  scopeFocusViewportBoost,
  scopeFocusZoomBoost,
  scopeFovDiameterScale,
  scopeTriggercamMinZoomDefault,
  scopeWindageClicksPerRev,
  type ScopeClickUnit,
} from "@/lib/optics/spec";
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
  scopeZoomMagCalAt,
} from "@/lib/range/precision";
import {
  getReticleDef,
  normalizeReticleIllumination,
  reticleDisplaySizePx,
  reticleIlluminationKey,
  reticleOpticalCenter,
  type ReticleIllumination,
  type ReticleIlluminationRegion,
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

type IllumShapeMode = "whole" | "circleMils" | "circle" | "rect";

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

function spotImageLabel(src: string): string {
  const base = src.split("/").pop() ?? src;
  return base.replace(/\.[^.]+$/, "");
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

function buildLiveIllumination(opts: {
  shape: IllumShapeMode;
  rMils: number;
  rPx: number;
  rectX: number;
  rectY: number;
  rectW: number;
  rectH: number;
  maskSrc: string;
}): ReticleIllumination | null {
  let region: ReticleIlluminationRegion | undefined;
  if (opts.shape === "circleMils" && opts.rMils > 0) {
    region = {
      shape: "circleMils",
      rMils: Math.round(opts.rMils * 1000) / 1000,
    };
  } else if (opts.shape === "circle" && opts.rPx > 0) {
    region = { shape: "circle", r: Math.round(opts.rPx * 1000) / 1000 };
  } else if (
    opts.shape === "rect" &&
    opts.rectW > 0 &&
    opts.rectH > 0
  ) {
    region = {
      shape: "rect",
      x: Math.round(opts.rectX * 1000) / 1000,
      y: Math.round(opts.rectY * 1000) / 1000,
      w: Math.round(opts.rectW * 1000) / 1000,
      h: Math.round(opts.rectH * 1000) / 1000,
    };
  }
  return (
    normalizeReticleIllumination({
      maskSrc: opts.maskSrc.trim() || undefined,
      region,
    }) ?? null
  );
}

function hydrateIllumStateFromCatalog(
  illum: ReticleIllumination | null | undefined,
): {
  shape: IllumShapeMode;
  rMils: number;
  rPx: number;
  rectX: number;
  rectY: number;
  rectW: number;
  rectH: number;
  maskSrc: string;
} {
  const n = normalizeReticleIllumination(illum ?? undefined);
  const maskSrc = n?.maskSrc ?? "";
  const region = n?.region;
  if (!region) {
    return {
      shape: "whole",
      rMils: 1.5,
      rPx: 80,
      rectX: 0,
      rectY: 0,
      rectW: 200,
      rectH: 200,
      maskSrc,
    };
  }
  if (region.shape === "circleMils") {
    return {
      shape: "circleMils",
      rMils: region.rMils,
      rPx: 80,
      rectX: 0,
      rectY: 0,
      rectW: 200,
      rectH: 200,
      maskSrc,
    };
  }
  if (region.shape === "circle") {
    return {
      shape: "circle",
      rMils: 1.5,
      rPx: region.r,
      rectX: 0,
      rectY: 0,
      rectW: 200,
      rectH: 200,
      maskSrc,
    };
  }
  return {
    shape: "rect",
    rMils: 1.5,
    rPx: 80,
    rectX: region.x,
    rectY: region.y,
    rectW: region.w,
    rectH: region.h,
    maskSrc,
  };
}

/** Admin: free scope + target/bird pick — same glass math as 100 m zeroing. */
export function AdminScopeTestPanel(_props: AdminScopeTestPanelProps) {
  // Fresh each render so FOV bake + HMR show the latest catalog (do not freeze).
  const scopeItems = getCatalogByCategory("scope").filter(isScopeItem);
  const birdIds = useMemo(() => allBirdSpriteIds(), []);

  const [scopeId, setScopeId] = useState(
    () =>
      getCatalogByCategory("scope").filter(isScopeItem).find(
        (s) => s.id === "scope-zco-527-mct",
      )?.id ??
      getCatalogByCategory("scope").filter(isScopeItem)[0]?.id ??
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
  /** Spotting landscape behind bird — default off for clean hash/FOV cal. */
  const [spotBgEnabled, setSpotBgEnabled] = useState(false);
  const spotImageOptions = useMemo(() => spotImagesWithPerches(), []);
  const [spotImageSrc, setSpotImageSrc] = useState(
    () => spotImageOptions[0] ?? "",
  );
  const [spotFocusX, setSpotFocusX] = useState(50);
  const [spotFocusY, setSpotFocusY] = useState(50);
  const [landAspect, setLandAspect] = useState(16 / 9);
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
  const [minZoomMagCal, setMinZoomMagCal] = useState(1);
  const [liveMinZoom, setLiveMinZoom] = useState(() => scope?.minZoom ?? 5);
  const [liveMaxZoom, setLiveMaxZoom] = useState(() => scope?.maxZoom ?? 27);
  const [liveClickUnit, setLiveClickUnit] = useState<ScopeClickUnit>(() =>
    scope?.clickUnit === "MOA" ? "MOA" : "MRAD",
  );
  const [reticleSrcOverride, setReticleSrcOverride] = useState<string | null>(
    null,
  );
  const [reticleNativeOverride, setReticleNativeOverride] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [uploadedReticleId, setUploadedReticleId] = useState<string | null>(
    null,
  );
  const [uploadingReticle, setUploadingReticle] = useState(false);
  const [calMaxZoom, setCalMaxZoom] = useState(false);
  const [calMinZoom, setCalMinZoom] = useState(false);
  const [focusZoomEnabled, setFocusZoomEnabled] = useState(false);
  const [focusZoomMultiplier, setFocusZoomMultiplier] = useState(
    DEFAULT_FOCUS_ZOOM_MULTIPLIER,
  );
  const [focusViewportScale, setFocusViewportScale] = useState(
    DEFAULT_FOCUS_VIEWPORT_SCALE,
  );
  /** Catalog flag + admin preview (simulates Triggercam in kit when on). */
  const [triggercamZoomRestrict, setTriggercamZoomRestrict] = useState(false);
  const [triggercamMinZoom, setTriggercamMinZoom] = useState(24);
  const [triggercamMaxZoom, setTriggercamMaxZoom] = useState(27);
  /** Local sticky lock for focus preview (optional; F-hold is the primary). */
  const [previewFocusSticky, setPreviewFocusSticky] = useState(false);
  /** Momentary F-held focus preview. */
  const [previewFocusHeld, setPreviewFocusHeld] = useState(false);
  const previewFocusZoom = previewFocusSticky || previewFocusHeld;
  const focusZoomEnabledRef = useRef(false);
  const previewFocusStickyRef = useRef(false);
  focusZoomEnabledRef.current = focusZoomEnabled;
  previewFocusStickyRef.current = previewFocusSticky;
  const [calHashmarks, setCalHashmarks] = useState(false);
  const [calIllum, setCalIllum] = useState(false);
  const [illumShape, setIllumShape] = useState<IllumShapeMode>("whole");
  const [illumRMils, setIllumRMils] = useState(1.5);
  const [illumRPx, setIllumRPx] = useState(80);
  const [illumRectX, setIllumRectX] = useState(0);
  const [illumRectY, setIllumRectY] = useState(0);
  const [illumRectW, setIllumRectW] = useState(200);
  const [illumRectH, setIllumRectH] = useState(200);
  const [illumMaskSrc, setIllumMaskSrc] = useState("");
  /** After «Lagre til repo», treat these as clean until scope change / HMR. */
  const [repoCalOverride, setRepoCalOverride] = useState<{
    rot: number;
    x: number;
    y: number;
    hashPx: number;
    illumination: ReticleIllumination | null;
  } | null>(null);
  const [repoFovOverride, setRepoFovOverride] = useState<{
    zoomMagCal: number;
    minZoomMagCal: number;
  } | null>(null);
  const [repoFocusZoomOverride, setRepoFocusZoomOverride] = useState<{
    focusZoomEnabled: boolean;
    focusZoomMultiplier: number;
    focusViewportScale: number;
  } | null>(null);
  const [repoTriggercamZoomOverride, setRepoTriggercamZoomOverride] = useState<{
    triggercamZoomRestrict: boolean;
    triggercamMinZoom: number;
    triggercamMaxZoom: number;
  } | null>(null);
  const [repoScopeOverride, setRepoScopeOverride] = useState<{
    minZoom: number;
    maxZoom: number;
    clickUnit: ScopeClickUnit;
  } | null>(null);
  const [cantDeg, setCantDeg] = useState(() => rollEntryCantDeg());
  const [cantEnabled, setCantEnabled] = useState(false);
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
  const spotBgEnabledRef = useRef(spotBgEnabled);
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
  const effectiveCantDeg = cantEnabled ? cantDeg : 0;
  const worldRollDeg = -effectiveCantDeg;

  useEffect(() => {
    aimRef.current = aimMm;
  }, [aimMm]);

  useEffect(() => {
    distanceRef.current = distanceM;
  }, [distanceM]);

  useEffect(() => {
    subjectKindRef.current = subjectKind;
  }, [subjectKind]);

  useEffect(() => {
    spotBgEnabledRef.current = spotBgEnabled;
  }, [spotBgEnabled]);

  /** Place bird on a matching perch (or frame centre) when spotting bg is on. */
  useEffect(() => {
    if (!spotBgEnabled || !spotImageSrc) {
      setSpotFocusX(50);
      setSpotFocusY(50);
      return;
    }
    const species = getBirdSprite(birdId).species;
    const perches = perchesForSpotImage(spotImageSrc);
    const match =
      perches.find((p) => p.species === species) ?? perches[0] ?? null;
    if (match) {
      setSpotFocusX(match.x);
      setSpotFocusY(match.y);
    } else {
      setSpotFocusX(50);
      setSpotFocusY(50);
    }
  }, [spotBgEnabled, spotImageSrc, birdId]);

  /** Snap to engraved max power when switching scope — matches range calibration. */
  useEffect(() => {
    const sc = getCatalogByCategory("scope")
      .filter(isScopeItem)
      .find((s) => s.id === scopeId)?.scope;
    if (!sc) return;
    setLiveMinZoom(sc.minZoom);
    setLiveMaxZoom(sc.maxZoom);
    setLiveClickUnit(sc.clickUnit === "MOA" ? "MOA" : "MRAD");
    setReticleSrcOverride(null);
    setReticleNativeOverride(null);
    setUploadedReticleId(null);
    setRepoScopeOverride(null);
    setZoom(sc.maxZoom);
  }, [scopeId]);

  /**
   * Load catalog reticle / FOV calibration only when switching scope.
   * Do NOT re-hydrate on catalog HMR of zoomMagCal — that was wiping in-progress
   * max-zoom cal (and racing the bake write) for NX8 MOA and others.
   */
  useEffect(() => {
    const sc = getCatalogByCategory("scope")
      .filter(isScopeItem)
      .find((s) => s.id === scopeId)?.scope;
    const def = sc?.reticleId ? getReticleDef(sc.reticleId) : null;
    setReticleRotDeg(def?.imageRotationDeg ?? 0);
    setCenterTo1MilPx(def?.centerTo1MilPx ?? 55.5);
    setZoomMagCal(
      sc?.zoomMagCal != null && sc.zoomMagCal > 0 ? sc.zoomMagCal : 1,
    );
    setMinZoomMagCal(
      sc?.minZoomMagCal != null && sc.minZoomMagCal > 0
        ? sc.minZoomMagCal
        : sc?.zoomMagCal != null && sc.zoomMagCal > 0
          ? sc.zoomMagCal
          : 1,
    );
    setFocusZoomEnabled(sc?.focusZoomEnabled === true);
    setFocusZoomMultiplier(
      sc?.focusZoomMultiplier != null &&
        Number.isFinite(sc.focusZoomMultiplier)
        ? Math.min(
            FOCUS_ZOOM_MULTIPLIER_MAX,
            Math.max(FOCUS_ZOOM_MULTIPLIER_MIN, sc.focusZoomMultiplier),
          )
        : DEFAULT_FOCUS_ZOOM_MULTIPLIER,
    );
    setFocusViewportScale(
      sc?.focusViewportScale != null &&
        Number.isFinite(sc.focusViewportScale)
        ? Math.min(
            FOCUS_VIEWPORT_SCALE_MAX,
            Math.max(FOCUS_VIEWPORT_SCALE_MIN, sc.focusViewportScale),
          )
        : DEFAULT_FOCUS_VIEWPORT_SCALE,
    );
    setTriggercamZoomRestrict(sc?.triggercamZoomRestrict === true);
    {
      const base = {
        minZoom: sc?.minZoom ?? 5,
        maxZoom: sc?.maxZoom ?? 27,
      };
      setTriggercamMinZoom(
        sc?.triggercamMinZoom != null && Number.isFinite(sc.triggercamMinZoom)
          ? sc.triggercamMinZoom
          : scopeTriggercamMinZoomDefault(base),
      );
      setTriggercamMaxZoom(
        sc?.triggercamMaxZoom != null && Number.isFinite(sc.triggercamMaxZoom)
          ? sc.triggercamMaxZoom
          : base.maxZoom,
      );
    }
    setPreviewFocusSticky(false);
    setPreviewFocusHeld(false);
    if (def) {
      const c = reticleOpticalCenter(def);
      setOpticalCenterX(c.x);
      setOpticalCenterY(c.y);
      const h = hydrateIllumStateFromCatalog(def.illumination);
      setIllumShape(h.shape);
      setIllumRMils(h.rMils);
      setIllumRPx(h.rPx);
      setIllumRectX(h.rectX);
      setIllumRectY(h.rectY);
      setIllumRectW(h.rectW);
      setIllumRectH(h.rectH);
      setIllumMaskSrc(h.maskSrc);
    } else {
      setOpticalCenterX(0);
      setOpticalCenterY(0);
      const h = hydrateIllumStateFromCatalog(undefined);
      setIllumShape(h.shape);
      setIllumRMils(h.rMils);
      setIllumRPx(h.rPx);
      setIllumRectX(h.rectX);
      setIllumRectY(h.rectY);
      setIllumRectW(h.rectW);
      setIllumRectH(h.rectH);
      setIllumMaskSrc(h.maskSrc);
    }
    setRepoCalOverride(null);
    setRepoFovOverride(null);
    setRepoFocusZoomOverride(null);
    setRepoTriggercamZoomOverride(null);
  }, [scopeId]);

  function applyIlluminationToState(
    illum: ReticleIllumination | null | undefined,
  ) {
    const n = normalizeReticleIllumination(illum ?? undefined);
    setIllumMaskSrc(n?.maskSrc ?? "");
    const region = n?.region;
    if (!region) {
      setIllumShape("whole");
      return;
    }
    if (region.shape === "circleMils") {
      setIllumShape("circleMils");
      setIllumRMils(region.rMils);
      return;
    }
    if (region.shape === "circle") {
      setIllumShape("circle");
      setIllumRPx(region.r);
      return;
    }
    setIllumShape("rect");
    setIllumRectX(region.x);
    setIllumRectY(region.y);
    setIllumRectW(region.w);
    setIllumRectH(region.h);
  }

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
  }, [subjectKind, rangeTargetId, birdId, distanceM, scopeId, spotBgEnabled, spotImageSrc]);

  /** Arrow keys — same tap + hold ramp as shooting range. */
  useEffect(() => {
    function aimLimits(): { limitX: number; limitY: number } {
      const distFactor = distanceRef.current / 100;
      const limit =
        spotBgEnabledRef.current && subjectKindRef.current === "bird"
          ? 420 * distFactor
          : subjectKindRef.current === "bird"
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
        if (!cantEnabled) return;
        if (keysRef.current.ccw != null) return;
        keysRef.current.ccw = performance.now();
        setCantDeg((c) => nudgeCantDeg(c, -CANT_KEY_DEG_PER_SEC * 0.08));
        return;
      }
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        if (!cantEnabled) return;
        if (keysRef.current.cw != null) return;
        keysRef.current.cw = performance.now();
        setCantDeg((c) => nudgeCantDeg(c, CANT_KEY_DEG_PER_SEC * 0.08));
        return;
      }
      if (e.key === "f" || e.key === "F") {
        if (!focusZoomEnabledRef.current) return;
        if (e.repeat) return;
        e.preventDefault();
        setPreviewFocusHeld(true);
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "ArrowUp") keysRef.current.up = null;
      if (e.key === "ArrowDown") keysRef.current.down = null;
      if (e.key === "ArrowLeft") keysRef.current.left = null;
      if (e.key === "ArrowRight") keysRef.current.right = null;
      if (e.key === "q" || e.key === "Q") keysRef.current.ccw = null;
      if (e.key === "e" || e.key === "E") keysRef.current.cw = null;
      if (e.key === "f" || e.key === "F") {
        setPreviewFocusHeld(false);
      }
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
      if (cantEnabled && (cantCcw > 0 || cantCw > 0)) {
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

  const paperUnit = liveClickUnit === "MOA" ? "MOA" : "MRAD";

  const liveScope = scope
    ? {
        ...scope,
        zoomMagCal,
        minZoomMagCal,
        minZoom: liveMinZoom,
        maxZoom: liveMaxZoom,
        clickUnit: liveClickUnit,
        focusZoomEnabled,
        focusZoomMultiplier,
        focusViewportScale,
        triggercamZoomRestrict,
        triggercamMinZoom,
        triggercamMaxZoom,
        ...(uploadedReticleId ? { reticleId: uploadedReticleId } : null),
      }
    : null;

  const zoomRange = useMemo(
    () =>
      scopeEffectiveZoomRange(
        {
          minZoom: liveMinZoom,
          maxZoom: liveMaxZoom,
          triggercamZoomRestrict,
          triggercamMinZoom,
          triggercamMaxZoom,
        },
        triggercamZoomRestrict,
      ),
    [
      liveMinZoom,
      liveMaxZoom,
      triggercamZoomRestrict,
      triggercamMinZoom,
      triggercamMaxZoom,
    ],
  );

  useEffect(() => {
    setZoom((z) => clampScopeZoom(z, zoomRange));
  }, [zoomRange.minZoom, zoomRange.maxZoom]);

  let targetScale = 1;
  let pxPerMm = 1;
  let offsetX = 0;
  let offsetY = 0;
  let imgSrc = "";
  let imgW = 1;
  let imgH = 1;
  let imgAlt = "";
  let reticleImgScale = 0;
  let birdWidthPct = 2;
  let sceneW = 1;
  let sceneH = 1;
  const useSpotLandscape =
    spotBgEnabled &&
    subjectKind === "bird" &&
    !!spotImageSrc &&
    !!liveScope;
  const focusZoomBoost = liveScope
    ? scopeFocusZoomBoost(liveScope, previewFocusZoom)
    : 1;
  const focusViewportBoost = liveScope
    ? scopeFocusViewportBoost(liveScope, previewFocusZoom)
    : 1;

  if (liveScope && subjectKind === "range") {
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
  } else if (liveScope && subjectKind === "bird") {
    birdWidthPct = Math.max(
      0.05,
      spriteWidthPctForDistance(distanceM, birdId),
    );
    targetScale = birdScopeImageScale(
      zoom,
      liveScope,
      distanceM,
      birdGeom.nativeW,
      birdId,
      useSpotLandscape ? birdWidthPct : undefined,
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
    reticleImgScale = opticReticleImgScale(zoom, liveScope);
    if (useSpotLandscape) {
      sceneW = birdGeom.nativeW * (100 / birdWidthPct);
      sceneH = sceneW / Math.max(0.25, landAspect);
    }
  }

  targetScaleRef.current = targetScale;
  pxPerMmRef.current = pxPerMm;

  const zeroXMm = angularMmAtDistance(sessionZeroXMm, distanceM);
  const zeroYMm = angularMmAtDistance(sessionZeroYMm, distanceM);
  let panPxX: number;
  let panPxY: number;
  if (useSpotLandscape) {
    const aimPxX = (aimMm.x + zeroXMm) * pxPerMm;
    const aimPxY = (aimMm.y + zeroYMm) * pxPerMm;
    const birdCx = (spotFocusX / 100) * sceneW;
    const birdCy = (spotFocusY / 100) * sceneH;
    const ox = birdCx - sceneW / 2;
    const oy = birdCy - sceneH / 2;
    panPxX = (ox + offsetX + aimPxX) * targetScale;
    panPxY = (oy + offsetY + aimPxY) * targetScale;
  } else {
    panPxX = (offsetX + (aimMm.x + zeroXMm) * pxPerMm) * targetScale;
    panPxY = (offsetY + (aimMm.y + zeroYMm) * pxPerMm) * targetScale;
  }

  const blurPx = focusBlurPx(distanceM, parallaxFocusM);
  const blurHint = focusBlurHint(blurPx);

  const fovDiameterScale = scope ? scopeFovDiameterScale(scope) : 1;
  const reticleDef = scope?.reticleId ? getReticleDef(scope.reticleId) : null;
  const clickUnit = liveClickUnit;
  const catalogRotDeg =
    repoCalOverride?.rot ?? reticleDef?.imageRotationDeg ?? 0;
  const catalogCenter = repoCalOverride
    ? { x: repoCalOverride.x, y: repoCalOverride.y }
    : reticleDef
      ? reticleOpticalCenter(reticleDef)
      : { x: 0, y: 0 };
  const catalogHashPx =
    repoCalOverride?.hashPx ?? reticleDef?.centerTo1MilPx ?? 55.5;
  const catalogIllum =
    repoCalOverride != null
      ? repoCalOverride.illumination
      : (reticleDef?.illumination ?? null);
  const catalogZoomMag =
    repoFovOverride?.zoomMagCal ??
    (scope?.zoomMagCal != null && scope.zoomMagCal > 0
      ? scope.zoomMagCal
      : 1);
  const catalogHasMinZoomMag =
    repoFovOverride?.minZoomMagCal != null ||
    (scope?.minZoomMagCal != null && scope.minZoomMagCal > 0);
  const catalogMinZoomMag = catalogHasMinZoomMag
    ? (repoFovOverride?.minZoomMagCal ?? (scope?.minZoomMagCal as number))
    : catalogZoomMag;
  const catalogMinZoom = repoScopeOverride?.minZoom ?? scope?.minZoom ?? 5;
  const catalogMaxZoom = repoScopeOverride?.maxZoom ?? scope?.maxZoom ?? 27;
  const catalogClickUnit =
    repoScopeOverride?.clickUnit ??
    (scope?.clickUnit === "MOA" ? "MOA" : "MRAD");
  /** Native px per turret click (0.1 mil / 0.25 MOA). */
  const pxPerClick =
    clickUnit === "MOA" ? centerTo1MilPx * 0.25 : centerTo1MilPx * 0.1;
  const nativeW =
    reticleNativeOverride?.width ?? reticleDef?.nativeWidth ?? 0;
  const nativeH =
    reticleNativeOverride?.height ?? reticleDef?.nativeHeight ?? 0;
  const midX = nativeW / 2;
  const midY = nativeH / 2;
  /** Positive = reticle shifted right / up on glass vs image midpoint. */
  const shiftRightClicks =
    reticleDef && pxPerClick > 0
      ? (midX - opticalCenterX) / pxPerClick
      : 0;
  const shiftUpClicks =
    reticleDef && pxPerClick > 0
      ? (opticalCenterY - midY) / pxPerClick
      : 0;

  const liveIllumination = buildLiveIllumination({
    shape: illumShape,
    rMils: illumRMils,
    rPx: illumRPx,
    rectX: illumRectX,
    rectY: illumRectY,
    rectW: illumRectW,
    rectH: illumRectH,
    maskSrc: illumMaskSrc,
  });

  const calDirty =
    !!(reticleDef || reticleSrcOverride) &&
    (reticleRotDeg !== catalogRotDeg ||
      Math.abs(opticalCenterX - catalogCenter.x) > 1e-6 ||
      Math.abs(opticalCenterY - catalogCenter.y) > 1e-6 ||
      Math.abs(centerTo1MilPx - catalogHashPx) > 1e-6 ||
      reticleIlluminationKey(liveIllumination) !==
        reticleIlluminationKey(catalogIllum));
  const fovDirty =
    Math.abs(zoomMagCal - catalogZoomMag) > 1e-6 ||
    Math.abs(minZoomMagCal - catalogMinZoomMag) > 1e-6 ||
    !catalogHasMinZoomMag;
  const minFovDirty =
    Math.abs(minZoomMagCal - catalogMinZoomMag) > 1e-6 ||
    !catalogHasMinZoomMag;
  const catalogFocusZoomEnabled =
    repoFocusZoomOverride?.focusZoomEnabled ??
    scope?.focusZoomEnabled === true;
  const catalogFocusZoomMultiplier =
    repoFocusZoomOverride?.focusZoomMultiplier ??
    (scope?.focusZoomMultiplier != null &&
    Number.isFinite(scope.focusZoomMultiplier)
      ? Math.min(
          FOCUS_ZOOM_MULTIPLIER_MAX,
          Math.max(FOCUS_ZOOM_MULTIPLIER_MIN, scope.focusZoomMultiplier),
        )
      : DEFAULT_FOCUS_ZOOM_MULTIPLIER);
  const catalogFocusViewportScale =
    repoFocusZoomOverride?.focusViewportScale ??
    (scope?.focusViewportScale != null &&
    Number.isFinite(scope.focusViewportScale)
      ? Math.min(
          FOCUS_VIEWPORT_SCALE_MAX,
          Math.max(FOCUS_VIEWPORT_SCALE_MIN, scope.focusViewportScale),
        )
      : DEFAULT_FOCUS_VIEWPORT_SCALE);
  const focusZoomDirty =
    focusZoomEnabled !== catalogFocusZoomEnabled ||
    Math.abs(focusZoomMultiplier - catalogFocusZoomMultiplier) > 1e-6 ||
    Math.abs(focusViewportScale - catalogFocusViewportScale) > 1e-6 ||
    (focusZoomEnabled &&
      repoFocusZoomOverride == null &&
      scope?.focusZoomEnabled !== true);
  const catalogTriggercamRestrict =
    repoTriggercamZoomOverride?.triggercamZoomRestrict ??
    scope?.triggercamZoomRestrict === true;
  const catalogTriggercamMin =
    repoTriggercamZoomOverride?.triggercamMinZoom ??
    (scope?.triggercamMinZoom != null &&
    Number.isFinite(scope.triggercamMinZoom)
      ? scope.triggercamMinZoom
      : scopeTriggercamMinZoomDefault({
          minZoom: catalogMinZoom,
          maxZoom: catalogMaxZoom,
        }));
  const catalogTriggercamMax =
    repoTriggercamZoomOverride?.triggercamMaxZoom ??
    (scope?.triggercamMaxZoom != null &&
    Number.isFinite(scope.triggercamMaxZoom)
      ? scope.triggercamMaxZoom
      : catalogMaxZoom);
  const triggercamZoomDirty =
    triggercamZoomRestrict !== catalogTriggercamRestrict ||
    Math.abs(triggercamMinZoom - catalogTriggercamMin) > 1e-6 ||
    Math.abs(triggercamMaxZoom - catalogTriggercamMax) > 1e-6 ||
    (triggercamZoomRestrict &&
      repoTriggercamZoomOverride == null &&
      scope?.triggercamZoomRestrict !== true);
  const scopeSpecDirty =
    Math.abs(liveMinZoom - catalogMinZoom) > 1e-6 ||
    Math.abs(liveMaxZoom - catalogMaxZoom) > 1e-6 ||
    liveClickUnit !== catalogClickUnit;

  const hashRingPxPerUnit =
    liveScope && (reticleDef || reticleNativeOverride) && reticleImgScale > 0
      ? reticleDisplaySizePx(
          liveScope,
          zoom,
          reticleImgScale,
          reticleDef
            ? {
                ...reticleDef,
                centerTo1MilPx,
                ...(reticleNativeOverride
                  ? {
                      nativeWidth: reticleNativeOverride.width,
                      nativeHeight: reticleNativeOverride.height,
                    }
                  : null),
              }
            : {
                id: "upload",
                label: "Upload",
                src: reticleSrcOverride ?? "",
                nativeWidth: reticleNativeOverride!.width,
                nativeHeight: reticleNativeOverride!.height,
                centerTo1MilPx,
              },
        ).scale * centerTo1MilPx
      : 0;
  /** Alias — illumination / legacy call sites. */
  const hashRingPxPerMil = hashRingPxPerUnit;
  const hashUnitIsMoa = clickUnit === "MOA";
  const hashUnitShort = hashUnitIsMoa ? "MOA" : "mil";
  const hashRingCount = hashUnitIsMoa ? 15 : 12;
  const glassRadiusPx =
    (SCOPE_VIEWPORT_REF_PX / 2) * fovDiameterScale;
  /** Centre→edge mils at current zoom (shared FOV lock @ 27× ±7.2). */
  const fovHalfMrad =
    (SCOPE_FOV_CAL_HALF_MRAD * SCOPE_FOV_CAL_ZOOM) /
    (Math.max(0.01, zoom) *
      Math.max(
        0.01,
        scopeZoomMagCalAt(zoom, {
          minZoom: liveMinZoom,
          maxZoom: liveMaxZoom,
          zoomMagCal,
          minZoomMagCal,
        }),
      ));
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
    const h = hydrateIllumStateFromCatalog(catalogIllum);
    setIllumShape(h.shape);
    setIllumRMils(h.rMils);
    setIllumRPx(h.rPx);
    setIllumRectX(h.rectX);
    setIllumRectY(h.rectY);
    setIllumRectW(h.rectW);
    setIllumRectH(h.rectH);
    setIllumMaskSrc(h.maskSrc);
  }

  async function bakeReticleCalToRepo() {
    const reticleId = reticleDef?.id ?? uploadedReticleId;
    if (!reticleId) return;
    setBakingReticleCal(true);
    setBakeStatus("Skriver retikkel-kalibrering…");
    try {
      const res = await fetch("/api/admin/reticle-cal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reticleId,
          imageRotationDeg: reticleRotDeg,
          opticalCenterX,
          opticalCenterY,
          centerTo1MilPx,
          illumination: liveIllumination,
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
        illumination?: ReticleIllumination | null;
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
      const savedIllum =
        data.illumination !== undefined
          ? (data.illumination ?? null)
          : liveIllumination;
      const h = hydrateIllumStateFromCatalog(savedIllum);
      setIllumShape(h.shape);
      setIllumRMils(h.rMils);
      setIllumRPx(h.rPx);
      setIllumRectX(h.rectX);
      setIllumRectY(h.rectY);
      setIllumRectW(h.rectW);
      setIllumRectH(h.rectH);
      setIllumMaskSrc(h.maskSrc);
      setRepoCalOverride({
        rot: data.imageRotationDeg ?? reticleRotDeg,
        x: data.opticalCenterX ?? opticalCenterX,
        y: data.opticalCenterY ?? opticalCenterY,
        hashPx: data.centerTo1MilPx ?? centerTo1MilPx,
        illumination: savedIllum,
      });
      setBakeStatus(
        `OK → ${data.path ?? "reticles.ts"} (${reticleId}). Commit + push.`,
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
    const clamped =
      Math.round(Math.min(1.4, Math.max(0.1, zoomMagCal)) * 1000) / 1000;
    setZoomMagCal(clamped);
    setBakingReticleCal(true);
    setBakeStatus("Skriver FOV / max-zoom…");
    try {
      const res = await fetch("/api/admin/scope-cal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeId, zoomMagCal: clamped }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        path?: string;
        zoomMagCal?: number;
        verified?: boolean;
      };
      if (!res.ok || !data.ok) {
        setBakeStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      const saved =
        typeof data.zoomMagCal === "number" ? data.zoomMagCal : clamped;
      setZoomMagCal(saved);
      setRepoFovOverride((prev) => ({
        zoomMagCal: saved,
        minZoomMagCal: prev?.minZoomMagCal ?? catalogMinZoomMag,
      }));
      setBakeStatus(
        `OK → ${data.path ?? "catalog.ts"} zoomMagCal=${saved}${
          data.verified === false ? " (advarsel: verify feilet)" : ""
        }. Commit + push.`,
      );
    } catch (err) {
      setBakeStatus(
        err instanceof Error ? err.message : "Klarte ikke å skrive filen.",
      );
    } finally {
      setBakingReticleCal(false);
    }
  }

  async function bakeMinFovCalToRepo() {
    if (!scopeId) return;
    const clamped =
      Math.round(Math.min(1.9, Math.max(0.1, minZoomMagCal)) * 1000) / 1000;
    setMinZoomMagCal(clamped);
    setBakingReticleCal(true);
    setBakeStatus("Skriver min-zoom FOV til repo…");
    try {
      const res = await fetch("/api/admin/scope-cal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scopeId, minZoomMagCal: clamped }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        path?: string;
        minZoomMagCal?: number;
        verified?: boolean;
      };
      if (!res.ok || !data.ok) {
        setBakeStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      const saved =
        typeof data.minZoomMagCal === "number" ? data.minZoomMagCal : clamped;
      setMinZoomMagCal(saved);
      setRepoFovOverride((prev) => ({
        zoomMagCal: prev?.zoomMagCal ?? catalogZoomMag,
        minZoomMagCal: saved,
      }));
      setBakeStatus(
        `OK → ${data.path ?? "catalog.ts"} minZoomMagCal=${saved}${
          data.verified === false ? " (advarsel: verify feilet)" : ""
        }. Commit + push.`,
      );
    } catch (err) {
      setBakeStatus(
        err instanceof Error ? err.message : "Klarte ikke å skrive filen.",
      );
    } finally {
      setBakingReticleCal(false);
    }
  }

  async function bakeFocusZoomToRepo() {
    if (!scopeId) return;
    const clamped =
      Math.round(
        Math.min(
          FOCUS_ZOOM_MULTIPLIER_MAX,
          Math.max(FOCUS_ZOOM_MULTIPLIER_MIN, focusZoomMultiplier),
        ) * 100,
      ) / 100;
    const clampedViewport =
      Math.round(
        Math.min(
          FOCUS_VIEWPORT_SCALE_MAX,
          Math.max(FOCUS_VIEWPORT_SCALE_MIN, focusViewportScale),
        ) * 1000,
      ) / 1000;
    setFocusZoomMultiplier(clamped);
    setFocusViewportScale(clampedViewport);
    setBakingReticleCal(true);
    setBakeStatus("Skriver focus zoom til repo…");
    try {
      const res = await fetch("/api/admin/scope-cal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeId,
          focusZoomEnabled,
          focusZoomMultiplier: clamped,
          focusViewportScale: clampedViewport,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        path?: string;
        focusZoomEnabled?: boolean;
        focusZoomMultiplier?: number;
        focusViewportScale?: number;
      };
      if (!res.ok || !data.ok) {
        setBakeStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      const savedEnabled =
        typeof data.focusZoomEnabled === "boolean"
          ? data.focusZoomEnabled
          : focusZoomEnabled;
      const savedMult =
        typeof data.focusZoomMultiplier === "number"
          ? data.focusZoomMultiplier
          : clamped;
      const savedViewport =
        typeof data.focusViewportScale === "number"
          ? data.focusViewportScale
          : clampedViewport;
      setFocusZoomEnabled(savedEnabled);
      setFocusZoomMultiplier(savedMult);
      setFocusViewportScale(savedViewport);
      setRepoFocusZoomOverride({
        focusZoomEnabled: savedEnabled,
        focusZoomMultiplier: savedMult,
        focusViewportScale: savedViewport,
      });
      setBakeStatus(
        `OK → ${data.path ?? "catalog.ts"} focusZoom ${savedEnabled ? "på" : "av"} ×${savedMult} glass×${savedViewport}. Commit + push.`,
      );
    } catch (err) {
      setBakeStatus(
        err instanceof Error ? err.message : "Klarte ikke å skrive filen.",
      );
    } finally {
      setBakingReticleCal(false);
    }
  }

  async function bakeTriggercamZoomToRepo() {
    if (!scopeId) return;
    let lo = Math.round(triggercamMinZoom * 100) / 100;
    let hi = Math.round(triggercamMaxZoom * 100) / 100;
    if (lo > hi) {
      const t = lo;
      lo = hi;
      hi = t;
    }
    lo = Math.min(liveMaxZoom, Math.max(liveMinZoom, lo));
    hi = Math.min(liveMaxZoom, Math.max(liveMinZoom, hi));
    setTriggercamMinZoom(lo);
    setTriggercamMaxZoom(hi);
    setBakingReticleCal(true);
    setBakeStatus("Skriver Triggercam zoom-limit til repo…");
    try {
      const res = await fetch("/api/admin/scope-cal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeId,
          triggercamZoomRestrict,
          triggercamMinZoom: lo,
          triggercamMaxZoom: hi,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        path?: string;
        triggercamZoomRestrict?: boolean;
        triggercamMinZoom?: number;
        triggercamMaxZoom?: number;
      };
      if (!res.ok || !data.ok) {
        setBakeStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      const savedEnabled =
        typeof data.triggercamZoomRestrict === "boolean"
          ? data.triggercamZoomRestrict
          : triggercamZoomRestrict;
      const savedMin =
        typeof data.triggercamMinZoom === "number"
          ? data.triggercamMinZoom
          : lo;
      const savedMax =
        typeof data.triggercamMaxZoom === "number"
          ? data.triggercamMaxZoom
          : hi;
      setTriggercamZoomRestrict(savedEnabled);
      setTriggercamMinZoom(savedMin);
      setTriggercamMaxZoom(savedMax);
      setRepoTriggercamZoomOverride({
        triggercamZoomRestrict: savedEnabled,
        triggercamMinZoom: savedMin,
        triggercamMaxZoom: savedMax,
      });
      setBakeStatus(
        `OK → ${data.path ?? "catalog.ts"} triggercam zoom ${savedEnabled ? "på" : "av"} ${savedMin}–${savedMax}×. Commit + push.`,
      );
    } catch (err) {
      setBakeStatus(
        err instanceof Error ? err.message : "Klarte ikke å skrive filen.",
      );
    } finally {
      setBakingReticleCal(false);
    }
  }

  async function bakeScopeSpecToRepo() {
    if (!scopeId) return;
    setBakingReticleCal(true);
    setBakeStatus("Skriver zoom / klikkenhet…");
    try {
      const res = await fetch("/api/admin/scope-cal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeId,
          minZoom: liveMinZoom,
          maxZoom: liveMaxZoom,
          clickUnit: liveClickUnit,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        path?: string;
        minZoom?: number;
        maxZoom?: number;
        clickUnit?: ScopeClickUnit;
      };
      if (!res.ok || !data.ok) {
        setBakeStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      if (typeof data.minZoom === "number") setLiveMinZoom(data.minZoom);
      if (typeof data.maxZoom === "number") setLiveMaxZoom(data.maxZoom);
      if (data.clickUnit === "MOA" || data.clickUnit === "MRAD") {
        setLiveClickUnit(data.clickUnit);
      }
      setRepoScopeOverride({
        minZoom: data.minZoom ?? liveMinZoom,
        maxZoom: data.maxZoom ?? liveMaxZoom,
        clickUnit: data.clickUnit ?? liveClickUnit,
      });
      setBakeStatus(
        `OK → ${data.path ?? "catalog.ts"} ${data.minZoom}–${data.maxZoom}× · ${data.clickUnit}. Commit + push.`,
      );
    } catch (err) {
      setBakeStatus(
        err instanceof Error ? err.message : "Klarte ikke å skrive filen.",
      );
    } finally {
      setBakingReticleCal(false);
    }
  }

  async function uploadReticleImage(file: File) {
    if (!scopeId) return;
    setUploadingReticle(true);
    setBakeStatus("Laster opp retikkelbilde…");
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject(new Error("Kunne ikke lese filen"));
        };
        reader.onerror = () => reject(new Error("Fil-lesing feilet"));
        reader.readAsDataURL(file);
      });
      const dims = await new Promise<{ w: number; h: number }>(
        (resolve, reject) => {
          const img = new Image();
          img.onload = () =>
            resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => reject(new Error("Ugyldig bilde"));
          img.src = dataUrl;
        },
      );
      const res = await fetch("/api/admin/reticle-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeId,
          imageBase64: dataUrl,
          nativeWidth: dims.w,
          nativeHeight: dims.h,
          fileName: file.name,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        src?: string;
        nativeWidth?: number;
        nativeHeight?: number;
        reticleId?: string;
        path?: string;
      };
      if (!res.ok || !data.ok || !data.src) {
        setBakeStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      const bust = `${data.src}?t=${Date.now()}`;
      setReticleSrcOverride(bust);
      setReticleNativeOverride({
        width: data.nativeWidth ?? dims.w,
        height: data.nativeHeight ?? dims.h,
      });
      if (data.reticleId) setUploadedReticleId(data.reticleId);
      setOpticalCenterX((data.nativeWidth ?? dims.w) / 2);
      setOpticalCenterY((data.nativeHeight ?? dims.h) / 2);
      setCenterTo1MilPx(
        Math.round(
          (Math.min(data.nativeWidth ?? dims.w, data.nativeHeight ?? dims.h) /
            20) *
            10,
        ) / 10,
      );
      setBakeStatus(
        `OK retikkel → ${data.src} (${data.reticleId}). Calibrate hash/centre, commit + push.`,
      );
    } catch (err) {
      setBakeStatus(
        err instanceof Error ? err.message : "Opplasting feilet.",
      );
    } finally {
      setUploadingReticle(false);
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
    if (scope) setZoom(liveMaxZoom);
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

        {scope ? (
          <>
            <div className="admin-spot-row">
              <label className="admin-spot-field admin-spot-scale">
                <span>Zoom fra</span>
                <input
                  type="number"
                  className="admin-spot-scale-num"
                  min={1}
                  max={80}
                  step={0.1}
                  value={liveMinZoom}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n) || n <= 0) return;
                    const next = Math.round(n * 100) / 100;
                    setLiveMinZoom(next);
                    setZoom((z) =>
                      Math.min(liveMaxZoom, Math.max(next, z)),
                    );
                  }}
                />
              </label>
              <label className="admin-spot-field admin-spot-scale">
                <span>til</span>
                <input
                  type="number"
                  className="admin-spot-scale-num"
                  min={1}
                  max={80}
                  step={0.1}
                  value={liveMaxZoom}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n) || n <= 0) return;
                    const next = Math.round(n * 100) / 100;
                    setLiveMaxZoom(next);
                    setZoom((z) =>
                      Math.min(next, Math.max(liveMinZoom, z)),
                    );
                  }}
                />
              </label>
              <span className="admin-scope-cal-clicks">×</span>
              <button
                type="button"
                className={
                  liveClickUnit === "MRAD"
                    ? "intro-button admin-spot-btn is-selected"
                    : "intro-button admin-spot-btn"
                }
                aria-pressed={liveClickUnit === "MRAD"}
                onClick={() => setLiveClickUnit("MRAD")}
              >
                MIL
              </button>
              <button
                type="button"
                className={
                  liveClickUnit === "MOA"
                    ? "intro-button admin-spot-btn is-selected"
                    : "intro-button admin-spot-btn"
                }
                aria-pressed={liveClickUnit === "MOA"}
                onClick={() => setLiveClickUnit("MOA")}
              >
                MOA
              </button>
              <button
                type="button"
                className="intro-button admin-spot-btn"
                disabled={!scopeSpecDirty || bakingReticleCal}
                onClick={() => void bakeScopeSpecToRepo()}
              >
                {bakingReticleCal ? "Skriver…" : "Lagre zoom/enhet"}
              </button>
            </div>
            <div className="admin-spot-row">
              <label className="admin-spot-field admin-spot-field-wide">
                <span>
                  Retikkelbilde
                  {reticleSrcOverride
                    ? " · lastet opp"
                    : reticleDef
                      ? ` · ${reticleDef.label}`
                      : " · ingen"}
                </span>
                <input
                  type="file"
                  accept="image/png,image/PNG"
                  disabled={uploadingReticle}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void uploadReticleImage(file);
                  }}
                />
              </label>
              {uploadingReticle ? (
                <span className="admin-scope-cal-clicks">Laster…</span>
              ) : null}
            </div>
          </>
        ) : null}

        <div className="admin-spot-row">
          <label className="admin-spot-field">
            <span>Subject</span>
            <select
              value={subjectKind}
              onChange={(e) => {
                const next = e.target.value as SubjectKind;
                setSubjectKind(next);
                if (next === "range") setSpotBgEnabled(false);
              }}
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

          <label
            className="admin-spot-field admin-spot-check"
            title="Hunt spotting-landskap bak fuglen — minZoomMagCal zoomer bakgrunnen ut/inn"
          >
            <input
              type="checkbox"
              checked={spotBgEnabled}
              onChange={(e) => {
                const on = e.target.checked;
                setSpotBgEnabled(on);
                if (on) setSubjectKind("bird");
              }}
            />
            <span>Spotting bakgrunn</span>
          </label>
          {spotBgEnabled ? (
            <label className="admin-spot-field">
              <span>Bakgrunn</span>
              <select
                value={spotImageSrc}
                onChange={(e) => {
                  setSpotImageSrc(e.target.value);
                  setLandAspect(16 / 9);
                }}
                disabled={spotImageOptions.length === 0}
              >
                {spotImageOptions.length === 0 ? (
                  <option value="">Ingen spotting-bilder</option>
                ) : (
                  spotImageOptions.map((src) => (
                    <option key={src} value={src}>
                      {spotImageLabel(src)}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : null}

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
          <label className="admin-spot-field admin-spot-check">
            <input
              type="checkbox"
              checked={cantEnabled}
              onChange={(e) => setCantEnabled(e.target.checked)}
            />
            <span>Cant på</span>
          </label>
          <label
            className="admin-spot-field admin-spot-check"
            title="Når på og Triggercam/Scopemate er i aktivt kit: begrens zoom (ZCO default 24–27×)"
          >
            <input
              type="checkbox"
              checked={triggercamZoomRestrict}
              onChange={(e) => {
                const on = e.target.checked;
                setTriggercamZoomRestrict(on);
                if (on) {
                  setZoom((z) =>
                    clampScopeZoom(z, {
                      minZoom: triggercamMinZoom,
                      maxZoom: triggercamMaxZoom,
                    }),
                  );
                }
              }}
            />
            <span>Include zoom restriction with Triggercam</span>
          </label>
        </div>

        {triggercamZoomRestrict ? (
          <div className="admin-spot-row">
            <label className="admin-spot-field admin-spot-scale">
              <span>TC min ×</span>
              <input
                type="number"
                className="admin-spot-scale-num"
                min={liveMinZoom}
                max={liveMaxZoom}
                step={0.1}
                value={triggercamMinZoom}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setTriggercamMinZoom(Math.round(n * 100) / 100);
                }}
              />
            </label>
            <label className="admin-spot-field admin-spot-scale">
              <span>TC max ×</span>
              <input
                type="number"
                className="admin-spot-scale-num"
                min={liveMinZoom}
                max={liveMaxZoom}
                step={0.1}
                value={triggercamMaxZoom}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setTriggercamMaxZoom(Math.round(n * 100) / 100);
                }}
              />
            </label>
            <span className="admin-scope-cal-clicks">
              Preview {zoomRange.minZoom}–{zoomRange.maxZoom}×
            </span>
            <button
              type="button"
              className="intro-button admin-spot-btn"
              disabled={!triggercamZoomDirty}
              onClick={() => {
                setTriggercamZoomRestrict(catalogTriggercamRestrict);
                setTriggercamMinZoom(catalogTriggercamMin);
                setTriggercamMaxZoom(catalogTriggercamMax);
              }}
            >
              Nullstill
            </button>
            <button
              type="button"
              className="intro-button admin-spot-btn"
              disabled={!triggercamZoomDirty || bakingReticleCal}
              onClick={() => void bakeTriggercamZoomToRepo()}
            >
              {bakingReticleCal ? "Skriver…" : "Lagre til repo"}
            </button>
          </div>
        ) : null}

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
              <>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  onClick={() => setZoom(liveMinZoom)}
                >
                  Min {liveMinZoom}×
                </button>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  onClick={() => setZoom(liveMaxZoom)}
                >
                  Max {liveMaxZoom}×
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {scope && (reticleDef || reticleSrcOverride) ? (
          <div className="admin-scope-cal">
            <p className="admin-scope-cal-hint">
              Live kalibrering. «Lagre til repo» skriver rotasjon / optisk
              senter / <code>centerTo1MilPx</code> /{" "}
              <code>illumination</code> til <code>reticles.ts</code>. «Lagre
              FOV» / «Lagre til repo» skriver <code>zoomMagCal</code> /{" "}
              <code>minZoomMagCal</code> / focus zoom til{" "}
              <code>catalog.ts</code> (kun dev). Calibrate illumination:
              sirkel/rektangel/maske for hva som lyser rødt.
              {calDirty || fovDirty || focusZoomDirty || triggercamZoomDirty
                ? " · lokale endringer"
                : ""}
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
                    if (next) {
                      setCalMinZoom(false);
                      setZoom(liveMaxZoom);
                    }
                    return next;
                  });
                }}
              >
                Calibrate max zoom {calMaxZoom ? "på" : "av"}
              </button>
              <button
                type="button"
                className={
                  calMinZoom
                    ? "intro-button admin-spot-btn is-selected"
                    : "intro-button admin-spot-btn"
                }
                aria-pressed={calMinZoom}
                title="FOV / følelse ved min zoom — mil-ringer + minZoomMagCal"
                onClick={() => {
                  setCalMinZoom((v) => {
                    const next = !v;
                    if (next) {
                      setCalMaxZoom(false);
                      setZoom(liveMinZoom);
                    }
                    return next;
                  });
                }}
              >
                Calibrate min zoom {calMinZoom ? "på" : "av"}
              </button>
              <button
                type="button"
                className={
                  calHashmarks
                    ? "intro-button admin-spot-btn is-selected"
                    : "intro-button admin-spot-btn"
                }
                aria-pressed={calHashmarks}
                title={
                  hashUnitIsMoa
                    ? "Hash spacing — centerTo1MilPx (= px → 1 MOA) + MOA-ringer på retikkel"
                    : "Hash spacing — centerTo1MilPx (= px → 1 mil) + mil-ringer på retikkel"
                }
                onClick={() => setCalHashmarks((v) => !v)}
              >
                Calibrate reticle hashmarks ({hashUnitShort}){" "}
                {calHashmarks ? "på" : "av"}
              </button>
              <button
                type="button"
                className={
                  calIllum
                    ? "intro-button admin-spot-btn is-selected"
                    : "intro-button admin-spot-btn"
                }
                aria-pressed={calIllum}
                title="Hvilket felt som lyser — sirkel / rektangel / maske-PNG"
                onClick={() => {
                  setCalIllum((v) => {
                    const next = !v;
                    if (next) {
                      setReticleIllum((i) => (i < 0.35 ? 0.85 : i));
                    }
                    return next;
                  });
                }}
              >
                Calibrate illumination {calIllum ? "på" : "av"}
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
                    min={0.1}
                    max={1.4}
                    step={0.005}
                    value={Math.min(1.4, Math.max(0.1, zoomMagCal))}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      setZoomMagCal(Math.round(n * 1000) / 1000);
                    }}
                    aria-label="FOV zoom mag cal at max"
                  />
                </label>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  onClick={() =>
                    setZoomMagCal(
                      (v) =>
                        Math.round(Math.max(0.1, v - 0.01) * 1000) / 1000,
                    )
                  }
                >
                  −0.01
                </button>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  onClick={() =>
                    setZoomMagCal(
                      (v) =>
                        Math.round(Math.min(1.4, v + 0.01) * 1000) / 1000,
                    )
                  }
                >
                  +0.01
                </button>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  disabled={Math.abs(zoomMagCal - catalogZoomMag) <= 1e-6}
                  onClick={() => setZoomMagCal(catalogZoomMag)}
                >
                  Nullstill FOV
                </button>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  disabled={
                    Math.abs(zoomMagCal - catalogZoomMag) <= 1e-6 ||
                    bakingReticleCal
                  }
                  onClick={() => void bakeFovCalToRepo()}
                >
                  {bakingReticleCal ? "Skriver…" : "Lagre FOV til repo"}
                </button>
              </div>
            ) : null}

            {calMinZoom ? (
              <div className="admin-spot-row">
                <label className="admin-spot-field admin-scope-rot-field">
                  <span>
                    minZoomMagCal {minZoomMagCal.toFixed(3)} · FOV ±
                    {fovHalfMrad.toFixed(2)} mrad @ min
                    {useSpotLandscape ? " · bakgrunn følger" : ""}
                  </span>
                  <input
                    type="range"
                    className="admin-scope-rot-slider"
                    min={0.1}
                    max={1.9}
                    step={0.005}
                    value={Math.min(1.9, Math.max(0.1, minZoomMagCal))}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isFinite(n)) return;
                      setMinZoomMagCal(Math.round(n * 1000) / 1000);
                    }}
                    aria-label="FOV zoom mag cal at min"
                  />
                </label>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  onClick={() =>
                    setMinZoomMagCal((v) =>
                      Math.round(Math.max(0.1, v - 0.01) * 1000) / 1000,
                    )
                  }
                >
                  −0.01
                </button>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  onClick={() =>
                    setMinZoomMagCal((v) =>
                      Math.round(Math.min(1.9, v + 0.01) * 1000) / 1000,
                    )
                  }
                >
                  +0.01
                </button>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  disabled={!minFovDirty}
                  onClick={() => setMinZoomMagCal(catalogMinZoomMag)}
                >
                  Nullstill
                </button>
                <button
                  type="button"
                  className="intro-button admin-spot-btn"
                  disabled={!minFovDirty || bakingReticleCal}
                  onClick={() => void bakeMinFovCalToRepo()}
                >
                  {bakingReticleCal ? "Skriver…" : "Lagre til repo"}
                </button>
              </div>
            ) : null}

            <div className="admin-spot-row">
              <label className="admin-spot-field admin-spot-check">
                <input
                  type="checkbox"
                  checked={focusZoomEnabled}
                  onChange={(e) => {
                    const on = e.target.checked;
                    setFocusZoomEnabled(on);
                    if (!on) {
                      setPreviewFocusSticky(false);
                      setPreviewFocusHeld(false);
                    }
                  }}
                />
                <span>Enable Focus zoom multiplier</span>
              </label>
              <button
                type="button"
                className={
                  previewFocusSticky
                    ? "intro-button admin-spot-btn is-selected"
                    : "intro-button admin-spot-btn"
                }
                aria-pressed={previewFocusSticky}
                disabled={!focusZoomEnabled}
                title="Hold F for momentary preview. Knapp låser preview på."
                onClick={() => setPreviewFocusSticky((v) => !v)}
              >
                {previewFocusHeld
                  ? "F holdt…"
                  : previewFocusSticky
                    ? "Lås på"
                    : "Hold F / lås"}
              </button>
            </div>
            <div className="admin-spot-row">
              <label className="admin-spot-field admin-scope-rot-field">
                <span>
                  Focus zoom multiplier {focusZoomMultiplier.toFixed(2)}×
                  {focusZoomMultiplier <= 1.001 ? " (off)" : ""}
                </span>
                <input
                  type="range"
                  className="admin-scope-rot-slider"
                  min={FOCUS_ZOOM_MULTIPLIER_MIN}
                  max={FOCUS_ZOOM_MULTIPLIER_MAX}
                  step={0.05}
                  value={Math.min(
                    FOCUS_ZOOM_MULTIPLIER_MAX,
                    Math.max(FOCUS_ZOOM_MULTIPLIER_MIN, focusZoomMultiplier),
                  )}
                  disabled={!focusZoomEnabled}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    setFocusZoomMultiplier(Math.round(n * 100) / 100);
                  }}
                  aria-label="Focus zoom multiplier"
                />
              </label>
              <label className="admin-spot-field admin-spot-scale">
                <span>×</span>
                <input
                  type="number"
                  className="admin-spot-scale-num"
                  min={FOCUS_ZOOM_MULTIPLIER_MIN}
                  max={FOCUS_ZOOM_MULTIPLIER_MAX}
                  step={0.05}
                  value={focusZoomMultiplier}
                  disabled={!focusZoomEnabled}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    setFocusZoomMultiplier(
                      Math.min(
                        FOCUS_ZOOM_MULTIPLIER_MAX,
                        Math.max(FOCUS_ZOOM_MULTIPLIER_MIN, Math.round(n * 100) / 100),
                      ),
                    );
                  }}
                />
              </label>
              <button
                type="button"
                className="intro-button admin-spot-btn"
                disabled={!focusZoomDirty}
                onClick={() => {
                  setFocusZoomEnabled(catalogFocusZoomEnabled);
                  setFocusZoomMultiplier(catalogFocusZoomMultiplier);
                  setFocusViewportScale(catalogFocusViewportScale);
                }}
              >
                Nullstill
              </button>
              <button
                type="button"
                className="intro-button admin-spot-btn"
                disabled={!focusZoomDirty || bakingReticleCal}
                onClick={() => void bakeFocusZoomToRepo()}
              >
                {bakingReticleCal ? "Skriver…" : "Lagre til repo"}
              </button>
            </div>
            <div className="admin-spot-row">
              <label className="admin-spot-field admin-scope-rot-field">
                <span>
                  Focus glass scale {focusViewportScale.toFixed(2)}×
                  {Math.abs(focusViewportScale - 1) < 0.001
                    ? " (ingen vekst)"
                    : ` (+${Math.round((focusViewportScale - 1) * 100)}%)`}
                </span>
                <input
                  type="range"
                  className="admin-scope-rot-slider"
                  min={FOCUS_VIEWPORT_SCALE_MIN}
                  max={FOCUS_VIEWPORT_SCALE_MAX}
                  step={0.01}
                  value={Math.min(
                    FOCUS_VIEWPORT_SCALE_MAX,
                    Math.max(FOCUS_VIEWPORT_SCALE_MIN, focusViewportScale),
                  )}
                  disabled={!focusZoomEnabled}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    setFocusViewportScale(Math.round(n * 1000) / 1000);
                  }}
                  aria-label="Focus glass viewport scale"
                />
              </label>
              <label className="admin-spot-field admin-spot-scale">
                <span>×</span>
                <input
                  type="number"
                  className="admin-spot-scale-num"
                  min={FOCUS_VIEWPORT_SCALE_MIN}
                  max={FOCUS_VIEWPORT_SCALE_MAX}
                  step={0.01}
                  value={focusViewportScale}
                  disabled={!focusZoomEnabled}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (!Number.isFinite(n)) return;
                    setFocusViewportScale(
                      Math.min(
                        FOCUS_VIEWPORT_SCALE_MAX,
                        Math.max(
                          FOCUS_VIEWPORT_SCALE_MIN,
                          Math.round(n * 1000) / 1000,
                        ),
                      ),
                    );
                  }}
                />
              </label>
            </div>

            {calHashmarks ? (
              <div className="admin-spot-row">
                <label className="admin-spot-field admin-scope-rot-field">
                  <span>
                    px → 1 {hashUnitShort} {centerTo1MilPx.toFixed(3)}
                  </span>
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
                    aria-label={
                      hashUnitIsMoa
                        ? "Reticle center to 1 MOA px"
                        : "Reticle center to 1 mil px"
                    }
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

            {calIllum ? (
              <>
                <div className="admin-spot-row">
                  {(
                    [
                      ["whole", "Hele"],
                      ["circleMils", "Sirkel (mil)"],
                      ["circle", "Sirkel (px)"],
                      ["rect", "Rektangel"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={
                        illumShape === mode
                          ? "intro-button admin-spot-btn is-selected"
                          : "intro-button admin-spot-btn"
                      }
                      aria-pressed={illumShape === mode}
                      onClick={() => setIllumShape(mode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {illumShape === "circleMils" ? (
                  <div className="admin-spot-row">
                    <label className="admin-spot-field admin-scope-rot-field">
                      <span>r {illumRMils.toFixed(2)} mil</span>
                      <input
                        type="range"
                        className="admin-scope-rot-slider"
                        min={0.2}
                        max={8}
                        step={0.05}
                        value={Math.min(8, Math.max(0.2, illumRMils))}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n)) return;
                          setIllumRMils(Math.round(n * 100) / 100);
                        }}
                        aria-label="Illum radius mils"
                      />
                    </label>
                    <button
                      type="button"
                      className="intro-button admin-spot-btn"
                      onClick={() =>
                        setIllumRMils((v) =>
                          Math.round(Math.max(0.2, v - 0.1) * 100) / 100,
                        )
                      }
                    >
                      −0.1
                    </button>
                    <button
                      type="button"
                      className="intro-button admin-spot-btn"
                      onClick={() =>
                        setIllumRMils((v) =>
                          Math.round(Math.min(8, v + 0.1) * 100) / 100,
                        )
                      }
                    >
                      +0.1
                    </button>
                  </div>
                ) : null}
                {illumShape === "circle" ? (
                  <div className="admin-spot-row">
                    <label className="admin-spot-field admin-scope-rot-field">
                      <span>r {illumRPx.toFixed(0)} native px</span>
                      <input
                        type="range"
                        className="admin-scope-rot-slider"
                        min={10}
                        max={600}
                        step={1}
                        value={Math.min(600, Math.max(10, illumRPx))}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n)) return;
                          setIllumRPx(Math.round(n));
                        }}
                        aria-label="Illum radius native px"
                      />
                    </label>
                  </div>
                ) : null}
                {illumShape === "rect" ? (
                  <div className="admin-spot-row">
                    <label className="admin-spot-field admin-spot-scale">
                      <span>x</span>
                      <input
                        type="number"
                        className="admin-spot-scale-num"
                        value={illumRectX}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n)) return;
                          setIllumRectX(Math.round(n));
                        }}
                      />
                    </label>
                    <label className="admin-spot-field admin-spot-scale">
                      <span>y</span>
                      <input
                        type="number"
                        className="admin-spot-scale-num"
                        value={illumRectY}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n)) return;
                          setIllumRectY(Math.round(n));
                        }}
                      />
                    </label>
                    <label className="admin-spot-field admin-spot-scale">
                      <span>w</span>
                      <input
                        type="number"
                        className="admin-spot-scale-num"
                        value={illumRectW}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n) || n <= 0) return;
                          setIllumRectW(Math.round(n));
                        }}
                      />
                    </label>
                    <label className="admin-spot-field admin-spot-scale">
                      <span>h</span>
                      <input
                        type="number"
                        className="admin-spot-scale-num"
                        value={illumRectH}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          if (!Number.isFinite(n) || n <= 0) return;
                          setIllumRectH(Math.round(n));
                        }}
                      />
                    </label>
                    {reticleDef ? (
                      <button
                        type="button"
                        className="intro-button admin-spot-btn"
                        title="Sentrer 200×200 på optisk senter"
                        onClick={() => {
                          const w = 200;
                          const h = 200;
                          setIllumRectW(w);
                          setIllumRectH(h);
                          setIllumRectX(Math.round(opticalCenterX - w / 2));
                          setIllumRectY(Math.round(opticalCenterY - h / 2));
                        }}
                      >
                        Sentrer 200²
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <div className="admin-spot-row">
                  <label className="admin-spot-field admin-scope-rot-field">
                    <span>maskSrc (valgfri PNG)</span>
                    <input
                      type="text"
                      className="admin-spot-scale-num"
                      style={{ minWidth: "14rem", flex: 1 }}
                      placeholder="/range/reticles/…-illum-mask.png"
                      value={illumMaskSrc}
                      onChange={(e) => setIllumMaskSrc(e.target.value)}
                      aria-label="Illumination mask src"
                    />
                  </label>
                  <button
                    type="button"
                    className="intro-button admin-spot-btn"
                    disabled={
                      reticleIlluminationKey(liveIllumination) ===
                      reticleIlluminationKey(catalogIllum)
                    }
                    onClick={() => {
                      const h = hydrateIllumStateFromCatalog(catalogIllum);
                      setIllumShape(h.shape);
                      setIllumRMils(h.rMils);
                      setIllumRPx(h.rPx);
                      setIllumRectX(h.rectX);
                      setIllumRectY(h.rectY);
                      setIllumRectW(h.rectW);
                      setIllumRectH(h.rectH);
                      setIllumMaskSrc(h.maskSrc);
                    }}
                  >
                    Nullstill illum
                  </button>
                </div>
              </>
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
                disabled={
                  !calDirty ||
                  bakingReticleCal ||
                  !(reticleDef || uploadedReticleId)
                }
                title="Skriv rotasjon / center / hash / illumination til reticles.ts"
                onClick={() => void bakeReticleCalToRepo()}
              >
                {bakingReticleCal ? "Skriver…" : "Lagre til repo"}
              </button>
            </div>
          </div>
        ) : null}

        <p className="admin-spot-meta">
          {scope
            ? `${zoom.toFixed(1)}× · ${paperUnit} · ${reticleDef?.label ?? scope.reticleId ?? "generic"}${fovDiameterScale > 1 ? " · premium FOV" : ""}${easy10x ? ` · 10×(×${RANGE_EASY_ZERO_SCALE})` : ""} · ${distanceM} m · fokus ${formatParallaxFocusM(parallaxFocusM)} · ${blurHint} · cant ${effectiveCantDeg.toFixed(1)}°${cantEnabled ? "" : " (off)"} · rot ${round2(reticleRotDeg)}° · cx ${round2(opticalCenterX)} cy ${round2(opticalCenterY)} · piltaster / drag`
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
                  turretNudgeMoved(setSessionZeroYMm, (y) =>
                    clampElevationTurretMm(y + d, scope),
                  )
                }
                clickUnit={clickUnit}
                clicksPerRev={scopeElevationClicksPerRev(scope)}
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
                      className={[
                        "scope-optic",
                        fovDiameterScale > 1 ? "is-fov-premium" : "",
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
                        <ScopeFocusZoom scale={focusZoomBoost}>
                        <div
                          className="scope-cant-roll"
                          style={
                            Math.abs(worldRollDeg) > 0.02
                              ? {
                                  transform: `rotate(${worldRollDeg.toFixed(3)}deg)`,
                                }
                              : undefined
                          }
                        >
                        <div
                          className="scope-world"
                          style={{
                            transform:
                              `translate(calc(-50% - ${panPxX}px), calc(-50% - ${panPxY}px)) ` +
                              `scale(${targetScale})`,
                            filter:
                              blurPx > 0.05
                                ? `blur(${blurPx.toFixed(2)}px)`
                                : undefined,
                          }}
                        >
                          <div className="scope-world-scene">
                            {useSpotLandscape ? (
                              <div
                                className="hunt-scope-scene"
                                style={{ width: sceneW, height: sceneH }}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  className="hunt-scope-landscape"
                                  src={spotImageSrc}
                                  alt=""
                                  draggable={false}
                                  aria-hidden
                                  onLoad={(e) => {
                                    const img = e.currentTarget;
                                    if (
                                      img.naturalWidth > 0 &&
                                      img.naturalHeight > 0
                                    ) {
                                      setLandAspect(
                                        img.naturalWidth / img.naturalHeight,
                                      );
                                    }
                                  }}
                                />
                                <div
                                  className="hunt-scope-bird-wrap"
                                  style={{
                                    left: `${spotFocusX}%`,
                                    top: `${spotFocusY}%`,
                                    width: `${birdWidthPct}%`,
                                    aspectRatio: `${imgW} / ${imgH}`,
                                  }}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    className="scope-target hunt-tiur-target"
                                    src={imgSrc}
                                    alt={imgAlt}
                                    draggable={false}
                                    width={imgW}
                                    height={imgH}
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                    }}
                                  />
                                </div>
                              </div>
                            ) : (
                              /* eslint-disable-next-line @next/next/no-img-element */
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
                            )}
                          </div>
                        </div>
                        </div>
                        <div className="scope-reticle-offset">
                          <ScopeReticle
                            scope={liveScope ?? scope}
                            zoom={zoom}
                            imgScale={reticleImgScale}
                            illumination={reticleIllum}
                            rotationDeg={reticleRotDeg}
                            opticalCenterPx={{
                              x: opticalCenterX,
                              y: opticalCenterY,
                            }}
                            centerTo1MilPx={centerTo1MilPx}
                            illuminationDef={liveIllumination}
                            srcOverride={reticleSrcOverride ?? undefined}
                            nativeSizeOverride={
                              reticleNativeOverride ?? undefined
                            }
                          />
                        </div>
                        {calIllum &&
                        liveIllumination?.region &&
                        hashRingPxPerMil > 0 ? (
                          <div
                            className="admin-scope-illum-region"
                            aria-hidden
                          >
                            {liveIllumination.region.shape === "circleMils" ||
                            liveIllumination.region.shape === "circle" ? (
                              <span
                                className="admin-scope-illum-region-circle"
                                style={{
                                  width:
                                    liveIllumination.region.shape ===
                                    "circleMils"
                                      ? 2 *
                                        liveIllumination.region.rMils *
                                        hashRingPxPerMil
                                      : 2 *
                                        liveIllumination.region.r *
                                        (hashRingPxPerMil / centerTo1MilPx),
                                  height:
                                    liveIllumination.region.shape ===
                                    "circleMils"
                                      ? 2 *
                                        liveIllumination.region.rMils *
                                        hashRingPxPerMil
                                      : 2 *
                                        liveIllumination.region.r *
                                        (hashRingPxPerMil / centerTo1MilPx),
                                }}
                              />
                            ) : (
                              <span
                                className="admin-scope-illum-region-rect"
                                style={{
                                  width:
                                    liveIllumination.region.w *
                                    (hashRingPxPerMil / centerTo1MilPx),
                                  height:
                                    liveIllumination.region.h *
                                    (hashRingPxPerMil / centerTo1MilPx),
                                  left: `calc(50% + ${
                                    (liveIllumination.region.x -
                                      opticalCenterX) *
                                    (hashRingPxPerMil / centerTo1MilPx)
                                  }px)`,
                                  top: `calc(50% + ${
                                    (liveIllumination.region.y -
                                      opticalCenterY) *
                                    (hashRingPxPerMil / centerTo1MilPx)
                                  }px)`,
                                }}
                              />
                            )}
                          </div>
                        ) : null}
                        {calHashmarks && hashRingPxPerUnit > 0 ? (
                          <div
                            className={
                              hashUnitIsMoa
                                ? "admin-scope-mil-rings is-hash is-moa"
                                : "admin-scope-mil-rings is-hash"
                            }
                            aria-hidden
                          >
                            {Array.from(
                              { length: hashRingCount },
                              (_, i) => i + 1,
                            ).map((n) => {
                              const d = 2 * n * hashRingPxPerUnit;
                              if (d > glassRadiusPx * 2.05) return null;
                              return (
                                <span
                                  key={`hash-${hashUnitShort}-${n}`}
                                  className="admin-scope-mil-rings-ring"
                                  data-mil={n}
                                  data-unit={hashUnitShort}
                                  style={{ width: d, height: d }}
                                />
                              );
                            })}
                          </div>
                        ) : null}
                        </ScopeFocusZoom>
                        <div className="scope-vignette" aria-hidden />
                        {((calMaxZoom || calMinZoom) &&
                          fovRingPxPerMrad > 0) ? (
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
                        scope={zoomRange}
                        zoom={zoom}
                        onChange={(z) =>
                          setZoom(clampScopeZoom(z, zoomRange))
                        }
                      />
                      <BubbleLevel
                        visualId="ulf"
                        cantDeg={effectiveCantDeg}
                        onCantChange={setCantDeg}
                        disabled={!cantEnabled}
                      />
                    </div>
                  </div>
                </ScopeOpticFit>
              </div>
            </div>
            <div className="admin-scope-tube-wind scope-tube-wind">
              <ScopeWindageDial
                sessionZeroMm={sessionZeroXMm}
                onNudge={(d) =>
                  turretNudgeMoved(setSessionZeroXMm, (x) =>
                    clampTurretMm(x + d),
                  )
                }
                clickUnit={clickUnit}
                clicksPerRev={scopeWindageClicksPerRev(scope)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
