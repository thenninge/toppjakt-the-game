/**
 * Kestrel / Applied Ballistics gun profiles — calibrated MV, BC, dV/dT
 * from chronograph, home dV/dT table, or DOPE MV solve.
 */

import type { AmmoSpec } from "@/lib/ammo/spec";
import { groupEsMoaToEnvelopeMoa } from "@/lib/ballistics/dispersion";
import {
  isWindMeterBallistics,
  preferWindMeterItemId,
} from "@/lib/ballistics/spec";
import { exactBallisticHold } from "@/lib/ballistics/solver";
import {
  POWDER_TEMP_REFERENCE_C,
  powderTempDvDtMpsPerC,
} from "@/lib/ballistics/powderTemp";
import { getShopItem, isBallisticsItem } from "@/lib/shop";

/** Same as player ZERO_CLICK_MM — 0.1 mil ≈ 10 mm at 100 m. */
const ZERO_CLICK_MM = 10;

export const XERO_CHRONO_ID = "misc-garmin-xero-c1-pro";
export const TRUE_BALLISTIC_CHRONO_ID = "misc-fx-true-ballistic";
export const KESTREL_ITEM_IDS = [
  "misc-kestrel-5700-elite",
  "misc-kestrel-5500",
] as const;

export type ChronographKind = "xero" | "true_ballistic";

export type KestrelProfileSource = "chrono" | "dvdt" | "dope";

/** Per-ammo calibration stored on the hunter (used by Kestrel solver). */
export type KestrelGunProfile = {
  ammoId: string;
  /** Muzzle velocity at 15 °C (m/s). */
  mvMps: number;
  /** Optional BC override (G7/G1 as on ammo). */
  bc?: number;
  /** Optional dV/dT (m/s per °C). */
  dvDtMpsPerC?: number;
  source: KestrelProfileSource;
  updatedAtMs: number;
};

export type ChronoSeriesStats = {
  n: number;
  meanMps: number;
  stdevMps: number;
  extremeSpreadMps: number;
  highMps: number;
  lowMps: number;
};

export function chronographKindFromItemId(
  itemId: string | null | undefined,
): ChronographKind | null {
  if (!itemId) return null;
  if (itemId === XERO_CHRONO_ID) return "xero";
  if (itemId === TRUE_BALLISTIC_CHRONO_ID) return "true_ballistic";
  return null;
}

/** Prefer True Ballistic over Xero when both are packed. */
export function chronographKindFromKitIds(
  itemIds: readonly string[],
): ChronographKind | null {
  if (itemIds.includes(TRUE_BALLISTIC_CHRONO_ID)) return "true_ballistic";
  if (itemIds.includes(XERO_CHRONO_ID)) return "xero";
  for (const id of itemIds) {
    const kind = chronographKindFromItemId(id);
    if (kind) return kind;
  }
  return null;
}

export function ownsKestrelDevice(
  inventoryItemIds: readonly string[],
  kitIds: readonly string[] = [],
): boolean {
  const owned = new Set([...inventoryItemIds, ...kitIds]);
  return KESTREL_ITEM_IDS.some((id) => owned.has(id));
}

/** Kit exclusivity — at most one wind meter (Kestrel / Clas Ohlson / …). */
export function sanitizeKitWindMeters(kit: string[]): string[] {
  const windIds = kit.filter((id) => {
    const item = getShopItem(id);
    return (
      !!item &&
      isBallisticsItem(item) &&
      isWindMeterBallistics(item.ballistics)
    );
  });
  if (windIds.length <= 1) return kit;
  const keep = preferWindMeterItemId(windIds);
  if (!keep) return kit;
  const drop = new Set(windIds.filter((id) => id !== keep));
  return kit.filter((id) => !drop.has(id));
}

export function isWindMeterItemId(id: string): boolean {
  const item = getShopItem(id);
  return (
    !!item &&
    isBallisticsItem(item) &&
    isWindMeterBallistics(item.ballistics)
  );
}

export function upsertKestrelProfile(
  profiles: Record<string, KestrelGunProfile>,
  profile: KestrelGunProfile,
): Record<string, KestrelGunProfile> {
  return { ...profiles, [profile.ammoId]: profile };
}

