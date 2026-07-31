/**
 * Scope mounts / kikkertmontasje — tube diameter + zero-retention tier.
 *
 * Tube diameters are fixed per mount SKU; a 30 mm mount cannot hold a 34 mm
 * scope (nor 35 / 36). Kit packing and hunt/range readiness require a mount
 * matching the packed scope tube exactly.
 *
 * Tiers:
 * - top (Spuhr / Recknagel): QD-class — keep zero when removing/remounting;
 *   swapping scopes of the same diameter transfers verified zeros.
 * - mid (Leupold / Sako): solid while mounted; removing mount or scope
 *   clears zero (must re-zero after remount).
 * - budget (Hawke): same clear-on-remove as mid, plus ±2 clicks random
 *   zero drift each hunt.
 */

export type ScopeTubeDiameterMm = 25.4 | 30 | 34 | 35 | 36;

export type MountTier = "top" | "mid" | "budget";

export type MountSpec = {
  tubeDiameterMm: ScopeTubeDiameterMm;
  tier: MountTier;
};

export function formatTubeDiameterMm(mm: ScopeTubeDiameterMm): string {
  if (mm === 25.4) return '1"';
  return `${mm} mm`;
}

export function mountTierLabelNb(tier: MountTier): string {
  if (tier === "top") return "Toppklasse";
  if (tier === "mid") return "Mellomklasse";
  return "Budsjett";
}

export function mountTierNoteNb(tier: MountTier): string {
  if (tier === "top") {
    return "QD-retensjon — beholder zero ved av/på; bytte kikkert (samme diameter) krever ikke ny zero.";
  }
  if (tier === "mid") {
    return "God retensjon på våpenet — null endring mens montert; av/på krever ny innskyting.";
  }
  return "Svak retensjon — ±2 klikk drift hver jakt; av/på krever ny innskyting.";
}

/** True when removing a scope should wipe its zero profiles. */
export function mountClearsZeroOnScopeRemove(tier: MountTier | null | undefined): boolean {
  return tier !== "top";
}

/** True when removing the mount should wipe the packed scope's zeros. */
export function mountClearsZeroOnMountRemove(tier: MountTier): boolean {
  return tier !== "top";
}

/**
 * Hawke / budget: random integer clicks in [−2, 2] per axis, as mm @ 100 m.
 * (0.1 mil click = 10 mm @ 100 m — same as {@link ZERO_CLICK_MM}.)
 */
export function rollHawkeHuntZeroDriftMm(
  random: () => number = Math.random,
  mmPerClick = 10,
): { xMm: number; yMm: number } {
  const clicks = () => Math.floor(random() * 5) - 2; // -2..2
  return { xMm: clicks() * mmPerClick, yMm: clicks() * mmPerClick };
}
