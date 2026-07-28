import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getCatalogByCategory } from "@/lib/shop/catalog";
import { isScopeItem } from "@/lib/shop/types";

type Body = {
  scopeId?: unknown;
  zoomMagCal?: unknown;
};

/**
 * Dev-only: patch one scope's {@code zoomMagCal} (FOV fine-tune) in catalog.ts.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Scope FOV bake is disabled in production." },
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
  const zoomMagCal =
    typeof body.zoomMagCal === "number" && Number.isFinite(body.zoomMagCal)
      ? Math.round(body.zoomMagCal * 1000) / 1000
      : NaN;
  if (!scopeId || !(zoomMagCal > 0)) {
    return NextResponse.json(
      { error: "Expected scopeId + zoomMagCal > 0" },
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

  const relPath = "src/lib/shop/catalog.ts";
  const target = path.join(process.cwd(), relPath);
  let src = await fs.readFile(target, "utf8");

  const idRe = new RegExp(
    `(id:\\s*"${escapeRegExp(scopeId)}"[\\s\\S]*?scope:\\s*\\{)([\\s\\S]*?)(\\n\\s*\\},)`,
  );
  const match = idRe.exec(src);
  if (!match || match.index == null) {
    return NextResponse.json(
      { error: `Could not find scope "${scopeId}" in ${relPath}` },
      { status: 500 },
    );
  }

  let inner = match[2] ?? "";
  const fieldRe = /(zoomMagCal:\s*)(-?\d+(?:\.\d+)?)/;
  if (fieldRe.test(inner)) {
    inner = inner.replace(fieldRe, `$1${zoomMagCal}`);
  } else {
    const trimmed = inner.replace(/\s*$/, "");
    const comma = /,\s*$/.test(trimmed) ? "" : ",";
    inner = `${trimmed}${comma}\n      zoomMagCal: ${zoomMagCal},`;
  }

  const replacement = `${match[1]}${inner}${match[3]}`;
  src =
    src.slice(0, match.index) +
    replacement +
    src.slice(match.index + match[0].length);

  await fs.writeFile(target, src, "utf8");

  return NextResponse.json({
    ok: true,
    path: relPath,
    scopeId,
    zoomMagCal,
  });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
