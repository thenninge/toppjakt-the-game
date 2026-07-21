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
};

/**
 * Visible skuddpar: stand → dashed line → aim point + ~20 m search ring.
 */
export function ShotPairOverlay({ pair, active = false }: ShotPairOverlayProps) {
  const aim = shotPairAimPoint(pair);
  const ringPct = (SHOT_PAIR_SEARCH_RADIUS_M / AWARE_METERS_PER_PCT) * 2;

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
          height: `${ringPct}%`,
        }}
        title={`Søkeradius ~${SHOT_PAIR_SEARCH_RADIUS_M} m`}
      />
      <span
        className="aware-pair-impact"
        style={{ left: `${aim.x}%`, top: `${aim.y}%` }}
        title="Skutt mot (tre / fugl)"
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
  aim: { x: number; y: number };
};

/** Live preview while defining a skuddpar in the Shoot wizard. */
export function ShotPairPreview({ stand, aim }: ShotPairPreviewProps) {
  const ringPct = (SHOT_PAIR_SEARCH_RADIUS_M / AWARE_METERS_PER_PCT) * 2;
  return (
    <div className="aware-skuddpar aware-skuddpar-preview" aria-hidden>
      <svg className="aware-skuddpar-line" viewBox="0 0 100 100" preserveAspectRatio="none">
        <line
          x1={stand.x}
          y1={stand.y}
          x2={aim.x}
          y2={aim.y}
          className="aware-skuddpar-dash"
        />
      </svg>
      <span
        className="aware-pair-stand"
        style={{ left: `${stand.x}%`, top: `${stand.y}%` }}
      />
      <div
        className="aware-skuddpar-search"
        style={{
          left: `${aim.x}%`,
          top: `${aim.y}%`,
          width: `${ringPct}%`,
          height: `${ringPct}%`,
        }}
      />
      <span
        className="aware-pair-impact"
        style={{ left: `${aim.x}%`, top: `${aim.y}%` }}
      />
    </div>
  );
}
