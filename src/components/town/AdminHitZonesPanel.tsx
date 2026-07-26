"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import {
  allBirdSpriteIds,
  getBirdSprite,
  type BirdSpriteId,
} from "@/lib/hunt/birdSprites";
import {
  catalogHitZone,
  clearAllBirdHitZoneOverrides,
  clearBirdHitZoneOverride,
  exportEffectiveHitZones,
  getBirdHitZone,
  getBirdHitZoneOverride,
  HIT_ZONE_BODY_OFFSET_MAX,
  HIT_ZONE_BODY_RX_MAX,
  HIT_ZONE_BODY_RX_MIN,
  HIT_ZONE_BODY_RY_MAX,
  HIT_ZONE_BODY_RY_MIN,
  HIT_ZONE_HEAD_MM_MAX,
  HIT_ZONE_HEAD_MM_MIN,
  HIT_ZONE_INSTANT_MM_MAX,
  HIT_ZONE_INSTANT_MM_MIN,
  HIT_ZONE_NECK_H_MAX,
  HIT_ZONE_NECK_H_MIN,
  HIT_ZONE_NECK_W_MAX,
  HIT_ZONE_NECK_W_MIN,
  HIT_ZONE_VITAL_MM_MAX,
  HIT_ZONE_VITAL_MM_MIN,
  setBirdHitZoneOverride,
  subscribeBirdHitZones,
} from "@/lib/hunt/birdHitZoneOverrides";
import {
  birdMmToNativePx,
  birdShotGeom,
  bodyEllipseFromVitalMm,
} from "@/lib/hunt/shoot";

const PREVIEW_SCALE = 3.2;

type AdminHitZonesPanelProps = {
  onLeave: () => void;
};

