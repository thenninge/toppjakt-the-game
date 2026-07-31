"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

export const APP_RANGE_MIN_M = 50;
export const APP_RANGE_MAX_M = 1000;

export function clampAppRangeM(
  n: number,
  minM = APP_RANGE_MIN_M,
  maxM = APP_RANGE_MAX_M,
): number {
  if (!Number.isFinite(n)) return minM;
  const stepped = Math.round(n * 10) / 10;
  return Math.min(maxM, Math.max(minM, stepped));
}

type EditableRangeMetersProps = {
  valueM: number;
  onChange: (m: number) => void;
  minM?: number;
  maxM?: number;
  /** Display digits after decimal (0 = integer). */
  decimals?: 0 | 1;
  className?: string;
  inputClassName?: string;
  ariaLabel?: string;
};

/**
 * Tap readout → type range in meters → Enter/blur commits.
 */
export function EditableRangeMeters({
  valueM,
  onChange,
  minM = APP_RANGE_MIN_M,
  maxM = APP_RANGE_MAX_M,
  decimals = 0,
  className,
  inputClassName,
  ariaLabel = "Avstand i meter — trykk for å taste inn",
}: EditableRangeMetersProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [editing]);

  function formatDisplay(m: number): string {
    return decimals === 0 ? String(Math.round(m)) : m.toFixed(1);
  }

  function beginEdit() {
    setDraft(formatDisplay(valueM));
    setEditing(true);
  }

  function commit() {
    const parsed = Number(String(draft).replace(",", ".").trim());
    if (Number.isFinite(parsed)) {
      onChange(clampAppRangeM(parsed, minM, maxM));
    }
    setEditing(false);
  }

  function cancel() {
    setEditing(false);
  }

  function onKeyDown(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  }

  if (editing) {
    return (
      <span className={className}>
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          className={inputClassName ?? "app-range-input"}
          min={minM}
          max={maxM}
          step={decimals === 0 ? 1 : 0.1}
          value={draft}
          aria-label={ariaLabel}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
        />{" "}
        <small>m</small>
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className ? `${className} app-range-edit-btn` : "app-range-edit-btn"}
      aria-label={ariaLabel}
      title="Trykk for å taste inn avstand"
      onClick={beginEdit}
    >
      {formatDisplay(valueM)} <small>m</small>
    </button>
  );
}
