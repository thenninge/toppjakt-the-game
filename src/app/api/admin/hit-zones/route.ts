import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { allBirdSpriteIds, type BirdSpriteId } from "@/lib/hunt/birdSprites";

type ZoneBody = {
  vitalCxPx: number;
  vitalCyPx: number;
  instantDiameterMm: number;
  vitalDiameterMm: number;
};

function isZone(v: unknown): v is ZoneBody {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.vitalCxPx === "number" &&
    typeof o.vitalCyPx === "number" &&
    typeof o.instantDiameterMm === "number" &&
    typeof o.vitalDiameterMm === "number"
  );
}

/**
 * Dev-only: rewrite committed hit-zone catalog from admin calibrations.
 * POST JSON: Record<BirdSpriteId, ZoneBody> (full or partial — missing ids keep file defaults skipped).
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

  // Require a complete map so the catalog never drops a sprite.
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
 * Auto-generated ${new Date().toISOString()} — do not hand-edit unless needed.
 */

import type { BirdSpriteId } from "@/lib/hunt/birdSprites";

export type BirdHitZone = {
  vitalCxPx: number;
  vitalCyPx: number;
  instantDiameterMm: number;
  vitalDiameterMm: number;
};

/**
 * Per-sprite green (instant) / red (vital) zones on the topp sprite.
 * Source of truth for catalogHitZone when no local override exists.
 */
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
