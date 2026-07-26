/**
 * Client-side image compression for cloud scene uploads (no sharp on server).
 */

import {
  CLOUD_SCENE_JPEG_QUALITY,
  CLOUD_SCENE_MAX_BYTES,
  CLOUD_SCENE_MAX_EDGE_PX,
} from "@/lib/hunt/cloudScenes";

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
      reject(new Error("Klarte ikke å lese bildet"));
    };
    img.src = url;
  });
}

/**
 * Resize (max edge) + JPEG encode. Throws if still over size limit.
 */
export async function compressImageForCloudScene(
  source: Blob,
): Promise<{ blob: Blob; base64: string; bytes: number }> {
  const img = await loadImageFromBlob(source);
  const w0 = img.naturalWidth || img.width;
  const h0 = img.naturalHeight || img.height;
  if (w0 < 8 || h0 < 8) {
    throw new Error("Bildet er for lite");
  }

  const scale = Math.min(1, CLOUD_SCENE_MAX_EDGE_PX / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas utilgjengelig");
  ctx.drawImage(img, 0, 0, w, h);

  let quality = CLOUD_SCENE_JPEG_QUALITY;
  let blob: Blob | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", quality);
    });
    if (blob && blob.size <= CLOUD_SCENE_MAX_BYTES) break;
    quality = Math.max(0.45, quality - 0.1);
  }

  if (!blob || blob.size > CLOUD_SCENE_MAX_BYTES) {
    throw new Error(
      `Bildet ble for stort etter komprimering (${Math.round((blob?.size ?? 0) / 1024)} KB). Prøv et mindre bilde.`,
    );
  }

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const comma = dataUrl.indexOf(",");
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(new Error("Base64-feil"));
    reader.readAsDataURL(blob!);
  });

  return { blob, base64, bytes: blob.size };
}
