"use client";

import {
  useCallback,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import {
  isBackpackItem,
  isBallisticsItem,
  isCamoItem,
  isChestrigItem,
  isFoodItem,
  isLrfItem,
  isMiscItem,
  isSkiItem,
  isThermalItem,
  type ShopItem,
} from "@/lib/shop/types";
import { formatWeightKg, resolveWeightGrams } from "@/lib/shop/weights";
import {
  isCamcorderMisc,
  isCamcorderTripodMisc,
  isHeadlampMisc,
} from "@/lib/misc/spec";
import { camoSlot, type CamoSlot } from "@/lib/camo/spec";
import { isThermosFood } from "@/lib/food/spec";
import { camcorderSetupNerveFromMisc } from "@/lib/hunt/shoot";

export type FieldKitAdmireProps = {
  kitItems: ShopItem[];
};

type PartState = "present" | "missing-must" | "absent";

type FieldTipContent = {
  title: string;
  lines: string[];
  missing?: boolean;
};

type FieldHoverTip = FieldTipContent & {
  x: number;
  y: number;
};

const BOOT_SLOTS: ReadonlySet<CamoSlot> = new Set(["boots", "ski_boots"]);
const BODY_CAMO_SLOTS: ReadonlySet<CamoSlot> = new Set([
  "suit",
  "jacket",
  "pants",
  "vest",
  "buff",
  "beanie",
  "cap",
  "gloves",
  "base_layer",
  "down",
  "socks",
]);

/**
 * Field carry silhouette — kit-kit + camo + food extras.
 * Must-haves: sekk; stativ when camcorder is packed (red when missing).
 */
export function FieldKitAdmire({ kitItems }: FieldKitAdmireProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [hoverTip, setHoverTip] = useState<FieldHoverTip | null>(null);

  const showTip = useCallback(
    (e: ReactMouseEvent, content: FieldTipContent) => {
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

  const backpack = kitItems.find(isBackpackItem) ?? null;
  const chestrig = kitItems.find(isChestrigItem) ?? null;
  const habrok =
    kitItems.find(
      (i) => isThermalItem(i) && !!i.thermal.isThermalBinocular,
    ) ?? null;
  const bino = kitItems.find(isLrfItem) ?? habrok ?? null;
  const thermal =
    kitItems.find(
      (i) => isThermalItem(i) && !i.thermal.isThermalBinocular,
    ) ?? null;
  const showBino = bino;
  const showThermal = thermal;

  const boots =
    kitItems.find(
      (i) =>
        (isCamoItem(i) && BOOT_SLOTS.has(camoSlot(i.camo))) ||
        (isSkiItem(i) && i.ski.isBoots),
    ) ?? null;
  const camoPieces = kitItems.filter(
    (i) => isCamoItem(i) && BODY_CAMO_SLOTS.has(camoSlot(i.camo)),
  );
  const camoHero =
    camoPieces.find((i) => isCamoItem(i) && camoSlot(i.camo) === "suit") ??
    camoPieces.find((i) => isCamoItem(i) && camoSlot(i.camo) === "jacket") ??
    camoPieces[0] ??
    null;

  const thermos =
    kitItems.find((i) => isFoodItem(i) && isThermosFood(i.food)) ?? null;
  const lunch =
    kitItems.find(
      (i) =>
        isFoodItem(i) &&
        (i.food.kind === "meal" || i.food.kind === "ready"),
    ) ?? null;
  const camcorder =
    kitItems.find((i) => isMiscItem(i) && isCamcorderMisc(i.misc)) ?? null;
  const tripod =
    kitItems.find((i) => isMiscItem(i) && isCamcorderTripodMisc(i.misc)) ??
    null;
  const headlamp =
    kitItems.find((i) => isMiscItem(i) && isHeadlampMisc(i.misc)) ?? null;
  const skis =
    kitItems.find((i) => isSkiItem(i) && !i.ski.isBoots) ?? null;
  const kestrel = kitItems.find(isBallisticsItem) ?? null;

  const backpackState: PartState = backpack ? "present" : "missing-must";
  const tripodState: PartState = tripod
    ? "present"
    : camcorder
      ? "missing-must"
      : "absent";

  const missingMust = [
    backpackState === "missing-must" ? "sekk" : null,
    tripodState === "missing-must" ? "stativ" : null,
  ].filter(Boolean) as string[];

  function tipFromItem(item: ShopItem, extra?: string[]): FieldTipContent {
    const grams = resolveWeightGrams(item.id, item.category, item.weightGrams);
    return {
      title: `${item.brand} ${item.name}`,
      lines: [
        formatWeightKg(grams),
        `${Math.max(0, Math.round(item.priceNok)).toLocaleString("nb-NO")} kr`,
        ...(extra ?? []),
      ],
    };
  }

  const backpackTip: FieldTipContent = backpack
    ? tipFromItem(backpack, [
        `QR ${backpack.carry.quickRelease}/10 · comfort ${backpack.carry.carryComfort}/10`,
      ])
    : {
        title: "Sekk",
        lines: ["Must-have — pakk backpack i kit."],
        missing: true,
      };
  const chestrigTip = chestrig
    ? tipFromItem(chestrig, [
        `QR ${chestrig.carry.quickRelease}/10 · comfort ${chestrig.carry.carryComfort}/10`,
      ])
    : null;
  const binoTip = showBino
    ? tipFromItem(
        showBino,
        isThermalItem(showBino) && showBino.thermal.isThermalBinocular
          ? ["Termisk binokular — erstatter bino + termisk"]
          : ["LRF / kikkert"],
      )
    : null;
  const thermalTip = showThermal
    ? tipFromItem(showThermal, ["Håndholdt termisk"])
    : null;
  const bootsTip = boots ? tipFromItem(boots, ["Sko / støvler"]) : null;
  const camoTip = camoHero
    ? tipFromItem(camoHero, [
        camoPieces.length > 1
          ? `${camoPieces.length} camo-deler i kit`
          : `Slot ${isCamoItem(camoHero) ? camoSlot(camoHero.camo) : "camo"}`,
        `Sneak ${camoPieces
          .filter(isCamoItem)
          .reduce((s, i) => s + i.camo.sneakPct, 0)}%`,
      ])
    : null;
  const thermosTip = thermos
    ? tipFromItem(thermos, ["Kaffe / varm drikke"])
    : null;
  const lunchTip = lunch
    ? tipFromItem(lunch, [
        isFoodItem(lunch) &&
        lunch.food.kind === "meal" &&
        lunch.food.requiresBoil
          ? "Krever kok (komfyr + gass)"
          : "Klar mat / snacks",
      ])
    : null;
  const camcorderTip = camcorder
    ? tipFromItem(camcorder, ["Ettersøk / skuddmarkør-cue"])
    : null;
  const tripodTip: FieldTipContent = tripod
    ? tipFromItem(tripod, [
        `Oppsett +${Math.round(
          camcorderSetupNerveFromMisc(tripod.misc ?? {}) * 100,
        )} % nerve`,
      ])
    : camcorder
      ? {
          title: "Stativ",
          lines: ["Must-have med camcorder — pakk tripod i kit."],
          missing: true,
        }
      : {
          title: "Stativ",
          lines: ["Valgfritt — tegnes med camcorder."],
        };
  const headlampTip = headlamp
    ? tipFromItem(headlamp, ["Nattgåing etter skuddlys"])
    : null;
  const skisTip = skis ? tipFromItem(skis, ["Ski / truger"]) : null;
  const kestrelTip = kestrel
    ? tipFromItem(kestrel, ["Vær / ballistikk"])
    : null;

  const presentExtras = [
    chestrig && "chestrig",
    showBino && (habrok && showBino === habrok ? "habrok" : "bino"),
    showThermal && "termisk",
    boots && "sko",
    camoHero && "camo",
    thermos && "termos",
    lunch && "mat",
    headlamp && "hodelykt",
    camcorder && "camcorder",
    tripod && "stativ",
    skis && "ski",
    kestrel && "kestrel",
  ].filter(Boolean) as string[];

  return (
    <div className="rig-admire field-kit-admire">
      <div className="rig-admire-window">
        <div className="rig-admire-titlebar">
          <span className="rig-admire-gadget" />
          <span className="rig-admire-titlebar-text">FIELD KIT · 1.1</span>
          <span className="rig-admire-gadget rig-admire-gadget-depth" />
        </div>
        <div className="rig-admire-stage" ref={stageRef}>
          <svg
            className="rig-admire-svg field-kit-admire-svg"
            viewBox="0 0 640 280"
            width="100%"
            height="100%"
            role="img"
            aria-label="Felt-kit silhuett — sekk, chestrig, bino, termisk, sko, camo og mer"
          >
            <defs>
              <linearGradient id="fieldKitFloor" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#004488" stopOpacity="0" />
                <stop offset="100%" stopColor="#002244" stopOpacity="0.85" />
              </linearGradient>
              <filter id="fieldKitSoft" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow
                  dx="0"
                  dy="1.5"
                  stdDeviation="1.2"
                  floodColor="#001122"
                  floodOpacity="0.45"
                />
              </filter>
              <pattern
                id="fieldCamoWeave"
                patternUnits="userSpaceOnUse"
                width="12"
                height="10"
              >
                <rect width="12" height="10" fill="#3a4a32" />
                <ellipse cx="3" cy="3" rx="3" ry="2" fill="#5a6a42" />
                <ellipse cx="9" cy="7" rx="3.5" ry="2.5" fill="#2a3828" />
              </pattern>
            </defs>

            <rect x="0" y="0" width="640" height="280" fill="#0055aa" />
            <rect x="0" y="230" width="640" height="50" fill="url(#fieldKitFloor)" />
            <g opacity="0.1" stroke="#ffffff" strokeWidth="0.5">
              {Array.from({ length: 16 }, (_, i) => (
                <line key={`v${i}`} x1={40 * i} y1="0" x2={40 * i} y2="280" />
              ))}
              {Array.from({ length: 7 }, (_, i) => (
                <line key={`h${i}`} x1="0" y1={40 * i} x2="640" y2={40 * i} />
              ))}
            </g>

            <g filter="url(#fieldKitSoft)">
              {/* Row 1: carry / optics / clothes */}
              <FieldHotspot
                tip={backpackTip}
                onShow={showTip}
                onClear={clearTip}
                className={partTone(backpackState)}
              >
                <g transform="translate(8 8)">
                  <path
                    className="rig-fill-cloth"
                    d="M22 28h52c4 0 8 4 8 10v52c0 6-4 10-10 10H24c-6 0-10-4-10-10V38c0-6 4-10 8-10z"
                  />
                  <path className="rig-fill-cloth-dark" d="M26 40h44v6H26zM26 72h44v4H26z" />
                  <path className="rig-fill-metal" d="M42 20h12v10H42z" />
                  <path className="rig-fill-cloth-dark" d="M18 44c-6 3-10 10-10 16v14c0 3 2 4 4 3l8-5V52z" />
                  <path className="rig-fill-cloth-dark" d="M78 44c6 3 10 10 10 16v14c0 3-2 4-4 3l-8-5V52z" />
                  <SlotLabel x={48} y={118}>SEKK</SlotLabel>
                </g>
              </FieldHotspot>

              {chestrig && chestrigTip ? (
                <FieldHotspot
                  tip={chestrigTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <g transform="translate(108 8)">
                    <path
                      className="rig-fill-cloth-dark"
                      d="M18 36c8-16 42-16 50 0l-6 8c-6-10-28-10-36 0z"
                    />
                    <path
                      className="rig-fill-cloth"
                      d="M22 48h42c3 0 6 2 6 6v28c0 4-3 6-6 6H22c-3 0-6-2-6-6V54c0-4 3-6 6-6z"
                    />
                    <path className="rig-fill-cloth-light" d="M28 54h30v5H28z" opacity="0.45" />
                    <path className="rig-fill-metal" d="M36 62h14v8H36z" />
                    <SlotLabel x={43} y={118}>CHEST</SlotLabel>
                  </g>
                </FieldHotspot>
              ) : null}

              {showBino && binoTip ? (
                <FieldHotspot
                  tip={binoTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <g transform="translate(208 8)">
                    <path className="rig-fill-metal" d="M16 48h24c2 0 4 2 4 5v28c0 3-2 5-4 5H16c-2 0-4-2-4-5V53c0-3 2-5 4-5z" />
                    <path className="rig-fill-metal" d="M48 48h24c2 0 4 2 4 5v28c0 3-2 5-4 5H48c-2 0-4-2-4-5V53c0-3 2-5 4-5z" />
                    <path className="rig-fill-metal-dark" d="M36 58h16v10H36z" />
                    <ellipse className="rig-fill-lens" cx="28" cy="64" rx="7" ry="9" />
                    <ellipse className="rig-fill-lens" cx="60" cy="64" rx="7" ry="9" />
                    <ellipse className="rig-fill-void" cx="28" cy="64" rx="3.5" ry="4.5" />
                    <ellipse className="rig-fill-void" cx="60" cy="64" rx="3.5" ry="4.5" />
                    <SlotLabel x={44} y={118}>
                      {habrok && showBino === habrok ? "HABROK" : "BINO"}
                    </SlotLabel>
                  </g>
                </FieldHotspot>
              ) : null}

              {showThermal && thermalTip ? (
                <FieldHotspot
                  tip={thermalTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <g transform="translate(308 8)">
                    <path
                      className="rig-fill-metal"
                      d="M22 42h44c3 0 6 3 6 7v40c0 4-3 7-6 7H22c-3 0-6-3-6-7V49c0-4 3-7 6-7z"
                    />
                    <ellipse className="rig-fill-void" cx="44" cy="64" rx="14" ry="16" />
                    <ellipse className="rig-fill-lens" cx="44" cy="64" rx="9" ry="10" />
                    <circle className="rig-fill-metal-light" cx="44" cy="64" r="3" opacity="0.6" />
                    <path className="rig-fill-metal-dark" d="M30 88h28v6H30z" />
                    <SlotLabel x={44} y={118}>TERM</SlotLabel>
                  </g>
                </FieldHotspot>
              ) : null}

              {boots && bootsTip ? (
                <FieldHotspot
                  tip={bootsTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <g transform="translate(408 8)">
                    <path
                      className="rig-fill-cloth-dark"
                      d="M18 58h28c2 0 4 1 5 3l12 28c1 3-1 5-4 5H22c-4 0-6-2-7-5L12 66c-1-3 1-8 6-8z"
                    />
                    <path
                      className="rig-fill-cloth"
                      d="M48 58h28c2 0 4 1 5 3l12 28c1 3-1 5-4 5H52c-4 0-6-2-7-5L42 66c-1-3 1-8 6-8z"
                    />
                    <path className="rig-fill-cloth-light" d="M22 72h16v4H22zM52 72h16v4H52z" opacity="0.4" />
                    <SlotLabel x={48} y={118}>SKO</SlotLabel>
                  </g>
                </FieldHotspot>
              ) : null}

              {camoHero && camoTip ? (
                <FieldHotspot
                  tip={camoTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <g transform="translate(518 8)">
                    <path
                      fill="url(#fieldCamoWeave)"
                      d="M28 30h40c4 0 8 3 8 8v20c0 3-2 5-4 5H24c-2 0-4-2-4-5V38c0-5 4-8 8-8z"
                    />
                    <path
                      fill="url(#fieldCamoWeave)"
                      d="M24 64h48c3 0 6 2 6 6v28c0 4-3 6-6 6H24c-3 0-6-2-6-6V70c0-4 3-6 6-6z"
                    />
                    <path className="rig-fill-void" d="M40 38h16v12H40z" opacity="0.35" />
                    <SlotLabel x={48} y={118}>CAMO</SlotLabel>
                  </g>
                </FieldHotspot>
              ) : null}

              {/* Row 2: consumables / night / video / winter */}
              {thermos && thermosTip ? (
                <FieldHotspot
                  tip={thermosTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <g transform="translate(8 132)">
                    <path
                      className="rig-fill-metal"
                      d="M30 18h36c3 0 5 2 5 6v58c0 4-2 6-5 6H30c-3 0-5-2-5-6V24c0-4 2-6 5-6z"
                    />
                    <path className="rig-fill-metal-dark" d="M36 12h24c2 0 3 1 3 3v5H33v-5c0-2 1-3 3-3z" />
                    <path className="rig-fill-metal-light" d="M38 24h20v4H38z" opacity="0.5" />
                    <SlotLabel x={48} y={108}>TERMOS</SlotLabel>
                  </g>
                </FieldHotspot>
              ) : null}

              {lunch && lunchTip ? (
                <FieldHotspot
                  tip={lunchTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <g transform="translate(108 132)">
                    <path
                      className="rig-fill-cloth"
                      d="M18 36h60c3 0 6 2 6 6v32c0 4-3 6-6 6H18c-3 0-6-2-6-6V42c0-4 3-6 6-6z"
                    />
                    <path className="rig-fill-cloth-dark" d="M26 48h44v4H26zM30 58h36v3H30z" />
                    <path className="rig-fill-metal" d="M40 28h16v10H40z" />
                    <SlotLabel x={48} y={108}>MAT</SlotLabel>
                  </g>
                </FieldHotspot>
              ) : null}

              {headlamp && headlampTip ? (
                <FieldHotspot
                  tip={headlampTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <g transform="translate(208 132)">
                    <path
                      className="rig-fill-cloth-dark"
                      d="M16 28c16-12 44-12 60 0l-5 8c-12-8-34-8-48 0z"
                    />
                    <path
                      className="rig-fill-metal"
                      d="M30 36h28c3 0 6 3 6 7v16c0 4-3 7-6 7H30c-3 0-6-3-6-7V43c0-4 3-7 6-7z"
                    />
                    <ellipse className="rig-fill-lens" cx="44" cy="50" rx="9" ry="8" />
                    <ellipse className="rig-fill-void" cx="44" cy="50" rx="4" ry="3.5" />
                    <SlotLabel x={44} y={108}>LYKT</SlotLabel>
                  </g>
                </FieldHotspot>
              ) : null}

              {camcorder && camcorderTip ? (
                <FieldHotspot
                  tip={camcorderTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <g transform="translate(308 132)">
                    <path
                      className="rig-fill-metal"
                      d="M16 32h52c3 0 5 2 5 6v34c0 4-2 6-5 6H16c-3 0-5-2-5-6V38c0-4 2-6 5-6z"
                    />
                    <path className="rig-fill-metal-dark" d="M22 40h24v24H22z" />
                    <ellipse className="rig-fill-void" cx="34" cy="52" rx="8" ry="9" />
                    <ellipse className="rig-fill-lens" cx="34" cy="52" rx="4.5" ry="5" />
                    <path className="rig-fill-metal-light" d="M52 42h12v6H52z" opacity="0.5" />
                    <SlotLabel x={42} y={108}>CAM</SlotLabel>
                  </g>
                </FieldHotspot>
              ) : null}

              {tripodState !== "absent" ? (
                <FieldHotspot
                  tip={tripodTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className={partTone(tripodState)}
                >
                  <g transform="translate(408 132)">
                    <path className="rig-fill-metal" d="M34 12h24c2 0 3 1 3 3v8H31v-8c0-2 1-3 3-3z" />
                    <path className="rig-fill-metal-dark" d="M42 24l-18 58h5l15-48z" />
                    <path className="rig-fill-metal-dark" d="M50 24l18 58h-5l-15-48z" />
                    <path className="rig-fill-metal-dark" d="M44 24v58h4V24z" />
                    <ellipse className="rig-fill-metal" cx="26" cy="84" rx="6" ry="2" />
                    <ellipse className="rig-fill-metal" cx="66" cy="84" rx="6" ry="2" />
                    <ellipse className="rig-fill-metal" cx="46" cy="84" rx="4" ry="1.5" />
                    <SlotLabel x={46} y={108}>STATIV</SlotLabel>
                  </g>
                </FieldHotspot>
              ) : null}

              {skis && skisTip ? (
                <FieldHotspot
                  tip={skisTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <g transform="translate(508 132)">
                    <path
                      className="rig-fill-metal-light"
                      d="M20 78c8-40 14-58 22-62 4-2 6 2 4 8-6 20-10 40-12 54z"
                    />
                    <path
                      className="rig-fill-metal"
                      d="M40 78c8-40 14-58 22-62 4-2 6 2 4 8-6 20-10 40-12 54z"
                    />
                    <path className="rig-fill-cloth-dark" d="M28 52h8v10H28zM48 52h8v10H48z" />
                    <SlotLabel x={46} y={108}>SKI</SlotLabel>
                  </g>
                </FieldHotspot>
              ) : kestrel && kestrelTip ? (
                <FieldHotspot
                  tip={kestrelTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <g transform="translate(508 132)">
                    <path
                      className="rig-fill-metal"
                      d="M28 28h36c2 0 4 2 4 5v44c0 3-2 5-4 5H28c-2 0-4-2-4-5V33c0-3 2-5 4-5z"
                    />
                    <path className="rig-fill-void" d="M34 36h24v18H34z" />
                    <path className="rig-fill-metal-light" d="M36 40h8v3H36zM36 46h14v2H36z" opacity="0.6" />
                    <circle className="rig-fill-cloth-light" cx="46" cy="68" r="4" />
                    <SlotLabel x={46} y={108}>KESTREL</SlotLabel>
                  </g>
                </FieldHotspot>
              ) : null}

              {/* If both skis and kestrel, tuck kestrel left of skis when skis took the slot */}
              {skis && kestrel && kestrelTip ? (
                <FieldHotspot
                  tip={kestrelTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <g transform="translate(568 132) scale(0.85)">
                    <path
                      className="rig-fill-metal"
                      d="M8 28h28c2 0 3 2 3 4v36c0 2-1 4-3 4H8c-2 0-3-2-3-4V32c0-2 1-4 3-4z"
                    />
                    <path className="rig-fill-void" d="M12 34h18v14H12z" />
                    <SlotLabel x={22} y={108}>WX</SlotLabel>
                  </g>
                </FieldHotspot>
              ) : null}
            </g>
          </svg>
          {hoverTip ? (
            <div
              className={
                hoverTip.missing
                  ? "rig-admire-tip is-missing"
                  : "rig-admire-tip"
              }
              style={{ left: hoverTip.x, top: hoverTip.y }}
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
            Rødt = must-have mangler ({missingMust.join(", ")}). Valgfritt
            tegnes når det er i kit (chestrig, bino, termisk, sko, camo, mat,
            termos, lykt, cam, ski…). Hover for detaljer.
          </>
        ) : (
          <>
            Sekk på plass
            {presentExtras.length > 0
              ? ` · ${presentExtras.join(" · ")}`
              : ""}
            . Hover for detaljer.
          </>
        )}
      </p>
    </div>
  );
}

function SlotLabel({
  x,
  y,
  children,
}: {
  x: number;
  y: number;
  children: ReactNode;
}) {
  return (
    <text x={x} y={y} textAnchor="middle" className="field-kit-label">
      {children}
    </text>
  );
}

function partTone(state: PartState): string {
  if (state === "missing-must") return "rig-detail-miss";
  return "rig-detail-ok";
}

function FieldHotspot({
  tip,
  onShow,
  onClear,
  className,
  children,
}: {
  tip: FieldTipContent;
  onShow: (e: ReactMouseEvent, tip: FieldTipContent) => void;
  onClear: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <g
      className={`rig-part-hot ${className ?? ""}`}
      onMouseEnter={(e) => onShow(e, tip)}
      onMouseMove={(e) => onShow(e, tip)}
      onMouseLeave={onClear}
    >
      {children}
    </g>
  );
}

export function fieldKitAdmireSummary(kitItems: ShopItem[]): string {
  const hasPack = kitItems.some(isBackpackItem);
  const hasCam = kitItems.some(
    (i) => isMiscItem(i) && isCamcorderMisc(i.misc),
  );
  const hasTripod = kitItems.some(
    (i) => isMiscItem(i) && isCamcorderTripodMisc(i.misc),
  );
  const missing = (hasPack ? 0 : 1) + (hasCam && !hasTripod ? 1 : 0);

  const extras = [
    kitItems.some(isChestrigItem),
    kitItems.some(isLrfItem) ||
      kitItems.some((i) => isThermalItem(i) && !!i.thermal.isThermalBinocular),
    kitItems.some(
      (i) => isThermalItem(i) && !i.thermal.isThermalBinocular,
    ),
    kitItems.some(
      (i) =>
        (isCamoItem(i) && BOOT_SLOTS.has(camoSlot(i.camo))) ||
        (isSkiItem(i) && i.ski.isBoots),
    ),
    kitItems.some(
      (i) => isCamoItem(i) && BODY_CAMO_SLOTS.has(camoSlot(i.camo)),
    ),
    kitItems.some((i) => isFoodItem(i) && isThermosFood(i.food)),
    kitItems.some(
      (i) =>
        isFoodItem(i) &&
        (i.food.kind === "meal" || i.food.kind === "ready"),
    ),
    kitItems.some((i) => isMiscItem(i) && isHeadlampMisc(i.misc)),
    hasCam,
    hasTripod,
    kitItems.some((i) => isSkiItem(i) && !i.ski.isBoots),
    kitItems.some(isBallisticsItem),
  ].filter(Boolean).length;

  if (missing > 0) return `${missing} must-have mangler · ${extras} ekstra`;
  return `komplett felt · ${extras} ekstra`;
}
