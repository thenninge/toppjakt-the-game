"use client";

import { useEffect, useMemo, useState } from "react";
import { LocationNav } from "@/components/town/LocationNav";
import {
  CUSTOMS_SERVICES,
  HOME_LOAD_AMMO_BY_CALIBER,
  HOME_LOAD_ORDER_ROUNDS,
  HOME_LOAD_PER_ROUND_NOK,
  customsBeddingMoaDelta,
  customsWeightReductionGrams,
  serviceOwned,
  type CustomsMods,
  type CustomsServiceId,
} from "@/lib/customs/spec";
import { formatPermitFee } from "@/lib/player";
import { getShopItem } from "@/lib/shop/catalog";
import {
  isAmmoItem,
  isRifleItem,
  isStockItem,
  type ShopItem,
} from "@/lib/shop/types";
import { formatWeightKg } from "@/lib/shop/weights";

type CbCustomsProps = {
  balance: number;
  customsMods: CustomsMods;
  /** Resolved kit items (for caliber / weight preview). */
  kitItems: ShopItem[];
  inventory: { itemId: string; qty: number }[];
  onBuyService: (id: CustomsServiceId) => void;
  onOrderHomeLoads: (ammoId: string, rounds: number) => void;
  onLeave: () => void;
};

/**
 * CB Customs — bedding, fluting, home loads, custom camo.
 */