/** Ballistics ammo + powder-temp opts for Kestrel / App solutions. */
export function kestrelSolveAmmo(
  ammo: AmmoSpec,
  ammoId: string,
  profiles: Record<string, KestrelGunProfile> | undefined,
  real?: {
    active?: boolean;
    /** Player real-load overrides (MV @ 15 °C, BC, SD, dV/dT). */
    profile?: {
      v0AvgMps: number;
      v0SdMps: number;
      bc: number;
      bcModel: "G1" | "G7";
      dvDtMpsPerC: number;
      weightGrains?: number;
      groupMoaAvg?: number;
      groupMoaBest?: number;
    } | null;
  },
): {
  ammo: AmmoSpec;
  dvDtMpsPerC: number | undefined;
} {
  if (real?.active && real.profile) {
    const p = real.profile;
    const groupAvg =
      typeof p.groupMoaAvg === "number" && p.groupMoaAvg > 0
        ? p.groupMoaAvg
        : undefined;
    const groupBest =
      typeof p.groupMoaBest === "number" && p.groupMoaBest > 0
        ? p.groupMoaBest
        : undefined;
    const envelopeAvg =
      groupAvg != null ? groupEsMoaToEnvelopeMoa(groupAvg) : undefined;
    const envelopeBest =
      groupBest != null && envelopeAvg != null
        ? Math.min(groupEsMoaToEnvelopeMoa(groupBest), envelopeAvg)
        : envelopeAvg;
    return {
      ammo: {
        ...ammo,
        v0: p.v0AvgMps,
        bc: p.bc,
        bcModel: p.bcModel,
        v0SigmaMps: Math.max(0, p.v0SdMps),
        ...(typeof p.weightGrains === "number" && p.weightGrains > 0
          ? { bulletWeightGrains: p.weightGrains }
          : {}),
        ...(envelopeAvg != null
          ? {
              maxAchievableMoa: envelopeAvg,
              systemGroupMoaOverride: envelopeAvg,
              systemGroupMoaBest: envelopeBest,
            }
          : {}),
      },
      dvDtMpsPerC: p.dvDtMpsPerC,
    };
  }
  const profile = profiles?.[ammoId];
  return {
    ammo: applyKestrelProfileToAmmo(ammo, profile),
    dvDtMpsPerC: profile?.dvDtMpsPerC,
  };
}

export function chronographKindLabel(kind: ChronographKind): string {
  return kind === "xero" ? "Garmin Xero C1 Pro" : "FX True Ballistic";
}

export function computeChronoSeriesStats(
  velocities: number[],
): ChronoSeriesStats | null {
  const vals = velocities.filter((v) => Number.isFinite(v) && v > 0);
  if (vals.length === 0) return null;
  const n = vals.length;
  const meanMps = vals.reduce((a, b) => a + b, 0) / n;
  let variance = 0;
  for (const v of vals) variance += (v - meanMps) ** 2;
  const stdevMps = n > 1 ? Math.sqrt(variance / (n - 1)) : 0;
  const highMps = Math.max(...vals);
  const lowMps = Math.min(...vals);
  return {
    n,
    meanMps: Math.round(meanMps * 10) / 10,
    stdevMps: Math.round(stdevMps * 100) / 100,
    extremeSpreadMps: Math.round((highMps - lowMps) * 10) / 10,
    highMps: Math.round(highMps * 10) / 10,
    lowMps: Math.round(lowMps * 10) / 10,
  };
}

export function normalizeKestrelProfiles(
  raw: unknown,
): Record<string, KestrelGunProfile> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, KestrelGunProfile> = {};
  for (const [ammoId, value] of Object.entries(
    raw as Record<string, unknown>,
  )) {
    if (!ammoId || !value || typeof value !== "object") continue;
    const o = value as Record<string, unknown>;
    const mv = o.mvMps;
    if (typeof mv !== "number" || !Number.isFinite(mv) || mv < 50) continue;
    const source =
      o.source === "chrono" || o.source === "dvdt" || o.source === "dope"
        ? o.source
        : "chrono";
    out[ammoId] = {
      ammoId,
      mvMps: Math.round(mv * 10) / 10,
      bc:
        typeof o.bc === "number" && Number.isFinite(o.bc) && o.bc > 0
          ? o.bc
          : undefined,
      dvDtMpsPerC:
        typeof o.dvDtMpsPerC === "number" && Number.isFinite(o.dvDtMpsPerC)
          ? o.dvDtMpsPerC
          : undefined,
      source,
      updatedAtMs:
        typeof o.updatedAtMs === "number" && Number.isFinite(o.updatedAtMs)
          ? o.updatedAtMs
          : Date.now(),
    };
  }
  return out;
}

