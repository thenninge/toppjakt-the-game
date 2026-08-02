/**
 * Player preference: while holding focus (F), either pan the target under a
 * fixed reticle, or move the reticle over a stationary view
 * (hamburger → Move reticle/target).
 *
 * Reticle-move applies only while focus is held — otherwise the player pans
 * the spotting / range scene as usual so the full view stays reachable.
 */

export type ScopeAimControl = "target" | "reticle";

export const SCOPE_AIM_CONTROLS: readonly ScopeAimControl[] = [
  "target",
  "reticle",
] as const;

export const DEFAULT_SCOPE_AIM_CONTROL: ScopeAimControl = "target";

export function normalizeScopeAimControl(
  raw: unknown,
  fallback: ScopeAimControl = DEFAULT_SCOPE_AIM_CONTROL,
): ScopeAimControl {
  if (raw === "target" || raw === "reticle") return raw;
  return fallback;
}

/** True when preference is reticle and focus (F) is currently held. */
export function scopeMoveReticleActive(
  aimControl: ScopeAimControl,
  focusHeld: boolean,
): boolean {
  return aimControl === "reticle" && focusHeld;
}

/**
 * Split aim+wobble into world pan vs reticle translate (mm).
 * {@link frozenBase} is the aim snapshot when focus began (reticle mode).
 * Without focus held, always pans the world — full scene remains reachable.
 */
export function scopeAimPaintMm(opts: {
  aimControl: ScopeAimControl;
  focusHeld: boolean;
  aim: { x: number; y: number };
  wobble: { x: number; y: number };
  frozenBase: { x: number; y: number };
}): {
  worldX: number;
  worldY: number;
  reticleX: number;
  reticleY: number;
} {
  const { aimControl, focusHeld, aim, wobble, frozenBase } = opts;
  if (scopeMoveReticleActive(aimControl, focusHeld)) {
    return {
      worldX: frozenBase.x,
      worldY: frozenBase.y,
      reticleX: aim.x - frozenBase.x + wobble.x,
      reticleY: aim.y - frozenBase.y + wobble.y,
    };
  }
  return {
    worldX: aim.x + wobble.x,
    worldY: aim.y + wobble.y,
    reticleX: 0,
    reticleY: 0,
  };
}
