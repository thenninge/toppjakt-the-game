/**
 * CB Customs — custom CNC barrel blanks (Lothar / Krieger / Bartlein / Proof).
 *
 * Steel (CrMo / stainless) can be contour-profiled on the CNC lathe.
 * Carbon-fiber barrels (Proof) use factory contours only — no custom profile.
 * Stainless is +15% price and −0.02 MOA vs the same blank in CrMo.
 */

import type { RifleSpec } from "@/lib/rifle/spec";
import { CUSTOMS_SERVICES, type CustomsMods } from "@/lib/customs/spec";

export type BarrelMakerId = "lothar" | "krieger" | "bartlein" | "proof";

/** Steel blanks — profilable. */
export type BarrelSteel = "crmo" | "stainless";

/**
 * Material choice. Carbon is Proof-only and cannot be custom-profiled.
 */
export type BarrelMaterial = BarrelSteel | "carbon";

export type BarrelProfileStation = {
  /** Distance from chamber / breech face (mm). */
  fromBreechMm: number;
  /** Outside diameter (mm). */
  diameterMm: number;
};

/** Fixed Proof carbon contours (no CNC profiling). */
export type CarbonContourId = "lightweight" | "hunter" | "sendero";

export type CustomBarrelConfig = {
  maker: BarrelMakerId;
  material: BarrelMaterial;
  /** Finished barrel length (inches), muzzle end. */
  lengthIn: number;
  /**
   * Contour stations breech → muzzle (steel only).
   * Ignored when material is carbon — use {@link carbonContour} instead.
   */
  stations: BarrelProfileStation[];
  /** Required when material is carbon. */
  carbonContour?: CarbonContourId;
  /**
   * CNC fluting (steel only) — faster cool on the range.
   * Once installed fluted, that pipe cannot be fluted again.
   */
  fluted?: boolean;
};

export type InstalledCustomBarrel = CustomBarrelConfig & {
  installedAtMs: number;
  pricePaidNok: number;
  /** Fresh barrel MOA contribution (replaces factory rifle floor). */
  averageBestAccuracyMoa: number;
  /** Estimated blank + contour mass (g). */
  weightGrams: number;
};

/** Custom pipe removed from the rifle but kept in the player's inventory. */
export type StoredCustomBarrel = InstalledCustomBarrel & {
  storageId: string;
};

/** Factory pipe length when no custom blank is installed (inches). */
export const DEFAULT_FACTORY_BARREL_LENGTH_IN = 24;

/**
 * Reference factory barrel lengths (inches). Shorter pipes → lower v0.
 * Rifles not listed use {@link DEFAULT_FACTORY_BARREL_LENGTH_IN}.
 */
export const RIFLE_FACTORY_BARREL_LENGTH_IN: Record<string, number> = {
  "rifle-sauer-200str": 20,
  "rifle-rem-700-sa-65cm": 25.6,
  "rifle-rem-700-sa-hansen-custom": 26,
  "rifle-tikka-t3x-lite": 22,
  "rifle-tikka-t3x-super-varminter": 24,
  "rifle-tikka-t3x-tac-a1": 24,
  "rifle-cz457": 20,
  "rifle-cz455": 20,
  "rifle-cz452": 20,
  "rifle-jula-youth-22": 18,
  "rifle-ruger-american-ranch-300blk": 16.5,
  "rifle-ruger-american-predator": 22,
  "rifle-bergara-b14-hmr": 24,
  "rifle-bergara-b14-ridge": 22,
  "rifle-howa-1500-hs": 22,
  "rifle-browning-xbolt-pro": 24,
  "rifle-blaser-r8": 23,
  "rifle-ai-at-x": 24,
  "rifle-carbonwolf-berillium": 22,
  "rifle-magasinet-budget-308": 22,
};

/** v0 ∝ (length/ref)^exp — shorter pipe loses velocity. */
export const BARREL_LENGTH_V0_EXPONENT = 0.4;

export const SAUER_200STR_RIFLE_ID = "rifle-sauer-200str";
/** Extra CNC/chambering work for Sauer 200 STR actions. */
export const SAUER_200STR_BARREL_SURCHARGE_NOK = 1500;

/** Stainless premium over identical CrMo blank + profile. */
export const STAINLESS_PRICE_MULT = 1.15;
/** Stainless MOA advantage vs CrMo for the same blank/profile. */
export const STAINLESS_MOA_BONUS = 0.02;

export const BARREL_LENGTH_MIN_IN = 16;
export const BARREL_LENGTH_MAX_IN = 30;

