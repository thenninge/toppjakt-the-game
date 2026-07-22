/**
 * Atmosphere images under /public/images — sorted by **folder**, not filename.
 *
 *   /images/spot/     — spotting landscapes
 *   /images/spot/placement/ — marker guides (shape/color → species/range)
 *   /images/prespotted/ — extreme-caution auto-spot splash
 *   /images/walk/     — travel between cells
 *   /images/eat/      — eat / rest pauses
 *   /images/rest/     — forced rest
 *   /images/funn/     — ettersøk find reveal
 *   /images/endex/    — skuddlys over / end of day
 *   /images/fire/     — tyribål / camp overnight
 *   /images/birds/    — sprites (tiur/, flukt/, …)
 *   /images/gear/     — kit UI (Kestrel, …)
 *   /images/{snow,frost,fog,forest}/ — optional scene pools (empty → use spot/walk)
 *
 * Drop new files into the right folder and append the path below.
 */

export type HuntImageScene = "snow" | "frost" | "fog" | "forest";

export const HUNT_IMAGE_SCENES: HuntImageScene[] = [
  "snow",
  "frost",
  "fog",
  "forest",
];

const IMAGE_EXT = /\.(png|jpe?g|webp|gif)$/i;

/** Spot landscapes — /public/images/spot/ */
const SPOT_IMAGES: string[] = [
  "/images/spot/spot1.png",
  "/images/spot/spot2.png",
  "/images/spot/spot3.png",
  "/images/spot/spot4.png",
  "/images/spot/spot5.png",
  "/images/spot/spot6.jpg",
  "/images/spot/spot7.jpg",
  "/images/spot/spot8.jpg",
  "/images/spot/spot9.png",
  "/images/spot/spot10.png",
  "/images/spot/spot11.png",
  "/images/spot/spot12.png",
  "/images/spot/spot13.png",
  "/images/spot/spot14.png",
  "/images/spot/spot15.png",
  "/images/spot/spot16.png",
  "/images/spot/spot17.png",
  "/images/spot/spot18.png",
  "/images/spot/spot19fog.png",
  "/images/spot/spot20fog.png",
  "/images/spot/spot21.png",
  "/images/spot/spot22.png",
  "/images/spot/spot23.png",
];

/**
 * Hand-composited spot photo (tiurer already in the frame).
 * Used on the map start tile for bino/FOV testing — no sprite overlays.
 */
export const SPOT_TEST_IMAGE = "/images/spot/spot_test.png";

/** Spot images with birds baked into the photo (skip tiurtopp overlays). */
export function isBakedSpotImage(imageSrc: string): boolean {
  return imageSrc === SPOT_TEST_IMAGE || imageSrc.includes("spot_test");
}

/** Travel — /public/images/walk/ */
const WALK_IMAGES: string[] = [
  "/images/walk/walk1_snow.png",
  "/images/walk/walk2_snow.png",
  "/images/walk/walk3.png",
  "/images/walk/walk4.png",
  "/images/walk/walk5.png",
  "/images/walk/walk6.png",
  "/images/walk/walk6snow.png",
  "/images/walk/walk7.png",
  "/images/walk/walk8.png",
  "/images/walk/walk9.png",
  "/images/walk/walk10.png",
  "/images/walk/walk11.png",
  "/images/walk/walk12.png",
  "/images/walk/walk13.png",
  "/images/walk/walk19.png",
  "/images/walk/walk20.png",
  "/images/walk/walk21.png",
  "/images/walk/walk22.png",
];

/** Extreme-caution auto-spot splash — /public/images/prespotted/ */
const PRESPOTTED_IMAGES: string[] = [
  "/images/prespotted/prespotted1.png",
  "/images/prespotted/prespotted2.png",
  "/images/prespotted/prespotted3.png",
];

/** Eat / Rest pauses — /public/images/eat/ */
const EAT_IMAGES: string[] = [
  "/images/eat/eat1.JPG",
  "/images/eat/eat2.png",
  "/images/eat/eat3.png",
  "/images/eat/eat4.png",
];

/** Ettersøk find reveal — /public/images/funn/ */
const FUNN_IMAGES: string[] = [
  "/images/funn/funn1.png",
  "/images/funn/funn2.png",
  "/images/funn/funn3.png",
  "/images/funn/funn4.png",
  "/images/funn/funn5.png",
  "/images/funn/funn6.png",
  "/images/funn/funn7.png",
];

/** Tyribål / overnight camp — /public/images/fire/ */
const FIRE_IMAGES: string[] = [
  "/images/fire/fire1.png",
  "/images/fire/fire2.png",
  "/images/fire/fire3.png",
  "/images/fire/fire4.png",
  "/images/fire/fire5.png",
  "/images/fire/fire6.png",
];

export const REST_TIRED_IMAGE = "/images/rest/rest_tired.png";

/** Skuddlys over — get to the car. */
export const ENDEX_SUNSET_IMAGE = "/images/endex/endex_sunset.png";

/** Forced rest when physical stamina is empty (fatigue = 1). */
export const FORCED_REST_MINUTES = 60;

/**
 * Optional scene-specific pools under /images/<scene>/.
 * Empty → fall back to spot/ / walk/.
 * Fill when you add scene photos (any filename in that folder list).
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

export function spotImagesForScene(
  scene?: HuntImageScene | null,
): readonly string[] {
  if (!scene) return SPOT_IMAGES;
  const pool = SCENE_SPOT_IMAGES[scene];
  return pool.length > 0 ? pool : SPOT_IMAGES;
}

export function walkImagesForScene(
  scene?: HuntImageScene | null,
): readonly string[] {
  if (!scene) return WALK_IMAGES;
  const pool = SCENE_WALK_IMAGES[scene];
  return pool.length > 0 ? pool : WALK_IMAGES;
}

export function pickRandomImage(pool: readonly string[]): string {
  if (pool.length === 0) {
    return SPOT_IMAGES[0] ?? "/images/spot/spot1.png";
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

/** Random ettersøk find atmosphere image. */
export function pickFunnImage(): string {
  return pickRandomImage(FUNN_IMAGES);
}

/** Random tyribål image for overnight camp. */
export function pickFireImage(): string {
  return pickRandomImage(FIRE_IMAGES);
}

/** Extreme-caution: spotted the bird before it spotted you. */
export function pickPrespottedImage(): string {
  return pickRandomImage(PRESPOTTED_IMAGES);
}

/** Eyes: 1 real second = 1 game second. Binos: 1 real = 5 game. */
export const SPOT_TIME_FACTOR_EYES = 1;
export const SPOT_TIME_FACTOR_BINOS = 5;
/** Budget thermal (Lynx) — default when kit omits timeFactor. */
export const SPOT_TIME_FACTOR_THERMAL = 20;
/** Premium thermal (Condor) burns clock + battery faster. */
export const SPOT_TIME_FACTOR_THERMAL_PREMIUM = 30;
/** Full thermal charge as game-minutes (drains 1:1 with thermal game time). */
export const THERMAL_BATTERY_GAME_MINUTES = 60;

/** Fallback bino zoom when kit magnification is unknown (10× class). */
export const DEFAULT_BINOS_MAGNIFICATION = 10;

/** @deprecated Prefer equipped LRF magnification — kept as DEFAULT alias. */
export const BINOS_ZOOM = DEFAULT_BINOS_MAGNIFICATION;

/** True if path looks like an image asset (for future folder scans). */
export function isHuntImagePath(path: string): boolean {
  return IMAGE_EXT.test(path);
}
