"use client";

import {
  findV0PlateauNodes,
  measuredV0Series,
  type LoadDevRow,
} from "@/lib/reloading/loadDevTable";

type LoadDevV0ChartProps = {
  rows: readonly LoadDevRow[];
};

/**
 * Simple SVG chart: measured v0 vs powder charge.
 * Highlights plateau nodes (low Δv0 / Δgr) — often good accuracy nodes.
 */
export function LoadDevV0Chart({ rows }: LoadDevV0ChartProps) {
  const series = measuredV0Series(rows);
  const plateaus = findV0PlateauNodes(rows);
  const plateauIds = new Set(plateaus.map((p) => p.rowId));

  if (series.length === 0) {
    return (
      <p className="shop-row-note">
        Ingen målte v₀ ennå. Test radene på skytebanen (chrono i kit) — grafen
        fylles etter målt serie.
      </p>
    );
  }

  const pad = { l: 42, r: 12, t: 14, b: 32 };
  const W = 360;
  const H = 180;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;

  const xs = series.map((p) => p.powderGrains);
  const ys = series.map((p) => p.v0Mps);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(0.5, maxX - minX);
  const spanY = Math.max(10, maxY - minY);
  const x0 = minX - spanX * 0.08;
  const x1 = maxX + spanX * 0.08;
  const y0 = minY - spanY * 0.12;
  const y1 = maxY + spanY * 0.12;

  const sx = (g: number) => pad.l + ((g - x0) / (x1 - x0)) * innerW;
  const sy = (v: number) => pad.t + (1 - (v - y0) / (y1 - y0)) * innerH;

  const path = series
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.powderGrains)},${sy(p.v0Mps)}`)
    .join(" ");

  return (
    <div className="load-dev-v0-chart" aria-label="v0 mot kruttvekt">
      <svg viewBox={`0 0 ${W} ${H}`} className="load-dev-v0-svg" role="img">
        <title>Målt v₀ mot kruttvekt</title>
        <line
          className="load-dev-v0-axis"
          x1={pad.l}
          y1={pad.t}
          x2={pad.l}
          y2={H - pad.b}
        />
        <line
          className="load-dev-v0-axis"
          x1={pad.l}
          y1={H - pad.b}
          x2={W - pad.r}
          y2={H - pad.b}
        />
        <text className="load-dev-v0-label" x={pad.l - 6} y={pad.t + 4} textAnchor="end">
          {Math.round(y1)}
        </text>
        <text
          className="load-dev-v0-label"
          x={pad.l - 6}
          y={H - pad.b}
          textAnchor="end"
        >
          {Math.round(y0)}
        </text>
        <text
          className="load-dev-v0-label"
          x={pad.l}
          y={H - 8}
          textAnchor="start"
        >
          {x0.toFixed(1)} gr
        </text>
        <text
          className="load-dev-v0-label"
          x={W - pad.r}
          y={H - 8}
          textAnchor="end"
        >
          {x1.toFixed(1)} gr
        </text>
        <path className="load-dev-v0-line" d={path} fill="none" />
        {series.map((p) => {
          const isNode = plateauIds.has(p.rowId);
          return (
            <g key={p.rowId}>
              <circle
                className={
                  isNode ? "load-dev-v0-dot is-plateau" : "load-dev-v0-dot"
                }
                cx={sx(p.powderGrains)}
                cy={sy(p.v0Mps)}
                r={isNode ? 5.5 : 4}
              />
              <title>
                {p.powderGrains.toFixed(1)} gr · {p.v0Mps.toFixed(1)} m/s
                {isNode ? " · platå-node" : ""}
              </title>
            </g>
          );
        })}
      </svg>
      {plateaus.length > 0 ? (
        <p className="shop-row-note">
          Platå-noder (lav Δv₀/Δgr):{" "}
          {plateaus
            .map(
              (n) =>
                `${n.powderGrains.toFixed(1)} gr (${n.slopeMpsPerGr.toFixed(1)} m/s/gr)`,
            )
            .join(" · ")}
          . Ofte et godt tegn for samling.
        </p>
      ) : series.length >= 2 ? (
        <p className="shop-row-note">
          Ingen tydelig platå ennå — prøv tettere steg (f.eks. 0,5 gr).
        </p>
      ) : null}
    </div>
  );
}
