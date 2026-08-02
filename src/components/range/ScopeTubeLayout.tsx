"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  turretStyleCssVars,
  turretStyleForScope,
} from "@/lib/optics/turretStyle";

type ScopeTubeLayoutProps = {
  /** Equipped scope catalog id — drives per-optic chrome. */
  scopeId?: string | null;
  elevation: ReactNode;
  parallax: ReactNode;
  windage: ReactNode;
  /** Optional short focus bar — sits above the parallax turret. */
  focusRail?: ReactNode;
  /** Optional short trigger bar — sits above the windage turret. */
  triggerRail?: ReactNode;
  /**
   * Classic HUD (medium): focus/trigger rails in the same High grid
   * cells, with invisible elev/para/wind spacers so focus-zoom does
   * not cover the bars.
   */
  railsOnly?: boolean;
  children: ReactNode;
  className?: string;
};

/**
 * Tube-mounted realistic turrets around the optic glass
 * (elevation / parallax / windage) — used by Admin → Scopes and
 * hunt/shoot when Realism = High. With {@link railsOnly}, only the
 * short focus/trigger rails wrap the glass (medium).
 */
export function ScopeTubeLayout({
  scopeId,
  elevation,
  parallax,
  windage,
  focusRail,
  triggerRail,
  railsOnly = false,
  children,
  className,
}: ScopeTubeLayoutProps) {
  const style = turretStyleForScope(scopeId);
  const vars = turretStyleCssVars(style) as CSSProperties;
  return (
    <div
      className={
        className
          ? `scope-tube-layout ${className}`
          : "scope-tube-layout"
      }
      style={vars}
      data-turret-style={style.id}
      data-has-rails={focusRail || triggerRail ? "true" : undefined}
      data-rails-only={railsOnly ? "true" : undefined}
    >
      {focusRail ? (
        <div className="scope-tube-rail scope-tube-rail--focus">
          {focusRail}
        </div>
      ) : null}
      <div
        className={
          railsOnly
            ? "scope-tube-elev scope-tube-cell--spacer"
            : "scope-tube-elev"
        }
        aria-hidden={railsOnly || undefined}
      >
        {railsOnly ? null : elevation}
      </div>
      {triggerRail ? (
        <div className="scope-tube-rail scope-tube-rail--trigger">
          {triggerRail}
        </div>
      ) : null}
      <div
        className={
          railsOnly
            ? "scope-tube-para scope-tube-cell--spacer"
            : "scope-tube-para"
        }
        aria-hidden={railsOnly || undefined}
      >
        {railsOnly ? null : parallax}
      </div>
      <div className="scope-tube-optic">{children}</div>
      <div
        className={
          railsOnly
            ? "scope-tube-wind scope-tube-cell--spacer"
            : "scope-tube-wind"
        }
        aria-hidden={railsOnly || undefined}
      >
        {railsOnly ? null : windage}
      </div>
    </div>
  );
}

type MaybeScopeTubeProps = ScopeTubeLayoutProps & {
  /** When true, full tube turrets (elev/para/wind). */
  enabled: boolean;
  /**
   * When true and {@link enabled} is false, wrap optic with focus/trigger
   * rails in the High grid positions (classic HUD / medium).
   */
  railsOnly?: boolean;
};

/** Conditionally wraps the optic in {@link ScopeTubeLayout}. */
export function MaybeScopeTube({
  enabled,
  railsOnly = false,
  children,
  ...tube
}: MaybeScopeTubeProps) {
  if (!enabled && !railsOnly) return children;
  return (
    <ScopeTubeLayout {...tube} railsOnly={!enabled && railsOnly}>
      {children}
    </ScopeTubeLayout>
  );
}
