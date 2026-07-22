/**
 * Spotting compass: landscape centre facing + horizontal FOV → map bearing.
 * Shared by SpotView (live «Ser mot») and Aware bird seat after lock.
 */

/** Half horizontal FOV of a full spotting photo (± from centre). */
export const SPOT_FRAME_HALF_FOV_DEG = 35;

/**
 * Compass bearing for a landscape X position (0–100 %).
 * Centre of photo = `viewBearingDeg`; left/right up to ±HALF_FOV.
 */
export function bearingFromSpotFrame(
  viewBearingDeg: number,
  landscapeXPct: number,
): number {
  const x = Math.min(100, Math.max(0, landscapeXPct));
  const offset = ((x - 50) / 50) * SPOT_FRAME_HALF_FOV_DEG;
  return (((viewBearingDeg + offset) % 360) + 360) % 360;
}
