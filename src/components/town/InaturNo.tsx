"use client";

import { useEffect, useMemo, useState } from "react";
import { LocationNav } from "@/components/town/LocationNav";
import { getHuntMap } from "@/lib/hunt/maps";
import {
  createJaktkort,
  formatJaktkortStatusNb,
  jaktkortBlurbNb,
  jaktkortLabelNb,
  jaktkortPriceNok,
  JAKTKORT_KINDS,
  type ActiveJaktkort,
  type JaktkortKind,
} from "@/lib/hunt/jaktkort";
import {
  formatBirdRating,
  getHuntingTerrain,
  terrainsAvailableForPlayer,
  terrainMapSrc,
  type HuntingTerrain,
} from "@/lib/hunt/terrain";

type InaturNoProps = {
  balance: number;
  selectedTerrainId: string | null;
  jaktkort: ActiveJaktkort | null;
  unlockedTerrainIds: string[];
  onPurchaseJaktkort: (terrainId: string, kind: JaktkortKind) => void;
  onBack: () => void;
};

function formatNok(nok: number): string {
  return `${nok.toLocaleString("nb-NO")} kr`;
}

function formatDayRate(nok: number): string {
  return `${nok.toLocaleString("nb-NO")} kr/dag`;
}

function terrainTierLabel(pricePerDayNok: number): string {
  if (pricePerDayNok <= 250) return "Budsjett";
  if (pricePerDayNok <= 500) return "Standard";
  if (pricePerDayNok <= 1500) return "Premium";
  return "Finmark";
}

