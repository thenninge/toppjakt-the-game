import { useCallback, useEffect, useRef } from "react";
import type { BirdVisualPlacement } from "@/lib/hunt/birds";
import { getBirdSprite } from "@/lib/hunt/birdSprites";

type ThermalCanvasProps = {
  imageSrc: string;
  birdPlacements: BirdVisualPlacement[];
  pan: { x: number; y: number };
  zoom: number;
  /** Higher = blockier (poorer sensor). */
  pixelFactor: number;
  className?: string;
  /** Fired once the landscape bitmap is ready (birds may then be drawn). */
  onLandscapeReady?: () => void;
};

/** Map landscape luminance to flat B&W thermal gray. */
function luminanceToThermal(r: number, g: number, b: number): number {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return Math.pow(lum / 255, 1.35) * 175 + 22;
}

/**
 * Peak bird heat after ~40% intensity cut vs pure white
 * (255 × 0.6 ≈ 153) — blends more with the gray terrain.
 */
const THERMAL_BIRD_GRAY = Math.round(255 * 0.6);

/**
 * Pixelated thermal background + bird silhouettes (same topp shape as binos),
 * drawn as muted heat gray instead of glowing white blobs.
 */
export function ThermalCanvas({
  imageSrc,
  birdPlacements,
  pan,
  zoom,
  pixelFactor,
  className,
  onLandscapeReady,
}: ThermalCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const sampleRef = useRef<ImageData | null>(null);
  const spriteCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const onLandscapeReadyRef = useRef(onLandscapeReady);
  onLandscapeReadyRef.current = onLandscapeReady;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !img.complete || img.naturalWidth <= 0) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const block = Math.max(2, Math.round(pixelFactor * dpr));
    const cols = Math.max(1, Math.ceil(w / block));
    const rows = Math.max(1, Math.ceil(h / block));

    if (!sampleRef.current || sampleRef.current.width !== img.naturalWidth) {
      const sampleCanvas = document.createElement("canvas");
      sampleCanvas.width = img.naturalWidth;
      sampleCanvas.height = img.naturalHeight;
      const sampleCtx = sampleCanvas.getContext("2d");
      if (!sampleCtx) return;
      sampleCtx.drawImage(img, 0, 0);
      sampleRef.current = sampleCtx.getImageData(
        0,
        0,
        img.naturalWidth,
        img.naturalHeight,
      );
    }

    const imgData = sampleRef.current;
    const off = document.createElement("canvas");
    off.width = cols;
    off.height = rows;
    const offCtx = off.getContext("2d");
    if (!offCtx) return;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const lensX = ((col + 0.5) / cols) * 100;
        const lensY = ((row + 0.5) / rows) * 100;
        const landscapeX = (lensX - (1 - zoom) * pan.x) / zoom;
        const landscapeY = (lensY - (1 - zoom) * pan.y) / zoom;

        if (
          landscapeX < 0 ||
          landscapeX > 100 ||
          landscapeY < 0 ||
          landscapeY > 100
        ) {
          offCtx.fillStyle = "#080808";
          offCtx.fillRect(col, row, 1, 1);
          continue;
        }

        const sx = Math.min(
          img.naturalWidth - 1,
          Math.max(0, Math.floor((landscapeX / 100) * img.naturalWidth)),
        );
        const sy = Math.min(
          img.naturalHeight - 1,
          Math.max(0, Math.floor((landscapeY / 100) * img.naturalHeight)),
        );
        const idx = (sy * img.naturalWidth + sx) * 4;
        const t = luminanceToThermal(
          imgData.data[idx] ?? 0,
          imgData.data[idx + 1] ?? 0,
          imgData.data[idx + 2] ?? 0,
        );
        offCtx.fillStyle = `rgb(${t | 0}, ${t | 0}, ${t | 0})`;
        offCtx.fillRect(col, row, 1, 1);
      }
    }

    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, cols, rows, 0, 0, w, h);

    // Birds: same topp silhouette as binos, muted heat gray.
    ctx.imageSmoothingEnabled = true;
    const g = THERMAL_BIRD_GRAY;
    for (const p of birdPlacements) {
      const lx = (1 - zoom) * pan.x + p.x * zoom;
      const ly = (1 - zoom) * pan.y + p.y * zoom;
      if (lx < -8 || lx > 108 || ly < -8 || ly > 108) continue;

      const spriteImg = spriteCacheRef.current.get(p.imageSrc);
      if (!spriteImg || !spriteImg.complete || spriteImg.naturalWidth <= 0) {
        continue;
      }

      const cx = (lx / 100) * w;
      const cy = (ly / 100) * h;
      const birdW = Math.max(6 * dpr, (p.widthPct / 100) * w * zoom);
      const sprite = getBirdSprite(p.spriteId);
      const aspect = sprite.toppH / Math.max(1, sprite.toppW);
      const birdH = birdW * aspect;
      const dw = Math.max(1, Math.ceil(birdW));
      const dh = Math.max(1, Math.ceil(birdH));

      const sil = document.createElement("canvas");
      sil.width = dw;
      sil.height = dh;
      const silCtx = sil.getContext("2d");
      if (!silCtx) continue;
      silCtx.clearRect(0, 0, dw, dh);
      silCtx.drawImage(spriteImg, 0, 0, dw, dh);
      silCtx.globalCompositeOperation = "source-in";
      silCtx.fillStyle = `rgb(${g}, ${g}, ${g})`;
      silCtx.fillRect(0, 0, dw, dh);

      ctx.save();
      ctx.translate(cx, cy);
      if (p.flip) ctx.scale(-1, 1);
      ctx.shadowColor = `rgba(${g}, ${g}, ${g}, 0.28)`;
      ctx.shadowBlur = 3 * dpr;
      ctx.drawImage(sil, -birdW / 2, -birdH / 2, birdW, birdH);
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }, [birdPlacements, pan, pixelFactor, zoom]);

  useEffect(() => {
    sampleRef.current = null;
    const img = new Image();
    img.src = imageSrc;
    imgRef.current = img;
    const onLoad = () => {
      onLandscapeReadyRef.current?.();
      draw();
    };
    img.addEventListener("load", onLoad);
    if (img.complete && img.naturalWidth > 0) onLoad();
    return () => img.removeEventListener("load", onLoad);
  }, [imageSrc, draw]);

  /** Preload topp sprites so thermal silhouettes match binos. */
  useEffect(() => {
    const cache = spriteCacheRef.current;
    const srcs = [...new Set(birdPlacements.map((p) => p.imageSrc))];
    let cancelled = false;
    let pending = 0;

    const maybeDraw = () => {
      if (!cancelled && pending <= 0) draw();
    };

    for (const src of srcs) {
      const existing = cache.get(src);
      if (existing?.complete && existing.naturalWidth > 0) continue;
      pending += 1;
      const img = new Image();
      cache.set(src, img);
      img.onload = () => {
        pending -= 1;
        maybeDraw();
      };
      img.onerror = () => {
        pending -= 1;
        maybeDraw();
      };
      img.src = src;
    }
    maybeDraw();

    return () => {
      cancelled = true;
    };
  }, [birdPlacements, draw]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
