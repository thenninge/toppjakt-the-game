import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  CLOUD_HUNT_MAPS,
  CLOUD_MAP_BIRD_SEATS,
} from "@/lib/hunt/cloudHuntMapsCatalog";
import type { HuntGridCell } from "@/lib/hunt/maps";
import type { MapBirdSeat } from "@/lib/hunt/mapPlacements";
import {
  cloudSyncedMapSrc,
  formatCloudHuntMapsCatalog,
  type CloudCatalogEntry,
} from "@/lib/hunt/terrainAuthoring";

type Body = {
  slug?: string;
  title?: string;
  regionHint?: string;
  cols?: number;
  rows?: number;
  start?: HuntGridCell;
  awareMapMaxM?: number | null;
  seats?: unknown;
  imageBase64?: string;
  imageExt?: "png" | "jpg";
};

function normalizeSeats(raw: unknown): MapBirdSeat[] | null {
  if (!Array.isArray(raw)) return null;
  const out: MapBirdSeat[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const o = item as Record<string, unknown>;
    if (
      (o.species !== "tiur" && o.species !== "orrhane") ||
      typeof o.xPct !== "number" ||
      typeof o.yPct !== "number" ||
      typeof o.row !== "number" ||
      typeof o.col !== "number"
    ) {
      return null;
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

function safeSlug(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "")
    .slice(0, 40);
}

/**
 * Dev-only: write a custom / imported terrain into local repo
 * (`public/maps/cloud/{slug}.png` + cloudHuntMapsCatalog.ts).
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Lokal repo-skriving er kun tilgjengelig i lokal dev." },
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

  const b = body as Body;
  const slug = safeSlug(String(b.slug ?? b.title ?? ""));
  if (!slug) {
    return NextResponse.json({ error: "Mangler slug/title" }, { status: 400 });
  }
  if (typeof b.imageBase64 !== "string" || b.imageBase64.length < 100) {
    return NextResponse.json(
      { error: "Mangler kartbilde (imageBase64)" },
      { status: 400 },
    );
  }

  const cols = Math.max(2, Math.round(Number(b.cols) || 7));
  const rows = Math.max(2, Math.round(Number(b.rows) || 6));
  const seats = normalizeSeats(b.seats);
  if (!seats) {
    return NextResponse.json({ error: "Ugyldige seats" }, { status: 400 });
  }
  const start: HuntGridCell = {
    row: Math.max(
      0,
      Math.min(rows - 1, Math.round(Number(b.start?.row) || 0)),
    ),
    col: Math.max(
      0,
      Math.min(cols - 1, Math.round(Number(b.start?.col) || 0)),
    ),
  };
  const awareRaw = b.awareMapMaxM;
  const awareMapMaxM =
    awareRaw == null || !Number.isFinite(Number(awareRaw))
      ? null
      : Math.max(50, Math.round(Number(awareRaw)));

  const ext = b.imageExt === "jpg" ? "jpg" : "png";
  const catalogId = `cloud_${slug}`.slice(0, 48);
  const imageSrc = cloudSyncedMapSrc(slug, ext);

  const buf = Buffer.from(b.imageBase64, "base64");
  if (buf.length < 100) {
    return NextResponse.json({ error: "Tomt bilde" }, { status: 400 });
  }

  const publicRoot = path.join(process.cwd(), "public");
  const abs = path.join(publicRoot, imageSrc.replace(/^\//, ""));
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buf);

  const entry: CloudCatalogEntry = {
    id: catalogId,
    label:
      typeof b.title === "string" && b.title.trim()
        ? b.title.trim()
        : slug,
    regionHint:
      typeof b.regionHint === "string" && b.regionHint.trim()
        ? b.regionHint.trim()
        : "Cloud",
    src: imageSrc,
    cols,
    rows,
    start,
    awareMapMaxM,
    seats,
  };

  const byId = new Map<string, CloudCatalogEntry>();
  for (const [id, map] of Object.entries(CLOUD_HUNT_MAPS)) {
    byId.set(id, {
      id,
      label: map.label,
      regionHint: map.regionHint,
      src: map.src,
      cols: map.cols,
      rows: map.rows,
      start: { ...map.start },
      awareMapMaxM: map.awareMapMaxM ?? null,
      seats: [...(CLOUD_MAP_BIRD_SEATS[id] ?? [])],
    });
  }
  byId.set(catalogId, entry);

  const catalogPath = path.join(
    process.cwd(),
    "src/lib/hunt/cloudHuntMapsCatalog.ts",
  );
  await fs.writeFile(
    catalogPath,
    formatCloudHuntMapsCatalog([...byId.values()]),
    "utf8",
  );

  return NextResponse.json({
    ok: true,
    id: catalogId,
    seats: seats.length,
    paths: [imageSrc.replace(/^\//, "public/"), "src/lib/hunt/cloudHuntMapsCatalog.ts"],
    hint: "Commit + push cloudHuntMapsCatalog.ts og public/maps/cloud/",
  });
}
