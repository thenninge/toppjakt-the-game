/**
 * Portable scope + reticle package for Admin Office export/import
 * (JSON file or Supabase cloud).
 */

import type { ScopeClickUnit, ScopeFocalPlane, ScopeSpec } from "@/lib/optics/spec";
import type { ReticleDef, ReticleIllumination } from "@/lib/range/reticles";
import type { ScopeTubeDiameterMm } from "@/lib/mount/spec";

export const SCOPE_PACK_VERSION = 1 as const;

/** Supabase Storage bucket for reticle PNGs attached to cloud scope packs. */
export const SCOPE_PACKS_BUCKET = "scope-packs";
/** Max PNG size for cloud / bake. */
export const CLOUD_SCOPE_PACK_MAX_BYTES = 8 * 1024 * 1024;

export type ScopePackShopItem = {
  id: string;
  category: "scope";
  brand: string;
  name: string;
  priceNok: number;
  note?: string;
  weightGrams?: number;
  scope: ScopeSpec;
};

export type ScopePackImage = {
  filename: string;
  mime: "image/png";
  /** Raw base64 (no data: URL prefix). */
  base64: string;
  bytes: number;
};

export type ScopePack = {
  version: typeof SCOPE_PACK_VERSION;
  exportedAt: string;
  title: string;
  shopItem: ScopePackShopItem;
  reticle: ReticleDef | null;
  image: ScopePackImage | null;
};

const TUBE_MM: ScopeTubeDiameterMm[] = [25.4, 30, 34, 35, 36];

function isTube(v: unknown): v is ScopeTubeDiameterMm {
  return typeof v === "number" && (TUBE_MM as number[]).includes(v);
}

