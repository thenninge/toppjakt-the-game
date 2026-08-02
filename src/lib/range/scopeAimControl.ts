/**
 * Player preference: pan the target/landscape under a fixed reticle, or
 * move the reticle over a stationary target (hamburger → Move reticle/target).
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

/**
 * Split aim+wobble into world pan vs reticle translate (mm).
 * {@link frozenBase} is the aim snapshot when reticle mode engaged / session start.
 */
export function scopeAimPaintMm(opts: {
  aimControl: ScopeAimControl;
  aim: { x: number; y: number };
  wobble: { x: number; y: number };
  frozenBase: { x: number; y: number };
}): {
  worldX: number;
  worldY: number;
  reticleX: number;
  reticleY: number;
} {
  const { aimControl, aim, wobble, frozenBase } = opts;
  if (aimControl === "reticle") {
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
