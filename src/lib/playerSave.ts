/**
 * Persist hunter progress in localStorage so deploys / refreshes keep the save.
 */

import { createInitialStats, type PlayerStats, type ZeroingProfile } from "@/lib/player";
import { normalizeGameLang } from "@/lib/i18n/lang";
import { normalizeLoadBenchRecipe } from "@/lib/reloading/recipe";
import { normalizeArmedLoadPlan } from "@/lib/reloading/loadPhysics";
import { normalizeLoadDevTable } from "@/lib/reloading/loadDevTable";
import { normalizeLoadBook } from "@/lib/reloading/loadBook";
import { normalizeHomeLoadedLots } from "@/lib/reloading/homeLoadedAmmo";
import {
  migrateReloadingInventoryPieces,
  normalizePowderOpenGrains,
} from "@/lib/reloading/componentStock";
import { normalizeKestrelProfiles } from "@/lib/ballistics/kestrelProfile";
import { normalizeAwareHuntState } from "@/lib/aware/shotPairStorage";
import { normalizeCustomBarrelsMap } from "@/lib/customs/customBarrel";
import { normalizeCustomsMods } from "@/lib/customs/spec";
import {
  createJaktkort,
  normalizeJaktkort,
} from "@/lib/hunt/jaktkort";
import { sanitizeKitShotCams } from "@/lib/hunt/shoot";

const STORAGE_KEY = "toppjakt-player-save-v1";
export const SAVE_VERSION = 1 as const;

export type PlayerSaveV1 = {
  version: typeof SAVE_VERSION;
  savedAtMs: number;
  stats: PlayerStats;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v != null && !Array.isArray(v);
}

function normalizeRifleRoundCounts(raw: unknown): Record<string, number> {
  if (!isRecord(raw)) return {};
  const next: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      next[key] = Math.floor(value);
    }
  }
  return next;
}

/** Legacy: non-zero dial without verifiedAtMs still counts as saved once. */
function normalizeZeroingProfiles(
  raw: Record<string, ZeroingProfile>,
): Record<string, ZeroingProfile> {
  const next: Record<string, ZeroingProfile> = {};
  for (const [key, profile] of Object.entries(raw)) {
    if (!profile || typeof profile !== "object") continue;
    const verifiedAtMs =
      typeof profile.verifiedAtMs === "number" && profile.verifiedAtMs > 0
        ? profile.verifiedAtMs
        : profile.savedXMm !== 0 || profile.savedYMm !== 0
          ? 1
          : undefined;
    next[key] = {
      baseXMm: Number(profile.baseXMm) || 0,
      baseYMm: Number(profile.baseYMm) || 0,
      savedXMm: Number(profile.savedXMm) || 0,
      savedYMm: Number(profile.savedYMm) || 0,
      ...(verifiedAtMs != null ? { verifiedAtMs } : {}),
    };
  }
  return next;
}

