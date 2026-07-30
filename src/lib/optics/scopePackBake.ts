/**
 * Server-only: bake a {@link ScopePack} into catalog.ts + reticles.ts (+ PNG).
 */

import { promises as fs } from "fs";
import path from "path";
import type { ScopeSpec } from "@/lib/optics/spec";
import type {
  ReticleDef,
  ReticleHiResLayer,
  ReticleIllumination,
  ReticleIlluminationRegion,
  ReticleImageCrop,
} from "@/lib/range/reticles";
import type { ScopePack } from "@/lib/optics/scopePack";
import {
  escapeRegExp,
  findReticleEntry,
} from "@/lib/range/reticleFilePatch";
import { RETICLES } from "@/lib/range/reticles";

function findCatalogScopeBlock(
  src: string,
  scopeId: string,
): { index: number; fullLength: number } | null {
  const idRe = new RegExp(
    `\\{\\s*id:\\s*"${escapeRegExp(scopeId)}"`,
  );
  const m = idRe.exec(src);
  if (!m || m.index == null) return null;
  let depth = 0;
  let i = m.index;
  for (; i < src.length; i += 1) {
    const ch = src[i]!;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        i += 1;
        break;
      }
    }
  }
  if (depth !== 0) return null;
  let end = i;
  while (end < src.length && /\s/.test(src[end]!)) end += 1;
  if (src[end] === ",") end += 1;
  return { index: m.index, fullLength: end - m.index };
}

function indent(level: number): string {
  return "  ".repeat(level);
}

function formatScopeSpecTs(scope: ScopeSpec, level: number): string {
  const pad = indent(level);
  const lines: string[] = [];
  lines.push(`${pad}tubeDiameterMm: ${scope.tubeDiameterMm},`);
  lines.push(`${pad}minZoom: ${scope.minZoom},`);
  lines.push(`${pad}maxZoom: ${scope.maxZoom},`);
  if (scope.focalPlane) {
    lines.push(`${pad}focalPlane: "${scope.focalPlane}",`);
  }
  if (scope.reticleId) {
    lines.push(`${pad}reticleId: ${JSON.stringify(scope.reticleId)},`);
  }
  lines.push(`${pad}clickUnit: "${scope.clickUnit}",`);
  if (scope.zeroStop != null) {
    lines.push(`${pad}zeroStop: ${scope.zeroStop},`);
  }
  if (scope.elevationUpClicks != null) {
    lines.push(`${pad}elevationUpClicks: ${scope.elevationUpClicks},`);
  }
  if (scope.elevationClicksPerRev != null) {
    lines.push(`${pad}elevationClicksPerRev: ${scope.elevationClicksPerRev},`);
  }
  if (scope.windageClicksPerRev != null) {
    lines.push(`${pad}windageClicksPerRev: ${scope.windageClicksPerRev},`);
  }
  lines.push(`${pad}clickErrorPercent: ${scope.clickErrorPercent},`);
  lines.push(
    `${pad}zeroRetentionInaccuracy: ${scope.zeroRetentionInaccuracy},`,
  );
  if (scope.fovDiameterScale != null) {
    lines.push(`${pad}fovDiameterScale: ${scope.fovDiameterScale},`);
  }
  if (scope.zoomMagCal != null) {
    lines.push(`${pad}zoomMagCal: ${scope.zoomMagCal},`);
  }
  if (scope.minZoomMagCal != null) {
    lines.push(`${pad}minZoomMagCal: ${scope.minZoomMagCal},`);
  }
  if (scope.focusZoomEnabled != null) {
    lines.push(`${pad}focusZoomEnabled: ${scope.focusZoomEnabled},`);
  }
  if (scope.focusZoomMultiplier != null) {
    lines.push(`${pad}focusZoomMultiplier: ${scope.focusZoomMultiplier},`);
  }
  if (scope.focusViewportScale != null) {
    lines.push(`${pad}focusViewportScale: ${scope.focusViewportScale},`);
  }
  if (scope.illuminationColors?.length) {
    lines.push(
      `${pad}illuminationColors: [${scope.illuminationColors
        .map((c) => JSON.stringify(c))
        .join(", ")}],`,
    );
  }
  if (scope.triggercamZoomRestrict != null) {
    lines.push(
      `${pad}triggercamZoomRestrict: ${scope.triggercamZoomRestrict},`,
    );
  }
  if (scope.triggercamMinZoom != null) {
    lines.push(`${pad}triggercamMinZoom: ${scope.triggercamMinZoom},`);
  }
  if (scope.triggercamMaxZoom != null) {
    lines.push(`${pad}triggercamMaxZoom: ${scope.triggercamMaxZoom},`);
  }
  return lines.join("\n");
}

