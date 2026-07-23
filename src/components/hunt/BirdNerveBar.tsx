"use client";

type BirdNerveBarProps = {
  nerve: number;
  threshold: number;
  /** Optional wrapper class (e.g. hunt scope placement). */
  className?: string;
};

/**
 * Horizontal bird-nervousness meter (Aware + hunt scope).
 * Fill is nerve / flushThreshold (100% = letter).
 */
export function BirdNerveBar({
  nerve,
  threshold,
  className,
}: BirdNerveBarProps) {
  const pct = Math.min(
    100,
    Math.max(0, (nerve / Math.max(1e-6, threshold)) * 100),
  );
  const hot = pct >= 75;
  return (
    <div
      className={className ? `aware-nerve-wrap ${className}` : "aware-nerve-wrap"}
      role="meter"
      aria-label="Fuglens nervøsitet"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className="aware-nerve-label">
        <span>Nervøsitet</span>
        <span>
          {pct.toFixed(0)}%
          {pct >= 100 ? " — letter!" : ""}
        </span>
      </div>
      <div className="aware-nerve-track">
        <div
          className={
            hot ? "aware-nerve-fill aware-nerve-fill-hot" : "aware-nerve-fill"
          }
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
