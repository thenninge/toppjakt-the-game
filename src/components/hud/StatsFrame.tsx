"use client";

import type { PlayerStats } from "@/lib/player";

type StatsFrameProps = {
  stats: PlayerStats;
};

function formatRange(meters: number): string {
  if (meters <= 0) return "—";
  return `${meters} m`;
}

/** Compact sticky hunter strip — keeps main content visible. */
export function StatsFrame({ stats }: StatsFrameProps) {
  return (
    <aside className="stats-frame" aria-label="Player stats">
      <div className="stats-frame-title">Hunter Status</div>
      <dl className="stats-grid">
        <div className="stats-item">
          <dt>Navn</dt>
          <dd>{stats.name || "—"}</dd>
        </div>
        <div className="stats-item">
          <dt>Nick</dt>
          <dd>{stats.nickname ? `"${stats.nickname}"` : "—"}</dd>
        </div>
        <div className="stats-item">
          <dt>Konto</dt>
          <dd>{stats.balance.toLocaleString("nb-NO")} kr</dd>
        </div>
        <div className="stats-item">
          <dt>Orrhaner</dt>
          <dd>{stats.orrhaner}</dd>
        </div>
        <div className="stats-item">
          <dt>Tiur</dt>
          <dd>{stats.tiur}</dd>
        </div>
        <div className="stats-item">
          <dt>Max Range</dt>
          <dd>{formatRange(stats.maxRange)}</dd>
        </div>
      </dl>
    </aside>
  );
}
