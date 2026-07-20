/**
 * Rulles landowner audience gates — hunt résumé before snøvling.
 */

import type { PlayerStats } from "@/lib/player";

export type AudienceRequirement = {
  /** tiur + orrhaner */
  minBirdsTotal?: number;
  minTiur?: number;
  minOrrhaner?: number;
  /** Inclusive minimum maxRange (m). Use 401 for «over 400 m». */
  minMaxRangeM?: number;
};

export type AudienceCheck = {
  ok: boolean;
  /** Human lines for missing pieces. */
  missing: string[];
  /** Compact progress lines. */
  progress: string[];
};

export const RULLES_AUDIENCE: Record<
  "kari" | "kristian" | "lovenskiold",
  AudienceRequirement
> = {
  kari: { minBirdsTotal: 10, minMaxRangeM: 250 },
  kristian: { minBirdsTotal: 20, minMaxRangeM: 300 },
  lovenskiold: { minTiur: 20, minOrrhaner: 10, minMaxRangeM: 401 },
};

export function checkAudience(
  stats: Pick<
    PlayerStats,
    "tiur" | "orrhaner" | "maxRange" | "lifetimeTiur" | "lifetimeOrrhaner"
  >,
  req: AudienceRequirement,
): AudienceCheck {
  const tiur = stats.lifetimeTiur ?? stats.tiur;
  const orr = stats.lifetimeOrrhaner ?? stats.orrhaner;
  const birds = tiur + orr;
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

  return { ok: missing.length === 0, missing, progress };
}
