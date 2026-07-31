import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { BirdSpriteId } from "@/lib/hunt/birdSprites";
import { allBirdSpriteIds } from "@/lib/hunt/birdSprites";

/**
 * Dev-only: bake spotting-scene sprite deny-lists into the repo catalog.
 * Body: { denyMap: { [spotImageSrc]: BirdSpriteId[] } }
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Sprite scene-allow bake is disabled in production." },
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

  const raw = (body as { denyMap?: unknown }).denyMap;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json(
      { error: "denyMap object required" },
      { status: 400 },
    );
  }

  const known = new Set(allBirdSpriteIds());
  const cleaned: Record<string, BirdSpriteId[]> = {};
  for (const [spot, ids] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof spot !== "string" || !spot.startsWith("/images/spot/")) continue;
    if (!Array.isArray(ids)) continue;
    const list = ids.filter(
      (id): id is BirdSpriteId =>
        typeof id === "string" && known.has(id as BirdSpriteId),
    );
    if (list.length > 0) cleaned[spot] = [...new Set(list)].sort();
  }

  const entries = Object.keys(cleaned)
    .sort()
    .map((spot) => {
      const ids = cleaned[spot]!.map((id) => `"${id}"`).join(", ");
      return `  ${JSON.stringify(spot)}: [${ids}],`;
    })
    .join("\n");

  const file = `/**
 * Committed deny-list: spotting image → sprite ids that must NOT appear
 * in the random pool for that landscape.
 *
 * Admin «Use in scene» writes browser localStorage first. Use Spotting →
 * «Lagre scene-pool til repo» to overwrite this file, then commit + push.
 *
 * Empty object = all sprites allowed everywhere.
 *
 * Auto-generated ${new Date().toISOString()} — do not hand-edit unless needed.
 */

import type { BirdSpriteId } from "@/lib/hunt/birdSprites";

/** spotImageSrc → denied sprite ids */
export const BIRD_SPRITE_SCENE_ALLOW_CATALOG: Record<
  string,
  BirdSpriteId[]
> = {
${entries}
};
`;

  const target = path.join(
    process.cwd(),
    "src/lib/hunt/birdSpriteSceneAllowCatalog.ts",
  );
  await fs.writeFile(target, file, "utf8");

  return NextResponse.json({
    ok: true,
    path: "src/lib/hunt/birdSpriteSceneAllowCatalog.ts",
    scenes: Object.keys(cleaned).length,
    denyMap: cleaned,
  });
}
