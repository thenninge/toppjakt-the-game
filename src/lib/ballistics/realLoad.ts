/**
 * Player-entered real ballistic loads — use the game as a simulator /
 * procedure trainer with your own DOPE, MV, BC and dV/dT.
 */

import type { AmmoSpec, BallisticModel } from "@/lib/ammo/spec";
import {
  KESTREL_ITEM_IDS,
  type KestrelGunProfile,
  applyKestrelProfileToAmmo,
} from "@/lib/ballistics/kestrelProfile";
import { groupEsMoaToEnvelopeMoa } from "@/lib/ballistics/dispersion";
import { dropBelowLosMm } from "@/lib/ballistics/trajectory";
import { isHomeLoadAmmoId as isCbCustomsHomeLoadAmmoId } from "@/lib/customs/spec";
import { getShopItem, isLrfItem } from "@/lib/shop";

/** Standard drop card distances (m) @ 0 °C, 65 % RH, 1 atm. */
export const REAL_DROP_DISTANCES_M: readonly number[] = [
  100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450,
  475, 500,
] as const;

/**
 * How the player enters measured drop.
 * `klikk` = 0.1 mil turret clicks (10 klikk = 1 mrad).
 */
export type RealDropUnit = "cm" | "mm" | "mrad" | "klikk";

export const REAL_DROP_UNITS: readonly RealDropUnit[] = [
  "klikk",
  "mrad",
  "mm",
  "cm",
] as const;

export const REAL_DROP_UNIT_LABEL: Record<RealDropUnit, string> = {
  klikk: "klikk",
  mrad: "mrad",
  mm: "mm",
  cm: "cm",
};

export type RealLoadDrop = {
  distanceM: number;
  /**
   * Drop below LOS in {@link RealLoadProfile.dropUnit} (positive = down).
   * Empty/null = not filled.
   */
  value: number | null;
};

export type RealLoadProfile = {
  id: string;
  /** Linked rifle item id (owned hunting rifle). */
  rifleId: string;
  rifleLabel: string;
  /** e.g. "Lapua Scenar". */
  bulletLabel: string;
  weightGrains: number;
  bc: number;
  bcModel: BallisticModel;
  /** Mean muzzle velocity (m/s) at powder-temp reference (15 °C). */
  v0AvgMps: number;
  /** 1σ muzzle-velocity SD (m/s). */
  v0SdMps: number;
  /** Powder temp sensitivity (m/s per °C). */
  dvDtMpsPerC: number;
  /**
   * Best measured 5-shot extreme-spread (MOA) — good-day figure (≈ Avg − 3σ).
   */
  groupMoaBest: number;
  /**
   * Average measured 5-shot extreme-spread (MOA).
   * Converted to engine envelope via {@link groupEsMoaToEnvelopeMoa}.
   */
  groupMoaAvg: number;
  /** Unit for {@link drops} values. */
  dropUnit: RealDropUnit;
  /** Measured drop table @ 0 °C / 65 % RH / 1 atm. */
  drops: RealLoadDrop[];
  updatedAtMs: number;
};

export function emptyRealDrops(): RealLoadDrop[] {
  return REAL_DROP_DISTANCES_M.map((distanceM) => ({
    distanceM,
    value: null,
  }));
}

export function createEmptyRealLoad(opts: {
  rifleId: string;
  rifleLabel: string;
  dropUnit?: RealDropUnit;
}): RealLoadProfile {
  return {
    id: `real-${opts.rifleId}-${Date.now()}`,
    rifleId: opts.rifleId,
    rifleLabel: opts.rifleLabel,
    bulletLabel: "",
    weightGrains: 0,
    bc: 0.5,
    bcModel: "G7",
    v0AvgMps: 800,
    v0SdMps: 3,
    dvDtMpsPerC: 1,
    groupMoaBest: 0.5,
    groupMoaAvg: 0.75,
    dropUnit: opts.dropUnit ?? "mrad",
    drops: emptyRealDrops(),
    updatedAtMs: Date.now(),
  };
}

