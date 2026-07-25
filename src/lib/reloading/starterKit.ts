/**
 * XXL «Fullt hjemmeladingskit» — fixed tools + player-picked caliber/bullet.
 */

/** Shop SKU for the configurable starter package. */
export const RELOAD_STARTER_KIT_ID = "reload-xxl-full-kit";

/** Legacy id (pre-configurable) — treat as same kit. */
export const RELOAD_STARTER_KIT_LEGACY_ID = "reload-xxl-full-kit-308";

/** Tools + primers that do not depend on caliber choice. */
export const RELOAD_STARTER_BASE_IDS = [
  "reload-lee-challenger-t2",
  "reload-lee-safety-scale",
  "reload-lee-hand-primer",
  "reload-lee-primer-pocket-cleaner",
  "reload-lee-powder-funnel",
  "reload-imperial-sizing-wax",
  "reload-rcbs-loading-block",
  "reload-frankford-calipers",
  "reload-cci-200",
] as const;

export type StarterKitCaliberOption = {
  id: string;
  label: string;
  diesId: string;
  brassId: string;
  /** Powder that fits the caliber family. */
  powderId: string;
  bulletIds: string[];
  defaultBulletId: string;
};

/**
 * Calibers with Lee dies + new brass + large-rifle primers in catalog.
 * (.223 omitted — needs small-rifle primers we do not stock yet.)
 */
export const RELOAD_STARTER_CALIBERS: StarterKitCaliberOption[] = [
  {
    id: "308",
    label: ".308 Win",
    diesId: "reload-lee-dies-308",
    brassId: "reload-lapua-brass-308",
    powderId: "reload-norma-203b",
    defaultBulletId: "reload-sierra-mk-168-308",
    bulletIds: [
      "reload-sierra-mk-168-308",
      "reload-sierra-mk-175-308",
      "reload-lapua-scenar-139-308",
      "reload-lapua-lockbase-155-308",
      "reload-hornady-eldm-168-308",
      "reload-berger-hybrid-168-308",
      "reload-berger-vld-185-308",
    ],
  },
  {
    id: "65cm",
    label: "6,5 Creedmoor",
    diesId: "reload-lee-dies-65cm",
    brassId: "reload-lapua-brass-65cm",
    powderId: "reload-hodgdon-h4350",
    defaultBulletId: "reload-hornady-eldm-140-65",
    bulletIds: [
      "reload-hornady-eldm-140-65",
      "reload-hornady-eldx-143-65",
      "reload-lapua-scenar-123-65",
      "reload-lapua-scenar-136-65",
      "reload-lapua-scenar-139-65",
      "reload-sierra-mk-140-65",
      "reload-berger-hybrid-140-65",
    ],
  },
  {
    id: "65x55",
    label: "6,5×55",
    diesId: "reload-lee-dies-65x55",
    brassId: "reload-norma-brass-65x55",
    powderId: "reload-norma-203b",
    defaultBulletId: "reload-lapua-scenar-136-65",
    bulletIds: [
      "reload-lapua-scenar-123-65",
      "reload-lapua-scenar-136-65",
      "reload-lapua-scenar-139-65",
      "reload-sierra-mk-140-65",
      "reload-hornady-eldm-140-65",
      "reload-hornady-eldx-143-65",
      "reload-berger-hybrid-140-65",
    ],
  },
  {
    id: "3006",
    label: ".30-06",
    diesId: "reload-lee-dies-3006",
    brassId: "reload-norma-brass-3006",
    powderId: "reload-norma-mrp",
    defaultBulletId: "reload-sierra-mk-168-308",
    bulletIds: [
      "reload-sierra-mk-168-308",
      "reload-sierra-mk-175-308",
      "reload-lapua-scenar-139-308",
      "reload-lapua-lockbase-155-308",
      "reload-hornady-eldm-168-308",
      "reload-berger-hybrid-168-308",
      "reload-berger-vld-185-308",
    ],
  },
];

export const RELOAD_STARTER_DISCOUNT = 0.7;

export type StarterKitSelection = {
  caliberId: string;
  bulletId: string;
};

export function isReloadStarterKitId(id: string): boolean {
  return id === RELOAD_STARTER_KIT_ID || id === RELOAD_STARTER_KIT_LEGACY_ID;
}

export function getStarterKitCaliber(
  caliberId: string,
): StarterKitCaliberOption | undefined {
  return RELOAD_STARTER_CALIBERS.find((c) => c.id === caliberId);
}

export function resolveStarterKitSelection(
  sel?: Partial<StarterKitSelection> | null,
): StarterKitSelection {
  const cal =
    getStarterKitCaliber(sel?.caliberId ?? "") ?? RELOAD_STARTER_CALIBERS[0]!;
  const bulletId = cal.bulletIds.includes(sel?.bulletId ?? "")
    ? (sel!.bulletId as string)
    : cal.defaultBulletId;
  return { caliberId: cal.id, bulletId };
}

/** Full item id list for a resolved kit choice. */
export function starterKitContentIds(
  sel?: Partial<StarterKitSelection> | null,
): string[] {
  const { caliberId, bulletId } = resolveStarterKitSelection(sel);
  const cal = getStarterKitCaliber(caliberId)!;
  return [
    ...RELOAD_STARTER_BASE_IDS,
    cal.diesId,
    cal.brassId,
    cal.powderId,
    bulletId,
  ];
}