function formatRegionTs(
  region: ReticleIlluminationRegion,
  level: number,
): string {
  const pad = indent(level);
  if (region.shape === "circle") {
    const lines = [`${pad}{`, `${indent(level + 1)}shape: "circle",`];
    if (region.cx != null) lines.push(`${indent(level + 1)}cx: ${region.cx},`);
    if (region.cy != null) lines.push(`${indent(level + 1)}cy: ${region.cy},`);
    lines.push(`${indent(level + 1)}r: ${region.r},`);
    lines.push(`${pad}}`);
    return lines.join("\n");
  }
  if (region.shape === "rect") {
    return [
      `${pad}{`,
      `${indent(level + 1)}shape: "rect",`,
      `${indent(level + 1)}x: ${region.x},`,
      `${indent(level + 1)}y: ${region.y},`,
      `${indent(level + 1)}w: ${region.w},`,
      `${indent(level + 1)}h: ${region.h},`,
      `${pad}}`,
    ].join("\n");
  }
  return [
    `${pad}{`,
    `${indent(level + 1)}shape: "circleMils",`,
    `${indent(level + 1)}rMils: ${region.rMils},`,
    `${pad}}`,
  ].join("\n");
}

function formatIlluminationTs(
  illum: ReticleIllumination,
  level: number,
): string {
  const pad = indent(level);
  const innerPad = indent(level + 1);
  const parts: string[] = [`${pad}illumination: {`];
  if (illum.maskSrc) {
    parts.push(`${innerPad}maskSrc: ${JSON.stringify(illum.maskSrc)},`);
  }
  if (illum.regions && illum.regions.length > 1) {
    parts.push(`${innerPad}regions: [`);
    for (const r of illum.regions) {
      parts.push(`${formatRegionTs(r, level + 2)},`);
    }
    parts.push(`${innerPad}],`);
  } else if (illum.region || illum.regions?.[0]) {
    const r = illum.region ?? illum.regions![0]!;
    if (r.shape === "circleMils") {
      parts.push(
        `${innerPad}region: { shape: "circleMils", rMils: ${r.rMils} },`,
      );
    } else if (r.shape === "circle") {
      const bits = [`shape: "circle"`, `r: ${r.r}`];
      if (r.cx != null) bits.push(`cx: ${r.cx}`);
      if (r.cy != null) bits.push(`cy: ${r.cy}`);
      parts.push(`${innerPad}region: { ${bits.join(", ")} },`);
    } else {
      parts.push(
        `${innerPad}region: { shape: "rect", x: ${r.x}, y: ${r.y}, w: ${r.w}, h: ${r.h} },`,
      );
    }
  }
  parts.push(`${pad}},`);
  return parts.join("\n");
}

function formatImageCropTs(crop: ReticleImageCrop, level: number): string {
  const pad = indent(level);
  const innerPad = indent(level + 1);
  if (crop.shape === "circleMils") {
    const lines = [
      `${pad}imageCrop: {`,
      `${innerPad}shape: "circleMils",`,
      `${innerPad}rMils: ${crop.rMils},`,
    ];
    if (crop.rInnerMils != null) {
      lines.push(`${innerPad}rInnerMils: ${crop.rInnerMils},`);
    }
    lines.push(`${pad}},`);
    return lines.join("\n");
  }
  const lines = [
    `${pad}imageCrop: {`,
    `${innerPad}shape: "circle",`,
  ];
  if (crop.cx != null) lines.push(`${innerPad}cx: ${crop.cx},`);
  if (crop.cy != null) lines.push(`${innerPad}cy: ${crop.cy},`);
  lines.push(`${innerPad}r: ${crop.r},`);
  if (crop.rInner != null) lines.push(`${innerPad}rInner: ${crop.rInner},`);
  lines.push(`${pad}},`);
  return lines.join("\n");
}

