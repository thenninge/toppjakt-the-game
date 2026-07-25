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
  HIT_ZONE_INSTANT_MM_MAX,
  HIT_ZONE_INSTANT_MM_MIN,
  HIT_ZONE_VITAL_MM_MAX,
  HIT_ZONE_VITAL_MM_MIN,
  setBirdHitZoneOverride,
  subscribeBirdHitZones,
} from "@/lib/hunt/birdHitZoneOverrides";
import {
  birdMmToNativePx,
  birdShotGeom,
} from "@/lib/hunt/shoot";

const PREVIEW_SCALE = 3.2;

type AdminHitZonesPanelProps = {
  onLeave: () => void;
};

/** Admin: edit green/red hit zones per bird sprite. */
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
  }, [spriteId, epoch]);

  const sprite = getBirdSprite(spriteId);
  const geom = useMemo(() => {
    void epoch;
    return birdShotGeom(spriteId);
  }, [spriteId, epoch]);

  const hasOverride = !!getBirdHitZoneOverride(spriteId);
  const catalog = catalogHitZone(spriteId);

  const mmToPx = (mm: number) => birdMmToNativePx(mm, geom) * PREVIEW_SCALE;
  const greenD = mmToPx(instantMm);
  const redD = mmToPx(vitalMm);
  const zoneCx = cx * PREVIEW_SCALE;
  const zoneCy = cy * PREVIEW_SCALE;

  function save() {
    setBirdHitZoneOverride(spriteId, {
      vitalCxPx: cx,
      vitalCyPx: cy,
      instantDiameterMm: instantMm,
      vitalDiameterMm: vitalMm,
    });
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
    setBakeStatus(null);
  }

  async function bakeToRepo() {
    // Persist current editor values first so bake includes this sprite.
    setBirdHitZoneOverride(spriteId, {
      vitalCxPx: cx,
      vitalCyPx: cy,
      instantDiameterMm: instantMm,
      vitalDiameterMm: vitalMm,
    });
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
    setBirdHitZoneOverride(spriteId, {
      vitalCxPx: cx,
      vitalCyPx: cy,
      instantDiameterMm: instantMm,
      vitalDiameterMm: vitalMm,
    });
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
    const x = ((e.clientX - rect.left) / rect.width) * sprite.toppW;
    const y = ((e.clientY - rect.top) / rect.height) * sprite.toppH;
    setCx(Math.round(x * 10) / 10);
    setCy(Math.round(y * 10) / 10);
  }

  return (
    <div className="admin-hit-zones">
      <p className="intro-line intro-gift">Treffområde</p>
      <p className="intro-line">
        Klikk på bildet for vital-senter. Grønn = instant, rød = vital.{" "}
        <strong>Lagre</strong> = kun denne nettleseren.{" "}
        <strong>Skriv til repo</strong> = committed default for alle spillere.
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
        aria-label="Klikk for å sette vital-senter"
        style={{
          width: sprite.toppW * PREVIEW_SCALE,
          height: sprite.toppH * PREVIEW_SCALE,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sprite.toppSrc}
          alt={spriteId}
          width={sprite.toppW * PREVIEW_SCALE}
          height={sprite.toppH * PREVIEW_SCALE}
          draggable={false}
          className="admin-hit-preview-bird"
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
          className="admin-hit-cross"
          style={{ left: zoneCx, top: zoneCy }}
          aria-hidden
        />
      </div>

      <button type="button" className="intro-button" onClick={onLeave}>
        ← Tilbake til byen
      </button>
    </div>
  );
}
