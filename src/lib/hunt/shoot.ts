/**
 * Hunt shot geometry — bird topp target vs vital zones.
 *
 * Zones (from designer rings on `*_target/*targetN.png`):
 *   Green = instant kill (any ammo)
 *   Red   = vital; outside green, ammo damageFactor decides clean kill vs ettersøk
 *   Body  = wound / ettersøk
 *   Else  = miss
 *
 * Apparent size matches spotting binos FOV at same mag × distance.
 */

import type { ScopeSpec } from "@/lib/optics/spec";
import { spriteWidthPctForDistance } from "@/lib/hunt/birds";
import {
  getBirdSprite,
  type BirdSpriteDef,
  type BirdSpriteId,
} from "@/lib/hunt/birdSprites";
import { getBirdHitZone } from "@/lib/hunt/birdHitZoneOverrides";

/** @deprecated Prefer sprite.toppSrc via getBirdSprite. */
export const TIUR_TARGET_SRC = "/images/birds/tiur/tiurtopp1.png";
/** @deprecated Prefer sprite.toppW / toppH. */
export const TIUR_IMAGE_NATIVE_W = 88;
export const TIUR_IMAGE_NATIVE_H = 138;

/** XXL misc — after-action impact replay on hunt shots. */
export const TRIGGERCAM_ITEM_ID = "misc-triggercam";

/** Cheaper Triggercam alternative — same AAR / skuddpar, higher nerve cost. */
export const SCOPEMATE_ITEM_ID = "misc-scopemate";

/** Headshot reward — player nickname after a yellow-zone kill. */
export const PINK_MIST_NICKNAME = "Pink Mist";

/** Triggercam / fasit copy when `zone === "head"`. */
export const HEADSHOT_AAR_TEXT =
  'Brains is everywhere but in the cranium. Your new nickname is now "Pink Mist"';

/** Lucky neck hit — not an aim point, still instant kill. */
export const NECK_LUCKY_KILL_TEXT =
  "Du bommet vel? men hadde flaks. Skuddet traff likevel i vital sone.";

/** Sony hunt camcorder body — needs a tripod in kit to deploy. */
export const CAMCORDER_ITEM_ID = "misc-hunt-camcorder";
/** Biltema steel tripod — standard setup nerve (+20 %). */
export const CAMCORDER_STEEL_TRIPOD_ID = "misc-hunt-camcorder-budget";
/** Carbon tripod — lighter / faster; +15 % nerve. */
export const CAMCORDER_CARBON_TRIPOD_ID = "misc-hunt-carbon-tripod";
/** Triggerstick Gen3 — heavier than carbon but quicker setup; +13 % nerve. */
export const CAMCORDER_TRIGGERSTICK_ID = "misc-hunt-triggerstick-gen3";
/** @deprecated Use {@link CAMCORDER_STEEL_TRIPOD_ID}. */
export const CAMCORDER_BUDGET_ITEM_ID = CAMCORDER_STEEL_TRIPOD_ID;

/** Garmin Xero chronograph — muzzle velocity on shotlog / load development. */
export const CHRONOGRAPH_ITEM_ID = "misc-garmin-xero-c1-pro";

/** Default / Biltema steel nerve bump (0–1). */
export const CAMCORDER_SETUP_NERVE = 0.2;
/** Manfrotto carbon: quicker setup → 15 % nerve. */
export const CAMCORDER_PREMIUM_SETUP_NERVE = 0.15;
/** Triggerstick Gen3: fast deploy → 13 % nerve. */
export const CAMCORDER_TRIGGERSTICK_SETUP_NERVE = 0.13;
/** @deprecated Steel uses {@link CAMCORDER_SETUP_NERVE}. */
export const CAMCORDER_BUDGET_SETUP_NERVE = CAMCORDER_SETUP_NERVE;

export function isCamcorderItemId(id: string): boolean {
  return id === CAMCORDER_ITEM_ID;
}

