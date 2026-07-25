"use client";

import { useMemo, useState } from "react";
import { LocationNav } from "@/components/town/LocationNav";
import { SpotView } from "@/components/hunt/SpotView";
import {
  adminPlacementsForSpotImage,
  type AdminSpotSpeciesMode,
  type BirdVisualPlacement,
} from "@/lib/hunt/birds";
import {
  spriteIdsForSpecies,
  type BirdSpriteId,
} from "@/lib/hunt/birdSprites";
import { spotImagesWithPerches } from "@/lib/hunt/spotPerches";
import { getCatalogByCategory } from "@/lib/shop/catalog";
import {
  isLrfItem,
  isThermalItem,
  type LrfShopItem,
  type ThermalShopItem,
} from "@/lib/shop/types";
import { lrfOpticalMagnification } from "@/lib/optics/spec";

type AdminOfficeProps = {
  onLeave: () => void;
};

type SpotSession = {
  imageSrc: string;
  birdPlacements: BirdVisualPlacement[];
  binoItem: LrfShopItem | null;
  thermalItem: ThermalShopItem | null;
};

function spotLabel(src: string): string {
  const base = src.split("/").pop() ?? src;
  return base.replace(/\.(png|jpe?g|webp)$/i, "");
}

const TIUR_SPRITES = spriteIdsForSpecies("tiur");
const ORRE_SPRITES = spriteIdsForSpecies("orrhane");
const ADMIN_BATTERY_SEC = 60 * 60;

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
  const [speciesMode, setSpeciesMode] =
    useState<AdminSpotSpeciesMode>("both");
  const [tiurSpriteId, setTiurSpriteId] = useState<BirdSpriteId>(
    TIUR_SPRITES[0] ?? "tiur-1",
  );
  const [orreSpriteId, setOrreSpriteId] = useState<BirdSpriteId>(
    ORRE_SPRITES[0] ?? "orre-1",
  );
  const [binoId, setBinoId] = useState(lrfItems[0]?.id ?? "");
  const [thermalId, setThermalId] = useState(thermalItems[0]?.id ?? "");
  const [session, setSession] = useState<SpotSession | null>(null);

  const perchCount = useMemo(() => {
    if (!imageSrc) return 0;
    return adminPlacementsForSpotImage(imageSrc, {
      speciesMode,
      tiurSpriteId,
      orreSpriteId,
    }).length;
  }, [imageSrc, speciesMode, tiurSpriteId, orreSpriteId]);

  function startSpotting() {
    if (!imageSrc) return;
    const binoItem = lrfItems.find((i) => i.id === binoId) ?? null;
    const thermalItem = thermalItems.find((i) => i.id === thermalId) ?? null;
    const birdPlacements = adminPlacementsForSpotImage(imageSrc, {
      speciesMode,
      tiurSpriteId,
      orreSpriteId,
    });
    setSession({
      imageSrc,
      birdPlacements,
      binoItem,
      thermalItem,
    });
  }

  if (session) {
    const { binoItem, thermalItem } = session;
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

    return (
      <SpotView
        imageSrc={session.imageSrc}
        birdPlacements={session.birdPlacements}
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
        onDone={() => setSession(null)}
      />
    );
  }

  return (
    <div className="admin-office">
      <p className="intro-line intro-gift">Admin office</p>
      <p className="intro-line">
        Kalibrering av spotting-posisjoner. Alle perch fylles — optikk er
        fristilt fra kit.
      </p>

      <div className="admin-office-form">
        <label className="admin-office-field">
          <span>Spottingbilde</span>
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

        <label className="admin-office-field">
          <span>Art</span>
          <select
            value={speciesMode}
            onChange={(e) =>
              setSpeciesMode(e.target.value as AdminSpotSpeciesMode)
            }
          >
            <option value="both">Begge (tiur + orre)</option>
            <option value="tiur">Kun tiur</option>
            <option value="orrhane">Kun orre</option>
          </select>
        </label>

        <label className="admin-office-field">
          <span>Tiur-bilde</span>
          <select
            value={tiurSpriteId}
            onChange={(e) => setTiurSpriteId(e.target.value as BirdSpriteId)}
            disabled={speciesMode === "orrhane"}
          >
            {TIUR_SPRITES.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-office-field">
          <span>Orre-bilde</span>
          <select
            value={orreSpriteId}
            onChange={(e) => setOrreSpriteId(e.target.value as BirdSpriteId)}
            disabled={speciesMode === "tiur"}
          >
            {ORRE_SPRITES.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>

        <label className="admin-office-field">
          <span>Kikkert / spotter (LRF)</span>
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

        <label className="admin-office-field">
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

        <p className="admin-office-meta">
          {perchCount} perch{perchCount === 1 ? "" : "er"} på dette bildet
          {speciesMode === "both"
            ? ""
            : speciesMode === "tiur"
              ? " (tiur)"
              : " (orre)"}
          .
        </p>

        <button
          type="button"
          className="intro-button"
          disabled={!imageSrc || perchCount === 0}
          onClick={startSpotting}
        >
          Åpne spotting
        </button>
      </div>

      <LocationNav onBackToTown={onLeave} />
    </div>
  );
}
