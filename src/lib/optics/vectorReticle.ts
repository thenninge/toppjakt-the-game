/**
 * Admin custom-scope vector reticle — coordinates in mils from optical centre.
 * Y+ is down (CSS / SVG). Illumination is per-element.
 * Angles for broken circles: 0° = +X (right), increasing toward +Y (down).
 */

/** 1 MOA ≈ 0.294 mrad (29.4 mm @ 100 m / 100). */
export const MOA_TO_MRAD = 0.294;

export type VecStroke = "thin" | "thick";
export type VecFill = "none" | "solid";
/** etch = always black; illum = only when drum on; both = etch + lit overlay */
export type VecIllum = "etch" | "illum" | "both";

export type VecElementBase = {
  id: string;
  illum: VecIllum;
};

export type VecLine = VecElementBase & {
  kind: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: VecStroke;
};

export type VecHash = VecElementBase & {
  kind: "hash";
  /** Along crosshair: horizontal hashes sit on the vertical wire (x=0). */
  axis: "h" | "v";
  /** Position along the wire in mils (v: y, h: x). */
  at: number;
  /** Half-length of the tick in mils (full span when side=both). */
  len: number;
  /**
   * both = ±len; neg/pos = only toward −/+ along the perpendicular.
   * P5FL windage hashes are upward (neg Y in SVG).
   */
  side?: "both" | "neg" | "pos";
  stroke: VecStroke;
};

export type VecArrow = VecElementBase & {
  kind: "arrow";
  tipX: number;
  tipY: number;
  /** Direction from tip toward base (shaft length ≈ this vector length). */
  baseX: number;
  baseY: number;
  fill: VecFill;
  stroke: VecStroke;
};

export type VecNumber = VecElementBase & {
  kind: "number";
  x: number;
  y: number;
  text: string;
  /** Font size in mils (approx height). */
  sizeMils: number;
  illum: VecIllum;
};

export type VecRect = VecElementBase & {
  kind: "rect";
  /** Centre of rectangle. */
  x: number;
  y: number;
  w: number;
  h: number;
  fill: VecFill;
  stroke: VecStroke;
};

/** Filled centre / holdover dot. */
export type VecDot = VecElementBase & {
  kind: "dot";
  x: number;
  y: number;
  /** Radius in mils. */
  rMils: number;
};

/** Stroke circle (not filled). Radius in mils, or via diameterMoa. */
export type VecCircle = VecElementBase & {
  kind: "circle";
  x: number;
  y: number;
  /** Radius in mils when {@link diameterMoa} is unset. */
  rMils: number;
  /**
   * If set, radius = (diameterMoa / 2) × {@link MOA_TO_MRAD}.
   * Lets a mil scope carry a true 0.5 MOA centre ring.
   */
  diameterMoa?: number;
  stroke: VecStroke;
};

/**
 * Four arcs with gaps on the cardinal axes (crosshair clearance).
 * Arc spans: gap→90−gap, 90+gap→180−gap, 180+gap→270−gap, 270+gap→360−gap.
 */
export type VecBrokenCircle = VecElementBase & {
  kind: "brokenCircle";
  x: number;
  y: number;
  /** Radius in mils (e.g. 0.2 ≈ 2 klikk @ 0.1 mil). */
  rMils: number;
  /** Gap half-angle around each axis, degrees (0–45). */
  gapDeg: number;
  stroke: VecStroke;
};

export type VecElement =
  | VecLine
  | VecHash
  | VecArrow
  | VecNumber
  | VecRect
  | VecDot
  | VecCircle
  | VecBrokenCircle;

export type VectorReticleDef = {
  id: string;
  label: string;
  unit: "MRAD" | "MOA";
  elements: VecElement[];
};

export type CustomScopeDraft = {
  id: string;
  brand: string;
  name: string;
  minZoom: number;
  maxZoom: number;
  /**
   * Half-FOV at max zoom (lite / smalt synsfelt) in mrad centre→edge.
   * ZCO ref ≈ 7.2 @ 27×; P5FL 6-36 ≈ 6.5 @ 36×.
   */
  fovHalfMradAtMax: number;
  /** Half-FOV at min zoom (stort / bredt synsfelt) in mrad. */
  fovHalfMradAtMin: number;
  clickUnit: "MRAD" | "MOA";
  illuminationColors: ("red" | "green")[];
  /** Catalog / RETICLES key — PNG glass (e.g. {@code p5fl}). */
  reticleId: string;
  /** Optional vector overlay draft (experimental editor). */
  reticle: VectorReticleDef;
};

