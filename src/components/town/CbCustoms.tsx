"use client";

import { useEffect, useMemo, useState } from "react";
import { LocationNav } from "@/components/town/LocationNav";
import { ExpandableSection } from "@/components/ui/ExpandableSection";
import {
  BOLT_KNOB_COLOR_PRESETS,
  CUSTOMS_SERVICES,
  DEFAULT_BOLT_KNOB_COLOR,
  HOME_LOAD_AMMO_BY_CALIBER,
  HOME_LOAD_ORDER_ROUNDS,
  HOME_LOAD_PER_ROUND_NOK,
  customsBeddingMoaDelta,
  customsWeightReductionGrams,
  normalizeBoltKnobColor,
  serviceOwned,
  type CustomsMods,
  type CustomsServiceId,
} from "@/lib/customs/spec";
import {
  BARREL_LENGTH_MAX_IN,
  BARREL_LENGTH_MIN_IN,
  BARREL_MAKERS,
  BARREL_ORDER_ACTION_TRUEING_NOK,
  BARREL_ORDER_CROWN_NOK,
  CARBON_CONTOURS,
  FLUTING_LABOUR_NOK,
  FLUTING_RETROFIT_NOK,
  SAUER_200STR_BARREL_SURCHARGE_NOK,
  SAUER_200STR_RIFLE_ID,
  STAINLESS_MOA_BONUS,
  STAINLESS_PRICE_MULT,
  barrelLengthV0Factor,
  barrelMaker,
  canCustomProfile,
  createDefaultCustomBarrelConfig,
  defaultSteelStations,
  estimateCustomBarrelMoa,
  estimateCustomBarrelWeightGrams,
  factoryBarrelLengthIn,
  materialLabelNb,
  materialsForMaker,
  quoteCustomBarrelNok,
  type BarrelMakerId,
  type BarrelMaterial,
  type CarbonContourId,
  type CustomBarrelConfig,
  type InstalledCustomBarrel,
  type StoredCustomBarrel,
} from "@/lib/customs/customBarrel";
import {
  barrelHeatFromCustomConfig,
  formatBarrelHeatPreview,
} from "@/lib/range/barrelHeat";
import {
  formatPermitFee,
  getRifleRoundCount,
} from "@/lib/player";
import {
  BARREL_REPLACE_NOK,
  BARREL_WEAR_END_SHOTS,
  BARREL_WEAR_START_CRMo,
  BARREL_WEAR_START_STAINLESS,
  barrelWearLabelNb,
  barrelWearMaterialFromCustom,
  barrelWearMoaScale,
} from "@/lib/rifle/barrelWear";
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
  kitItems: ShopItem[];
  inventory: { itemId: string; qty: number }[];
  rifleRoundCounts?: Record<string, number>;
  customBarrels?: Record<string, InstalledCustomBarrel>;
  spareBarrels?: StoredCustomBarrel[];
  onBuyService: (
    id: CustomsServiceId,
    opts?: { boltKnobColor?: string },
  ) => void;
  /** Recolor custom bolt knob after purchase (free). */
  onSetBoltKnobColor?: (color: string) => void;
  onOrderHomeLoads: (ammoId: string, rounds: number) => void;
  /** Standard factory-style rebarrel — stashes custom blank in inventory. */
  onReplaceBarrel: (rifleId: string) => void;
  onInstallCustomBarrel: (
    rifleId: string,
    config: CustomBarrelConfig,
    priceNok: number,
  ) => void;
  onReinstallSpareBarrel?: (rifleId: string, storageId: string) => void;
  /** Retrofit fluting on an unfluted custom steel pipe (one-time). */
  onFluteCustomBarrel?: (rifleId: string, priceNok: number) => void;
  onLeave: () => void;
};