export const BARREL_MAKERS: {
  id: BarrelMakerId;
  name: string;
  /** Base blank + chambering (CrMo), before contour CNC / Sauer / stainless. */
  baseBlankNok: number;
  /** CrMo base MOA before profile stiffness / stainless. */
  baseMoaCrmo: number;
  note: string;
}[] = [
  {
    id: "lothar",
    name: "Lothar Walther",
    baseBlankNok: 7_500,
    baseMoaCrmo: 0.32,
    note: "Solid europeisk blank — god jaktpipe.",
  },
  {
    id: "krieger",
    name: "Krieger",
    baseBlankNok: 14_500,
    baseMoaCrmo: 0.25,
    note: "Match-blank — stramt gulv når konturen er stiv nok.",
  },
  {
    id: "bartlein",
    name: "Bartlein",
    baseBlankNok: 13_500,
    baseMoaCrmo: 0.26,
    note: "Button-rifled match — jevn, forutsigbar.",
  },
  {
    id: "proof",
    name: "Proof Research",
    baseBlankNok: 12_000,
    baseMoaCrmo: 0.28,
    note: "Stålblank eller carbon (uten custom-profil).",
  },
];

export const CARBON_CONTOURS: {
  id: CarbonContourId;
  name: string;
  /** Extra over Proof base blank. */
  priceExtraNok: number;
  moaDelta: number;
  weightGrams: number;
  note: string;
}[] = [
  {
    id: "lightweight",
    name: "Lightweight",
    priceExtraNok: 4_500,
    moaDelta: 0.03,
    weightGrams: 780,
    note: "Lett jakt — litt mer bevegelse i pipa.",
  },
  {
    id: "hunter",
    name: "Hunter",
    priceExtraNok: 5_500,
    moaDelta: 0.01,
    weightGrams: 980,
    note: "Balansert Proof carbon-kontur.",
  },
  {
    id: "sendero",
    name: "Sendero",
    priceExtraNok: 6_500,
    moaDelta: -0.01,
    weightGrams: 1180,
    note: "Stivere carbon — nærmere match-følelse.",
  },
];

/** CNC labour to cut a custom steel contour. */
export const CNC_PROFILE_LABOUR_NOK = 3_500;
/** Install / headspace labour (crown + action trueing bundled separately). */
export const BARREL_INSTALL_LABOUR_NOK = 2_500;
/** Fluting labour (steel only) — one-time per pipe. */
export const FLUTING_LABOUR_NOK = 2_800;
/** Retrofit fluting on an already-installed unfluted custom steel pipe. */
export const FLUTING_RETROFIT_NOK = 2_200;

export function barrelMaker(id: BarrelMakerId) {
  return BARREL_MAKERS.find((m) => m.id === id) ?? BARREL_MAKERS[0]!;
}

export function materialLabelNb(m: BarrelMaterial): string {
  if (m === "crmo") return "CrMo";
  if (m === "stainless") return "Stainless (SS)";
  return "Carbonfiber";
}

export function canCustomProfile(material: BarrelMaterial): boolean {
  return material !== "carbon";
}

export function materialsForMaker(maker: BarrelMakerId): BarrelMaterial[] {
  if (maker === "proof") return ["crmo", "stainless", "carbon"];
  return ["crmo", "stainless"];
}

/** Default steel contour for a given length (sporter-ish taper). */
export function defaultSteelStations(lengthIn: number): BarrelProfileStation[] {
  const lenMm = Math.round(clampLengthIn(lengthIn) * 25.4);
  return [
    { fromBreechMm: 0, diameterMm: 31 },
    { fromBreechMm: 70, diameterMm: 29 },
    { fromBreechMm: Math.round(lenMm * 0.35), diameterMm: 25 },
    { fromBreechMm: Math.round(lenMm * 0.7), diameterMm: 22 },
    { fromBreechMm: lenMm, diameterMm: 20 },
  ];
}

export function clampLengthIn(lengthIn: number): number {
  if (!Number.isFinite(lengthIn)) return 24;
  return Math.max(
    BARREL_LENGTH_MIN_IN,
    Math.min(BARREL_LENGTH_MAX_IN, Math.round(lengthIn * 10) / 10),
  );
}