export const VEC_STROKE_THIN_MILS = 0.04; // ≈ P5FL L
export const VEC_STROKE_THICK_MILS = 0.12;

export function vecStrokeWidth(stroke: VecStroke): number {
  return stroke === "thick" ? VEC_STROKE_THICK_MILS : VEC_STROKE_THIN_MILS;
}

export function newVecId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function clampBrokenGapDeg(gapDeg: number): number {
  if (!Number.isFinite(gapDeg)) return 20;
  return Math.min(45, Math.max(0, gapDeg));
}

/** Effective circle radius in mils (honours optional MOA diameter). */
export function circleRadiusMils(
  el: Pick<VecCircle, "rMils" | "diameterMoa">,
): number {
  if (
    el.diameterMoa != null &&
    Number.isFinite(el.diameterMoa) &&
    el.diameterMoa > 0
  ) {
    return (el.diameterMoa / 2) * MOA_TO_MRAD;
  }
  return Math.max(0.01, el.rMils);
}

/**
 * SVG path for a broken circle: four arcs with gaps on the axes.
 * Angle 0° = +X, increasing toward +Y (SVG).
 */
export function brokenCirclePath(
  cx: number,
  cy: number,
  r: number,
  gapDeg: number,
): string {
  const g = clampBrokenGapDeg(gapDeg);
  if (!(r > 0)) return "";
  const spans: [number, number][] = [
    [g, 90 - g],
    [90 + g, 180 - g],
    [180 + g, 270 - g],
    [270 + g, 360 - g],
  ];
  const parts: string[] = [];
  for (const [a0, a1] of spans) {
    if (a1 - a0 < 0.05) continue;
    const rad0 = (a0 * Math.PI) / 180;
    const rad1 = (a1 * Math.PI) / 180;
    const x0 = cx + r * Math.cos(rad0);
    const y0 = cy + r * Math.sin(rad0);
    const x1 = cx + r * Math.cos(rad1);
    const y1 = cy + r * Math.sin(rad1);
    const large = a1 - a0 > 180 ? 1 : 0;
    // Increasing angle with Y+ down = clockwise on screen → sweep 1.
    parts.push(`M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`);
  }
  return parts.join(" ");
}

/**
 * Schmidt & Bender P5FL coverages (mrad) from
 * Schmidt-Bender-Datasheet-P5FL-FFP-6-36x56-PMII.
 *
 * A outer extent · B illum / end-cap · E thick-bar height · F 1 mil ·
 * G 0.5 mil · H 0.2 mil · K centre-dot Ø · L fine-line thickness.
 */
export const P5FL = {
  A: 20,
  B: 5,
  C: 3.3,
  D: 2,
  E: 1.3,
  F: 1,
  G: 0.5,
  H: 0.2,
  K: 0.07,
  L: 0.04,
} as const;

/** 6-36x56 PM II FOV (m/100 m → half-FOV mrad centre→edge). */
export const P5FL_SCOPE = {
  minZoom: 6,
  maxZoom: 36,
  /** 7.3 m @ 100 m → 73 mrad full → ±36.5. */
  fovHalfMradAtMin: 36.5,
  /** 1.3 m @ 100 m → 13 mrad full → ±6.5. */
  fovHalfMradAtMax: 6.5,
} as const;

function p5flIllum(atAbs: number): VecIllum {
  return atAbs <= P5FL.B + 1e-6 ? "both" : "etch";
}

function p5flHashLen(atAbs: number): number {
  const step = Math.round(atAbs / P5FL.H) * P5FL.H;
  const nearInt = Math.abs(step - Math.round(step)) < 1e-6;
  const nearHalf =
    !nearInt && Math.abs(step * 2 - Math.round(step * 2)) < 1e-6;
  // len = extent from wire (one-sided windage uses full; elevation both uses as half).
  if (nearInt) return P5FL.H * 1.1; // ~0.22
  if (nearHalf) return P5FL.H * 0.7;
  return P5FL.H * 0.45;
}

