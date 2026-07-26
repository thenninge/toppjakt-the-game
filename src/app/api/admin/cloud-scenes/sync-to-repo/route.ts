import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { authOptions } from "@/lib/auth";
import {
  isCloudSceneAdmin,
  sessionGoogleId,
  type SessionLike,
} from "@/lib/adminAllowlist";
import {
  cloudSyncedImageSrc,
  ensureSpotImageListed,
  formatPerchCatalogEntry,
  upsertPerchCatalog,
} from "@/lib/hunt/sceneAuthoring";
import type { SpotPerch } from "@/lib/hunt/spotPerches";
import { resolveEyesVisible } from "@/lib/hunt/spotBands";
import {
  getSupabaseAdmin,
  hasSupabaseAdminConfig,
} from "@/lib/supabaseAdmin";

function normalizePerches(raw: unknown): SpotPerch[] {
  if (!Array.isArray(raw)) return [];
  const out: SpotPerch[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (
      typeof o.x !== "number" ||
      typeof o.y !== "number" ||
      (o.species !== "tiur" && o.species !== "orrhane") ||
      typeof o.distanceMinM !== "number" ||
      typeof o.distanceMaxM !== "number"
    ) {
      continue;
    }
    const lo = Math.min(o.distanceMinM, o.distanceMaxM);
    const hi = Math.max(o.distanceMinM, o.distanceMaxM);
    out.push({
      id: `p${out.length}`,
      x: Math.round(o.x * 10) / 10,
      y: Math.round(o.y * 10) / 10,
      species: o.species,
      distanceMinM: Math.round(lo),
      distanceMaxM: Math.round(hi),
      eyesVisible: resolveEyesVisible(
        typeof o.eyesVisible === "boolean" ? o.eyesVisible : undefined,
        lo,
        hi,
      ),
      scalePercent:
        typeof o.scalePercent === "number"
          ? Math.max(1, Math.min(200, Math.round(o.scalePercent)))
          : 100,
    });
  }
  return out;
}

/**
 * Dev-only: pull all published cloud scenes into the local repo
 * (`public/images/spot/batchB/cloud/{id}.jpg` + SPOT_PERCHES + SPOT_IMAGES).
 * Idempotent per cloud id. Requires Google allowlist.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Repo-sync er kun tilgjengelig i lokal dev." },
      { status: 403 },
    );
  }

  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json(
      { error: "Supabase er ikke konfigurert" },
      { status: 503 },
    );
  }

  const session = (await getServerSession(authOptions)) as SessionLike;
  const googleId = sessionGoogleId(session);
  if (!googleId || !isCloudSceneAdmin(googleId)) {
    return NextResponse.json(
      {
        error:
          "Logg inn med Google og sørg for at id er i ADMIN_GOOGLE_IDS.",
      },
      { status: 403 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("spot_scenes")
    .select("id, title, image_url, perches, updated_at")
    .eq("status", "published")
    .order("updated_at", { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json(
      { error: `Supabase: ${error.message}` },
      { status: 502 },
    );
  }

  const publicRoot = path.join(process.cwd(), "public");
  const cloudDir = path.join(publicRoot, "images/spot/batchB/cloud");
  await fs.mkdir(cloudDir, { recursive: true });

  const perchesPath = path.join(process.cwd(), "src/lib/hunt/spotPerches.ts");
  const imagesPath = path.join(process.cwd(), "src/lib/hunt/images.ts");
  let perchesFile = await fs.readFile(perchesPath, "utf8");
  let imagesFile = await fs.readFile(imagesPath, "utf8");

  const added: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  const failures: { id: string; error: string }[] = [];

  for (const row of data ?? []) {
    const id = String(row.id);
    const imageUrl = String(row.image_url ?? "");
    const perches = normalizePerches(row.perches);
    if (!imageUrl || perches.length === 0) {
      skipped.push(id);
      continue;
    }

    try {
      const imageSrc = cloudSyncedImageSrc(id);
      const existed = perchesFile.includes(`"${imageSrc}"`);

      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) {
        throw new Error(`Download HTTP ${imgRes.status}`);
      }
      const buf = Buffer.from(await imgRes.arrayBuffer());
      if (buf.length < 100) throw new Error("Empty image");

      const abs = path.join(publicRoot, imageSrc.replace(/^\//, ""));
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, buf);

      const entry = formatPerchCatalogEntry(imageSrc, perches);
      perchesFile = upsertPerchCatalog(perchesFile, imageSrc, entry);
      imagesFile = ensureSpotImageListed(imagesFile, imageSrc);

      if (existed) updated.push(imageSrc);
      else added.push(imageSrc);
    } catch (err) {
      failures.push({
        id,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  await fs.writeFile(perchesPath, perchesFile, "utf8");
  await fs.writeFile(imagesPath, imagesFile, "utf8");

  return NextResponse.json({
    ok: true,
    added: added.length,
    updated: updated.length,
    skipped: skipped.length,
    failed: failures.length,
    addedPaths: added,
    updatedPaths: updated,
    failures,
    hint: "Commit + push endringene i spotPerches.ts, images.ts og public/images/spot/batchB/cloud/",
  });
}
