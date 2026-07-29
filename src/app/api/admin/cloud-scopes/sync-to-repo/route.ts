import { parseScopePack, SCOPE_PACKS_BUCKET, type ScopePack } from "@/lib/optics/scopePack";
import { bakeScopePackToRepo } from "@/lib/optics/scopePackBake";
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
import { NextResponse } from "next/server";

/**
 * POST /api/admin/cloud-scopes/sync-to-repo
 * Dev-only: pull published cloud scope packs into local catalog/reticles.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Cloud → repo sync is disabled in production." },
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
  if (!googleId) {
    return NextResponse.json({ error: "Logg inn med Google." }, { status: 401 });
  }
  if (!isCloudSceneAdmin(googleId)) {
    return NextResponse.json(
      { error: "Ingen cloud-admin-tilgang (ADMIN_GOOGLE_IDS)." },
      { status: 403 },
    );
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("scope_packs")
    .select("id, title, scope_id, pack, image_path, image_url")
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of data ?? []) {
    try {
      const parsed = parseScopePack(row.pack);
      if ("error" in parsed) {
        failed += 1;
        errors.push(`${row.scope_id}: ${parsed.error}`);
        continue;
      }
      const pack: ScopePack = { ...parsed };

      if (row.image_path && (!pack.image?.base64 || pack.image.base64.length < 32)) {
        const { data: blob, error: dlErr } = await supabase.storage
          .from(SCOPE_PACKS_BUCKET)
          .download(row.image_path);
        if (dlErr || !blob) {
          failed += 1;
          errors.push(`${row.scope_id}: image download failed`);
          continue;
        }
        const buf = Buffer.from(await blob.arrayBuffer());
        pack.image = {
          filename:
            pack.image?.filename ??
            `${pack.shopItem.id.replace(/^scope-/, "")}.png`,
          mime: "image/png",
          base64: buf.toString("base64"),
          bytes: buf.length,
        };
      }

      const result = await bakeScopePackToRepo(pack);
      if (result.created) added += 1;
      else updated += 1;
    } catch (err) {
      failed += 1;
      errors.push(
        `${row.scope_id}: ${err instanceof Error ? err.message : "bake failed"}`,
      );
    }
  }

  if (data?.length === 0) skipped = 0;

  return NextResponse.json({
    ok: true,
    added,
    updated,
    skipped,
    failed,
    errors: errors.slice(0, 8),
    hint: "Commit + push catalog/reticles/PNG changes.",
  });
}
