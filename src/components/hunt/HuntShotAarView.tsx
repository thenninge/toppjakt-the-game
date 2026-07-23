"use client";

import {
  birdMmToNativePx,
  birdShotGeom,
  birdVitalOffsetFromImageCenterPx,
  formatHuntImpactOffsetMm,
  TIUR_INSTANT_KILL_DIAMETER_MM,
  TIUR_VITAL_DIAMETER_MM,
  type HuntShotResultKind,
  type HuntShotZone,
} from "@/lib/hunt/shoot";
import type { BirdSpriteId } from "@/lib/hunt/birdSprites";

export type HuntShotHitFasit = {
  xMm: number;
  yMm: number;
  diameterMm: number;
  zone: HuntShotZone;
  kind: HuntShotResultKind;
};

type HuntShotAarViewProps = {
  hit: HuntShotHitFasit;
  /** Header title — Triggercam vs find fasit. */
  title?: string;
  subtitle?: string;
  continueLabel?: string;
  /** Same horizontal flip as spotting / shoot. */
  birdFlip?: boolean;
  /** Topp/target pair — AAR shows the topp sprite (not the target guide). */
  birdSpriteId?: BirdSpriteId;
  onContinue: () => void;
};

/**
 * After-action / find fasit: topp sprite + CSS vital rings + impact hole.
 * Target PNGs are analysis-only (zone centres); never shown to the player.
 */
export function HuntShotAarView({
  hit,
  title = "Fasit — treffpunkt",
  subtitle,
  continueLabel = "Fortsett",
  birdFlip = false,
  birdSpriteId = "tiur-1",
  onContinue,
}: HuntShotAarViewProps) {
  const geom = birdShotGeom(birdSpriteId);
  const aarScale = 2.4;
  const mmToPx = (mm: number) => birdMmToNativePx(mm, geom);
  const vitalBase = birdVitalOffsetFromImageCenterPx(geom);
  const vitalOff = birdFlip
    ? { x: -vitalBase.x, y: vitalBase.y }
    : vitalBase;

  const greenD = mmToPx(TIUR_INSTANT_KILL_DIAMETER_MM) * aarScale;
  const redD = mmToPx(TIUR_VITAL_DIAMETER_MM) * aarScale;
  const holeD = Math.max(6, mmToPx(hit.diameterMm) * aarScale);
  const hitX =
    (geom.nativeW / 2 + vitalOff.x + mmToPx(hit.xMm)) * aarScale;
  const hitY =
    (geom.nativeH / 2 + vitalOff.y + mmToPx(hit.yMm)) * aarScale;
  const zoneCx = (geom.nativeW / 2 + vitalOff.x) * aarScale;
  const zoneCy = (geom.nativeH / 2 + vitalOff.y) * aarScale;

  const detail =
    subtitle ??
    `Treff ${formatHuntImpactOffsetMm(hit.xMm, hit.yMm)} (fra vital-senter) · sone ${hit.zone}`;

  return (
    <div
      className="shooting-range hunt-shoot"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header className="shop-header">
        <p className="intro-line intro-gift">{title}</p>
        <p className="shop-row-note">{detail}</p>
      </header>
      <div className="triggercam-aar">
        <div
          className="triggercam-aar-frame"
          style={{
            width: geom.nativeW * aarScale,
            height: geom.nativeH * aarScale,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={geom.displaySrc}
            alt="Fugl"
            className="triggercam-aar-bird"
            width={geom.nativeW * aarScale}
            height={geom.nativeH * aarScale}
            draggable={false}
            style={birdFlip ? { transform: "scaleX(-1)" } : undefined}
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
        <button type="button" className="intro-button" onClick={onContinue}>
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