export function normalizeStations(
  stations: BarrelProfileStation[],
  lengthIn: number,
): BarrelProfileStation[] {
  const lenMm = Math.round(clampLengthIn(lengthIn) * 25.4);
  const cleaned = stations
    .map((s) => ({
      fromBreechMm: Math.max(
        0,
        Math.min(lenMm, Math.round(Number(s.fromBreechMm) || 0)),
      ),
      diameterMm: Math.max(
        14,
        Math.min(38, Math.round((Number(s.diameterMm) || 20) * 10) / 10),
      ),
    }))
    .sort((a, b) => a.fromBreechMm - b.fromBreechMm);

  if (cleaned.length < 2) return defaultSteelStations(lengthIn);

  if (cleaned[0]!.fromBreechMm > 0) {
    cleaned.unshift({
      fromBreechMm: 0,
      diameterMm: cleaned[0]!.diameterMm,
    });
  }
  const last = cleaned[cleaned.length - 1]!;
  if (last.fromBreechMm < lenMm) {
    cleaned.push({ fromBreechMm: lenMm, diameterMm: last.diameterMm });
  } else {
    last.fromBreechMm = lenMm;
  }

  const byPos = new Map<number, number>();
  for (const s of cleaned) byPos.set(s.fromBreechMm, s.diameterMm);
  return [...byPos.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([fromBreechMm, diameterMm]) => ({ fromBreechMm, diameterMm }));
}

/**
 * Approximate steel contour mass via truncated-cone segments.
 * Bore subtracted as a constant cylinder so relative contours still rank right.
 */
export function steelContourWeightGrams(
  stations: BarrelProfileStation[],
  lengthIn: number,
): number {
  const s = normalizeStations(stations, lengthIn);
  const density = 7.85;
  const boreRadiusCm = 0.32;
  let steelCm3 = 0;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s[i]!;
    const b = s[i + 1]!;
    const hCm = Math.max(0, (b.fromBreechMm - a.fromBreechMm) / 10);
    const r1 = a.diameterMm / 20;
    const r2 = b.diameterMm / 20;
    steelCm3 += (Math.PI * hCm / 3) * (r1 * r1 + r1 * r2 + r2 * r2);
  }
  const lenCm = clampLengthIn(lengthIn) * 2.54;
  const boreCm3 = Math.PI * boreRadiusCm * boreRadiusCm * lenCm;
  return Math.max(400, Math.round((steelCm3 - boreCm3) * density));
}

/**
 * Stiffer / heavier contours shoot a bit tighter; whippy ones a bit worse.
 * Relative to ~1100 g reference blank.
 */
export function profileMoaDeltaFromWeight(weightGrams: number): number {
  const ref = 1100;
  const delta = (ref - weightGrams) / 2500;
  return Math.max(-0.04, Math.min(0.05, Math.round(delta * 100) / 100));
}

export function estimateCustomBarrelMoa(config: CustomBarrelConfig): number {
  const maker = barrelMaker(config.maker);
  let moa = maker.baseMoaCrmo;

  if (config.material === "carbon") {
    const contour =
      CARBON_CONTOURS.find((c) => c.id === config.carbonContour) ??
      CARBON_CONTOURS[1]!;
    moa = maker.baseMoaCrmo - 0.01 + contour.moaDelta;
    return Math.max(0.15, Math.round(moa * 100) / 100);
  }

  const weight = steelContourWeightGrams(config.stations, config.lengthIn);
  moa += profileMoaDeltaFromWeight(weight);
  if (config.material === "stainless") {
    moa -= STAINLESS_MOA_BONUS;
  }
  return Math.max(0.15, Math.round(moa * 100) / 100);
}

export function estimateCustomBarrelWeightGrams(
  config: CustomBarrelConfig,
): number {
  if (config.material === "carbon") {
    const contour =
      CARBON_CONTOURS.find((c) => c.id === config.carbonContour) ??
      CARBON_CONTOURS[1]!;
    const scale = clampLengthIn(config.lengthIn) / 24;
    return Math.round(contour.weightGrams * scale);
  }
  return steelContourWeightGrams(config.stations, config.lengthIn);
}

