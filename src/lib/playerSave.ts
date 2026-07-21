/**
 * Persist hunter progress in localStorage so deploys / refreshes keep the save.
 */

import { createInitialStats, type PlayerStats } from "@/lib/player";
import { normalizeCustomsMods } from "@/lib/customs/spec";

const STORAGE_KEY = "toppjakt-player-save-v1";
const SAVE_VERSION = 1 as const;

export type PlayerSaveV1 = {
  version: typeof SAVE_VERSION;
  savedAtMs: number;
  stats: PlayerStats;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v != null && !Array.isArray(v);
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

  const carcasses = Array.isArray(raw.carcasses) ? raw.carcasses : [];
  const inventory = Array.isArray(raw.inventory) ? raw.inventory : base.inventory;
  const kit = Array.isArray(raw.kit) ? raw.kit : base.kit;
  const weaponLicenses = Array.isArray(raw.weaponLicenses)
    ? raw.weaponLicenses
    : base.weaponLicenses;
  const shotLog = Array.isArray(raw.shotLog) ? raw.shotLog : base.shotLog;
  const dopeCard = Array.isArray(raw.dopeCard) ? raw.dopeCard : base.dopeCard;

  return {
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
    carcasses: carcasses as PlayerStats["carcasses"],
    maxRange:
      typeof raw.maxRange === "number" && Number.isFinite(raw.maxRange)
        ? Math.max(0, Math.floor(raw.maxRange))
        : base.maxRange,
    inventory: inventory as PlayerStats["inventory"],
    kit: kit as PlayerStats["kit"],
    weaponLicenses: weaponLicenses as PlayerStats["weaponLicenses"],
    ammoAffinities: isRecord(raw.ammoAffinities)
      ? (raw.ammoAffinities as PlayerStats["ammoAffinities"])
      : base.ammoAffinities,
    zeroingProfiles: isRecord(raw.zeroingProfiles)
      ? (raw.zeroingProfiles as PlayerStats["zeroingProfiles"])
      : base.zeroingProfiles,
    shotLog: shotLog as PlayerStats["shotLog"],
    dopeCard: dopeCard as PlayerStats["dopeCard"],
    customsMods: normalizeCustomsMods(raw.customsMods),
    selectedHuntingTerrainId:
      typeof raw.selectedHuntingTerrainId === "string"
        ? raw.selectedHuntingTerrainId
        : raw.selectedHuntingTerrainId === null
          ? null
          : base.selectedHuntingTerrainId,
    unlockedTerrainIds,
  };
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

export function totalBirdsHarvested(
  stats: Pick<PlayerStats, "lifetimeTiur" | "lifetimeOrrhaner"> | Pick<PlayerStats, "tiur" | "orrhaner">,
): number {
  if ("lifetimeTiur" in stats && "lifetimeOrrhaner" in stats) {
    return Math.max(0, stats.lifetimeTiur) + Math.max(0, stats.lifetimeOrrhaner);
  }
  const s = stats as Pick<PlayerStats, "tiur" | "orrhaner">;
  return Math.max(0, s.tiur) + Math.max(0, s.orrhaner);
}
