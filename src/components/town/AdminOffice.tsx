"use client";

import { useEffect, useMemo, useState } from "react";
import { SpotView } from "@/components/hunt/SpotView";
import type { BirdObservedInfo } from "@/components/hunt/SpotView";
import { AdminHitZonesPanel } from "@/components/town/AdminHitZonesPanel";
import { AdminJaktfeltPanel } from "@/components/town/AdminJaktfeltPanel";
import { AdminSceneCreationPanel } from "@/components/town/AdminSceneCreationPanel";
import { AdminRealismControlsPanel } from "@/components/town/AdminRealismControlsPanel";
import { AdminScopeTestPanel } from "@/components/town/AdminScopeTestPanel";
import { adminPlacementsForSpotImage } from "@/lib/hunt/birds";
import {
  BIRD_SPRITE_SCALE_DEFAULT,
  BIRD_SPRITE_SCALE_MAX,
  BIRD_SPRITE_SCALE_MIN,
  applyBakedBirdSpriteScales,
  exportEffectiveBirdSpriteScales,
  getBirdSpriteScalePercent,
  isBirdSpriteSpeciesScaleDirty,
  setBirdSpriteScalePercent,
  subscribeBirdSpriteScales,
} from "@/lib/hunt/birdSpriteScale";
import { spriteIdsForSpecies, type BirdSpriteId } from "@/lib/hunt/birdSprites";
import {
  isBirdSpriteAllowedInScene,
  setBirdSpriteAllowedInScene,
  subscribeBirdSpriteSceneAllow,
} from "@/lib/hunt/birdSpriteSceneAllow";
import {
  clearPerchDistanceOverride,
  getPerchDistanceOverride,
  PERCH_DISTANCE_EDIT_MAX_M,
  PERCH_DISTANCE_EDIT_MIN_M,
  PERCH_SCALE_DEFAULT,
  PERCH_SCALE_MAX,
  PERCH_SCALE_MIN,
  setPerchDistanceOverride,
  subscribePerchDistanceOverrides,
} from "@/lib/hunt/perchDistanceOverrides";
import {
  catalogPerchForId,
  perchesForSpotImage,
  spotImagesWithPerches,
} from "@/lib/hunt/spotPerches";
import { spotColorBandFromBracket } from "@/lib/hunt/spotBands";
import { getCatalogByCategory } from "@/lib/shop/catalog";
import {
  isLrfItem,
  isThermalItem,
} from "@/lib/shop/types";
import { lrfOpticalMagnification } from "@/lib/optics/spec";

type AdminOfficeProps = {
  onLeave: () => void;
};

type AdminTab =
  | "spotting"
  | "scenes"
  | "jaktfelt"
  | "treff"
  | "scopes"
  | "realism";

function spotLabel(src: string): string {
  const base = src.split("/").pop() ?? src;
  return base.replace(/\.(png|jpe?g|webp)$/i, "");
}

const TIUR_SPRITES = spriteIdsForSpecies("tiur");
const ORRE_SPRITES = spriteIdsForSpecies("orrhane");
const ADMIN_BATTERY_SEC = 60 * 60;

function SpriteScaleField({
  spriteId,
}: {
  spriteId: BirdSpriteId;
}) {
  const [scale, setScale] = useState(() =>
    getBirdSpriteScalePercent(spriteId),
  );

  useEffect(() => {
    setScale(getBirdSpriteScalePercent(spriteId));
    return subscribeBirdSpriteScales(() => {
      setScale(getBirdSpriteScalePercent(spriteId));
    });
  }, [spriteId]);

  function commit(raw: number) {
    const next = setBirdSpriteScalePercent(spriteId, raw);
    setScale(next);
  }

  return (
    <label className="admin-spot-field admin-spot-scale">
      <span>Scale %</span>
      <input
        type="number"
        className="admin-spot-scale-num"
        min={BIRD_SPRITE_SCALE_MIN}
        max={BIRD_SPRITE_SCALE_MAX}
        step={1}
        value={scale}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          commit(n);
        }}
        aria-label="Sprite scale prosent"
      />
    </label>
  );
}