/** Migrate older / partial saves into a full PlayerStats. */
export function normalizePlayerStats(raw: unknown): PlayerStats {
  const base = createInitialStats();
  if (!isRecord(raw)) return base;

  const unlockedRaw = Array.isArray(raw.unlockedTerrainIds)
    ? raw.unlockedTerrainIds.filter((id): id is string => typeof id === "string")
    : [];
  /** Old Rulles id → Kristian Olav li. */
  const unlockedTerrainIds = unlockedRaw.map((id) =>
    id === "rulles-bonna-li" ? "rulles-kristian-li" : id,
  );

  const rawPack = Array.isArray(raw.carcasses) ? raw.carcasses : [];
  const rawFreezer = Array.isArray(raw.freezerCarcasses)
    ? raw.freezerCarcasses
    : null;
  /**
   * Pre-freezer saves kept all birds in `carcasses` while at home.
   * Migrate those into the freezer; pack starts empty outside an active hunt.
   */
  const freezerCarcasses = (rawFreezer ?? rawPack) as PlayerStats["freezerCarcasses"];
  const carcasses = (rawFreezer != null ? rawPack : []) as PlayerStats["carcasses"];
  const inventoryRaw = Array.isArray(raw.inventory)
    ? (raw.inventory as PlayerStats["inventory"])
    : base.inventory;
  const inventory =
    raw.reloadingPiecesMigrated === true
      ? inventoryRaw
      : migrateReloadingInventoryPieces(inventoryRaw);
  const kit = sanitizeKitShotCams(
    Array.isArray(raw.kit) ? (raw.kit as string[]) : base.kit,
  );
  const weaponLicenses = Array.isArray(raw.weaponLicenses)
    ? raw.weaponLicenses
    : base.weaponLicenses;
  const shotLog = Array.isArray(raw.shotLog) ? raw.shotLog : base.shotLog;
  const dopeCard = Array.isArray(raw.dopeCard) ? raw.dopeCard : base.dopeCard;

  return syncTerrainWithJaktkort({
    ...base,
    name: typeof raw.name === "string" ? raw.name : base.name,
    nickname: typeof raw.nickname === "string" ? raw.nickname : base.nickname,
    balance:
      typeof raw.balance === "number" && Number.isFinite(raw.balance)
        ? raw.balance
        : base.balance,
    orrhaner:
      typeof raw.orrhaner === "number" && Number.isFinite(raw.orrhaner)
        ? Math.max(0, Math.floor(raw.orrhaner))
        : base.orrhaner,
    tiur:
      typeof raw.tiur === "number" && Number.isFinite(raw.tiur)
        ? Math.max(0, Math.floor(raw.tiur))
        : base.tiur,
    lifetimeTiur:
      typeof raw.lifetimeTiur === "number" && Number.isFinite(raw.lifetimeTiur)
        ? Math.max(0, Math.floor(raw.lifetimeTiur))
        : typeof raw.tiur === "number" && Number.isFinite(raw.tiur)
          ? Math.max(0, Math.floor(raw.tiur))
          : base.lifetimeTiur,
    lifetimeOrrhaner:
      typeof raw.lifetimeOrrhaner === "number" &&
      Number.isFinite(raw.lifetimeOrrhaner)
        ? Math.max(0, Math.floor(raw.lifetimeOrrhaner))
        : typeof raw.orrhaner === "number" && Number.isFinite(raw.orrhaner)
          ? Math.max(0, Math.floor(raw.orrhaner))
          : base.lifetimeOrrhaner,
    lifetimeUgle:
      typeof raw.lifetimeUgle === "number" && Number.isFinite(raw.lifetimeUgle)
        ? Math.max(0, Math.floor(raw.lifetimeUgle))
        : base.lifetimeUgle,
    owlLastOfferedMilestone:
      typeof raw.owlLastOfferedMilestone === "number" &&
      Number.isFinite(raw.owlLastOfferedMilestone)
        ? Math.max(0, Math.floor(raw.owlLastOfferedMilestone))
        : raw.owlLastOfferedMilestone === null
          ? null
          : base.owlLastOfferedMilestone,
    carcasses,
    freezerCarcasses,
    maxRange:
      typeof raw.maxRange === "number" && Number.isFinite(raw.maxRange)
        ? Math.max(0, Math.floor(raw.maxRange))
        : base.maxRange,
    lifetimeDistanceM:
      typeof raw.lifetimeDistanceM === "number" &&
      Number.isFinite(raw.lifetimeDistanceM)
        ? Math.max(0, raw.lifetimeDistanceM)
        : base.lifetimeDistanceM,
    inventory: inventory as PlayerStats["inventory"],
    kit: kit as PlayerStats["kit"],
    weaponLicenses: weaponLicenses as PlayerStats["weaponLicenses"],
    ammoAffinities: isRecord(raw.ammoAffinities)
      ? (raw.ammoAffinities as PlayerStats["ammoAffinities"])
      : base.ammoAffinities,
    zeroingProfiles: isRecord(raw.zeroingProfiles)
      ? normalizeZeroingProfiles(
          raw.zeroingProfiles as PlayerStats["zeroingProfiles"],
        )
      : base.zeroingProfiles,
    rifleRoundCounts: normalizeRifleRoundCounts(raw.rifleRoundCounts),
    customBarrels: normalizeCustomBarrelsMap(raw.customBarrels),
    shotLog: shotLog as PlayerStats["shotLog"],
    dopeCard: dopeCard as PlayerStats["dopeCard"],
    customsMods: normalizeCustomsMods(raw.customsMods),
    selectedHuntingTerrainId:
      typeof raw.selectedHuntingTerrainId === "string"
        ? raw.selectedHuntingTerrainId
        : raw.selectedHuntingTerrainId === null
          ? null
          : base.selectedHuntingTerrainId,
    jaktkort: (() => {
      const parsed = normalizeJaktkort(raw.jaktkort);
      if (parsed) return parsed;
      // Migrate old saves: selected terrain without kort → 1-day dagskort.
      if (typeof raw.selectedHuntingTerrainId === "string") {
        return createJaktkort(raw.selectedHuntingTerrainId, "day", 0);
      }
      return null;
    })(),
    unlockedTerrainIds,
    autoSupplyFood: raw.autoSupplyFood === true,
    loadBenchRecipe:
      normalizeLoadBenchRecipe(raw.loadBenchRecipe) ?? base.loadBenchRecipe,
    armedLoadPlan: normalizeArmedLoadPlan(raw.armedLoadPlan),
    loadDevTable: normalizeLoadDevTable(raw.loadDevTable),
    loadBook: normalizeLoadBook(raw.loadBook),
    homeLoadedLots: normalizeHomeLoadedLots(raw.homeLoadedLots),
    powderOpenGrains: normalizePowderOpenGrains(raw.powderOpenGrains),
    reloadingPiecesMigrated: true,
    kestrelProfiles: normalizeKestrelProfiles(raw.kestrelProfiles),
    awareHunt: normalizeAwareHuntState(raw.awareHunt),
    jegerprovePassed: (() => {
      if (raw.jegerprovePassed === true) return true;
      if (raw.jegerprovePassed === false) return false;
      // Grandfather existing hunters who already bagged or scored a hit.
      const lifeTiur =
        typeof raw.lifetimeTiur === "number" ? raw.lifetimeTiur : 0;
      const lifeOrre =
        typeof raw.lifetimeOrrhaner === "number" ? raw.lifetimeOrrhaner : 0;
      const maxRange =
        typeof raw.maxRange === "number" ? raw.maxRange : 0;
      return lifeTiur > 0 || lifeOrre > 0 || maxRange > 0;
    })(),
    lang: normalizeGameLang(raw.lang, base.lang),
  });
}

