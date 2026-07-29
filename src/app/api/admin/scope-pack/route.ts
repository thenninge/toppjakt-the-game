import { NextResponse, type NextRequest } from "next/server";
import { parseScopePack } from "@/lib/optics/scopePack";
import { bakeScopePackToRepo } from "@/lib/optics/scopePackBake";

/**
 * Dev-only: bake a scope pack (shop item + reticle + optional PNG) into
 * catalog.ts / reticles.ts / public/range/reticles/.
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Scope pack bake is disabled in production." },
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

  try {
    const result = await bakeScopePackToRepo(pack);
    return NextResponse.json({
      ...result,
      hint: "Commit + push. Refresh Admin Office to pick up the new scope.",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to bake scope pack",
      },
      { status: 500 },
    );
  }
}
