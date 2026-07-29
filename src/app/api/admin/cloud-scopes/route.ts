import {
  CLOUD_SCOPE_PACK_MAX_BYTES,
  parseScopePack,
  SCOPE_PACKS_BUCKET,
  type ScopePack,
} from "@/lib/optics/scopePack";
import {
  getSupabaseAdmin,
  hasSupabaseAdminConfig,
} from "@/lib/supabaseAdmin";
import {
  isCloudSceneAdmin,
  sessionGoogleId,
  type SessionLike,
} from "@/lib/adminAllowlist";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";

function publicObjectUrl(imagePath: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  return `${base}/storage/v1/object/public/${SCOPE_PACKS_BUCKET}/${imagePath}`;
}

export type CloudScopePackRow = {
  id: string;
  title: string;
  scope_id: string;
  pack: ScopePack;
  image_path: string | null;
  image_url: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

/**
 * GET /api/admin/cloud-scopes
 * List published scope packs + canPublish flag.
 */
export async function GET() {
  const session = (await getServerSession(authOptions)) as SessionLike;
  const googleId = sessionGoogleId(session);
  const canPublish = isCloudSceneAdmin(googleId);

  if (!hasSupabaseAdminConfig()) {
    return NextResponse.json({
      ok: true,
      canPublish,
      packs: [] as CloudScopePackRow[],
      error: "Supabase er ikke konfigurert",
    });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("scope_packs")
      .select(
        "id, title, scope_id, pack, image_path, image_url, created_by, created_at, updated_at",
      )
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) {
      return NextResponse.json(
        { ok: false, canPublish, packs: [], error: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      canPublish,
      packs: (data ?? []) as CloudScopePackRow[],
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        canPublish,
        packs: [],
        error: err instanceof Error ? err.message : "Cloud list failed",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/cloud-scopes
 * Body: ScopePack JSON (with optional image.base64 PNG).
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
        { error: "Logg inn med Google for å publisere scope-packs." },
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

    const pack = parseScopePack(body);
    if ("error" in pack) {
      return NextResponse.json({ error: pack.error }, { status: 400 });
    }

    let imagePath: string | null = null;
    let imageUrl: string | null = null;
    const id = crypto.randomUUID();

    if (pack.image?.base64) {
      const buf = Buffer.from(pack.image.base64, "base64");
      if (buf.length === 0 || buf.length > CLOUD_SCOPE_PACK_MAX_BYTES) {
        return NextResponse.json(
          {
            error: `Reticle PNG must be under ${Math.round(CLOUD_SCOPE_PACK_MAX_BYTES / (1024 * 1024))} MB`,
          },
          { status: 400 },
        );
      }
      if (buf[0] !== 0x89 || buf[1] !== 0x50) {
        return NextResponse.json(
          { error: "Only PNG reticle images accepted" },
          { status: 400 },
        );
      }
      imagePath = `published/${id}.png`;
      imageUrl = publicObjectUrl(imagePath);
      const supabase = getSupabaseAdmin();
      const { error: uploadError } = await supabase.storage
        .from(SCOPE_PACKS_BUCKET)
        .upload(imagePath, buf, {
          contentType: "image/png",
          upsert: false,
        });
      if (uploadError) {
        return NextResponse.json(
          { error: uploadError.message },
          { status: 500 },
        );
      }
      // Point pack at cloud URL for consumers; keep base64 out of DB row size.
      if (pack.reticle) {
        pack.reticle = { ...pack.reticle, src: imageUrl };
      }
      pack.image = {
        ...pack.image,
        base64: "",
        bytes: buf.length,
        filename: pack.image.filename,
      };
    }

    const supabase = getSupabaseAdmin();
    const row = {
      id,
      title: pack.title.slice(0, 120),
      scope_id: pack.shopItem.id,
      pack,
      image_path: imagePath,
      image_url: imageUrl,
      created_by: googleId,
      status: "published",
      updated_at: new Date().toISOString(),
    };
    const { error: insertError } = await supabase
      .from("scope_packs")
      .insert(row);
    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      id,
      scopeId: pack.shopItem.id,
      title: pack.title,
      imageUrl,
      bytes: pack.image?.bytes ?? 0,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to publish scope pack",
      },
      { status: 500 },
    );
  }
}
