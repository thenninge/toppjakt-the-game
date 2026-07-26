/**
 * Committed hit-zone catalog — ship defaults for every player.
 *
 * Admin «Lagre» only writes browser localStorage. Use Admin → Treffområde →
 * «Skriv til repo (dev)» to overwrite this file from calibrated overrides,
 * then commit + push so GitHub has the real defaults.
 *
 * Zones:
 * - Yellow (head): instant kill — headshot
 * - Green (chest): instant kill — bird drops
 * - Red: vital — short ettersøk
 * - Body ellipse: wound — ettersøk toward max fly radius
 * - Outside: clean miss
 *
 * Auto-generated 2026-07-26T00:18:18.719Z — do not hand-edit unless needed.
 */

import type { BirdSpriteId } from "@/lib/hunt/birdSprites";

export type BirdHitZone = {
  vitalCxPx: number;
  vitalCyPx: number;
  instantDiameterMm: number;
  vitalDiameterMm: number;
  headCxPx: number;
  headCyPx: number;
  headDiameterMm: number;
  bodyRxMm: number;
  bodyRyMm: number;
  bodyOffsetXMm: number;
  bodyOffsetYMm: number;
  bodyRotationDeg: number;
};

export const BIRD_HIT_ZONE_CATALOG: Record<BirdSpriteId, BirdHitZone> = {
  "tiur-1": {
    vitalCxPx: 39.2,
    vitalCyPx: 75,
    instantDiameterMm: 61,
    vitalDiameterMm: 106,
    headCxPx: 29.5,
    headCyPx: 28.7,
    headDiameterMm: 42,
    bodyRxMm: 72,
    bodyRyMm: 96,
    bodyOffsetXMm: 11,
    bodyOffsetYMm: 23,
    bodyRotationDeg: 339,
  },
  "tiur-2": {
    vitalCxPx: 53.6,
    vitalCyPx: 47.9,
    instantDiameterMm: 67,
    vitalDiameterMm: 105,
    headCxPx: 61.1,
    headCyPx: 14.6,
    headDiameterMm: 42,
    bodyRxMm: 59,
    bodyRyMm: 108,
    bodyOffsetXMm: -33,
    bodyOffsetYMm: 26,
    bodyRotationDeg: 51,
  },
  "tiur-1b": {
    vitalCxPx: 100,
    vitalCyPx: 162,
    instantDiameterMm: 66,
    vitalDiameterMm: 95,
    headCxPx: 83.6,
    headCyPx: 62.7,
    headDiameterMm: 42,
    bodyRxMm: 61,
    bodyRyMm: 81,
    bodyOffsetXMm: -12,
    bodyOffsetYMm: 19,
    bodyRotationDeg: 23,
  },
  "tiur-2b": {
    vitalCxPx: 156.5,
    vitalCyPx: 145,
    instantDiameterMm: 57,
    vitalDiameterMm: 89,
    headCxPx: 164.6,
    headCyPx: 37.1,
    headDiameterMm: 42,
    bodyRxMm: 48,
    bodyRyMm: 85,
    bodyOffsetXMm: -18,
    bodyOffsetYMm: 17,
    bodyRotationDeg: 35,
  },
  "tiur-3b": {
    vitalCxPx: 65,
    vitalCyPx: 96.5,
    instantDiameterMm: 80,
    vitalDiameterMm: 113,
    headCxPx: 77.7,
    headCyPx: 38,
    headDiameterMm: 42,
    bodyRxMm: 69,
    bodyRyMm: 91,
    bodyOffsetXMm: -8,
    bodyOffsetYMm: 16,
    bodyRotationDeg: 25,
  },
  "tiur-4b": {
    vitalCxPx: 110,
    vitalCyPx: 91,
    instantDiameterMm: 66,
    vitalDiameterMm: 100,
    headCxPx: 130.5,
    headCyPx: 42.7,
    headDiameterMm: 42,
    bodyRxMm: 56,
    bodyRyMm: 123,
    bodyOffsetXMm: -27,
    bodyOffsetYMm: 23,
    bodyRotationDeg: 52,
  },
  "orre-1": {
    vitalCxPx: 27.2,
    vitalCyPx: 41.8,
    instantDiameterMm: 77,
    vitalDiameterMm: 121,
    headCxPx: 22,
    headCyPx: 20.4,
    headDiameterMm: 42,
    bodyRxMm: 86,
    bodyRyMm: 135,
    bodyOffsetXMm: 26,
    bodyOffsetYMm: 42,
    bodyRotationDeg: 318,
  },
  "orre-2": {
    vitalCxPx: 74.8,
    vitalCyPx: 73.7,
    instantDiameterMm: 66,
    vitalDiameterMm: 93,
    headCxPx: 81.4,
    headCyPx: 30.1,
    headDiameterMm: 42,
    bodyRxMm: 67,
    bodyRyMm: 121,
    bodyOffsetXMm: -36,
    bodyOffsetYMm: 43,
    bodyRotationDeg: 41,
  },
  "orre-1b": {
    vitalCxPx: 81.5,
    vitalCyPx: 107.5,
    instantDiameterMm: 76,
    vitalDiameterMm: 108,
    headCxPx: 64.5,
    headCyPx: 39.4,
    headDiameterMm: 42,
    bodyRxMm: 63,
    bodyRyMm: 94,
    bodyOffsetXMm: 3,
    bodyOffsetYMm: 21,
    bodyRotationDeg: 349,
  },
  "orre-2b": {
    vitalCxPx: 117.5,
    vitalCyPx: 85,
    instantDiameterMm: 86,
    vitalDiameterMm: 121,
    headCxPx: 130.5,
    headCyPx: 28.8,
    headDiameterMm: 42,
    bodyRxMm: 68,
    bodyRyMm: 107,
    bodyOffsetXMm: -11,
    bodyOffsetYMm: 24,
    bodyRotationDeg: 32,
  },
  "orre-3b": {
    vitalCxPx: 113,
    vitalCyPx: 100.5,
    instantDiameterMm: 73,
    vitalDiameterMm: 107,
    headCxPx: 130.2,
    headCyPx: 36,
    headDiameterMm: 42,
    bodyRxMm: 62,
    bodyRyMm: 110,
    bodyOffsetXMm: -36,
    bodyOffsetYMm: 26,
    bodyRotationDeg: 47,
  },
  "orre-4b": {
    vitalCxPx: 119.5,
    vitalCyPx: 74.5,
    instantDiameterMm: 98,
    vitalDiameterMm: 142,
    headCxPx: 158,
    headCyPx: 30.4,
    headDiameterMm: 42,
    bodyRxMm: 130,
    bodyRyMm: 82,
    bodyOffsetXMm: -13,
    bodyOffsetYMm: 11,
    bodyRotationDeg: 350,
  },
  "orre-5b": {
    vitalCxPx: 82.5,
    vitalCyPx: 134.5,
    instantDiameterMm: 72,
    vitalDiameterMm: 105,
    headCxPx: 83.6,
    headCyPx: 32.9,
    headDiameterMm: 42,
    bodyRxMm: 60,
    bodyRyMm: 97,
    bodyOffsetXMm: 3,
    bodyOffsetYMm: 24,
    bodyRotationDeg: 353,
  },
  "ugle-1": {
    vitalCxPx: 62.7,
    vitalCyPx: 82,
    instantDiameterMm: 116,
    vitalDiameterMm: 146,
    headCxPx: 62.3,
    headCyPx: 30.4,
    headDiameterMm: 42,
    bodyRxMm: 83,
    bodyRyMm: 123,
    bodyOffsetXMm: 0,
    bodyOffsetYMm: 32,
    bodyRotationDeg: 0,
  },
};