export function InaturNo({
  balance,
  selectedTerrainId,
  jaktkort,
  unlockedTerrainIds,
  onPurchaseJaktkort,
  onBack,
}: InaturNoProps) {
  const [message, setMessage] = useState("");
  const [previewTerrain, setPreviewTerrain] = useState<HuntingTerrain | null>(
    null,
  );
  const listings = useMemo(
    () => terrainsAvailableForPlayer(unlockedTerrainIds),
    [unlockedTerrainIds],
  );
  const [pendingPurchase, setPendingPurchase] = useState<{
    terrain: HuntingTerrain;
    kind: JaktkortKind;
  } | null>(null);
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

  function handleBuyPermit(terrain: HuntingTerrain, kind: JaktkortKind) {
    const price = jaktkortPriceNok(terrain.pricePerDayNok, kind);
    const sameActive =
      jaktkort &&
      jaktkort.terrainId === terrain.id &&
      jaktkort.kind === kind &&
      jaktkort.daysRemaining > 0;
    if (sameActive) {
      setMessage(
        `${jaktkortLabelNb(kind)} for ${terrain.name} er allerede aktivt (${jaktkort.daysRemaining} dager igjen).`,
      );
      return;
    }
    if (balance < price) {
      setMessage(
        `Ikke nok på konto — ${jaktkortLabelNb(kind).toLowerCase()} koster ${formatNok(price)}.`,
      );
      return;
    }
    setPendingPurchase({ terrain, kind });
    setMessage("");
  }

  function confirmPurchase() {
    if (!pendingPurchase) return;
    const { terrain, kind } = pendingPurchase;
    const price = jaktkortPriceNok(terrain.pricePerDayNok, kind);
    if (balance < price) {
      setMessage(
        `Ikke nok på konto — ${jaktkortLabelNb(kind).toLowerCase()} koster ${formatNok(price)}.`,
      );
      setPendingPurchase(null);
      return;
    }
    onPurchaseJaktkort(terrain.id, kind);
    const kort = createJaktkort(terrain.id, kind, terrain.pricePerDayNok);
    setMessage(
      `Kjøpt ${jaktkortLabelNb(kind)}: ${terrain.name} (${formatNok(price)} · ${kort.daysRemaining} jaktdag${kort.daysRemaining === 1 ? "" : "er"}).`,
    );
    setPendingPurchase(null);
  }

  function cancelPurchase() {
    setPendingPurchase(null);
  }

  if (pendingPurchase) {
    const { terrain, kind } = pendingPurchase;
    const price = jaktkortPriceNok(terrain.pricePerDayNok, kind);
    const amount = price.toLocaleString("nb-NO");
    const canPay = balance >= price;
    const replaces =
      jaktkort && jaktkort.terrainId
        ? `Erstatter aktivt kort (${formatJaktkortStatusNb(jaktkort)}).`
        : null;
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
            {jaktkortLabelNb(kind)}: {terrain.name} ({terrain.region})
          </p>
          <p className="intro-line">
            Kontoen din blir trukket med {amount},-.
          </p>
          <p className="shop-row-note">
            {jaktkortBlurbNb(kind)} · basis{" "}
            {formatDayRate(terrain.pricePerDayNok)} · Tiur{" "}
            {formatBirdRating(terrain.tiurRating)} · Orrhane{" "}
            {formatBirdRating(terrain.orrhaneRating)}
          </p>
          {replaces ? <p className="shop-row-note">{replaces}</p> : null}
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
        hint="Dagskort (1 dag), ukeskort (7 dager · 4×) eller sesongkort (30 dager · 30×)."
      />

      <header className="shop-header">
        <p className="intro-line intro-gift">inatur.no</p>
        <p className="shop-row-note">
          Lei jaktterreng digitalt. Dagskort gjelder én tur (avslutt jakt eller
          overnatting ute). Uke- og sesongkort tærer én jaktdag per overnatting.
        </p>
        {selected && jaktkort ? (
          <p className="shop-row-note">
            Aktivt: <strong>{selected.name}</strong> ({selected.region}) ·{" "}
            {formatJaktkortStatusNb(jaktkort)} · Tiur{" "}
            {formatBirdRating(selected.tiurRating)} · Orrhane{" "}
            {formatBirdRating(selected.orrhaneRating)}
          </p>
        ) : (
          <p className="shop-row-note">Ingen jaktkort kjøpt ennå.</p>
        )}
      </header>

      {message ? <p className="shop-row-note inatur-message">{message}</p> : null}

      <ul className="shop-list inatur-terrain-list">
        {listings.map((terrain) => {
          const isSelected = terrain.id === selectedTerrainId;
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
                  {terrainTierLabel(terrain.pricePerDayNok)} · basis{" "}
                  {formatDayRate(terrain.pricePerDayNok)} · {map.label}
                </span>
                <span className="shop-row-ballistics">
                  Tiur-rating: {formatBirdRating(terrain.tiurRating)} · Orrhane:{" "}
                  {formatBirdRating(terrain.orrhaneRating)}
                </span>
                <span className="shop-row-note inatur-blurb">{terrain.blurb}</span>
                {terrain.access === "rulles" && terrain.landownerName ? (
                  <span className="shop-row-note">
                    Via Rulles — {terrain.landownerName}
                  </span>
                ) : null}
                <div className="inatur-kort-options">
                  {JAKTKORT_KINDS.map((kind) => {
                    const price = jaktkortPriceNok(terrain.pricePerDayNok, kind);
                    const canAfford = balance >= price;
                    const activeHere =
                      isSelected && jaktkort?.kind === kind;
                    return (
                      <button
                        key={kind}
                        type="button"
                        className={
                          activeHere
                            ? "intro-button shop-buy kit-equipped"
                            : "intro-button shop-buy"
                        }
                        disabled={!canAfford && !activeHere}
                        title={jaktkortBlurbNb(kind)}
                        onClick={() => handleBuyPermit(terrain, kind)}
                      >
                        {activeHere
                          ? `${jaktkortLabelNb(kind)} · aktiv`
                          : canAfford
                            ? `${jaktkortLabelNb(kind)} · ${formatNok(price)}`
                            : `${jaktkortLabelNb(kind)} · for dyrt`}
                      </button>
                    );
                  })}
                </div>
              </div>
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
                  {formatBirdRating(previewTerrain.orrhaneRating)} · basis{" "}
                  {formatDayRate(previewTerrain.pricePerDayNok)}
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
