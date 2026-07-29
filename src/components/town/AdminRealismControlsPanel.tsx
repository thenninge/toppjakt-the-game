"use client";

import { useEffect, useState } from "react";
import {
  GAME_REALISM_LEVELS,
  type GameRealism,
} from "@/lib/optics/turretStyle";
import {
  DEFAULT_REALISM_CONTROLS,
  REALISM_FEATURE_LABELS,
  getRealismControls,
  patchRealismLevelFeatures,
  patchRealismParams,
  resetRealismControlsToDefaults,
  subscribeRealismControls,
  type RealismFeatureKey,
  type RealismParams,
} from "@/lib/range/realismControls";

type AdminRealismControlsPanelProps = {
  onLeave: () => void;
};

const FEATURE_KEYS = Object.keys(
  REALISM_FEATURE_LABELS,
) as RealismFeatureKey[];

const PARAM_FIELDS: {
  key: keyof RealismParams;
  label: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}[] = [
  {
    key: "cantEntrySpreadDeg",
    label: "Cant entry spread",
    min: 0.5,
    max: 12,
    step: 0.1,
    unit: "°",
  },
  {
    key: "cantUiMaxDeg",
    label: "Cant UI max",
    min: 2,
    max: 20,
    step: 0.5,
    unit: "°",
  },
  {
    key: "parallaxBlurMult",
    label: "Parallax blur multiplier",
    min: 0,
    max: 3,
    step: 0.05,
    unit: "×",
  },
  {
    key: "focusAbortMs",
    label: "Focus abort",
    min: 2000,
    max: 20000,
    step: 100,
    unit: "ms",
  },
  {
    key: "triggerBarMs",
    label: "Trigger bar duration",
    min: 500,
    max: 8000,
    step: 50,
    unit: "ms",
  },
];

/** Admin: toggles + params for medium / high realism gameplay. */
export function AdminRealismControlsPanel({
  onLeave: _onLeave,
}: AdminRealismControlsPanelProps) {
  const [epoch, setEpoch] = useState(0);
  useEffect(() => subscribeRealismControls(() => setEpoch((n) => n + 1)), []);

  const state = getRealismControls();
  void epoch;

  return (
    <div className="admin-office">
      <p className="intro-line intro-gift">Realism controls</p>
      <p className="intro-line">
        Skru av/på funksjoner per realism-nivå og juster parametere brukt i
        jakt og skytebane. Lagres lokalt i nettleseren (ingen bake til repo).
      </p>

      <div className="admin-realism-grid">
        {GAME_REALISM_LEVELS.map((level) => (
          <RealismLevelCard
            key={level}
            level={level}
            features={state.features[level]}
          />
        ))}
      </div>

      <div className="admin-spot-controls admin-realism-params">
        <p className="intro-line intro-gift">Shared parameters</p>
        <p className="admin-spot-allow-hint">
          Brukes når tilsvarende funksjon er på for aktivt realism-nivå.
        </p>
        {PARAM_FIELDS.map((field) => {
          const value = state.params[field.key];
          const def = DEFAULT_REALISM_CONTROLS.params[field.key];
          return (
            <label key={field.key} className="admin-spot-allow-row admin-realism-param-row">
              <span>
                {field.label}
                <span className="admin-spot-allow-hint">
                  {" "}
                  (default {def}
                  {field.unit})
                </span>
              </span>
              <span className="admin-realism-param-controls">
                <input
                  type="range"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={value}
                  onChange={(e) =>
                    patchRealismParams({
                      [field.key]: Number(e.target.value),
                    })
                  }
                />
                <input
                  type="number"
                  className="admin-spot-scale-num"
                  min={field.min}
                  max={field.max}
                  step={field.step}
                  value={value}
                  onChange={(e) =>
                    patchRealismParams({
                      [field.key]: Number(e.target.value),
                    })
                  }
                />
                <span>{field.unit}</span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="admin-spot-row">
        <button
          type="button"
          className="intro-button"
          onClick={() => resetRealismControlsToDefaults()}
        >
          Tilbakestill defaults
        </button>
      </div>
    </div>
  );
}

function RealismLevelCard({
  level,
  features,
}: {
  level: GameRealism;
  features: Record<RealismFeatureKey, boolean>;
}) {
  const title =
    level === "high" ? "High" : level === "low" ? "Low" : "Medium";
  return (
    <section className="admin-spot-controls" aria-label={`${title} features`}>
      <p className="intro-line intro-gift">{title}</p>
      <div className="admin-spot-allow">
        {FEATURE_KEYS.map((key) => (
          <label key={key} className="admin-spot-allow-row">
            <input
              type="checkbox"
              checked={features[key]}
              onChange={(e) =>
                patchRealismLevelFeatures(level, { [key]: e.target.checked })
              }
            />
            <span>{REALISM_FEATURE_LABELS[key]}</span>
          </label>
        ))}
      </div>
    </section>
  );
}
