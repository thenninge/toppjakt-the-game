import { useCallback, useEffect, useRef } from "react";
import type { BirdVisualPlacement } from "@/lib/hunt/birds";
import { getBirdSprite } from "@/lib/hunt/birdSprites";

/** Thermal palette / Habrok display mode. */
export type ThermalPolarity = "wh" | "bh" | "outline" | "fusion";

type ThermalCanvasProps = {
  imageSrc: string;
  birdPlacements: BirdVisualPlacement[];
  pan: { x: number; y: number };
  zoom: number;
  /** Higher = blockier (poorer sensor). */
  pixelFactor: number;
  /** White-hot (default), black-hot, outline, or fusion (outlines only). */
  polarity?: ThermalPolarity;
  className?: string;
  /** Fired once the landscape bitmap is ready (birds may then be drawn). */
  onLandscapeReady?: () => void;
};

/** Map landscape luminance to flat B&W thermal gray (white-hot scale). */
function luminanceToThermal(r: number, g: number, b: number): number {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return Math.pow(lum / 255, 1.35) * 175 + 22;
}

/**
 * Peak bird heat vs pure white (white-hot).
 * Was 0.66 (~168); halfway toward white → 0.83 (~212).
 */
const THERMAL_BIRD_GRAY_WH = Math.round(255 * 0.83);

const OUTLINE_RGB = "rgb(220, 40, 40)";

function heatGrayForMode(polarity: ThermalPolarity): number {
  if (polarity === "bh") return 255 - THERMAL_BIRD_GRAY_WH;
  // WH + outline use bright heat fill; fusion has no fill.
  return THERMAL_BIRD_GRAY_WH;
}

function applyPolarity(gray: number, polarity: ThermalPolarity): number {
  const g = Math.max(0, Math.min(255, gray));
  if (polarity === "bh") return 255 - g;
  return g;
}

function drawBirdSilhouette(
  silCtx: CanvasRenderingContext2D,
  spriteImg: HTMLImageElement,
  dw: number,
  dh: number,
  flip: boolean,
  fillStyle: string,
) {
  silCtx.clearRect(0, 0, dw, dh);
  silCtx.save();
  if (flip) {
    silCtx.translate(dw, 0);
    silCtx.scale(-1, 1);
  }
  silCtx.drawImage(spriteImg, 0, 0, dw, dh);
  silCtx.restore();
  silCtx.globalCompositeOperation = "source-in";
  silCtx.fillStyle = fillStyle;
  silCtx.fillRect(0, 0, dw, dh);
  silCtx.globalCompositeOperation = "source-over";
}

/**
 * Pixelated thermal background + bird silhouettes (same topp shape as binos).
 * Birds share the landscape pixel grid. Outline/Fusion add a thin red edge.
 */
export function ThermalCanvas({
  imageSrc,
  birdPlacements,
  pan,
  zoom,
  pixelFactor,
  polarity = "wh",
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
    const fusionOnly = polarity === "fusion";
    const wantOutline = polarity === "outline" || polarity === "fusion";

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

    if (fusionOnly) {
      offCtx.clearRect(0, 0, cols, rows);
    } else {
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
            const voidG = applyPolarity(8, polarity);
            offCtx.fillStyle = `rgb(${voidG}, ${voidG}, ${voidG})`;
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
          const t = applyPolarity(
            luminanceToThermal(
              imgData.data[idx] ?? 0,
              imgData.data[idx + 1] ?? 0,
              imgData.data[idx + 2] ?? 0,
            ),
            polarity,
          );
          offCtx.fillStyle = `rgb(${t | 0}, ${t | 0}, ${t | 0})`;
          offCtx.fillRect(col, row, 1, 1);
        }
      }
    }

    const birdG = heatGrayForMode(polarity) | 0;
    for (const p of birdPlacements) {
      const lx = (1 - zoom) * pan.x + p.x * zoom;
      const ly = (1 - zoom) * pan.y + p.y * zoom;
      if (lx < -8 || lx > 108 || ly < -8 || ly > 108) continue;

      const spriteImg = spriteCacheRef.current.get(p.imageSrc);
      if (!spriteImg || !spriteImg.complete || spriteImg.naturalWidth <= 0) {
        continue;
      }

      const birdW = Math.max(6 * dpr, (p.widthPct / 100) * w * zoom);
      const sprite = getBirdSprite(p.spriteId);
      const aspect = sprite.toppH / Math.max(1, sprite.toppW);
      const birdH = birdW * aspect;
      const dw = Math.max(1, Math.ceil(birdW / block));
      const dh = Math.max(1, Math.ceil(birdH / block));
      const col = Math.round((lx / 100) * cols - dw / 2);
      const row = Math.round((ly / 100) * rows - dh / 2);

      if (wantOutline) {
        const odw = Math.max(dw + 2, Math.ceil(dw * 1.12));
        const odh = Math.max(dh + 2, Math.ceil(dh * 1.12));
        const oCol = col - Math.floor((odw - dw) / 2);
        const oRow = row - Math.floor((odh - dh) / 2);
        const insetX = Math.floor((odw - dw) / 2);
        const insetY = Math.floor((odh - dh) / 2);
        const outline = document.createElement("canvas");
        outline.width = odw;
        outline.height = odh;
        const oCtx = outline.getContext("2d");
        if (oCtx) {
          oCtx.imageSmoothingEnabled = false;
          drawBirdSilhouette(oCtx, spriteImg, odw, odh, !!p.flip, OUTLINE_RGB);
          if (fusionOnly) {
            // Punch interior so only a red rim remains (day bird shows through).
            const punch = document.createElement("canvas");
            punch.width = dw;
            punch.height = dh;
            const pCtx = punch.getContext("2d");
            if (pCtx) {
              pCtx.imageSmoothingEnabled = false;
              drawBirdSilhouette(
                pCtx,
                spriteImg,
                dw,
                dh,
                !!p.flip,
                "rgba(0,0,0,1)",
              );
              oCtx.globalCompositeOperation = "destination-out";
              oCtx.drawImage(punch, insetX, insetY);
              oCtx.globalCompositeOperation = "source-over";
            }
          }
          offCtx.drawImage(outline, oCol, oRow);
        }
      }

      if (!fusionOnly) {
        const sil = document.createElement("canvas");
        sil.width = dw;
        sil.height = dh;
        const silCtx = sil.getContext("2d");
        if (!silCtx) continue;
        silCtx.imageSmoothingEnabled = false;
        drawBirdSilhouette(
          silCtx,
          spriteImg,
          dw,
          dh,
          !!p.flip,
          `rgb(${birdG}, ${birdG}, ${birdG})`,
        );
        offCtx.drawImage(sil, col, row);
      }
    }

    if (fusionOnly) {
      ctx.clearRect(0, 0, w, h);
    } else {
      const bg = applyPolarity(5, polarity);
      ctx.fillStyle = `rgb(${bg}, ${bg}, ${bg})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, 0, 0, cols, rows, 0, 0, w, h);
  }, [birdPlacements, pan, pixelFactor, polarity, zoom]);

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
      style={{
        width: "100%",
        height: "100%",
        display: "block",
        ...(polarity === "fusion"
          ? { background: "transparent", pointerEvents: "none" }
          : null),
      }}
    />
  );
}
