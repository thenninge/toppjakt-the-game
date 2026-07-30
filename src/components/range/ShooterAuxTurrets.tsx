"use client";

import { IlluminationTurret } from "@/components/range/IlluminationTurret";
import { ParallaxTurret } from "@/components/range/ParallaxTurret";
import { nudgeParallaxFocusM } from "@/lib/range/parallaxFocus";

export type ShooterAuxTurretsProps = {
  parallaxFocusM: number;
  onParallaxChange: (focusM: number) => void;
  reticleIllum: number;
  onIllumChange: (value: number) => void;
  disabled?: boolean;
  /** ZCO-style bipolar red/green drum. */
  bipolar?: boolean;
};

/**
 * Parallax + illumination drums in one Shooter-tab cell (realism low/medium).
 * Mirrors the tube-mounted para stack layout, sized for the HUD dial row.
 */
export function ShooterAuxTurrets({
  parallaxFocusM,
  onParallaxChange,
  reticleIllum,
  onIllumChange,
  disabled = false,
  bipolar = false,
}: ShooterAuxTurretsProps) {
  return (
    <div className="scope-turret scope-turret--aux scope-turret-view--shooter">
      <div className="scope-turret-head">
        <p className="scope-turret-title">Fokus</p>
        <p className="scope-turret-axis">Para · illum</p>
      </div>
      <div className="scope-turret-body scope-turrets-aux-body">
        <div className="scope-turrets-aux-stack">
          <IlluminationTurret
            value={reticleIllum}
            onChange={onIllumChange}
            disabled={disabled}
            bipolar={bipolar}
          />
          <ParallaxTurret
            focusM={parallaxFocusM}
            onChange={onParallaxChange}
            disabled={disabled}
          />
        </div>
        <div className="scope-turret-click-row">
          <button
            type="button"
            className="scope-turret-click scope-turret-click--neg"
            disabled={disabled}
            aria-label="Parallax nærmere"
            onClick={() =>
              onParallaxChange(nudgeParallaxFocusM(parallaxFocusM, -1))
            }
          >
            <span aria-hidden>▲</span>
          </button>
          <button
            type="button"
            className="scope-turret-click scope-turret-click--pos"
            disabled={disabled}
            aria-label="Parallax lenger"
            onClick={() =>
              onParallaxChange(nudgeParallaxFocusM(parallaxFocusM, 1))
            }
          >
            <span aria-hidden>▼</span>
          </button>
        </div>
      </div>
    </div>
  );
}
