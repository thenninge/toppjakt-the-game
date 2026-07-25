/**
 * Committed hit-zone catalog — ship defaults for every player.
 *
 * Admin «Lagre» only writes browser localStorage. Use Admin → Treffområde →
 * «Skriv til repo (dev)» to overwrite this file from calibrated overrides,
 * then commit + push so GitHub has the real defaults.
 *
 * Auto-generated 2026-07-25T23:47:05.554Z — do not hand-edit unless needed.
 */

import type { BirdSpriteId } from "@/lib/hunt/birdSprites";

export type BirdHitZone = {
  vitalCxPx: number;
  vitalCyPx: number;
  instantDiameterMm: number;
  vitalDiameterMm: number;
};

/**
 * Per-sprite green (instant) / red (vital) zones on the topp sprite.
 * Source of truth for catalogHitZone when no local override exists.
 */
export const BIRD_HIT_ZONE_CATALOG: Record<BirdSpriteId, BirdHitZone> = {
  "tiur-1": {
    vitalCxPx: 38.1,
    vitalCyPx: 72.8,
    instantDiameterMm: 63,
    vitalDiameterMm: 105,
  },
  "tiur-2": {
    vitalCxPx: 53.6,
    vitalCyPx: 47.9,
    instantDiameterMm: 67,
    vitalDiameterMm: 105,
  },
  "tiur-1b": {
    vitalCxPx: 100,
    vitalCyPx: 162,
    instantDiameterMm: 66,
    vitalDiameterMm: 95,
  },
  "tiur-2b": {
    vitalCxPx: 156.5,
    vitalCyPx: 145,
    instantDiameterMm: 57,
    vitalDiameterMm: 89,
  },
  "tiur-3b": {
    vitalCxPx: 65,
    vitalCyPx: 96.5,
    instantDiameterMm: 80,
    vitalDiameterMm: 113,
  },
  "tiur-4b": {
    vitalCxPx: 110,
    vitalCyPx: 91,
    instantDiameterMm: 66,
    vitalDiameterMm: 100,
  },
  "orre-1": {
    vitalCxPx: 27.2,
    vitalCyPx: 41.8,
    instantDiameterMm: 77,
    vitalDiameterMm: 121,
  },
  "orre-2": {
    vitalCxPx: 74.8,
    vitalCyPx: 73.7,
    instantDiameterMm: 66,
    vitalDiameterMm: 93,
  },
  "orre-1b": {
    vitalCxPx: 81.5,
    vitalCyPx: 107.5,
    instantDiameterMm: 76,
    vitalDiameterMm: 108,
  },
  "orre-2b": {
    vitalCxPx: 117.5,
    vitalCyPx: 85,
    instantDiameterMm: 86,
    vitalDiameterMm: 121,
  },
  "orre-3b": {
    vitalCxPx: 113,
    vitalCyPx: 100.5,
    instantDiameterMm: 73,
    vitalDiameterMm: 107,
  },
  "orre-4b": {
    vitalCxPx: 119.5,
    vitalCyPx: 74.5,
    instantDiameterMm: 98,
    vitalDiameterMm: 142,
  },
  "orre-5b": {
    vitalCxPx: 82.5,
    vitalCyPx: 134.5,
    instantDiameterMm: 72,
    vitalDiameterMm: 105,
  },
  "ugle-1": {
    vitalCxPx: 62.7,
    vitalCyPx: 82,
    instantDiameterMm: 116,
    vitalDiameterMm: 146,
  },
};
