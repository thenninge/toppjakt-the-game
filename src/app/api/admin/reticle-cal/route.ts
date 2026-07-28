import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { RETICLES } from "@/lib/range/reticles";

type Body = {
  reticleId?: unknown;
  imageRotationDeg?: unknown;
  opticalCenterX?: unknown;
  opticalCenterY?: unknown;
  centerTo1MilPx?: unknown;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

/**
 * Dev-only: patch one reticle's optical centre + rotation in reticles.ts.
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
  if (!reticleId || !RETICLES[reticleId]) {
    return NextResponse.json(
      { error: `Unknown reticleId: ${reticleId || "(empty)"}` },
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

  const def = RETICLES[reticleId]!;
  const pxPerClick = def.centerTo1MilPx * 0.1;
  const midX = def.nativeWidth / 2;
  const midY = def.nativeHeight / 2;
  const shiftRightClicks =
    pxPerClick > 0 ? (midX - cx) / pxPerClick : 0;
  const shiftUpClicks = pxPerClick > 0 ? (cy - midY) / pxPerClick : 0;

  const relPath = "src/lib/range/reticles.ts";
  const target = path.join(process.cwd(), relPath);
  let src = await fs.readFile(target, "utf8");

  const entryRe = new RegExp(
    `("${escapeRegExp(reticleId)}":\\s*\\{)([\\s\\S]*?)(\\n\\s*\\},)`,
  );
  const match = entryRe.exec(src);
  if (!match || match.index == null) {
    return NextResponse.json(
      { error: `Could not find reticle entry "${reticleId}" in ${relPath}` },
      { status: 500 },
    );
  }

  let inner = match[2] ?? "";
  inner = upsertNumericField(inner, "opticalCenterX", String(cx));
  inner = upsertNumericField(inner, "opticalCenterY", String(cy));
  inner = upsertNumericField(inner, "imageRotationDeg", String(rot));
  if (hashPx != null && hashPx > 0) {
    inner = upsertNumericField(inner, "centerTo1MilPx", String(hashPx));
  }

  const replacement = `${match[1]}${inner}${match[3]}`;
  src =
    src.slice(0, match.index) +
    replacement +
    src.slice(match.index + match[0].length);

  /* Refresh JSDoc optical-centre summary when present above this entry. */
  const summary = ` * Optical centre: ${formatSignedClicks(shiftRightClicks)} klikk X / ${formatSignedClicks(shiftUpClicks)} klikk Y (1 klikk = 0.1 mil) + ${rot}° CW.`;
  src = src.replace(
    new RegExp(
      `(\\* Optical centre:[^\\n]*\\n)([\\s\\S]*?"${escapeRegExp(reticleId)}":)`,
    ),
    `${summary}\n$2`,
  );

  await fs.writeFile(target, src, "utf8");

  return NextResponse.json({
    ok: true,
    path: relPath,
    reticleId,
    imageRotationDeg: rot,
    opticalCenterX: cx,
    opticalCenterY: cy,
    centerTo1MilPx: hashPx ?? def.centerTo1MilPx,
  });
}
