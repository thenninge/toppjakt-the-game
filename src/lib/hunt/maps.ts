/**
 * Hunting map image assets under /public/maps.
 * Placement seats live in mapPlacements.ts (from maps_placement overlays).
 */

export type HuntMapId =
  | "ostlandet1"
  | "ostlandet2"
  | "midtnorge1"
  | "inatur1"
  | "inatur2"
  | "svenskegrensa";

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
  /** Hunt maps — all cutouts are playable (same 7×6 grid for now). */
  playable: boolean;
};

export const HUNT_MAPS: Record<HuntMapId, HuntMapAsset> = {
  ostlandet1: {
    id: "ostlandet1",
    src: "/maps/ostlandet1.png",
    label: "Gammel hogst",
    regionHint: "Østlandet",
    cols: 7,
    rows: 6,
    /** Cyan marker in startingpoint/gammelhogst_start.png */
    start: { row: 2, col: 1 }, // C2
    playable: true,
  },
  ostlandet2: {
    id: "ostlandet2",
    src: "/maps/ostlandet2.png",
    label: "Bjørkeskog",
    regionHint: "Østlandet",
    cols: 7,
    rows: 6,
    /** Cyan marker in startingpoint/bjørkeskog_øst_start.png */
    start: { row: 3, col: 6 }, // D7
    playable: true,
  },
  midtnorge1: {
    id: "midtnorge1",
    src: "/maps/midtnorge1.png",
    label: "Myrkanter",
    regionHint: "Trøndelag",
    cols: 7,
    rows: 6,
    /** No startingpoint overlay yet — road parking bottom-right. */
    start: { row: 0, col: 6 }, // A7
    playable: true,
  },
  inatur1: {
    id: "inatur1",
    src: "/maps/inatur1.png",
    label: "Hogstflate nord",
    regionHint: "Østlandet",
    cols: 7,
    rows: 6,
    /** Cyan marker in startingpoint/hogstflate_nord_start.png */
    start: { row: 1, col: 4 }, // B5
    playable: true,
  },
  inatur2: {
    id: "inatur2",
    src: "/maps/inatur2.png",
    label: "Granskog sør",
    regionHint: "Østlandet",
    cols: 7,
    rows: 6,
    /** Cyan marker in startingpoint/granskog_sør_start.png */
    start: { row: 2, col: 2 }, // C3
    playable: true,
  },
  svenskegrensa: {
    id: "svenskegrensa",
    src: "/maps/svenskegrensa.png",
    label: "Svenskegrensa",
    regionHint: "Østlandet",
    cols: 7,
    rows: 6,
    /** Cyan marker in startingpoint/svenskegrensa_start.png */
    start: { row: 3, col: 2 }, // D3
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
