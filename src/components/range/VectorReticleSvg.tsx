"use client";

import type { CSSProperties } from "react";
import {
  brokenCirclePath,
  circleRadiusMils,
  vecStrokeWidth,
  type VecElement,
  type VecIllum,
  type VectorReticleDef,
} from "@/lib/optics/vectorReticle";

type VectorReticleSvgProps = {
  reticle: VectorReticleDef;
  /** Half extent of viewBox in mils (default 10). */
  halfMils?: number;
  /** 0–1 illumination drum. */
  illumination?: number;
  /** Lit colour when illumination > 0. */
  illumColor?: string;
  className?: string;
  style?: CSSProperties;
  /** Highlight selected element id. */
  selectedId?: string | null;
  onSelectId?: (id: string | null) => void;
  /** Pointer in mils (editor). */
  onPointerMils?: (pt: { x: number; y: number } | null) => void;
  onPointerDownMils?: (pt: { x: number; y: number }) => void;
  onPointerMoveMils?: (pt: { x: number; y: number }) => void;
  onPointerUpMils?: (pt: { x: number; y: number }) => void;
};

function etchOpacity(illum: VecIllum, drum: number): number {
  if (illum === "illum") return drum > 0.02 ? 0 : 1;
  return 1;
}

function litOpacity(illum: VecIllum, drum: number): number {
  if (illum === "etch") return 0;
  return Math.min(1, Math.max(0, drum));
}

function arrowPoints(
  tipX: number,
  tipY: number,
  baseX: number,
  baseY: number,
): string {
  const dx = tipX - baseX;
  const dy = tipY - baseY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const head = Math.min(0.55, len * 0.55);
  const half = head * 0.45;
  const bx = tipX - ux * head;
  const by = tipY - uy * head;
  return [
    `${tipX},${tipY}`,
    `${bx + px * half},${by + py * half}`,
    `${bx - px * half},${by - py * half}`,
  ].join(" ");
}

function elementAnchor(el: VecElement): { x: number; y: number } {
  switch (el.kind) {
    case "line":
      return { x: (el.x1 + el.x2) / 2, y: (el.y1 + el.y2) / 2 };
    case "hash":
      return {
        x: el.axis === "h" ? el.at : 0,
        y: el.axis === "v" ? el.at : 0,
      };
    case "arrow":
      return { x: el.tipX, y: el.tipY };
    default:
      return { x: el.x, y: el.y };
  }
}

function ElementGeom({
  el,
  paint,
}: {
  el: VecElement;
  paint: string;
}) {
  const sw = "stroke" in el ? vecStrokeWidth(el.stroke) : vecStrokeWidth("thin");
  switch (el.kind) {
    case "line":
      return (
        <line
          x1={el.x1}
          y1={el.y1}
          x2={el.x2}
          y2={el.y2}
          stroke={paint}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      );
    case "hash": {
      const side = el.side ?? "both";
      if (el.axis === "v") {
        // Tick along X at y = at (vertical wire).
        let x1 = -el.len;
        let x2 = el.len;
        if (side === "neg") {
          x1 = -el.len;
          x2 = 0;
        } else if (side === "pos") {
          x1 = 0;
          x2 = el.len;
        }
        return (
          <line
            x1={x1}
            y1={el.at}
            x2={x2}
            y2={el.at}
            stroke={paint}
            strokeWidth={sw}
            strokeLinecap="butt"
          />
        );
      }
      // Tick along Y at x = at (horizontal wire). neg = up on glass (−Y).
      let y1 = -el.len;
      let y2 = el.len;
      if (side === "neg") {
        y1 = -el.len;
        y2 = 0;
      } else if (side === "pos") {
        y1 = 0;
        y2 = el.len;
      }
      return (
        <line
          x1={el.at}
          y1={y1}
          x2={el.at}
          y2={y2}
          stroke={paint}
          strokeWidth={sw}
          strokeLinecap="butt"
        />
      );
    }
    case "arrow": {
      const pts = arrowPoints(el.tipX, el.tipY, el.baseX, el.baseY);
      if (el.fill === "solid") {
        return <polygon points={pts} fill={paint} stroke="none" />;
      }
      return (
        <polygon
          points={pts}
          fill="none"
          stroke={paint}
          strokeWidth={sw}
          strokeLinejoin="round"
        />
      );
    }
    case "number":
      return (
        <text
          x={el.x}
          y={el.y}
          fill={paint}
          fontSize={el.sizeMils}
          fontFamily="ui-sans-serif, system-ui, sans-serif"
          fontWeight={600}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {el.text}
        </text>
      );
    case "rect": {
      const x = el.x - el.w / 2;
      const y = el.y - el.h / 2;
      if (el.fill === "solid") {
        return (
          <rect
            x={x}
            y={y}
            width={el.w}
            height={el.h}
            fill={paint}
            stroke="none"
          />
        );
      }
      return (
        <rect
          x={x}
          y={y}
          width={el.w}
          height={el.h}
          fill="none"
          stroke={paint}
          strokeWidth={sw}
        />
      );
    }
    case "dot":
      return (
        <circle
          cx={el.x}
          cy={el.y}
          r={Math.max(0.01, el.rMils)}
          fill={paint}
          stroke="none"
        />
      );
    case "circle": {
      const r = circleRadiusMils(el);
      return (
        <circle
          cx={el.x}
          cy={el.y}
          r={r}
          fill="none"
          stroke={paint}
          strokeWidth={sw}
        />
      );
    }
    case "brokenCircle": {
      const d = brokenCirclePath(el.x, el.y, el.rMils, el.gapDeg);
      if (!d) return null;
      return (
        <path
          d={d}
          fill="none"
          stroke={paint}
          strokeWidth={sw}
          strokeLinecap="butt"
        />
      );
    }
    default:
      return null;
  }
}

