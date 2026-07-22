/**
 * Stock / chassis contribution to group size (additive MOA).
 *
 * Stiffer / better-bedded stocks shave MOA off the rifle+ammo floor:
 *   effectiveMoa = rifleMoa + ammoMoa… + stock.moaDelta
 * where moaDelta is negative for an improvement (e.g. -0.05).
 *
 * Soft / ill-fitting budget stocks can be positive (worse group).
 * **Never 0** — every stock in XXL must move the needle.
 *
 * Example: rifle+ammo 0.40 MOA + stock -0.05 → 0.35 MOA.
 */

export type StockSpec = {
  /**
   * Signed MOA delta on the combined precision floor.
   * Negative = tighter (e.g. -0.05); positive = worse (soft budget).
   * Must not be 0.
   */
  moaDelta: number;
};

/** Apply stock to a combined rifle+ammo (or partial) MOA floor. */
export function applyStockMoaDelta(baseMoa: number, stock: StockSpec): number {
  return Math.max(0.05, baseMoa + stock.moaDelta);
}