function UseInSceneField({
  spotImageSrc,
  spriteId,
}: {
  spotImageSrc: string;
  spriteId: BirdSpriteId;
}) {
  const [allowed, setAllowed] = useState(() =>
    isBirdSpriteAllowedInScene(spotImageSrc, spriteId),
  );

  useEffect(() => {
    setAllowed(isBirdSpriteAllowedInScene(spotImageSrc, spriteId));
    return subscribeBirdSpriteSceneAllow(() => {
      setAllowed(isBirdSpriteAllowedInScene(spotImageSrc, spriteId));
    });
  }, [spotImageSrc, spriteId]);

  return (
    <label className="admin-spot-field admin-spot-allow">
      <span>Use in scene</span>
      <span className="admin-spot-allow-row">
        <input
          type="checkbox"
          checked={allowed}
          disabled={!spotImageSrc}
          onChange={(e) => {
            const next = e.target.checked;
            setBirdSpriteAllowedInScene(spotImageSrc, spriteId, next);
            setAllowed(next);
          }}
          aria-label="Use bird sprite in this spotting scene"
        />
        <span className="admin-spot-allow-hint">
          {allowed ? "i pool" : "utelatt"}
        </span>
      </span>
    </label>
  );
}

function SpriteScaleBakeButton({
  species,
}: {
  species: "tiur" | "orrhane";
}) {
  const [dirty, setDirty] = useState(() =>
    isBirdSpriteSpeciesScaleDirty(species),
  );
  const [baking, setBaking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setDirty(isBirdSpriteSpeciesScaleDirty(species));
    sync();
    return subscribeBirdSpriteScales(sync);
  }, [species]);

  async function bakeToRepo() {
    const all = exportEffectiveBirdSpriteScales();
    const ids = spriteIdsForSpecies(species);
    const scales = Object.fromEntries(
      ids.map((id) => [id, all[id] ?? getBirdSpriteScalePercent(id)]),
    );
    setBaking(true);
    setStatus("Skriver…");
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
        path?: string;
        scales?: Record<string, number>;
      };
      if (!res.ok || !data.ok) {
        setStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      applyBakedBirdSpriteScales(
        (data.scales ?? scales) as Partial<Record<BirdSpriteId, number>>,
      );
      setDirty(false);
      setStatus(
        `OK ${data.sprites} → repo. Commit + push.`,
      );
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Klarte ikke å skrive filen.",
      );
    } finally {
      setBaking(false);
    }
  }

  return (
    <div className="admin-spot-field admin-spot-bake">
      <span>Scale → repo</span>
      <button
        type="button"
        className="intro-button admin-spot-btn"
        disabled={!dirty || baking}
        onClick={() => void bakeToRepo()}
        title={
          dirty
            ? `Skriv ${species}-scale til birdSpriteScaleCatalog.ts`
            : "Ingen lokale scale-endringer for denne arten"
        }
      >
        {baking ? "Skriver…" : "Lagre til repo"}
      </button>
      {status ? <span className="admin-spot-allow-hint">{status}</span> : null}
    </div>
  );
}

/** Admin calibration desk — free optics + full perch fill for spotting QA. */
export function AdminOffice({ onLeave }: AdminOfficeProps) {
  const [tab, setTab] = useState<AdminTab>("spotting");

  if (tab === "scopes") {
    return (
      <div className="admin-office-shell">
        <AdminTabBar tab={tab} onTab={setTab} onLeave={onLeave} />
        <AdminScopeTestPanel onLeave={onLeave} />
      </div>
    );
  }

  if (tab === "realism") {
    return (
      <div className="admin-office-shell">
        <AdminTabBar tab={tab} onTab={setTab} onLeave={onLeave} />
        <AdminRealismControlsPanel onLeave={onLeave} />
      </div>
    );
  }

  if (tab === "jaktfelt") {
    return (
      <div className="admin-office-shell">
        <AdminTabBar tab={tab} onTab={setTab} onLeave={onLeave} />
        <AdminJaktfeltPanel onLeave={onLeave} />
      </div>
    );
  }

  if (tab === "treff") {
    return (
      <div className="admin-office-shell">
        <AdminTabBar tab={tab} onTab={setTab} onLeave={onLeave} />
        <AdminHitZonesPanel onLeave={onLeave} />
      </div>
    );
  }

  if (tab === "scenes") {
    return (
      <div className="admin-office-shell">
        <AdminTabBar tab={tab} onTab={setTab} onLeave={onLeave} />
        <AdminSceneCreationPanel onLeave={onLeave} />
      </div>
    );
  }

  return (
    <div className="admin-office-shell">
      <AdminTabBar tab={tab} onTab={setTab} onLeave={onLeave} />
      <AdminSpottingPanel onLeave={onLeave} />
    </div>
  );
}

