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
import type { MapBirdSeat } from "@/lib/hunt/mapPlacements";
import {
  cloudSyncedMapSrc,
  cloudTerrainCatalogId,
  formatCloudHuntMapsCatalog,
  type CloudCatalogEntry,
} from "@/lib/hunt/terrainAuthoring";
import {
  getSupabaseAdmin,
  hasSupabaseAdminConfig,
} from "@/lib/supabaseAdmin";

function normalizeSeats(raw: unknown): MapBirdSeat[] {
  if (!Array.isArray(raw)) return [];
  const out: MapBirdSeat[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (
      (o.species !== "tiur" && o.species !== "orrhane") ||
      typeof o.xPct !== "number" ||
      typeof o.yPct !== "number" ||
      typeof o.row !== "number" ||
      typeof o.col !== "number"
    ) {
      continue;
    }
    out.push({
      species: o.species,
      xPct: Math.round(o.xPct * 100) / 100,
      yPct: Math.round(o.yPct * 100) / 100,
      row: Math.max(0, Math.round(o.row)),
      col: Math.max(0, Math.round(o.col)),
    });
  }
  return out;
}

function parseStart(
  raw: unknown,
  cols: number,
  rows: number,
): { row: number; col: number } {
  if (!raw || typeof raw !== "object") return { row: 0, col: 0 };
  const o = raw as Record<string, unknown>;
  return {
    row: Math.max(0, Math.min(rows - 1, Math.round(Number(o.row) || 0))),
    col: Math.max(0, Math.min(cols - 1, Math.round(Number(o.col) || 0))),
  };
}

/**
 * Dev-only: pull published cloud terrains into local repo
 * (`public/maps/cloud/{id}.png` + cloudHuntMapsCatalog.ts).
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
    .from("hunt_terrains")
    .select(
      "id, title, region_hint, image_url, image_path, cols, rows, start_cell, aware_map_max_m, seats, updated_at",
    )
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
  const cloudDir = path.join(publicRoot, "maps/cloud");
  await fs.mkdir(cloudDir, { recursive: true });

  const entries: CloudCatalogEntry[] = [];
  const added: string[] = [];
  const updated: string[] = [];
  const skipped: string[] = [];
  const failures: { id: string; error: string }[] = [];

  for (const row of data ?? []) {
    const id = String(row.id);
    const imageUrl = String(row.image_url ?? "");
    if (!imageUrl) {
      skipped.push(id);
      continue;
    }

    try {
      const cols = Math.max(2, Math.round(Number(row.cols) || 7));
      const rows = Math.max(2, Math.round(Number(row.rows) || 6));
      const seats = normalizeSeats(row.seats);
      const start = parseStart(row.start_cell, cols, rows);
      const pathHint = String(row.image_path ?? "");
      const ext: "png" | "jpg" = pathHint.endsWith(".jpg") ? "jpg" : "png";
      const catalogId = cloudTerrainCatalogId(id);
      const imageSrc = cloudSyncedMapSrc(id, ext);

      const imgRes = await fetch(imageUrl);
      if (!imgRes.ok) throw new Error(`Download HTTP ${imgRes.status}`);
      const buf = Buffer.from(await imgRes.arrayBuffer());
      if (buf.length < 100) throw new Error("Empty image");

      const abs = path.join(publicRoot, imageSrc.replace(/^\//, ""));
      const existed = await fs
        .access(abs)
        .then(() => true)
        .catch(() => false);
      await fs.mkdir(path.dirname(abs), { recursive: true });
      await fs.writeFile(abs, buf);

      const awareRaw = row.aware_map_max_m;
      const awareMapMaxM =
        awareRaw == null ? null : Math.round(Number(awareRaw));

      entries.push({
        id: catalogId,
        label:
          typeof row.title === "string" && row.title.trim()
            ? row.title.trim()
            : catalogId,
        regionHint:
          typeof row.region_hint === "string" ? row.region_hint : "Cloud",
        src: imageSrc,
        cols,
        rows,
        start,
        awareMapMaxM:
          awareMapMaxM != null && Number.isFinite(awareMapMaxM)
            ? awareMapMaxM
            : null,
        seats,
      });

      if (existed) updated.push(imageSrc);
      else added.push(imageSrc);
    } catch (err) {
      failures.push({
        id,
        error: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  const catalogPath = path.join(
    process.cwd(),
    "src/lib/hunt/cloudHuntMapsCatalog.ts",
  );
  await fs.writeFile(catalogPath, formatCloudHuntMapsCatalog(entries), "utf8");

  return NextResponse.json({
    ok: true,
    terrains: entries.length,
    added: added.length,
    updated: updated.length,
    skipped: skipped.length,
    failed: failures.length,
    addedPaths: added,
    updatedPaths: updated,
    failures,
    hint: "Commit + push cloudHuntMapsCatalog.ts og public/maps/cloud/",
  });
}