function isClickUnit(v: unknown): v is ScopeClickUnit {
  return v === "MRAD" || v === "MOA";
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function stripDataUrl(b64: string): string {
  return b64.replace(/^data:image\/\w+;base64,/, "");
}

export function sanitizeScopeId(raw: string): string {
  const base = raw
    .trim()
    .toLowerCase()
    .replace(/^scope-/, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return base ? `scope-${base}` : "";
}

export function sanitizeReticleId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function parseScopePack(raw: unknown): ScopePack | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "Expected JSON object" };
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 && o.version !== SCOPE_PACK_VERSION) {
    return { error: `Unsupported scope pack version: ${String(o.version)}` };
  }
  const shopRaw = o.shopItem;
  if (!shopRaw || typeof shopRaw !== "object") {
    return { error: "shopItem required" };
  }
  const shop = shopRaw as Record<string, unknown>;
  const id = typeof shop.id === "string" ? sanitizeScopeId(shop.id) : "";
  if (!id) return { error: "shopItem.id required (scope-…)" };
  const brand = typeof shop.brand === "string" ? shop.brand.trim() : "";
  const name = typeof shop.name === "string" ? shop.name.trim() : "";
  if (!brand || !name) return { error: "shopItem.brand and name required" };
  if (!isFiniteNumber(shop.priceNok) || shop.priceNok < 0) {
    return { error: "shopItem.priceNok must be a non-negative number" };
  }
  const scopeRaw = shop.scope;
  if (!scopeRaw || typeof scopeRaw !== "object") {
    return { error: "shopItem.scope required" };
  }
  const sc = scopeRaw as Record<string, unknown>;
  if (!isTube(sc.tubeDiameterMm)) {
    return { error: "scope.tubeDiameterMm must be 25.4 / 30 / 34 / 35 / 36" };
  }
  if (!isFiniteNumber(sc.minZoom) || !isFiniteNumber(sc.maxZoom)) {
    return { error: "scope.minZoom / maxZoom required" };
  }
  if (!isClickUnit(sc.clickUnit)) {
    return { error: "scope.clickUnit must be MRAD or MOA" };
  }

  const scope: ScopeSpec = {
    tubeDiameterMm: sc.tubeDiameterMm,
    minZoom: sc.minZoom,
    maxZoom: sc.maxZoom,
    clickUnit: sc.clickUnit,
    clickErrorPercent: isFiniteNumber(sc.clickErrorPercent)
      ? sc.clickErrorPercent
      : 0,
    zeroRetentionInaccuracy: isFiniteNumber(sc.zeroRetentionInaccuracy)
      ? sc.zeroRetentionInaccuracy
      : 0.1,
  };
  if (sc.focalPlane === "FFP" || sc.focalPlane === "SFP") {
    scope.focalPlane = sc.focalPlane as ScopeFocalPlane;
  }
  if (typeof sc.reticleId === "string" && sc.reticleId.trim()) {
    scope.reticleId = sanitizeReticleId(sc.reticleId);
  }
  if (isFiniteNumber(sc.zeroStop)) scope.zeroStop = sc.zeroStop;
  if (isFiniteNumber(sc.elevationUpClicks)) {
    scope.elevationUpClicks = Math.round(sc.elevationUpClicks);
  }
  if (isFiniteNumber(sc.elevationClicksPerRev)) {
    scope.elevationClicksPerRev = Math.round(sc.elevationClicksPerRev);
  }
  if (isFiniteNumber(sc.windageClicksPerRev)) {
    scope.windageClicksPerRev = Math.round(sc.windageClicksPerRev);
  }
  if (isFiniteNumber(sc.zoomMagCal)) scope.zoomMagCal = sc.zoomMagCal;
  if (isFiniteNumber(sc.minZoomMagCal)) scope.minZoomMagCal = sc.minZoomMagCal;
  if (isFiniteNumber(sc.fovDiameterScale)) {
    scope.fovDiameterScale = sc.fovDiameterScale;
  }
  if (typeof sc.focusZoomEnabled === "boolean") {
    scope.focusZoomEnabled = sc.focusZoomEnabled;
  }
  if (isFiniteNumber(sc.focusZoomMultiplier)) {
    scope.focusZoomMultiplier = sc.focusZoomMultiplier;
  }
  if (isFiniteNumber(sc.focusViewportScale)) {
    scope.focusViewportScale = sc.focusViewportScale;
  }
  if (Array.isArray(sc.illuminationColors)) {
    const colors = sc.illuminationColors.filter(
      (c): c is "red" | "green" => c === "red" || c === "green",
    );
    if (colors.length > 0) {
      scope.illuminationColors = [...new Set(colors)];
    }
  }
  if (typeof sc.triggercamZoomRestrict === "boolean") {
    scope.triggercamZoomRestrict = sc.triggercamZoomRestrict;
  }
  if (isFiniteNumber(sc.triggercamMinZoom)) {
    scope.triggercamMinZoom = sc.triggercamMinZoom;
  }
  if (isFiniteNumber(sc.triggercamMaxZoom)) {
    scope.triggercamMaxZoom = sc.triggercamMaxZoom;
  }

  let reticle: ReticleDef | null = null;
  if (o.reticle != null) {
    if (typeof o.reticle !== "object") {
      return { error: "reticle must be an object or null" };
    }
    const r = o.reticle as Record<string, unknown>;
    const rid =
      typeof r.id === "string"
        ? sanitizeReticleId(r.id)
        : scope.reticleId ?? "";
    if (!rid) return { error: "reticle.id required when reticle is set" };
    if (typeof r.src !== "string" || !r.src.trim()) {
      return { error: "reticle.src required" };
    }
    if (!isFiniteNumber(r.nativeWidth) || !isFiniteNumber(r.nativeHeight)) {
      return { error: "reticle.nativeWidth/Height required" };
    }
    if (!isFiniteNumber(r.centerTo1MilPx)) {
      return { error: "reticle.centerTo1MilPx required" };
    }
    reticle = {
      id: rid,
      label:
        typeof r.label === "string" && r.label.trim()
          ? r.label.trim()
          : rid,
      src: r.src.trim(),
      nativeWidth: Math.round(r.nativeWidth),
      nativeHeight: Math.round(r.nativeHeight),
      centerTo1MilPx: r.centerTo1MilPx,
    };
    if (isFiniteNumber(r.opticalCenterX)) {
      reticle.opticalCenterX = r.opticalCenterX;
    }
    if (isFiniteNumber(r.opticalCenterY)) {
      reticle.opticalCenterY = r.opticalCenterY;
    }
    if (isFiniteNumber(r.imageRotationDeg)) {
      reticle.imageRotationDeg = r.imageRotationDeg;
    }
    if (r.illumination && typeof r.illumination === "object") {
      reticle.illumination = r.illumination as ReticleIllumination;
    }
    if (r.imageCrop && typeof r.imageCrop === "object") {
      reticle.imageCrop = r.imageCrop as import("@/lib/range/reticles").ReticleImageCrop;
    }
    if (r.hiRes && typeof r.hiRes === "object") {
      reticle.hiRes = r.hiRes as import("@/lib/range/reticles").ReticleHiResLayer;
    }
    if (!scope.reticleId) scope.reticleId = rid;
  }

  let image: ScopePackImage | null = null;
  if (o.image != null) {
    if (typeof o.image !== "object") {
      return { error: "image must be an object or null" };
    }
    const img = o.image as Record<string, unknown>;
    const filename =
      typeof img.filename === "string" && img.filename.trim()
        ? img.filename.trim().replace(/\.png$/i, "") + ".png"
        : `${(reticle?.id ?? id).replace(/^scope-/, "")}.png`;
    const base64Raw =
      typeof img.base64 === "string" ? stripDataUrl(img.base64.trim()) : "";
    if (!base64Raw || base64Raw.length < 32) {
      return { error: "image.base64 required (PNG)" };
    }
    image = {
      filename,
      mime: "image/png",
      base64: base64Raw,
      bytes: isFiniteNumber(img.bytes)
        ? Math.round(img.bytes)
        : Math.ceil((base64Raw.length * 3) / 4),
    };
  }

  const shopItem: ScopePackShopItem = {
    id,
    category: "scope",
    brand,
    name,
    priceNok: Math.round(shop.priceNok),
    scope,
  };
  if (typeof shop.note === "string" && shop.note.trim()) {
    shopItem.note = shop.note.trim();
  }
  if (isFiniteNumber(shop.weightGrams) && shop.weightGrams > 0) {
    shopItem.weightGrams = Math.round(shop.weightGrams);
  }

  return {
    version: SCOPE_PACK_VERSION,
    exportedAt:
      typeof o.exportedAt === "string"
        ? o.exportedAt
        : new Date().toISOString(),
    title:
      typeof o.title === "string" && o.title.trim()
        ? o.title.trim().slice(0, 120)
        : `${brand} ${name}`,
    shopItem,
    reticle,
    image,
  };
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
