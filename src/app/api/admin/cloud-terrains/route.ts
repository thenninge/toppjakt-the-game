import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  isCloudSceneAdmin,
  sessionGoogleId,
  type SessionLike,
} from "@/lib/adminAllowlist";
import {
  CLOUD_TERRAIN_MAX_BYTES,
} from "@/lib/hunt/cloudTerrains";
import type { MapBirdSeat } from "@/lib/hunt/mapPlacements";
import {
  getSupabaseAdmin,
  hasSupabaseAdminConfig,
} from "@/lib/supabaseAdmin";

export const HUNT_TERRAINS_BUCKET = "hunt-terrains";

type SeatBody = {
  species: "tiur" | "orrhane";
  xPct: number;
  yPct: number;
  row: number;
  col: number;
};

function isSeat(v: unknown): v is SeatBody {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    (o.species === "tiur" || o.species === "orrhane") &&
    typeof o.xPct === "number" &&
    typeof o.yPct === "number" &&
    typeof o.row === "number" &&
    typeof o.col === "number"
  );
}

function normalizeSeats(raw: SeatBody[]): MapBirdSeat[] {
  return raw.map((s) => ({
    species: s.species,
    xPct: Math.round(Math.min(100, Math.max(0, s.xPct)) * 100) / 100,
    yPct: Math.round(Math.min(100, Math.max(0, s.yPct)) * 100) / 100,
    row: Math.max(0, Math.round(s.row)),
    col: Math.max(0, Math.round(s.col)),
  }));
}

function publicObjectUrl(imagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return `${base}/storage/v1/object/public/${HUNT_TERRAINS_BUCKET}/${imagePath}`;
}

function detectImageMime(
  buf: Buffer,
): { mime: string; ext: "png" | "jpg" } | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e) {
    return { mime: "image/png", ext: "png" };
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  return null;
}

/**
 * POST /api/admin/cloud-terrains
 * Body: { title?, regionHint?, imageBase64, cols, rows, start, awareMapMaxM?, seats }
 */
export async function POST(req: NextRequest) {
  try {
    if (!hasSupabaseAdminConfig()) {
      return NextResponse.json(
        { error: "Supabase er ikke konfigurert" },
        { status: 503 },
      );
    }

    const session = (await getServerSession(authOptions)) as SessionLike;
    const googleId = sessionGoogleId(session);
    if (!googleId) {
      return NextResponse.json(
        { error: "Logg inn med Google for å publisere terreng." },
        { status: 401 },
      );
    }
    if (!isCloudSceneAdmin(googleId)) {
      return NextResponse.json(
        {
          error:
            "Ingen cloud-admin-tilgang. Be eieren legge til Google-id i ADMIN_GOOGLE_IDS.",
        },
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
      return NextResponse.json(
        { error: "Expected object body" },
        { status: 400 },
      );
    }

    const o = body as Record<string, unknown>;
    const cols = Math.round(Number(o.cols));
    const rows = Math.round(Number(o.rows));
    if (!Number.isFinite(cols) || cols < 2 || cols > 24) {
      return NextResponse.json({ error: "cols must be 2–24" }, { status: 400 });
    }
    if (!Number.isFinite(rows) || rows < 2 || rows > 24) {
      return NextResponse.json({ error: "rows must be 2–24" }, { status: 400 });
    }

    const startRaw = o.start;
    if (!startRaw || typeof startRaw !== "object") {
      return NextResponse.json({ error: "start {row,col} required" }, { status: 400 });
    }
    const startObj = startRaw as Record<string, unknown>;
    const start = {
      row: Math.max(0, Math.min(rows - 1, Math.round(Number(startObj.row)))),
      col: Math.max(0, Math.min(cols - 1, Math.round(Number(startObj.col)))),
    };
    if (![start.row, start.col].every((n) => Number.isFinite(n))) {
      return NextResponse.json({ error: "Invalid start cell" }, { status: 400 });
    }

    const rawSeats = o.seats;
    if (!Array.isArray(rawSeats)) {
      return NextResponse.json({ error: "seats array required" }, { status: 400 });
    }
    if (!rawSeats.every(isSeat)) {
      return NextResponse.json({ error: "Invalid seat entries" }, { status: 400 });
    }
    const seats = normalizeSeats(rawSeats);

    const imageBase64 =
      typeof o.imageBase64 === "string" ? o.imageBase64 : null;
    if (!imageBase64 || imageBase64.length < 32) {
      return NextResponse.json(
        { error: "imageBase64 required (PNG/JPEG after client compress)" },
        { status: 400 },
      );
    }

    let buf: Buffer;
    try {
      buf = Buffer.from(imageBase64, "base64");
    } catch {
      return NextResponse.json({ error: "Invalid base64" }, { status: 400 });
    }
    if (buf.length === 0 || buf.length > CLOUD_TERRAIN_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Image must be under ${Math.round(CLOUD_TERRAIN_MAX_BYTES / (1024 * 1024))} MB after compression`,
        },
        { status: 400 },
      );
    }
    const detected = detectImageMime(buf);
    if (!detected) {
      return NextResponse.json(
        { error: "Only PNG or JPEG uploads accepted" },
        { status: 400 },
      );
    }

    const title =
      typeof o.title === "string" ? o.title.trim().slice(0, 120) : "";
    const regionHint =
      typeof o.regionHint === "string" ? o.regionHint.trim().slice(0, 80) : "";
    const awareRaw = o.awareMapMaxM;
    const awareMapMaxM =
      awareRaw == null || awareRaw === ""
        ? null
        : Math.max(50, Math.round(Number(awareRaw)));
    if (awareMapMaxM != null && !Number.isFinite(awareMapMaxM)) {
      return NextResponse.json(
        { error: "Invalid awareMapMaxM" },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    const imagePath = `published/${id}.${detected.ext}`;
    const imageUrl = publicObjectUrl(imagePath);

    const supabase = getSupabaseAdmin();
    const { error: uploadError } = await supabase.storage
      .from(HUNT_TERRAINS_BUCKET)
      .upload(imagePath, buf, {
        contentType: detected.mime,
        upsert: false,
      });

    if (uploadError) {
      console.error("cloud-terrains upload", uploadError);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 502 },
      );
    }

    const { data: row, error: insertError } = await supabase
      .from("hunt_terrains")
      .insert({
        id,
        title,
        region_hint: regionHint,
        image_path: imagePath,
        image_url: imageUrl,
        cols,
        rows,
        start_cell: start,
        aware_map_max_m: awareMapMaxM,
        seats,
        created_by: googleId,
        status: "published",
      })
      .select("id, title, image_url, seats, updated_at")
      .single();

    if (insertError) {
      console.error("cloud-terrains insert", insertError);
      await supabase.storage.from(HUNT_TERRAINS_BUCKET).remove([imagePath]);
      return NextResponse.json(
        { error: `DB insert failed: ${insertError.message}` },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      id: row.id,
      title: row.title,
      imageUrl: row.image_url,
      seats: Array.isArray(row.seats) ? row.seats.length : seats.length,
      bytes: buf.length,
      ext: detected.ext,
    });
  } catch (err) {
    console.error("POST /api/admin/cloud-terrains", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}

/** GET /api/admin/cloud-terrains — whether current user can publish. */
export async function GET() {
  const session = (await getServerSession(authOptions)) as SessionLike;
  const googleId = sessionGoogleId(session);
  return NextResponse.json({
    signedIn: !!googleId,
    canPublish: isCloudSceneAdmin(googleId),
    googleId: googleId ?? null,
  });
}