function clampFinite(n: unknown, fallback: number, min: number, max: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeDropUnit(raw: unknown): RealDropUnit {
  if (raw === "mm" || raw === "cm" || raw === "mrad" || raw === "klikk") {
    return raw;
  }
  return "cm"; // legacy saves stored dropCm
}

/** Round display/storage precision per unit. */
export function roundDropValue(value: number, unit: RealDropUnit): number {
  if (unit === "mrad") return Math.round(value * 1000) / 1000;
  if (unit === "klikk") return Math.round(value * 10) / 10;
  if (unit === "mm") return Math.round(value * 10) / 10;
  return Math.round(value * 10) / 10;
}

/**
 * Convert drop between units at a given distance.
 * Linear (cm/mm) ↔ angular (mrad / 0.1-mil klikk) use distance geometry.
 * 1 klikk = 0.1 mrad = 10 mm @ 100 m.
 */
export function convertDropValue(
  value: number,
  from: RealDropUnit,
  to: RealDropUnit,
  distanceM: number,
): number {
  if (from === to) return value;
  const d = Math.max(1, distanceM);
  // Canonical: mm of drop at target distance.
  let dropMm: number;
  if (from === "mm") dropMm = value;
  else if (from === "cm") dropMm = value * 10;
  else if (from === "klikk") dropMm = (value / 10) * d; // 0.1 mrad × d
  else dropMm = value * d; // mrad → mm @ distance (1 mrad = 1 mm/m)

  if (to === "mm") return dropMm;
  if (to === "cm") return dropMm / 10;
  if (to === "klikk") return (dropMm / d) * 10; // mrad × 10
  return dropMm / d; // mm → mrad
}

/** Convert all filled drop rows when the player switches unit. */
export function convertRealDropsUnit(
  drops: RealLoadDrop[],
  from: RealDropUnit,
  to: RealDropUnit,
): RealLoadDrop[] {
  if (from === to) return drops;
  return drops.map((row) => {
    if (row.value == null || !Number.isFinite(row.value)) {
      return { distanceM: row.distanceM, value: null };
    }
    return {
      distanceM: row.distanceM,
      value: roundDropValue(
        convertDropValue(row.value, from, to, row.distanceM),
        to,
      ),
    };
  });
}

function parseDropRow(
  r: Record<string, unknown>,
  unit: RealDropUnit,
): { distanceM: number; value: number | null } | null {
  const d =
    typeof r.distanceM === "number" && Number.isFinite(r.distanceM)
      ? Math.round(r.distanceM)
      : null;
  if (d == null) return null;
  // New field
  if (typeof r.value === "number" && Number.isFinite(r.value)) {
    return { distanceM: d, value: roundDropValue(r.value, unit) };
  }
  // Legacy dropCm — treat as cm regardless of declared unit on migrate
  if (typeof r.dropCm === "number" && Number.isFinite(r.dropCm)) {
    const asCm = r.dropCm;
    const converted = convertDropValue(asCm, "cm", unit, d);
    return { distanceM: d, value: roundDropValue(converted, unit) };
  }
  return { distanceM: d, value: null };
}

export function normalizeRealLoadProfile(raw: unknown): RealLoadProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rifleId = typeof o.rifleId === "string" ? o.rifleId : "";
  if (!rifleId) return null;
  const bcModel: BallisticModel = o.bcModel === "G1" ? "G1" : "G7";
  const dropUnit = normalizeDropUnit(o.dropUnit);
  const dropMap = new Map<number, number | null>();
  if (Array.isArray(o.drops)) {
    for (const row of o.drops) {
      if (!row || typeof row !== "object") continue;
      const parsed = parseDropRow(row as Record<string, unknown>, dropUnit);
      if (!parsed) continue;
      dropMap.set(parsed.distanceM, parsed.value);
    }
  }
  const drops = REAL_DROP_DISTANCES_M.map((distanceM) => ({
    distanceM,
    value: dropMap.has(distanceM) ? (dropMap.get(distanceM) ?? null) : null,
  }));
  return {
    id:
      typeof o.id === "string" && o.id
        ? o.id
        : `real-${rifleId}-${Date.now()}`,
    rifleId,
    rifleLabel:
      typeof o.rifleLabel === "string" && o.rifleLabel
        ? o.rifleLabel
        : rifleId,
    bulletLabel: typeof o.bulletLabel === "string" ? o.bulletLabel : "",
    weightGrains: clampFinite(o.weightGrains, 0, 0, 1000),
    bc: clampFinite(o.bc, 0.5, 0.05, 2),
    bcModel,
    v0AvgMps: clampFinite(o.v0AvgMps, 800, 50, 1400),
    v0SdMps: clampFinite(o.v0SdMps, 3, 0, 50),
    dvDtMpsPerC: clampFinite(o.dvDtMpsPerC, 1, -5, 10),
    groupMoaBest: clampFinite(o.groupMoaBest, 0.5, 0.05, 10),
    groupMoaAvg: clampFinite(o.groupMoaAvg, 0.75, 0.05, 10),
    dropUnit,
    drops,
    updatedAtMs:
      typeof o.updatedAtMs === "number" && Number.isFinite(o.updatedAtMs)
        ? o.updatedAtMs
        : Date.now(),
  };
}

