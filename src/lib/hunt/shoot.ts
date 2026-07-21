/**
 * Hunt shot geometry — tiur toppjakt target vs vital zones.
 *
 * Zones (from designer indicator on tiurtopp1):
 *   Green = instant kill (any ammo)
 *   Red   = vital; outside green, ammo damageFactor decides clean kill vs ettersøk
 *   Body  = wound / ettersøk
 *   Else  = miss
 *
 * Apparent size matches spotting binos FOV at same mag × distance.
 */

import type { ScopeSpec } from "@/lib/optics/spec";
import { spriteWidthPctForDistance } from "@/lib/hunt/birds";

export const TIUR_TARGET_SRC = "/images/birds/tiur/tiurtopp1.png";
export const TIUR_IMAGE_NATIVE_W = 88;
export const TIUR_IMAGE_NATIVE_H = 138;

/** Pike Pro misc — after-action impact replay on hunt shots. */
export const TRIGGERCAM_ITEM_ID = "misc-triggercam";

/** Tripod camcorder — better ettersøk overview; deploy costs nerve. */
export const CAMCORDER_ITEM_ID = "misc-hunt-camcorder";

/** Garmin Xero chronograph — measures real projectile velocity (wiring later). */
export const CHRONOGRAPH_ITEM_ID = "misc-garmin-xero-c1-pro";

/** Nerve bump (0–1 scale) when deploying camcorder before the shot. */
export const CAMCORDER_SETUP_NERVE = 0.2;

/**
 * Reference scope viewport size (px) — matches `.scope-viewport` (~28rem).
 * Used to convert binos FOV-% into a CSS image scale.
 */
export const SCOPE_VIEWPORT_REF_PX = 448;

/**
 * Real-world height represented by the full sprite (for zone mm math).
 * Independent of on-screen scale — only hit geometry.
 */
export const TIUR_SPRITE_HEIGHT_MM = 480;

export const TIUR_SPRITE_WIDTH_MM =
  TIUR_SPRITE_HEIGHT_MM * (TIUR_IMAGE_NATIVE_W / TIUR_IMAGE_NATIVE_H);

/**
 * Zone diameters from indicator overlay on the sprite (measured).
 * Fixed physical size — does not change with distance.
 */
/** Green circle — instant kill regardless of ammo. */
export const TIUR_INSTANT_KILL_DIAMETER_MM = 66;
/** Red circle — vital area (includes green). */
export const TIUR_VITAL_DIAMETER_MM = 114;

/** @deprecated Prefer TIUR_INSTANT_KILL_DIAMETER_MM / TIUR_VITAL_DIAMETER_MM. */
export const TIUR_VITAL_DIAMETER_MM_LEGACY = TIUR_VITAL_DIAMETER_MM;

/**
 * Zone centre in native sprite pixels (chest — from indicator + asset).
 * Origin top-left of tiurtopp1.png (88×138). Shifted 10% of width right.
 */
export const TIUR_VITAL_CX_PX = Math.round(32 + TIUR_IMAGE_NATIVE_W * 0.1);
export const TIUR_VITAL_CY_PX = 78;

export type HuntShotResultKind =
  | "instant_kill"
  | "vital_kill"
  | "ettersok"
  | "miss";

export type HuntShotZone = "instant" | "vital" | "body" | "none";

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
};

export function tiurNativePxPerMm(): number {
  return TIUR_IMAGE_NATIVE_H / TIUR_SPRITE_HEIGHT_MM;
}

export function tiurMmToNativePx(mm: number): number {
  return mm * tiurNativePxPerMm();
}

/** Offset from image centre to vital centre (native px). */
export function tiurVitalOffsetFromImageCenterPx(): { x: number; y: number } {
  return {
    x: TIUR_VITAL_CX_PX - TIUR_IMAGE_NATIVE_W / 2,
    y: TIUR_VITAL_CY_PX - TIUR_IMAGE_NATIVE_H / 2,
  };
}

/**
 * CSS scale for the tiur sprite inside the rifle scope.
 *
 * Matches spotting binos circular FOV: bird width as fraction of the
 * visible circle ≈ spriteWidthPct(distance) × mag / 100.
 * (Binos world % is of the landscape frame; vignette circle ≈ frame height
 * on a wide frame — we treat scope circle the same way as that FOV.)
 *
 * IMPORTANT: img element must be native 88×138 CSS px before this scale
 * (see `.scope-target.hunt-tiur-target`) — not the CBA 949px width.
 */
export function tiurScopeImageScale(
  zoom: number,
  _scope: Pick<ScopeSpec, "minZoom" | "maxZoom"> | undefined,
  distanceM: number,
): number {
  const widthPct = spriteWidthPctForDistance(distanceM);
  const widthFracOfFov = (widthPct * Math.max(1, zoom)) / 100;
  const desiredWidthPx = SCOPE_VIEWPORT_REF_PX * widthFracOfFov;
  return Math.max(0.01, desiredWidthPx / TIUR_IMAGE_NATIVE_W);
}

function inCircleMm(
  xMm: number,
  yMm: number,
  diameterMm: number,
): boolean {
  const r = diameterMm / 2;
  return xMm * xMm + yMm * yMm <= r * r;
}

export function isInstantKillHit(xMm: number, yMm: number): boolean {
  return inCircleMm(xMm, yMm, TIUR_INSTANT_KILL_DIAMETER_MM);
}

export function isVitalRingHit(xMm: number, yMm: number): boolean {
  return (
    inCircleMm(xMm, yMm, TIUR_VITAL_DIAMETER_MM) &&
    !isInstantKillHit(xMm, yMm)
  );
}

export function isVitalAreaHit(xMm: number, yMm: number): boolean {
  return inCircleMm(xMm, yMm, TIUR_VITAL_DIAMETER_MM);
}

/**
 * Loose body ellipse in mm relative to vital (covers torso/neck of sprite).
 * Outside = clean miss (tree / air).
 */
export function isBodyHit(xMm: number, yMm: number): boolean {
  const rx = TIUR_SPRITE_WIDTH_MM * 0.42;
  const ry = TIUR_SPRITE_HEIGHT_MM * 0.48;
  const cy = 25;
  const nx = xMm / rx;
  const ny = (yMm - cy) / ry;
  return nx * nx + ny * ny <= 1;
}

/**
 * In the red ring (outside green), higher damageFactor → more often clean kill.
 * Match OTM (~0.18) often needs ettersøk; aggressive SP (~0.8) usually drops.
 */
export function vitalRingCleanKillChance(damageFactor: number): number {
  const d = Math.max(0, Math.min(1, damageFactor));
  // ~0.22 at 0.18 · ~0.55 at 0.55 · ~0.88 at 0.85
  return 0.1 + d * 0.9;
}

export function rollVitalRingKill(
  damageFactor: number,
  random: () => number = Math.random,
): boolean {
  return random() < vitalRingCleanKillChance(damageFactor);
}

export function classifyHuntShot(
  xMm: number,
  yMm: number,
  damageFactor: number,
  random: () => number = Math.random,
): { kind: HuntShotResultKind; zone: HuntShotZone } {
  if (isInstantKillHit(xMm, yMm)) {
    return { kind: "instant_kill", zone: "instant" };
  }
  if (isVitalRingHit(xMm, yMm)) {
    const clean = rollVitalRingKill(damageFactor, random);
    return {
      kind: clean ? "vital_kill" : "ettersok",
      zone: "vital",
    };
  }
  if (isBodyHit(xMm, yMm)) {
    return { kind: "ettersok", zone: "body" };
  }
  return { kind: "miss", zone: "none" };
}