export function isCamcorderTripodItemId(id: string): boolean {
  return (
    id === CAMCORDER_STEEL_TRIPOD_ID ||
    id === CAMCORDER_CARBON_TRIPOD_ID ||
    id === CAMCORDER_TRIGGERSTICK_ID
  );
}

/** Kit exclusivity — one camcorder body. */
export function camcorderKitSlot(id: string): "camcorder" | undefined {
  return isCamcorderItemId(id) ? "camcorder" : undefined;
}

/** Kit exclusivity — one tripod. */
export function camcorderTripodKitSlot(
  id: string,
): "camcorderTripod" | undefined {
  return isCamcorderTripodItemId(id) ? "camcorderTripod" : undefined;
}

/** Prefer lowest-nerve stick if extras remain (legacy saves). */
export function resolveCamcorderTripodItemId(
  itemIds: Iterable<string>,
): string | null {
  const set = itemIds instanceof Set ? itemIds : new Set(itemIds);
  if (set.has(CAMCORDER_TRIGGERSTICK_ID)) return CAMCORDER_TRIGGERSTICK_ID;
  if (set.has(CAMCORDER_CARBON_TRIPOD_ID)) return CAMCORDER_CARBON_TRIPOD_ID;
  if (set.has(CAMCORDER_STEEL_TRIPOD_ID)) return CAMCORDER_STEEL_TRIPOD_ID;
  return null;
}

export function resolveCamcorderItemId(
  itemIds: Iterable<string>,
): string | null {
  const set = itemIds instanceof Set ? itemIds : new Set(itemIds);
  return set.has(CAMCORDER_ITEM_ID) ? CAMCORDER_ITEM_ID : null;
}

/** At most one camcorder body. */
export function sanitizeKitCamcorders(kit: string[]): string[] {
  const keepId = resolveCamcorderItemId(kit);
  if (!keepId) return kit.filter((id) => !isCamcorderItemId(id));
  return kit.filter((id) => !isCamcorderItemId(id) || id === keepId);
}

/** At most one camcorder tripod (carbon wins). */
export function sanitizeKitCamcorderTripods(kit: string[]): string[] {
  const keepId = resolveCamcorderTripodItemId(kit);
  if (!keepId) return kit.filter((id) => !isCamcorderTripodItemId(id));
  return kit.filter((id) => !isCamcorderTripodItemId(id) || id === keepId);
}

/** Resolve deploy nerve from misc spec (clamped 0–1). */
export function camcorderSetupNerveFromMisc(opts: {
  camcorderSetupNerve?: number;
}): number {
  const raw = opts.camcorderSetupNerve;
  if (raw != null && Number.isFinite(raw)) {
    return Math.min(1, Math.max(0, raw));
  }
  return CAMCORDER_SETUP_NERVE;
}

/** Nerve bump when setting up chronograph in front of the bird (Aware). */
export const CHRONO_SETUP_NERVE = 0.05;

/** Nerve bump when measuring wind/temp with Kestrel in Aware. */
export const KESTREL_MEASURE_NERVE = 0.05;

/** Nerve bump when starting Triggercam in Aware. */
export const TRIGGERCAM_SETUP_NERVE = 0.05;

/** Nerve bump when starting Scopemate in Aware. */
export const SCOPEMATE_SETUP_NERVE = 0.07;

export type ShotCamKind = "triggercam" | "scopemate";

export function isShotCamItemId(id: string): boolean {
  return id === TRIGGERCAM_ITEM_ID || id === SCOPEMATE_ITEM_ID;
}

/** Kit exclusivity slot — Triggercam and Scopemate share this. */
export function shotCamKitSlot(id: string): "shotcam" | undefined {
  return isShotCamItemId(id) ? "shotcam" : undefined;
}

/** Prefer Triggercam if both somehow remain in kit (legacy saves). */
export function resolveShotCamKind(
  itemIds: Iterable<string>,
): ShotCamKind | null {
  const set = itemIds instanceof Set ? itemIds : new Set(itemIds);
  if (set.has(TRIGGERCAM_ITEM_ID)) return "triggercam";
  if (set.has(SCOPEMATE_ITEM_ID)) return "scopemate";
  return null;
}