function formatHiResTs(hi: ReticleHiResLayer, level: number): string {
  const pad = indent(level);
  const innerPad = indent(level + 1);
  const lines = [
    `${pad}hiRes: {`,
    `${innerPad}src: ${JSON.stringify(hi.src)},`,
    `${innerPad}nativeWidth: ${hi.nativeWidth},`,
    `${innerPad}nativeHeight: ${hi.nativeHeight},`,
    `${innerPad}centerTo1MilPx: ${hi.centerTo1MilPx},`,
  ];
  if (hi.opticalCenterX != null) {
    lines.push(`${innerPad}opticalCenterX: ${hi.opticalCenterX},`);
  }
  if (hi.opticalCenterY != null) {
    lines.push(`${innerPad}opticalCenterY: ${hi.opticalCenterY},`);
  }
  if (hi.cropRMils != null) {
    lines.push(`${innerPad}cropRMils: ${hi.cropRMils},`);
  }
  if (hi.fadeFromZoomFrac != null) {
    lines.push(`${innerPad}fadeFromZoomFrac: ${hi.fadeFromZoomFrac},`);
  }
  if (hi.fadeToZoomFrac != null) {
    lines.push(`${innerPad}fadeToZoomFrac: ${hi.fadeToZoomFrac},`);
  }
  lines.push(`${pad}},`);
  return lines.join("\n");
}

function formatReticleEntryTs(reticle: ReticleDef): string {
  const lines: string[] = [
    `  "${reticle.id}": {`,
    `    id: ${JSON.stringify(reticle.id)},`,
    `    label: ${JSON.stringify(reticle.label)},`,
    `    src: ${JSON.stringify(reticle.src)},`,
    `    nativeWidth: ${reticle.nativeWidth},`,
    `    nativeHeight: ${reticle.nativeHeight},`,
    `    centerTo1MilPx: ${reticle.centerTo1MilPx},`,
  ];
  if (reticle.opticalCenterX != null) {
    lines.push(`    opticalCenterX: ${reticle.opticalCenterX},`);
  }
  if (reticle.opticalCenterY != null) {
    lines.push(`    opticalCenterY: ${reticle.opticalCenterY},`);
  }
  if (reticle.imageRotationDeg != null) {
    lines.push(`    imageRotationDeg: ${reticle.imageRotationDeg},`);
  }
  if (reticle.illumination) {
    lines.push(formatIlluminationTs(reticle.illumination, 2));
  }
  if (reticle.imageCrop) {
    lines.push(formatImageCropTs(reticle.imageCrop, 2));
  }
  if (reticle.hiRes) {
    lines.push(formatHiResTs(reticle.hiRes, 2));
  }
  lines.push(`  },`);
  return lines.join("\n");
}

function formatCatalogScopeTs(pack: ScopePack): string {
  const item = pack.shopItem;
  const lines: string[] = [
    `  {`,
    `    id: ${JSON.stringify(item.id)},`,
    `    category: "scope",`,
    `    brand: ${JSON.stringify(item.brand)},`,
    `    name: ${JSON.stringify(item.name)},`,
    `    priceNok: ${item.priceNok},`,
  ];
  if (item.note) {
    lines.push(`    note: ${JSON.stringify(item.note)},`);
  }
  if (item.weightGrams != null) {
    lines.push(`    weightGrams: ${item.weightGrams},`);
  }
  lines.push(`    scope: {`);
  lines.push(formatScopeSpecTs(item.scope, 3));
  lines.push(`    },`);
  lines.push(`  },`);
  return lines.join("\n");
}

