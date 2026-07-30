import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  normalizeReticleHiRes,
  normalizeReticleIllumination,
  normalizeReticleImageCrop,
  RETICLES,
  type ReticleHiResLayer,
  type ReticleIllumination,
  type ReticleIlluminationRegion,
  type ReticleImageCrop,
} from "@/lib/range/reticles";
import {
  escapeRegExp,
  findReticleEntry,
  removeDuplicateReticleEntries,
} from "@/lib/range/reticleFilePatch";

type Body = {
  reticleId?: unknown;
  imageRotationDeg?: unknown;
  opticalCenterX?: unknown;
  opticalCenterY?: unknown;
  centerTo1MilPx?: unknown;
  /** Partial illum; `null` clears catalog illumination (whole reticle). */
  illumination?: unknown;
  /** Circular crop; `null` clears. */
  imageCrop?: unknown;
  /** Hi-res FFP overlay; `null` clears. */
  hiRes?: unknown;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function formatSignedClicks(n: number): string {
  const t = Math.round(n * 100) / 100;
  return `${t >= 0 ? "+" : "−"}${Math.abs(t).toFixed(2)}`;
}

/**
 * Replace or insert a numeric field inside a `{ ... }` object body string.
 */
function upsertNumericField(
  block: string,
  key: string,
  value: string,
): string {
  const fieldRe = new RegExp(`(${key}:\\s*)(-?\\d+(?:\\.\\d+)?)`);
  if (fieldRe.test(block)) {
    return block.replace(fieldRe, `$1${value}`);
  }
  const trimmed = block.replace(/\s*$/, "");
  const comma = /,\s*$/.test(trimmed) ? "" : ",";
  return `${trimmed}${comma}\n    ${key}: ${value},`;
}

function parseIlluminationRegion(
  raw: unknown,
): ReticleIlluminationRegion | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  if (r.shape === "circleMils" && isFiniteNumber(r.rMils) && r.rMils > 0) {
    return {
      shape: "circleMils",
      rMils: Math.round(r.rMils * 1000) / 1000,
    };
  }
  if (r.shape === "circle" && isFiniteNumber(r.r) && r.r > 0) {
    return {
      shape: "circle",
      r: Math.round(r.r * 1000) / 1000,
      ...(isFiniteNumber(r.cx) ? { cx: Math.round(r.cx * 1000) / 1000 } : null),
      ...(isFiniteNumber(r.cy) ? { cy: Math.round(r.cy * 1000) / 1000 } : null),
    };
  }
  if (
    r.shape === "rect" &&
    isFiniteNumber(r.x) &&
    isFiniteNumber(r.y) &&
    isFiniteNumber(r.w) &&
    isFiniteNumber(r.h) &&
    r.w > 0 &&
    r.h > 0
  ) {
    return {
      shape: "rect",
      x: Math.round(r.x * 1000) / 1000,
      y: Math.round(r.y * 1000) / 1000,
      w: Math.round(r.w * 1000) / 1000,
      h: Math.round(r.h * 1000) / 1000,
    };
  }
  return undefined;
}

function parseIlluminationBody(
  raw: unknown,
): ReticleIllumination | null | undefined {
  /* undefined = leave catalog alone; null = clear to whole. */
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const maskSrc =
    typeof o.maskSrc === "string" && o.maskSrc.trim()
      ? o.maskSrc.trim()
      : undefined;
  const regionsRaw = Array.isArray(o.regions) ? o.regions : null;
  const regions = regionsRaw
    ? regionsRaw
        .map(parseIlluminationRegion)
        .filter((r): r is ReticleIlluminationRegion => !!r)
    : undefined;
  const region =
    regions && regions.length > 0
      ? undefined
      : parseIlluminationRegion(o.region);
  return (
    normalizeReticleIllumination({
      maskSrc,
      region,
      regions:
        regions && regions.length > 0
          ? regions
          : undefined,
    }) ?? null
  );
}

