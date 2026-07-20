"use client";

import { useEffect, useMemo, useState } from "react";
import { LocationNav } from "@/components/town/LocationNav";
import { getHuntMap } from "@/lib/hunt/maps";
import {
  formatBirdRating,
  getHuntingTerrain,
  HUNTING_TERRAINS,
  terrainMapSrc,
  type HuntingTerrain,
} from "@/lib/hunt/terrain";

type InaturNoProps = {
  balance: number;
  selectedTerrainId: string | null;
  onSelectTerrain: (terrainId: string) => void;
  onBack: () => void;
};

function formatPrice(nok: number): string {
  return `${nok.toLocaleString("nb-NO")} kr/dag`;
}

function terrainTierLabel(pricePerDayNok: number): string {
  if (pricePerDayNok <= 500) return "Budsjett";
  if (pricePerDayNok <= 1000) return "Standard";
  return "Premium";
}

export function InaturNo({
  balance,
  selectedTerrainId,
  onSelectTerrain,
  onBack,
}: InaturNoProps) {
  const [message, setMessage] = useState("");
  const [previewTerrain, setPreviewTerrain] = useState<HuntingTerrain | null>(
    null,
  );
  const [pendingPurchase, setPendingPurchase] =
    useState<HuntingTerrain | null>(null);
  const selected = useMemo(
    () => getHuntingTerrain(selectedTerrainId) ?? null,
    [selectedTerrainId],
  );

  useEffect(() => {
    if (!previewTerrain) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPreviewTerrain(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewTerrain]);

  function handleBuyPermit(terrain: HuntingTerrain) {
    if (terrain.id === selectedTerrainId) {
      setMessage(`${terrain.name} er allerede kjøpt for denne turen.`);
      return;
    }
    if (balance < terrain.pricePerDayNok) {
      setMessage(
        `Ikke nok på konto — jaktkort koster ${formatPrice(terrain.pricePerDayNok)}.`,
      );
      return;
    }
    setPendingPurchase(terrain);
    setMessage("");
  }

  function confirmPurchase() {
    if (!pendingPurchase) return;
    if (balance < pendingPurchase.pricePerDayNok) {
      setMessage(
        `Ikke nok på konto — jaktkort koster ${formatPrice(pendingPurchase.pricePerDayNok)}.`,
      );
      setPendingPurchase(null);
      return;
    }
    onSelectTerrain(pendingPurchase.id);
    setMessage(
      `Jaktkort kjøpt: ${pendingPurchase.name} (${formatPrice(pendingPurchase.pricePerDayNok)}).`,
    );
    setPendingPurchase(null);
  }

  function cancelPurchase() {
    setPendingPurchase(null);
  }

  if (pendingPurchase) {
    const amount = pendingPurchase.pricePerDayNok.toLocaleString("nb-NO");
    const canPay = balance >= pendingPurchase.pricePerDayNok;
    return (
      <div className="inatur-no">
        <LocationNav
          onBackToTown={cancelPurchase}
          backLabel="← Avbryt kjøp"
          hint="Bekreft betaling for jaktkort."
        />
        <div className="intro-dialogue">
          <p className="intro-line intro-gift">inatur.no — betaling</p>
          <p className="intro-line">
            Jaktkort: {pendingPurchase.name} ({pendingPurchase.region})
          </p>
          <p className="intro-line">
            Kontoen din blir trukket med {amount},-.
          </p>
          <p className="shop-row-note">
            Tiur {formatBirdRating(pendingPurchase.tiurRating)} · Orrhane{" "}
            {formatBirdRating(pendingPurchase.orrhaneRating)} ·{" "}
            {formatPrice(pendingPurchase.pricePerDayNok)}
          </p>
          {!canPay ? (
            <p className="intro-error">
              Du har ikke nok på konto. Vipps nekter. Kortet nekter.
            </p>
          ) : null}
          <button
            type="button"
            className="intro-button"
            disabled={!canPay}
            onClick={confirmPurchase}
          >
            Bekreft — betal {amount},-
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={cancelPurchase}
          >
            Avbryt
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="inatur-no">
      <LocationNav
        onBackToTown={onBack}
        backLabel="← Tilbake til Home"
        hint="Kjøp jaktkort for terreng. Pris er per dag — bekreft før kontoen trekkes."
      />

      <header className="shop-header">
        <p className="intro-line intro-gift">inatur.no</p>
        <p className="shop-row-note">
          Lei jaktterreng digitalt. Tiur- og orrhane-rating (1–5) styrer senere
          hvor mye fugl som spawner i kartet. Klikk kartet for stort format.
        </p>
        {selected ? (
          <p className="shop-row-note">
            Jaktkort: <strong>{selected.name}</strong> ({selected.region}) ·{" "}
            {formatPrice(selected.pricePerDayNok)} · Tiur{" "}
            {formatBirdRating(selected.tiurRating)} · Orrhane{" "}
            {formatBirdRating(selected.orrhaneRating)} · kart{" "}
            {getHuntMap(selected.mapId).label}
          </p>
        ) : (
          <p className="shop-row-note">Ingen jaktkort kjøpt ennå.</p>
        )}
      </header>

      {message ? <p className="shop-row-note inatur-message">{message}</p> : null}

      <ul className="shop-list inatur-terrain-list">
        {HUNTING_TERRAINS.map((terrain) => {
          const isSelected = terrain.id === selectedTerrainId;
          const canAfford = balance >= terrain.pricePerDayNok;
          const map = getHuntMap(terrain.mapId);
          return (
            <li
              key={terrain.id}
              className={
                isSelected
                  ? "shop-row inatur-terrain is-selected"
                  : "shop-row inatur-terrain"
              }
            >
              <button
                type="button"
                className="inatur-terrain-preview"
                onClick={() => setPreviewTerrain(terrain)}
                title={`Vis ${map.label} i stort format`}
              >
                <img
                  src={terrainMapSrc(terrain)}
                  alt={`Kart: ${map.label}`}
                  className="inatur-terrain-map"
                />
              </button>
              <div className="shop-row-main">
                <span className="shop-row-name">
                  {terrain.name} · {terrain.region}
                </span>
                <span className="shop-row-meta">
                  {terrainTierLabel(terrain.pricePerDayNok)} ·{" "}
                  {formatPrice(terrain.pricePerDayNok)} · {map.label}
                </span>
                <span className="shop-row-ballistics">
                  Tiur-rating: {formatBirdRating(terrain.tiurRating)} · Orrhane:{" "}
                  {formatBirdRating(terrain.orrhaneRating)}
                </span>
                <span className="shop-row-note inatur-blurb">{terrain.blurb}</span>
              </div>
              <button
                type="button"
                className={
                  isSelected
                    ? "intro-button shop-buy kit-equipped"
                    : "intro-button shop-buy"
                }
                disabled={!canAfford && !isSelected}
                onClick={() => handleBuyPermit(terrain)}
              >
                {isSelected ? "Kjøpt" : canAfford ? "Kjøp jaktkort" : "For dyrt"}
              </button>
            </li>
          );
        })}
      </ul>

      <LocationNav onBackToTown={onBack} backLabel="← Tilbake til Home" />

      {previewTerrain ? (
        <div
          className="inatur-map-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={`Kart: ${previewTerrain.name}`}
          onClick={() => setPreviewTerrain(null)}
        >
          <div
            className="inatur-map-lightbox-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="inatur-map-lightbox-head">
              <div>
                <p className="intro-line intro-gift">
                  {previewTerrain.name} · {previewTerrain.region}
                </p>
                <p className="shop-row-note">
                  {getHuntMap(previewTerrain.mapId).label} · Tiur{" "}
                  {formatBirdRating(previewTerrain.tiurRating)} · Orrhane{" "}
                  {formatBirdRating(previewTerrain.orrhaneRating)} ·{" "}
                  {formatPrice(previewTerrain.pricePerDayNok)}
                </p>
              </div>
              <button
                type="button"
                className="intro-button"
                onClick={() => setPreviewTerrain(null)}
              >
                Lukk
              </button>
            </header>
            <div className="inatur-map-lightbox-frame">
              <img
                src={terrainMapSrc(previewTerrain)}
                alt={`Stort kart: ${getHuntMap(previewTerrain.mapId).label}`}
                className="inatur-map-lightbox-img"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
