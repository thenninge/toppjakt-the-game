import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  RANGE_TARGETS,
  type RangeTargetId,
} from "@/lib/range/targets";

type Body = {
  targetId?: unknown;
  bullseyeXPx?: unknown;
  bullseyeYPx?: unknown;
  pxPerMm?: unknown;
  /** null clears optional Y cal (use X). */
  pxPerMmY?: unknown;
  visualScale?: unknown;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findTargetEntry(
  src: string,
  targetId: string,
): {
  index: number;
  open: string;
  inner: string;
  close: string;
  fullLength: number;
} | null {
  const openRe = new RegExp(`"${escapeRegExp(targetId)}":\\s*\\{`);
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

/** Match a numeric field value: plain, a/b, or a*b. */
const NUM_EXPR = String.raw`-?\d+(?:\.\d+)?(?:\s*[/*]\s*-?\d+(?:\.\d+)?)?`;

function upsertNumericField(
  block: string,
  key: string,
  value: string,
): string {
  const fieldRe = new RegExp(
    `(^|\\n)([ \\t]*${key}:\\s*)(${NUM_EXPR})`,
  );
  if (fieldRe.test(block)) {
    return block.replace(fieldRe, `$1$2${value}`);
  }
  const trimmed = block.replace(/\s*$/, "");
  const comma = /,\s*$/.test(trimmed) ? "" : ",";
  return `${trimmed}${comma}\n    ${key}: ${value},`;
}

function removeField(block: string, key: string): string {
  return block.replace(
    new RegExp(
      `(^|\\n)[ \\t]*${key}:\\s*${NUM_EXPR},?\\s*`,
      "g",
    ),
    "$1",
  );
}

function formatPpmLiteral(n: number): string {
  // Prefer a/b form when close to gridMm=20 measure
  const rounded = Math.round(n * 1000) / 1000;
  const times20 = Math.round(rounded * 20 * 10) / 10;
  if (Math.abs(times20 / 20 - rounded) < 1e-6 && times20 >= 5) {
    const a = Number.isInteger(times20) ? String(times20) : times20.toFixed(1);
    return `${a} / 20`;
  }
  return String(rounded);
}

/**
 * Dev-only: bake bullseye + pxPerMm into src/lib/range/targets.ts.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Target bake is disabled in production." },
      { status: 403 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const targetId =
    typeof body.targetId === "string" ? body.targetId.trim() : "";
  if (!targetId || !(targetId in RANGE_TARGETS)) {
    return NextResponse.json({ error: "Unknown targetId" }, { status: 400 });
  }
  const id = targetId as RangeTargetId;

  if (
    !isFiniteNumber(body.bullseyeXPx) ||
    !isFiniteNumber(body.bullseyeYPx) ||
    !isFiniteNumber(body.pxPerMm) ||
    !isFiniteNumber(body.visualScale)
  ) {
    return NextResponse.json(
      { error: "Expected bullseyeXPx, bullseyeYPx, pxPerMm, visualScale" },
      { status: 400 },
    );
  }
  if (body.pxPerMm <= 0 || body.visualScale <= 0) {
    return NextResponse.json(
      { error: "pxPerMm and visualScale must be > 0" },
      { status: 400 },
    );
  }

  const clearY = body.pxPerMmY === null;
  const pxPerMmY =
    body.pxPerMmY === null || body.pxPerMmY === undefined
      ? null
      : isFiniteNumber(body.pxPerMmY) && body.pxPerMmY > 0
        ? body.pxPerMmY
        : null;
  if (body.pxPerMmY != null && body.pxPerMmY !== null && pxPerMmY == null) {
    return NextResponse.json({ error: "Invalid pxPerMmY" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "src/lib/range/targets.ts");
  let src: string;
  try {
    src = await fs.readFile(filePath, "utf8");
  } catch {
    return NextResponse.json(
      { error: "Could not read targets.ts" },
      { status: 500 },
    );
  }

  const entry = findTargetEntry(src, id);
  if (!entry) {
    return NextResponse.json(
      { error: `Could not find target block for ${id}` },
      { status: 500 },
    );
  }

  let inner = entry.inner;
  inner = upsertNumericField(
    inner,
    "bullseyeXPx",
    String(Math.round(body.bullseyeXPx * 10) / 10),
  );
  inner = upsertNumericField(
    inner,
    "bullseyeYPx",
    String(Math.round(body.bullseyeYPx * 10) / 10),
  );
  inner = upsertNumericField(inner, "pxPerMm", formatPpmLiteral(body.pxPerMm));
  if (clearY || pxPerMmY == null) {
    inner = removeField(inner, "pxPerMmY");
  } else {
    inner = upsertNumericField(inner, "pxPerMmY", formatPpmLiteral(pxPerMmY));
  }
  inner = upsertNumericField(
    inner,
    "visualScale",
    String(Math.round(body.visualScale * 1000) / 1000),
  );

  const next =
    src.slice(0, entry.index) +
    entry.open +
    inner +
    entry.close +
    src.slice(entry.index + entry.fullLength);

  try {
    await fs.writeFile(filePath, next, "utf8");
  } catch {
    return NextResponse.json(
      { error: "Could not write targets.ts" },
      { status: 500 },
    );
  }

  // Live-update in-memory catalog for this process
  const live = RANGE_TARGETS[id];
  live.bullseyeXPx = Math.round(body.bullseyeXPx * 10) / 10;
  live.bullseyeYPx = Math.round(body.bullseyeYPx * 10) / 10;
  live.pxPerMm = body.pxPerMm;
  if (clearY || pxPerMmY == null) {
    delete live.pxPerMmY;
  } else {
    live.pxPerMmY = pxPerMmY;
  }
  live.visualScale = Math.round(body.visualScale * 1000) / 1000;

  return NextResponse.json({ ok: true, targetId: id });
}
