/**
 * Per-scope realistic turret chrome (sizes, fonts, tube span).
 * Lookup falls back to {@link DEFAULT_TURRET_STYLE} when a scope has no entry.
 * ZCO 5-27 MCT is explicitly keyed — current admin tube look is that scope’s face.
 */

export type GameRealism = "low" | "medium" | "high";

export const GAME_REALISM_LEVELS: readonly GameRealism[] = [
  "low",
  "medium",
  "high",
] as const;

export const DEFAULT_GAME_REALISM: GameRealism = "medium";

/** Catalog id for Zero Compromise ZCO 5-27×56 MCT. */
export const SCOPE_ID_ZCO_527_MCT = "scope-zco-527-mct";

export type ScopeTurretStyle = {
  /** Stable id for debugging / CSS data attrs. */
  id: string;
  /** Vertical side-turret height / elevation horizontal span. */
  tubeTurretSpan: string;
  /** Windage major number size (tube). */
  windageNumFontSize: string;
  /** Elevation major number size (tube). */
  elevationNumFontSize: string;
  /** Parallax distance mark size (tube). */
  parallaxNumFontSize: string;
  /** Index housing strip width (windage / parallax). */
  indexHousingWidth: string;
};

/**
 * Default realistic tube chrome — used for any scope without an override,
 * and matches the ZCO527 face we built in Admin → Scopes.
 */
export const DEFAULT_TURRET_STYLE: ScopeTurretStyle = {
  id: "default",
  tubeTurretSpan: "11.5rem",
  windageNumFontSize: "1.24rem",
  elevationNumFontSize: "1.24rem",
  parallaxNumFontSize: "0.72rem",
  indexHousingWidth: "0.9rem",
};

/**
 * Explicit per-scope overrides. ZCO527 points at the same chrome as default
 * so the realistic turrets are owned by that optic in config.
 */
export const SCOPE_TURRET_STYLES: Readonly<Record<string, ScopeTurretStyle>> = {
  [SCOPE_ID_ZCO_527_MCT]: {
    ...DEFAULT_TURRET_STYLE,
    id: SCOPE_ID_ZCO_527_MCT,
  },
};

export function normalizeGameRealism(
  raw: unknown,
  fallback: GameRealism = DEFAULT_GAME_REALISM,
): GameRealism {
  if (raw === "low" || raw === "medium" || raw === "high") return raw;
  return fallback;
}

export function turretStyleForScope(
  scopeId: string | null | undefined,
): ScopeTurretStyle {
  if (scopeId && SCOPE_TURRET_STYLES[scopeId]) {
    return SCOPE_TURRET_STYLES[scopeId]!;
  }
  return DEFAULT_TURRET_STYLE;
}

/** CSS custom properties for `.scope-tube-layout`. */
export function turretStyleCssVars(
  style: ScopeTurretStyle,
): Record<string, string> {
  return {
    ["--scope-tube-turret-span"]: style.tubeTurretSpan,
    ["--scope-tube-wind-num-size"]: style.windageNumFontSize,
    ["--scope-tube-elev-num-size"]: style.elevationNumFontSize,
    ["--scope-tube-para-num-size"]: style.parallaxNumFontSize,
    ["--scope-tube-index-housing"]: style.indexHousingWidth,
  };
}