export function normalizeRealLoadProfiles(raw: unknown): RealLoadProfile[] {
  if (!Array.isArray(raw)) return [];
  const out: RealLoadProfile[] = [];
  const seenRifle = new Set<string>();
  for (const row of raw) {
    const p = normalizeRealLoadProfile(row);
    if (!p) continue;
    // One profile per rifle — keep newest if duplicates.
    if (seenRifle.has(p.rifleId)) continue;
    seenRifle.add(p.rifleId);
    out.push(p);
  }
  return out;
}

/**
 * Union real-load profiles by rifle — newer `updatedAtMs` wins.
 * Used when merging local + cloud so Real data survives conflict picks.
 */
export function mergeRealLoadProfiles(
  primary: RealLoadProfile[] | undefined,
  secondary: RealLoadProfile[] | undefined,
): RealLoadProfile[] {
  const map = new Map<string, RealLoadProfile>();
  for (const p of [...(secondary ?? []), ...(primary ?? [])]) {
    const normalized = normalizeRealLoadProfile(p);
    if (!normalized) continue;
    const prev = map.get(normalized.rifleId);
    if (!prev || normalized.updatedAtMs >= prev.updatedAtMs) {
      map.set(normalized.rifleId, normalized);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.updatedAtMs - a.updatedAtMs,
  );
}

export function upsertRealLoadProfile(
  profiles: RealLoadProfile[],
  profile: RealLoadProfile,
): RealLoadProfile[] {
  const next = normalizeRealLoadProfile({
    ...profile,
    updatedAtMs: Date.now(),
  });
  if (!next) return profiles;
  // Drop same rifle slot and same profile id (so "flytt til annet våpen" works).
  const without = profiles.filter(
    (p) => p.rifleId !== next.rifleId && p.id !== next.id,
  );
  return [next, ...without];
}

/** Reassign a saved profile to another owned rifle (one profile per rifle). */
export function moveRealLoadProfile(
  profiles: RealLoadProfile[],
  profileId: string,
  toRifleId: string,
  toRifleLabel: string,
): RealLoadProfile[] {
  const src = profiles.find((p) => p.id === profileId);
  if (!src || src.rifleId === toRifleId) return profiles;
  return upsertRealLoadProfile(profiles, {
    ...src,
    rifleId: toRifleId,
    rifleLabel: toRifleLabel,
    updatedAtMs: Date.now(),
  });
}

export function removeRealLoadProfile(
  profiles: RealLoadProfile[],
  id: string,
): RealLoadProfile[] {
  return profiles.filter((p) => p.id !== id);
}

export function realLoadForRifle(
  profiles: RealLoadProfile[] | undefined,
  rifleId: string | null | undefined,
): RealLoadProfile | null {
  if (!rifleId || !profiles?.length) return null;
  return profiles.find((p) => p.rifleId === rifleId) ?? null;
}

export function ownsBallisticLrf(
  inventoryItemIds: readonly string[],
  kitIds: readonly string[] = [],
): boolean {
  const owned = new Set([...inventoryItemIds, ...kitIds]);
  for (const id of owned) {
    const item = getShopItem(id);
    if (item && isLrfItem(item) && item.lrf.hasOnboardBallistics) return true;
  }
  return false;
}

/** Owned Kestrel or ballistic LRF — required to enable the checkbox. */
export function canEnableRealDataSimulation(
  inventoryItemIds: readonly string[],
  kitIds: readonly string[] = [],
): boolean {
  const owned = new Set([...inventoryItemIds, ...kitIds]);
  if (KESTREL_ITEM_IDS.some((id) => owned.has(id))) return true;
  return ownsBallisticLrf(inventoryItemIds, kitIds);
}

/** Kit must carry Kestrel or ballistic LRF for real data to drive the session. */
export function kitAllowsRealDataSimulation(kitIds: readonly string[]): boolean {
  if (KESTREL_ITEM_IDS.some((id) => kitIds.includes(id))) return true;
  for (const id of kitIds) {
    const item = getShopItem(id);
    if (item && isLrfItem(item) && item.lrf.hasOnboardBallistics) return true;
  }
  return false;
}

export function isRealDataActive(opts: {
  useRealDataInSimulation: boolean;
  kitIds: readonly string[];
  realLoad: RealLoadProfile | null | undefined;
  /** Only CB Customs home-load ammo ids (`ammo-cb-homeload-…`). */
  ammoId?: string | null;
  /**
   * Inventory ids — checkbox already requires owning LRF/Kestrel; simulation
   * applies whenever owned + checkbox (device need not be in kit on the range).
   */
  inventoryItemIds?: readonly string[];
}): boolean {
  if (
    !opts.useRealDataInSimulation ||
    !opts.realLoad ||
    !opts.ammoId ||
    !isCbCustomsHomeLoadAmmoId(opts.ammoId)
  ) {
    return false;
  }
  // Prefer kit, but owned device is enough (range / home without packing LRF).
  if (kitAllowsRealDataSimulation(opts.kitIds)) return true;
  if (
    opts.inventoryItemIds &&
    canEnableRealDataSimulation(opts.inventoryItemIds, opts.kitIds)
  ) {
    return true;
  }
  return false;
}

/**
 * Measured 5-shot extreme-spread (MOA) → engine N-σ envelope.
 * Without this, Avg 0.45 as a 2σ envelope yields ~0.7–0.8 MOA ES.
 */
export { groupEsMoaToEnvelopeMoa as realGroupEsToEnvelopeMoa } from "@/lib/ballistics/dispersion";

/** Apply player real-load MV / BC / SD / group onto catalog ammo. */
export function applyRealLoadToAmmo(
  ammo: AmmoSpec,
  profile: RealLoadProfile,
): AmmoSpec {
  const groupAvg = Math.max(0.05, profile.groupMoaAvg);
  const groupBest = Math.min(Math.max(0.05, profile.groupMoaBest), groupAvg);
  const envelopeAvg = groupEsMoaToEnvelopeMoa(groupAvg);
  const envelopeBest = groupEsMoaToEnvelopeMoa(groupBest);
  return {
    ...ammo,
    v0: profile.v0AvgMps,
    bc: profile.bc,
    bcModel: profile.bcModel,
    bulletWeightGrains:
      profile.weightGrains > 0 ? profile.weightGrains : ammo.bulletWeightGrains,
    v0SigmaMps: Math.max(0, profile.v0SdMps),
    maxAchievableMoa: envelopeAvg,
    /** Mean system group envelope; Best = mean − 3σ (of series ES, scaled). */
    systemGroupMoaOverride: envelopeAvg,
    systemGroupMoaBest: envelopeBest,
  };
}

/**
 * Resolve ammo for computer + shot sampling.
 * Real load wins when active; else Kestrel profile; else catalog.
 */
export function resolveBallisticsAmmo(opts: {
  ammo: AmmoSpec;
  ammoId: string;
  kestrelProfiles?: Record<string, KestrelGunProfile>;
  realLoad?: RealLoadProfile | null;
  useRealDataInSimulation?: boolean;
  kitIds?: readonly string[];
  inventoryItemIds?: readonly string[];
}): { ammo: AmmoSpec; dvDtMpsPerC: number | undefined; usingReal: boolean } {
  const realActive = isRealDataActive({
    useRealDataInSimulation: !!opts.useRealDataInSimulation,
    kitIds: opts.kitIds ?? [],
    inventoryItemIds: opts.inventoryItemIds,
    realLoad: opts.realLoad,
    ammoId: opts.ammoId,
  });
  if (realActive && opts.realLoad) {
    return {
      ammo: applyRealLoadToAmmo(opts.ammo, opts.realLoad),
      dvDtMpsPerC: opts.realLoad.dvDtMpsPerC,
      usingReal: true,
    };
  }
  const profile = opts.kestrelProfiles?.[opts.ammoId];
  return {
    ammo: applyKestrelProfileToAmmo(opts.ammo, profile),
    dvDtMpsPerC: profile?.dvDtMpsPerC,
    usingReal: false,
  };
}

/**
 * Drop (mm below LOS) for zeroing HUD — prefers CB Real loads drop table,
 * else physics with resolved ammo.
 */
export function resolveZeroingDropMm(opts: {
  ammo: AmmoSpec;
  distanceM: number;
  realLoad?: RealLoadProfile | null;
  usingReal?: boolean;
  powderTempC?: number;
  densityRatio?: number;
  dvDtMpsPerC?: number;
}): number {
  if (opts.usingReal && opts.realLoad) {
    const fromTable = interpolateRealDropCm(opts.realLoad, opts.distanceM);
    if (fromTable != null) {
      return fromTable * 10; // cm → mm
    }
  }
  // Physics path uses ammo already resolved (real BC/v0 when active).
  return dropBelowLosMm(opts.ammo, opts.distanceM, {
    densityRatio: opts.densityRatio,
  });
}

/** Linear interpolate drop (cm) from the filled table; null if sparse. */
export function interpolateRealDropCm(
  profile: RealLoadProfile,
  distanceM: number,
): number | null {
  const pts = profile.drops
    .filter((d) => d.value != null && Number.isFinite(d.value))
    .map((d) => ({
      d: d.distanceM,
      y: convertDropValue(d.value as number, profile.dropUnit, "cm", d.distanceM),
    }))
    .sort((a, b) => a.d - b.d);
  if (pts.length === 0) return null;
  if (distanceM <= pts[0].d) return pts[0].y;
  if (distanceM >= pts[pts.length - 1].d) return pts[pts.length - 1].y;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (distanceM >= a.d && distanceM <= b.d) {
      const t = (distanceM - a.d) / (b.d - a.d);
      return a.y + t * (b.y - a.y);
    }
  }
  return null;
}

