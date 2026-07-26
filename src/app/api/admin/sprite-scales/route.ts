import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  allBirdSpriteIds,
  spriteIdsForSpecies,
  type BirdSpriteId,
} from "@/lib/hunt/birdSprites";
import type { BirdSpecies } from "@/lib/hunt/birds";
import { BIRD_SPRITE_SCALE_CATALOG } from "@/lib/hunt/birdSpriteScaleCatalog";

const SCALE_MIN = 0;
const SCALE_MAX = 200;

function clampScale(n: number): number {
  if (!Number.isFinite(n)) return 100;
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, Math.round(n)));
}

type BakeBody = {
  species?: "tiur" | "orrhane" | "ugle";
  scales?: Record<string, unknown>;
};

/**
 * Dev-only: rewrite committed sprite-scale catalog from admin calibrations.
 * Body: { species: "tiur" | "orrhane" | "ugle", scales: { [spriteId]: number, ... } }
 * Merges the named species into the full catalog (other species unchanged).
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Sprite-scale bake is disabled in production." },
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

  const { species, scales: incoming } = body as BakeBody;
  if (species !== "tiur" && species !== "orrhane" && species !== "ugle") {
    return NextResponse.json(
      { error: 'species must be "tiur", "orrhane", or "ugle"' },
      { status: 400 },
    );
  }
  if (!incoming || typeof incoming !== "object") {
    return NextResponse.json(
      { error: "scales object required" },
      { status: 400 },
    );
  }

  const ids = spriteIdsForSpecies(species as BirdSpecies);
  const merged: Record<BirdSpriteId, number> = {
    ...BIRD_SPRITE_SCALE_CATALOG,
  };

  // Keep on-disk values for sprites not in this bake (read current file if present).
  try {
    const existingPath = path.join(
      process.cwd(),
      "src/lib/hunt/birdSpriteScaleCatalog.ts",
    );
    const existing = await fs.readFile(existingPath, "utf8");
    for (const id of allBirdSpriteIds()) {
      const m = existing.match(
        new RegExp(`"${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}":\\s*(\\d+)`),
      );
      if (m) merged[id] = clampScale(Number(m[1]));
    }
  } catch {
    /* use import defaults */
  }

  const written: BirdSpriteId[] = [];
  for (const id of ids) {
    const v = incoming[id];
    if (typeof v !== "number") {
      return NextResponse.json(
        { error: `Missing or invalid scale for ${id}` },
        { status: 400 },
      );
    }
    merged[id] = clampScale(v);
    written.push(id);
  }

  const entries = allBirdSpriteIds()
    .map((id) => `  "${id}": ${merged[id]},`)
    .join("\n");

  const file = `/**
 * Committed per-sprite visual scales (1–200 %, default 100).
 *
 * Admin Scale % writes browser localStorage first. Use Spotting / Scopes →
 * «Lagre til repo» (tiur / orre / ugle) to overwrite this file, then commit + push.
 *
 * Auto-generated ${new Date().toISOString()} — do not hand-edit unless needed.
 */

import type { BirdSpriteId } from "@/lib/hunt/birdSprites";

export const BIRD_SPRITE_SCALE_CATALOG: Record<BirdSpriteId, number> = {
${entries}
};
`;

  const target = path.join(
    process.cwd(),
    "src/lib/hunt/birdSpriteScaleCatalog.ts",
  );
  await fs.writeFile(target, file, "utf8");

  return NextResponse.json({
    ok: true,
    path: "src/lib/hunt/birdSpriteScaleCatalog.ts",
    species,
    sprites: written.length,
    scales: Object.fromEntries(written.map((id) => [id, merged[id]])),
  });
}
