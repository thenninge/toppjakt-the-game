/**
 * Helpers for Admin Scene creation — next batch-B path, perch renumber, serialize.
 */

import type { BirdSpecies } from "@/lib/hunt/birds";
import type { SpotPerch } from "@/lib/hunt/spotPerches";
import { SPOT_IMAGES } from "@/lib/hunt/images";
import { SPOT_PERCHES } from "@/lib/hunt/spotPerches";
import { resolveEyesVisible } from "@/lib/hunt/spotBands";

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
    eyesVisible: resolveEyesVisible(
      p.eyesVisible,
      p.distanceMinM,
      p.distanceMaxM,
    ),
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

/** Stable repo path for a cloud scene (idempotent re-sync). */
export function cloudSyncedImageSrc(cloudId: string): string {
  const safe = cloudId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) throw new Error("Invalid cloud scene id");
  return `/images/spot/batchB/cloud/${safe}.jpg`;
}

/**
 * Replace or insert a `"path": [ ... ]` entry inside SPOT_PERCHES = { ... };
 */
export function upsertPerchCatalog(
  file: string,
  imageSrc: string,
  entry: string,
): string {
  const key = `"${imageSrc}"`;
  const keyIdx = file.indexOf(key);
  if (keyIdx >= 0) {
    const afterKey = file.indexOf("[", keyIdx);
    if (afterKey < 0) throw new Error("Malformed SPOT_PERCHES entry");
    let depth = 0;
    let end = -1;
    for (let i = afterKey; i < file.length; i++) {
      const ch = file[i];
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) throw new Error("Unclosed perch array");
    const start = file.lastIndexOf("\n", keyIdx);
    const sliceStart = start >= 0 ? start + 1 : keyIdx;
    let sliceEnd = end + 1;
    if (file[sliceEnd] === ",") sliceEnd++;
    const before = file.slice(0, sliceStart);
    const after = file.slice(sliceEnd);
    const needsComma =
      after.trimStart().startsWith('"') || after.trimStart().startsWith("/");
    return `${before}${entry}${needsComma || after.includes('"') ? "," : ""}${after}`;
  }

  const marker = "\n};\n\nexport function perchesForSpotImage";
  const at = file.indexOf(marker);
  if (at < 0) {
    throw new Error("Could not find SPOT_PERCHES end marker");
  }
  const before = file.slice(0, at).replace(/\s+$/, "");
  const needsComma = !before.endsWith(",") && !before.endsWith("{");
  return `${before}${needsComma ? "," : ""}\n${entry}${marker}${file.slice(at + marker.length)}`;
}

/** Ensure imageSrc is listed in SPOT_IMAGES array. */
export function ensureSpotImageListed(file: string, imageSrc: string): string {
  if (file.includes(`"${imageSrc}"`)) return file;
  const marker = "\n];\n\n/**\n * Hand-composited spot photo";
  const at = file.indexOf(marker);
  if (at < 0) {
    const alt = file.indexOf("\n];\n\nexport const SPOT_TEST_IMAGE");
    if (alt < 0) throw new Error("Could not find SPOT_IMAGES end");
    const before = file.slice(0, alt).replace(/\s+$/, "");
    const needsComma = !before.endsWith(",");
    return `${before}${needsComma ? "," : ""}\n  "${imageSrc}",${file.slice(alt)}`;
  }
  const before = file.slice(0, at).replace(/\s+$/, "");
  const needsComma = !before.endsWith(",");
  return `${before}${needsComma ? "," : ""}\n  "${imageSrc}",${marker}${file.slice(at + marker.length)}`;
}
