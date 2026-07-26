import { NextResponse, type NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import {
  formatPerchCatalogEntry,
  maxBatchBSpottingIndex,
  nextBatchBSpottingPath,
} from "@/lib/hunt/sceneAuthoring";
import type { SpotPerch } from "@/lib/hunt/spotPerches";

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
      eyesVisible: p.eyesVisible !== false,
      scalePercent:
        typeof p.scalePercent === "number"
          ? Math.max(1, Math.min(200, Math.round(p.scalePercent)))
          : 100,
    };
  });
}

/**
 * Replace or insert a `"path": [ ... ]` entry inside SPOT_PERCHES = { ... };
 */
function upsertPerchCatalog(file: string, imageSrc: string, entry: string): string {
  const key = `"${imageSrc}"`;
  const keyIdx = file.indexOf(key);
  if (keyIdx >= 0) {
    const afterKey = file.indexOf("[", keyIdx);
    if (afterKey < 0) throw new Error("Malformed SPOT_PERCHES entry");
    let depth = 0;
    let end = -1;
    for (let i = afterKey; i < file.length; i++) {
      const ch = file[i];
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) throw new Error("Unclosed perch array");
    // Include from start of key through closing ]
    const start = file.lastIndexOf("\n", keyIdx);
    const sliceStart = start >= 0 ? start + 1 : keyIdx;
    let sliceEnd = end + 1;
    if (file[sliceEnd] === ",") sliceEnd++;
    const before = file.slice(0, sliceStart);
    const after = file.slice(sliceEnd);
    const needsComma = after.trimStart().startsWith('"') || after.trimStart().startsWith("/");
    return `${before}${entry}${needsComma || after.includes('"') ? "," : ""}${after}`;
  }

  // Insert before closing `};` of SPOT_PERCHES
  const marker = "\n};\n\nexport function perchesForSpotImage";
  const at = file.indexOf(marker);
  if (at < 0) {
    throw new Error("Could not find SPOT_PERCHES end marker");
  }
  // Ensure previous entry has trailing comma
  let insertAt = at;
  const before = file.slice(0, insertAt).replace(/\s+$/, "");
  const needsComma = !before.endsWith(",") && !before.endsWith("{");
  return `${before}${needsComma ? "," : ""}\n${entry}${marker}${file.slice(at + marker.length)}`;
}

function ensureSpotImageListed(file: string, imageSrc: string): string {
  if (file.includes(`"${imageSrc}"`)) return file;
  const marker = "\n];\n\n/**\n * Hand-composited spot photo";
  const at = file.indexOf(marker);
  if (at < 0) {
    // fallback: end of SPOT_IMAGES array
    const alt = file.indexOf("\n];\n\nexport const SPOT_TEST_IMAGE");
    if (alt < 0) throw new Error("Could not find SPOT_IMAGES end");
    const before = file.slice(0, alt).replace(/\s+$/, "");
    const needsComma = !before.endsWith(",");
    return `${before}${needsComma ? "," : ""}\n  "${imageSrc}",${file.slice(alt)}`;
  }
  const before = file.slice(0, at).replace(/\s+$/, "");
  const needsComma = !before.endsWith(",");
  return `${before}${needsComma ? "," : ""}\n  "${imageSrc}",${marker}${file.slice(at + marker.length)}`;
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
