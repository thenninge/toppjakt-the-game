"use client";

import {
  useCallback,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  isBipodItem,
  isMiscItem,
  isMountItem,
  isRifleItem,
  isScopeItem,
  isStockItem,
  isSuppressorItem,
  type ShopItem,
} from "@/lib/shop/types";
import { formatWeightKg, resolveWeightGrams } from "@/lib/shop/weights";
import { isSuppressorCoverMisc } from "@/lib/misc/spec";
import {
  isShotCamItemId,
  resolveShotCamKind,
  shotCamLabel,
  type ShotCamKind,
} from "@/lib/hunt/shoot";
import {
  CUSTOMS_SERVICES,
  customsMagCapacity,
  type CustomsMods,
  type CustomsService,
} from "@/lib/customs/spec";
import type { InstalledCustomBarrel } from "@/lib/customs/customBarrel";
import { resolveMuzzleOdMm } from "@/lib/suppressor/poiShift";
import { scopeObjectiveDiameterMm } from "@/lib/optics/spec";
import {
  formatTubeDiameterMm,
  mountTierLabelNb,
} from "@/lib/mount/spec";

export type CurrentRigAdmireProps = {
  kitItems: ShopItem[];
  customsMods: CustomsMods;
  /** Installed CB pipes — muzzle OD / fluting for Admire. */
  customBarrels?: Record<string, InstalledCustomBarrel>;
};

type PartState = "present" | "missing-must";

type RigTipContent = {
  title: string;
  lines: string[];
  missing?: boolean;
};

type RigHoverTip = RigTipContent & {
  x: number;
  y: number;
};

/**
 * Detailed side-view of the packed weapon rig (Amiga window chrome).
 * Must-haves (rifle / scope / mount) render red when missing.
 * Optionals (suppressor + wrap, bipod, stock, bagrider, snow camo, bolt knob,
 * cheek riser, soft buttpad, triggercam / scopemate) render when present.
 * Silhouette varies by kit (stock shape/material, metal finish, barrel,
 * fluting, mag, bipod style, scope tube/objective, can size).
 * Hover a part for name, weight, price and specs.
 */