/**
 * Convert a drop table entry to dial elevation as mm-at-100
 * (same sign convention as solver: +mm = dial up / opposite POI down).
 */
export function realDropToDialYMmAt100(
  value: number,
  unit: RealDropUnit,
  distanceM: number,
): number {
  const d = Math.max(1, distanceM);
  if (unit === "mrad") {
    // 1 mrad = 100 mm @ 100 m
    return value * 100;
  }
  if (unit === "klikk") {
    // 1 klikk = 0.1 mrad = 10 mm @ 100 m
    return value * 10;
  }
  const dropMm = unit === "mm" ? value : value * 10; // cm
  return (dropMm * 100) / d;
}

/** @deprecated Prefer {@link realDropToDialYMmAt100}. */
export function realDropCmToDialYMmAt100(
  dropCm: number,
  distanceM: number,
): number {
  return realDropToDialYMmAt100(dropCm, "cm", distanceM);
}

/**
 * Display muzzle velocity for UI lists.
 * CB Real loads show the player's saved real-load v₀ for the rifle when present.
 */
export function displayV0MpsForAmmo(opts: {
  ammoId: string;
  catalogV0: number;
  rifleId?: string | null;
  realLoadProfiles?: RealLoadProfile[];
}): number {
  if (!isCbCustomsHomeLoadAmmoId(opts.ammoId)) {
    return opts.catalogV0;
  }
  const real = realLoadForRifle(opts.realLoadProfiles, opts.rifleId);
  if (real && real.v0AvgMps >= 50) {
    return Math.round(real.v0AvgMps * 10) / 10;
  }
  return opts.catalogV0;
}

/** Label for CB Real loads ammo in selectors. */
export function displayAmmoBrandName(opts: {
  ammoId: string;
  brand: string;
  name: string;
}): string {
  if (isCbCustomsHomeLoadAmmoId(opts.ammoId)) {
    return `CB Real loads ${opts.name}`;
  }
  return `${opts.brand} ${opts.name}`;
}

export function realLoadIsCompleteEnough(profile: RealLoadProfile): boolean {
  return (
    profile.bulletLabel.trim().length > 0 &&
    profile.weightGrains > 0 &&
    profile.bc > 0 &&
    profile.v0AvgMps >= 50 &&
    profile.groupMoaBest > 0 &&
    profile.groupMoaAvg > 0 &&
    profile.groupMoaBest <= profile.groupMoaAvg
  );
}
