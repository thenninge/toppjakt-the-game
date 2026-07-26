import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { allBirdSpriteIds, type BirdSpriteId } from "@/lib/hunt/birdSprites";

type ZoneBody = {
  vitalCxPx: number;
  vitalCyPx: number;
  instantDiameterMm: number;
  vitalDiameterMm: number;
  headCxPx: number;
  headCyPx: number;
  headDiameterMm: number;
  bodyRxMm: number;
  bodyRyMm: number;
  bodyOffsetXMm: number;
  bodyOffsetYMm: number;
  bodyRotationDeg: number;
};

function isZone(v: unknown): v is ZoneBody {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.vitalCxPx === "number" &&
    typeof o.vitalCyPx === "number" &&
    typeof o.instantDiameterMm === "number" &&
    typeof o.vitalDiameterMm === "number" &&
    typeof o.headCxPx === "number" &&
    typeof o.headCyPx === "number" &&
    typeof o.headDiameterMm === "number" &&
    typeof o.bodyRxMm === "number" &&
    typeof o.bodyRyMm === "number" &&
    typeof o.bodyOffsetXMm === "number" &&
    typeof o.bodyOffsetYMm === "number" &&
    typeof o.bodyRotationDeg === "number"
  );
}

/**
 * Dev-only: rewrite committed hit-zone catalog from admin calibrations.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Hit-zone bake is disabled in production." },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Expected object body" }, { status: 400 });
  }

  const incoming = body as Record<string, unknown>;
  const ids = allBirdSpriteIds();
  const zones: Partial<Record<BirdSpriteId, ZoneBody>> = {};
  for (const id of ids) {
    const z = incoming[id];
    if (isZone(z)) zones[id] = z;
  }
  if (Object.keys(zones).length === 0) {
    return NextResponse.json(
      { error: "No valid sprite zones in body" },
      { status: 400 },
    );
  }

  const missing = ids.filter((id) => !zones[id]);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: `Missing sprites: ${missing.join(", ")}. Send exportEffectiveHitZones().`,
      },
      { status: 400 },
    );
  }

  const fixedEntries = ids
    .map((id) => {
      const z = zones[id]!;
      return [
        `  "${id}": {`,
        `    vitalCxPx: ${Number(z.vitalCxPx.toFixed(1))},`,
        `    vitalCyPx: ${Number(z.vitalCyPx.toFixed(1))},`,
        `    instantDiameterMm: ${Math.round(z.instantDiameterMm)},`,
        `    vitalDiameterMm: ${Math.round(z.vitalDiameterMm)},`,
        `    headCxPx: ${Number(z.headCxPx.toFixed(1))},`,
        `    headCyPx: ${Number(z.headCyPx.toFixed(1))},`,
        `    headDiameterMm: ${Math.round(z.headDiameterMm)},`,
        `    bodyRxMm: ${Math.round(z.bodyRxMm)},`,
        `    bodyRyMm: ${Math.round(z.bodyRyMm)},`,
        `    bodyOffsetXMm: ${Math.round(z.bodyOffsetXMm)},`,
        `    bodyOffsetYMm: ${Math.round(z.bodyOffsetYMm)},`,
        `    bodyRotationDeg: ${Math.round(z.bodyRotationDeg)},`,
        `  }`,
      ].join("\n");
    })
    .join(",\n");

  const file = `/**
 * Committed hit-zone catalog — ship defaults for every player.
 *
 * Admin «Lagre» only writes browser localStorage. Use Admin → Treffområde →
 * «Skriv til repo (dev)» to overwrite this file from calibrated overrides,
 * then commit + push so GitHub has the real defaults.
 *
 * Zones:
 * - Yellow (head): instant kill — headshot
 * - Green (chest): instant kill — bird drops
 * - Red: vital — short ettersøk
 * - Body ellipse: wound — ettersøk toward max fly radius
 * - Outside: clean miss
 *
 * Auto-generated ${new Date().toISOString()} — do not hand-edit unless needed.
 */

import type { BirdSpriteId } from "@/lib/hunt/birdSprites";

export type BirdHitZone = {
  vitalCxPx: number;
  vitalCyPx: number;
  instantDiameterMm: number;
  vitalDiameterMm: number;
  headCxPx: number;
  headCyPx: number;
  headDiameterMm: number;
  bodyRxMm: number;
  bodyRyMm: number;
  bodyOffsetXMm: number;
  bodyOffsetYMm: number;
  bodyRotationDeg: number;
};

export const BIRD_HIT_ZONE_CATALOG: Record<BirdSpriteId, BirdHitZone> = {
${fixedEntries},
};
`;

  const target = path.join(
    process.cwd(),
    "src/lib/hunt/birdHitZoneCatalog.ts",
  );
  await fs.writeFile(target, file, "utf8");

  return NextResponse.json({
    ok: true,
    path: "src/lib/hunt/birdHitZoneCatalog.ts",
    sprites: ids.length,
  });
}