export function CbCustoms({
  balance,
  customsMods,
  kitItems,
  inventory,
  rifleRoundCounts = {},
  customBarrels = {},
  spareBarrels = [],
  onBuyService,
  onSetBoltKnobColor,
  onOrderHomeLoads,
  onReplaceBarrel,
  onInstallCustomBarrel,
  onReinstallSpareBarrel,
  onFluteCustomBarrel,
  onLeave,
}: CbCustomsProps) {
  const [status, setStatus] = useState("");
  const [boltKnobPick, setBoltKnobPick] = useState(
    () =>
      customsMods.customBoltKnob
        ? customsMods.boltKnobColor
        : DEFAULT_BOLT_KNOB_COLOR,
  );
  const [homeLoadAmmoId, setHomeLoadAmmoId] = useState(
    () => Object.values(HOME_LOAD_AMMO_BY_CALIBER)[0] ?? "",
  );
  const [homeLoadRounds, setHomeLoadRounds] = useState(HOME_LOAD_ORDER_ROUNDS);
  const [barrelConfig, setBarrelConfig] = useState<CustomBarrelConfig>(() =>
    createDefaultCustomBarrelConfig("krieger"),
  );

  const rifle = useMemo(
    () => kitItems.find(isRifleItem) ?? null,
    [kitItems],
  );
  const rifleRounds = rifle
    ? getRifleRoundCount(rifleRoundCounts, rifle.id)
    : 0;
  const installed = rifle ? customBarrels[rifle.id] : undefined;
  const wearMaterial = barrelWearMaterialFromCustom(installed);
  const rifleWearScale = barrelWearMoaScale(rifleRounds, wearMaterial);
  const factoryLengthIn = rifle ? factoryBarrelLengthIn(rifle.id) : 24;
  const kitAmmo = useMemo(
    () => kitItems.find(isAmmoItem) ?? null,
    [kitItems],
  );
  const previewV0Factor = useMemo(() => {
    if (!rifle) return 1;
    return barrelLengthV0Factor(barrelConfig.lengthIn, factoryLengthIn);
  }, [rifle, barrelConfig.lengthIn, factoryLengthIn]);
  const previewV0Mps =
    kitAmmo && rifle
      ? Math.max(
          50,
          Math.round(kitAmmo.ammo.v0 * previewV0Factor),
        )
      : null;
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
        hasCustomBarrel: !!installed,
      }),
    [customsMods, rifle, stock, installed],
  );

  const moaDelta = customsBeddingMoaDelta(customsMods);

  const homeLoadOptions = useMemo(() => {
    return Object.entries(HOME_LOAD_AMMO_BY_CALIBER).map(([caliber, id]) => {
      const item = getShopItem(id);
      return {
        id,
        caliber,
        label: item
          ? `${item.brand} ${item.name}`
          : `CB Real loads ${caliber}`,
      };
    });
  }, []);

  const homeLoadCost = homeLoadRounds * HOME_LOAD_PER_ROUND_NOK;
  const ownedHomeLoadQty =
    inventory.find((e) => e.itemId === homeLoadAmmoId)?.qty ?? 0;

  const quote = useMemo(
    () => quoteCustomBarrelNok(barrelConfig, rifle?.id ?? null),
    [barrelConfig, rifle?.id],
  );
  const previewMoa = useMemo(
    () => estimateCustomBarrelMoa(barrelConfig),
    [barrelConfig],
  );
  const previewWeight = useMemo(
    () => estimateCustomBarrelWeightGrams(barrelConfig),
    [barrelConfig],
  );
  const heatPreview = useMemo(
    () => barrelHeatFromCustomConfig(barrelConfig),
    [barrelConfig],
  );
  const makerMeta = barrelMaker(barrelConfig.maker);
  const profileEnabled = canCustomProfile(barrelConfig.material);
  const isSauer = rifle?.id === SAUER_200STR_RIFLE_ID;
  const canRetrofitFlute =
    !!installed &&
    installed.material !== "carbon" &&
    !installed.fluted &&
    !!onFluteCustomBarrel;

  function patchBarrel(partial: Partial<CustomBarrelConfig>) {
    setBarrelConfig((prev) => {
      const next = { ...prev, ...partial };
      if (partial.maker != null) {
        const mats = materialsForMaker(partial.maker);
        if (!mats.includes(next.material)) {
          next.material = "crmo";
        }
      }
      if (partial.lengthIn != null && next.material !== "carbon") {
        const len = partial.lengthIn;
        // Keep relative stations; snap muzzle to new length.
        const oldLenMm = Math.round(prev.lengthIn * 25.4);
        const newLenMm = Math.round(len * 25.4);
        if (oldLenMm > 0 && prev.stations.length > 0) {
          next.stations = prev.stations.map((s) => ({
            ...s,
            fromBreechMm: Math.round(
              (s.fromBreechMm / oldLenMm) * newLenMm,
            ),
          }));
        } else {
          next.stations = defaultSteelStations(len);
        }
      }
      if (next.material === "carbon") next.fluted = false;
      return next;
    });
  }

  useEffect(() => {
    if (customsMods.customBoltKnob) {
      setBoltKnobPick(customsMods.boltKnobColor);
    }
  }, [customsMods.customBoltKnob, customsMods.boltKnobColor]);

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
    if (id === "custom_bolt_knob") {
      onBuyService(id, {
        boltKnobColor: normalizeBoltKnobColor(boltKnobPick),
      });
    } else {
      onBuyService(id);
    }
    setStatus(`${svc.name} bestilt — ${formatPermitFee(svc.priceNok)}`);
  }

  function applyBoltKnobColor(color: string) {
    const next = normalizeBoltKnobColor(color);
    setBoltKnobPick(next);
    if (customsMods.customBoltKnob && onSetBoltKnobColor) {
      onSetBoltKnobColor(next);
    }
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

  function replaceBarrel() {
    if (!rifle) {
      setStatus("Ta med en rifle i kit for å bytte pipe.");
      return;
    }
    if (rifleRounds <= 0 && !installed) {
      setStatus("Pipa er ubrukt — ingen grunn til å bytte ennå.");
      return;
    }
    if (balance < BARREL_REPLACE_NOK) {
      setStatus("Ikke nok penger til standard pipe.");
      return;
    }
    onReplaceBarrel(rifle.id);
    setStatus(
      `Standard pipe på ${rifle.brand} ${rifle.name} — ${formatPermitFee(BARREL_REPLACE_NOK)}. Skuddteller nullstilt` +
        (installed
          ? ", custom pipe i Pipelager. Home loads-oppsett + ammo må kjøpes på nytt."
          : ". Home loads-oppsett + ammo må kjøpes på nytt."),
    );
  }

  function installCustom() {
    if (!rifle) {
      setStatus("Ta med en rifle i kit for custom pipe.");
      return;
    }
    if (balance < quote.totalNok) {
      setStatus("Ikke nok penger til denne pipa.");
      return;
    }
    onInstallCustomBarrel(rifle.id, barrelConfig, quote.totalNok);
    setStatus(
      `Custom ${makerMeta.name} ${materialLabelNb(barrelConfig.material)} montert på ${rifle.brand} ${rifle.name} — ${formatPermitFee(quote.totalNok)}. Gulv ${previewMoa.toFixed(2)} MOA. Home loads-oppsett + ammo må kjøpes på nytt.`,
    );
  }

  function reinstallSpare(storageId: string) {
    if (!rifle || !onReinstallSpareBarrel) return;
    onReinstallSpareBarrel(rifle.id, storageId);
    setStatus("Custom pipe montert fra lager — Home loads-oppsett + ammo må kjøpes på nytt.");
  }

  return (
    <div className="cb-customs">
      <LocationNav onBackToTown={onLeave} />
      <p className="intro-line intro-gift">CB Customs</p>
      <p className="intro-line">
        Børsemaker · CNC-dreiebenk · finish · home loads
      </p>
      <p className="shop-row-note">
        Saldo {formatPermitFee(balance)}
        {moaDelta !== 0
          ? ` · bedding ${moaDelta.toFixed(2)} MOA`
          : ""}
        {weightCut > 0 ? ` · −${formatWeightKg(weightCut)} kitvekt` : ""}
        {customsMods.triggerTuning ? " · trigger tuning" : ""}
        {customsMods.customCamo ? " · custom camo" : ""}
        {customsMods.boltFluting ? " · bolt fluting" : ""}
        {customsMods.bagrider ? " · CB Bagrider" : ""}
        {customsMods.actionTrueing ? " · action trueing" : ""}
        {customsMods.actionTiCoating ? " · action Ti-coating" : ""}
        {customsMods.cheekRiser ? " · cheek riser" : ""}
        {customsMods.buttpad ? " · soft buttpad" : ""}
        {customsMods.barrelCrown ? " · barrel crown" : ""}
        {customsMods.magCapacity15
          ? " · mag 15"
          : customsMods.magCapacity10
            ? " · mag 10"
            : ""}
        {customsMods.toppjaktspulk ? " · CBA toppjaktspulk" : ""}
        {customsMods.customBoltKnob
          ? ` · bolt knob ${customsMods.boltKnobColor}`
          : ""}
      </p>

      <div className="cb-customs-card cb-customs-barrel">
        <div className="cb-customs-card-head">
          <strong>Standard pipe</strong>
          <span>{formatPermitFee(BARREL_REPLACE_NOK)}</span>
        </div>
        <p className="shop-row-note">
          Enkel fabrikk-erstatning — nullstiller skuddteller (
          {BARREL_WEAR_START_CRMo}–{BARREL_WEAR_END_SHOTS} skudd til 2× MOA, CrMo).
          Custom blank legges i pipelager (kastes ikke).
        </p>
        {rifle ? (
          <p className="shop-row-note">
            {rifle.brand} {rifle.name}: {rifleRounds} skudd ·{" "}
            {rifleWearScale.toFixed(2)}× — {barrelWearLabelNb(rifleRounds, wearMaterial)}
            {installed
              ? ` · custom: ${barrelMaker(installed.maker).name} ${materialLabelNb(installed.material)} (${installed.averageBestAccuracyMoa.toFixed(2)} MOA)`
              : ""}
          </p>
        ) : (
          <p className="shop-row-note">Ingen rifle i kit.</p>
        )}
        <button
          type="button"
          className="intro-button"
          disabled={
            !rifle ||
            (rifleRounds <= 0 && !installed) ||
            balance < BARREL_REPLACE_NOK
          }
          onClick={replaceBarrel}
        >
          Bytt til standard pipe
        </button>
      </div>

      {rifle && spareBarrels.length > 0 ? (
        <div className="cb-customs-card cb-customs-spares">
          <div className="cb-customs-card-head">
            <strong>Pipelager</strong>
            <span>{spareBarrels.length} lagret</span>
          </div>
          <p className="shop-row-note">
            Gamle custom piper beholdes her (ikke i Home-inventory) — bytt
            tilbake uten ny bestilling. Visningen gjelder rifla du har i kit.
          </p>
          <ul className="cb-customs-quote-list">
            {spareBarrels.map((b) => {
              const maker = barrelMaker(b.maker).name;
              return (
                <li key={b.storageId}>
                  {maker} {materialLabelNb(b.material)} · {b.lengthIn}" ·{" "}
                  {b.averageBestAccuracyMoa.toFixed(2)} MOA
                  {onReinstallSpareBarrel ? (
                    <>
                      {" "}
                      <button
                        type="button"
                        className="intro-button intro-button--inline"
                        onClick={() => reinstallSpare(b.storageId)}
                      >
                        Monter
                      </button>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <ul className="cb-customs-list">
        {CUSTOMS_SERVICES.map((svc) => {
          const owned = serviceOwned(customsMods, svc.id);
          const canBuy =
            !svc.comingSoon &&
            !owned &&
            !(svc.id === "bedding" && customsMods.pillarBedding) &&
            balance >= svc.priceNok;
          const isBoltKnob = svc.id === "custom_bolt_knob";
          return (
            <li
              key={svc.id}
              className={
                svc.comingSoon
                  ? "cb-customs-card is-coming-soon"
                  : "cb-customs-card"
              }
            >
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
              {isBoltKnob ? (
                <div className="cb-bolt-knob-picker" role="group" aria-label="Bolt knob-farge">
                  <div className="cb-bolt-knob-swatches">
                    {BOLT_KNOB_COLOR_PRESETS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className={
                          boltKnobPick.toLowerCase() === c.toLowerCase()
                            ? "cb-bolt-knob-swatch is-active"
                            : "cb-bolt-knob-swatch"
                        }
                        style={{ background: c }}
                        title={c}
                        aria-label={`Velg ${c}`}
                        onClick={() => applyBoltKnobColor(c)}
                      />
                    ))}
                  </div>
                  <label className="cb-bolt-knob-custom">
                    <span>Egen</span>
                    <input
                      type="color"
                      value={normalizeBoltKnobColor(boltKnobPick)}
                      aria-label="Egen bolt knob-farge"
                      onChange={(e) => applyBoltKnobColor(e.target.value)}
                    />
                  </label>
                  <span
                    className="cb-bolt-knob-preview"
                    style={{ background: normalizeBoltKnobColor(boltKnobPick) }}
                    title="Forhåndsvisning"
                  />
                </div>
              ) : null}
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

      <ExpandableSection
        title="Custom CNC-pipe"
        summary={
          installed
            ? `${barrelMaker(installed.maker).name} ${materialLabelNb(installed.material)} · ${installed.averageBestAccuracyMoa.toFixed(2)} MOA · fra ${formatPermitFee(quote.totalNok)}`
            : `Lothar / Krieger / Bartlein / Proof · fra ${formatPermitFee(quote.totalNok)}`
        }
      >
        <div className="cb-customs-card cb-customs-barrel cb-customs-cnc">
          <p className="shop-row-note">
            Emne fra Lothar Walther, Krieger, Bartlein eller Proof Research.
            CrMo og stainless på alle — SS er{" "}
            {Math.round((STAINLESS_PRICE_MULT - 1) * 100)}% dyrere og{" "}
            {STAINLESS_MOA_BONUS.toFixed(2)} MOA bedre enn CrMo. Carbonfiber
            (Proof) kan ikke custom-profileres.
            {isSauer
              ? ` Sauer 200 STR: +${formatPermitFee(SAUER_200STR_BARREL_SURCHARGE_NOK)}.`
              : ""}
          </p>

          {rifle ? (
            <p className="shop-row-note">
              Kit: {rifle.brand} {rifle.name} · fabrikk{" "}
              {rifle.rifle.averageBestAccuracyMoa.toFixed(2)} MOA
              {installed
                ? ` · montert custom: ${barrelMaker(installed.maker).name} ${materialLabelNb(installed.material)} (${installed.averageBestAccuracyMoa.toFixed(2)} MOA)`
                : ""}
            </p>
          ) : (
            <p className="shop-row-note">Ingen rifle i kit.</p>
          )}

          <div className="cb-customs-barrel-form">
            <label className="sheriff-field">
              Emne
              <select
                className="intro-input"
                value={barrelConfig.maker}
                onChange={(e) =>
                  patchBarrel({ maker: e.target.value as BarrelMakerId })
                }
              >
                {BARREL_MAKERS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (fra {formatPermitFee(m.baseBlankNok)})
                  </option>
                ))}
              </select>
            </label>

            <label className="sheriff-field">
              Materiale
              <select
                className="intro-input"
                value={barrelConfig.material}
                onChange={(e) =>
                  patchBarrel({
                    material: e.target.value as BarrelMaterial,
                  })
                }
              >
                {materialsForMaker(barrelConfig.maker).map((m) => (
                  <option key={m} value={m}>
                    {materialLabelNb(m)}
                  </option>
                ))}
              </select>
            </label>

            <label className="sheriff-field">
              Lengde (tommer)
              <input
                className="intro-input"
                type="number"
                min={BARREL_LENGTH_MIN_IN}
                max={BARREL_LENGTH_MAX_IN}
                step={0.5}
                value={barrelConfig.lengthIn}
                onChange={(e) =>
                  patchBarrel({
                    lengthIn: Number.parseFloat(e.target.value) || 24,
                  })
                }
              />
            </label>
            {rifle && kitAmmo ? (
              <p className="shop-row-note">
                Fabrikk {factoryLengthIn}" → est. v0{" "}
                {Math.round(kitAmmo.ammo.v0)} m/s · valgt{" "}
                {barrelConfig.lengthIn}" → ~{previewV0Mps} m/s (
                {(previewV0Factor * 100).toFixed(1)} %)
              </p>
            ) : null}

            {barrelConfig.material === "carbon" ? (
              <label className="sheriff-field">
                Carbon-kontur (fabrikk)
                <select
                  className="intro-input"
                  value={barrelConfig.carbonContour ?? "hunter"}
                  onChange={(e) =>
                    patchBarrel({
                      carbonContour: e.target.value as CarbonContourId,
                    })
                  }
                >
                  {CARBON_CONTOURS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.note}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <p className="shop-row-note">{makerMeta.note}</p>

          {profileEnabled ? (
            <div className="cb-customs-profile">
              <div className="cb-customs-card-head">
                <strong>Custom profil</strong>
                <button
                  type="button"
                  className="intro-button sheriff-secondary"
                  onClick={() =>
                    patchBarrel({
                      stations: defaultSteelStations(barrelConfig.lengthIn),
                    })
                  }
                >
                  Reset kontur
                </button>
              </div>
              <p className="shop-row-note">
                Diameter (mm) ved avstand fra kammeret. Siste stasjon =
                munningsende.
              </p>
              <ul className="cb-customs-stations">
                {barrelConfig.stations.map((station, idx) => (
                  <li key={`${idx}-${station.fromBreechMm}`}>
                    <label className="sheriff-field">
                      Fra kammer (mm)
                      <input
                        className="intro-input"
                        type="number"
                        min={0}
                        max={Math.round(barrelConfig.lengthIn * 25.4)}
                        step={1}
                        value={station.fromBreechMm}
                        disabled={
                          idx === 0 ||
                          idx === barrelConfig.stations.length - 1
                        }
                        onChange={(e) => {
                          const v = Number.parseInt(e.target.value, 10);
                          if (!Number.isFinite(v)) return;
                          const stations = barrelConfig.stations.map(
                            (s, i) =>
                              i === idx ? { ...s, fromBreechMm: v } : s,
                          );
                          patchBarrel({ stations });
                        }}
                      />
                    </label>
                    <label className="sheriff-field">
                      Ø (mm)
                      <input
                        className="intro-input"
                        type="number"
                        min={14}
                        max={38}
                        step={0.1}
                        value={station.diameterMm}
                        onChange={(e) => {
                          const v = Number.parseFloat(e.target.value);
                          if (!Number.isFinite(v)) return;
                          const stations = barrelConfig.stations.map(
                            (s, i) =>
                              i === idx ? { ...s, diameterMm: v } : s,
                          );
                          patchBarrel({ stations });
                        }}
                      />
                    </label>
                    {idx > 0 && idx < barrelConfig.stations.length - 1 ? (
                      <button
                        type="button"
                        className="intro-button sheriff-secondary"
                        onClick={() =>
                          patchBarrel({
                            stations: barrelConfig.stations.filter(
                              (_, i) => i !== idx,
                            ),
                          })
                        }
                      >
                        Fjern
                      </button>
                    ) : (
                      <span className="cb-customs-station-spacer" />
                    )}
                  </li>
                ))}
              </ul>
              {barrelConfig.stations.length < 8 ? (
                <button
                  type="button"
                  className="intro-button sheriff-secondary"
                  onClick={() => {
                    const lenMm = Math.round(barrelConfig.lengthIn * 25.4);
                    const mid = Math.round(lenMm / 2);
                    const stations = [...barrelConfig.stations];
                    const insertAt = Math.max(1, stations.length - 1);
                    const prevD =
                      stations[insertAt - 1]?.diameterMm ?? 24;
                    const nextD = stations[insertAt]?.diameterMm ?? 20;
                    stations.splice(insertAt, 0, {
                      fromBreechMm: mid,
                      diameterMm:
                        Math.round(((prevD + nextD) / 2) * 10) / 10,
                    });
                    patchBarrel({ stations });
                  }}
                >
                  + Stasjon
                </button>
              ) : null}
            </div>
          ) : (
            <p className="shop-row-note cb-customs-carbon-lock">
              Carbonfiber kan ikke custom-profileres på CNC — velg
              fabrikkontur over.
            </p>
          )}

          {profileEnabled ? (
            <label className="cb-customs-flute">
              <input
                type="checkbox"
                checked={!!barrelConfig.fluted}
                onChange={(e) => patchBarrel({ fluted: e.target.checked })}
              />
              <span>
                Fluting / rilling (+{formatPermitFee(FLUTING_LABOUR_NOK)}) —
                kjøler raskere på banen (2 %/s). Merkes permanent på pipa.
              </span>
            </label>
          ) : null}

          {installed?.fluted ? (
            <p className="shop-row-note">
              Montert pipe er allerede fluted — den kan ikke rilles på nytt.
              Ny bestilling kan fortsatt bestilles med fluting.
            </p>
          ) : null}

          {canRetrofitFlute ? (
            <div className="cb-customs-flute-retrofit">
              <p className="shop-row-note">
                Eksisterende custom-pipe er ikke fluted. Rill den én gang for{" "}
                {formatPermitFee(FLUTING_RETROFIT_NOK)}.
              </p>
              <button
                type="button"
                className="intro-button sheriff-secondary"
                disabled={balance < FLUTING_RETROFIT_NOK}
                onClick={() => {
                  if (!rifle || !onFluteCustomBarrel) return;
                  onFluteCustomBarrel(rifle.id, FLUTING_RETROFIT_NOK);
                  setStatus("Pipe flutet — bedre kjøling på banen.");
                }}
              >
                Rill eksisterende pipe
              </button>
            </div>
          ) : installed && installed.material !== "carbon" && installed.fluted ? (
            <p className="shop-row-note">
              ✓ Montert pipe: fluted
            </p>
          ) : null}

          <p className="shop-row-note">
            Inkl. barrel crown og action trueing. Etter pipebytte nullstilles
            Home loads i lager, og Home loads-oppsett må kjøpes på nytt før du
            kan bestille mer ammo. Slitasje: CrMo/carbon{" "}
            {BARREL_WEAR_START_CRMo} skudd, stainless {BARREL_WEAR_START_STAINLESS}{" "}
            skudd før MOA stiger.
          </p>

          <div className="cb-customs-quote">
            <p className="shop-row-note">
              Est. gulv {previewMoa.toFixed(2)} MOA · ~{previewWeight} g
              {barrelConfig.material === "stainless"
                ? ` · SS −${STAINLESS_MOA_BONUS.toFixed(2)} MOA vs CrMo`
                : ""}
            </p>
            <p className="shop-row-note cb-customs-heat-preview">
              Barrel heat: {formatBarrelHeatPreview(heatPreview, 10)}
              {heatPreview.isVarmintClass
                ? " · min Ø ≥ 19 mm → varmint"
                : heatPreview.isCarbon
                  ? ""
                  : " · tynnere kontur → 10 %/skudd"}
            </p>
            <ul className="cb-customs-quote-list">
              <li>Emne / kammer: {formatPermitFee(quote.blankNok)}</li>
              {quote.profileNok > 0 ? (
                <li>CNC-profil: {formatPermitFee(quote.profileNok)}</li>
              ) : (
                <li>CNC-profil: — (carbon)</li>
              )}
              {quote.flutingNok > 0 ? (
                <li>Fluting: {formatPermitFee(quote.flutingNok)}</li>
              ) : null}
              <li>Montering: {formatPermitFee(quote.installNok)}</li>
              <li>Barrel crown: {formatPermitFee(quote.crownNok)}</li>
              <li>Action trueing: {formatPermitFee(quote.trueingNok)}</li>
              {quote.sauerNok > 0 ? (
                <li>Sauer 200 STR: {formatPermitFee(quote.sauerNok)}</li>
              ) : null}
              {quote.stainlessExtraNok > 0 ? (
                <li>
                  Stainless +
                  {Math.round((STAINLESS_PRICE_MULT - 1) * 100)}%:{" "}
                  {formatPermitFee(quote.stainlessExtraNok)}
                </li>
              ) : null}
              <li>
                <strong>Totalt {formatPermitFee(quote.totalNok)}</strong>
              </li>
            </ul>
          </div>

          <button
            type="button"
            className="intro-button"
            disabled={!rifle || balance < quote.totalNok}
            onClick={installCustom}
          >
            Bestill custom pipe
          </button>
        </div>
      </ExpandableSection>

      {customsMods.homeLoadsSetup ? (
        <div className="cb-customs-homeload">
          <p className="intro-line intro-gift">Bestill CB Real loads</p>
          <p className="shop-row-note">
            {HOME_LOAD_PER_ROUND_NOK},-/skudd · du har {ownedHomeLoadQty}{" "}
            patroner av valgt type
            {rifle
              ? ` · kit-rifle: ${rifle.brand} ${rifle.name}`
              : " · ingen rifle i kit (velg kaliber manuelt)"}
            . Bruker dine data fra Hjem → CB Real loads.
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
