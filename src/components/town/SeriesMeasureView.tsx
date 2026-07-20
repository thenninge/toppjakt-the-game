"use client";

import {
  cbaBullseyePx,
  formatPoiOffset,
  mmToPx,
  type GroupMeasurement,
  type ShotImpact,
} from "@/lib/range/precision";

type SeriesMeasureViewProps = {
  shots: ShotImpact[];
  measurement: GroupMeasurement;
  imageSrc: string;
  imageWidth: number;
  imageHeight: number;
};

function formatMmShort(n: number): string {
  return `${n.toFixed(0)}mm`;
}

function formatMoaShort(n: number): string {
  return `${n.toFixed(2)}MOA`;
}

export function SeriesMeasureView({
  shots,
  measurement,
  imageSrc,
  imageWidth,
  imageHeight,
}: SeriesMeasureViewProps) {
  const bull = cbaBullseyePx(imageWidth, imageHeight);
  const cx = bull.x;
  const cy = bull.y;
  const toX = (xMm: number) => cx + mmToPx(xMm, imageWidth);
  const toY = (yMm: number) => cy + mmToPx(yMm, imageWidth);

  const xs = shots.map((s) => toX(s.xMm));
  const ys = shots.map((s) => toY(s.yMm));
  const pad = 10;
  const boxLeft = Math.min(...xs) - pad;
  const boxTop = Math.min(...ys) - pad;
  const boxW = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const boxH = Math.max(...ys) - Math.min(...ys) + pad * 2;

  const poiX = toX(measurement.poiXMm);
  const poiY = toY(measurement.poiYMm);
  const meanR = mmToPx(measurement.meanRadiusMm, imageWidth);
  const cross = Math.max(6, mmToPx(2, imageWidth));

  return (
    <div className="series-measure" aria-live="polite">
      <p className="intro-line intro-gift">Serie målt — stillbilde</p>
      <div className="series-still">
        <div
          className="series-still-frame"
          style={{ aspectRatio: `${imageWidth} / ${imageHeight}` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="series-still-img"
            src={imageSrc}
            alt="CBA blink med treff"
            width={imageWidth}
            height={imageHeight}
            draggable={false}
          />
          <svg
            className="series-still-overlay"
            viewBox={`0 0 ${imageWidth} ${imageHeight}`}
            aria-hidden
          >
            {/* POI offset line: bullseye → group center */}
            <line
              x1={cx}
              y1={cy}
              x2={poiX}
              y2={poiY}
              className="series-poi-line"
            />

            {/* Mean radius circle */}
            <circle
              cx={poiX}
              cy={poiY}
              r={Math.max(meanR, 4)}
              className="series-mean-circle"
            />

            {/* Bounding box */}
            <rect
              x={boxLeft}
              y={boxTop}
              width={Math.max(boxW, 4)}
              height={Math.max(boxH, 4)}
              className="series-group-box"
            />

            {/* Shots */}
            {shots.map((s, i) => {
              const x = toX(s.xMm);
              const y = toY(s.yMm);
              const holeR = mmToPx(s.diameterMm / 2, imageWidth);
              return (
                <g key={`shot-${i}`}>
                  <circle
                    cx={x}
                    cy={y}
                    r={holeR}
                    className="series-hole-fill"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={holeR}
                    className="series-hole-ring"
                  />
                  <text
                    x={x + holeR + 3}
                    y={y - holeR - 2}
                    className="series-hole-num"
                  >
                    {i + 1}
                  </text>
                </g>
              );
            })}

            {/* Group center cross */}
            <line
              x1={poiX - cross}
              y1={poiY}
              x2={poiX + cross}
              y2={poiY}
              className="series-poi-cross"
            />
            <line
              x1={poiX}
              y1={poiY - cross}
              x2={poiX}
              y2={poiY + cross}
              className="series-poi-cross"
            />
          </svg>
        </div>

        <div className="series-stats-banner">
          <p>
            <strong>Group Size:</strong>{" "}
            {formatMmShort(measurement.extremeSpreadMm)} (
            {formatMoaShort(measurement.groupMoa)})
          </p>
          <p>
            <strong>Group Area:</strong>{" "}
            {formatMmShort(measurement.widthMm)}(W) X{" "}
            {formatMmShort(measurement.heightMm)}(H)
          </p>
          <p>
            <strong>Mean Radius:</strong>{" "}
            {formatMmShort(measurement.meanRadiusMm)} (
            {formatMoaShort(measurement.meanRadiusMoa)})
          </p>
          <p>
            <strong>POI:</strong>{" "}
            {formatPoiOffset(measurement.poiXMm, measurement.poiYMm)}
          </p>
          <p className="series-stats-shots">
            {measurement.shotCount} skudd · nummerert på blinken
          </p>
        </div>
      </div>
    </div>
  );
}
