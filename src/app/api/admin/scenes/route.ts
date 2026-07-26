import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  ensureSpotImageListed,
  formatPerchCatalogEntry,
  maxBatchBSpottingIndex,
  nextBatchBSpottingPath,
  upsertPerchCatalog,
} from "@/lib/hunt/sceneAuthoring";
import type { SpotPerch } from "@/lib/hunt/spotPerches";
import { resolveEyesVisible } from "@/lib/hunt/spotBands";

type PerchBody = {
  x: number;
  y: number;
  species: "tiur" | "orrhane";
  distanceMinM: number;
  distanceMaxM: number;
  eyesVisible?: boolean;
  scalePercent?: number;
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
    };
  });
}

/**
 * Dev-only: bake a spotting scene (image + perches) into the repo.
 * Body: { imageSrc?, imageBase64?, imageExt?, perches: [...] }
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Scene bake is disabled in production." },
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

  const o = body as Record<string, unknown>;
  const rawPerches = o.perches;
  if (!Array.isArray(rawPerches) || rawPerches.length === 0) {
    return NextResponse.json(
      { error: "perches array required (at least one)" },
      { status: 400 },
    );
  }
  if (!rawPerches.every(isPerch)) {
    return NextResponse.json({ error: "Invalid perch entries" }, { status: 400 });
  }
  const perches = normalizePerches(rawPerches);

  const publicRoot = path.join(process.cwd(), "public");
  const batchDir = path.join(publicRoot, "images/spot/batchB");

  let imageSrc =
    typeof o.imageSrc === "string" && o.imageSrc.startsWith("/images/spot/")
      ? o.imageSrc
      : "";

  const imageBase64 =
    typeof o.imageBase64 === "string" ? o.imageBase64 : null;
  const imageExtRaw =
    typeof o.imageExt === "string" ? o.imageExt.toLowerCase() : "png";
  const imageExt =
    imageExtRaw === "jpg" || imageExtRaw === "jpeg"
      ? "jpg"
      : imageExtRaw === "webp"
        ? "webp"
        : "png";

  if (imageBase64) {
    await fs.mkdir(batchDir, { recursive: true });
    let diskPaths: string[] = [];
    try {
      const names = await fs.readdir(batchDir);
      diskPaths = names
        .filter((n) => /^spotting\d+b\./i.test(n))
        .map((n) => `/images/spot/batchB/${n}`);
    } catch {
      diskPaths = [];
    }

    const needsNewName =
      !imageSrc ||
      imageSrc.startsWith("blob:") ||
      imageSrc.startsWith("data:");
    if (needsNewName) {
      const catalogNext = nextBatchBSpottingPath(diskPaths);
      const catalogN = Number(catalogNext.match(/spotting(\d+)b/)?.[1] ?? 1);
      const diskMax = maxBatchBSpottingIndex(diskPaths);
      const useN = Math.max(catalogN, diskMax + 1);
      const ext = imageExt === "jpg" ? "jpg" : imageExt;
      imageSrc = `/images/spot/batchB/spotting${useN}b.${ext}`;
    }

    const rel = imageSrc.replace(/^\//, "");
    const abs = path.join(publicRoot, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    const buf = Buffer.from(imageBase64, "base64");
    await fs.writeFile(abs, buf);
  }

  if (!imageSrc || !imageSrc.startsWith("/images/spot/")) {
    return NextResponse.json(
      { error: "imageSrc required (or imageBase64 for new upload)" },
      { status: 400 },
    );
  }

  const entry = formatPerchCatalogEntry(imageSrc, perches);
  const perchesPath = path.join(
    process.cwd(),
    "src/lib/hunt/spotPerches.ts",
  );
  const imagesPath = path.join(process.cwd(), "src/lib/hunt/images.ts");

  let perchesFile = await fs.readFile(perchesPath, "utf8");
  perchesFile = upsertPerchCatalog(perchesFile, imageSrc, entry);
  await fs.writeFile(perchesPath, perchesFile, "utf8");

  let imagesFile = await fs.readFile(imagesPath, "utf8");
  imagesFile = ensureSpotImageListed(imagesFile, imageSrc);
  await fs.writeFile(imagesPath, imagesFile, "utf8");

  return NextResponse.json({
    ok: true,
    imageSrc,
    perches: perches.length,
    pathPerches: "src/lib/hunt/spotPerches.ts",
    pathImages: "src/lib/hunt/images.ts",
  });
}
