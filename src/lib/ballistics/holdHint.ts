/**
 * Approximate elevation holds for range HUD without Kestrel —
 * band around exact mrad so players must shoot/write DOPE themselves.
 */

/** Half-width of the published band (~±0.15 mrad → e.g. 1.45 → 1.3–1.6). */
const HOLD_BAND_HALF_MRAD = 0.15;

export function dropMmToMrad(dropMm: number, distanceM: number): number {
  return dropMm / Math.max(1, distanceM);
}

export function approximateHoldMradBand(exactMrad: number): {
  lo: number;
  hi: number;
} {
  const m = Math.max(0, Math.abs(exactMrad));
  const lo = Math.max(0, Math.round((m - HOLD_BAND_HALF_MRAD) * 10) / 10);
  const hi = Math.round((m + HOLD_BAND_HALF_MRAD) * 10) / 10;
  return { lo, hi: Math.max(hi, lo) };
}

/** e.g. "1.3-1.6 mrad" */
export function formatApproximateHoldMrad(exactMrad: number): string {
  const { lo, hi } = approximateHoldMradBand(exactMrad);
  return `${lo.toFixed(1)}-${hi.toFixed(1)} mrad`;
}

/** e.g. "1.45 mrad" */
export function formatExactHoldMrad(exactMrad: number): string {
  return `${Math.abs(exactMrad).toFixed(2)} mrad`;
}
