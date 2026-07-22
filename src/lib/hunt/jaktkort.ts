/**
 * Inatur jaktkort tiers — priced from the terrain's day rate.
 *   Dag: 1× day price, 1 hunting day
 *   Uke: 4× day price, 7 hunting days
 *   Sesong: 30× day price, 30 hunting days
 */

export type JaktkortKind = "day" | "week" | "season";

export type ActiveJaktkort = {
  terrainId: string;
  kind: JaktkortKind;
  /** Hunting days left (including the current outing until end/overnight). */
  daysRemaining: number;
  paidNok: number;
};

export const JAKTKORT_WEEK_PRICE_MULT = 4;
export const JAKTKORT_SEASON_PRICE_MULT = 30;
export const JAKTKORT_WEEK_DAYS = 7;
export const JAKTKORT_SEASON_DAYS = 30;

export const JAKTKORT_KINDS: JaktkortKind[] = ["day", "week", "season"];

export function jaktkortLabelNb(kind: JaktkortKind): string {
  if (kind === "week") return "Ukeskort";
  if (kind === "season") return "Sesongkort";
  return "Dagskort";
}

export function jaktkortDaysForKind(kind: JaktkortKind): number {
  if (kind === "week") return JAKTKORT_WEEK_DAYS;
  if (kind === "season") return JAKTKORT_SEASON_DAYS;
  return 1;
}

export function jaktkortPriceNok(
  pricePerDayNok: number,
  kind: JaktkortKind,
): number {
  const day = Math.max(0, Math.floor(pricePerDayNok));
  if (kind === "week") return day * JAKTKORT_WEEK_PRICE_MULT;
  if (kind === "season") return day * JAKTKORT_SEASON_PRICE_MULT;
  return day;
}

export function jaktkortBlurbNb(kind: JaktkortKind): string {
  if (kind === "week") {
    return `${JAKTKORT_WEEK_DAYS} jaktdager · ${JAKTKORT_WEEK_PRICE_MULT}× dagspris · −1 dag per overnatting`;
  }
  if (kind === "season") {
    return `${JAKTKORT_SEASON_DAYS} jaktdager · ${JAKTKORT_SEASON_PRICE_MULT}× dagspris · −1 dag per overnatting`;
  }
  return "1 jaktdag · brukes opp ved avsluttet jakt eller overnatting ute";
}

export function createJaktkort(
  terrainId: string,
  kind: JaktkortKind,
  pricePerDayNok: number,
): ActiveJaktkort {
  return {
    terrainId,
    kind,
    daysRemaining: jaktkortDaysForKind(kind),
    paidNok: jaktkortPriceNok(pricePerDayNok, kind),
  };
}

/**
 * Avslutt jakt: dagskort er brukt opp. Uke/sesong beholder gjenværende dager.
 */
export function consumeJaktkortOnEndHunt(
  kort: ActiveJaktkort | null,
): ActiveJaktkort | null {
  if (!kort) return null;
  if (kort.kind === "day") return null;
  return { ...kort };
}

/**
 * Overnatting ute: én jaktdag er brukt. Dagskort → tomt; uke/sesong −1 dag.
 */
export function consumeJaktkortOnOvernight(
  kort: ActiveJaktkort | null,
): ActiveJaktkort | null {
  if (!kort) return null;
  if (kort.kind === "day") return null;
  const days = Math.max(0, kort.daysRemaining - 1);
  if (days <= 0) return null;
  return { ...kort, daysRemaining: days };
}

export function formatJaktkortStatusNb(kort: ActiveJaktkort): string {
  const label = jaktkortLabelNb(kort.kind);
  if (kort.kind === "day") return `${label} (1 tur)`;
  return `${label} · ${kort.daysRemaining} dag${kort.daysRemaining === 1 ? "" : "er"} igjen`;
}

export function normalizeJaktkort(raw: unknown): ActiveJaktkort | null {
  if (typeof raw !== "object" || raw == null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.terrainId !== "string" || !o.terrainId) return null;
  const kind =
    o.kind === "week" || o.kind === "season" || o.kind === "day"
      ? o.kind
      : null;
  if (!kind) return null;
  const daysRemaining =
    typeof o.daysRemaining === "number" && Number.isFinite(o.daysRemaining)
      ? Math.max(0, Math.floor(o.daysRemaining))
      : 0;
  if (daysRemaining <= 0) return null;
  const paidNok =
    typeof o.paidNok === "number" && Number.isFinite(o.paidNok)
      ? Math.max(0, Math.floor(o.paidNok))
      : 0;
  return { terrainId: o.terrainId, kind, daysRemaining, paidNok };
}
