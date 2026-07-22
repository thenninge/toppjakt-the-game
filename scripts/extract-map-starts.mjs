/**
 * Detect cyan parking markers in /public/maps/startingpoint/*
 * and print hunt-grid cells (for updating maps.ts start).
 *
 *   node scripts/extract-map-starts.mjs
 */
import sharp from "sharp";

const COLS = 7;
const ROWS = 6;

const FILES = {
  ostlandet1: "public/maps/startingpoint/gammelhogst_start.png",
  ostlandet2: "public/maps/startingpoint/bjørkeskog_øst_start.png",
  inatur1: "public/maps/startingpoint/hogstflate_nord_start.png",
  inatur2: "public/maps/startingpoint/granskog_sør_start.png",
  svenskegrensa: "public/maps/startingpoint/svenskegrensa_start.png",
};

function isCyan(r, g, b) {
  return g >= 200 && b >= 200 && r < 80;
}

async function detect(file) {
  const { data, info } = await sharp(file)
    .raw()
    .ensureAlpha()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;

  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 180) continue;
      if (isCyan(data[i], data[i + 1], data[i + 2])) {
        sx += x;
        sy += y;
        n++;
      }
    }
  }
  if (n < 50) throw new Error(`No cyan marker in ${file}`);
  const cx = sx / n;
  const cy = sy / n;

  const rowScore = new Float64Array(h);
  for (let y = 0; y < h; y++) {
    let sumG = 0;
    let sumG2 = 0;
    let dark = 0;
    let c = 0;
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      sumG += g;
      sumG2 += g * g;
      c++;
      if (r < 45 && g < 40 && b < 35) dark++;
    }
    const mean = sumG / c;
    const variance = sumG2 / c - mean * mean;
    rowScore[y] = variance * (1 - dark / c) * (mean > 25 ? 1 : 0.2);
  }

  const median = [...rowScore].sort((a, b) => a - b)[Math.floor(h * 0.5)];
  const thr = Math.max(median * 1.2, 50);
  let bestA = 0;
  let bestB = 0;
  let a = -1;
  for (let y = 0; y <= h; y++) {
    const ok = y < h && rowScore[y] >= thr;
    if (ok && a < 0) a = y;
    if (!ok && a >= 0) {
      if (y - a > bestB - bestA) {
        bestA = a;
        bestB = y - 1;
      }
      a = -1;
    }
  }
  let y0 = bestA;
  let y1 = bestB;
  if (y1 - y0 < h * 0.4) {
    y0 = Math.floor(h * 0.12);
    y1 = Math.floor(h * 0.98);
  }

  const colScore = new Float64Array(w);
  for (let x = 0; x < w; x++) {
    let sumG = 0;
    let sumG2 = 0;
    let dark = 0;
    let c = 0;
    for (let y = y0; y <= y1; y += 2) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      sumG += g;
      sumG2 += g * g;
      c++;
      if (r < 45 && g < 40 && b < 35) dark++;
    }
    const mean = sumG / c;
    const variance = sumG2 / c - mean * mean;
    colScore[x] = variance * (1 - dark / c);
  }
  const cmed = [...colScore].sort((a, b) => a - b)[Math.floor(w * 0.5)];
  const cthr = Math.max(cmed * 0.8, 30);
  let x0 = 0;
  let x1 = w - 1;
  while (x0 < w && colScore[x0] < cthr) x0++;
  while (x1 > x0 && colScore[x1] < cthr) x1--;

  const mw = x1 - x0 + 1;
  const mh = y1 - y0 + 1;
  const relX = (cx - x0) / mw;
  const relY = (cy - y0) / mh;
  const col = Math.min(COLS - 1, Math.max(0, Math.floor(relX * COLS)));
  const rowFromTop = Math.min(ROWS - 1, Math.max(0, Math.floor(relY * ROWS)));
  const row = ROWS - 1 - rowFromTop;
  const label = `${String.fromCharCode(65 + row)}${col + 1}`;

  return { label, row, col, relX: +(100 * relX).toFixed(1), relY: +(100 * relY).toFixed(1) };
}

for (const [id, file] of Object.entries(FILES)) {
  const r = await detect(file);
  console.log(
    `${id}: start { row: ${r.row}, col: ${r.col} } // ${r.label} (${r.relX}%, ${r.relY}%)`,
  );
}