export function quoteCustomBarrelNok(
  config: CustomBarrelConfig,
  rifleId: string | null,
): {
  blankNok: number;
  profileNok: number;
  flutingNok: number;
  installNok: number;
  crownNok: number;
  trueingNok: number;
  sauerNok: number;
  subtotalBeforeStainless: number;
  stainlessExtraNok: number;
  totalNok: number;
} {
  const maker = barrelMaker(config.maker);
  let blankNok = maker.baseBlankNok;
  let profileNok = 0;
  let flutingNok = 0;

  if (config.material === "carbon") {
    const contour =
      CARBON_CONTOURS.find((c) => c.id === config.carbonContour) ??
      CARBON_CONTOURS[1]!;
    blankNok += contour.priceExtraNok;
    profileNok = 0;
  } else {
    profileNok = CNC_PROFILE_LABOUR_NOK;
    if (config.fluted) flutingNok = FLUTING_LABOUR_NOK;
  }

  const installNok = BARREL_INSTALL_LABOUR_NOK;
  const crownNok = BARREL_ORDER_CROWN_NOK;
  const trueingNok = BARREL_ORDER_ACTION_TRUEING_NOK;
  const sauerNok =
    rifleId === SAUER_200STR_RIFLE_ID ? SAUER_200STR_BARREL_SURCHARGE_NOK : 0;

  const subtotalBeforeStainless =
    blankNok +
    profileNok +
    flutingNok +
    installNok +
    crownNok +
    trueingNok +
    sauerNok;

  let totalNok = subtotalBeforeStainless;
  let stainlessExtraNok = 0;
  if (config.material === "stainless") {
    const withPremium = Math.round(
      subtotalBeforeStainless * STAINLESS_PRICE_MULT,
    );
    stainlessExtraNok = withPremium - subtotalBeforeStainless;
    totalNok = withPremium;
  }

  return {
    blankNok,
    profileNok,
    flutingNok,
    installNok,
    crownNok,
    trueingNok,
    sauerNok,
    subtotalBeforeStainless,
    stainlessExtraNok,
    totalNok,
  };
}

export function createDefaultCustomBarrelConfig(
  maker: BarrelMakerId = "krieger",
): CustomBarrelConfig {
  const lengthIn = 26;
  return {
    maker,
    material: "crmo",
    lengthIn,
    stations: defaultSteelStations(lengthIn),
    carbonContour: "hunter",
    fluted: false,
  };
}

export function normalizeCustomBarrelConfig(
  raw: unknown,
): CustomBarrelConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const maker = o.maker;
  if (
    maker !== "lothar" &&
    maker !== "krieger" &&
    maker !== "bartlein" &&
    maker !== "proof"
  ) {
    return null;
  }
  let material: BarrelMaterial = "crmo";
  if (
    o.material === "stainless" ||
    o.material === "carbon" ||
    o.material === "crmo"
  ) {
    material = o.material;
  }
  if (material === "carbon" && maker !== "proof") {
    material = "crmo";
  }
  const lengthIn = clampLengthIn(
    typeof o.lengthIn === "number" ? o.lengthIn : 24,
  );
  const stations = Array.isArray(o.stations)
    ? normalizeStations(o.stations as BarrelProfileStation[], lengthIn)
    : defaultSteelStations(lengthIn);
  let carbonContour: CarbonContourId = "hunter";
  if (
    o.carbonContour === "lightweight" ||
    o.carbonContour === "hunter" ||
    o.carbonContour === "sendero"
  ) {
    carbonContour = o.carbonContour;
  }
  return {
    maker,
    material,
    lengthIn,
    stations,
    carbonContour,
    fluted: material !== "carbon" && o.fluted === true,
  };
}

export function normalizeInstalledCustomBarrel(
  raw: unknown,
): InstalledCustomBarrel | null {
  const config = normalizeCustomBarrelConfig(raw);
  if (!config) return null;
  const o = raw as Record<string, unknown>;
  const quote = quoteCustomBarrelNok(config, null);
  return {
    ...config,
    installedAtMs:
      typeof o.installedAtMs === "number" && Number.isFinite(o.installedAtMs)
        ? o.installedAtMs
        : Date.now(),
    pricePaidNok:
      typeof o.pricePaidNok === "number" && Number.isFinite(o.pricePaidNok)
        ? Math.max(0, Math.round(o.pricePaidNok))
        : quote.totalNok,
    averageBestAccuracyMoa:
      typeof o.averageBestAccuracyMoa === "number" &&
      Number.isFinite(o.averageBestAccuracyMoa)
        ? Math.max(0.15, o.averageBestAccuracyMoa)
        : estimateCustomBarrelMoa(config),
    weightGrams:
      typeof o.weightGrams === "number" && Number.isFinite(o.weightGrams)
        ? Math.max(200, Math.round(o.weightGrams))
        : estimateCustomBarrelWeightGrams(config),
  };
}

export function normalizeCustomBarrelsMap(
  raw: unknown,
): Record<string, InstalledCustomBarrel> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, InstalledCustomBarrel> = {};
  for (const [rifleId, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (typeof rifleId !== "string" || !rifleId) continue;
    const installed = normalizeInstalledCustomBarrel(value);
    if (installed) out[rifleId] = installed;
  }
  return out;
}

function customsServicePriceNok(id: string): number {
  return CUSTOMS_SERVICES.find((s) => s.id === id)?.priceNok ?? 0;
}

/** Included in every custom pipe order (not sold again separately). */
export const BARREL_ORDER_CROWN_NOK = customsServicePriceNok("barrel_crown");
export const BARREL_ORDER_ACTION_TRUEING_NOK =
  customsServicePriceNok("action_trueing");

