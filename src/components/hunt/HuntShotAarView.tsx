"use client";

import {
  TIUR_IMAGE_NATIVE_H,
  TIUR_IMAGE_NATIVE_W,
  TIUR_INSTANT_KILL_DIAMETER_MM,
  TIUR_TARGET_SRC,
  TIUR_VITAL_DIAMETER_MM,
  tiurMmToNativePx,
  tiurVitalOffsetFromImageCenterPx,
  type HuntShotResultKind,
  type HuntShotZone,
} from "@/lib/hunt/shoot";

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
  onContinue: () => void;
};

/**
 * After-action / find fasit: bird + vital rings + impact hole (same as Triggercam AAR).
 */
export function HuntShotAarView({
  hit,
  title = "Fasit — treffpunkt",
  subtitle,
  continueLabel = "Fortsett",
  onContinue,
}: HuntShotAarViewProps) {
  const aarScale = 2.4;
  const vitalOffAar = tiurVitalOffsetFromImageCenterPx();
  const greenD = tiurMmToNativePx(TIUR_INSTANT_KILL_DIAMETER_MM) * aarScale;
  const redD = tiurMmToNativePx(TIUR_VITAL_DIAMETER_MM) * aarScale;
  const holeD = Math.max(6, tiurMmToNativePx(hit.diameterMm) * aarScale);
  const hitX =
    (TIUR_IMAGE_NATIVE_W / 2 + vitalOffAar.x + tiurMmToNativePx(hit.xMm)) *
    aarScale;
  const hitY =
    (TIUR_IMAGE_NATIVE_H / 2 + vitalOffAar.y + tiurMmToNativePx(hit.yMm)) *
    aarScale;
  const zoneCx = (TIUR_IMAGE_NATIVE_W / 2 + vitalOffAar.x) * aarScale;
  const zoneCy = (TIUR_IMAGE_NATIVE_H / 2 + vitalOffAar.y) * aarScale;

  const detail =
    subtitle ??
    `Treff ${hit.xMm >= 0 ? "+" : ""}${hit.xMm.toFixed(0)} mm side / ${
      hit.yMm >= 0 ? "+" : ""
    }${hit.yMm.toFixed(0)} mm høyde (fra vital-senter) · sone ${hit.zone}`;

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
            width: TIUR_IMAGE_NATIVE_W * aarScale,
            height: TIUR_IMAGE_NATIVE_H * aarScale,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={TIUR_TARGET_SRC}
            alt="Tiur"
            className="triggercam-aar-bird"
            width={TIUR_IMAGE_NATIVE_W * aarScale}
            height={TIUR_IMAGE_NATIVE_H * aarScale}
            draggable={false}
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
