"use client";

type BarrelHeatBarProps = {
  heat01: number;
  className?: string;
};

/**
 * Horizontal barrel-heat meter above the range scope (same layout as bird nerve).
 */
export function BarrelHeatBar({ heat01, className }: BarrelHeatBarProps) {
  const pct = Math.min(100, Math.max(0, heat01 * 100));
  /** Mirage visible from 25 % heat. */
  const mirageZone = pct >= 25;
  const porridge = pct >= 90;
  return (
    <div
      className={
        className ? `aware-nerve-wrap ${className}` : "aware-nerve-wrap"
      }
      role="meter"
      aria-label="Pipevarme"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className="aware-nerve-label">
        <span>Barrel heat</span>
        <span>
          {pct.toFixed(0)}%
          {porridge ? " — grøt!" : mirageZone ? " — mirage" : ""}
        </span>
      </div>
      <div className="aware-nerve-track">
        <div
          className={
            porridge
              ? "aware-nerve-fill aware-nerve-fill-hot barrel-heat-fill-porridge"
              : mirageZone
                ? "aware-nerve-fill aware-nerve-fill-hot"
                : "aware-nerve-fill"
          }
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
