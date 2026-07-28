/**
 * Shared scope image scale — one truth for the whole game.
 *
 * Reticle: {@link opticReticleImgScale} — FFP size from optic zoom only
 * (never subject / distance). Same path for hunt, IMPACT, admin, MOA.
 *
 * Bird / landscape: {@link birdScopeImageScale} — true angular vs FFP
 * (1 mil ↔ distanceM mm); admin sprite-% scales visual + mm together.
 *
 * Zeroing paper only: {@link zeroingTargetAndReticleScale} applies the
 * explicit {@link RANGE_TRUE_ANGULAR_TARGET_SCALE} (×0.1) so dial/hash
 * matches readable paper — the sole intentional deviation from bird truth.
 */

import type { ScopeClickUnit, ScopeSpec } from "@/lib/optics/spec";
import { MOA_RANGE_TARGET_SCALE } from "@/lib/optics/clicks";
import {
  RANGE_DISTANCE_M,
  RANGE_EASY_ZERO_SCALE,
  RANGE_TRUE_ANGULAR_TARGET_SCALE,
  scopeImageScale,
} from "@/lib/range/precision";

/**
 * {@link ScopeReticle} `imgScale` from optic zoom only (100 m reference).
 * Optional `easy10x` grows the reticle with the readable-paper helper.
 */
export function opticReticleImgScale(
  zoom: number,
  scope?: Pick<ScopeSpec, "minZoom" | "maxZoom" | "zoomMagCal">,
  easy10x = false,
): number {
  const base = scopeImageScale(zoom, scope, RANGE_DISTANCE_M);
  return easy10x ? base * RANGE_EASY_ZERO_SCALE : base;
}

export function zeroingTargetAndReticleScale(opts: {
  zoom: number;
  scope: Pick<ScopeSpec, "minZoom" | "maxZoom" | "zoomMagCal">;
  distanceM: number;
  target: { visualScale: number; pxPerMm: number };
  paperUnit: ScopeClickUnit;
  /** Tracking-test lane: no ×0.1 true-angular shrink. */
  trackingLane?: boolean;
  /** 10× innskyting helper — larger paper + matching reticle. */
  easy10x?: boolean;
}): { targetScale: number; reticleImgScale: number } {
  const moaPaperScale = opts.paperUnit === "MOA" ? MOA_RANGE_TARGET_SCALE : 1;
  const easyBoost =
    opts.easy10x && !opts.trackingLane ? RANGE_EASY_ZERO_SCALE : 1;
  const trueAngularPaper = opts.trackingLane
    ? 1
    : RANGE_TRUE_ANGULAR_TARGET_SCALE * easyBoost;
  const targetScale =
    scopeImageScale(opts.zoom, opts.scope, opts.distanceM) *
    opts.target.visualScale *
    moaPaperScale *
    trueAngularPaper;
  const reticleImgScale = opticReticleImgScale(
    opts.zoom,
    opts.scope,
    Boolean(opts.easy10x && !opts.trackingLane),
  );
  return { targetScale, reticleImgScale };
}
