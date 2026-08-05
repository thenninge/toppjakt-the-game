/**
 * Rulles landowner audience gates — hunt résumé before snøvling.
 */

import type { PlayerStats } from "@/lib/player";
import { formatLifetimeDistance } from "@/lib/playerSave";

export type AudienceRequirement = {
  /** tiur + orrhaner */
  minBirdsTotal?: number;
  minTiur?: number;
  minOrrhaner?: number;
  /** Inclusive minimum maxRange (m). Use 401 for «over 400 m». */
  minMaxRangeM?: number;
  /** Inclusive minimum lifetime walked distance (m). */
  minLifetimeDistanceM?: number;
};

export type AudienceCheck = {
  ok: boolean;
  /** Human lines for missing pieces. */
  missing: string[];
  /** Compact progress lines. */
  progress: string[];
};

export const RULLES_AUDIENCE: Record<
  "kari" | "kristian" | "lovenskiold" | "modgeir",
  AudienceRequirement
> = {
  kari: { minBirdsTotal: 10, minMaxRangeM: 250 },
  kristian: { minBirdsTotal: 20, minMaxRangeM: 300 },
  lovenskiold: { minTiur: 20, minOrrhaner: 10, minMaxRangeM: 401 },
  /** Soft gate before Modgeir takes your pulk-score seriously. */
  modgeir: {
    minTiur: 8,
    minOrrhaner: 8,
    minMaxRangeM: 280,
    minLifetimeDistanceM: 25_000,
  },
};

export type HuntRésuméStats = Pick<
  PlayerStats,
  | "tiur"
  | "orrhaner"
  | "maxRange"
  | "lifetimeTiur"
  | "lifetimeOrrhaner"
  | "lifetimeDistanceM"
>;

export function checkAudience(
  stats: HuntRésuméStats,
  req: AudienceRequirement,
): AudienceCheck {
  const tiur = stats.lifetimeTiur ?? stats.tiur;
  const orr = stats.lifetimeOrrhaner ?? stats.orrhaner;
  const birds = tiur + orr;
  const distM = Math.max(0, stats.lifetimeDistanceM ?? 0);
  const missing: string[] = [];
  const progress: string[] = [];

  if (req.minBirdsTotal != null) {
    progress.push(`Fugl totalt: ${birds}/${req.minBirdsTotal}`);
    if (birds < req.minBirdsTotal) {
      missing.push(
        `Minst ${req.minBirdsTotal} fugl på lista (du har ${birds})`,
      );
    }
  }
  if (req.minTiur != null) {
    progress.push(`Tiur: ${tiur}/${req.minTiur}`);
    if (tiur < req.minTiur) {
      missing.push(`Minst ${req.minTiur} tiur (du har ${tiur})`);
    }
  }
  if (req.minOrrhaner != null) {
    progress.push(`Orrhaner: ${orr}/${req.minOrrhaner}`);
    if (orr < req.minOrrhaner) {
      missing.push(`Minst ${req.minOrrhaner} orrhaner (du har ${orr})`);
    }
  }
  if (req.minMaxRangeM != null) {
    const over400 = req.minMaxRangeM > 400;
    progress.push(`Max range: ${stats.maxRange} m`);
    if (stats.maxRange < req.minMaxRangeM) {
      missing.push(
        over400
          ? `Max range over 400 m (din: ${stats.maxRange > 0 ? `${stats.maxRange} m` : "—"})`
          : `Max range minst ${req.minMaxRangeM} m (din: ${stats.maxRange > 0 ? `${stats.maxRange} m` : "—"})`,
      );
    }
  }
  if (req.minLifetimeDistanceM != null) {
    progress.push(
      `Gått: ${formatLifetimeDistance(distM)} / ${formatLifetimeDistance(req.minLifetimeDistanceM)}`,
    );
    if (distM < req.minLifetimeDistanceM) {
      missing.push(
        `Minst ${formatLifetimeDistance(req.minLifetimeDistanceM)} gått (din: ${formatLifetimeDistance(distM)})`,
      );
    }
  }

  return { ok: missing.length === 0, missing, progress };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function scorePart(value: number, fullAt: number, maxPts: number): number {
  return clamp01(value / fullAt) * maxPts;
}

/** Max points per Modgeir pulk-axis (tiur / orre / range / km). */
export const MODGEIR_AXIS_MAX = 2.5;

/** Total Modgeir pulk-score needed before he will greenlight CBA toppjaktspulk. */
export const MODGEIR_PULK_SCORE_NEED = 7;

export type ModgeirScorePart = {
  id: "tiur" | "orre" | "range" | "km";
  label: string;
  points: number;
  max: number;
  detail: string;
};

export type ModgeirPulkScore = {
  score: number;
  need: number;
  ok: boolean;
  parts: ModgeirScorePart[];
};

/**
 * Modgeir’s CBA pulk ledger — weighted hunt résumé (0–10).
 * Full marks: 16 tiur · 12 orre · 350 m · 50 km walked.
 */
export function modgeirPulkScore(stats: HuntRésuméStats): ModgeirPulkScore {
  const tiur = stats.lifetimeTiur ?? stats.tiur;
  const orr = stats.lifetimeOrrhaner ?? stats.orrhaner;
  const range = Math.max(0, stats.maxRange);
  const km = Math.max(0, stats.lifetimeDistanceM ?? 0) / 1000;

  const parts: ModgeirScorePart[] = [
    {
      id: "tiur",
      label: "Tiur",
      points: scorePart(tiur, 16, MODGEIR_AXIS_MAX),
      max: MODGEIR_AXIS_MAX,
      detail: `${tiur} / 16`,
    },
    {
      id: "orre",
      label: "Orrhaner",
      points: scorePart(orr, 12, MODGEIR_AXIS_MAX),
      max: MODGEIR_AXIS_MAX,
      detail: `${orr} / 12`,
    },
    {
      id: "range",
      label: "Max range",
      points: scorePart(Math.max(0, range - 150), 200, MODGEIR_AXIS_MAX),
      max: MODGEIR_AXIS_MAX,
      detail: `${range > 0 ? `${range} m` : "—"} (full ved 350 m)`,
    },
    {
      id: "km",
      label: "Km gått",
      points: scorePart(km, 50, MODGEIR_AXIS_MAX),
      max: MODGEIR_AXIS_MAX,
      detail: `${km > 0 ? `${km < 10 ? km.toFixed(1) : km.toFixed(0)} km` : "—"} / 50 km`,
    },
  ];

  const score = parts.reduce((s, p) => s + p.points, 0);
  const rounded = Math.round(score * 10) / 10;
  return {
    score: rounded,
    need: MODGEIR_PULK_SCORE_NEED,
    ok: rounded + 1e-9 >= MODGEIR_PULK_SCORE_NEED,
    parts,
  };
}
