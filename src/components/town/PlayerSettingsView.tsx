"use client";

import { LocationNav } from "@/components/town/LocationNav";
import {
  DEFAULT_FOCUS_TRIGGER_BAR_LENGTH,
  DEFAULT_SCOPE_ZOOM_ON_FOCUS,
  DEFAULT_ZEN_MODE,
  type FocusTriggerBarLength,
} from "@/lib/range/playerScopeSettings";
import {
  DEFAULT_SCOPE_AIM_CONTROL,
  SCOPE_AIM_CONTROLS,
  type ScopeAimControl,
} from "@/lib/range/scopeAimControl";
import {
  GAME_REALISM_LEVELS,
  type GameRealism,
} from "@/lib/optics/turretStyle";

type PlayerSettingsViewProps = {
  onLeave: () => void;
  realism: GameRealism;
  onRealismChange: (realism: GameRealism) => void;
  scopeAimControl: ScopeAimControl;
  onScopeAimControlChange: (control: ScopeAimControl) => void;
  scopeZoomOnFocus: boolean;
  onScopeZoomOnFocusChange: (on: boolean) => void;
  focusTriggerBarLength: FocusTriggerBarLength;
  onFocusTriggerBarLengthChange: (length: FocusTriggerBarLength) => void;
  zenMode: boolean;
  onZenModeChange: (on: boolean) => void;
};

/**
 * Town → Settings: player custom scope / realism choices.
 * UI mirrors Admin realism controls (checkbox / choice rows).
 */
export function PlayerSettingsView({
  onLeave,
  realism,
  onRealismChange,
  scopeAimControl,
  onScopeAimControlChange,
  scopeZoomOnFocus,
  onScopeZoomOnFocusChange,
  focusTriggerBarLength,
  onFocusTriggerBarLengthChange,
  zenMode,
  onZenModeChange,
}: PlayerSettingsViewProps) {
  return (
    <div className="admin-office player-settings">
      <LocationNav onBackToTown={onLeave} />
      <p className="intro-line intro-gift">Settings</p>
      <p className="intro-line">
        Egne valg for sikte og fokus. Lagres med jegeren og gjelder både
        skytebane og jakt (Zen gjelder jakt / Aware).
      </p>

      <section className="admin-spot-controls" aria-label="Scope focus">
        <p className="intro-line intro-gift">Scope &amp; fokus</p>
        <div className="admin-spot-allow">
          <label className="admin-spot-allow-row">
            <input
              type="checkbox"
              checked={scopeZoomOnFocus}
              onChange={(e) => onScopeZoomOnFocusChange(e.target.checked)}
            />
            <span>
              Scope zoom on focus
              <span className="admin-spot-allow-hint">
                {" "}
                — av = aldri; på = zoom under Fokus (F) på skytebane og jakt
                {scopeZoomOnFocus === DEFAULT_SCOPE_ZOOM_ON_FOCUS
                  ? ""
                  : " · endret"}
              </span>
            </span>
          </label>
          <label className="admin-spot-allow-row">
            <input
              type="checkbox"
              checked={zenMode}
              onChange={(e) => onZenModeChange(e.target.checked)}
            />
            <span>
              Zen mode
              <span className="admin-spot-allow-hint">
                {" "}
                — jakt: ingen nerve over tid / Deploy / anlegg; bevegelse på
                Aware-kartet øker fortsatt nerve
                {zenMode !== DEFAULT_ZEN_MODE ? " · på" : ""}
              </span>
            </span>
          </label>
        </div>

        <p className="admin-spot-allow-hint" style={{ marginTop: "0.75rem" }}>
          Focus &amp; trigger bar (skytebane + jakt)
        </p>
        <div className="admin-spot-allow">
          {(
            [
              {
                id: "short" as const,
                label: "Short",
                hint: "som nå / Realism High (~40 % høyde)",
              },
              {
                id: "long" as const,
                label: "Long",
                hint: "klassisk høy bar ved siden av glasset",
              },
            ] as const
          ).map((opt) => (
            <label key={opt.id} className="admin-spot-allow-row">
              <input
                type="radio"
                name="focus-trigger-bar-length"
                checked={focusTriggerBarLength === opt.id}
                onChange={() => onFocusTriggerBarLengthChange(opt.id)}
              />
              <span>
                {opt.label}
                <span className="admin-spot-allow-hint"> — {opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {focusTriggerBarLength !== DEFAULT_FOCUS_TRIGGER_BAR_LENGTH ? (
          <p className="admin-spot-allow-hint">Bar-lengde endret fra default.</p>
        ) : null}
      </section>

      <section className="admin-spot-controls" aria-label="Realism">
        <p className="intro-line intro-gift">Realism</p>
        <p className="admin-spot-allow-hint">
          Low = assistert · Medium = klassiske tårn · High = tårn på tuben.
        </p>
        <div className="admin-spot-allow">
          {GAME_REALISM_LEVELS.map((level) => (
            <label key={level} className="admin-spot-allow-row">
              <input
                type="radio"
                name="player-realism"
                checked={realism === level}
                onChange={() => onRealismChange(level)}
              />
              <span>
                {level === "high"
                  ? "High"
                  : level === "low"
                    ? "Low"
                    : "Medium"}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="admin-spot-controls" aria-label="Aim control">
        <p className="intro-line intro-gift">Move reticle / target</p>
        <p className="admin-spot-allow-hint">
          Reticle (while F): flytt sikte under fokus. Ellers panorerer du
          landskapet.
        </p>
        <div className="admin-spot-allow">
          {SCOPE_AIM_CONTROLS.map((control) => (
            <label key={control} className="admin-spot-allow-row">
              <input
                type="radio"
                name="scope-aim-control"
                checked={scopeAimControl === control}
                onChange={() => onScopeAimControlChange(control)}
              />
              <span>
                {control === "reticle"
                  ? "Reticle (while F)"
                  : "Target / landscape"}
                {control === DEFAULT_SCOPE_AIM_CONTROL ? (
                  <span className="admin-spot-allow-hint"> · default</span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </section>

      <p className="intro-line admin-spot-allow-hint">
        Tips: Focus- og avtrekksbaren er trykkbare (hold) — samme som F og
        Space — praktisk på mobil.
      </p>
    </div>
  );
}
