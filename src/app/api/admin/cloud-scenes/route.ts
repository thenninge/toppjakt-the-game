import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  isCloudSceneAdmin,
  sessionGoogleId,
  type SessionLike,
} from "@/lib/adminAllowlist";
import { CLOUD_SCENE_MAX_BYTES } from "@/lib/hunt/cloudScenes";
import {
  getSupabaseAdmin,
  hasSupabaseAdminConfig,
} from "@/lib/supabaseAdmin";
import type { SpotPerch } from "@/lib/hunt/spotPerches";
import { resolveEyesVisible } from "@/lib/hunt/spotBands";
import { sanitizePerchSpriteId } from "@/lib/hunt/sceneAuthoring";

export const SPOT_SCENES_BUCKET = "spot-scenes";

type PerchBody = {
  x: number;
  y: number;
  species: "tiur" | "orrhane";
  distanceMinM: number;
  distanceMaxM: number;
  eyesVisible?: boolean;
  scalePercent?: number;
  spriteId?: string;
  id?: string;
};

function isPerch(v: unknown): v is PerchBody {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.x === "number" &&
    typeof o.y === "number" &&
    (o.species === "tiur" || o.species === "orrhane") &&
    typeof o.distanceMinM === "number" &&
    typeof o.distanceMaxM === "number"
  );
}

function normalizePerches(raw: PerchBody[]): SpotPerch[] {
  return raw.map((p, i) => {
    const lo = Math.min(p.distanceMinM, p.distanceMaxM);
    const hi = Math.max(p.distanceMinM, p.distanceMaxM);
    const spriteId = sanitizePerchSpriteId(p.species, p.spriteId);
    return {
      id: `p${i}`,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      species: p.species,
      distanceMinM: Math.round(lo),
      distanceMaxM: Math.round(hi),
      eyesVisible: resolveEyesVisible(p.eyesVisible, lo, hi),
      scalePercent:
        typeof p.scalePercent === "number"
          ? Math.max(1, Math.min(200, Math.round(p.scalePercent)))
          : 100,
      ...(spriteId ? { spriteId } : {}),
    };
  });
}

function publicObjectUrl(imagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return `${base}/storage/v1/object/public/${SPOT_SCENES_BUCKET}/${imagePath}`;
}

/**
 * POST /api/admin/cloud-scenes
 * Body JSON: { title?, imageBase64, perches: [...] }
 * Requires Google session + ADMIN_GOOGLE_IDS allowlist.
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
        { error: "Logg inn med Google for å publisere scener." },
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
    const rawPerches = o.perches;
    if (!Array.isArray(rawPerches) || rawPerches.length === 0) {
      return NextResponse.json(
        { error: "perches array required (at least one)" },
        { status: 400 },
      );
    }
    if (!rawPerches.every(isPerch)) {
      return NextResponse.json(
        { error: "Invalid perch entries" },
        { status: 400 },
      );
    }
    const perches = normalizePerches(rawPerches);

    const imageBase64 =
      typeof o.imageBase64 === "string" ? o.imageBase64 : null;
    if (!imageBase64 || imageBase64.length < 32) {
      return NextResponse.json(
        { error: "imageBase64 required (JPEG after client compress)" },
        { status: 400 },
      );
    }

    let buf: Buffer;
    try {
      buf = Buffer.from(imageBase64, "base64");
    } catch {
      return NextResponse.json({ error: "Invalid base64" }, { status: 400 });
    }
    if (buf.length === 0 || buf.length > CLOUD_SCENE_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Image must be under ${Math.round(CLOUD_SCENE_MAX_BYTES / (1024 * 1024))} MB after compression`,
        },
        { status: 400 },
      );
    }
    // JPEG SOI
    if (buf[0] !== 0xff || buf[1] !== 0xd8) {
      return NextResponse.json(
        { error: "Only JPEG uploads accepted (compress on client first)" },
        { status: 400 },
      );
    }

    const title =
      typeof o.title === "string" ? o.title.trim().slice(0, 120) : "";

    const id = crypto.randomUUID();
    const imagePath = `published/${id}.jpg`;
    const imageUrl = publicObjectUrl(imagePath);

    const supabase = getSupabaseAdmin();
    const { error: uploadError } = await supabase.storage
      .from(SPOT_SCENES_BUCKET)
      .upload(imagePath, buf, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("cloud-scenes upload", uploadError);
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 502 },
      );
    }

    const { data: row, error: insertError } = await supabase
      .from("spot_scenes")
      .insert({
        id,
        title,
        image_path: imagePath,
        image_url: imageUrl,
        perches,
        created_by: googleId,
        status: "published",
      })
      .select("id, title, image_url, perches, updated_at")
      .single();

    if (insertError) {
      console.error("cloud-scenes insert", insertError);
      // Best-effort cleanup
      await supabase.storage.from(SPOT_SCENES_BUCKET).remove([imagePath]);
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
      perches: Array.isArray(row.perches) ? row.perches.length : perches.length,
      bytes: buf.length,
    });
  } catch (err) {
    console.error("POST /api/admin/cloud-scenes", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/admin/cloud-scenes — whether current user can publish.
 */
export async function GET() {
  const session = (await getServerSession(authOptions)) as SessionLike;
  const googleId = sessionGoogleId(session);
  return NextResponse.json({
    signedIn: !!googleId,
    canPublish: isCloudSceneAdmin(googleId),
    googleId: googleId ?? null,
  });
}