/** Drop extra shot-cams so kit has at most one (Triggercam wins). */
export function sanitizeKitShotCams(kit: string[]): string[] {
  const kind = resolveShotCamKind(kit);
  if (!kind) return kit;
  const keepId =
    kind === "triggercam" ? TRIGGERCAM_ITEM_ID : SCOPEMATE_ITEM_ID;
  return kit.filter((id) => !isShotCamItemId(id) || id === keepId);
}

export function shotCamSetupNerve(kind: ShotCamKind): number {
  return kind === "scopemate" ? SCOPEMATE_SETUP_NERVE : TRIGGERCAM_SETUP_NERVE;
}

export function shotCamLabel(kind: ShotCamKind): string {
  return kind === "scopemate" ? "Scopemate" : "Triggercam";
}

/**
 * Reference scope viewport size (px) — matches `.scope-viewport` (~28rem).
 * Used to convert binos FOV-% into a CSS image scale.
 */
export const SCOPE_VIEWPORT_REF_PX = 448;

/**
 * Real-world height represented by the full topp sprite (zone mm math).
 * Independent of on-screen scale — only hit geometry.
 */
export const TIUR_SPRITE_HEIGHT_MM = 480;

export const TIUR_SPRITE_WIDTH_MM =
  TIUR_SPRITE_HEIGHT_MM * (TIUR_IMAGE_NATIVE_W / TIUR_IMAGE_NATIVE_H);

/**
 * Zone diameters — physical size on the bird (from original tiurtopp1 guide).
 * Green = instant kill; red = vital ring.
 */
export const TIUR_INSTANT_KILL_DIAMETER_MM = 66;
export const TIUR_VITAL_DIAMETER_MM = 114;

/** @deprecated Prefer TIUR_INSTANT_KILL_DIAMETER_MM / TIUR_VITAL_DIAMETER_MM. */
export const TIUR_VITAL_DIAMETER_MM_LEGACY = TIUR_VITAL_DIAMETER_MM;

/** @deprecated Prefer getBirdSprite(id).vitalCxPx */
export const TIUR_VITAL_CX_PX = Math.round(32 + TIUR_IMAGE_NATIVE_W * 0.1);
export const TIUR_VITAL_CY_PX = 78;

export type HuntShotResultKind =
  | "instant_kill"
  | "vital_kill"
  | "ettersok"
  | "miss";

export type HuntShotZone =
  | "head"
  | "neck"
  | "instant"
  | "vital"
  | "body"
  | "none";

export type HuntShotResult = {
  kind: HuntShotResultKind;
  zone: HuntShotZone;
  /** Impact relative to vital centre (mm, +x right, +y down). */
  xMm: number;
  yMm: number;
  trueDistanceM: number;
  measuredDistanceM: number;
  /** Ammo damageFactor used for the vital-ring roll (if any). */
  damageFactor?: number;
  /** Impact velocity at true distance (m/s) — meat ruin. */
  impactVelocityMps?: number;
  /** Ammo identity for Meat Market breakdown. */
  ammoId?: string;
  ammoLabel?: string;
  caliber?: string;
  projectileType?: string;
  /** Muzzle velocity of the load (m/s). */
  v0?: number;
  /** Catalog subsonic load (low v0 by design). */
  subsonic?: boolean;
  /** Quiet enough that birds do not flush (subsonic + suppressor). */
  silentShot?: boolean;
};

/**
 * Player-facing impact label. Engine stores +y down; UI høyde uses +up.
 * e.g. low hit (yMm=+52) → "+0 mm side / −52 mm høyde".
 */
export function formatHuntImpactOffsetMm(xMm: number, yMm: number): string {
  const heightMm = -yMm;
  const side =
    `${xMm >= 0 ? "+" : ""}${xMm.toFixed(0)} mm side`;
  const height =
    `${heightMm >= 0 ? "+" : ""}${heightMm.toFixed(0)} mm høyde`;
  return `${side} / ${height}`;
}

