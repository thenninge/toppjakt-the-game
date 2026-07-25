"use client";

import { useEffect, useMemo, useState } from "react";
import { SpotView } from "@/components/hunt/SpotView";
import { adminPlacementsForSpotImage } from "@/lib/hunt/birds";
import {
  spriteIdsForSpecies,
  type BirdSpriteId,
} from "@/lib/hunt/birdSprites";
import {
  BIRD_SPRITE_SCALE_DEFAULT,
  BIRD_SPRITE_SCALE_MAX,
  BIRD_SPRITE_SCALE_MIN,
  getBirdSpriteScalePercent,
  setBirdSpriteScalePercent,
  subscribeBirdSpriteScales,
} from "@/lib/hunt/birdSpriteScale";
import {
  isBirdSpriteAllowedInScene,
  setBirdSpriteAllowedInScene,
  subscribeBirdSpriteSceneAllow,
} from "@/lib/hunt/birdSpriteSceneAllow";
import { spotImagesWithPerches } from "@/lib/hunt/spotPerches";
import { getCatalogByCategory } from "@/lib/shop/catalog";
import {
  isLrfItem,
  isThermalItem,
} from "@/lib/shop/types";
import { lrfOpticalMagnification } from "@/lib/optics/spec";

type AdminOfficeProps = {
  onLeave: () => void;
};

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

/** Admin calibration desk — free optics + full perch fill for spotting QA. */
export function AdminOffice({ onLeave }: AdminOfficeProps) {
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

  useEffect(() => {
    return subscribeBirdSpriteScales(() => {
      setScaleEpoch((n) => n + 1);
    });
  }, []);

  const birdPlacements = useMemo(() => {
    void scaleEpoch;
    if (!imageSrc) return [];
    return adminPlacementsForSpotImage(imageSrc, {
      speciesMode: "both",
      tiurSpriteId,
      orreSpriteId,
    });
  }, [imageSrc, tiurSpriteId, orreSpriteId, scaleEpoch]);

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
      onBirdObserved={() => {}}
      onDone={onLeave}
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
          </div>

          <p className="admin-spot-meta">
            {birdPlacements.length} perch · scale default{" "}
            {BIRD_SPRITE_SCALE_DEFAULT}%
          </p>
        </div>
      }
    />
  );
}
