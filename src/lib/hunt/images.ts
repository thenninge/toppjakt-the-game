/**
 * Atmosphere images under /public/images for hunt spotting & travel.
 *
 * Layout:
 *   /images/           — default pool (always used as fallback)
 *   /images/snow/
 *   /images/frost/
 *   /images/fog/
 *   /images/forest/    — scene pools; empty → fall back to /images/
 *
 * Drop files into a scene folder when ready; keep names spot* / walk*.
 */

export type HuntImageScene = "snow" | "frost" | "fog" | "forest";

export const HUNT_IMAGE_SCENES: HuntImageScene[] = [
  "snow",
  "frost",
  "fog",
  "forest",
];

/** Root /images — used when a scene folder has no matching files. */
const ROOT_SPOT_IMAGES: string[] = [
  "/images/spot1.png",
  "/images/spot2.png",
  "/images/spot3.png",
  "/images/spot4.png",
  "/images/spot5.png",
  "/images/spot6.jpg",
  "/images/spot7.jpg",
  "/images/spot8.jpg",
  "/images/spot9.png",
  "/images/spot10.png",
  "/images/spot11.png",
  "/images/spot12.png",
  "/images/spot13.png",
  "/images/spot14.png",
  "/images/spot15.png",
  "/images/spot16.png",
  "/images/spot17.png",
  "/images/spot18.png",
  "/images/spot19fog.png",
  "/images/spot20fog.png",
  "/images/spot21.png",
  "/images/spot22.png",
  "/images/spot23.png",
];

/**
 * Hand-composited spot photo (tiurer already in the frame).
 * Used on the map start tile for bino/FOV testing — no sprite overlays.
 */
export const SPOT_TEST_IMAGE = "/images/spot_test.png";

/** Spot images with birds baked into the photo (skip tiurtopp overlays). */
export function isBakedSpotImage(imageSrc: string): boolean {
  return imageSrc === SPOT_TEST_IMAGE || imageSrc.includes("spot_test");
}

const ROOT_WALK_IMAGES: string[] = [
  "/images/walk1_snow.png",
  "/images/walk2_snow.png",
  "/images/walk3.png",
  "/images/walk4.png",
  "/images/walk5.png",
  "/images/walk6.png",
  "/images/walk6snow.png",
  "/images/walk7.png",
  "/images/walk8.png",
  "/images/walk9.png",
  "/images/walk10.png",
];

const EAT_IMAGES: string[] = [
  "/images/eat1.JPG",
  "/images/eat2.png",
  "/images/eat3.png",
  "/images/eat4.png",
];

export const REST_TIRED_IMAGE = "/images/rest_tired.png";

/** Forced rest when physical stamina is empty (fatigue = 1). */
export const FORCED_REST_MINUTES = 60;

/**
 * Scene-specific pools. Empty arrays → fall back to root.
 * Fill these as you move/add files under /public/images/<scene>/.
 */
const SCENE_SPOT_IMAGES: Record<HuntImageScene, string[]> = {
  snow: [],
  frost: [],
  fog: [],
  forest: [],
};

const SCENE_WALK_IMAGES: Record<HuntImageScene, string[]> = {
  snow: [],
  frost: [],
  fog: [],
  forest: [],
};

/** @deprecated Prefer spotImagesForScene / pickSpotImage — kept for callers. */
export const SPOT_IMAGES = ROOT_SPOT_IMAGES;
/** @deprecated Prefer walkImagesForScene / pickWalkImage */
export const WALK_IMAGES = ROOT_WALK_IMAGES;

export function spotImagesForScene(
  scene?: HuntImageScene | null,
): readonly string[] {
  if (!scene) return ROOT_SPOT_IMAGES;
  const pool = SCENE_SPOT_IMAGES[scene];
  return pool.length > 0 ? pool : ROOT_SPOT_IMAGES;
}

export function walkImagesForScene(
  scene?: HuntImageScene | null,
): readonly string[] {
  if (!scene) return ROOT_WALK_IMAGES;
  const pool = SCENE_WALK_IMAGES[scene];
  return pool.length > 0 ? pool : ROOT_WALK_IMAGES;
}

export function pickRandomImage(pool: readonly string[]): string {
  if (pool.length === 0) {
    return ROOT_SPOT_IMAGES[0] ?? "/images/spot1.png";
  }
  const i = Math.floor(Math.random() * pool.length);
  return pool[i]!;
}

export function pickSpotImage(scene?: HuntImageScene | null): string {
  return pickRandomImage(spotImagesForScene(scene));
}

export function pickWalkImage(scene?: HuntImageScene | null): string {
  return pickRandomImage(walkImagesForScene(scene));
}

export function pickEatImage(): string {
  return pickRandomImage(EAT_IMAGES);
}

/** Eyes: 1 real second = 1 game second. Binos: 1 real = 5 game. */
export const SPOT_TIME_FACTOR_EYES = 1;
export const SPOT_TIME_FACTOR_BINOS = 5;

/** Fallback bino zoom when kit magnification is unknown (10× class). */
export const DEFAULT_BINOS_MAGNIFICATION = 10;

/** @deprecated Prefer equipped LRF magnification — kept as DEFAULT alias. */
export const BINOS_ZOOM = DEFAULT_BINOS_MAGNIFICATION;
