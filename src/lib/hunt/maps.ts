/**
 * Hunting map image assets under /public/maps.
 * Three test cutouts for now — extend later when needed.
 */

export type HuntMapId = "ostlandet1" | "ostlandet2" | "midtnorge1";

/** Grid cell: row letter A.. from bottom, column number 1.. from left. */
export type HuntGridCell = {
  /** 0-based row from bottom (0 = A). */
  row: number;
  /** 0-based column from left (0 = 1). */
  col: number;
};

export type HuntMapAsset = {
  id: HuntMapId;
  /** Public URL path (ASCII filenames). */
  src: string;
  label: string;
  regionHint: string;
  /** Horizontal cells: 1 .. cols (left → right from bottom-left). */
  cols: number;
  /** Vertical cells: A .. letter (bottom → top from bottom-left). */
  rows: number;
  /** Hunter spawn cell (parking / trailhead). */
  start: HuntGridCell;
  /** Hunt maps — all three cutouts are playable (same grid for now). */
  playable: boolean;
};

export const HUNT_MAPS: Record<HuntMapId, HuntMapAsset> = {
  ostlandet1: {
    id: "ostlandet1",
    src: "/maps/ostlandet1.png",
    label: "Østlandet 1",
    regionHint: "Østlandet",
    cols: 7,
    rows: 6,
    /** Same trailhead layout as Trøndelag until dedicated maps exist. */
    start: { row: 0, col: 6 },
    playable: true,
  },
  ostlandet2: {
    id: "ostlandet2",
    src: "/maps/ostlandet2.png",
    label: "Østlandet 2",
    regionHint: "Østlandet",
    cols: 7,
    rows: 6,
    start: { row: 0, col: 6 },
    playable: true,
  },
  midtnorge1: {
    id: "midtnorge1",
    src: "/maps/midtnorge1.png",
    label: "Trøndelag",
    regionHint: "Trøndelag",
    cols: 7,
    rows: 6,
    /** Bottom-right: road + parking into the terrain. */
    start: { row: 0, col: 6 },
    playable: true,
  },
};

export function getHuntMap(id: HuntMapId): HuntMapAsset {
  return HUNT_MAPS[id];
}

/** Row 0 → "A", row 1 → "B", … */
export function rowLetter(rowFromBottom: number): string {
  return String.fromCharCode(65 + rowFromBottom);
}

/** Cell label e.g. A7 (bottom-right on a 7-col map). */
export function cellLabel(cell: HuntGridCell): string {
  return `${rowLetter(cell.row)}${cell.col + 1}`;
}

export function clampCell(
  cell: HuntGridCell,
  map: HuntMapAsset,
): HuntGridCell {
  return {
    row: Math.max(0, Math.min(map.rows - 1, cell.row)),
    col: Math.max(0, Math.min(map.cols - 1, cell.col)),
  };
}
