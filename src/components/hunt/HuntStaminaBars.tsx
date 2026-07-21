"use client";

import { clampFatigue } from "@/lib/hunt/travel";

type StaminaBarProps = {
  label: string;
  value: number;
};

function StaminaBar({ label, value }: StaminaBarProps) {
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
          className="hunt-stamina-bar-fill"
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
};

export function HuntStaminaBars({ physical, mental }: HuntStaminaBarsProps) {
  return (
    <div className="hunt-stamina-bars" aria-label="Stamina">
      <StaminaBar label="BODY" value={physical} />
      <StaminaBar label="MIND" value={mental} />
    </div>
  );
}