export type BirdShotGeom = {
  spriteId: BirdSpriteId;
  /** Scope / spotting / AAR display (topp). */
  displaySrc: string;
  /** Analysis guide with baked rings — not shown in UI. */
  targetGuideSrc: string;
  nativeW: number;
  nativeH: number;
  vitalCxPx: number;
  vitalCyPx: number;
  /** Target-guide vital (source measurement before map-to-topp). */
  targetVitalCxPx: number;
  targetVitalCyPx: number;
  targetW: number;
  targetH: number;
  spriteHeightMm: number;
  spriteWidthMm: number;
  /** Green instant-kill diameter (mm) — catalog or admin override. */
  instantDiameterMm: number;
  /** Red vital-ring diameter (mm) — catalog or admin override. */
  vitalDiameterMm: number;
  headCxPx: number;
  headCyPx: number;
  headDiameterMm: number;
  neckCxPx: number;
  neckCyPx: number;
  neckWidthMm: number;
  neckHeightMm: number;
  neckRotationDeg: number;
  bodyRxMm: number;
  bodyRyMm: number;
  bodyOffsetXMm: number;
  bodyOffsetYMm: number;
  bodyRotationDeg: number;
};

export function birdShotGeom(spriteId: BirdSpriteId): BirdShotGeom {
  const s = getBirdSprite(spriteId);
  const zone = getBirdHitZone(spriteId);
  const spriteHeightMm = TIUR_SPRITE_HEIGHT_MM;
  const spriteWidthMm = spriteHeightMm * (s.toppW / s.toppH);
  return {
    spriteId,
    displaySrc: s.toppSrc,
    targetGuideSrc: s.targetSrc,
    nativeW: s.toppW,
    nativeH: s.toppH,
    vitalCxPx: zone.vitalCxPx,
    vitalCyPx: zone.vitalCyPx,
    targetVitalCxPx: s.targetVitalCxPx,
    targetVitalCyPx: s.targetVitalCyPx,
    targetW: s.targetW,
    targetH: s.targetH,
    spriteHeightMm,
    spriteWidthMm,
    instantDiameterMm: zone.instantDiameterMm,
    vitalDiameterMm: zone.vitalDiameterMm,
    headCxPx: zone.headCxPx,
    headCyPx: zone.headCyPx,
    headDiameterMm: zone.headDiameterMm,
    neckCxPx: zone.neckCxPx,
    neckCyPx: zone.neckCyPx,
    neckWidthMm: zone.neckWidthMm,
    neckHeightMm: zone.neckHeightMm,
    neckRotationDeg: zone.neckRotationDeg,
    bodyRxMm: zone.bodyRxMm,
    bodyRyMm: zone.bodyRyMm,
    bodyOffsetXMm: zone.bodyOffsetXMm,
    bodyOffsetYMm: zone.bodyOffsetYMm,
    bodyRotationDeg: zone.bodyRotationDeg,
  };
}

export function birdNativePxPerMm(geom: Pick<BirdShotGeom, "nativeH" | "spriteHeightMm">): number {
  return geom.nativeH / geom.spriteHeightMm;
}

export function birdMmToNativePx(
  mm: number,
  geom: Pick<BirdShotGeom, "nativeH" | "spriteHeightMm">,
): number {
  return mm * birdNativePxPerMm(geom);
}

/** Offset from image centre to vital centre (native topp px). */
export function birdVitalOffsetFromImageCenterPx(
  geom: Pick<BirdShotGeom, "nativeW" | "nativeH" | "vitalCxPx" | "vitalCyPx">,
): { x: number; y: number } {
  return {
    x: geom.vitalCxPx - geom.nativeW / 2,
    y: geom.vitalCyPx - geom.nativeH / 2,
  };
}

/** @deprecated Prefer birdNativePxPerMm(birdShotGeom(...)). */
export function tiurNativePxPerMm(): number {
  return TIUR_IMAGE_NATIVE_H / TIUR_SPRITE_HEIGHT_MM;
}

