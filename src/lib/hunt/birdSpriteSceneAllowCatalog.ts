/**
 * Committed deny-list: spotting image → sprite ids that must NOT appear
 * in the random pool for that landscape.
 *
 * Admin «Use in scene» writes browser localStorage first. Use Spotting →
 * «Lagre scene-pool til repo» to overwrite this file, then commit + push.
 *
 * Empty object = all sprites allowed everywhere.
 *
 * Auto-generated — do not hand-edit unless needed.
 */

import type { BirdSpriteId } from "@/lib/hunt/birdSprites";

/** spotImageSrc → denied sprite ids */
export const BIRD_SPRITE_SCENE_ALLOW_CATALOG: Record<
  string,
  BirdSpriteId[]
> = {};
