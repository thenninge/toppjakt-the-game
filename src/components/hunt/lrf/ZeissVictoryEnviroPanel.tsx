"use client";

import { useEffect, useRef, useState } from "react";
import {
  ZeissVictoryLrfHud,
  ZEISS_VICTORY_ACQUIRE_MS,
  ZEISS_VICTORY_PHASE_MS,
  type ZeissVictoryLrfPhase,
} from "@/components/hunt/lrf/ZeissVictoryLrfHud";

type ZeissVictoryEnviroPanelProps = {
  rangeM: number;
  /** Elevation clicks for current range (null = no solution). */
  elevClicks: number | null;
  label?: string;
};

/**
 * Enviro/App panel: Zeiss Victory RF emulation (replay range → elev sequence).
 */
export function ZeissVictoryEnviroPanel({
  rangeM,
  elevClicks,
  label = "Zeiss Victory RF",
}: ZeissVictoryEnviroPanelProps) {
  const [phase, setPhase] = useState<ZeissVictoryLrfPhase>("idle");
  const timersRef = useRef<number[]>([]);

  function clearTimers() {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }

  useEffect(() => () => clearTimers(), []);

  function playSequence() {
    clearTimers();
    setPhase("idle");
    timersRef.current.push(
      window.setTimeout(() => {
        setPhase("range");
      }, ZEISS_VICTORY_ACQUIRE_MS),
    );
    timersRef.current.push(
      window.setTimeout(() => {
        setPhase(elevClicks == null ? "done" : "elev");
      }, ZEISS_VICTORY_ACQUIRE_MS + ZEISS_VICTORY_PHASE_MS),
    );
    if (elevClicks != null) {
      timersRef.current.push(
        window.setTimeout(() => {
          setPhase("done");
        }, ZEISS_VICTORY_ACQUIRE_MS + ZEISS_VICTORY_PHASE_MS * 2),
      );
    }
  }

  return (
    <div className="zeiss-victory-enviro" aria-label="Zeiss Victory RF">
      <p className="zeiss-victory-enviro-title">{label}</p>
      <div className="zeiss-victory-enviro-bezel">
        <ZeissVictoryLrfHud
          phase={phase}
          rangeM={Math.round(rangeM)}
          elevClicks={elevClicks}
          bluetooth
        />
      </div>
      <div className="zeiss-victory-enviro-actions">
        <button
          type="button"
          className="intro-button spot-lrf-btn"
          onClick={playSequence}
        >
          Range
        </button>
      </div>
      <p className="zeiss-victory-enviro-hint">
        3 s avstand (m) → 3 s elev-klikk → blank. Samme display som i spotting.
      </p>
    </div>
  );
}
