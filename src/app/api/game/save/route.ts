import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";
import {
  getSupabaseAdmin,
  hasSupabaseAdminConfig,
} from "@/lib/supabaseAdmin";
import {
  normalizePlayerStats,
  SAVE_VERSION,
  type PlayerSaveV1,
} from "@/lib/playerSave";

type SessionLike = {
  user?: {
    googleId?: string;
    email?: string | null;
    name?: string | null;
  };
} | null;

function sessionGoogleId(session: SessionLike): string | null {
  if (!session?.user) return null;
  const id = session.user.googleId || session.user.email;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/** Ensure Aware `users` row exists for this Google identity. */
async function ensureAwareUser(googleId: string, email: string | null | undefined, name: string | null | undefined) {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: fetchError } = await supabase
    .from("users")
    .select("google_id")
    .eq("google_id", googleId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(`users lookup: ${fetchError.message}`);
  }
  if (existing) return;

  const { error: insertError } = await supabase.from("users").insert({
    google_id: googleId,
    email: email || "",
    display_name: name || email || googleId,
    nickname: null,
  });
  if (insertError) {
    // Race: another request created the row.
    if (insertError.code === "23505") return;
    throw new Error(`users insert: ${insertError.message}`);
  }
}

/**
 * GET /api/game/save — cloud save for the signed-in Google user.
 * Response: `{ save: PlayerSaveV1 | null }`
 */
export async function GET() {
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await ensureAwareUser(googleId, session?.user?.email, session?.user?.name);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("game_saves")
      .select("stats, updated_at")
      .eq("google_id", googleId)
      .maybeSingle();

    if (error) {
      console.error("GET /api/game/save", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ save: null });
    }

    const updatedAtMs = data.updated_at
      ? Date.parse(data.updated_at)
      : Date.now();
    const save: PlayerSaveV1 = {
      version: SAVE_VERSION,
      savedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : Date.now(),
      stats: normalizePlayerStats(data.stats),
    };
    return NextResponse.json({ save });
  } catch (err) {
    console.error("GET /api/game/save", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/game/save — upsert cloud save.
 * Body: `{ stats: PlayerStats, savedAtMs?: number }`
 */
export async function PUT(request: NextRequest) {
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body == null ||
      !("stats" in body) ||
      (body as { stats: unknown }).stats == null
    ) {
      return NextResponse.json(
        { error: "Body må inneholde stats" },
        { status: 400 },
      );
    }

    const stats = normalizePlayerStats((body as { stats: unknown }).stats);
    const savedAtMsRaw = (body as { savedAtMs?: unknown }).savedAtMs;
    const savedAtMs =
      typeof savedAtMsRaw === "number" && Number.isFinite(savedAtMsRaw)
        ? savedAtMsRaw
        : Date.now();
    const updatedAt = new Date(savedAtMs).toISOString();

    await ensureAwareUser(googleId, session?.user?.email, session?.user?.name);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("game_saves")
      .upsert(
        {
          google_id: googleId,
          stats,
          updated_at: updatedAt,
        },
        { onConflict: "google_id" },
      )
      .select("stats, updated_at")
      .single();

    if (error) {
      console.error("PUT /api/game/save", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const save: PlayerSaveV1 = {
      version: SAVE_VERSION,
      savedAtMs: Date.parse(data.updated_at) || savedAtMs,
      stats: normalizePlayerStats(data.stats),
    };
    return NextResponse.json({ save });
  } catch (err) {
    console.error("PUT /api/game/save", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/game/save — remove cloud save for the signed-in user.
 */
export async function DELETE() {
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("game_saves")
      .delete()
      .eq("google_id", googleId);

    if (error) {
      console.error("DELETE /api/game/save", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/game/save", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