/** @deprecated Prefer birdMmToNativePx. */
export function tiurMmToNativePx(mm: number): number {
  return mm * tiurNativePxPerMm();
}

/** @deprecated Prefer birdVitalOffsetFromImageCenterPx. */
export function tiurVitalOffsetFromImageCenterPx(): { x: number; y: number } {
  return {
    x: TIUR_VITAL_CX_PX - TIUR_IMAGE_NATIVE_W / 2,
    y: TIUR_VITAL_CY_PX - TIUR_IMAGE_NATIVE_H / 2,
  };
}

/**
 * CSS scale for the bird sprite inside the rifle scope.
 *
 * Matches spotting binos circular FOV: bird width as fraction of the
 * visible circle ≈ spriteWidthPct(distance) × mag / 100.
 *
 * Pass `widthPct` from the placement when available so perch/sprite admin
 * scales match spotting (recomputing from distance alone drops those).
 */
export function birdScopeImageScale(
  zoom: number,
  _scope: Pick<ScopeSpec, "minZoom" | "maxZoom"> | undefined,
  distanceM: number,
  nativeW: number,
  spriteId?: BirdSpriteId,
  widthPctOverride?: number,
): number {
  const widthPct =
    widthPctOverride != null &&
    Number.isFinite(widthPctOverride) &&
    widthPctOverride > 0
      ? widthPctOverride
      : spriteWidthPctForDistance(distanceM, spriteId);
  const widthFracOfFov = (widthPct * Math.max(1, zoom)) / 100;
  const desiredWidthPx = SCOPE_VIEWPORT_REF_PX * widthFracOfFov;
  return Math.max(0.01, desiredWidthPx / Math.max(1, nativeW));
}

/** @deprecated Prefer birdScopeImageScale. */
export function tiurScopeImageScale(
  zoom: number,
  scope: Pick<ScopeSpec, "minZoom" | "maxZoom"> | undefined,
  distanceM: number,
): number {
  return birdScopeImageScale(zoom, scope, distanceM, TIUR_IMAGE_NATIVE_W);
}

function inCircleMm(
  xMm: number,
  yMm: number,
  diameterMm: number,
): boolean {
  const r = diameterMm / 2;
  return xMm * xMm + yMm * yMm <= r * r;
}

export function isInstantKillHit(
  xMm: number,
  yMm: number,
  diameterMm: number = TIUR_INSTANT_KILL_DIAMETER_MM,
): boolean {
  return inCircleMm(xMm, yMm, diameterMm);
}

export function isVitalRingHit(
  xMm: number,
  yMm: number,
  vitalDiameterMm: number = TIUR_VITAL_DIAMETER_MM,
  instantDiameterMm: number = TIUR_INSTANT_KILL_DIAMETER_MM,
): boolean {
  return (
    inCircleMm(xMm, yMm, vitalDiameterMm) &&
    !isInstantKillHit(xMm, yMm, instantDiameterMm)
  );
}

export function isVitalAreaHit(
  xMm: number,
  yMm: number,
  diameterMm: number = TIUR_VITAL_DIAMETER_MM,
): boolean {
  return inCircleMm(xMm, yMm, diameterMm);
}

/**
 * Body ellipse relative to vital (mm).
 * Admin-calibrated; outside = clean miss.
 * When `birdFlip`, offset X and rotation mirror with the sprite.
 */
export function bodyEllipseFromVitalMm(
  geom?: Pick<
    BirdShotGeom,
    | "spriteWidthMm"
    | "spriteHeightMm"
    | "bodyRxMm"
    | "bodyRyMm"
    | "bodyOffsetXMm"
    | "bodyOffsetYMm"
    | "bodyRotationDeg"
  >,
  birdFlip = false,
): {
  rxMm: number;
  ryMm: number;
  offsetXMm: number;
  offsetYMm: number;
  rotationDeg: number;
} {
  const w = geom?.spriteWidthMm ?? TIUR_SPRITE_WIDTH_MM;
  const h = geom?.spriteHeightMm ?? TIUR_SPRITE_HEIGHT_MM;
  const rxMm = geom?.bodyRxMm ?? w * 0.26;
  const ryMm = geom?.bodyRyMm ?? h * 0.32;
  let offsetXMm = geom?.bodyOffsetXMm ?? 0;
  const offsetYMm = geom?.bodyOffsetYMm ?? h * 0.04;
  let rotationDeg = geom?.bodyRotationDeg ?? 0;
  if (birdFlip) {
    offsetXMm = -offsetXMm;
    rotationDeg = -rotationDeg;
  }
  return { rxMm, ryMm, offsetXMm, offsetYMm, rotationDeg };
}

