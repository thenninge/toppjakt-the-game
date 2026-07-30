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
  type HuntAdminShotDebug,
  type HuntShotResultKind,
  type HuntShotZone,
} from "@/lib/hunt/shoot";
import type { BirdSpriteId } from "@/lib/hunt/birdSprites";
import { dropMmToMrad } from "@/lib/ballistics/holdHint";

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
  /** Extra class on the bird img (e.g. IMPACT orange figure). */
  birdClassName?: string;
  /** Admin: reticle seat + effect breakdown. */
  adminDebug?: HuntAdminShotDebug | null;
  onContinue: () => void;
};

function fmtMm(n: number, digits = 1): string {
  const t = Math.abs(n) < 0.05 ? 0 : n;
  return `${t >= 0 ? "+" : ""}${t.toFixed(digits)}`;
}

function fmtSigned(n: number, digits = 1, unit = ""): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}${unit}`;
}

/**
 * Classic topp sprites are ~80–150 px; AAR used ×2.4 (~200–360 px on screen).
 * Nerve-pair PNGs are 600–1000+ px — same ×2.4 fills the viewport. Cap the
 * displayed box so every bird reads at a similar size; overlays share the scale.
 */
const AAR_SCALE_CLASSIC = 2.4;
/** Keep high-res nerve-pair sprites near classic AAR on-screen size. */
const AAR_MAX_DISPLAY_W = 360;
const AAR_MAX_DISPLAY_H = 320;

function aarDisplayScale(nativeW: number, nativeH: number): number {
  const w = Math.max(1, nativeW);
  const h = Math.max(1, nativeH);
  return Math.min(
    AAR_SCALE_CLASSIC,
    AAR_MAX_DISPLAY_W / w,
    AAR_MAX_DISPLAY_H / h,
  );
}

/**
 * After-action / find fasit: topp sprite + CSS vital rings + impact hole.
 * Target PNGs are analysis-only (zone centres); never shown to the player.
 * With {@link adminDebug}, also marks aim/POA and lists shot effects.
 */
export function HuntShotAarView({
  hit,
  title = "Fasit — treffpunkt",
  subtitle,
  continueLabel = "Fortsett",
  birdFlip = false,
  birdSpriteId = "tiur-1",
  birdClassName,
  adminDebug = null,
  onContinue,
}: HuntShotAarViewProps) {
  const geom = birdShotGeom(birdSpriteId);
  const aarScale = aarDisplayScale(geom.nativeW, geom.nativeH);
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

  const aimMark = adminDebug
    ? {
        x:
          (geom.nativeW / 2 +
            vitalOff.x +
            mmToPx(adminDebug.aimMm.x)) *
          aarScale,
        y:
          (geom.nativeH / 2 +
            vitalOff.y +
            mmToPx(adminDebug.aimMm.y)) *
          aarScale,
      }
    : null;
  const poaMark = adminDebug
    ? {
        x:
          (geom.nativeW / 2 +
            vitalOff.x +
            mmToPx(adminDebug.poaMm.x)) *
          aarScale,
        y:
          (geom.nativeH / 2 +
            vitalOff.y +
            mmToPx(adminDebug.poaMm.y)) *
          aarScale,
      }
    : null;

  const isHeadshot = hit.zone === "head";
  const isNeck = hit.zone === "neck";
  const detail =
    subtitle ??
    (isHeadshot
      ? HEADSHOT_AAR_TEXT
      : isNeck
        ? NECK_LUCKY_KILL_TEXT
        : `Treff ${formatHuntImpactOffsetMm(hit.xMm, hit.yMm)} (fra vital-senter) · sone ${hit.zone}`);

  const e = adminDebug?.effects;
  const rangeM = e?.trueDistanceM ?? 0;
  const dxMm = adminDebug ? hit.xMm - adminDebug.aimMm.x : 0;
  const dyUpMm = adminDebug ? -(hit.yMm - adminDebug.aimMm.y) : 0;
  const dxMrad = rangeM > 0 ? dropMmToMrad(dxMm, rangeM) : 0;
  const dyMrad = rangeM > 0 ? dropMmToMrad(dyUpMm, rangeM) : 0;

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
            className={
              birdClassName
                ? `triggercam-aar-bird ${birdClassName}`
                : "triggercam-aar-bird"
            }
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
          {aimMark ? (
            <span
              className="triggercam-aar-aim"
              style={{ left: aimMark.x, top: aimMark.y }}
              title="Siktepunkt (reticle)"
            />
          ) : null}
          {poaMark ? (
            <span
              className="triggercam-aar-poa"
              style={{ left: poaMark.x, top: poaMark.y }}
              title="POA (sikte + wobble + avtrekk)"
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

        {adminDebug && e ? (
          <div className="admin-hunt-aar-panel">
            <p className="admin-hunt-aar-heading">Admin AAR</p>
            <dl className="admin-hunt-aar-grid">
              <dt>Range</dt>
              <dd>
                {e.trueDistanceM.toFixed(0)} m
                {Math.abs(e.trueDistanceM - e.measuredDistanceM) >= 0.5
                  ? ` (målt ${e.measuredDistanceM.toFixed(0)} m)`
                  : ""}
              </dd>
              <dt>Treffpunkt (fra vital)</dt>
              <dd>
                {fmtMm(hit.xMm)} mm side · {fmtMm(-hit.yMm)} mm høyde
                {" · "}
                {hit.kind}/{hit.zone}
              </dd>
              <dt>Siktepunkt (reticle)</dt>
              <dd>
                {fmtMm(adminDebug.aimMm.x)} · {fmtMm(-adminDebug.aimMm.y)} mm
                høyde
              </dd>
              <dt>POA (effektiv)</dt>
              <dd>
                {fmtMm(adminDebug.poaMm.x)} · {fmtMm(-adminDebug.poaMm.y)} mm
                høyde
              </dd>
              <dt>Avvik treff − sikte</dt>
              <dd>
                {fmtMm(dxMm)} · {fmtMm(dyUpMm)} mm
                {" · "}
                {fmtSigned(dxMrad, 2)}/{fmtSigned(dyMrad, 2)} mrad
              </dd>
              <dt>v₀</dt>
              <dd>
                {e.v0SampledMps.toFixed(1)} m/s (nom{" "}
                {e.v0NominalMps.toFixed(1)}
                {", "}
                Δ{fmtSigned(e.deltaV0Mps, 1, " m/s")})
              </dd>
              <dt>Drop / spinn</dt>
              <dd>
                drop {e.dropBelowLosMm.toFixed(1)} mm · spinn{" "}
                {fmtSigned(e.spinDriftMm, 1, " mm")}
              </dd>
              <dt>Vind</dt>
              <dd>
                tw {e.crosswindMs.toFixed(2)} m/s → drift{" "}
                {fmtSigned(e.windDriftMm, 1, " mm")}
                {" · "}
                {e.windSpeedMs.toFixed(1)} m/s fra {e.windFromDeg.toFixed(0)}°
                {" · skudd "}
                {e.shotBearingDeg.toFixed(0)}°
              </dd>
              <dt>Atmosfære</dt>
              <dd>
                ρ {e.densityRatio.toFixed(3)} · {e.temperatureC.toFixed(1)}°C
              </dd>
              <dt>Spredning</dt>
              <dd>
                envelope {e.envelopeMoa.toFixed(3)} MOA · mind×
                {e.mindDispersionScale.toFixed(2)} (fatigue{" "}
                {(e.mentalFatigue * 100).toFixed(0)}%)
                {" · angular "}
                {fmtSigned(e.angularScatterMoa.x, 3)}/
                {fmtSigned(e.angularScatterMoa.y, 3)} MOA
                {" → "}
                {fmtSigned(e.scatterMm.x, 1)}/
                {fmtSigned(e.scatterMm.y, 1)} mm
              </dd>
              <dt>Skytter</dt>
              <dd>
                wobble {fmtSigned(e.wobbleMm.x, 1)}/
                {fmtSigned(e.wobbleMm.y, 1)} mm · pull{" "}
                {(e.triggerPull * 100).toFixed(0)}% →{" "}
                {fmtSigned(e.triggerPullMm.x, 1)}/
                {fmtSigned(e.triggerPullMm.y, 1)} mm
                {" · calm "}
                {e.weaponCalm.toFixed(2)} · puls {e.heartRateBpm.toFixed(0)} ·
                body {(e.physicalFatigue * 100).toFixed(0)}%
              </dd>
              <dt>Zero / mount / cant</dt>
              <dd>
                zero {fmtSigned(e.zeroMm.x, 1)}/{fmtSigned(e.zeroMm.y, 1)} mm ·
                mount {fmtSigned(e.mountDriftMm.x, 1)}/
                {fmtSigned(e.mountDriftMm.y, 1)} mm · cant{" "}
                {fmtSigned(e.cantDeg, 2, "°")}
              </dd>
            </dl>
            <p className="admin-hunt-aar-legend">
              Cyan = siktepunkt · gul = POA · rødt hull = treffpunkt
            </p>
          </div>
        ) : (
          <p className="spot-binos-hint">
            {isHeadshot
              ? "Gul sone — headshot · instant kill"
              : isNeck
                ? "Oransje sone — nakke (flaks) · instant kill"
                : "Rød = vital · grønn = instant kill · rødt hull = treffpunkt"}
          </p>
        )}
        <button type="button" className="intro-button" onClick={onContinue}>
          {continueLabel}
        </button>
      </div>
    </div>
  );
}