export function CurrentRigAdmire({
  kitItems,
  customsMods,
  customBarrels = {},
}: CurrentRigAdmireProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [hoverTip, setHoverTip] = useState<RigHoverTip | null>(null);

  const showTip = useCallback(
    (e: ReactMouseEvent, content: RigTipContent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const r = stage.getBoundingClientRect();
      const pad = 10;
      const tipW = 220;
      const tipH = 120;
      let x = e.clientX - r.left + 14;
      let y = e.clientY - r.top + 14;
      if (x + tipW > r.width - pad) x = Math.max(pad, e.clientX - r.left - tipW - 8);
      if (y + tipH > r.height - pad) y = Math.max(pad, e.clientY - r.top - tipH - 8);
      setHoverTip({ ...content, x, y });
    },
    [],
  );
  const clearTip = useCallback(() => setHoverTip(null), []);

  const rifle = kitItems.find(isRifleItem) ?? null;
  const scope = kitItems.find(isScopeItem) ?? null;
  const mount = kitItems.find(isMountItem) ?? null;
  const suppressor = kitItems.find(isSuppressorItem) ?? null;
  const bipod = kitItems.find(isBipodItem) ?? null;
  const stock = kitItems.find(isStockItem) ?? null;
  const wrap =
    kitItems.find((i) => isMiscItem(i) && isSuppressorCoverMisc(i.misc)) ??
    null;
  const shotCamItem =
    kitItems.find((i) => isMiscItem(i) && isShotCamItemId(i.id)) ?? null;
  const shotCamKind = resolveShotCamKind(kitItems.map((i) => i.id));
  const bagrider = customsMods.bagrider;
  const snowCamo = customsMods.customCamo;
  const customKnob = customsMods.customBoltKnob;
  const cheekRiser = customsMods.cheekRiser;
  const softButtpad = customsMods.buttpad;
  const knobColor = customsMods.boltKnobColor;
  const knobShade = darkenHex(knobColor, 0.55);

  const bagriderSvc = customsService("bagrider");
  const camoSvc = customsService("custom_camo");
  const knobSvc = customsService("custom_bolt_knob");
  const cheekSvc = customsService("cheek_riser");
  const buttpadSvc = customsService("buttpad");
  const rigLook = resolveRigLook(rifle, stock, scope, {
    fluting:
      customsMods.fluting ||
      !!(rifle && customBarrels[rifle.id]?.fluted),
    bipod,
    muzzleOdMm: rifle
      ? resolveMuzzleOdMm(rifle.id, customBarrels[rifle.id])
      : null,
    magCapacity: customsMagCapacity(customsMods),
  });
  const stockMain = stockFillClass(rigLook.stockMaterial, "main");
  const stockDark = stockFillClass(rigLook.stockMaterial, "dark");
  const stockLight = stockFillClass(rigLook.stockMaterial, "light");
  const stockStroke = stockStrokeClass(rigLook.stockMaterial);

  const rifleTip: RigTipContent = rifle
    ? tipFromShopItem(rifle, snowCamo ? [`Snøkamo (CB) — ${camoSvc?.effect ?? "+15 % sneak"}`] : undefined)
    : missingTip("Våpen", "Must-have — pakk rifle i kit.");
  const scopeTip: RigTipContent = scope
    ? tipFromShopItem(scope, [
        isScopeItem(scope)
          ? `Rør ${formatTubeDiameterMm(scope.scope.tubeDiameterMm)} · objektiv ${scopeObjectiveDiameterMm(scope.scope, scope.name)} mm`
          : "",
      ].filter(Boolean))
    : missingTip("Kikkert", "Must-have — pakk scope i kit.");
  const mountTip: RigTipContent = mount
    ? tipFromShopItem(mount)
    : missingTip("Montasje", "Must-have — må matche kikkertens rørdiameter.");
  const bipodTip = bipod ? tipFromShopItem(bipod) : null;
  const stockTip = stock
    ? tipFromShopItem(
        stock,
        snowCamo ? [`Snøkamo (CB) på stokk/forend`] : undefined,
      )
    : null;
  const suppressorTip = suppressor ? tipFromShopItem(suppressor) : null;
  const wrapTip = wrap ? tipFromShopItem(wrap) : null;
  const shotCamTip = shotCamItem
    ? tipFromShopItem(shotCamItem)
    : shotCamKind
      ? { title: shotCamLabel(shotCamKind), lines: ["Kamera på okular"] }
      : null;
  const bagriderTip = bagrider && bagriderSvc ? tipFromCustoms(bagriderSvc) : null;
  const cheekTip =
    cheekRiser && cheekSvc ? tipFromCustoms(cheekSvc) : null;
  const buttpadTip =
    softButtpad && buttpadSvc ? tipFromCustoms(buttpadSvc) : null;
  const knobTip = customKnob
    ? tipFromCustoms(knobSvc ?? {
        id: "custom_bolt_knob",
        name: "Custom bolt knob",
        priceNok: 1000,
        effect: "10% raskere omlading (kortere delay mellom skudd).",
      }, [`Farge ${knobColor}`])
    : rifle
      ? {
          title: "Bolt knob (fabrikk)",
          lines: ["Standard knott på våpenet"],
        }
      : missingTip("Bolt knob", "Tegnes med våpenet når rifle er i kit.");

  const rifleState: PartState = rifle ? "present" : "missing-must";
  const scopeState: PartState = scope ? "present" : "missing-must";
  const mountState: PartState = mount ? "present" : "missing-must";

  const suppressorScale = suppressor
    ? suppressorVisualScale(suppressor)
    : 1;

  const missingMust = [
    rifleState === "missing-must" ? "våpen" : null,
    scopeState === "missing-must" ? "kikkert" : null,
    mountState === "missing-must" ? "montasje" : null,
  ].filter(Boolean) as string[];

  const rifleTone =
    rifleState === "missing-must"
      ? "rig-detail-miss"
      : snowCamo
        ? `rig-detail-ok rig-snowcamo rig-metal-${rigLook.metalFinish}`
        : `rig-detail-ok rig-metal-${rigLook.metalFinish}`;

  const snowFill =
    snowCamo && rifleState === "present"
      ? ({ fill: "url(#rigSnowCamo)" } as const)
      : {};

  return (
    <div className="rig-admire">
      <div className="rig-admire-window">
        <div className="rig-admire-titlebar">
          <span className="rig-admire-gadget" />
          <span className="rig-admire-titlebar-text">CURRENT RIG · 2.4</span>
          <span className="rig-admire-gadget rig-admire-gadget-depth" />
        </div>
        <div className="rig-admire-stage" ref={stageRef}>
          <svg
            className="rig-admire-svg"
            viewBox="0 0 640 200"
            width="100%"
            height="100%"
            role="img"
            aria-label="Detaljert silhuett av current rig — hover del for detaljer"
          >
            <defs>
              <linearGradient id="rigFloor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#004488" stopOpacity="0" />
                <stop offset="100%" stopColor="#002244" stopOpacity="0.85" />
              </linearGradient>
              <filter id="rigSoft" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow
                  dx="0"
                  dy="1.5"
                  stdDeviation="1.2"
                  floodColor="#001122"
                  floodOpacity="0.45"
                />
              </filter>
              <pattern
                id="rigSnowCamo"
                patternUnits="userSpaceOnUse"
                width="28"
                height="20"
              >
                <rect width="28" height="20" fill="#eef2f6" />
                <ellipse cx="6" cy="5" rx="7" ry="4" fill="#c5ced6" />
                <ellipse cx="20" cy="12" rx="8" ry="5" fill="#a8b4bc" />
                <ellipse cx="14" cy="16" rx="5" ry="3" fill="#ffffff" />
                <ellipse cx="24" cy="3" rx="4" ry="3" fill="#8a9aa4" />
                <ellipse cx="3" cy="15" rx="4" ry="2.5" fill="#d8e0e6" />
              </pattern>
              <pattern
                id="rigWrapWeave"
                patternUnits="userSpaceOnUse"
                width="6"
                height="6"
              >
                <rect width="6" height="6" fill="#5a4a32" />
                <path
                  d="M0 3h6M3 0v6"
                  stroke="#6e5a3e"
                  strokeWidth="0.8"
                  opacity="0.85"
                />
                <path
                  d="M0 0h6M0 6h6"
                  stroke="#3e3220"
                  strokeWidth="0.5"
                  opacity="0.5"
                />
              </pattern>
              <pattern
                id="rigCarbonWeave"
                patternUnits="userSpaceOnUse"
                width="10"
                height="10"
              >
                <rect width="10" height="10" fill="#1c1e24" />
                <path
                  d="M0 0l10 10M-2 8l4 4M8-2l4 4"
                  stroke="#2e323c"
                  strokeWidth="2.2"
                />
                <path
                  d="M10 0L0 10M12 2l-4 4M2 12l-4-4"
                  stroke="#0e1014"
                  strokeWidth="2.2"
                />
                <path
                  d="M0 5h10M5 0v10"
                  stroke="#3a3e48"
                  strokeWidth="0.4"
                  opacity="0.35"
                />
              </pattern>
            </defs>

            <rect x="0" y="0" width="640" height="200" fill="#0055aa" />
            <rect x="0" y="150" width="640" height="50" fill="url(#rigFloor)" />
            {/* subtle grid */}
            <g opacity="0.12" stroke="#ffffff" strokeWidth="0.5">
              {Array.from({ length: 16 }, (_, i) => (
                <line
                  key={`v${i}`}
                  x1={40 * i}
                  y1="0"
                  x2={40 * i}
                  y2="200"
                />
              ))}
              {Array.from({ length: 5 }, (_, i) => (
                <line
                  key={`h${i}`}
                  x1="0"
                  y1={40 * i}
                  x2="640"
                  y2={40 * i}
                />
              ))}
            </g>

            <g filter="url(#rigSoft)" transform="translate(640 0) scale(-1 1)">
              {/* --- Bagrider (optional, under butt) --- */}
              {bagrider && bagriderTip ? (
                <RigHotspot
                  tip={bagriderTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <ellipse
                    className="rig-fill-cloth"
                    cx="520"
                    cy="148"
                    rx="38"
                    ry="14"
                  />
                  <ellipse
                    className="rig-fill-cloth-dark"
                    cx="520"
                    cy="152"
                    rx="28"
                    ry="8"
                  />
                  <path
                    className="rig-fill-cloth-light"
                    d="M492 142c8-6 48-6 56 0c-6 4-18 6-28 6s-22-2-28-6z"
                  />
                </RigHotspot>
              ) : null}

              {/* --- Bipod (optional) --- */}
              {bipod && bipodTip ? (
                <RigHotspot
                  tip={bipodTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <BipodSilhouette
                    style={rigLook.bipodStyle}
                    scale={rigLook.bipodScale}
                  />
                </RigHotspot>
              ) : null}

              {/* --- Rifle (body; stock nested when aftermarket) --- */}
              <RigHotspot
                tip={rifleTip}
                onShow={showTip}
                onClear={clearTip}
                className={rifleTone}
              >
                {/* Barrel taper — scale lite/carbon thin, varmint/tac heavy */}
                <g
                  transform={`translate(126 96) scale(${rigLook.barrelScale}) translate(-126 -96)`}
                >
                  <path
                    className="rig-fill-metal"
                    d="M128 92h168l2 5H126z"
                  />
                  <path
                    className="rig-fill-metal-dark"
                    d="M128 97h170l-1 3H129z"
                  />
                  <path
                    className="rig-fill-metal-light"
                    d="M130 93h160v1.5H130z"
                    opacity="0.7"
                  />
                  {rigLook.fluted ? (
                    <g className="rig-barrel-flutes" opacity="0.72">
                      {/* Longitudinal flutes along the barrel outer surface */}
                      {[0, 1, 2, 3, 4].map((i) => {
                        const y = 93.15 + i * 0.95;
                        return (
                          <path
                            key={`flute-l-${i}`}
                            fill="none"
                            stroke="currentColor"
                            className="rig-stroke-flute"
                            strokeWidth="0.7"
                            d={`M136 ${y.toFixed(2)} H286`}
                          />
                        );
                      })}
                    </g>
                  ) : null}
                  {/* Muzzle crown / thread */}
                  <rect
                    className="rig-fill-metal-dark"
                    x="122"
                    y="91"
                    width="8"
                    height="10"
                    rx="1"
                  />
                  <rect
                    className="rig-fill-metal-light"
                    x="123"
                    y="93"
                    width="2"
                    height="6"
                  />
                </g>

                {/* Forend — shape follows stock family */}
                <path
                  className={stockMain}
                  d={forendPath(rigLook.stockShape, Boolean(stock))}
                  {...snowFill}
                />
                <path
                  className={stockDark}
                  d={
                    rigLook.stockShape === "carbon-slim"
                      ? "M214 111h70v1.5c0 1-1 1.5-2 1.5H216c-1 0-2-0.5-2-1.5z"
                      : "M210 112h78v2c0 1-1 2-2 2H212c-1 0-2-1-2-2z"
                  }
                />
                {rigLook.stockShape === "chassis" ? (
                  <g className="rig-chassis-mlok" opacity="0.7">
                    {[218, 236, 254, 272].map((x) => (
                      <rect
                        key={`mlok-${x}`}
                        className="rig-fill-void"
                        x={x}
                        y="103.5"
                        width="10"
                        height="2.2"
                        rx="0.4"
                      />
                    ))}
                    <path
                      className="rig-fill-accent"
                      d="M210 101.5h88v1.2H210z"
                      opacity="0.45"
                    />
                  </g>
                ) : null}

                {/* Receiver */}
                <path
                  className="rig-fill-metal"
                  d="M296 82h98v28H296z"
                />
                <path
                  className="rig-fill-metal-dark"
                  d="M296 104h98v6H296z"
                />
                <path
                  className="rig-fill-metal-light"
                  d="M300 84h90v3H300z"
                  opacity="0.55"
                />
                {/* Ejection port — bolt closed (body fills the port) */}
                <rect
                  className="rig-fill-metal-dark"
                  x="318"
                  y="88"
                  width="42"
                  height="10"
                  rx="1"
                />
                <rect
                  className="rig-fill-metal"
                  x="320"
                  y="89"
                  width="38"
                  height="5"
                  rx="0.5"
                />
                <rect
                  className="rig-fill-metal-light"
                  x="322"
                  y="90"
                  width="20"
                  height="2"
                  opacity="0.45"
                />
                {/* Picatinny rail on receiver */}
                <rect
                  className="rig-fill-metal-dark"
                  x="308"
                  y="78"
                  width="78"
                  height="5"
                  rx="0.5"
                />
                {Array.from({ length: 12 }, (_, i) => (
                  <rect
                    key={`rail${i}`}
                    className="rig-fill-void"
                    x={311 + i * 6.2}
                    y="78.5"
                    width="2.2"
                    height="4"
                  />
                ))}

                {/* Bolt shroud (hevarm + knob tegnes etter stokk/kikkert) */}
                <path
                  className="rig-fill-metal-dark"
                  d="M372 80h18v8h-18z"
                />

                {/* Magazine / floorplate / AICS */}
                <MagazineSilhouette
                  style={rigLook.magStyle}
                  capacity={rigLook.magCapacity}
                />

                {/* Trigger guard + trigger */}
                <path
                  className="rig-stroke-metal"
                  fill="none"
                  strokeWidth="2.2"
                  d="M348 110v14c0 6 5 10 12 10h8c6 0 10-4 10-9v-15"
                />
                <path
                  className="rig-fill-metal-dark"
                  d="M362 112v12c2 3 5 4 7 2v-14z"
                />

                {/* Stock */}
                {stock && stockTip ? (
                  <RigHotspot
                    tip={stockTip}
                    onShow={showTip}
                    onClear={clearTip}
                    stopPropagation
                  >
                    <StockButtSilhouette
                      shape={rigLook.stockShape}
                      stockMain={stockMain}
                      stockDark={stockDark}
                      stockLight={stockLight}
                      snowFill={snowFill}
                      aftermarket
                    />
                    {/* Factory / stock comb — only when no custom cheek */}
                    {!cheekRiser ? (
                      <path
                        className={stockLight}
                        d={
                          rigLook.stockShape === "thumbhole"
                            ? "M432 76h44c3 0 5 2 5 4v5H430v-4c0-3 1-5 2-5z"
                            : "M430 78h48c3 0 5 2 5 4v6H428v-5c0-3 1-5 2-5z"
                        }
                        {...snowFill}
                      />
                    ) : null}
                    {/* Grip texture lines */}
                    <g
                      className={stockStroke}
                      fill="none"
                      strokeWidth="0.8"
                      opacity="0.5"
                    >
                      <path d="M408 100h18" />
                      <path d="M408 104h16" />
                      <path d="M408 108h14" />
                    </g>
                    {/* Thin factory pad when no soft buttpad */}
                    {!softButtpad ? (
                      <>
                        <path
                          className="rig-fill-cloth"
                          d="M508 92h14c3 0 5 2 5 5v28c0 3-2 5-5 5h-14z"
                        />
                        <path
                          className="rig-fill-cloth-dark"
                          d="M520 96h4v28h-4z"
                        />
                      </>
                    ) : null}
                    {cheekTip ? (
                      <CheekRiserHotspot
                        tip={cheekTip}
                        onShow={showTip}
                        onClear={clearTip}
                        fillClass={stockLight}
                        snowFill={snowFill}
                      />
                    ) : null}
                    {buttpadTip ? (
                      <SoftButtpadHotspot
                        tip={buttpadTip}
                        onShow={showTip}
                        onClear={clearTip}
                      />
                    ) : null}
                  </RigHotspot>
                ) : (
                  <>
                    {/* Factory hunting stock */}
                    <StockButtSilhouette
                      shape={rigLook.stockShape}
                      stockMain={stockMain}
                      stockDark={stockDark}
                      stockLight={stockLight}
                      snowFill={snowFill}
                      aftermarket={false}
                    />
                    {!cheekRiser ? (
                      <path
                        className={stockLight}
                        d="M400 90h55v3H400z"
                        opacity="0.45"
                      />
                    ) : null}
                    {!softButtpad ? (
                      <path
                        className="rig-fill-cloth"
                        d="M488 98h12c2 0 4 2 4 4v22c0 2-2 4-4 4h-12z"
                      />
                    ) : null}
                    {cheekTip ? (
                      <CheekRiserHotspot
                        tip={cheekTip}
                        onShow={showTip}
                        onClear={clearTip}
                        fillClass={stockLight}
                        snowFill={snowFill}
                      />
                    ) : null}
                    {buttpadTip ? (
                      <SoftButtpadHotspot
                        tip={buttpadTip}
                        onShow={showTip}
                        onClear={clearTip}
                      />
                    ) : null}
                  </>
                )}
              </RigHotspot>

              {/* --- Mount rings --- */}
              <RigHotspot
                tip={mountTip}
                onShow={showTip}
                onClear={clearTip}
                className={
                  mountState === "missing-must"
                    ? "rig-detail-miss"
                    : "rig-detail-ok"
                }
              >
                {/* Front ring */}
                <path
                  className="rig-fill-metal"
                  d="M318 62h14v18H318z"
                />
                <path
                  className="rig-fill-metal-dark"
                  d="M316 60h18v4H316z"
                />
                <path
                  className="rig-fill-metal-dark"
                  d="M316 78h18v3H316z"
                />
                <circle className="rig-fill-metal-light" cx="325" cy="64" r="1.4" />
                <circle className="rig-fill-metal-light" cx="325" cy="80" r="1.4" />
                {/* Rear ring */}
                <path
                  className="rig-fill-metal"
                  d="M372 62h14v18H372z"
                />
                <path
                  className="rig-fill-metal-dark"
                  d="M370 60h18v4H370z"
                />
                <path
                  className="rig-fill-metal-dark"
                  d="M370 78h18v3H370z"
                />
                <circle className="rig-fill-metal-light" cx="379" cy="64" r="1.4" />
                <circle className="rig-fill-metal-light" cx="379" cy="80" r="1.4" />
                {/* Base clamps to rail */}
                <rect
                  className="rig-fill-metal-dark"
                  x="317"
                  y="80"
                  width="16"
                  height="3"
                  rx="0.5"
                />
                <rect
                  className="rig-fill-metal-dark"
                  x="371"
                  y="80"
                  width="16"
                  height="3"
                  rx="0.5"
                />
              </RigHotspot>

              {/* --- Scope --- */}
              <RigHotspot
                tip={scopeTip}
                onShow={showTip}
                onClear={clearTip}
                className={
                  scopeState === "missing-must"
                    ? "rig-detail-miss"
                    : "rig-detail-ok"
                }
              >
                {/* Tube height from tube Ø; objective bell sized separately */}
                <g
                  transform={`translate(350 55) scale(1 ${rigLook.scopeTubeScale}) translate(-350 -55)`}
                >
                  {/* Main tube */}
                  <rect
                    className="rig-fill-metal"
                    x="300"
                    y="48"
                    width="100"
                    height="14"
                    rx="2"
                  />
                  <rect
                    className="rig-fill-metal-light"
                    x="304"
                    y="50"
                    width="92"
                    height="3"
                    rx="1"
                    opacity="0.5"
                  />
                  {/* Power ring */}
                  <rect
                    className="rig-fill-metal-dark"
                    x="348"
                    y="46"
                    width="14"
                    height="18"
                    rx="1"
                  />
                  {Array.from({ length: 5 }, (_, i) => (
                    <rect
                      key={`pwr${i}`}
                      className="rig-fill-metal-light"
                      x={350}
                      y={48 + i * 3}
                      width="10"
                      height="1"
                      opacity="0.5"
                    />
                  ))}
                  {/* Turrets */}
                  <rect
                    className="rig-fill-metal-dark"
                    x="328"
                    y="40"
                    width="12"
                    height="10"
                    rx="1"
                  />
                  <rect
                    className="rig-fill-metal-light"
                    x="330"
                    y="38"
                    width="8"
                    height="4"
                    rx="1"
                  />
                  <rect
                    className="rig-fill-metal-dark"
                    x="344"
                    y="52"
                    width="10"
                    height="8"
                    rx="1"
                  />
                  {/* Eyepiece */}
                  <path
                    className="rig-fill-metal"
                    d="M396 46h28c3 0 6 3 6 7v8c0 4-3 7-6 7h-28z"
                  />
                  <ellipse
                    className="rig-fill-void"
                    cx="424"
                    cy="57"
                    rx="4"
                    ry="7"
                  />
                  <ellipse
                    className="rig-fill-lens"
                    cx="422"
                    cy="57"
                    rx="2.5"
                    ry="5"
                  />
                  {/* Fast-focus ring */}
                  <rect
                    className="rig-fill-metal-dark"
                    x="400"
                    y="45"
                    width="8"
                    height="20"
                    rx="1"
                  />
                </g>
                {/* Objective bell — scales with objective Ø (x42 / x50 / x56…) */}
                <g
                  transform={`translate(270 55) scale(${rigLook.scopeObjScale}) translate(-270 -55)`}
                >
                  <path
                    className="rig-fill-metal"
                    d={
                      rigLook.scopeObjScale > 1.12
                        ? "M264 40h40c3.5 0 6 2.5 6 7v16c0 4.5-2.5 7-6 7h-40c-5.5 0-11-5.5-11-12v-6c0-6.5 5.5-12 11-12z"
                        : "M268 44h36c2 0 4 2 4 5v12c0 3-2 5-4 5h-36c-4 0-8-4-8-9v-4c0-5 4-9 8-9z"
                    }
                  />
                  <ellipse
                    className="rig-fill-void"
                    cx="270"
                    cy="55"
                    rx={rigLook.scopeObjScale > 1.12 ? 6.5 : 5}
                    ry={rigLook.scopeObjScale > 1.12 ? 10 : 8}
                  />
                  <ellipse
                    className="rig-fill-lens"
                    cx="272"
                    cy="55"
                    rx={rigLook.scopeObjScale > 1.12 ? 4.5 : 3.5}
                    ry={rigLook.scopeObjScale > 1.12 ? 7.5 : 6}
                  />
                </g>
              </RigHotspot>

              {shotCamKind && shotCamTip ? (
                <RigHotspot
                  tip={shotCamTip}
                  onShow={showTip}
                  onClear={clearTip}
                >
                  <ShotCamOnScope kind={shotCamKind} />
                </RigHotspot>
              ) : null}

              {/* Closed bolt: hevarm + knob in nedre posisjon (above trigger, clear of scope) */}
              {rifleState === "present" ? (
                <RigHotspot
                  tip={knobTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <path
                    className="rig-fill-metal"
                    d="M384 88l4 2 6 18-5 2-7-18z"
                  />
                  <path
                    className="rig-fill-metal-dark"
                    d="M386 90l3 1.5 5 15-3.5 1.2z"
                    opacity="0.55"
                  />
                  {customKnob ? (
                    <>
                      <circle
                        cx="396"
                        cy="114"
                        r="8"
                        fill={knobColor}
                        stroke="#0a0c10"
                        strokeWidth="1.5"
                      />
                      <circle cx="396" cy="114" r="4" fill={knobShade} />
                      <circle
                        cx="393.8"
                        cy="111.8"
                        r="1.8"
                        fill="#ffffff"
                        opacity="0.45"
                      />
                    </>
                  ) : (
                    <>
                      <circle
                        className="rig-fill-metal-light"
                        cx="396"
                        cy="114"
                        r="6.5"
                        stroke="#0a0c10"
                        strokeWidth="1"
                      />
                      <circle
                        className="rig-fill-metal-dark"
                        cx="396"
                        cy="114"
                        r="3.2"
                      />
                    </>
                  )}
                </RigHotspot>
              ) : rifleState === "missing-must" ? (
                <RigHotspot
                  tip={knobTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-miss"
                >
                  <path
                    className="rig-fill-metal"
                    d="M384 88l4 2 6 18-5 2-7-18z"
                  />
                  <circle
                    className="rig-fill-metal-light"
                    cx="396"
                    cy="114"
                    r="6.5"
                  />
                  <circle
                    className="rig-fill-metal-dark"
                    cx="396"
                    cy="114"
                    r="3.2"
                  />
                </RigHotspot>
              ) : null}

              {/* --- Suppressor --- */}
              {suppressor && suppressorTip ? (
                <RigHotspot
                  tip={suppressorTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                  transform={`translate(126 96) scale(${suppressorScale}) translate(-126 -96)`}
                >
                  {/* Can body */}
                  <path
                    className="rig-fill-metal"
                    d="M48 86h76c3 0 5 2 5 5v12c0 3-2 5-5 5H48c-3 0-5-2-5-5V91c0-3 2-5 5-5z"
                  />
                  {!wrap ? (
                    <>
                      <path
                        className="rig-fill-metal-light"
                        d="M52 88h68v3H52z"
                        opacity="0.45"
                      />
                      {/* Step / baffle bands */}
                      <rect
                        className="rig-fill-metal-dark"
                        x="62"
                        y="86"
                        width="3"
                        height="22"
                      />
                      <rect
                        className="rig-fill-metal-dark"
                        x="78"
                        y="86"
                        width="3"
                        height="22"
                      />
                      <rect
                        className="rig-fill-metal-dark"
                        x="94"
                        y="86"
                        width="3"
                        height="22"
                      />
                      <rect
                        className="rig-fill-metal-dark"
                        x="110"
                        y="86"
                        width="3"
                        height="22"
                      />
                    </>
                  ) : wrap && wrapTip ? (
                    <RigHotspot
                      tip={wrapTip}
                      onShow={showTip}
                      onClear={clearTip}
                      stopPropagation
                    >
                      <path
                        d="M54 83h64c4 0 7 2 7 6v16c0 4-3 6-7 6H54c-4 0-7-2-7-6V89c0-4 3-6 7-6z"
                        fill="url(#rigWrapWeave)"
                      />
                      <path
                        d="M54 83h64c4 0 7 2 7 6v3H47v-3c0-4 3-6 7-6z"
                        fill="#6e5a3e"
                        opacity="0.55"
                      />
                      <rect
                        x="54"
                        y="84"
                        width="3"
                        height="24"
                        fill="#3e3220"
                        opacity="0.55"
                      />
                      <rect
                        x="115"
                        y="84"
                        width="3"
                        height="24"
                        fill="#3e3220"
                        opacity="0.55"
                      />
                      {Array.from({ length: 5 }, (_, i) => (
                        <path
                          key={`wrapStitch${i}`}
                          d={`M58 ${88 + i * 4}h56`}
                          stroke="#2a2218"
                          strokeWidth="0.6"
                          opacity="0.35"
                          fill="none"
                        />
                      ))}
                    </RigHotspot>
                  ) : null}
                  {/* End cap */}
                  <path
                    className="rig-fill-metal-dark"
                    d="M42 90h8v14H42c-2 0-4-2-4-4v-6c0-2 2-4 4-4z"
                  />
                  <circle className="rig-fill-void" cx="44" cy="97" r="2.2" />
                  {/* Mount collar */}
                  <rect
                    className="rig-fill-metal-dark"
                    x="122"
                    y="89"
                    width="8"
                    height="14"
                    rx="1"
                  />
                </RigHotspot>
              ) : null}
            </g>
          </svg>
          <div className="rig-admire-scanlines" aria-hidden />
          {hoverTip ? (
            <div
              className={
                hoverTip.missing
                  ? "rig-admire-tip is-missing"
                  : "rig-admire-tip"
              }
              style={{ left: hoverTip.x, top: hoverTip.y }}
              role="tooltip"
            >
              <p className="rig-admire-tip-title">{hoverTip.title}</p>
              <ul className="rig-admire-tip-list">
                {hoverTip.lines.map((line, i) => (
                  <li key={`${i}-${line}`}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
      <p className="shop-row-note rig-admire-legend">
        {missingMust.length > 0 ? (
          <>
            Rødt = must-have mangler (
            {missingMust.join(", ")}). Silhuetten speiler pakket
            våpen/stokk/kikkert/demper (kit-selfie: finish, stokkform, mag,
            fluting, tofot, scope). Hover en del for navn, vekt,
            pris og specs. Valgfritt tegnes når det er med (lyddemper, wrap,
            tofot, stokk, bagrider, snøkamo, bolt knob, cheek/buttpad,
            triggercam/scopemate).
          </>
        ) : (
          <>
            Must-have på plass. Silhuetten speiler pakket
            våpen/stokk/kikkert/demper (kit-selfie: finish, stokkform, mag,
            fluting, tofot, scope). Hover en del for
            detaljer.
            {snowCamo ? " Snøkamo (CB) på stokk/forend." : ""}
            {wrap && suppressor ? " Wrap rundt lyddemper." : ""}
            {shotCamKind ? ` ${shotCamLabel(shotCamKind)} på okular.` : ""}
            {customKnob ? ` Bolt knob ${knobColor}.` : ""}
            {cheekRiser ? " Cheek riser." : ""}
            {softButtpad ? " Soft buttpad." : ""}
          </>
        )}
      </p>
    </div>
  );
}

function RigHotspot({
  tip,
  onShow,
  onClear,
  className,
  transform,
  stopPropagation = false,
  children,
}: {
  tip: RigTipContent;
  onShow: (e: ReactMouseEvent, tip: RigTipContent) => void;
  onClear: () => void;
  className?: string;
  transform?: string;
  stopPropagation?: boolean;
  children: ReactNode;
}) {
  return (
    <g
      className={[className, "rig-part-hot"].filter(Boolean).join(" ")}
      transform={transform}
      onMouseEnter={(e) => {
        if (stopPropagation) e.stopPropagation();
        onShow(e, tip);
      }}
      onMouseMove={(e) => {
        if (stopPropagation) e.stopPropagation();
        onShow(e, tip);
      }}
      onMouseLeave={(e) => {
        if (stopPropagation) e.stopPropagation();
        onClear();
      }}
    >
      {children}
    </g>
  );
}

/** Custom comb — always hoverable when owned (factory or aftermarket stock). */
function CheekRiserHotspot({
  tip,
  onShow,
  onClear,
  fillClass,
  snowFill,
}: {
  tip: RigTipContent;
  onShow: (e: ReactMouseEvent, tip: RigTipContent) => void;
  onClear: () => void;
  fillClass: string;
  snowFill: { readonly fill?: string };
}) {
  return (
    <RigHotspot
      tip={tip}
      onShow={onShow}
      onClear={onClear}
      className="rig-detail-ok"
      stopPropagation
    >
      <path
        className={fillClass}
        d="M426 74h54c4 0 7 2 7 5v8H424v-7c0-3 1-6 2-6z"
        {...snowFill}
      />
      <path
        className="rig-fill-cloth-dark"
        d="M430 76h46v2H430z"
        opacity="0.35"
      />
      <path
        className="rig-fill-metal-dark"
        d="M448 86h8v3h-8z"
        opacity="0.55"
      />
    </RigHotspot>
  );
}

/** Thicker soft buttpad — replaces thin factory pad when owned. */
function SoftButtpadHotspot({
  tip,
  onShow,
  onClear,
}: {
  tip: RigTipContent;
  onShow: (e: ReactMouseEvent, tip: RigTipContent) => void;
  onClear: () => void;
}) {
  return (
    <RigHotspot
      tip={tip}
      onShow={onShow}
      onClear={onClear}
      className="rig-detail-ok"
      stopPropagation
    >
      <path
        className="rig-fill-cloth"
        d="M504 88h22c4 0 7 3 7 7v32c0 4-3 7-7 7h-22z"
      />
      <path
        className="rig-fill-cloth-light"
        d="M508 90h14c2 0 4 1 4 3v4H506v-4c0-2 1-3 2-3z"
        opacity="0.55"
      />
      <path
        className="rig-fill-cloth-dark"
        d="M520 94h8v34h-8z"
      />
      <path
        className="rig-fill-cloth-dark"
        d="M506 124h20v4c0 2-2 3-4 3h-12c-2 0-4-1-4-3z"
        opacity="0.7"
      />
    </RigHotspot>
  );
}

type RigStockMaterial = "carbon" | "wood" | "synthetic" | "chassis";
type RigStockShape =
  | "hunting"
  | "chassis"
  | "carbon-slim"
  | "polymer"
  | "thumbhole";
type RigMetalFinish = "blued" | "stainless" | "cerakote-dark" | "cerakote-fde";
type RigMagStyle = "floorplate" | "detachable" | "aics";
type RigBipodStyle = "slim" | "classic" | "heavy";

type RigLook = {
  stockMaterial: RigStockMaterial;
  stockShape: RigStockShape;
  metalFinish: RigMetalFinish;
  magStyle: RigMagStyle;
  /** Rounds — drives Admire mag height. */
  magCapacity: number;
  bipodStyle: RigBipodStyle;
  /** Extra scale on bipod silhouette (light → skinny, heavy → stout). */
  bipodScale: number;
  barrelScale: number;
  scopeObjScale: number;
  scopeTubeScale: number;
  fluted: boolean;
};

function itemHaystack(item: ShopItem | null): string {
  if (!item) return "";
  return [item.id, item.brand, item.name, item.note ?? ""]
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Kit-selfie look from packed rifle / stock / scope (+ CB fluting, bipod). */
function resolveRigLook(
  rifle: ShopItem | null,
  stock: ShopItem | null,
  scope: ShopItem | null,
  opts?: {
    fluting?: boolean;
    bipod?: ShopItem | null;
    muzzleOdMm?: number | null;
    magCapacity?: number;
  },
): RigLook {
  // Prefer aftermarket stock material when packed; else factory rifle stock.
  const stockHay = itemHaystack(stock ?? rifle);
  const rifleHay = itemHaystack(rifle);
  const bipodHay = itemHaystack(opts?.bipod ?? null);

  let stockMaterial: RigStockMaterial = "wood";
  if (
    /carbonwolf|berillium|hnt26|\bors\b/.test(stockHay) ||
    /\bcarbon\b/.test(stockHay)
  ) {
    stockMaterial = "carbon";
  } else if (
    /\bmdt\b|chassis|\blss\b|\bacc\b|tac[-_ ]?a1/.test(stockHay)
  ) {
    stockMaterial = "chassis";
  } else if (
    /biltema|jula|plastic|polymer|synthetic|t3x lite|tikka.*\blite\b/.test(
      stockHay,
    )
  ) {
    stockMaterial = "synthetic";
  } else if (/mcmillan|grs|sauer|walnut/.test(stockHay)) {
    stockMaterial = "wood";
  }

  let stockShape: RigStockShape = "hunting";
  if (stockMaterial === "chassis") {
    stockShape = "chassis";
  } else if (stockMaterial === "carbon") {
    stockShape = "carbon-slim";
  } else if (stockMaterial === "synthetic") {
    stockShape = "polymer";
  } else if (/thumbhole|berserk|sporter.*hole|hullgrep/.test(stockHay)) {
    stockShape = "thumbhole";
  }

  let metalFinish: RigMetalFinish = "blued";
  if (
    /stainless|rustfri|titanium|titan|sako.*85|finnlight|peak/.test(rifleHay)
  ) {
    metalFinish = "stainless";
  } else if (
    /cerakote.*fde|fde|flat dark|coyote|od green|ral.?8000/.test(rifleHay) ||
    (stockMaterial === "chassis" && /hunter|hunting|sporter/.test(stockHay))
  ) {
    metalFinish = "cerakote-fde";
  } else if (
    /cerakote|mdt|chassis|tac[-_ ]?a1|varmint|200\s*str/.test(rifleHay) ||
    stockMaterial === "chassis"
  ) {
    metalFinish = "cerakote-dark";
  }

  let magStyle: RigMagStyle = "floorplate";
  if (stockMaterial === "chassis" || /aics|magwell|pmag/.test(stockHay)) {
    magStyle = "aics";
  } else if (
    stockMaterial === "synthetic" ||
    /detach|avtakbar|tikka|t3x|cz\s*600|remington\s*700/.test(rifleHay)
  ) {
    magStyle = "detachable";
  }

  const magCapacity = Math.max(5, opts?.magCapacity ?? 5);
  if (magCapacity >= 10 && magStyle === "floorplate") {
    magStyle = "detachable";
  }

  // Weight-first bipod silhouette: light = spindly, heavy = stout.
  let bipodStyle: RigBipodStyle = "classic";
  let bipodScale = 1;
  if (opts?.bipod && isBipodItem(opts.bipod)) {
    const g = opts.bipod.weightGrams;
    if (g <= 340) {
      bipodStyle = "slim";
      bipodScale = 0.82 + (g / 340) * 0.14;
    } else if (g >= 620) {
      bipodStyle = "heavy";
      bipodScale = 1.05 + Math.min(0.22, (g - 620) / 800);
    } else {
      bipodStyle = "classic";
      bipodScale = 0.92 + ((g - 340) / 280) * 0.12;
    }
    // Calm still nudges extremes (plastic calm vs RRS).
    if (opts.bipod.bipod.weaponCalm >= 9 && g >= 500) {
      bipodStyle = "heavy";
      bipodScale = Math.max(bipodScale, 1.12);
    }
  } else if (/atlas|accu[- ]?tac|rrs|bt65|fc-/.test(bipodHay)) {
    bipodStyle = "slim";
    bipodScale = 0.9;
  } else if (/harris|caldwell|utg|jula|game[- ]?on|softgun/.test(bipodHay)) {
    bipodStyle = "classic";
  } else if (/magpul|spartan|really right/.test(bipodHay)) {
    bipodStyle = "slim";
    bipodScale = 0.88;
  }

  // Muzzle OD → barrel thickness (16 mm pencil → thin, 20+ → heavy).
  let barrelScale = 1;
  const od = opts?.muzzleOdMm;
  if (typeof od === "number" && Number.isFinite(od) && od > 0) {
    const t = (Math.max(14, Math.min(24, od)) - 14) / 10;
    barrelScale = 0.78 + t * 0.5;
  } else if (
    /carbonwolf|berillium|hnt26|finnlight|peak|\blite\b|hunter light/.test(
      rifleHay,
    )
  ) {
    barrelScale = 0.86;
  } else if (/varmint|varminter|tac[-_ ]?a1|tact|200\s*str/.test(rifleHay)) {
    barrelScale = 1.18;
  } else if (/\bsps\b|american|\.22/.test(rifleHay)) {
    barrelScale = 0.95;
  }
  barrelScale = Math.min(1.32, Math.max(0.78, barrelScale));

  let scopeObjScale = 1;
  let scopeTubeScale = 1;
  if (scope && isScopeItem(scope)) {
    const tube = scope.scope.tubeDiameterMm;
    const objMm = scopeObjectiveDiameterMm(scope.scope, scope.name);
    // Tube thickness (1" → 36 mm).
    scopeTubeScale = Math.min(
      1.22,
      Math.max(0.88, 0.88 + ((tube - 25.4) / (36 - 25.4)) * 0.32),
    );
    // Objective bell (32–56 mm typical).
    scopeObjScale = Math.min(
      1.38,
      Math.max(0.82, 0.82 + ((objMm - 32) / (56 - 32)) * 0.5),
    );
  }

  return {
    stockMaterial,
    stockShape,
    metalFinish,
    magStyle,
    magCapacity,
    bipodStyle,
    bipodScale,
    barrelScale,
    scopeObjScale,
    scopeTubeScale,
    fluted: Boolean(opts?.fluting),
  };
}

function forendPath(shape: RigStockShape, aftermarket: boolean): string {
  if (shape === "chassis") {
    // Thin skeleton rail — not a solid wood forend slab.
    return aftermarket
      ? "M198 100h100c1.5 0 3 1 3.5 2.5l0.5 4c0 1.5-1.5 2.5-3 2.5H197c-1.5 0-3-1-3-2.5v-3c0-2 1.5-3.5 4-3.5z"
      : "M205 101h88c1.5 0 2.5 1 3 2l0.5 3.5c0 1.2-1 2-2.5 2H204c-1.5 0-2.5-0.8-2.5-2v-2.5c0-1.8 1.5-3 3.5-3z";
  }
  if (shape === "carbon-slim") {
    return aftermarket
      ? "M204 100h90c3 0 5 1.5 6 3.5l0.5 5c0 2-1.5 3.5-4 3.5H202c-2.5 0-4-1.5-4-3.5v-3c0-3 2.5-5.5 6-5.5z"
      : "M208 101h84c2.5 0 4 1.5 4.5 3.5v4c0 1.5-1.5 3-3.5 3H207c-2 0-4-1.5-4-3.5v-2.5c0-2.5 2-4.5 5-4.5z";
  }
  if (shape === "polymer") {
    return aftermarket
      ? "M200 99h95c4 0 7 2 8 5l1 6c0 3-2 5-5 5H198c-3 0-5-2-5-5v-4c0-4 3-7 7-7z"
      : "M205 100h88c3 0 5 2 5 4v5c0 2-2 4-4 4H204c-3 0-5-2-5-4v-3c0-3 2-6 6-6z";
  }
  if (shape === "thumbhole") {
    return "M200 99h94c3 0 6 2 7 4.5l1 6c0 2.5-2 4.5-4.5 4.5H198c-3 0-5-2-5-4.5v-4c0-3.5 2.5-6.5 7-6.5z";
  }
  return aftermarket
    ? "M200 99h95c4 0 7 2 8 5l1 6c0 3-2 5-5 5H198c-3 0-5-2-5-5v-4c0-4 3-7 7-7z"
    : "M205 100h88c3 0 5 2 5 4v5c0 2-2 4-4 4H204c-3 0-5-2-5-4v-3c0-3 2-6 6-6z";
}

function MagazineSilhouette({
  style,
  capacity,
}: {
  style: RigMagStyle;
  capacity: number;
}) {
  const tall = capacity >= 15 ? 1.55 : capacity >= 10 ? 1.28 : 1;
  if (style === "aics") {
    return (
      <g
        className="rig-mag-aics"
        transform={`translate(349 118) scale(1 ${tall}) translate(-349 -118)`}
      >
        <path
          className="rig-fill-metal-dark"
          d="M328 110h42l3 16H325z"
        />
        <rect
          className="rig-fill-metal"
          x="332"
          y="112"
          width="34"
          height="4"
        />
        <rect
          className="rig-fill-metal-light"
          x="336"
          y="118"
          width="26"
          height="2"
          opacity="0.45"
        />
        <path
          className="rig-fill-accent"
          d="M340 122h18v2h-18z"
          opacity="0.4"
        />
      </g>
    );
  }
  if (style === "detachable") {
    return (
      <g
        className="rig-mag-detach"
        transform={`translate(349 116) scale(1 ${tall}) translate(-349 -116)`}
      >
        <path
          className="rig-fill-metal-dark"
          d="M332 110h34l1 12h-36z"
        />
        <rect
          className="rig-fill-metal"
          x="335"
          y="112"
          width="28"
          height="3"
        />
        <rect
          className="rig-fill-metal-light"
          x="338"
          y="116"
          width="8"
          height="3"
          rx="0.5"
          opacity="0.55"
        />
      </g>
    );
  }
  return (
    <g
      className="rig-mag-floor"
      transform={`translate(349 115) scale(1 ${tall}) translate(-349 -115)`}
    >
      <path
        className="rig-fill-metal-dark"
        d="M330 110h36l2 10h-40z"
      />
      <rect
        className="rig-fill-metal"
        x="334"
        y="112"
        width="28"
        height="3"
      />
    </g>
  );
}

function StockButtSilhouette({
  shape,
  stockMain,
  stockDark,
  stockLight,
  snowFill,
  aftermarket,
}: {
  shape: RigStockShape;
  stockMain: string;
  stockDark: string;
  stockLight: string;
  snowFill: { readonly fill?: string };
  aftermarket: boolean;
}) {
  if (shape === "chassis") {
    // Skeleton chassis — rails + open cutouts, metallic tactical look.
    return (
      <>
        {/* Top rail */}
        <path
          className={stockMain}
          d="M396 88h100v3.5H396z"
          {...snowFill}
        />
        {/* Bottom rail */}
        <path
          className={stockDark}
          d="M400 116h78v3.5H400z"
        />
        {/* Butt riser / buffer tube area */}
        <path
          className={stockMain}
          d="M486 88h14v32h-14z"
          {...snowFill}
        />
        {/* Vertical webs */}
        <path
          className={stockLight}
          d="M412 91.5h3.5v24.5H412zM438 91.5h3.5v24.5H438zM464 91.5h3.5v24.5H464z"
          opacity="0.85"
        />
        {/* Open lightening cutouts */}
        <path
          className="rig-fill-void"
          d="M418 96h16v14H418z"
          opacity="0.55"
        />
        <path
          className="rig-fill-void"
          d="M444 96h16v14H444z"
          opacity="0.55"
        />
        {/* Cheek / comb thin plate */}
        <path
          className={stockLight}
          d="M404 86h48v2.5H404z"
          opacity="0.55"
        />
        {/* Grip stub (angled skeleton) */}
        <path
          className={stockDark}
          d="M400 119l8 14h-10l-6-10z"
        />
        {/* Pic / QD accents */}
        <path
          className="rig-fill-accent"
          d="M420 102h6v2h-6zM446 102h6v2h-6zM472 102h6v2h-6z"
          opacity="0.55"
        />
        {aftermarket ? (
          <path
            className="rig-fill-metal-light"
            d="M492 92h4v20h-4z"
            opacity="0.45"
          />
        ) : null}
      </>
    );
  }
  if (shape === "carbon-slim") {
    return (
      <>
        <path
          className={stockMain}
          d={
            aftermarket
              ? "M396 88h90c5 0 10 3 12 8l6 18c1 3-1 6-4 7h-24c-2.5 0-4-1.5-5-3.5l-3-7H402c-3.5 0-5.5-2.5-5.5-5.5V93c0-2.5 2-5 5.5-5z"
              : "M396 90h74c6 0 14 5 17 11l9 18c1.5 3 0 6-3.5 7h-16c-2.5 0-4-1.5-5-3.5l-4-8H404c-4 0-7-2.5-7-6V95c0-2.5 2-5 5-5z"
          }
          {...snowFill}
        />
        <path
          className={stockDark}
          d={
            aftermarket
              ? "M414 116h62l5 10h-18l-3-5H416z"
              : "M414 116h48l6 10h-14l-4-6H416z"
          }
        />
      </>
    );
  }
  if (shape === "thumbhole") {
    return (
      <>
        <path
          className={stockMain}
          d="M394 86h96c5 0 11 3 13 9l7 20c1 3-1 6-4 7h-26c-2.5 0-4-1.5-5-3.5l-3-7H400c-3.5 0-6-2.5-6-5.5V92c0-3 2.5-6 6-6z"
          {...snowFill}
        />
        <ellipse
          className="rig-fill-void"
          cx="430"
          cy="108"
          rx="9"
          ry="7"
        />
        <path
          className={stockDark}
          d="M412 118h68l5 10h-20l-3-5H414z"
        />
      </>
    );
  }
  if (shape === "polymer") {
    return (
      <>
        <path
          className={stockMain}
          d={
            aftermarket
              ? "M394 86h95c5 0 11 3.5 13 9l7 20c1 3.5-1 7-4.5 8h-26c-2.5 0-4.5-1.5-5.5-3.5l-3.5-8H400c-3.5 0-5.5-2.5-5.5-5.5V92c0-3 2-6 5.5-6z"
              : "M394 88h78c7 0 16 5 20 12l11 22c1.5 3.5 0 7-3.5 8h-18c-2.5 0-4.5-1.5-5.5-3.5l-5-10H404c-4.5 0-7.5-2.5-7.5-6V94c0-3 2-6 5.5-6z"
          }
          {...snowFill}
        />
        <path
          className={stockDark}
          d={
            aftermarket
              ? "M410 118h70l6 12h-22l-4-6H412z"
              : "M412 118h55l8 14h-18l-5-8H416z"
          }
        />
      </>
    );
  }
  // hunting
  return (
    <>
      <path
        className={stockMain}
        d={
          aftermarket
            ? "M394 86h95c6 0 12 4 14 10l8 22c1 4-1 8-5 9h-28c-3 0-5-2-6-4l-4-10H400c-4 0-6-3-6-6V92c0-3 2-6 6-6z"
            : "M394 88h78c8 0 18 6 22 14l12 24c2 4 0 8-4 9h-20c-3 0-5-2-6-4l-6-12H404c-5 0-8-3-8-7V94c0-3 2-6 6-6z"
        }
        {...snowFill}
      />
      <path
        className={stockDark}
        d={
          aftermarket
            ? "M410 118h70l6 12h-22l-4-6H412z"
            : "M412 118h55l8 14h-18l-5-8H416z"
        }
      />
    </>
  );
}

function BipodSilhouette({
  style,
  scale = 1,
}: {
  style: RigBipodStyle;
  scale?: number;
}) {
  const s = Math.min(1.35, Math.max(0.75, scale));
  const inner =
    style === "slim" ? (
      <g className="rig-bipod-slim">
        <rect
          className="rig-fill-metal"
          x="220"
          y="108"
          width="14"
          height="4"
          rx="1"
        />
        <path
          className="rig-fill-metal-dark"
          d="M224 112l-10 44h3.5l9-40z"
        />
        <path
          className="rig-fill-metal-dark"
          d="M230 112l10 44h-3.5l-9-40z"
        />
        <ellipse
          className="rig-fill-metal"
          cx="215"
          cy="157"
          rx="6"
          ry="2.2"
        />
        <ellipse
          className="rig-fill-metal"
          cx="239"
          cy="157"
          rx="6"
          ry="2.2"
        />
        <circle className="rig-fill-metal-light" cx="227" cy="110" r="2" />
      </g>
    ) : style === "heavy" ? (
      <g className="rig-bipod-heavy">
        <rect
          className="rig-fill-metal"
          x="214"
          y="107"
          width="26"
          height="7"
          rx="1.5"
        />
        <path
          className="rig-fill-metal-dark"
          d="M220 114l-18 44h7l14-38z"
        />
        <path
          className="rig-fill-metal-dark"
          d="M234 114l18 44h-7l-14-38z"
        />
        <ellipse
          className="rig-fill-metal"
          cx="205"
          cy="158"
          rx="12"
          ry="3.5"
        />
        <ellipse
          className="rig-fill-metal"
          cx="249"
          cy="158"
          rx="12"
          ry="3.5"
        />
        <circle className="rig-fill-metal-light" cx="227" cy="110" r="3" />
      </g>
    ) : (
      <g className="rig-bipod-classic">
        <rect
          className="rig-fill-metal"
          x="218"
          y="108"
          width="18"
          height="5"
          rx="1"
        />
        <path
          className="rig-fill-metal-dark"
          d="M222 113l-14 42h5l12-36z"
        />
        <path
          className="rig-fill-metal-dark"
          d="M232 113l14 42h-5l-12-36z"
        />
        <ellipse
          className="rig-fill-metal"
          cx="210"
          cy="156"
          rx="9"
          ry="3"
        />
        <ellipse
          className="rig-fill-metal"
          cx="244"
          cy="156"
          rx="9"
          ry="3"
        />
        <circle className="rig-fill-metal-light" cx="227" cy="110" r="2.5" />
      </g>
    );
  return (
    <g transform={`translate(227 108) scale(${s}) translate(-227 -108)`}>
      {inner}
    </g>
  );
}

function stockFillClass(
  material: RigStockMaterial,
  layer: "main" | "dark" | "light",
): string {
  if (material === "carbon") {
    return layer === "main"
      ? "rig-fill-carbon"
      : layer === "dark"
        ? "rig-fill-carbon-dark"
        : "rig-fill-carbon-light";
  }
  if (material === "synthetic") {
    return layer === "main"
      ? "rig-fill-synthetic"
      : layer === "dark"
        ? "rig-fill-synthetic-dark"
        : "rig-fill-synthetic-light";
  }
  if (material === "chassis") {
    return layer === "main"
      ? "rig-fill-chassis"
      : layer === "dark"
        ? "rig-fill-chassis-dark"
        : "rig-fill-chassis-light";
  }
  return layer === "main"
    ? "rig-fill-wood"
    : layer === "dark"
      ? "rig-fill-wood-dark"
      : "rig-fill-wood-light";
}

function stockStrokeClass(material: RigStockMaterial): string {
  if (material === "carbon") return "rig-stroke-carbon";
  if (material === "synthetic") return "rig-stroke-synthetic";
  if (material === "chassis") return "rig-stroke-chassis";
  return "rig-stroke-wood";
}

function formatPriceNok(nok: number): string {
  return `${Math.max(0, Math.round(nok)).toLocaleString("nb-NO")} kr`;
}

function customsService(id: string): CustomsService | undefined {
  return CUSTOMS_SERVICES.find((s) => s.id === id);
}

function missingTip(title: string, detail: string): RigTipContent {
  return { title: `Mangler: ${title}`, lines: [detail], missing: true };
}

function tipFromCustoms(
  svc: CustomsService,
  extra?: string[],
): RigTipContent {
  return {
    title: svc.name,
    lines: [
      `Pris ${formatPriceNok(svc.priceNok)}`,
      "Customs (CB)",
      svc.effect,
      ...(extra ?? []),
    ],
  };
}

function tipFromShopItem(
  item: ShopItem,
  extra?: string[],
): RigTipContent {
  const grams = resolveWeightGrams(
    item.id,
    item.category,
    item.weightGrams,
  );
  const lines = [
    `Pris ${formatPriceNok(item.priceNok)}`,
    `Vekt ${formatWeightKg(grams)}`,
    ...shopSpecLines(item),
    ...(item.note ? [item.note] : []),
    ...(extra ?? []),
  ];
  const title = item.caliber
    ? `${item.brand} ${item.name} · ${item.caliber}`
    : `${item.brand} ${item.name}`;
  return { title, lines };
}

function shopSpecLines(item: ShopItem): string[] {
  if (isRifleItem(item)) {
    return [
      `Best accuracy ~${item.rifle.averageBestAccuracyMoa.toFixed(2)} MOA`,
    ];
  }
  if (isScopeItem(item)) {
    const s = item.scope;
    const lines = [
      `${s.minZoom}–${s.maxZoom}× · ${s.clickUnit}`,
      `Rør ${formatTubeDiameterMm(s.tubeDiameterMm)}`,
    ];
    if (s.focalPlane) lines.push(s.focalPlane);
    if (s.reticleId) lines.push(`Retikkel ${s.reticleId}`);
    return lines;
  }
  if (isMountItem(item)) {
    return [
      `Rør ${formatTubeDiameterMm(item.mount.tubeDiameterMm)}`,
      mountTierLabelNb(item.mount.tier),
    ];
  }
  if (isSuppressorItem(item)) {
    const db = item.suppressor.soundReductionDb;
    return [`Lydemping ${db} dB`];
  }
  if (isBipodItem(item)) {
    const b = item.bipod;
    return [
      `Calm ${b.weaponCalm}/10 · Deploy ${b.deploySpeed}/10 · Tracking ${b.tracking}/10`,
    ];
  }
  if (isStockItem(item)) {
    const d = item.stock.moaDelta;
    const sign = d > 0 ? "+" : "";
    return [`MOA ${sign}${d.toFixed(2)}`];
  }
  if (isMiscItem(item)) {
    const lines: string[] = [];
    if (item.misc.enduranceGrams > 0) {
      lines.push(`Endurance ${item.misc.enduranceGrams} g-ekv`);
    }
    if (isSuppressorCoverMisc(item.misc)) {
      lines.push("Wrap til lyddemper");
    }
    if (isShotCamItemId(item.id)) {
      lines.push("Kamera på okular");
    }
    return lines;
  }
  return [];
}

/** Phone-cam clip on the ocular — Triggercam sleeker, ScopeMate chunkier. */
function ShotCamOnScope({ kind }: { kind: ShotCamKind }) {
  const isMate = kind === "scopemate";
  const body = isMate ? "#4a5540" : "#1a1c20";
  const bodyDark = isMate ? "#2e3628" : "#0a0c10";
  const bodyLight = isMate ? "#6a7860" : "#3a3e48";
  const led = isMate ? "#44aaff" : "#e02020";
  const phone = isMate ? "#2a3028" : "#111318";

  return (
    <g className="rig-detail-ok" aria-label={shotCamLabel(kind)}>
      {/* Clamp onto eyepiece */}
      <path
        className="rig-fill-metal-dark"
        d="M404 42h18v6H404z"
      />
      <path d={`M408 38h10v6H408z`} fill={bodyDark} />
      {/* Arm up to phone */}
      <path d="M412 28h6v12h-6z" fill={body} />
      <path d="M410 26h10v4H410z" fill={bodyLight} />
      {/* Phone / cam body */}
      {isMate ? (
        <>
          <rect x="402" y="8" width="26" height="20" rx="2" fill={phone} />
          <rect x="405" y="11" width="20" height="14" rx="1" fill={body} />
          <rect x="407" y="13" width="12" height="8" rx="0.5" fill="#1a2830" />
          <circle cx="423" cy="17" r="2.2" fill={bodyLight} />
          <circle cx="423" cy="17" r="1.1" fill="#0a1018" />
        </>
      ) : (
        <>
          <rect x="404" y="10" width="22" height="18" rx="2" fill={phone} />
          <rect x="406" y="12" width="18" height="14" rx="1" fill={body} />
          <rect x="408" y="14" width="10" height="7" rx="0.5" fill="#152028" />
          <circle cx="422" cy="17" r="1.8" fill={bodyLight} />
          <circle cx="422" cy="17" r="0.9" fill="#080c12" />
        </>
      )}
      {/* Rec / status LED */}
      <circle cx={isMate ? 407 : 408} cy={isMate ? 12 : 13} r="1.3" fill={led} />
      <circle
        cx={isMate ? 407 : 408}
        cy={isMate ? 12 : 13}
        r="0.6"
        fill="#ffffff"
        opacity="0.55"
      />
    </g>
  );
}

/** Heavier / quieter cans draw a bit larger on the silhouette. */
function suppressorVisualScale(item: ShopItem): number {
  if (!isSuppressorItem(item)) return 1;
  const grams = resolveWeightGrams(
    item.id,
    item.category,
    item.weightGrams,
  );
  const atten = Math.max(0, -(item.suppressor.soundReductionDb ?? 0));
  const fromWeight = 0.7 + ((grams - 250) / 250) * 0.45;
  const fromDb = 0.85 + (atten / 40) * 0.4;
  const scale = fromWeight * 0.55 + fromDb * 0.45;
  return Math.min(1.45, Math.max(0.75, scale));
}

/** Darken a #rrggbb color for knob shading. */
function darkenHex(hex: string, factor: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#6d7580";
  const n = parseInt(m[1]!, 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function currentRigAdmireSummary(input: {
  kitItems: ShopItem[];
  customsMods: CustomsMods;
}): string {
  const { kitItems, customsMods } = input;
  const hasRifle = kitItems.some(isRifleItem);
  const hasScope = kitItems.some(isScopeItem);
  const hasMount = kitItems.some(isMountItem);
  const hasWrap = kitItems.some(
    (i) => isMiscItem(i) && isSuppressorCoverMisc(i.misc),
  );
  const missing =
    (hasRifle ? 0 : 1) + (hasScope ? 0 : 1) + (hasMount ? 0 : 1);
  const extras = [
    kitItems.some(isSuppressorItem),
    hasWrap,
    kitItems.some(isBipodItem),
    kitItems.some(isStockItem),
    customsMods.bagrider,
    customsMods.customCamo,
    customsMods.customBoltKnob,
    customsMods.cheekRiser,
    customsMods.buttpad,
    resolveShotCamKind(kitItems.map((i) => i.id)) != null,
  ].filter(Boolean).length;
  if (missing > 0) return `${missing} must-have mangler · ${extras} ekstra`;
  return `komplett silhuett · ${extras} ekstra`;
}