/**
 * SVG reticle in mil space. Renders etch (black) + optional illum overlay.
 */
export function VectorReticleSvg({
  reticle,
  halfMils = 10,
  illumination = 0,
  illumColor = "#dc2424",
  className,
  style,
  selectedId = null,
  onSelectId,
  onPointerMils,
  onPointerDownMils,
  onPointerMoveMils,
  onPointerUpMils,
}: VectorReticleSvgProps) {
  const drum = Math.min(1, Math.max(0, illumination));
  const etch = "#111111";

  function milsFromClient(
    svg: SVGSVGElement,
    clientX: number,
    clientY: number,
  ): { x: number; y: number } {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  return (
    <svg
      className={className}
      style={style}
      viewBox={`${-halfMils} ${-halfMils} ${halfMils * 2} ${halfMils * 2}`}
      xmlns="http://www.w3.org/2000/svg"
      onPointerLeave={() => onPointerMils?.(null)}
      onPointerDown={(e) => {
        const svg = e.currentTarget;
        const pt = milsFromClient(svg, e.clientX, e.clientY);
        onPointerDownMils?.(pt);
        if (e.target === svg) onSelectId?.(null);
      }}
      onPointerMove={(e) => {
        const svg = e.currentTarget;
        const pt = milsFromClient(svg, e.clientX, e.clientY);
        onPointerMils?.(pt);
        onPointerMoveMils?.(pt);
      }}
      onPointerUp={(e) => {
        const svg = e.currentTarget;
        const pt = milsFromClient(svg, e.clientX, e.clientY);
        onPointerUpMils?.(pt);
      }}
    >
      {/* Grid */}
      <g opacity={0.2} pointerEvents="none">
        {Array.from({ length: Math.floor(halfMils) * 2 + 1 }, (_, i) => {
          const v = -Math.floor(halfMils) + i;
          return (
            <g key={v}>
              <line
                x1={-halfMils}
                y1={v}
                x2={halfMils}
                y2={v}
                stroke="#888"
                strokeWidth={v === 0 ? 0.04 : 0.015}
              />
              <line
                x1={v}
                y1={-halfMils}
                x2={v}
                y2={halfMils}
                stroke="#888"
                strokeWidth={v === 0 ? 0.04 : 0.015}
              />
            </g>
          );
        })}
      </g>

      {reticle.elements.map((el) => {
        const eo = etchOpacity(el.illum, drum);
        const lo = litOpacity(el.illum, drum);
        const selected = el.id === selectedId;
        const anchor = elementAnchor(el);
        return (
          <g
            key={el.id}
            style={{ cursor: onSelectId ? "pointer" : undefined }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelectId?.(el.id);
              const svg = e.currentTarget.ownerSVGElement;
              if (!svg) return;
              const pt = milsFromClient(svg, e.clientX, e.clientY);
              onPointerDownMils?.(pt);
            }}
          >
            {eo > 0.01 ? (
              <g opacity={eo}>
                <ElementGeom el={el} paint={etch} />
              </g>
            ) : null}
            {lo > 0.01 ? (
              <g opacity={lo}>
                <ElementGeom el={el} paint={illumColor} />
              </g>
            ) : null}
            {selected ? (
              <circle
                cx={anchor.x}
                cy={anchor.y}
                r={0.18}
                fill="none"
                stroke="#4af"
                strokeWidth={0.06}
                pointerEvents="none"
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
