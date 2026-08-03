/**
 * Player-facing scope / focus UI preferences (Town → Settings).
 * Persisted on {@link PlayerStats} (save + cloud), separate from admin
 * realism feature toggles in localStorage.
 */

/** Master switch: focus immersion zoom while holding F / Focus. */
export type ScopeZoomOnFocus = boolean;

/**
 * Focus / trigger bar height.
 * - short — current Realism High / medium rails (~40% of turret span)
 * - long — classic taller bars beside the glass
 */
export type FocusTriggerBarLength = "short" | "long";

export const FOCUS_TRIGGER_BAR_LENGTHS = [
  "short",
  "long",
] as const satisfies readonly FocusTriggerBarLength[];

export const DEFAULT_SCOPE_ZOOM_ON_FOCUS: ScopeZoomOnFocus = true;
export const DEFAULT_FOCUS_TRIGGER_BAR_LENGTH: FocusTriggerBarLength =
  "short";
/** Off by default — practice mode freezes passive bird-nerve. */
export const DEFAULT_ZEN_MODE = false;

export function normalizeScopeZoomOnFocus(
  raw: unknown,
  fallback: ScopeZoomOnFocus = DEFAULT_SCOPE_ZOOM_ON_FOCUS,
): ScopeZoomOnFocus {
  if (raw === true || raw === false) return raw;
  return fallback;
}

export function normalizeFocusTriggerBarLength(
  raw: unknown,
  fallback: FocusTriggerBarLength = DEFAULT_FOCUS_TRIGGER_BAR_LENGTH,
): FocusTriggerBarLength {
  if (raw === "short" || raw === "long") return raw;
  return fallback;
}

export function normalizeZenMode(
  raw: unknown,
  fallback = DEFAULT_ZEN_MODE,
): boolean {
  if (raw === true || raw === false) return raw;
  return fallback;
}
