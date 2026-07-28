import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getCatalogByCategory } from "@/lib/shop/catalog";
import { isScopeItem } from "@/lib/shop/types";

type Body = {
  scopeId?: unknown;
  minZoom?: unknown;
  maxZoom?: unknown;
  clickUnit?: unknown;
  zoomMagCal?: unknown;
  minZoomMagCal?: unknown;
  focusZoomEnabled?: unknown;
  focusZoomMultiplier?: unknown;
  focusViewportScale?: unknown;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function upsertNumericField(
  block: string,
  key: string,
  value: string,
): string {
  const fieldRe = new RegExp(`(\\b${key}:\\s*)(-?\\d+(?:\\.\\d+)?)`);
  if (fieldRe.test(block)) {
    return block.replace(fieldRe, `$1${value}`);
  }
  const trimmed = block.replace(/\s*$/, "");
  const comma = /,\s*$/.test(trimmed) ? "" : ",";
  return `${trimmed}${comma}\n      ${key}: ${value},`;
}

function upsertStringField(
  block: string,
  key: string,
  valueLiteral: string,
): string {
  const fieldRe = new RegExp(`(\\b${key}:\\s*)("[^"]*"|'[^']*')`);
  if (fieldRe.test(block)) {
    return block.replace(fieldRe, `$1${valueLiteral}`);
  }
  const trimmed = block.replace(/\s*$/, "");
  const comma = /,\s*$/.test(trimmed) ? "" : ",";
  return `${trimmed}${comma}\n      ${key}: ${valueLiteral},`;
}

function upsertBooleanField(
  block: string,
  key: string,
  value: boolean,
): string {
  const lit = value ? "true" : "false";
  const fieldRe = new RegExp(`(\\b${key}:\\s*)(true|false)`);
  if (fieldRe.test(block)) {
    return block.replace(fieldRe, `$1${lit}`);
  }
  const trimmed = block.replace(/\s*$/, "");
  const comma = /,\s*$/.test(trimmed) ? "" : ",";
  return `${trimmed}${comma}\n      ${key}: ${lit},`;
}

/**
 * Dev-only: patch scope zoom range / click unit / FOV cal in catalog.ts.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Scope bake is disabled in production." },
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
  if (!scopeId) {
    return NextResponse.json({ error: "Expected scopeId" }, { status: 400 });
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

  const hasMin = isFiniteNumber(body.minZoom);
  const hasMax = isFiniteNumber(body.maxZoom);
  const hasUnit =
    body.clickUnit === "MRAD" ||
    body.clickUnit === "MOA" ||
    body.clickUnit === "MIL";
  const hasFov =
    isFiniteNumber(body.zoomMagCal) &&
    (body.zoomMagCal as number) > 0 &&
    (body.zoomMagCal as number) <= 2;
  const hasMinFov =
    isFiniteNumber(body.minZoomMagCal) &&
    (body.minZoomMagCal as number) >= 0.1 &&
    (body.minZoomMagCal as number) <= 1.9;
  const hasFocusZoomEnabled = typeof body.focusZoomEnabled === "boolean";
  const hasFocusZoomMult =
    isFiniteNumber(body.focusZoomMultiplier) &&
    (body.focusZoomMultiplier as number) >= 1 &&
    (body.focusZoomMultiplier as number) <= 5;
  const hasFocusViewportScale =
    isFiniteNumber(body.focusViewportScale) &&
    (body.focusViewportScale as number) >= 1 &&
    (body.focusViewportScale as number) <= 1.8;

  if (
    !hasMin &&
    !hasMax &&
    !hasUnit &&
    !hasFov &&
    !hasMinFov &&
    !hasFocusZoomEnabled &&
    !hasFocusZoomMult &&
    !hasFocusViewportScale
  ) {
    return NextResponse.json(
      {
        error:
          "Expected at least one of minZoom, maxZoom, clickUnit, zoomMagCal, minZoomMagCal, focusZoomEnabled, focusZoomMultiplier, focusViewportScale",
      },
      { status: 400 },
    );
  }

  let minZoom = hasMin
    ? Math.round((body.minZoom as number) * 100) / 100
    : item.scope.minZoom;
  let maxZoom = hasMax
    ? Math.round((body.maxZoom as number) * 100) / 100
    : item.scope.maxZoom;
  if (minZoom <= 0 || maxZoom <= 0) {
    return NextResponse.json(
      { error: "minZoom/maxZoom must be > 0" },
      { status: 400 },
    );
  }
  if (minZoom > maxZoom) {
    const t = minZoom;
    minZoom = maxZoom;
    maxZoom = t;
  }

  const clickUnit = hasUnit
    ? body.clickUnit === "MOA"
      ? "MOA"
      : "MRAD"
    : item.scope.clickUnit;

  const zoomMagCal = hasFov
    ? Math.round((body.zoomMagCal as number) * 1000) / 1000
    : undefined;
  const minZoomMagCal = hasMinFov
    ? Math.round((body.minZoomMagCal as number) * 1000) / 1000
    : undefined;
  const focusZoomEnabled = hasFocusZoomEnabled
    ? (body.focusZoomEnabled as boolean)
    : undefined;
  const focusZoomMultiplier = hasFocusZoomMult
    ? Math.round((body.focusZoomMultiplier as number) * 100) / 100
    : undefined;
  const focusViewportScale = hasFocusViewportScale
    ? Math.round((body.focusViewportScale as number) * 1000) / 1000
    : undefined;

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
  if (hasMin || hasMax) {
    inner = upsertNumericField(inner, "minZoom", String(minZoom));
    inner = upsertNumericField(inner, "maxZoom", String(maxZoom));
  }
  if (hasUnit) {
    inner = upsertStringField(inner, "clickUnit", `"${clickUnit}"`);
  }
  if (zoomMagCal != null) {
    inner = upsertNumericField(inner, "zoomMagCal", String(zoomMagCal));
  }
  if (minZoomMagCal != null) {
    inner = upsertNumericField(inner, "minZoomMagCal", String(minZoomMagCal));
  }
  if (focusZoomEnabled != null) {
    inner = upsertBooleanField(inner, "focusZoomEnabled", focusZoomEnabled);
  }
  if (focusZoomMultiplier != null) {
    inner = upsertNumericField(
      inner,
      "focusZoomMultiplier",
      String(focusZoomMultiplier),
    );
  }
  if (focusViewportScale != null) {
    inner = upsertNumericField(
      inner,
      "focusViewportScale",
      String(focusViewportScale),
    );
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
    minZoom,
    maxZoom,
    clickUnit,
    ...(zoomMagCal != null ? { zoomMagCal } : null),
    ...(minZoomMagCal != null ? { minZoomMagCal } : null),
    ...(focusZoomEnabled != null ? { focusZoomEnabled } : null),
    ...(focusZoomMultiplier != null ? { focusZoomMultiplier } : null),
    ...(focusViewportScale != null ? { focusViewportScale } : null),
  });
}