/** Apply stored Kestrel profile onto catalog ammo (v0 @ 15 °C + optional BC). */
export function applyKestrelProfileToAmmo(
  ammo: AmmoSpec,
  profile: KestrelGunProfile | null | undefined,
): AmmoSpec {
  if (!profile) return ammo;
  return {
    ...ammo,
    v0: profile.mvMps,
    bc: profile.bc != null && profile.bc > 0 ? profile.bc : ammo.bc,
  };
}

export function resolveAmmoForBallistics(
  ammo: AmmoSpec,
  ammoId: string,
  profiles: Record<string, KestrelGunProfile> | undefined,
): AmmoSpec {
  return applyKestrelProfileToAmmo(ammo, profiles?.[ammoId]);
}

export function profileFromChronoSeries(opts: {
  ammoId: string;
  meanMps: number;
  /** Series measured at this air/powder temp — convert to 15 °C. */
  measuredTempC: number;
  caliber?: string;
  bc?: number;
  existing?: KestrelGunProfile | null;
}): KestrelGunProfile {
  const dvdt =
    opts.existing?.dvDtMpsPerC ?? powderTempDvDtMpsPerC(opts.caliber);
  const mvAt15 =
    opts.meanMps - (opts.measuredTempC - POWDER_TEMP_REFERENCE_C) * dvdt;
  return {
    ammoId: opts.ammoId,
    mvMps: Math.round(Math.max(50, mvAt15) * 10) / 10,
    bc: opts.bc ?? opts.existing?.bc,
    dvDtMpsPerC: opts.existing?.dvDtMpsPerC,
    source: "chrono",
    updatedAtMs: Date.now(),
  };
}

export function profileFromDvDt(opts: {
  ammoId: string;
  /** Predicted / fitted v0 at 15 °C. */
  mvAt15C: number;
  dvDtMpsPerC: number;
  bc?: number;
}): KestrelGunProfile {
  return {
    ammoId: opts.ammoId,
    mvMps: Math.round(Math.max(50, opts.mvAt15C) * 10) / 10,
    bc: opts.bc,
    dvDtMpsPerC: opts.dvDtMpsPerC,
    source: "dvdt",
    updatedAtMs: Date.now(),
  };
}

/**
 * Solve MV @ 15 °C so solver elevation (0.1-mil clicks) matches DOPE at distance.
 * Zero wind assumed (DOPE elev is primary).
 */
export function calibrateMvFromDope(opts: {
  ammoId: string;
  ammo: AmmoSpec;
  distanceM: number;
  elevationClicks: number;
  existing?: KestrelGunProfile | null;
}): KestrelGunProfile | null {
  const targetElev = Math.round(opts.elevationClicks);
  const base = applyKestrelProfileToAmmo(opts.ammo, opts.existing);
  let lo = 50;
  let hi = 1400;
  let bestV0 = base.v0;
  let bestErr = Infinity;

  for (let i = 0; i < 28; i++) {
    const mid = (lo + hi) / 2;
    const trial: AmmoSpec = { ...base, v0: mid };
    const hold = exactBallisticHold(trial, opts.distanceM, 0, {
      powderTempC: POWDER_TEMP_REFERENCE_C,
      dvDtMpsPerC: opts.existing?.dvDtMpsPerC,
    });
    const solverClicks = Math.round(-hold.dialYMmAt100 / ZERO_CLICK_MM);
    const err = Math.abs(solverClicks - targetElev);
    if (err < bestErr) {
      bestErr = err;
      bestV0 = mid;
    }
    if (solverClicks > targetElev) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  if (!Number.isFinite(bestV0) || bestV0 < 50) return null;
  return {
    ammoId: opts.ammoId,
    mvMps: Math.round(bestV0 * 10) / 10,
    bc: opts.existing?.bc ?? base.bc,
    dvDtMpsPerC: opts.existing?.dvDtMpsPerC,
    source: "dope",
    updatedAtMs: Date.now(),
  };
}
