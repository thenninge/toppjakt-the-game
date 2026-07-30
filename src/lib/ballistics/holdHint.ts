/**
 * Approximate elevation holds for range HUD without Kestrel —
 * band around exact mrad so players must shoot/write DOPE themselves.
 *
 * Exact centre of the band matches the same drop used for range impacts
 * (physics or CB Real drop table).
 */

import {
  clickSizeMmAt100,
  clickUnitSuffix,
  mmAt100ToAngular,
} from "@/lib/optics/clicks";
import type { ScopeClickUnit } from "@/lib/optics/spec";

/** Half-width of the published band (~±0.15 mrad → e.g. 1.45 → 1.3–1.6). */
const HOLD_BAND_HALF_MRAD = 0.15;

export function dropMmToMrad(dropMm: number, distanceM: number): number {
  return dropMm / Math.max(1, distanceM);
}

/** Drop below LOS (mm) → dial mm-at-100 (solver: +y = down dial). */
export function dropMmToDialYMmAt100(
  dropMm: number,
  distanceM: number,
): number {
  return (-dropMm * 100) / Math.max(1, distanceM);
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

/**
 * Hold band in scope language: angular + klikk.
 * Without Kestrel: approximate. With Kestrel callers use {@link formatExactHoldLabel}.
 */
export function formatApproximateHoldLabel(
  exactMrad: number,
  clickUnit: ScopeClickUnit = "MRAD",
): string {
  const { lo, hi } = approximateHoldMradBand(exactMrad);
  const suffix = clickUnitSuffix(clickUnit);
  const loAng = Math.abs(mmAt100ToAngular(lo * 100, clickUnit));
  const hiAng = Math.abs(mmAt100ToAngular(hi * 100, clickUnit));
  const clickMm = clickSizeMmAt100(clickUnit);
  const loClicks = Math.round((lo * 100) / clickMm);
  const hiClicks = Math.round((hi * 100) / clickMm);
  const angDigits = clickUnit === "MOA" ? 2 : 1;
  const angPart =
    Math.abs(loAng - hiAng) < 1e-6
      ? `${loAng.toFixed(angDigits)} ${suffix}`
      : `${loAng.toFixed(angDigits)}-${hiAng.toFixed(angDigits)} ${suffix}`;
  const clickPart =
    loClicks === hiClicks
      ? `${loClicks} klikk`
      : `${loClicks}-${hiClicks} klikk`;
  return `${angPart} · ${clickPart}`;
}

/** Exact hold for Kestrel: angular + klikk. */
export function formatExactHoldLabel(
  exactMrad: number,
  clickUnit: ScopeClickUnit = "MRAD",
): string {
  const m = Math.abs(exactMrad);
  const suffix = clickUnitSuffix(clickUnit);
  const ang = Math.abs(mmAt100ToAngular(m * 100, clickUnit));
  const clicks = Math.abs(
    Math.round((m * 100) / clickSizeMmAt100(clickUnit)),
  );
  const angDigits = clickUnit === "MOA" ? 2 : 1;
  return `${ang.toFixed(angDigits)} ${suffix} · ${clicks} klikk`;
}
