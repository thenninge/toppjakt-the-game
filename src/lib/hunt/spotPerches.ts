/**
 * Realistic tiur perch points per spot landscape image.
 *
 * ## How to mark (best for the agent)
 * For each spot image, add an entry keyed by the public path.
 * Coordinates are **percent of the image frame** (same as BirdVisualPlacement):
 * - x: 0 = left edge, 100 = right
 * - y: 0 = top, 100 = bottom
 * - Place the point on the **tree crown / perch** where the tiur sprite should sit
 *   (roughly center of the bird body, not the tip of a tiny twig).
 *
 * Tip: open the image, estimate “about 40% from the left, 22% from the top”.
 * Or use a quick overlay later — JSON below is enough to start.
 *
 * Example:
 *   "/images/spot1.png": [
 *     { x: 38, y: 18, note: "stor furu midt-venstre" },
 *     { x: 72, y: 26, note: "høyre krone" },
 *   ],
 */

export type SpotPerch = {
  /** 0–100, left → right */
  x: number;
  /** 0–100, top → bottom */
  y: number;
  /** Optional human note (which tree). */
  note?: string;
};

export type SpotPerchCatalog = Record<string, SpotPerch[]>;

/**
 * Fill this in as you pick realistic trees per image.
 * Empty array / missing key → game falls back to random crown band.
 */
export const SPOT_PERCHES: SpotPerchCatalog = {
  // "/images/spot1.png": [
  //   { x: 58, y: 24, note: "test-tre" },
  // ],
};

export function perchesForSpotImage(imageSrc: string): SpotPerch[] {
  return SPOT_PERCHES[imageSrc] ?? [];
}