export function isBodyHit(
  xMm: number,
  yMm: number,
  geom?: Pick<
    BirdShotGeom,
    | "spriteWidthMm"
    | "spriteHeightMm"
    | "bodyRxMm"
    | "bodyRyMm"
    | "bodyOffsetXMm"
    | "bodyOffsetYMm"
    | "bodyRotationDeg"
  >,
  birdFlip = false,
): boolean {
  const { rxMm, ryMm, offsetXMm, offsetYMm, rotationDeg } =
    bodyEllipseFromVitalMm(geom, birdFlip);
  if (rxMm <= 0 || ryMm <= 0) return false;
  const dx = xMm - offsetXMm;
  const dy = yMm - offsetYMm;
  const rad = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  const nx = lx / rxMm;
  const ny = ly / ryMm;
  return nx * nx + ny * ny <= 1;
}

/**
 * In the red ring (outside green), higher damageFactor → more often clean kill.
 * Match OTM (~0.18) often needs ettersøk; aggressive SP (~0.8) usually drops.
 * @deprecated Red ring is always short ettersøk; kept for AAR / legacy callers.
 */
export function vitalRingCleanKillChance(damageFactor: number): number {
  const d = Math.max(0, Math.min(1, damageFactor));
  return 0.1 + d * 0.9;
}

export function rollVitalRingKill(
  damageFactor: number,
  random: () => number = Math.random,
): boolean {
  return random() < vitalRingCleanKillChance(damageFactor);
}

/**
 * Hit ladder (see {@link classifyHuntShot}):
 * - Yellow head: instant kill (headshot)
 * - Orange neck: lucky instant kill
 * - Green chest: instant kill (drops)
 * - Red: vital → short ettersøk
 * - Body ellipse: wound → long ettersøk
 * - Outside: miss
 */
export function headOffsetFromVitalMm(
  geom: Pick<
    BirdShotGeom,
    | "nativeH"
    | "spriteHeightMm"
    | "vitalCxPx"
    | "vitalCyPx"
    | "headCxPx"
    | "headCyPx"
  >,
  birdFlip = false,
): { xMm: number; yMm: number } {
  const pxPerMm = birdNativePxPerMm(geom);
  let xMm = (geom.headCxPx - geom.vitalCxPx) / pxPerMm;
  const yMm = (geom.headCyPx - geom.vitalCyPx) / pxPerMm;
  if (birdFlip) xMm = -xMm;
  return { xMm, yMm };
}

export function isHeadshotHit(
  xMm: number,
  yMm: number,
  geom: Pick<
    BirdShotGeom,
    | "nativeH"
    | "spriteHeightMm"
    | "vitalCxPx"
    | "vitalCyPx"
    | "headCxPx"
    | "headCyPx"
    | "headDiameterMm"
  >,
  birdFlip = false,
): boolean {
  const d = geom.headDiameterMm;
  if (!(d > 0)) return false;
  const off = headOffsetFromVitalMm(geom, birdFlip);
  return inCircleMm(xMm - off.xMm, yMm - off.yMm, d);
}