/**
 * Build a vector approximation of S&B P5FL (FFP mil tree).
 * Free-floating centre dot, 0.2/0.5/1 mil hashes, skeleton outer posts.
 */
export function buildP5flReticleElements(): VecElement[] {
  const els: VecElement[] = [];
  const open = Math.max(P5FL.K * 0.85, P5FL.H * 0.55); // gap around floating dot
  const fineEnd = 10; // thin hashed section before thick posts
  const postEnd = P5FL.A; // 20
  const armEnd = 30; // low-mag extent (page 3)

  // Centre floating illuminated dot (K = diameter).
  els.push({
    id: newVecId("dot"),
    kind: "dot",
    x: 0,
    y: 0,
    rMils: P5FL.K / 2,
    illum: "both",
  });

  const wire = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    illum: VecIllum,
  ) => {
    els.push({
      id: newVecId("line"),
      kind: "line",
      x1,
      y1,
      x2,
      y2,
      stroke: "thin",
      illum,
    });
  };

  // Horizontal wires (gap at centre). Illum within ±B.
  wire(open, 0, Math.min(fineEnd, P5FL.B), 0, "both");
  if (fineEnd > P5FL.B) wire(P5FL.B, 0, fineEnd, 0, "etch");
  wire(-open, 0, -Math.min(fineEnd, P5FL.B), 0, "both");
  if (fineEnd > P5FL.B) wire(-P5FL.B, 0, -fineEnd, 0, "etch");

  // Vertical wires.
  wire(0, open, 0, Math.min(fineEnd, P5FL.B), "both");
  if (fineEnd > P5FL.B) wire(0, P5FL.B, 0, fineEnd, "etch");
  wire(0, -open, 0, -Math.min(fineEnd, P5FL.B), "both");
  if (fineEnd > P5FL.B) wire(0, -P5FL.B, 0, -fineEnd, "etch");

  // Thin continuation through / beyond posts (skeleton posts sit around these).
  wire(fineEnd, 0, armEnd, 0, "etch");
  wire(-fineEnd, 0, -armEnd, 0, "etch");
  wire(0, fineEnd, 0, armEnd, "etch"); // bottom
  wire(0, -fineEnd, 0, -armEnd, "etch"); // top stays thin to edge

  // Hashes every H = 0.2 mil from open…fineEnd (and light hashes to postEnd).
  const hashMax = postEnd;
  for (let i = 1; i * P5FL.H <= hashMax + 1e-9; i++) {
    const at = Math.round(i * P5FL.H * 1000) / 1000;
    if (at < open - 1e-9) continue;
    const len = p5flHashLen(at);
    const illum = p5flIllum(at);
    // Vertical wire: bilateral hashes (axis "v" → tick along x).
    for (const sign of [1, -1] as const) {
      els.push({
        id: newVecId("hash"),
        kind: "hash",
        axis: "v",
        at: sign * at,
        len,
        side: "both",
        stroke: "thin",
        illum,
      });
    }
    // Horizontal wire: upward hashes only (neg Y = up on glass).
    for (const sign of [1, -1] as const) {
      els.push({
        id: newVecId("hash"),
        kind: "hash",
        axis: "h",
        at: sign * at,
        len,
        side: "neg",
        stroke: "thin",
        illum,
      });
    }
  }

  // Numbers at 5 / 10 / 20 / 30.
  const num = (
    x: number,
    y: number,
    text: string,
    size: number,
    illum: VecIllum,
  ) => {
    els.push({
      id: newVecId("num"),
      kind: "number",
      x,
      y,
      text,
      sizeMils: size,
      illum,
    });
  };
  for (const n of [5, 10, 20, 30]) {
    const illum = p5flIllum(n);
    const size = n >= 20 ? 0.7 : 0.55;
    // Horizontal: below wire (+Y).
    num(n, 0.55, String(n), size, illum);
    num(-n, 0.55, String(n), size, illum);
    // Vertical: right of wire (+X). Top only to 10; bottom to 30.
    if (n <= 10) num(0.55, -n, String(n), size, illum);
    num(0.55, n, String(n), size, illum);
  }

  // Skeleton outer posts (unfilled rects) — horizontal L/R 10→20, bottom 10→20.
  // Height/width E; optional end-cap height B at ±20.
  const postMid = (fineEnd + postEnd) / 2;
  const postW = postEnd - fineEnd;
  for (const sign of [1, -1] as const) {
    els.push({
      id: newVecId("rect"),
      kind: "rect",
      x: sign * postMid,
      y: 0,
      w: postW,
      h: P5FL.E,
      fill: "none",
      stroke: "thin",
      illum: "etch",
    });
    // End cap at ±20 (height B).
    els.push({
      id: newVecId("rect"),
      kind: "rect",
      x: sign * postEnd,
      y: 0,
      w: P5FL.H,
      h: P5FL.B,
      fill: "none",
      stroke: "thin",
      illum: "etch",
    });
  }
  // Bottom post 10→20 + cap at 20; extend skeleton 20→30 (page 3).
  els.push({
    id: newVecId("rect"),
    kind: "rect",
    x: 0,
    y: postMid,
    w: P5FL.E,
    h: postW,
    fill: "none",
    stroke: "thin",
    illum: "etch",
  });
  els.push({
    id: newVecId("rect"),
    kind: "rect",
    x: 0,
    y: postEnd,
    w: P5FL.B,
    h: P5FL.H,
    fill: "none",
    stroke: "thin",
    illum: "etch",
  });
  const outerMid = (postEnd + armEnd) / 2;
  const outerH = armEnd - postEnd;
  els.push({
    id: newVecId("rect"),
    kind: "rect",
    x: 0,
    y: outerMid,
    w: P5FL.E,
    h: outerH,
    fill: "none",
    stroke: "thin",
    illum: "etch",
  });
  // Horizontal outer stubs 20→30.
  for (const sign of [1, -1] as const) {
    els.push({
      id: newVecId("rect"),
      kind: "rect",
      x: sign * outerMid,
      y: 0,
      w: outerH,
      h: P5FL.E,
      fill: "none",
      stroke: "thin",
      illum: "etch",
    });
  }

  return els;
}

