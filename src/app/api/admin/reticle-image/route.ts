import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { RETICLES } from "@/lib/range/reticles";
import { getCatalogByCategory } from "@/lib/shop/catalog";
import { isScopeItem } from "@/lib/shop/types";

type Body = {
  scopeId?: unknown;
  imageBase64?: unknown;
  /** Optional public path; default derived from reticle id. */
  fileName?: unknown;
  nativeWidth?: unknown;
  nativeHeight?: unknown;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findReticleEntry(
  src: string,
  reticleId: string,
): {
  index: number;
  open: string;
  inner: string;
  close: string;
  fullLength: number;
} | null {
  const openRe = new RegExp(`"${escapeRegExp(reticleId)}":\\s*\\{`);
  const openMatch = openRe.exec(src);
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
  const close = src.slice(i - 1, closeEnd);
  return {
    index: openMatch.index,
    open,
    inner: src.slice(bodyStart, i - 1),
    close,
    fullLength: closeEnd - openMatch.index,
  };
}

function pngSize(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  if (buf[0] !== 0x89 || buf[1] !== 0x50) return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

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

function upsertStringField(
  block: string,
  key: string,
  valueLiteral: string,
): string {
  const fieldRe = new RegExp(`(${key}:\\s*)("[^"]*"|'[^']*')`);
  if (fieldRe.test(block)) {
    return block.replace(fieldRe, `$1${valueLiteral}`);
  }
  const trimmed = block.replace(/\s*$/, "");
  const comma = /,\s*$/.test(trimmed) ? "" : ",";
  return `${trimmed}${comma}\n    ${key}: ${valueLiteral},`;
}

function sanitizeFileBase(raw: string): string {
  return raw
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function defaultReticleIdForScope(scopeId: string): string {
  return `admin-${scopeId.replace(/^scope-/, "")}`;
}

/**
 * Dev-only: upload a reticle PNG for a scope and patch reticles.ts (+ catalog
 * reticleId when missing).
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Reticle image upload is disabled in production." },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const scopeId = typeof body.scopeId === "string" ? body.scopeId.trim() : "";
  const imageBase64 =
    typeof body.imageBase64 === "string" ? body.imageBase64.trim() : "";
  if (!scopeId || !imageBase64) {
    return NextResponse.json(
      { error: "Expected scopeId + imageBase64" },
      { status: 400 },
    );
  }

  const item = getCatalogByCategory("scope")
    .filter(isScopeItem)
    .find((s) => s.id === scopeId);
  if (!item) {
    return NextResponse.json(
      { error: `Unknown scopeId: ${scopeId}` },
      { status: 400 },
    );
  }

  const b64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
  let buf: Buffer;
  try {
    buf = Buffer.from(b64, "base64");
  } catch {
    return NextResponse.json({ error: "Invalid base64" }, { status: 400 });
  }
  if (buf.length < 64) {
    return NextResponse.json({ error: "Image too small" }, { status: 400 });
  }

  const parsed = pngSize(buf);
  const nativeWidth = isFiniteNumber(body.nativeWidth)
    ? Math.round(body.nativeWidth)
    : (parsed?.w ?? 0);
  const nativeHeight = isFiniteNumber(body.nativeHeight)
    ? Math.round(body.nativeHeight)
    : (parsed?.h ?? 0);
  if (!(nativeWidth > 0) || !(nativeHeight > 0)) {
    return NextResponse.json(
      { error: "Could not determine nativeWidth/nativeHeight (PNG required)" },
      { status: 400 },
    );
  }

  const existingId = item.scope.reticleId;
  const reticleId =
    existingId && RETICLES[existingId]
      ? existingId
      : defaultReticleIdForScope(scopeId);

  const fileNameRaw =
    typeof body.fileName === "string" ? body.fileName.trim() : "";
  const base =
    sanitizeFileBase(
      fileNameRaw.replace(/\.png$/i, "") ||
        reticleId.replace(/^admin-/, "") ||
        scopeId,
    ) || reticleId;
  const publicSrc = `/range/reticles/${base}.png`;
  const absPng = path.join(process.cwd(), "public", "range", "reticles", `${base}.png`);
  await fs.mkdir(path.dirname(absPng), { recursive: true });
  await fs.writeFile(absPng, buf);

  const reticlesRel = "src/lib/range/reticles.ts";
  const reticlesAbs = path.join(process.cwd(), reticlesRel);
  let reticlesSrc = await fs.readFile(reticlesAbs, "utf8");

  const entryMatch = findReticleEntry(reticlesSrc, reticleId);
  if (entryMatch) {
    let inner = entryMatch.inner;
    inner = upsertStringField(inner, "src", JSON.stringify(publicSrc));
    inner = upsertNumericField(inner, "nativeWidth", String(nativeWidth));
    inner = upsertNumericField(inner, "nativeHeight", String(nativeHeight));
    const replacement = `${entryMatch.open}${inner}${entryMatch.close}`;
    reticlesSrc =
      reticlesSrc.slice(0, entryMatch.index) +
      replacement +
      reticlesSrc.slice(entryMatch.index + entryMatch.fullLength);
  } else {
    const centerTo1MilPx = Math.round((Math.min(nativeWidth, nativeHeight) / 20) * 10) / 10;
    const newEntry = `  "${reticleId}": {
    id: "${reticleId}",
    label: "${reticleId}",
    src: ${JSON.stringify(publicSrc)},
    nativeWidth: ${nativeWidth},
    nativeHeight: ${nativeHeight},
    centerTo1MilPx: ${centerTo1MilPx},
  },
`;
    const insertAt = reticlesSrc.lastIndexOf("\n};");
    if (insertAt < 0) {
      return NextResponse.json(
        { error: "Could not insert reticle entry in reticles.ts" },
        { status: 500 },
      );
    }
    reticlesSrc =
      reticlesSrc.slice(0, insertAt) +
      "\n" +
      newEntry +
      reticlesSrc.slice(insertAt);
  }

  await fs.writeFile(reticlesAbs, reticlesSrc, "utf8");

  let catalogPatched = false;
  if (item.scope.reticleId !== reticleId) {
    const catalogRel = "src/lib/shop/catalog.ts";
    const catalogAbs = path.join(process.cwd(), catalogRel);
    let catalogSrc = await fs.readFile(catalogAbs, "utf8");
    const idRe = new RegExp(
      `(id:\\s*"${escapeRegExp(scopeId)}"[\\s\\S]*?scope:\\s*\\{)([\\s\\S]*?)(\\n\\s*\\},)`,
    );
    const match = idRe.exec(catalogSrc);
    if (match && match.index != null) {
      let inner = match[2] ?? "";
      inner = upsertStringField(inner, "reticleId", JSON.stringify(reticleId));
      const replacement = `${match[1]}${inner}${match[3]}`;
      catalogSrc =
        catalogSrc.slice(0, match.index) +
        replacement +
        catalogSrc.slice(match.index + match[0].length);
      await fs.writeFile(catalogAbs, catalogSrc, "utf8");
      catalogPatched = true;
    }
  }

  return NextResponse.json({
    ok: true,
    scopeId,
    reticleId,
    src: publicSrc,
    nativeWidth,
    nativeHeight,
    path: reticlesRel,
    catalogPatched,
  });
}