function AdminTabBar({
  tab,
  onTab,
  onLeave,
}: {
  tab: AdminTab;
  onTab: (t: AdminTab) => void;
  onLeave: () => void;
}) {
  return (
    <div className="admin-tabs" role="tablist" aria-label="Admin">
      <button
        type="button"
        role="tab"
        aria-selected={tab === "spotting"}
        className={
          tab === "spotting"
            ? "intro-button admin-tab is-active"
            : "intro-button admin-tab"
        }
        onClick={() => onTab("spotting")}
      >
        Spotting
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "scenes"}
        className={
          tab === "scenes"
            ? "intro-button admin-tab is-active"
            : "intro-button admin-tab"
        }
        onClick={() => onTab("scenes")}
      >
        Scene creation
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "jaktfelt"}
        className={
          tab === "jaktfelt"
            ? "intro-button admin-tab is-active"
            : "intro-button admin-tab"
        }
        onClick={() => onTab("jaktfelt")}
      >
        Jaktfelt
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "treff"}
        className={
          tab === "treff"
            ? "intro-button admin-tab is-active"
            : "intro-button admin-tab"
        }
        onClick={() => onTab("treff")}
      >
        Treffområde
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "scopes"}
        className={
          tab === "scopes"
            ? "intro-button admin-tab is-active"
            : "intro-button admin-tab"
        }
        onClick={() => onTab("scopes")}
      >
        Scopes
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={tab === "realism"}
        className={
          tab === "realism"
            ? "intro-button admin-tab is-active"
            : "intro-button admin-tab"
        }
        onClick={() => onTab("realism")}
      >
        Realism controls
      </button>
      <button
        type="button"
        className="intro-button admin-tab admin-tab-leave"
        onClick={onLeave}
      >
        ← Byen
      </button>
    </div>
  );
}