export function factoryBarrelLengthIn(rifleId: string): number {
  const len = RIFLE_FACTORY_BARREL_LENGTH_IN[rifleId];
  return len != null ? clampLengthIn(len) : DEFAULT_FACTORY_BARREL_LENGTH_IN;
}

export function effectiveBarrelLengthIn(
  rifleId: string,
  custom: InstalledCustomBarrel | null | undefined,
): number {
  if (custom) return clampLengthIn(custom.lengthIn);
  return factoryBarrelLengthIn(rifleId);
}

/** Multiplier on catalog / nominal muzzle velocity (1 @ factory length). */
export function barrelLengthV0Factor(
  lengthIn: number,
  refLengthIn: number,
): number {
  const len = clampLengthIn(lengthIn);
  const ref = clampLengthIn(refLengthIn);
  if (ref <= 0) return 1;
  const ratio = len / ref;
  return Math.pow(Math.max(0.55, ratio), BARREL_LENGTH_V0_EXPONENT);
}

export function barrelV0FactorForRifle(
  rifleId: string,
  custom: InstalledCustomBarrel | null | undefined,
): number {
  const ref = factoryBarrelLengthIn(rifleId);
  const len = effectiveBarrelLengthIn(rifleId, custom);
  return barrelLengthV0Factor(len, ref);
}

export function scaledBarrelV0Mps(
  nominalV0Mps: number,
  rifleId: string,
  custom: InstalledCustomBarrel | null | undefined,
): number {
  return Math.max(
    50,
    Math.round(nominalV0Mps * barrelV0FactorForRifle(rifleId, custom)),
  );
}

export function customsModsAfterPipeInstall(mods: CustomsMods): CustomsMods {
  return {
    ...mods,
    barrelCrown: true,
    actionTrueing: true,
  };
}

export function newStoredBarrelId(): string {
  return `pipe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function toStoredCustomBarrel(
  barrel: InstalledCustomBarrel,
): StoredCustomBarrel {
  return {
    ...barrel,
    storageId: newStoredBarrelId(),
  };
}

export function normalizeStoredCustomBarrel(
  raw: unknown,
): StoredCustomBarrel | null {
  const installed = normalizeInstalledCustomBarrel(raw);
  if (!installed) return null;
  const o = raw as Record<string, unknown>;
  const storageId =
    typeof o.storageId === "string" && o.storageId.trim()
      ? o.storageId.trim()
      : newStoredBarrelId();
  return { ...installed, storageId };
}

export function normalizeSpareBarrelsMap(
  raw: unknown,
): Record<string, StoredCustomBarrel[]> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, StoredCustomBarrel[]> = {};
  for (const [rifleId, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (typeof rifleId !== "string" || !rifleId || !Array.isArray(value)) {
      continue;
    }
    const list = value
      .map((entry) => normalizeStoredCustomBarrel(entry))
      .filter((b): b is StoredCustomBarrel => b != null);
    if (list.length > 0) out[rifleId] = list;
  }
  return out;
}

/** RifleSpec MOA with installed custom blank, else factory. */
export function applyCustomBarrelMoa(
  factoryMoa: number,
  custom: InstalledCustomBarrel | null | undefined,
): number {
  if (!custom) return factoryMoa;
  return custom.averageBestAccuracyMoa;
}

export function rifleSpecWithCustomBarrel(
  rifle: RifleSpec,
  custom: InstalledCustomBarrel | null | undefined,
): RifleSpec {
  if (!custom) return rifle;
  return {
    ...rifle,
    averageBestAccuracyMoa: custom.averageBestAccuracyMoa,
  };
}

export function buildInstalledCustomBarrel(
  config: CustomBarrelConfig,
  _rifleId: string,
  paidNok: number,
  nowMs = Date.now(),
): InstalledCustomBarrel {
  const normalized: CustomBarrelConfig = {
    ...config,
    lengthIn: clampLengthIn(config.lengthIn),
    stations:
      config.material === "carbon"
        ? defaultSteelStations(config.lengthIn)
        : normalizeStations(config.stations, config.lengthIn),
    carbonContour:
      config.material === "carbon"
        ? (config.carbonContour ?? "hunter")
        : config.carbonContour,
    fluted: config.material !== "carbon" && !!config.fluted,
  };
  return {
    ...normalized,
    installedAtMs: nowMs,
    pricePaidNok: paidNok,
    averageBestAccuracyMoa: estimateCustomBarrelMoa(normalized),
    weightGrams: estimateCustomBarrelWeightGrams(normalized),
  };
}