export function neckOffsetFromVitalMm(
  geom: Pick<
    BirdShotGeom,
    | "nativeH"
    | "spriteHeightMm"
    | "vitalCxPx"
    | "vitalCyPx"
    | "neckCxPx"
    | "neckCyPx"
    | "neckRotationDeg"
  >,
  birdFlip = false,
): { xMm: number; yMm: number; rotationDeg: number } {
  const pxPerMm = birdNativePxPerMm(geom);
  let xMm = (geom.neckCxPx - geom.vitalCxPx) / pxPerMm;
  const yMm = (geom.neckCyPx - geom.vitalCyPx) / pxPerMm;
  let rotationDeg = geom.neckRotationDeg ?? 0;
  if (birdFlip) {
    xMm = -xMm;
    rotationDeg = -rotationDeg;
  }
  return { xMm, yMm, rotationDeg };
}

/** Rotated neck rectangle in mm relative to vital (+x right, +y down). */
export function isNeckHit(
  xMm: number,
  yMm: number,
  geom: Pick<
    BirdShotGeom,
    | "nativeH"
    | "spriteHeightMm"
    | "vitalCxPx"
    | "vitalCyPx"
    | "neckCxPx"
    | "neckCyPx"
    | "neckWidthMm"
    | "neckHeightMm"
    | "neckRotationDeg"
  >,
  birdFlip = false,
): boolean {
  const hw = (geom.neckWidthMm ?? 0) / 2;
  const hh = (geom.neckHeightMm ?? 0) / 2;
  if (hw <= 0 || hh <= 0) return false;
  const { xMm: ox, yMm: oy, rotationDeg } = neckOffsetFromVitalMm(
    geom,
    birdFlip,
  );
  const dx = xMm - ox;
  const dy = yMm - oy;
  const rad = (-rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= hw && Math.abs(ly) <= hh;
}

/**
 * Hit ladder:
 * - Yellow head: instant kill (headshot)
 * - Orange neck: lucky instant kill (not an aim point)
 * - Green chest: instant kill (drops)
 * - Red: vital → short ettersøk
 * - Body ellipse: wound → long ettersøk (near max fly radius)
 * - Outside: miss (unharmed)
 */
export function classifyHuntShot(
  xMm: number,
  yMm: number,
  _damageFactor: number,
  _random: () => number = Math.random,
  geom?: Pick<
    BirdShotGeom,
    | "nativeH"
    | "spriteHeightMm"
    | "spriteWidthMm"
    | "vitalCxPx"
    | "vitalCyPx"
    | "instantDiameterMm"
    | "vitalDiameterMm"
    | "headCxPx"
    | "headCyPx"
    | "headDiameterMm"
    | "neckCxPx"
    | "neckCyPx"
    | "neckWidthMm"
    | "neckHeightMm"
    | "neckRotationDeg"
    | "bodyRxMm"
    | "bodyRyMm"
    | "bodyOffsetXMm"
    | "bodyOffsetYMm"
    | "bodyRotationDeg"
  >,
  birdFlip = false,
): { kind: HuntShotResultKind; zone: HuntShotZone } {
  const instantD = geom?.instantDiameterMm ?? TIUR_INSTANT_KILL_DIAMETER_MM;
  const vitalD = geom?.vitalDiameterMm ?? TIUR_VITAL_DIAMETER_MM;
  if (
    geom &&
    geom.headDiameterMm > 0 &&
    isHeadshotHit(xMm, yMm, geom, birdFlip)
  ) {
    return { kind: "instant_kill", zone: "head" };
  }
  if (geom && isNeckHit(xMm, yMm, geom, birdFlip)) {
    return { kind: "instant_kill", zone: "neck" };
  }
  if (isInstantKillHit(xMm, yMm, instantD)) {
    return { kind: "instant_kill", zone: "instant" };
  }
  if (isVitalRingHit(xMm, yMm, vitalD, instantD)) {
    return { kind: "ettersok", zone: "vital" };
  }
  if (isBodyHit(xMm, yMm, geom, birdFlip)) {
    return { kind: "ettersok", zone: "body" };
  }
  return { kind: "miss", zone: "none" };
}

/** Re-export for callers that only have a sprite def. */
export function geomFromSprite(sprite: BirdSpriteDef): BirdShotGeom {
  return birdShotGeom(sprite.id);
}
