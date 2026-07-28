"use client";

import {
  AWARE_METERS_PER_PCT,
} from "@/lib/aware/cellGeometry";
import {
  shotPairAimPoint,
  type ShotPair,
} from "@/lib/aware/types";

/** Search ring around the aim point (~find the tree again). */
export const SHOT_PAIR_SEARCH_RADIUS_M = 20;

type ShotPairOverlayProps = {
  pair: ShotPair;
  active?: boolean;
  /** Terrain Aware scale (m per map %). */
  metersPerPct?: number;
};

/**
 * Visible skuddpar: stand → dashed line → aim point + ~20 m search ring.
 */
export function ShotPairOverlay({
  pair,
  active = false,
  metersPerPct = AWARE_METERS_PER_PCT,
}: ShotPairOverlayProps) {
  const aim = shotPairAimPoint(pair);
  const ringPct = (SHOT_PAIR_SEARCH_RADIUS_M / metersPerPct) * 2;

  return (
    <div
      className={
        active ? "aware-skuddpar aware-skuddpar-active" : "aware-skuddpar"
      }
      aria-hidden
    >
      <svg className="aware-skuddpar-line" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line
          x1={pair.stand.x}
          y1={pair.stand.y}
          x2={aim.x}
          y2={aim.y}
          className="aware-skuddpar-dash"
        />
      </svg>
      <span
        className="aware-pair-stand"
        style={{ left: `${pair.stand.x}%`, top: `${pair.stand.y}%` }}
        title="Skyteplass"
      />
      <div
        className="aware-skuddpar-search"
        style={{
          left: `${aim.x}%`,
          top: `${aim.y}%`,
          width: `${ringPct}%`,
        }}
        title={`Søkeradius ~${SHOT_PAIR_SEARCH_RADIUS_M} m`}
      />
      <span
        className="aware-pair-impact"
        style={{ left: `${aim.x}%`, top: `${aim.y}%` }}
        title="Tre / siktepunkt"
      />
    </div>
  );
}

function pointsToSvg(points: Array<{ x: number; y: number }>): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

type SearchTrackOverlayProps = {
  pair: ShotPair;
  /** Highlight the active pair's current draft track. */
  active?: boolean;
};

/**
 * All søkespor for a skuddpar: completed sweeps stay forever; current draft
 * is drawn on top so you can see where you have already searched.
 */
export function SearchTrackOverlay({
  pair,
  active = false,
}: SearchTrackOverlayProps) {
  const done = pair.searchedTracks ?? [];
  const draft = pair.trackPoints;
  if (done.length === 0 && draft.length === 0) return null;

  return (
    <div
      className={
        active
          ? "aware-search-tracks aware-search-tracks-active"
          : "aware-search-tracks"
      }
      aria-hidden
    >
      <svg
        className="aware-search-tracks-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {done.map((sweep, i) =>
          sweep.points.length >= 2 ? (
            <polyline
              key={`done-${i}`}
              points={pointsToSvg(sweep.points)}
              className={
                sweep.found
                  ? "aware-track-path aware-track-path-found"
                  : "aware-track-path aware-track-path-done"
              }
            />
          ) : null,
        )}
        {draft.length >= 2 ? (
          <polyline
            points={pointsToSvg(draft)}
            className="aware-track-path aware-track-path-draft"
          />
        ) : null}
      </svg>
      {done.map((sweep, si) =>
        sweep.points.map((t, pi) => (
          <span
            key={`d-${si}-${pi}`}
            className={
              sweep.found
                ? "aware-track-dot aware-track-dot-found"
                : "aware-track-dot aware-track-dot-done"
            }
            style={{ left: `${t.x}%`, top: `${t.y}%` }}
            title={`Søk #${si + 1}${sweep.found ? " · funnet" : ""}`}
          >
            {si + 1}.{pi + 1}
          </span>
        )),
      )}
      {draft.map((t, i) => (
        <span
          key={`cur-${i}`}
          className="aware-track-dot aware-track-dot-draft"
          style={{ left: `${t.x}%`, top: `${t.y}%` }}
          title={`Nytt spor ${i + 1}`}
        >
          {i + 1}
        </span>
      ))}
    </div>
  );
}

type ShotPairPreviewProps = {
  stand: { x: number; y: number };
  bearingDeg: number;
  rangeM: number;
  metersPerPct?: number;
};

/**
 * Live preview while defining skuddpar direction.
 * Ray length uses the same width-% as the range ring radius so the tip
 * sits on the circular range ring even when the map frame is not square.
 */