/** Minimal blank vector tree — PNG P5FL is the real glass asset. */
export function defaultCentreKitElements(): VecElement[] {
  return [];
}

/** Empty vector overlay (experimental). Real reticle = {@code p5fl} PNGs. */
export function defaultVectorReticle(id = "custom-overlay"): VectorReticleDef {
  return {
    id,
    label: "Vector overlay",
    unit: "MRAD",
    elements: [],
  };
}

export function defaultCustomScopeDraft(): CustomScopeDraft {
  return {
    id: `custom-scope-p5fl`,
    brand: "Schmidt & Bender",
    name: "6-36x56 PM II P5FL",
    minZoom: P5FL_SCOPE.minZoom,
    maxZoom: P5FL_SCOPE.maxZoom,
    fovHalfMradAtMax: P5FL_SCOPE.fovHalfMradAtMax,
    fovHalfMradAtMin: P5FL_SCOPE.fovHalfMradAtMin,
    clickUnit: "MRAD",
    illuminationColors: ["red"],
    reticleId: "p5fl",
    reticle: defaultVectorReticle(),
  };
}

const STORAGE_KEY = "toppjakt-admin-custom-scope-v3-p5fl-png";

export function loadCustomScopeDraft(): CustomScopeDraft {
  if (typeof window === "undefined") return defaultCustomScopeDraft();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultCustomScopeDraft();
    const parsed = JSON.parse(raw) as CustomScopeDraft;
    if (!parsed?.reticle?.elements) return defaultCustomScopeDraft();
    return {
      ...defaultCustomScopeDraft(),
      ...parsed,
      reticleId: parsed.reticleId || "p5fl",
      reticle: parsed.reticle ?? defaultVectorReticle(),
    };
  } catch {
    return defaultCustomScopeDraft();
  }
}

export function saveCustomScopeDraft(draft: CustomScopeDraft): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* ignore */
  }
}
