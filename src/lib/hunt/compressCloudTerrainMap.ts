/**
 * Client-side map compression for cloud hunt-terrain uploads.
 * Prefers PNG (map art); falls back to JPEG if PNG exceeds size budget.
 */

import {
  CLOUD_TERRAIN_MAX_BYTES,
  CLOUD_TERRAIN_MAX_EDGE_PX,
} from "@/lib/hunt/cloudTerrains";

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Klarte ikke å lese kartbildet"));
    };
    img.src = url;
  });
}

export type CompressedTerrainMap = {
  blob: Blob;
  base64: string;
  bytes: number;
  mime: "image/png" | "image/jpeg";
  ext: "png" | "jpg";
};

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const comma = dataUrl.indexOf(",");
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(new Error("Base64-feil"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Resize (max edge) + PNG, or JPEG if still too large.
 */
export async function compressImageForCloudTerrain(
  source: Blob,
): Promise<CompressedTerrainMap> {
  const img = await loadImageFromBlob(source);
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  if (w0 < 32 || h0 < 32) {
    throw new Error("Kartbildet er for lite");
  }

  const scale = Math.min(1, CLOUD_TERRAIN_MAX_EDGE_PX / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas utilgjengelig");
  ctx.drawImage(img, 0, 0, w, h);

  const png = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/png");
  });
  if (png && png.size <= CLOUD_TERRAIN_MAX_BYTES) {
    return {
      blob: png,
      base64: await blobToBase64(png),
      bytes: png.size,
      mime: "image/png",
      ext: "png",
    };
  }

  let quality = 0.92;
  let jpeg: Blob | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    jpeg = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });
    if (jpeg && jpeg.size <= CLOUD_TERRAIN_MAX_BYTES) break;
    quality = Math.max(0.4, quality - 0.08);
  }

  if (!jpeg || jpeg.size > CLOUD_TERRAIN_MAX_BYTES) {
    throw new Error(
      `Kartbildet ble for stort etter komprimering (${Math.round((jpeg?.size ?? png?.size ?? 0) / 1024)} KB). Prøv et mindre screenshot.`,
    );
  }

  return {
    blob: jpeg,
    base64: await blobToBase64(jpeg),
    bytes: jpeg.size,
    mime: "image/jpeg",
    ext: "jpg",
  };
}