export function ShotPairPreview({
  stand,
  bearingDeg,
  rangeM,
  metersPerPct = AWARE_METERS_PER_PCT,
}: ShotPairPreviewProps) {
  const d = Math.max(1, rangeM);
  const radiusPct = d / metersPerPct;
  const searchOnRayPct = ((SHOT_PAIR_SEARCH_RADIUS_M * 2) / d) * 100;
  return (
    <div className="aware-skuddpar aware-skuddpar-preview" aria-hidden>
      <span
        className="aware-pair-stand"
        style={{ left: `${stand.x}%`, top: `${stand.y}%` }}
      />
      <div
        className="aware-skuddpar-ray"
        style={{
          left: `${stand.x}%`,
          top: `${stand.y}%`,
          width: `${radiusPct}%`,
          transform: `translateY(-50%) rotate(${bearingDeg - 90}deg)`,
        }}
      >
        <div
          className="aware-skuddpar-search aware-skuddpar-ray-search"
          style={{ width: `${searchOnRayPct}%` }}
        />
        <span className="aware-pair-impact aware-skuddpar-ray-tip" />
      </div>
    </div>
  );
}

type ShotPairRangeRingProps = {
  stand: { x: number; y: number };
  distanceM: number;
  metersPerPct?: number;
};

/** Distance circle from stand while dialing skuddpar range. */
export function ShotPairRangeRing({
  stand,
  distanceM,
  metersPerPct = AWARE_METERS_PER_PCT,
}: ShotPairRangeRingProps) {
  const d = Math.max(0, distanceM);
  if (d < 1) return null;
  const ringPct = (d / metersPerPct) * 2;
  return (
    <div
      className="aware-skuddpar-range-ring"
      style={{
        left: `${stand.x}%`,
        top: `${stand.y}%`,
        width: `${ringPct}%`,
      }}
      title={`${Math.round(d)} m`}
      aria-hidden
    />
  );
}

function pointAlongBearing(
  origin: { x: number; y: number },
  bearingDeg: number,
  meters: number,
  metersPerPct: number,
): { x: number; y: number } {
  const pct = meters / metersPerPct;
  const rad = ((bearingDeg - 90) * Math.PI) / 180;
  return {
    x: origin.x + Math.cos(rad) * pct,
    y: origin.y + Math.sin(rad) * pct,
  };
}

type FleeDirectionCueProps = {
  /** Where the bird sat when shot (skuddpar aim / perch). */
  origin: { x: number; y: number };
  bearingDeg: number;
  compassLabel: string;
  /** Estimated land distance (m) — draws a circle with this radius. */
  observedLandDistanceM?: number;
  metersPerPct?: number;
};

/**
 * Ettersøk flee cue: direction arrow (screen-fixed) + distance as a circle
 * around the perch with radius = estimated land distance.
 */
export function FleeDirectionCue({
  origin,
  bearingDeg,
  compassLabel,
  observedLandDistanceM,
  metersPerPct = AWARE_METERS_PER_PCT,
}: FleeDirectionCueProps) {
  const cueDist =
    observedLandDistanceM != null && Number.isFinite(observedLandDistanceM)
      ? Math.round(observedLandDistanceM)
      : null;
  const ringPct =
    cueDist != null && cueDist > 0
      ? (cueDist / metersPerPct) * 2
      : null;
  const labelAt =
    cueDist != null
      ? pointAlongBearing(
          origin,
          bearingDeg,
          Math.min(cueDist, 90),
          metersPerPct,
        )
      : null;

  return (
    <div className="aware-flee-cue" aria-hidden>
      {ringPct != null && cueDist != null ? (
        <div
          className="aware-flee-land-ring"
          style={{
            left: `${origin.x}%`,
            top: `${origin.y}%`,
            width: `${ringPct}%`,
          }}
          title={`Estimert avstand ca. ${cueDist} m`}
        />
      ) : null}
      <div
        className="aware-flee-needle"
        style={{
          left: `${origin.x}%`,
          top: `${origin.y}%`,
          transform: `translate(-50%, -100%) rotate(${bearingDeg}deg) scale(var(--aware-marker-inv-zoom, 1))`,
        }}
        title={`Observert flukt ${compassLabel}${cueDist != null ? ` · ca. ${cueDist} m` : ""}`}
      />
      {cueDist != null && labelAt ? (
        <span
          className="aware-flee-dist-label"
          style={{
            left: `${labelAt.x}%`,
            top: `${labelAt.y}%`,
          }}
        >
          ca. {cueDist} m
        </span>
      ) : null}
    </div>
  );
}
