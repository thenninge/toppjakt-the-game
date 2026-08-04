/**
 * Hidden POI shift when suppressor on/off does not match the zeroed state.
 * Magnitude 3–6 cm @ 100 m from muzzle OD — never shown to the player.
 */

import type { InstalledCustomBarrel } from "@/lib/customs/customBarrel";
import { VARMINT_FACTORY_RIFLE_IDS } from "@/lib/range/barrelHeat";
import { angularMmAtDistance } from "@/lib/player";

/** Thin pencil (~16 mm OD) → 6 cm @ 100 m. */
const OD_THIN_MM = 16;
const SHIFT_THIN_MM = 60;
/** Thick (~20 mm OD) → 4 cm @ 100 m. */
const OD_THICK_MM = 20;
const SHIFT_THICK_MM = 40;
/** Floor / ceiling for extreme contours. */
const SHIFT_MIN_MM = 30;
const SHIFT_MAX_MM = 60;

/** Factory muzzle OD fallbacks (mm) when no CNC stations. */
const FACTORY_MUZZLE_OD_MM: Record<string, number> = {
  "rifle-tikka-t3x-lite": 16,
  "rifle-sauer-200str": 16,
  "rifle-tikka-t3x-super-varminter": 20,
  "rifle-tikka-t3x-tac-a1": 20,
  "rifle-rem-700-sa-65cm": 19,
  "rifle-rem-700-sa-hansen-custom": 20,
  "rifle-cz457": 17,
  "rifle-cz455": 17,
};

export function resolveMuzzleOdMm(
  rifleId: string,
  customBarrel?: InstalledCustomBarrel | null,
): number {
  const stations = customBarrel?.stations;
  if (stations && stations.length > 0) {
    const last = stations[stations.length - 1]!;
    if (Number.isFinite(last.diameterMm) && last.diameterMm > 0) {
      return last.diameterMm;
    }
  }
  const mapped = FACTORY_MUZZLE_OD_MM[rifleId];
  if (mapped != null) return mapped;
  if (VARMINT_FACTORY_RIFLE_IDS.has(rifleId)) return 20;
  if (/lite|ultralight|mountain|scout/i.test(rifleId)) return 16;
  return 18;
}

/** Absolute vertical shift magnitude (mm @ 100 m). */
export function suppressorPoiShiftMagnitudeMm(muzzleOdMm: number): number {
  const od = Math.max(14, Math.min(24, muzzleOdMm));
  const t = (od - OD_THIN_MM) / (OD_THICK_MM - OD_THIN_MM);
  const mag = SHIFT_THIN_MM + t * (SHIFT_THICK_MM - SHIFT_THIN_MM);
  return Math.max(SHIFT_MIN_MM, Math.min(SHIFT_MAX_MM, mag));
}

/**
 * Vertical POI delta as mm-at-100 m (game: −Y = up, +Y = down).
 * Zero when suppressor state matches the zeroed state, or flag unknown.
 */
export function suppressorPoiDeltaYMmAt100(opts: {
  /** Whether zero was saved with a suppressor mounted. */
  zeroedWithSuppressor: boolean | undefined;
  /** Suppressor currently mounted. */
  hasSuppressor: boolean;
  muzzleOdMm: number;
}): number {
  const { zeroedWithSuppressor, hasSuppressor, muzzleOdMm } = opts;
  if (zeroedWithSuppressor == null) return 0;
  if (zeroedWithSuppressor === hasSuppressor) return 0;
  const mag = suppressorPoiShiftMagnitudeMm(muzzleOdMm);
  // Zeroed with can, shoot bare → POI up (−Y).
  if (zeroedWithSuppressor && !hasSuppressor) return -mag;
  // Zeroed bare, shoot with can → POI down (+Y).
  return mag;
}

/** Paper shift at distance (same angular scaling as zero). */
export function suppressorPoiDeltaMmAtDistance(
  opts: {
    zeroedWithSuppressor: boolean | undefined;
    hasSuppressor: boolean;
    muzzleOdMm: number;
  },
  distanceM: number,
): { xMm: number; yMm: number } {
  const yAt100 = suppressorPoiDeltaYMmAt100(opts);
  return {
    xMm: 0,
    yMm: angularMmAtDistance(yAt100, distanceM),
  };
}
