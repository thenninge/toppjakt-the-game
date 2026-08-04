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
  isFoodItem,
  isMiscItem,
  type ShopItem,
} from "@/lib/shop/types";
import { formatWeightKg, resolveWeightGrams } from "@/lib/shop/weights";
import {
  isCamcorderMisc,
  isCamcorderTripodMisc,
  isHeadlampMisc,
} from "@/lib/misc/spec";
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

/**
 * Side-view of field carry (sekk + thermos + mat + cam + stativ + hodelykt).
 * Must-haves: sekk always; stativ when camcorder is packed.
 * Missing must-haves render red (same language as Current rig admire).
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
      const tipH = 110;
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

  const backpackState: PartState = backpack ? "present" : "missing-must";
  const thermosState: PartState = thermos ? "present" : "absent";
  const lunchState: PartState = lunch ? "present" : "absent";
  const camcorderState: PartState = camcorder ? "present" : "absent";
  const tripodState: PartState = tripod
    ? "present"
    : camcorder
      ? "missing-must"
      : "absent";
  const headlampState: PartState = headlamp ? "present" : "absent";

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
  const thermosTip: FieldTipContent | null = thermos
    ? tipFromItem(thermos, ["Kaffe / varm drikke på tur"])
    : null;
  const lunchTip: FieldTipContent | null = lunch
    ? tipFromItem(lunch, [
        isFoodItem(lunch) &&
        lunch.food.kind === "meal" &&
        lunch.food.requiresBoil
          ? "Krever kok (komfyr + gass)"
          : "Klar mat / snacks",
      ])
    : null;
  const camcorderTip: FieldTipContent | null = camcorder
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
  const headlampTip: FieldTipContent | null = headlamp
    ? tipFromItem(headlamp, ["Nattgåing etter skuddlys"])
    : null;

  return (
    <div className="rig-admire field-kit-admire">
      <div className="rig-admire-window">
        <div className="rig-admire-titlebar">
          <span className="rig-admire-gadget" />
          <span className="rig-admire-titlebar-text">FIELD KIT · 1.0</span>
          <span className="rig-admire-gadget rig-admire-gadget-depth" />
        </div>
        <div className="rig-admire-stage" ref={stageRef}>
          <svg
            className="rig-admire-svg field-kit-admire-svg"
            viewBox="0 0 640 200"
            width="100%"
            height="100%"
            role="img"
            aria-label="Felt-kit silhuett — sekk, termos, mat, camcorder, stativ, hodelykt"
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
            </defs>

            <rect x="0" y="0" width="640" height="200" fill="#0055aa" />
            <rect x="0" y="150" width="640" height="50" fill="url(#fieldKitFloor)" />
            <g opacity="0.12" stroke="#ffffff" strokeWidth="0.5">
              {Array.from({ length: 16 }, (_, i) => (
                <line key={`v${i}`} x1={40 * i} y1="0" x2={40 * i} y2="200" />
              ))}
              {Array.from({ length: 5 }, (_, i) => (
                <line key={`h${i}`} x1="0" y1={40 * i} x2="640" y2={40 * i} />
              ))}
            </g>

            <g filter="url(#fieldKitSoft)">
              {/* --- Backpack (must) --- */}
              <FieldHotspot
                tip={backpackTip}
                onShow={showTip}
                onClear={clearTip}
                className={partTone(backpackState)}
              >
                <path
                  className="rig-fill-cloth"
                  d="M48 58h72c6 0 12 6 12 14v70c0 8-6 14-14 14H50c-8 0-14-6-14-14V72c0-8 6-14 12-14z"
                />
                <path
                  className="rig-fill-cloth-dark"
                  d="M52 72h64v8H52zM52 118h64v6H52z"
                />
                <path
                  className="rig-fill-cloth-light"
                  d="M58 64h52c2 0 4 1 4 3v4H54v-4c0-2 2-3 4-3z"
                  opacity="0.55"
                />
                <path
                  className="rig-fill-metal"
                  d="M78 52h12v10H78z"
                />
                <path
                  className="rig-fill-cloth-dark"
                  d="M44 78c-8 4-14 14-14 24v20c0 4 3 6 6 4l12-8V86z"
                />
                <path
                  className="rig-fill-cloth-dark"
                  d="M124 78c8 4 14 14 14 24v20c0 4-3 6-6 4l-12-8V86z"
                />
                <text
                  x="84"
                  y="168"
                  textAnchor="middle"
                  className="field-kit-label"
                >
                  SEKK
                </text>
              </FieldHotspot>

              {/* --- Thermos (optional) --- */}
              {thermosState === "present" && thermosTip ? (
                <FieldHotspot
                  tip={thermosTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <path
                    className="rig-fill-metal"
                    d="M168 70h36c3 0 6 3 6 7v68c0 4-3 7-6 7h-36c-3 0-6-3-6-7V77c0-4 3-7 6-7z"
                  />
                  <path
                    className="rig-fill-metal-dark"
                    d="M174 78h24v58H174z"
                    opacity="0.35"
                  />
                  <path
                    className="rig-fill-metal-light"
                    d="M176 72h20v4H176z"
                    opacity="0.55"
                  />
                  <path
                    className="rig-fill-metal-dark"
                    d="M176 62h20c2 0 4 2 4 4v6h-28v-6c0-2 2-4 4-4z"
                  />
                  <ellipse
                    className="rig-fill-metal-light"
                    cx="186"
                    cy="62"
                    rx="8"
                    ry="3"
                  />
                  <text
                    x="186"
                    y="168"
                    textAnchor="middle"
                    className="field-kit-label"
                  >
                    TERMOS
                  </text>
                </FieldHotspot>
              ) : null}

              {/* --- Lunch / matpakke (optional) --- */}
              {lunchState === "present" && lunchTip ? (
                <FieldHotspot
                  tip={lunchTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <path
                    className="rig-fill-cloth"
                    d="M248 96h70c4 0 8 3 8 8v36c0 5-4 8-8 8h-70c-4 0-8-3-8-8v-36c0-5 4-8 8-8z"
                  />
                  <path
                    className="rig-fill-cloth-light"
                    d="M252 102h62v6H252z"
                    opacity="0.5"
                  />
                  <path
                    className="rig-fill-cloth-dark"
                    d="M260 118h46v4H260zM268 128h30v3H268z"
                  />
                  <path
                    className="rig-fill-metal"
                    d="M278 88h14v10h-14z"
                  />
                  <text
                    x="283"
                    y="168"
                    textAnchor="middle"
                    className="field-kit-label"
                  >
                    MAT
                  </text>
                </FieldHotspot>
              ) : null}

              {/* --- Headlamp (optional) --- */}
              {headlampState === "present" && headlampTip ? (
                <FieldHotspot
                  tip={headlampTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <path
                    className="rig-fill-cloth-dark"
                    d="M360 78c18-14 48-14 66 0l-6 10c-14-10-36-10-50 0z"
                  />
                  <path
                    className="rig-fill-metal"
                    d="M378 86h30c4 0 8 4 8 9v18c0 5-4 9-8 9h-30c-4 0-8-4-8-9V95c0-5 4-9 8-9z"
                  />
                  <ellipse
                    className="rig-fill-lens"
                    cx="393"
                    cy="104"
                    rx="10"
                    ry="9"
                  />
                  <ellipse
                    className="rig-fill-void"
                    cx="393"
                    cy="104"
                    rx="5"
                    ry="4.5"
                  />
                  <circle
                    className="rig-fill-metal-light"
                    cx="393"
                    cy="104"
                    r="2.2"
                    opacity="0.7"
                  />
                  <text
                    x="393"
                    y="168"
                    textAnchor="middle"
                    className="field-kit-label"
                  >
                    LYKT
                  </text>
                </FieldHotspot>
              ) : null}

              {/* --- Camcorder (optional) --- */}
              {camcorderState === "present" && camcorderTip ? (
                <FieldHotspot
                  tip={camcorderTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className="rig-detail-ok"
                >
                  <path
                    className="rig-fill-metal"
                    d="M458 88h58c3 0 6 3 6 7v38c0 4-3 7-6 7h-58c-3 0-6-3-6-7V95c0-4 3-7 6-7z"
                  />
                  <path
                    className="rig-fill-metal-dark"
                    d="M464 96h28v28H464z"
                  />
                  <ellipse
                    className="rig-fill-void"
                    cx="478"
                    cy="110"
                    rx="9"
                    ry="10"
                  />
                  <ellipse
                    className="rig-fill-lens"
                    cx="478"
                    cy="110"
                    rx="5"
                    ry="6"
                  />
                  <path
                    className="rig-fill-metal-light"
                    d="M498 98h14v8H498z"
                    opacity="0.55"
                  />
                  <circle
                    className="rig-fill-cloth-light"
                    cx="508"
                    cy="118"
                    r="3"
                  />
                  <text
                    x="487"
                    y="168"
                    textAnchor="middle"
                    className="field-kit-label"
                  >
                    CAM
                  </text>
                </FieldHotspot>
              ) : null}

              {/* --- Tripod (must when cam packed) --- */}
              {(tripodState === "present" ||
                tripodState === "missing-must") && (
                <FieldHotspot
                  tip={tripodTip}
                  onShow={showTip}
                  onClear={clearTip}
                  className={partTone(tripodState)}
                >
                  <path
                    className="rig-fill-metal"
                    d="M568 72h28c2 0 4 2 4 4v10H564V76c0-2 2-4 4-4z"
                  />
                  <path
                    className="rig-fill-metal-dark"
                    d="M578 86l-22 66h6l18-54z"
                  />
                  <path
                    className="rig-fill-metal-dark"
                    d="M586 86l22 66h-6l-18-54z"
                  />
                  <path
                    className="rig-fill-metal-dark"
                    d="M582 86v66h4V86z"
                  />
                  <ellipse
                    className="rig-fill-metal"
                    cx="558"
                    cy="154"
                    rx="7"
                    ry="2.5"
                  />
                  <ellipse
                    className="rig-fill-metal"
                    cx="606"
                    cy="154"
                    rx="7"
                    ry="2.5"
                  />
                  <ellipse
                    className="rig-fill-metal"
                    cx="584"
                    cy="154"
                    rx="5"
                    ry="2"
                  />
                  <text
                    x="582"
                    y="168"
                    textAnchor="middle"
                    className="field-kit-label"
                  >
                    STATIV
                  </text>
                </FieldHotspot>
              )}
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
            tegnes når det er i kit (termos, matpakke, camcorder, hodelykt).
            Hover for detaljer.
          </>
        ) : (
          <>
            Sekk på plass
            {thermos ? " · termos" : ""}
            {lunch ? " · mat" : ""}
            {headlamp ? " · hodelykt" : ""}
            {camcorder ? " · camcorder" : ""}
            {tripod ? " · stativ" : ""}. Hover for detaljer.
          </>
        )}
      </p>
    </div>
  );
}

