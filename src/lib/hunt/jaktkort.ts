/**
 * Inatur jaktkort tiers — priced from the terrain's day rate.
 *   Dag: 1× day price, 1 hunting day
 *   Uke: 4× day price, 7 hunting days
 *   Sesong: 30× day price, 30 hunting days
 *
 * Multiple terrains can hold active cards at once (keyed by terrainId).
 */

export type JaktkortKind = "day" | "week" | "season";

export type ActiveJaktkort = {
  terrainId: string;
  kind: JaktkortKind;
  /** Hunting days left (including the current outing until end/overnight). */
  daysRemaining: number;
  paidNok: number;
};

/** Active cards keyed by terrain id. */
export type JaktkortBook = Record<string, ActiveJaktkort>;

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

export function emptyJaktkortBook(): JaktkortBook {
  return {};
}

export function getJaktkortForTerrain(
  book: JaktkortBook | null | undefined,
  terrainId: string | null | undefined,
): ActiveJaktkort | null {
  if (!book || !terrainId) return null;
  const kort = book[terrainId];
  if (!kort || kort.daysRemaining <= 0) return null;
  return kort;
}

export function listActiveJaktkort(
  book: JaktkortBook | null | undefined,
): ActiveJaktkort[] {
  if (!book) return [];
  return Object.values(book).filter((k) => k.daysRemaining > 0);
}

/** Insert or replace the card for that terrain only — other terrains stay. */
export function upsertJaktkort(
  book: JaktkortBook,
  kort: ActiveJaktkort,
): JaktkortBook {
  if (kort.daysRemaining <= 0) {
    const next = { ...book };
    delete next[kort.terrainId];
    return next;
  }
  return { ...book, [kort.terrainId]: kort };
}

function setTerrainKort(
  book: JaktkortBook,
  terrainId: string,
  kort: ActiveJaktkort | null,
): JaktkortBook {
  const next = { ...book };
  if (!kort || kort.daysRemaining <= 0) {
    delete next[terrainId];
  } else {
    next[terrainId] = kort;
  }
  return next;
}

/**
 * Avslutt jakt: dagskort er brukt opp. Uke/sesong beholder gjenværende dager.
 * Only the card for {@link terrainId} is touched.
 */
export function consumeJaktkortOnEndHunt(
  book: JaktkortBook,
  terrainId: string | null | undefined,
): JaktkortBook {
  if (!terrainId) return book;
  const kort = book[terrainId];
  if (!kort) return book;
  if (kort.kind === "day") {
    return setTerrainKort(book, terrainId, null);
  }
  return book;
}

/**
 * Overnatting ute: én jaktdag er brukt. Dagskort → tomt; uke/sesong −1 dag.
 * Only the card for {@link terrainId} is touched.
 */
export function consumeJaktkortOnOvernight(
  book: JaktkortBook,
  terrainId: string | null | undefined,
): JaktkortBook {
  if (!terrainId) return book;
  const kort = book[terrainId];
  if (!kort) return book;
  if (kort.kind === "day") {
    return setTerrainKort(book, terrainId, null);
  }
  const days = Math.max(0, kort.daysRemaining - 1);
  if (days <= 0) return setTerrainKort(book, terrainId, null);
  return setTerrainKort(book, terrainId, { ...kort, daysRemaining: days });
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

/**
 * Accepts legacy single {@link ActiveJaktkort}, a terrain-keyed book, or an array.
 */
export function normalizeJaktkortBook(raw: unknown): JaktkortBook {
  if (raw == null) return emptyJaktkortBook();

  // Legacy: one card object.
  const single = normalizeJaktkort(raw);
  if (single) return { [single.terrainId]: single };

  if (Array.isArray(raw)) {
    const book: JaktkortBook = {};
    for (const entry of raw) {
      const kort = normalizeJaktkort(entry);
      if (kort) book[kort.terrainId] = kort;
    }
    return book;
  }

  if (typeof raw !== "object") return emptyJaktkortBook();

  const book: JaktkortBook = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const kort = normalizeJaktkort(value);
    if (!kort) continue;
    // Prefer terrainId on the card; fall back to map key.
    const id = kort.terrainId || key;
    book[id] = { ...kort, terrainId: id };
  }
  return book;
}