function formatRegionLiteral(region: ReticleIlluminationRegion): string {
  if (region.shape === "circleMils") {
    return `{ shape: "circleMils", rMils: ${region.rMils} }`;
  }
  if (region.shape === "circle") {
    const bits = [`shape: "circle"`, `r: ${region.r}`];
    if (region.cx != null) bits.push(`cx: ${region.cx}`);
    if (region.cy != null) bits.push(`cy: ${region.cy}`);
    return `{ ${bits.join(", ")} }`;
  }
  return `{ shape: "rect", x: ${region.x}, y: ${region.y}, w: ${region.w}, h: ${region.h} }`;
}

function formatIlluminationLiteral(illum: ReticleIllumination): string {
  const lines: string[] = [];
  if (illum.maskSrc) {
    lines.push(`maskSrc: ${JSON.stringify(illum.maskSrc)}`);
  }
  if (illum.regions && illum.regions.length > 1) {
    const body = illum.regions
      .map((r) => formatRegionLiteral(r))
      .join(", ");
    lines.push(`regions: [${body}]`);
  } else if (illum.region || illum.regions?.[0]) {
    lines.push(
      `region: ${formatRegionLiteral(illum.region ?? illum.regions![0]!)}`,
    );
  }
  return `{\n      ${lines.join(",\n      ")},\n    }`;
}

function parseImageCropBody(
  raw: unknown,
): ReticleImageCrop | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (o.shape === "circleMils" && isFiniteNumber(o.rMils) && o.rMils > 0) {
    return normalizeReticleImageCrop({
      shape: "circleMils",
      rMils: o.rMils,
      ...(isFiniteNumber(o.rInnerMils) ? { rInnerMils: o.rInnerMils } : null),
    }) ?? null;
  }
  if (o.shape === "circle" && isFiniteNumber(o.r) && o.r > 0) {
    return (
      normalizeReticleImageCrop({
        shape: "circle",
        r: o.r,
        ...(isFiniteNumber(o.cx) ? { cx: o.cx } : null),
        ...(isFiniteNumber(o.cy) ? { cy: o.cy } : null),
        ...(isFiniteNumber(o.rInner) ? { rInner: o.rInner } : null),
      }) ?? null
    );
  }
  return null;
}

function parseHiResBody(
  raw: unknown,
): ReticleHiResLayer | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (typeof o.src !== "string" || !o.src.trim()) return null;
  if (
    !isFiniteNumber(o.nativeWidth) ||
    !isFiniteNumber(o.nativeHeight) ||
    !isFiniteNumber(o.centerTo1MilPx)
  ) {
    return null;
  }
  return (
    normalizeReticleHiRes({
      src: o.src,
      nativeWidth: o.nativeWidth,
      nativeHeight: o.nativeHeight,
      centerTo1MilPx: o.centerTo1MilPx,
      ...(isFiniteNumber(o.opticalCenterX)
        ? { opticalCenterX: o.opticalCenterX }
        : null),
      ...(isFiniteNumber(o.opticalCenterY)
        ? { opticalCenterY: o.opticalCenterY }
        : null),
      ...(isFiniteNumber(o.cropRMils) ? { cropRMils: o.cropRMils } : null),
      ...(isFiniteNumber(o.fadeFromZoomFrac)
        ? { fadeFromZoomFrac: o.fadeFromZoomFrac }
        : null),
      ...(isFiniteNumber(o.fadeToZoomFrac)
        ? { fadeToZoomFrac: o.fadeToZoomFrac }
        : null),
    }) ?? null
  );
}

function formatImageCropLiteral(crop: ReticleImageCrop): string {
  if (crop.shape === "circleMils") {
    const bits = [`shape: "circleMils"`, `rMils: ${crop.rMils}`];
    if (crop.rInnerMils != null) bits.push(`rInnerMils: ${crop.rInnerMils}`);
    return `{\n      ${bits.join(",\n      ")},\n    }`;
  }
  const bits = [`shape: "circle"`, `r: ${crop.r}`];
  if (crop.cx != null) bits.push(`cx: ${crop.cx}`);
  if (crop.cy != null) bits.push(`cy: ${crop.cy}`);
  if (crop.rInner != null) bits.push(`rInner: ${crop.rInner}`);
  return `{\n      ${bits.join(",\n      ")},\n    }`;
}

