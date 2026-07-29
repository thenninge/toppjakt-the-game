/**
 * Server-only: bake a {@link ScopePack} into catalog.ts + reticles.ts (+ PNG).
 */

import { promises as fs } from "fs";
import path from "path";
import type { ScopeSpec } from "@/lib/optics/spec";
import type { ReticleDef, ReticleIllumination } from "@/lib/range/reticles";
import type { ScopePack } from "@/lib/optics/scopePack";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findObjectEntry(
  src: string,
  keyPattern: RegExp,
): {
  index: number;
  open: string;
  inner: string;
  close: string;
  fullLength: number;
} | null {
  const openMatch = keyPattern.exec(src);
  if (!openMatch || openMatch.index == null) return null;
  const open = openMatch[0];
  const bodyStart = openMatch.index + open.length;
  let depth = 1;
  let i = bodyStart;
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
  let closeEnd = i;
  while (closeEnd < src.length && /\s/.test(src[closeEnd]!)) closeEnd += 1;
  if (src[closeEnd] === ",") closeEnd += 1;
  return {
    index: openMatch.index,
    open,
    inner: src.slice(bodyStart, i - 1),
    close: src.slice(i - 1, closeEnd),
    fullLength: closeEnd - openMatch.index,
  };
}

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
  if (illum.region) {
    const r = illum.region;
    if (r.shape === "circle") {
      parts.push(`${innerPad}region: {`);
      parts.push(`${indent(level + 2)}shape: "circle",`);
      if (r.cx != null) parts.push(`${indent(level + 2)}cx: ${r.cx},`);
      if (r.cy != null) parts.push(`${indent(level + 2)}cy: ${r.cy},`);
      parts.push(`${indent(level + 2)}r: ${r.r},`);
      parts.push(`${innerPad}},`);
    } else if (r.shape === "rect") {
      parts.push(`${innerPad}region: {`);
      parts.push(`${indent(level + 2)}shape: "rect",`);
      parts.push(`${indent(level + 2)}x: ${r.x},`);
      parts.push(`${indent(level + 2)}y: ${r.y},`);
      parts.push(`${indent(level + 2)}w: ${r.w},`);
      parts.push(`${indent(level + 2)}h: ${r.h},`);
      parts.push(`${innerPad}},`);
    } else if (r.shape === "circleMils") {
      parts.push(`${innerPad}region: {`);
      parts.push(`${indent(level + 2)}shape: "circleMils",`);
      parts.push(`${indent(level + 2)}rMils: ${r.rMils},`);
      parts.push(`${innerPad}},`);
    }
  }
  parts.push(`${pad}},`);
  return parts.join("\n");
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
    const entry = findObjectEntry(
      reticlesSrc,
      new RegExp(`"${escapeRegExp(reticle.id)}":\\s*\\{`),
    );
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
