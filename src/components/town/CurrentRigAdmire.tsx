"use client";

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
import { resolveWeightGrams } from "@/lib/shop/weights";
import { isSuppressorCoverMisc } from "@/lib/misc/spec";
import {
  resolveShotCamKind,
  shotCamLabel,
  type ShotCamKind,
} from "@/lib/hunt/shoot";
import type { CustomsMods } from "@/lib/customs/spec";

export type CurrentRigAdmireProps = {
  kitItems: ShopItem[];
  customsMods: CustomsMods;
};

type PartState = "present" | "missing-must";

/**
 * Detailed side-view of the packed weapon rig (Amiga window chrome).
 * Must-haves (rifle / scope / mount) render red when missing.
 * Optionals (suppressor + wrap, bipod, stock, bagrider, snow camo, bolt knob,
 * triggercam / scopemate) render when present.
 */
export function CurrentRigAdmire({
  kitItems,
  customsMods,
}: CurrentRigAdmireProps) {
  const rifle = kitItems.find(isRifleItem) ?? null;
  const scope = kitItems.find(isScopeItem) ?? null;
  const mount = kitItems.find(isMountItem) ?? null;
  const suppressor = kitItems.find(isSuppressorItem) ?? null;
  const bipod = kitItems.find(isBipodItem) ?? null;
  const stock = kitItems.find(isStockItem) ?? null;
  const wrap =
    kitItems.find((i) => isMiscItem(i) && isSuppressorCoverMisc(i.misc)) ??
    null;
  const shotCamKind = resolveShotCamKind(kitItems.map((i) => i.id));
  const bagrider = customsMods.bagrider;
  const snowCamo = customsMods.customCamo;
  const customKnob = customsMods.customBoltKnob;
  const knobColor = customsMods.boltKnobColor;
  const knobShade = darkenHex(knobColor, 0.55);

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
        ? "rig-detail-ok rig-snowcamo"
        : "rig-detail-ok";

  const snowFill =
    snowCamo && rifleState === "present"
      ? ({ fill: "url(#rigSnowCamo)" } as const)
      : {};

  return (
    <div className="rig-admire">
      <div className="rig-admire-window">
        <div className="rig-admire-titlebar">
          <span className="rig-admire-gadget" />
          <span className="rig-admire-titlebar-text">CURRENT RIG · 2.2</span>
          <span className="rig-admire-gadget rig-admire-gadget-depth" />
        </div>
        <div className="rig-admire-stage">
          <svg
            className="rig-admire-svg"
            viewBox="0 0 640 200"
            width="100%"
            height="100%"
            role="img"
            aria-label="Detaljert silhuett av current rig"
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
              {bagrider ? (
                <g className="rig-detail-ok">
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
                </g>
              ) : null}

              {/* --- Bipod (optional) --- */}
              {bipod ? (
                <g className="rig-detail-ok">
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
              ) : null}

              {/* --- Rifle --- */}
              <g className={rifleTone}>
                {/* Barrel taper */}
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

                {/* Forend */}
                {stock ? (
                  <path
                    className="rig-fill-wood"
                    d="M200 99h95c4 0 7 2 8 5l1 6c0 3-2 5-5 5H198c-3 0-5-2-5-5v-4c0-4 3-7 7-7z"
                    {...snowFill}
                  />
                ) : (
                  <path
                    className="rig-fill-wood"
                    d="M205 100h88c3 0 5 2 5 4v5c0 2-2 4-4 4H204c-3 0-5-2-5-4v-3c0-3 2-6 6-6z"
                    {...snowFill}
                  />
                )}
                <path
                  className="rig-fill-wood-dark"
                  d="M210 112h78v2c0 1-1 2-2 2H212c-1 0-2-1-2-2z"
                />

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

                {/* Magazine / floorplate */}
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
                {stock ? (
                  <>
                    {/* Chassis / aftermarket */}
                    <path
                      className="rig-fill-wood"
                      d="M394 86h95c6 0 12 4 14 10l8 22c1 4-1 8-5 9h-28c-3 0-5-2-6-4l-4-10H400c-4 0-6-3-6-6V92c0-3 2-6 6-6z"
                      {...snowFill}
                    />
                    <path
                      className="rig-fill-wood-dark"
                      d="M410 118h70l6 12h-22l-4-6H412z"
                    />
                    {/* Cheek riser */}
                    <path
                      className="rig-fill-wood-light"
                      d="M430 78h48c3 0 5 2 5 4v6H428v-5c0-3 1-5 2-5z"
                      {...snowFill}
                    />
                    {/* Grip texture lines */}
                    <g className="rig-stroke-wood" fill="none" strokeWidth="0.8" opacity="0.5">
                      <path d="M408 100h18" />
                      <path d="M408 104h16" />
                      <path d="M408 108h14" />
                    </g>
                    {/* Buttpad */}
                    <path
                      className="rig-fill-cloth"
                      d="M508 92h14c3 0 5 2 5 5v28c0 3-2 5-5 5h-14z"
                    />
                    <path
                      className="rig-fill-cloth-dark"
                      d="M520 96h4v28h-4z"
                    />
                  </>
                ) : (
                  <>
                    {/* Factory hunting stock */}
                    <path
                      className="rig-fill-wood"
                      d="M394 88h78c8 0 18 6 22 14l12 24c2 4 0 8-4 9h-20c-3 0-5-2-6-4l-6-12H404c-5 0-8-3-8-7V94c0-3 2-6 6-6z"
                      {...snowFill}
                    />
                    <path
                      className="rig-fill-wood-dark"
                      d="M412 118h55l8 14h-18l-5-8H416z"
                    />
                    <path
                      className="rig-fill-wood-light"
                      d="M400 90h55v3H400z"
                      opacity="0.45"
                    />
                    <path
                      className="rig-fill-cloth"
                      d="M488 98h12c2 0 4 2 4 4v22c0 2-2 4-4 4h-12z"
                    />
                  </>
                )}
              </g>

              {/* --- Mount rings --- */}
              <g
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
              </g>

              {/* --- Scope --- */}
              <g
                className={
                  scopeState === "missing-must"
                    ? "rig-detail-miss"
                    : "rig-detail-ok"
                }
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
                {/* Objective bell */}
                <path
                  className="rig-fill-metal"
                  d="M268 44h36c2 0 4 2 4 5v12c0 3-2 5-4 5h-36c-4 0-8-4-8-9v-4c0-5 4-9 8-9z"
                />
                <ellipse
                  className="rig-fill-void"
                  cx="270"
                  cy="55"
                  rx="5"
                  ry="8"
                />
                <ellipse
                  className="rig-fill-lens"
                  cx="272"
                  cy="55"
                  rx="3.5"
                  ry="6"
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

              {shotCamKind ? (
                <ShotCamOnScope kind={shotCamKind} />
              ) : null}

              {/* Closed bolt: hevarm + knob in nedre posisjon (above trigger, clear of scope) */}
              {rifleState === "present" ? (
                <g
                  className="rig-detail-ok"
                  aria-label={customKnob ? `Bolt knob ${knobColor}` : "Bolt knob"}
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
                </g>
              ) : rifleState === "missing-must" ? (
                <g className="rig-detail-miss" aria-label="Bolt knob">
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
                </g>
              ) : null}

              {/* --- Suppressor --- */}
              {suppressor ? (
                <g
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
                  ) : (
                    <g aria-label="Lyddemper-wrap">
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
                    </g>
                  )}
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
                </g>
              ) : null}
            </g>
          </svg>
          <div className="rig-admire-scanlines" />
        </div>
      </div>
      <p className="shop-row-note rig-admire-legend">
        {missingMust.length > 0 ? (
          <>
            Rødt = must-have mangler (
            {missingMust.join(", ")}). Valgfritt tegnes når det er med
            (lyddemper, wrap, tofot, stokk, bagrider, snøkamo, bolt knob,
            triggercam/scopemate).
          </>
        ) : (
          <>
            Must-have på plass.
            {snowCamo ? " Snøkamo (CB) på stokk/forend." : ""}
            {wrap && suppressor ? " Wrap rundt lyddemper." : ""}
            {shotCamKind ? ` ${shotCamLabel(shotCamKind)} på okular.` : ""}
            {customKnob ? ` Bolt knob ${knobColor}.` : ""}
            {" "}
            Store dempere ser litt større ut.
          </>
        )}
      </p>
    </div>
  );
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
    resolveShotCamKind(kitItems.map((i) => i.id)) != null,
  ].filter(Boolean).length;
  if (missing > 0) return `${missing} must-have mangler · ${extras} ekstra`;
  return `komplett silhuett · ${extras} ekstra`;
}
