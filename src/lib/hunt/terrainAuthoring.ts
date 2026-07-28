/**
 * Repo authoring helpers for Admin → Jaktfelt cloud sync
 * (public/maps/cloud/{id}.png + cloudHuntMapsCatalog.ts).
 */

import type { HuntGridCell, HuntMapAsset } from "@/lib/hunt/maps";
import type { MapBirdSeat } from "@/lib/hunt/mapPlacements";

/** Stable public path for a synced cloud terrain map. */
export function cloudSyncedMapSrc(cloudId: string, ext: "png" | "jpg" = "png"): string {
  const safe = cloudId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40);
  return `/maps/cloud/${safe || "terrain"}.${ext}`;
}

/** Catalog id for a cloud terrain (fits alongside core HuntMapId usage as string). */
export function cloudTerrainCatalogId(cloudId: string): string {
  const safe = cloudId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16).toLowerCase();
  return `cloud_${safe || "terrain"}`;
}

export type CloudCatalogEntry = {
  id: string;
  label: string;
  regionHint: string;
  src: string;
  cols: number;
  rows: number;
  start: HuntGridCell;
  awareMapMaxM: number | null;
  seats: MapBirdSeat[];
};

export function formatCloudHuntMapsCatalog(entries: CloudCatalogEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  const mapBlocks = sorted
    .map((e) => {
      const aware =
        e.awareMapMaxM != null && Number.isFinite(e.awareMapMaxM)
          ? `\n    awareMapMaxM: ${Math.round(e.awareMapMaxM)},`
          : "";
      return `  "${e.id}": {
    id: "${e.id}" as HuntMapId,
    src: ${JSON.stringify(e.src)},
    label: ${JSON.stringify(e.label)},
    regionHint: ${JSON.stringify(e.regionHint || "Cloud")},
    cols: ${e.cols},
    rows: ${e.rows},
    start: { row: ${e.start.row}, col: ${e.start.col} },
    playable: true,${aware}
  },`;
    })
    .join("\n");

  const seatBlocks = sorted
    .filter((e) => e.seats.length > 0)
    .map((e) => {
      const lines = e.seats
        .map(
          (s) =>
            `    { species: "${s.species}", xPct: ${s.xPct}, yPct: ${s.yPct}, row: ${s.row}, col: ${s.col} },`,
        )
        .join("\n");
      return `  "${e.id}": [\n${lines}\n  ],`;
    })
    .join("\n");

  return `/**
 * Auto-generated cloud hunt terrains (Admin → Jaktfelt → Oppdater fra sky).
 * Do not hand-edit — re-sync overwrites this file.
 *
 * Generated ${new Date().toISOString()}
 */

import type { HuntMapAsset, HuntMapId } from "@/lib/hunt/maps";
import type { MapBirdSeat } from "@/lib/hunt/mapPlacements";

export const CLOUD_HUNT_MAPS: Record<string, HuntMapAsset> = {
${mapBlocks}
};

export const CLOUD_MAP_BIRD_SEATS: Record<string, readonly MapBirdSeat[]> = {
${seatBlocks}
};
`;
}

export function toHuntMapAsset(entry: CloudCatalogEntry): HuntMapAsset {
  return {
    id: entry.id as HuntMapAsset["id"],
    src: entry.src,
    label: entry.label,
    regionHint: entry.regionHint || "Cloud",
    cols: entry.cols,
    rows: entry.rows,
    start: { ...entry.start },
    playable: true,
    ...(entry.awareMapMaxM != null
      ? { awareMapMaxM: entry.awareMapMaxM }
      : {}),
  };
}