function formatHiResLiteral(hi: ReticleHiResLayer): string {
  const lines = [
    `src: ${JSON.stringify(hi.src)}`,
    `nativeWidth: ${hi.nativeWidth}`,
    `nativeHeight: ${hi.nativeHeight}`,
    `centerTo1MilPx: ${hi.centerTo1MilPx}`,
  ];
  if (hi.opticalCenterX != null) {
    lines.push(`opticalCenterX: ${hi.opticalCenterX}`);
  }
  if (hi.opticalCenterY != null) {
    lines.push(`opticalCenterY: ${hi.opticalCenterY}`);
  }
  if (hi.cropRMils != null) {
    lines.push(`cropRMils: ${hi.cropRMils}`);
  }
  if (hi.fadeFromZoomFrac != null) {
    lines.push(`fadeFromZoomFrac: ${hi.fadeFromZoomFrac}`);
  }
  if (hi.fadeToZoomFrac != null) {
    lines.push(`fadeToZoomFrac: ${hi.fadeToZoomFrac}`);
  }
  return `{\n      ${lines.join(",\n      ")},\n    }`;
}

/** Remove nested `key: { ... },` from a reticle entry body. */
function stripObjectField(block: string, key: string): string {
  const keyIdx = block.search(new RegExp(`\\n    ${key}:\\s*`));
  if (keyIdx < 0) return block;
  const afterKey = block.slice(keyIdx).match(new RegExp(`^\\n    ${key}:\\s*`));
  if (!afterKey) return block;
  let i = keyIdx + afterKey[0].length;
  while (i < block.length && /\s/.test(block[i]!)) i += 1;
  if (block[i] !== "{") {
    return (
      block.slice(0, keyIdx) +
      block.slice(keyIdx).replace(new RegExp(`^\\n    ${key}:\\s*[^\\n]*`), "")
    );
  }
  let depth = 0;
  let j = i;
  for (; j < block.length; j += 1) {
    const ch = block[j]!;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        j += 1;
        break;
      }
    }
  }
  while (j < block.length && /\s/.test(block[j]!)) j += 1;
  if (block[j] === ",") j += 1;
  return block.slice(0, keyIdx) + block.slice(j);
}

function upsertObjectField(
  block: string,
  key: string,
  literal: string | null,
): string {
  let next = stripObjectField(block, key);
  if (!literal) return next;
  const trimmed = next.replace(/\s*$/, "");
  const comma = /,\s*$/.test(trimmed) ? "" : ",";
  return `${trimmed}${comma}\n    ${key}: ${literal},`;
}

function upsertIlluminationField(
  block: string,
  illum: ReticleIllumination | null,
): string {
  return upsertObjectField(
    block,
    "illumination",
    illum ? formatIlluminationLiteral(illum) : null,
  );
}