function sanitizeFileBase(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function pngSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

export type BakeScopePackResult = {
  ok: true;
  scopeId: string;
  reticleId: string | null;
  src: string | null;
  created: boolean;
  catalogPath: string;
  reticlesPath: string | null;
};

/**
 * Write pack PNG + upsert RETICLES + upsert/insert catalog scope draft.
 */
export async function bakeScopePackToRepo(
  pack: ScopePack,
): Promise<BakeScopePackResult> {
  const catalogRel = "src/lib/shop/catalog.ts";
  const reticlesRel = "src/lib/range/reticles.ts";
  const catalogAbs = path.join(process.cwd(), catalogRel);
  const reticlesAbs = path.join(process.cwd(), reticlesRel);

  let publicSrc: string | null = null;
  let reticle: ReticleDef | null = pack.reticle ? { ...pack.reticle } : null;

  // Older exports omitted imageCrop / hiRes — keep repo values when missing.
  if (reticle) {
    const existing = RETICLES[reticle.id];
    if (existing?.imageCrop && !reticle.imageCrop) {
      reticle.imageCrop = existing.imageCrop;
    }
    if (existing?.hiRes && !reticle.hiRes) {
      reticle.hiRes = existing.hiRes;
    }
  }

  if (pack.image?.base64) {
    const buf = Buffer.from(pack.image.base64, "base64");
    if (buf.length < 64) {
      throw new Error("Reticle image too small");
    }
    const parsed = pngSize(buf);
    const fileBase =
      sanitizeFileBase(
        pack.image.filename.replace(/\.png$/i, "") ||
          reticle?.id ||
          pack.shopItem.id.replace(/^scope-/, ""),
      ) || "reticle";
    publicSrc = `/range/reticles/${fileBase}.png`;
    const absPng = path.join(
      process.cwd(),
      "public",
      "range",
      "reticles",
      `${fileBase}.png`,
    );
    await fs.mkdir(path.dirname(absPng), { recursive: true });
    await fs.writeFile(absPng, buf);

    if (!reticle) {
      const w = parsed?.w ?? 1024;
      const h = parsed?.h ?? 1024;
      const rid =
        pack.shopItem.scope.reticleId ||
        `admin-${pack.shopItem.id.replace(/^scope-/, "")}`;
      reticle = {
        id: rid,
        label: rid,
        src: publicSrc,
        nativeWidth: w,
        nativeHeight: h,
        centerTo1MilPx: Math.round((Math.min(w, h) / 20) * 10) / 10,
      };
    } else {
      reticle = {
        ...reticle,
        src: publicSrc,
        nativeWidth: parsed?.w ?? reticle.nativeWidth,
        nativeHeight: parsed?.h ?? reticle.nativeHeight,
      };
    }
    pack.shopItem.scope.reticleId = reticle.id;
  } else if (reticle && !reticle.src.startsWith("/")) {
    throw new Error("reticle.src must be a public path when image is omitted");
  }

  if (reticle) {
    let reticlesSrc = await fs.readFile(reticlesAbs, "utf8");
    const entry = findReticleEntry(reticlesSrc, reticle.id);
    const block = formatReticleEntryTs(reticle);
    if (entry) {
      reticlesSrc =
        reticlesSrc.slice(0, entry.index) +
        block +
        reticlesSrc.slice(entry.index + entry.fullLength);
    } else {
      const insertAt = reticlesSrc.lastIndexOf("\n};");
      if (insertAt < 0) {
        throw new Error("Could not insert reticle in reticles.ts");
      }
      reticlesSrc =
        reticlesSrc.slice(0, insertAt) +
        "\n" +
        block +
        reticlesSrc.slice(insertAt);
    }
    await fs.writeFile(reticlesAbs, reticlesSrc, "utf8");
  }

  let catalogSrc = await fs.readFile(catalogAbs, "utf8");
  const existing = findCatalogScopeBlock(catalogSrc, pack.shopItem.id);
  const itemBlock = formatCatalogScopeTs(pack);
  let created = false;
  if (existing) {
    catalogSrc =
      catalogSrc.slice(0, existing.index) +
      itemBlock.trimStart() +
      catalogSrc.slice(existing.index + existing.fullLength);
  } else {
    created = true;
    const marker = "\n];\n\nexport const SHOP_CATALOG";
    const insertAt = catalogSrc.indexOf(marker);
    if (insertAt < 0) {
      throw new Error("Could not find CATALOG_DRAFT end in catalog.ts");
    }
    catalogSrc =
      catalogSrc.slice(0, insertAt) +
      "\n" +
      itemBlock +
      catalogSrc.slice(insertAt);
  }
  await fs.writeFile(catalogAbs, catalogSrc, "utf8");

  return {
    ok: true,
    scopeId: pack.shopItem.id,
    reticleId: reticle?.id ?? null,
    src: publicSrc ?? reticle?.src ?? null,
    created,
    catalogPath: catalogRel,
    reticlesPath: reticle ? reticlesRel : null,
  };
}
