/**
 * Helpers for Admin Scene creation — next batch-B path, perch renumber, serialize.
 */

import type { BirdSpecies } from "@/lib/hunt/birds";
import type { SpotPerch } from "@/lib/hunt/spotPerches";
import { SPOT_IMAGES } from "@/lib/hunt/images";
import { SPOT_PERCHES } from "@/lib/hunt/spotPerches";

export type SceneDraftPerch = {
  id: string;
  x: number;
  y: number;
  species: Extract<BirdSpecies, "tiur" | "orrhane">;
  distanceMinM: number;
  distanceMaxM: number;
  eyesVisible: boolean;
  scalePercent: number;
};

const BATCH_B_RE = /\/images\/spot\/batchB\/spotting(\d+)b\.(png|jpe?g|webp)$/i;

/** Highest spotting{N}b index among known paths (catalog + optional extras). */
export function maxBatchBSpottingIndex(paths: readonly string[]): number {
  let max = 0;
  for (const p of paths) {
    const m = p.match(BATCH_B_RE);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

export function nextBatchBSpottingPath(
  extraPaths: readonly string[] = [],
): string {
  const known = [
    ...SPOT_IMAGES,
    ...Object.keys(SPOT_PERCHES),
    ...extraPaths,
  ];
  const n = maxBatchBSpottingIndex(known) + 1;
  return `/images/spot/batchB/spotting${n}b.png`;
}

export function renumberDraftPerches(
  perches: SceneDraftPerch[],
): SceneDraftPerch[] {
  return perches.map((p, i) => ({ ...p, id: `p${i}` }));
}

export function draftPerchesFromCatalog(imageSrc: string): SceneDraftPerch[] {
  const raw = SPOT_PERCHES[imageSrc] ?? [];
  return raw.map((p, i) => ({
    id: p.id ?? `p${i}`,
    x: p.x,
    y: p.y,
    species: p.species === "orrhane" ? "orrhane" : "tiur",
    distanceMinM: p.distanceMinM,
    distanceMaxM: p.distanceMaxM,
    eyesVisible: p.eyesVisible !== false,
    scalePercent: p.scalePercent ?? 100,
  }));
}

export function toSpotPerches(perches: SceneDraftPerch[]): SpotPerch[] {
  return renumberDraftPerches(perches).map((p) => ({
    id: p.id,
    x: Math.round(p.x * 10) / 10,
    y: Math.round(p.y * 10) / 10,
    species: p.species,
    distanceMinM: Math.round(p.distanceMinM),
    distanceMaxM: Math.round(p.distanceMaxM),
    eyesVisible: p.eyesVisible,
    scalePercent: Math.round(p.scalePercent),
  }));
}

/** TS fragment for one catalog entry (no trailing comma on object — caller adds). */
export function formatPerchCatalogEntry(
  imageSrc: string,
  perches: SpotPerch[],
): string {
  const lines = perches.map((p, i) => {
    const comma = i < perches.length - 1 ? "," : "";
    const eyes =
      p.eyesVisible === false
        ? `\n      eyesVisible: false,`
        : p.eyesVisible === true
          ? `\n      eyesVisible: true,`
          : "";
    const scale =
      p.scalePercent != null && p.scalePercent !== 100
        ? `\n      scalePercent: ${Math.round(p.scalePercent)},`
        : "";
    return `    {
      x: ${p.x},
      y: ${p.y},
      species: "${p.species}",
      distanceMinM: ${p.distanceMinM},
      distanceMaxM: ${p.distanceMaxM},${eyes}${scale}
    }${comma}`;
  });
  return `  "${imageSrc}": [\n${lines.join("\n")}\n  ]`;
}
