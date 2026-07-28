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
  children: ReactNode;
  className?: string;
};

/**
 * Tube-mounted realistic turrets around the optic glass
 * (elevation / parallax / windage) — used by Admin → Scopes and
 * hunt/shoot when Realism = High.
 */
export function ScopeTubeLayout({
  scopeId,
  elevation,
  parallax,
  windage,
  focusRail,
  triggerRail,
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
    >
      {focusRail ? (
        <div className="scope-tube-rail scope-tube-rail--focus">
          {focusRail}
        </div>
      ) : null}
      <div className="scope-tube-elev">{elevation}</div>
      {triggerRail ? (
        <div className="scope-tube-rail scope-tube-rail--trigger">
          {triggerRail}
        </div>
      ) : null}
      <div className="scope-tube-para">{parallax}</div>
      <div className="scope-tube-optic">{children}</div>
      <div className="scope-tube-wind">{windage}</div>
    </div>
  );
}

type MaybeScopeTubeProps = ScopeTubeLayoutProps & {
  /** When false, render children only (classic sidebar turrets). */
  enabled: boolean;
};

/** Conditionally wraps the optic in {@link ScopeTubeLayout}. */
export function MaybeScopeTube({
  enabled,
  children,
  ...tube
}: MaybeScopeTubeProps) {
  if (!enabled) return children;
  return <ScopeTubeLayout {...tube}>{children}</ScopeTubeLayout>;
}