/**
 * Dev-only: patch one reticle's optical centre + rotation (+ optional illum)
 * in reticles.ts.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Reticle bake is disabled in production." },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reticleId =
    typeof body.reticleId === "string" ? body.reticleId.trim() : "";
  if (!reticleId) {
    return NextResponse.json(
      { error: "Expected reticleId" },
      { status: 400 },
    );
  }
  if (
    !isFiniteNumber(body.imageRotationDeg) ||
    !isFiniteNumber(body.opticalCenterX) ||
    !isFiniteNumber(body.opticalCenterY)
  ) {
    return NextResponse.json(
      {
        error:
          "Expected finite imageRotationDeg, opticalCenterX, opticalCenterY",
      },
      { status: 400 },
    );
  }

  const rot = Math.round(body.imageRotationDeg * 100) / 100;
  const cx = Math.round(body.opticalCenterX * 10000) / 10000;
  const cy = Math.round(body.opticalCenterY * 10000) / 10000;
  const hashPx =
    body.centerTo1MilPx != null && isFiniteNumber(body.centerTo1MilPx)
      ? Math.round(body.centerTo1MilPx * 1000) / 1000
      : null;
  const illumParsed = parseIlluminationBody(body.illumination);
  const cropParsed = parseImageCropBody(body.imageCrop);
  const hiResParsed = parseHiResBody(body.hiRes);

  const def = RETICLES[reticleId];
  const pxPerClick = (def?.centerTo1MilPx ?? hashPx ?? 55.5) * 0.1;
  const midX = def ? def.nativeWidth / 2 : cx;
  const midY = def ? def.nativeHeight / 2 : cy;
  const shiftRightClicks =
    pxPerClick > 0 ? (midX - cx) / pxPerClick : 0;
  const shiftUpClicks = pxPerClick > 0 ? (cy - midY) / pxPerClick : 0;

  const relPath = "src/lib/range/reticles.ts";
  const target = path.join(process.cwd(), relPath);
  let src = await fs.readFile(target, "utf8");
  src = removeDuplicateReticleEntries(src, reticleId);

  const match = findReticleEntry(src, reticleId);
  if (!match) {
    return NextResponse.json(
      { error: `Could not find reticle entry "${reticleId}" in ${relPath}` },
      { status: 500 },
    );
  }

  let inner = match.inner;
  inner = upsertNumericField(inner, "opticalCenterX", String(cx));
  inner = upsertNumericField(inner, "opticalCenterY", String(cy));
  inner = upsertNumericField(inner, "imageRotationDeg", String(rot));
  if (hashPx != null && hashPx > 0) {
    inner = upsertNumericField(inner, "centerTo1MilPx", String(hashPx));
  }
  if (illumParsed !== undefined) {
    inner = upsertIlluminationField(inner, illumParsed);
  }
  if (cropParsed !== undefined) {
    inner = upsertObjectField(
      inner,
      "imageCrop",
      cropParsed ? formatImageCropLiteral(cropParsed) : null,
    );
  }
  if (hiResParsed !== undefined) {
    inner = upsertObjectField(
      inner,
      "hiRes",
      hiResParsed ? formatHiResLiteral(hiResParsed) : null,
    );
  }

  const replacement = `${match.open}${inner}${match.close}`;
  src =
    src.slice(0, match.index) +
    replacement +
    src.slice(match.index + match.fullLength);

  /* Refresh JSDoc optical-centre summary when present above this entry. */
  const summary = ` * Optical centre: ${formatSignedClicks(shiftRightClicks)} klikk X / ${formatSignedClicks(shiftUpClicks)} klikk Y (1 klikk = 0.1 mil) + ${rot}° CW.`;
  const idPat = escapeRegExp(reticleId);
  src = src.replace(
    new RegExp(
      `(\\* Optical centre:[^\\n]*\\n)([\\s\\S]*?(?:"${idPat}"|\\b${idPat}):)`,
    ),
    `${summary}\n$2`,
  );

  await fs.writeFile(target, src, "utf8");

  const savedIllum =
    illumParsed === undefined
      ? (def?.illumination ?? null)
      : illumParsed;
  const savedCrop =
    cropParsed === undefined ? (def?.imageCrop ?? null) : cropParsed;
  const savedHiRes =
    hiResParsed === undefined ? (def?.hiRes ?? null) : hiResParsed;

  return NextResponse.json({
    ok: true,
    path: relPath,
    reticleId,
    imageRotationDeg: rot,
    opticalCenterX: cx,
    opticalCenterY: cy,
    centerTo1MilPx: hashPx ?? def?.centerTo1MilPx ?? 55.5,
    illumination: savedIllum,
    imageCrop: savedCrop,
    hiRes: savedHiRes,
  });
}
