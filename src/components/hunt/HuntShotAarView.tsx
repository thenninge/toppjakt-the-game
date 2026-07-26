"use client";

import {
  birdMmToNativePx,
  birdShotGeom,
  birdVitalOffsetFromImageCenterPx,
  formatHuntImpactOffsetMm,
  headOffsetFromVitalMm,
  HEADSHOT_AAR_TEXT,
  neckOffsetFromVitalMm,
  NECK_LUCKY_KILL_TEXT,
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

  const greenD = mmToPx(geom.instantDiameterMm) * aarScale;
  const redD = mmToPx(geom.vitalDiameterMm) * aarScale;
  const yellowD = mmToPx(geom.headDiameterMm) * aarScale;
  const headOff = headOffsetFromVitalMm(geom, birdFlip);
  const neckOff = neckOffsetFromVitalMm(geom, birdFlip);
  const neckW = mmToPx(geom.neckWidthMm) * aarScale;
  const neckH = mmToPx(geom.neckHeightMm) * aarScale;
  const holeD = Math.max(6, mmToPx(hit.diameterMm) * aarScale);
  const hitX =
    (geom.nativeW / 2 + vitalOff.x + mmToPx(hit.xMm)) * aarScale;
  const hitY =
    (geom.nativeH / 2 + vitalOff.y + mmToPx(hit.yMm)) * aarScale;
  const zoneCx = (geom.nativeW / 2 + vitalOff.x) * aarScale;
  const zoneCy = (geom.nativeH / 2 + vitalOff.y) * aarScale;
  const headCx = zoneCx + mmToPx(headOff.xMm) * aarScale;
  const headCy = zoneCy + mmToPx(headOff.yMm) * aarScale;
  const neckCx = zoneCx + mmToPx(neckOff.xMm) * aarScale;
  const neckCy = zoneCy + mmToPx(neckOff.yMm) * aarScale;

  const isHeadshot = hit.zone === "head";
  const isNeck = hit.zone === "neck";
  const detail =
    subtitle ??
    (isHeadshot
      ? HEADSHOT_AAR_TEXT
      : isNeck
        ? NECK_LUCKY_KILL_TEXT
        : `Treff ${formatHuntImpactOffsetMm(hit.xMm, hit.yMm)} (fra vital-senter) · sone ${hit.zone}`);

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
          {isHeadshot && geom.headDiameterMm > 0 ? (
            <span
              className="triggercam-zone triggercam-zone--head"
              style={{
                width: yellowD,
                height: yellowD,
                left: headCx,
                top: headCy,
                marginLeft: -yellowD / 2,
                marginTop: -yellowD / 2,
              }}
              title="Headshot"
            />
          ) : null}
          {isNeck && geom.neckWidthMm > 0 && geom.neckHeightMm > 0 ? (
            <span
              className="triggercam-zone triggercam-zone--neck"
              style={{
                width: neckW,
                height: neckH,
                left: neckCx,
                top: neckCy,
                marginLeft: -neckW / 2,
                marginTop: -neckH / 2,
                transform: `rotate(${neckOff.rotationDeg}deg)`,
              }}
              title="Nakke (flaks)"
            />
          ) : null}
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
          {isHeadshot
            ? "Gul sone — headshot · instant kill"
            : isNeck
              ? "Oransje sone — nakke (flaks) · instant kill"
              : "Rød = vital · grønn = instant kill · rødt hull = treffpunkt"}
        </p>
        <button type="button" className="intro-button" onClick={onContinue}>
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