export function CbCustoms({
  balance,
  customsMods,
  kitItems,
  inventory,
  onBuyService,
  onOrderHomeLoads,
  onLeave,
}: CbCustomsProps) {
  const [status, setStatus] = useState("");
  const [homeLoadAmmoId, setHomeLoadAmmoId] = useState(
    () => Object.values(HOME_LOAD_AMMO_BY_CALIBER)[0] ?? "",
  );
  const [homeLoadRounds, setHomeLoadRounds] = useState(HOME_LOAD_ORDER_ROUNDS);

  const rifle = useMemo(
    () => kitItems.find(isRifleItem) ?? null,
    [kitItems],
  );
  const stock = useMemo(
    () => kitItems.find(isStockItem) ?? null,
    [kitItems],
  );

  useEffect(() => {
    const cal = rifle?.caliber;
    if (cal && HOME_LOAD_AMMO_BY_CALIBER[cal]) {
      setHomeLoadAmmoId(HOME_LOAD_AMMO_BY_CALIBER[cal]!);
    }
  }, [rifle?.caliber]);

  const weightCut = useMemo(
    () =>
      customsWeightReductionGrams(customsMods, {
        rifleWeightGrams: rifle?.weightGrams ?? 3500,
        stockWeightGrams: stock?.weightGrams ?? null,
      }),
    [customsMods, rifle, stock],
  );

  const moaDelta = customsBeddingMoaDelta(customsMods);

  const homeLoadOptions = useMemo(() => {
    return Object.entries(HOME_LOAD_AMMO_BY_CALIBER).map(([caliber, id]) => {
      const item = getShopItem(id);
      return {
        id,
        caliber,
        label: item ? `${item.name}` : caliber,
      };
    });
  }, []);

  const homeLoadCost = homeLoadRounds * HOME_LOAD_PER_ROUND_NOK;
  const ownedHomeLoadQty =
    inventory.find((e) => e.itemId === homeLoadAmmoId)?.qty ?? 0;

  function buy(id: CustomsServiceId) {
    const svc = CUSTOMS_SERVICES.find((s) => s.id === id);
    if (!svc || svc.comingSoon) return;
    if (serviceOwned(customsMods, id)) {
      setStatus("Du har allerede denne jobben.");
      return;
    }
    if (id === "bedding" && customsMods.pillarBedding) {
      setStatus("Søylebedding er allerede gjort — bedre enn vanlig bedding.");
      return;
    }
    if (balance < svc.priceNok) {
      setStatus("Ikke nok penger.");
      return;
    }
    onBuyService(id);
    setStatus(`${svc.name} bestilt — ${formatPermitFee(svc.priceNok)}`);
  }

  function orderLoads() {
    if (!customsMods.homeLoadsSetup) {
      setStatus("Betal først for home loads-oppsett.");
      return;
    }
    if (homeLoadRounds < 1) return;
    if (balance < homeLoadCost) {
      setStatus("Ikke nok penger til den ordren.");
      return;
    }
    const item = getShopItem(homeLoadAmmoId);
    if (!item || !isAmmoItem(item)) {
      setStatus("Ugyldig kaliber.");
      return;
    }
    onOrderHomeLoads(homeLoadAmmoId, homeLoadRounds);
    setStatus(
      `Bestilt ${homeLoadRounds}× ${item.name} — ${formatPermitFee(homeLoadCost)}. Legg i kit hjemme.`,
    );
  }

  return (
    <div className="cb-customs">
      <LocationNav onBackToTown={onLeave} />
      <p className="intro-line intro-gift">CB Customs</p>
      <p className="intro-line">Børsemaker · finish · home loads</p>
      <p className="shop-row-note">
        Saldo {formatPermitFee(balance)}
        {moaDelta !== 0
          ? ` · bedding ${moaDelta.toFixed(2)} MOA`
          : ""}
        {weightCut > 0 ? ` · −${formatWeightKg(weightCut)} kitvekt` : ""}
        {customsMods.triggerTuning ? " · trigger tuning" : ""}
        {customsMods.customCamo ? " · custom camo" : ""}
      </p>

      <ul className="cb-customs-list">
        {CUSTOMS_SERVICES.map((svc) => {
          const owned = serviceOwned(customsMods, svc.id);
          const canBuy =
            !svc.comingSoon &&
            !owned &&
            !(svc.id === "bedding" && customsMods.pillarBedding) &&
            balance >= svc.priceNok;
          return (
            <li key={svc.id} className="cb-customs-card">
              <div className="cb-customs-card-head">
                <strong>{svc.name}</strong>
                <span>
                  {svc.comingSoon
                    ? "Kommer snart"
                    : owned
                      ? "Ferdig"
                      : formatPermitFee(svc.priceNok)}
                </span>
              </div>
              <p className="shop-row-note">{svc.effect}</p>
              {svc.comingSoon ? (
                <button type="button" className="intro-button" disabled>
                  Kommer snart
                </button>
              ) : (
                <button
                  type="button"
                  className="intro-button"
                  disabled={!canBuy}
                  onClick={() => buy(svc.id)}
                >
                  {owned ? "Allerede gjort" : "Bestill"}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {customsMods.homeLoadsSetup ? (
        <div className="cb-customs-homeload">
          <p className="intro-line intro-gift">Bestill home loads</p>
          <p className="shop-row-note">
            {HOME_LOAD_PER_ROUND_NOK},-/skudd · du har {ownedHomeLoadQty}{" "}
            patroner av valgt type
            {rifle
              ? ` · kit-rifle: ${rifle.brand} ${rifle.name}`
              : " · ingen rifle i kit (velg kaliber manuelt)"}
          </p>
          <label className="shop-filter">
            Kaliber / last
            <select
              value={homeLoadAmmoId}
              onChange={(e) => setHomeLoadAmmoId(e.target.value)}
            >
              {homeLoadOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="shop-filter">
            Antall skudd
            <input
              type="number"
              min={1}
              max={200}
              value={homeLoadRounds}
              onChange={(e) =>
                setHomeLoadRounds(
                  Math.max(1, Math.min(200, Number(e.target.value) || 1)),
                )
              }
            />
          </label>
          <button
            type="button"
            className="intro-button"
            disabled={balance < homeLoadCost}
            onClick={orderLoads}
          >
            Bestill {homeLoadRounds} skudd ({formatPermitFee(homeLoadCost)})
          </button>
        </div>
      ) : null}

      {status ? <p className="aware-status">{status}</p> : null}

      <button type="button" className="intro-button" onClick={onLeave}>
        Tilbake til byen
      </button>
    </div>
  );
}
