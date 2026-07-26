import { NextResponse } from "next/server";
import {
  getSupabaseAdmin,
  hasSupabaseAdminConfig,
} from "@/lib/supabaseAdmin";
import type { CloudSpotScene } from "@/lib/hunt/cloudScenes";

/**
 * GET /api/spot/cloud-scenes — published scenes for the spot pool (public).
 */
export async function GET() {
  try {
    if (!hasSupabaseAdminConfig()) {
      return NextResponse.json({ scenes: [] as CloudSpotScene[] });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("spot_scenes")
      .select("id, title, image_url, perches, updated_at")
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("GET /api/spot/cloud-scenes", error);
      return NextResponse.json(
        { error: error.message, scenes: [] },
        { status: 502 },
      );
    }

    const scenes: CloudSpotScene[] = (data ?? []).map((row) => ({
      id: String(row.id),
      title: typeof row.title === "string" ? row.title : "",
      imageUrl: String(row.image_url),
      perches: Array.isArray(row.perches) ? row.perches : [],
      updatedAt:
        typeof row.updated_at === "string" ? row.updated_at : undefined,
    }));

    return NextResponse.json({ scenes });
  } catch (err) {
    console.error("GET /api/spot/cloud-scenes", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Server error",
        scenes: [],
      },
      { status: 500 },
    );
  }
}
