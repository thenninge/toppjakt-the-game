"use client";

import {
  formatPoiOffset,
  type GroupMeasurement,
  type ShotImpact,
} from "@/lib/range/precision";
import {
  mmToPxOnTargetX,
  mmToPxOnTargetY,
  targetBullseyePx,
  type RangeTargetDef,
} from "@/lib/range/targets";

type SeriesMeasureViewProps = {
  shots: ShotImpact[];
  measurement: GroupMeasurement;
  target: RangeTargetDef;
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
  target,
}: SeriesMeasureViewProps) {
  const imageWidth = target.nativeWidth;
  const imageHeight = target.nativeHeight;
  const bull = targetBullseyePx(target, imageWidth, imageHeight);
  const cx = bull.x;
  const cy = bull.y;
  const toX = (xMm: number) => cx + mmToPxOnTargetX(xMm, target, imageWidth);
  const toY = (yMm: number) => cy + mmToPxOnTargetY(yMm, target, imageHeight);

  const xs = shots.map((s) => toX(s.xMm));
  const ys = shots.map((s) => toY(s.yMm));
  const pad = 10;
  const boxLeft = Math.min(...xs) - pad;
  const boxTop = Math.min(...ys) - pad;
  const boxW = Math.max(...xs) - Math.min(...xs) + pad * 2;
  const boxH = Math.max(...ys) - Math.min(...ys) + pad * 2;

  const poiX = toX(measurement.poiXMm);
  const poiY = toY(measurement.poiYMm);
  // Circle through outermost shot centre, centred on POI.
  const encloseR = Math.max(
    ...shots.map((s) => Math.hypot(toX(s.xMm) - poiX, toY(s.yMm) - poiY)),
    4,
  );
  const cross = Math.max(6, mmToPxOnTargetX(2, target, imageWidth));

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
            src={target.src}
            alt={`${target.label} med treff`}
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

            {/* Enclosing circle: POI centre, outermost shot on rim */}
            <circle
              cx={poiX}
              cy={poiY}
              r={encloseR}
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
              const holeR = mmToPxOnTargetX(s.diameterMm / 2, target, imageWidth);
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