function AdminSpottingPanel({ onLeave }: { onLeave: () => void }) {
  const spotImages = useMemo(() => spotImagesWithPerches().sort(), []);
  const lrfItems = useMemo(
    () => getCatalogByCategory("lrf").filter(isLrfItem),
    [],
  );
  const thermalItems = useMemo(
    () => getCatalogByCategory("thermal").filter(isThermalItem),
    [],
  );

  const [imageSrc, setImageSrc] = useState(spotImages[0] ?? "");
  const [tiurSpriteId, setTiurSpriteId] = useState<BirdSpriteId>(
    TIUR_SPRITES[0] ?? "tiur-1",
  );
  const [orreSpriteId, setOrreSpriteId] = useState<BirdSpriteId>(
    ORRE_SPRITES[0] ?? "orre-1",
  );
  const [binoId, setBinoId] = useState(lrfItems[0]?.id ?? "");
  const [thermalId, setThermalId] = useState(thermalItems[0]?.id ?? "");
  const [scaleEpoch, setScaleEpoch] = useState(0);
  const [distEpoch, setDistEpoch] = useState(0);
  const [selectedPerchId, setSelectedPerchId] = useState<string | null>(null);
  const [editMinM, setEditMinM] = useState(200);
  const [editMaxM, setEditMaxM] = useState(300);
  const [editEyesVisible, setEditEyesVisible] = useState(true);
  const [editPerchScale, setEditPerchScale] = useState(PERCH_SCALE_DEFAULT);
  const [lrfHintM, setLrfHintM] = useState<number | null>(null);

  useEffect(() => {
    return subscribeBirdSpriteScales(() => {
      setScaleEpoch((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    return subscribePerchDistanceOverrides(() => {
      setDistEpoch((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    setSelectedPerchId(null);
    setLrfHintM(null);
  }, [imageSrc]);

  const scenePerches = useMemo(() => {
    void distEpoch;
    if (!imageSrc) return [];
    return perchesForSpotImage(imageSrc);
  }, [imageSrc, distEpoch]);

  useEffect(() => {
    if (!selectedPerchId) return;
    const live = scenePerches.find((p) => p.id === selectedPerchId);
    if (!live) {
      setSelectedPerchId(null);
      return;
    }
    setEditMinM(live.distanceMinM);
    setEditMaxM(live.distanceMaxM);
    setEditEyesVisible(live.eyesVisible !== false);
    setEditPerchScale(live.scalePercent ?? PERCH_SCALE_DEFAULT);
  }, [selectedPerchId, scenePerches]);

  const birdPlacements = useMemo(() => {
    void scaleEpoch;
    void distEpoch;
    if (!imageSrc) return [];
    return adminPlacementsForSpotImage(imageSrc, {
      speciesMode: "both",
      tiurSpriteId,
      orreSpriteId,
    });
  }, [imageSrc, tiurSpriteId, orreSpriteId, scaleEpoch, distEpoch]);

  function selectPerchFromBird(info: BirdObservedInfo) {
    const id = info.placement.perchId;
    if (!id) return;
    setSelectedPerchId(id);
    setLrfHintM(info.measuredDistanceM);
  }

  const catalogSelected = selectedPerchId
    ? catalogPerchForId(imageSrc, selectedPerchId)
    : null;
  const hasOverride =
    !!selectedPerchId &&
    !!getPerchDistanceOverride(imageSrc, selectedPerchId);

  function savePerchDistance(next?: {
    eyesVisible?: boolean;
    scalePercent?: number;
    minM?: number;
    maxM?: number;
  }) {
    if (!selectedPerchId) return;
    const eyes = next?.eyesVisible ?? editEyesVisible;
    const scale = next?.scalePercent ?? editPerchScale;
    const minM = next?.minM ?? editMinM;
    const maxM = next?.maxM ?? editMaxM;
    setPerchDistanceOverride(
      imageSrc,
      selectedPerchId,
      minM,
      maxM,
      eyes,
      scale,
    );
  }

  function onEyesVisibleChange(checked: boolean) {
    setEditEyesVisible(checked);
    savePerchDistance({ eyesVisible: checked });
  }

  function resetPerchDistance() {
    if (!selectedPerchId) return;
    clearPerchDistanceOverride(imageSrc, selectedPerchId);
    const cat = catalogPerchForId(imageSrc, selectedPerchId);
    if (cat) {
      setEditMinM(cat.distanceMinM);
      setEditMaxM(cat.distanceMaxM);
      setEditEyesVisible(cat.eyesVisible !== false);
      setEditPerchScale(cat.scalePercent ?? PERCH_SCALE_DEFAULT);
    }
  }

  const selectedLive = selectedPerchId
    ? (scenePerches.find((p) => p.id === selectedPerchId) ?? null)
    : null;
  const editBand = spotColorBandFromBracket(editMinM, editMaxM);

  const binoItem = useMemo(
    () => lrfItems.find((i) => i.id === binoId) ?? null,
    [lrfItems, binoId],
  );
  const thermalItem = useMemo(
    () => thermalItems.find((i) => i.id === thermalId) ?? null,
    [thermalItems, thermalId],
  );

  const isHabrok = !!thermalItem?.thermal.isThermalBinocular;
  const hasBinos = !!binoItem || isHabrok;
  const hasThermal = !!thermalItem;
  const binosLabel = binoItem
    ? `${binoItem.brand} ${binoItem.name}`
    : isHabrok && thermalItem
      ? `${thermalItem.brand} ${thermalItem.name}`
      : null;
  const thermalLabel = thermalItem
    ? `${thermalItem.brand} ${thermalItem.name}`
    : null;
  const binosMagnification = binoItem
    ? lrfOpticalMagnification(binoItem)
    : isHabrok
      ? (thermalItem?.thermal.magnification ?? 10)
      : 1;
  const lrfSpec = binoItem
    ? {
        ...binoItem.lrf,
        id: binoItem.id,
        brand: binoItem.brand,
      }
    : isHabrok && thermalItem?.thermal.hasIntegratedLrf
      ? {
          rangeErrorPercent: thermalItem.thermal.rangeErrorPercent ?? 2,
          hasOnboardBallistics: true,
          id: thermalItem.id,
          brand: thermalItem.brand,
        }
      : null;
  const thermalLrfSpec = thermalItem?.thermal.hasIntegratedLrf
    ? {
        rangeErrorPercent: thermalItem.thermal.rangeErrorPercent ?? 2,
      }
    : null;

  if (!imageSrc) {
    return (
      <div className="admin-office">
        <p className="intro-line">Ingen spottingbilder med perch.</p>
        <button type="button" className="intro-button" onClick={onLeave}>
          ← Tilbake til byen
        </button>
      </div>
    );
  }

  return (
    <SpotView
      imageSrc={imageSrc}
      birdPlacements={birdPlacements}
      viewBearingDeg={0}
      magnification={binosMagnification}
      lrfSpec={lrfSpec}
      thermalMagnification={thermalItem?.thermal.magnification ?? 3}
      thermalPixelFactor={thermalItem?.thermal.pixelFactor ?? 10}
      thermalTimeFactor={thermalItem?.thermal.timeFactor ?? 1}
      thermalLrfSpec={thermalLrfSpec}
      isThermalBinocular={isHabrok}
      thermalMinZoom={thermalItem?.thermal.minZoom ?? 5}
      thermalMaxZoom={thermalItem?.thermal.maxZoom ?? 22}
      hasThermalOutline={!!thermalItem?.thermal.hasOutlineMode}
      hasThermalFusion={!!thermalItem?.thermal.hasFusionMode}
      binosPriceNok={
        binoItem?.priceNok ?? (isHabrok ? thermalItem?.priceNok ?? 0 : 0)
      }
      binosAperturePercent={binoItem?.lrf.aperturePercent ?? null}
      thermalPriceNok={thermalItem?.priceNok ?? 0}
      clockMinutes={8 * 60}
      hasBinos={hasBinos}
      hasThermal={hasThermal}
      hasLrf={!!lrfSpec || !!thermalLrfSpec}
      hasKestrel={false}
      binosLabel={binosLabel}
      thermalLabel={thermalLabel}
      thermalBatteryGameSec={ADMIN_BATTERY_SEC}
      thermalBatteryMaxGameSec={ADMIN_BATTERY_SEC}
      onThermalBatteryDrain={() => ADMIN_BATTERY_SEC}
      onGameSeconds={() => {}}
      solveLrfHold={() => null}
      onBirdObserved={selectPerchFromBird}
      onBirdRanged={selectPerchFromBird}
      onDone={onLeave}
      showPerchLabels
      adminEyesFlagPreview
      belowFrame={
        <div
          className="admin-spot-controls"
          role="group"
          aria-label="Admin-kalibrering"
        >
          <div className="admin-spot-row">
            <label className="admin-spot-field admin-spot-field-wide">
              <span>Bilde</span>
              <select
                value={imageSrc}
                onChange={(e) => setImageSrc(e.target.value)}
              >
                {spotImages.map((src) => (
                  <option key={src} value={src}>
                    {spotLabel(src)}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-spot-field admin-spot-field-wide">
              <span>Kikkert</span>
              <select
                value={binoId}
                onChange={(e) => setBinoId(e.target.value)}
              >
                <option value="">Ingen</option>
                {lrfItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.brand} {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-spot-field admin-spot-field-wide">
              <span>Termisk</span>
              <select
                value={thermalId}
                onChange={(e) => setThermalId(e.target.value)}
              >
                <option value="">Ingen</option>
                {thermalItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.brand} {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-spot-row">
            <label className="admin-spot-field">
              <span>Tiur</span>
              <select
                value={tiurSpriteId}
                onChange={(e) =>
                  setTiurSpriteId(e.target.value as BirdSpriteId)
                }
              >
                {TIUR_SPRITES.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            <SpriteScaleField spriteId={tiurSpriteId} />
            <UseInSceneField
              spotImageSrc={imageSrc}
              spriteId={tiurSpriteId}
            />
            <SpriteScaleBakeButton species="tiur" />
          </div>

          <div className="admin-spot-row">
            <label className="admin-spot-field">
              <span>Orre</span>
              <select
                value={orreSpriteId}
                onChange={(e) =>
                  setOrreSpriteId(e.target.value as BirdSpriteId)
                }
              >
                {ORRE_SPRITES.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            <SpriteScaleField spriteId={orreSpriteId} />
            <UseInSceneField
              spotImageSrc={imageSrc}
              spriteId={orreSpriteId}
            />
            <SpriteScaleBakeButton species="orrhane" />
          </div>

          <div className="admin-spot-row admin-spot-perch-row">
            <label className="admin-spot-field">
              <span>Perch</span>
              <select
                value={selectedPerchId ?? ""}
                onChange={(e) =>
                  setSelectedPerchId(e.target.value || null)
                }
              >
                <option value="">LRF / klikk fugl…</option>
                {scenePerches.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.species} · {p.colorBand ?? "?"} ·{" "}
                    {p.distanceMinM}–{p.distanceMaxM} m
                    {p.eyesVisible === false ? " · optikk" : " · øyne"}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-spot-field admin-spot-scale">
              <span>Fra m</span>
              <input
                type="number"
                className="admin-spot-scale-num"
                min={PERCH_DISTANCE_EDIT_MIN_M}
                max={PERCH_DISTANCE_EDIT_MAX_M}
                step={1}
                disabled={!selectedPerchId}
                value={editMinM}
                onChange={(e) => setEditMinM(Number(e.target.value))}
              />
            </label>

            <label className="admin-spot-field admin-spot-scale">
              <span>Til m</span>
              <input
                type="number"
                className="admin-spot-scale-num"
                min={PERCH_DISTANCE_EDIT_MIN_M}
                max={PERCH_DISTANCE_EDIT_MAX_M}
                step={1}
                disabled={!selectedPerchId}
                value={editMaxM}
                onChange={(e) => setEditMaxM(Number(e.target.value))}
              />
            </label>

            <label className="admin-spot-field admin-spot-scale">
              <span>Perch %</span>
              <input
                type="number"
                className="admin-spot-scale-num"
                min={PERCH_SCALE_MIN}
                max={PERCH_SCALE_MAX}
                step={1}
                disabled={!selectedPerchId}
                value={editPerchScale}
                onChange={(e) => setEditPerchScale(Number(e.target.value))}
                aria-label="Perch sprite scale prosent"
              />
            </label>

            <label className="admin-spot-field admin-spot-allow">
              <span>Eyes ({editBand})</span>
              <span className="admin-spot-allow-row">
                <input
                  type="checkbox"
                  checked={editEyesVisible}
                  disabled={!selectedPerchId}
                  onChange={(e) => onEyesVisibleChange(e.target.checked)}
                  aria-label="Synlig med bare øyne (rød/lilla)"
                />
                <span className="admin-spot-allow-hint">
                  {editEyesVisible ? "øyne" : "optikk"}
                </span>
              </span>
            </label>

            <button
              type="button"
              className="intro-button admin-spot-btn"
              disabled={!selectedPerchId}
              onClick={() => savePerchDistance()}
            >
              Lagre brakett
            </button>
            <button
              type="button"
              className="intro-button admin-spot-btn"
              disabled={!selectedPerchId || !hasOverride}
              onClick={resetPerchDistance}
            >
              Reset
            </button>
          </div>

          <p className="admin-spot-meta">
            {birdPlacements.length} perch · scale default{" "}
            {BIRD_SPRITE_SCALE_DEFAULT}%
            {selectedPerchId
              ? ` · valgt ${selectedPerchId}${
                  catalogSelected
                    ? ` (katalog ${catalogSelected.distanceMinM}–${catalogSelected.distanceMaxM} m / ${catalogSelected.colorBand ?? "?"})`
                    : ""
                }${
                  selectedLive
                    ? ` · ${selectedLive.eyesVisible !== false ? "eyes" : "optikk"}`
                    : ""
                }${hasOverride ? " · override" : ""}`
              : " · LRF/klikk for å velge perch"}
            {lrfHintM != null ? ` · LRF ${lrfHintM} m` : ""}
          </p>
        </div>
      }
    />
  );
}