/** Keep selected terrain in sync with an active jaktkort after normalize. */
function syncTerrainWithJaktkort(stats: PlayerStats): PlayerStats {
  if (stats.jaktkort && stats.jaktkort.daysRemaining > 0) {
    if (stats.selectedHuntingTerrainId === stats.jaktkort.terrainId) {
      return stats;
    }
    return {
      ...stats,
      selectedHuntingTerrainId: stats.jaktkort.terrainId,
    };
  }
  if (stats.selectedHuntingTerrainId == null) return stats;
  return { ...stats, selectedHuntingTerrainId: null };
}

export function loadPlayerSave(): PlayerSaveV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    return {
      version: SAVE_VERSION,
      savedAtMs:
        typeof parsed.savedAtMs === "number" ? parsed.savedAtMs : Date.now(),
      stats: normalizePlayerStats(parsed.stats ?? parsed),
    };
  } catch {
    return null;
  }
}

export function savePlayerStats(stats: PlayerStats): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PlayerSaveV1 = {
      version: SAVE_VERSION,
      savedAtMs: Date.now(),
      stats,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Quota / private mode — ignore; game still runs in-memory.
  }
}

export function clearPlayerSave(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function mergeMaxCountMap(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [key, value] of Object.entries(b)) {
    if (!(typeof value === "number") || !Number.isFinite(value)) continue;
    const n = Math.max(0, Math.floor(value));
    out[key] = Math.max(out[key] ?? 0, n);
  }
  return out;
}

/**
 * Keep the best lifetime hunter metrics from two saves.
 * Used when local + cloud both exist so picking one whole save does not
 * wipe km walked / bagged birds / barrel shots recorded on the other device.
 */
export function mergeLifetimeProgress(
  primary: PlayerStats,
  secondary: PlayerStats,
): PlayerStats {
  const owlA = primary.owlLastOfferedMilestone;
  const owlB = secondary.owlLastOfferedMilestone;
  let owlLastOfferedMilestone: number | null = owlA ?? owlB ?? null;
  if (owlA != null && owlB != null) {
    owlLastOfferedMilestone = Math.max(owlA, owlB);
  }
  return {
    ...primary,
    lifetimeTiur: Math.max(primary.lifetimeTiur, secondary.lifetimeTiur),
    lifetimeOrrhaner: Math.max(
      primary.lifetimeOrrhaner,
      secondary.lifetimeOrrhaner,
    ),
    lifetimeUgle: Math.max(primary.lifetimeUgle, secondary.lifetimeUgle),
    lifetimeDistanceM: Math.max(
      primary.lifetimeDistanceM,
      secondary.lifetimeDistanceM,
    ),
    maxRange: Math.max(primary.maxRange, secondary.maxRange),
    rifleRoundCounts: mergeMaxCountMap(
      primary.rifleRoundCounts,
      secondary.rifleRoundCounts,
    ),
    owlLastOfferedMilestone,
  };
}

export function totalBirdsHarvested(
  stats: Pick<PlayerStats, "lifetimeTiur" | "lifetimeOrrhaner"> | Pick<PlayerStats, "tiur" | "orrhaner">,
): number {
  if ("lifetimeTiur" in stats && "lifetimeOrrhaner" in stats) {
    return Math.max(0, stats.lifetimeTiur) + Math.max(0, stats.lifetimeOrrhaner);
  }
  const s = stats as Pick<PlayerStats, "tiur" | "orrhaner">;
  return Math.max(0, s.tiur) + Math.max(0, s.orrhaner);
}

/** Lifetime gamebirds per km walked; null until any distance is logged. */
export function birdsPerKm(
  stats: Pick<
    PlayerStats,
    "lifetimeTiur" | "lifetimeOrrhaner" | "lifetimeDistanceM"
  >,
): number | null {
  const km = Math.max(0, stats.lifetimeDistanceM) / 1000;
  if (!(km > 0)) return null;
  return totalBirdsHarvested(stats) / km;
}

export function formatLifetimeDistance(meters: number): string {
  const m = Math.max(0, meters);
  if (!(m > 0)) return "—";
  if (m >= 1000) {
    const km = m / 1000;
    const digits = m % 1000 === 0 ? 0 : km < 10 ? 2 : 1;
    return `${km.toFixed(digits)} km`;
  }
  return `${Math.round(m)} m`;
}

export function formatBirdsPerKm(rate: number | null): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  if (rate >= 10) return rate.toFixed(1);
  if (rate >= 1) return rate.toFixed(2);
  return rate.toFixed(2);
}
