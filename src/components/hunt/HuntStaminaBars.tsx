"use client";

import { clampFatigue } from "@/lib/hunt/travel";

type StaminaBarProps = {
  label: string;
  value: number;
  /** Optional fill color override (e.g. battery / bird). */
  fillClassName?: string;
};

function StaminaBar({ label, value, fillClassName }: StaminaBarProps) {
  const pct = Math.round(clampFatigue(value) * 100);

  return (
    <div
      className="hunt-stamina-bar"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pct}%`}
      title={`${label} ${pct}%`}
    >
      <div className="hunt-stamina-bar-track">
        <div
          className={
            fillClassName
              ? `hunt-stamina-bar-fill ${fillClassName}`
              : "hunt-stamina-bar-fill"
          }
          style={{ height: `${pct}%` }}
        />
      </div>
      <span className="hunt-stamina-bar-label" aria-hidden>
        {label.split("").map((ch, i) => (
          <span key={`${label}-${i}`}>{ch}</span>
        ))}
      </span>
    </div>
  );
}

type HuntStaminaBarsProps = {
  /** Remaining physical stamina 0–1 (1 = fresh). */
  physical: number;
  /** Remaining mental stamina 0–1 (1 = fresh). */
  mental: number;
  /**
   * Remaining thermal battery 0–1 (1 = full).
   * Shown left of BODY when provided (kit has thermal).
   */
  thermalBattery?: number | null;
  /**
   * Bird nervousness 0–1 (1 = flush). Shown left of BATT/BODY after LRF/click lock.
   */
  birdNerve?: number | null;
};

export function HuntStaminaBars({
  physical,
  mental,
  thermalBattery = null,
  birdNerve = null,
}: HuntStaminaBarsProps) {
  return (
    <div className="hunt-stamina-bars" aria-label="Stamina">
      {birdNerve != null ? (
        <StaminaBar
          label="BIRD"
          value={birdNerve}
          fillClassName="hunt-stamina-bar-fill-bird"
        />
      ) : null}
      {thermalBattery != null ? (
        <StaminaBar
          label="BATT"
          value={thermalBattery}
          fillClassName="hunt-stamina-bar-fill-batt"
        />
      ) : null}
      <StaminaBar label="BODY" value={physical} />
      <StaminaBar label="MIND" value={mental} />
    </div>
  );
}
