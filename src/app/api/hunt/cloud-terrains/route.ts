import { NextResponse } from "next/server";
import type { CloudHuntTerrain } from "@/lib/hunt/cloudTerrains";
import type { MapBirdSeat } from "@/lib/hunt/mapPlacements";
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
      xPct: o.xPct,
      yPct: o.yPct,
      row: o.row,
      col: o.col,
    });
  }
  return out;
}

/**
 * GET /api/hunt/cloud-terrains — published terrains (public).
 */
export async function GET() {
  try {
    if (!hasSupabaseAdminConfig()) {
      return NextResponse.json({ terrains: [] as CloudHuntTerrain[] });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("hunt_terrains")
      .select(
        "id, title, region_hint, image_url, cols, rows, start_cell, aware_map_max_m, seats, updated_at",
      )
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("GET /api/hunt/cloud-terrains", error);
      return NextResponse.json(
        { error: error.message, terrains: [] },
        { status: 502 },
      );
    }

    const terrains: CloudHuntTerrain[] = (data ?? []).map((row) => {
      const cols = Math.max(2, Math.round(Number(row.cols) || 7));
      const rows = Math.max(2, Math.round(Number(row.rows) || 6));
      const startRaw =
        row.start_cell && typeof row.start_cell === "object"
          ? (row.start_cell as { row?: number; col?: number })
          : {};
      return {
        id: String(row.id),
        title: typeof row.title === "string" ? row.title : "",
        regionHint:
          typeof row.region_hint === "string" ? row.region_hint : "",
        imageUrl: String(row.image_url),
        cols,
        rows,
        start: {
          row: Math.max(0, Math.min(rows - 1, Math.round(Number(startRaw.row) || 0))),
          col: Math.max(0, Math.min(cols - 1, Math.round(Number(startRaw.col) || 0))),
        },
        awareMapMaxM:
          row.aware_map_max_m == null
            ? null
            : Number(row.aware_map_max_m),
        seats: normalizeSeats(row.seats),
        updatedAt:
          typeof row.updated_at === "string" ? row.updated_at : undefined,
      };
    });

    return NextResponse.json({ terrains });
  } catch (err) {
    console.error("GET /api/hunt/cloud-terrains", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Server error",
        terrains: [],
      },
      { status: 500 },
    );
  }
}