function partTone(state: PartState): string {
  if (state === "missing-must") return "rig-detail-miss";
  if (state === "present") return "rig-detail-ok";
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
  const hasThermos = kitItems.some(
    (i) => isFoodItem(i) && isThermosFood(i.food),
  );
  const hasLunch = kitItems.some(
    (i) =>
      isFoodItem(i) && (i.food.kind === "meal" || i.food.kind === "ready"),
  );
  const hasCam = kitItems.some(
    (i) => isMiscItem(i) && isCamcorderMisc(i.misc),
  );
  const hasTripod = kitItems.some(
    (i) => isMiscItem(i) && isCamcorderTripodMisc(i.misc),
  );
  const hasLamp = kitItems.some(
    (i) => isMiscItem(i) && isHeadlampMisc(i.misc),
  );
  const missing =
    (hasPack ? 0 : 1) + (hasCam && !hasTripod ? 1 : 0);
  const extras =
    (hasThermos ? 1 : 0) +
    (hasLunch ? 1 : 0) +
    (hasCam ? 1 : 0) +
    (hasTripod ? 1 : 0) +
    (hasLamp ? 1 : 0);
  if (missing > 0) return `${missing} must-have mangler · ${extras} ekstra`;
  return `komplett felt · ${extras} ekstra`;
}