/** Admin: edit green/red/body hit zones per bird sprite. */
export function AdminHitZonesPanel({ onLeave }: AdminHitZonesPanelProps) {
  const spriteIds = useMemo(() => allBirdSpriteIds(), []);
  const [spriteId, setSpriteId] = useState<BirdSpriteId>(
    spriteIds[0] ?? "tiur-1",
  );
  const [epoch, setEpoch] = useState(0);
  const [cx, setCx] = useState(0);
  const [cy, setCy] = useState(0);
  const [instantMm, setInstantMm] = useState(66);
  const [vitalMm, setVitalMm] = useState(114);
  const [headCx, setHeadCx] = useState(0);
  const [headCy, setHeadCy] = useState(0);
  const [headMm, setHeadMm] = useState(42);
  const [neckCx, setNeckCx] = useState(0);
  const [neckCy, setNeckCy] = useState(0);
  const [neckW, setNeckW] = useState(28);
  const [neckH, setNeckH] = useState(36);
  const [neckRot, setNeckRot] = useState(0);
  const [bodyRx, setBodyRx] = useState(80);
  const [bodyRy, setBodyRy] = useState(154);
  const [bodyOx, setBodyOx] = useState(0);
  const [bodyOy, setBodyOy] = useState(19);
  const [bodyRot, setBodyRot] = useState(0);
  const [previewFlip, setPreviewFlip] = useState(false);
  const [clickMode, setClickMode] = useState<"vital" | "head" | "neck">(
    "vital",
  );
  const [bakeStatus, setBakeStatus] = useState<string | null>(null);
  const [baking, setBaking] = useState(false);

  useEffect(() => {
    return subscribeBirdHitZones(() => setEpoch((n) => n + 1));
  }, []);

  useEffect(() => {
    void epoch;
    const z = getBirdHitZone(spriteId);
    setCx(Math.round(z.vitalCxPx * 10) / 10);
    setCy(Math.round(z.vitalCyPx * 10) / 10);
    setInstantMm(z.instantDiameterMm);
    setVitalMm(z.vitalDiameterMm);
    setHeadCx(Math.round(z.headCxPx * 10) / 10);
    setHeadCy(Math.round(z.headCyPx * 10) / 10);
    setHeadMm(z.headDiameterMm);
    setNeckCx(Math.round(z.neckCxPx * 10) / 10);
    setNeckCy(Math.round(z.neckCyPx * 10) / 10);
    setNeckW(z.neckWidthMm);
    setNeckH(z.neckHeightMm);
    setNeckRot(z.neckRotationDeg);
    setBodyRx(z.bodyRxMm);
    setBodyRy(z.bodyRyMm);
    setBodyOx(z.bodyOffsetXMm);
    setBodyOy(z.bodyOffsetYMm);
    setBodyRot(z.bodyRotationDeg);
  }, [spriteId, epoch]);

  const sprite = getBirdSprite(spriteId);
  const geom = useMemo(() => {
    void epoch;
    return birdShotGeom(spriteId);
  }, [spriteId, epoch]);

  const hasOverride = !!getBirdHitZoneOverride(spriteId);
  const catalog = catalogHitZone(spriteId);

  /** Native px → % of preview box (survives max-width shrink on large sprites). */
  const pctX = (nativeX: number) => `${(nativeX / sprite.toppW) * 100}%`;
  const pctY = (nativeY: number) => `${(nativeY / sprite.toppH) * 100}%`;
  const pctW = (nativeW: number) => `${(nativeW / sprite.toppW) * 100}%`;
  const pctH = (nativeH: number) => `${(nativeH / sprite.toppH) * 100}%`;
  const mmNative = (mm: number) => birdMmToNativePx(mm, geom);

  /** When preview is mirrored, centres appear at mirrored X on the flipped image. */
  const zoneNx = previewFlip ? sprite.toppW - cx : cx;
  const zoneNy = cy;
  const headNx = previewFlip ? sprite.toppW - headCx : headCx;
  const headNy = headCy;
  const neckNx = previewFlip ? sprite.toppW - neckCx : neckCx;
  const neckNy = neckCy;
  const neckDispRot = previewFlip ? -neckRot : neckRot;

  const draftGeom = {
    ...geom,
    bodyRxMm: bodyRx,
    bodyRyMm: bodyRy,
    bodyOffsetXMm: bodyOx,
    bodyOffsetYMm: bodyOy,
    bodyRotationDeg: bodyRot,
  };
  const body = bodyEllipseFromVitalMm(draftGeom, previewFlip);
  const bodyNx = zoneNx + mmNative(body.offsetXMm);
  const bodyNy = zoneNy + mmNative(body.offsetYMm);

  function currentZone() {
    return {
      vitalCxPx: cx,
      vitalCyPx: cy,
      instantDiameterMm: instantMm,
      vitalDiameterMm: vitalMm,
      headCxPx: headCx,
      headCyPx: headCy,
      headDiameterMm: headMm,
      neckCxPx: neckCx,
      neckCyPx: neckCy,
      neckWidthMm: neckW,
      neckHeightMm: neckH,
      neckRotationDeg: neckRot,
      bodyRxMm: bodyRx,
      bodyRyMm: bodyRy,
      bodyOffsetXMm: bodyOx,
      bodyOffsetYMm: bodyOy,
      bodyRotationDeg: bodyRot,
    };
  }

  function save() {
    setBirdHitZoneOverride(spriteId, currentZone());
    setBakeStatus(
      "Lagret lokalt. Bruk «Skriv til repo» for å gjøre det til default for alle.",
    );
  }

  function reset() {
    clearBirdHitZoneOverride(spriteId);
    const z = catalogHitZone(spriteId);
    setCx(Math.round(z.vitalCxPx * 10) / 10);
    setCy(Math.round(z.vitalCyPx * 10) / 10);
    setInstantMm(z.instantDiameterMm);
    setVitalMm(z.vitalDiameterMm);
    setHeadCx(Math.round(z.headCxPx * 10) / 10);
    setHeadCy(Math.round(z.headCyPx * 10) / 10);
    setHeadMm(z.headDiameterMm);
    setNeckCx(Math.round(z.neckCxPx * 10) / 10);
    setNeckCy(Math.round(z.neckCyPx * 10) / 10);
    setNeckW(z.neckWidthMm);
    setNeckH(z.neckHeightMm);
    setNeckRot(z.neckRotationDeg);
    setBodyRx(z.bodyRxMm);
    setBodyRy(z.bodyRyMm);
    setBodyOx(z.bodyOffsetXMm);
    setBodyOy(z.bodyOffsetYMm);
    setBodyRot(z.bodyRotationDeg);
    setBakeStatus(null);
  }

  async function bakeToRepo() {
    setBirdHitZoneOverride(spriteId, currentZone());
    const payload = exportEffectiveHitZones();
    setBaking(true);
    setBakeStatus("Skriver katalog…");
    try {
      const res = await fetch("/api/admin/hit-zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        sprites?: number;
        path?: string;
      };
      if (!res.ok || !data.ok) {
        setBakeStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      setBakeStatus(
        `Skrevet ${data.sprites} sprites → ${data.path}. Commit + push for GitHub.`,
      );
      clearAllBirdHitZoneOverrides();
      setEpoch((n) => n + 1);
    } catch (err) {
      setBakeStatus(
        err instanceof Error ? err.message : "Klarte ikke å skrive filen.",
      );
    } finally {
      setBaking(false);
    }
  }

  async function copyJson() {
    setBirdHitZoneOverride(spriteId, currentZone());
    const payload = exportEffectiveHitZones();
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setBakeStatus("JSON kopiert til utklippstavlen.");
    } catch {
      setBakeStatus("Klarte ikke å kopiere — sjekk nettleser-tillatelser.");
    }
  }

  function onPreviewClick(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * sprite.toppW;
    const y = ((e.clientY - rect.top) / rect.height) * sprite.toppH;
    if (previewFlip) x = sprite.toppW - x;
    const nx = Math.round(x * 10) / 10;
    const ny = Math.round(y * 10) / 10;
    if (clickMode === "head") {
      setHeadCx(nx);
      setHeadCy(ny);
    } else if (clickMode === "neck") {
      setNeckCx(nx);
      setNeckCy(ny);
    } else {
      setCx(nx);
      setCy(ny);
    }
  }

  return (
    <div className="admin-hit-zones">
      <p className="intro-line intro-gift">Treffområde</p>
      <p className="intro-line">
        Gul = headshot (instant). Oransje = nakke (flaks-instant — ikke siktemål).
        Grønn = bryst (instant). Rød = vital (kort ettersøk). Blå ellipse = kropp
        (langt ettersøk). Utenfor = bom.
      </p>

      <div className="admin-spot-controls">
        <div className="admin-spot-row">
          <label className="admin-spot-field admin-spot-field-wide">
            <span>Sprite</span>
            <select
              value={spriteId}
              onChange={(e) => setSpriteId(e.target.value as BirdSpriteId)}
            >
              {spriteIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-spot-field admin-spot-scale">
            <span>Cx px</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              step={0.5}
              value={cx}
              onChange={(e) => setCx(Number(e.target.value))}
            />
          </label>
          <label className="admin-spot-field admin-spot-scale">
            <span>Cy px</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              step={0.5}
              value={cy}
              onChange={(e) => setCy(Number(e.target.value))}
            />
          </label>
          <label className="admin-spot-field admin-spot-scale">
            <span>Grønn Ø mm</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              min={HIT_ZONE_INSTANT_MM_MIN}
              max={HIT_ZONE_INSTANT_MM_MAX}
              step={1}
              value={instantMm}
              onChange={(e) => setInstantMm(Number(e.target.value))}
            />
          </label>
          <label className="admin-spot-field admin-spot-scale">
            <span>Rød Ø mm</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              min={HIT_ZONE_VITAL_MM_MIN}
              max={HIT_ZONE_VITAL_MM_MAX}
              step={1}
              value={vitalMm}
              onChange={(e) => setVitalMm(Number(e.target.value))}
            />
          </label>
          <label className="admin-spot-field admin-spot-scale">
            <span>Gul Ø mm</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              min={HIT_ZONE_HEAD_MM_MIN}
              max={HIT_ZONE_HEAD_MM_MAX}
              step={1}
              value={headMm}
              onChange={(e) => setHeadMm(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className={
              clickMode === "vital"
                ? "intro-button admin-spot-btn is-selected"
                : "intro-button admin-spot-btn"
            }
            onClick={() => setClickMode("vital")}
          >
            Klikk: vital
          </button>
          <button
            type="button"
            className={
              clickMode === "head"
                ? "intro-button admin-spot-btn is-selected"
                : "intro-button admin-spot-btn"
            }
            onClick={() => setClickMode("head")}
          >
            Klikk: hode
          </button>
          <button
            type="button"
            className={
              clickMode === "neck"
                ? "intro-button admin-spot-btn is-selected"
                : "intro-button admin-spot-btn"
            }
            onClick={() => setClickMode("neck")}
          >
            Klikk: nakke
          </button>
        </div>

        <div className="admin-spot-row">
          <label className="admin-spot-field admin-spot-scale">
            <span>Nakke B mm</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              min={HIT_ZONE_NECK_W_MIN}
              max={HIT_ZONE_NECK_W_MAX}
              step={1}
              value={neckW}
              onChange={(e) => setNeckW(Number(e.target.value))}
            />
          </label>
          <label className="admin-spot-field admin-spot-scale">
            <span>Nakke H mm</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              min={HIT_ZONE_NECK_H_MIN}
              max={HIT_ZONE_NECK_H_MAX}
              step={1}
              value={neckH}
              onChange={(e) => setNeckH(Number(e.target.value))}
            />
          </label>
          <label className="admin-spot-field admin-spot-scale">
            <span>Nakke Cx</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              step={0.5}
              value={neckCx}
              onChange={(e) => setNeckCx(Number(e.target.value))}
            />
          </label>
          <label className="admin-spot-field admin-spot-scale">
            <span>Nakke Cy</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              step={0.5}
              value={neckCy}
              onChange={(e) => setNeckCy(Number(e.target.value))}
            />
          </label>
          <label className="admin-spot-field admin-spot-scale">
            <span>Nakke °</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              min={-180}
              max={180}
              step={1}
              value={neckRot > 180 ? neckRot - 360 : neckRot}
              onChange={(e) => setNeckRot(Number(e.target.value))}
            />
          </label>
        </div>

        <div className="admin-spot-row">
          <label className="admin-spot-field admin-spot-scale">
            <span>Kropp rx mm</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              min={HIT_ZONE_BODY_RX_MIN}
              max={HIT_ZONE_BODY_RX_MAX}
              step={1}
              value={bodyRx}
              onChange={(e) => setBodyRx(Number(e.target.value))}
            />
          </label>
          <label className="admin-spot-field admin-spot-scale">
            <span>Kropp ry mm</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              min={HIT_ZONE_BODY_RY_MIN}
              max={HIT_ZONE_BODY_RY_MAX}
              step={1}
              value={bodyRy}
              onChange={(e) => setBodyRy(Number(e.target.value))}
            />
          </label>
          <label className="admin-spot-field admin-spot-scale">
            <span>Offset X</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              min={-HIT_ZONE_BODY_OFFSET_MAX}
              max={HIT_ZONE_BODY_OFFSET_MAX}
              step={1}
              value={bodyOx}
              onChange={(e) => setBodyOx(Number(e.target.value))}
            />
          </label>
          <label className="admin-spot-field admin-spot-scale">
            <span>Offset Y</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              min={-HIT_ZONE_BODY_OFFSET_MAX}
              max={HIT_ZONE_BODY_OFFSET_MAX}
              step={1}
              value={bodyOy}
              onChange={(e) => setBodyOy(Number(e.target.value))}
            />
          </label>
          <label className="admin-spot-field admin-spot-scale">
            <span>Rot °</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              min={-180}
              max={180}
              step={1}
              value={bodyRot > 180 ? bodyRot - 360 : bodyRot}
              onChange={(e) => setBodyRot(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className={
              previewFlip
                ? "intro-button admin-spot-btn is-selected"
                : "intro-button admin-spot-btn"
            }
            onClick={() => setPreviewFlip((v) => !v)}
          >
            {previewFlip ? "Speil: på" : "Speil: av"}
          </button>
        </div>

        <div className="admin-spot-row">
          <button
            type="button"
            className="intro-button admin-spot-btn"
            onClick={save}
          >
            Lagre lokalt
          </button>
          <button
            type="button"
            className="intro-button admin-spot-btn"
            disabled={!hasOverride}
            onClick={reset}
          >
            Reset
          </button>
          <button
            type="button"
            className="intro-button admin-spot-btn"
            disabled={baking}
            onClick={() => void bakeToRepo()}
          >
            Skriv til repo (dev)
          </button>
          <button
            type="button"
            className="intro-button admin-spot-btn"
            onClick={() => void copyJson()}
          >
            Kopier JSON
          </button>
        </div>

        <p className="admin-spot-meta">
          Katalog: ({catalog.vitalCxPx.toFixed(1)}, {catalog.vitalCyPx.toFixed(1)})
          · grønn Ø{catalog.instantDiameterMm} / rød Ø{catalog.vitalDiameterMm}
          · gul Ø{catalog.headDiameterMm} @ ({catalog.headCxPx.toFixed(1)},{" "}
          {catalog.headCyPx.toFixed(1)}) · nakke {catalog.neckWidthMm}×
          {catalog.neckHeightMm} @ ({catalog.neckCxPx.toFixed(1)},{" "}
          {catalog.neckCyPx.toFixed(1)}) · kropp {catalog.bodyRxMm}×
          {catalog.bodyRyMm} @ {catalog.bodyRotationDeg}°
          {hasOverride ? " · lokal override aktiv" : " · katalog"}
        </p>
        {bakeStatus ? (
          <p className="admin-spot-meta">{bakeStatus}</p>
        ) : null}
      </div>

      <div
        className="admin-hit-preview"
        role="button"
        tabIndex={0}
        onClick={onPreviewClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
          }
        }}
        aria-label={
          clickMode === "head"
            ? "Klikk for å sette headshot-senter"
            : clickMode === "neck"
              ? "Klikk for å sette nakke-senter"
              : "Klikk for å sette vital-senter"
        }
        style={{
          width: sprite.toppW * PREVIEW_SCALE,
          maxWidth: "100%",
          aspectRatio: `${sprite.toppW} / ${sprite.toppH}`,
          height: "auto",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sprite.toppSrc}
          alt={spriteId}
          width={sprite.toppW}
          height={sprite.toppH}
          draggable={false}
          className="admin-hit-preview-bird"
          style={previewFlip ? { transform: "scaleX(-1)" } : undefined}
        />
        <span
          className="admin-hit-body"
          style={{
            width: pctW(mmNative(body.rxMm * 2)),
            height: pctH(mmNative(body.ryMm * 2)),
            left: pctX(bodyNx),
            top: pctY(bodyNy),
            transform: `translate(-50%, -50%) rotate(${body.rotationDeg}deg)`,
          }}
          title="Kropp — utenfor = bom"
          aria-hidden
        />
        <span
          className="admin-hit-neck"
          style={{
            width: pctW(mmNative(neckW)),
            height: pctH(mmNative(neckH)),
            left: pctX(neckNx),
            top: pctY(neckNy),
            transform: `translate(-50%, -50%) rotate(${neckDispRot}deg)`,
          }}
          title="Nakke — flaks-instant (ikke siktemål)"
          aria-hidden
        />
        <span
          className="triggercam-zone triggercam-zone--vital"
          style={{
            width: pctW(mmNative(vitalMm)),
            height: pctH(mmNative(vitalMm)),
            left: pctX(zoneNx),
            top: pctY(zoneNy),
            transform: "translate(-50%, -50%)",
          }}
        />
        <span
          className="triggercam-zone triggercam-zone--instant"
          style={{
            width: pctW(mmNative(instantMm)),
            height: pctH(mmNative(instantMm)),
            left: pctX(zoneNx),
            top: pctY(zoneNy),
            transform: "translate(-50%, -50%)",
          }}
        />
        <span
          className="triggercam-zone triggercam-zone--head"
          style={{
            width: pctW(mmNative(headMm)),
            height: pctH(mmNative(headMm)),
            left: pctX(headNx),
            top: pctY(headNy),
            transform: "translate(-50%, -50%)",
          }}
          title="Headshot — instant kill"
        />
        <span
          className="admin-hit-cross"
          style={{ left: pctX(zoneNx), top: pctY(zoneNy) }}
          aria-hidden
        />
        <span
          className="admin-hit-cross admin-hit-cross--head"
          style={{ left: pctX(headNx), top: pctY(headNy) }}
          aria-hidden
        />
        <span
          className="admin-hit-cross admin-hit-cross--neck"
          style={{ left: pctX(neckNx), top: pctY(neckNy) }}
          aria-hidden
        />
      </div>

      <p className="admin-spot-meta">
        Kropp: {Math.round(body.rxMm * 2)}×{Math.round(body.ryMm * 2)} mm · rot{" "}
        {Math.round(body.rotationDeg)}° · nakke {neckW}×{neckH} mm @{" "}
        {Math.round(neckDispRot)}°
        {previewFlip ? " (speilet)" : ""}
      </p>

      <button type="button" className="intro-button" onClick={onLeave}>
        ← Tilbake til byen
      </button>
    </div>
  );
}
