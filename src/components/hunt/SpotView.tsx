"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  DEFAULT_BINOS_MAGNIFICATION,
  SPOT_TIME_FACTOR_BINOS,
  SPOT_TIME_FACTOR_EYES,
} from "@/lib/hunt/images";
import {
  findBirdUnderLrfReticle,
  visibleInSpotMode,
  type BirdVisualPlacement,
} from "@/lib/hunt/birds";
import {
  measureDistanceWithLrf,
  type LrfSpec,
} from "@/lib/optics/spec";
import { formatHuntClock } from "@/lib/hunt/travel";

export type SpotMode = "eyes" | "binos";

export type BirdObservedInfo = {
  placement: BirdVisualPlacement;
  measuredDistanceM: number;
  gameSeconds: number;
};

type SpotViewProps = {
  /** Same landscape for eyes and binos for the whole session. */
  imageSrc: string;
  /** Birds present in this cell, already placed in the landscape. */
  birdPlacements?: BirdVisualPlacement[];
  /** Optical magnification of equipped binos (e.g. 10). */
  magnification?: number;
  /** LRF error model — required to range a bird. */
  lrfSpec?: Pick<LrfSpec, "rangeErrorPercent"> | null;
  /** Absolute hunt clock in minutes (for HUD). */
  clockMinutes: number;
  /** Player has binoculars in kit. */
  hasBinos: boolean;
  /** Equipped binos have a laser rangefinder. */
  hasLrf?: boolean;
  /** Label for HUD, e.g. brand + name. */
  binosLabel?: string | null;
  /** Called with game-seconds elapsed while looking. */
  onGameSeconds: (seconds: number) => void;
  /** LRF locked a bird — parent enters shoot mode. */
  onBirdObserved: (info: BirdObservedInfo) => void;
  onDone: (info: { mode: SpotMode; gameSeconds: number }) => void;
};

function BirdOverlay({
  placement,
}: {
  placement: BirdVisualPlacement;
}) {
  return (
    <img
      src={placement.imageSrc}
      alt=""
      className="spot-bird"
      draggable={false}
      style={{
        left: `${placement.x}%`,
        top: `${placement.y}%`,
        width: `${placement.widthPct}%`,
        transform: placement.flip
          ? "translate(-50%, -50%) scaleX(-1)"
          : "translate(-50%, -50%)",
      }}
    />
  );
}

/**
 * Same landscape frame for eyes and binos (identical placement %).
 * Binos = circular crop + real optic zoom; pan 0–100 covers the full eyes view.
 */
export function SpotView({
  imageSrc,
  birdPlacements = [],
  magnification = DEFAULT_BINOS_MAGNIFICATION,
  lrfSpec = null,
  clockMinutes,
  hasBinos,
  hasLrf = false,
  binosLabel,
  onGameSeconds,
  onBirdObserved,
  onDone,
}: SpotViewProps) {
  const zoom = Math.max(1, magnification);
  const [mode, setMode] = useState<SpotMode>("eyes");
  const timeFactor =
    mode === "binos" ? SPOT_TIME_FACTOR_BINOS : SPOT_TIME_FACTOR_EYES;
  const [lookedGameSec, setLookedGameSec] = useState(0);
  const lookedRef = useRef(0);
  const modeRef = useRef<SpotMode>(mode);
  modeRef.current = mode;
  const onGameSecondsRef = useRef(onGameSeconds);
  onGameSecondsRef.current = onGameSeconds;

  const [pan, setPan] = useState({ x: 50, y: 40 });
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const [lrfReading, setLrfReading] = useState<string | null>(null);

  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const realSec = (now - last) / 1000;
      last = now;
      if (realSec <= 0 || realSec > 2) return;
      const factor =
        modeRef.current === "binos"
          ? SPOT_TIME_FACTOR_BINOS
          : SPOT_TIME_FACTOR_EYES;
      const gameSec = realSec * factor;
      lookedRef.current += gameSec;
      setLookedGameSec(lookedRef.current);
      onGameSecondsRef.current(gameSec);
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onDone({ mode: modeRef.current, gameSeconds: lookedRef.current });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  function enterBinos() {
    const focus =
      birdPlacements.find((p) => visibleInSpotMode(p.distanceM, "binos")) ??
      null;
    if (focus) {
      setPan({ x: focus.x, y: focus.y });
    }
    setMode("binos");
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (mode !== "binos") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y,
    };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // Drag distance as % of viewport / zoom → full image reachable.
    const sensX = (100 / Math.max(1, rect.width)) / zoom;
    const sensY = (100 / Math.max(1, rect.height)) / zoom;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const nextX = Math.max(0, Math.min(100, drag.origX - dx * sensX * 1.15));
    const nextY = Math.max(0, Math.min(100, drag.origY - dy * sensY * 1.15));
    setPan({ x: nextX, y: nextY });
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
    }
  }

  function fireLrf() {
    const visible = birdPlacements.filter((p) =>
      visibleInSpotMode(p.distanceM, "binos"),
    );
    const hit = findBirdUnderLrfReticle(visible, pan, zoom);
    if (hit && lrfSpec) {
      const measured = Math.round(
        measureDistanceWithLrf(hit.distanceM, lrfSpec),
      );
      setLrfReading(`${measured} m`);
      onBirdObserved({
        placement: hit,
        measuredDistanceM: measured,
        gameSeconds: lookedRef.current,
      });
      return;
    }
    const terrain = 80 + Math.floor(Math.random() * 420);
    setLrfReading(`${terrain} m`);
  }

  const lookedMin = Math.floor(lookedGameSec / 60);
  const lookedSec = Math.floor(lookedGameSec % 60);

  const visibleBirds = birdPlacements.filter((p) =>
    visibleInSpotMode(p.distanceM, mode),
  );

  /** Same % coordinate system as eyes; zoom crops into pan point. */
  const worldStyle = {
    width: `${zoom * 100}%`,
    height: `${zoom * 100}%`,
    left: `${(1 - zoom) * pan.x}%`,
    top: `${(1 - zoom) * pan.y}%`,
  } as const;

  return (
    <div className="spot-view" role="dialog" aria-modal="true" aria-label="Spotting">
      <header className="spot-view-hud">
        <div>
          <p className="intro-line intro-gift">
            {mode === "binos"
              ? `Kikkert ${zoom}×${binosLabel ? ` — ${binosLabel}` : ""}`
              : "Spotting med øynene"}
          </p>
          <p className="shop-row-note">
            Kl {formatHuntClock(clockMinutes)} · sett i{" "}
            {lookedMin > 0 ? `${lookedMin} min ` : ""}
            {lookedSec} s spilltid · tid ×{timeFactor}
            {mode === "binos" ? " · dra for å speide hele bildet" : ""}
            {lrfReading ? ` · LRF ${lrfReading}` : ""}
          </p>
        </div>
        <div className="spot-view-actions">
          {mode === "eyes" && hasBinos ? (
            <button type="button" className="intro-button" onClick={enterBinos}>
              Use binos
            </button>
          ) : null}
          {mode === "binos" ? (
            <button
              type="button"
              className="intro-button"
              onClick={() => setMode("eyes")}
            >
              Eyes only
            </button>
          ) : null}
          {mode === "binos" && hasLrf ? (
            <button
              type="button"
              className="intro-button spot-lrf-btn"
              onClick={fireLrf}
            >
              LRF
            </button>
          ) : null}
          <button
            type="button"
            className="intro-button"
            onClick={() =>
              onDone({ mode, gameSeconds: lookedRef.current })
            }
          >
            Done spotting
          </button>
        </div>
      </header>

      <div
        className={
          mode === "binos" ? "spot-eyes-frame spot-binos-frame" : "spot-eyes-frame"
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {mode === "eyes" ? (
          <>
            <img
              src={imageSrc}
              alt="Landskap"
              className="spot-eyes-img"
              draggable={false}
            />
            {visibleBirds.map((p) => (
              <BirdOverlay key={p.birdId} placement={p} />
            ))}
          </>
        ) : (
          <>
            <div className="spot-binos-world" style={worldStyle}>
              <img
                src={imageSrc}
                alt=""
                className="spot-binos-world-img"
                draggable={false}
              />
              {visibleBirds.map((p) => (
                <BirdOverlay key={p.birdId} placement={p} />
              ))}
            </div>
            <div className="spot-binos-vignette" aria-hidden />
            {hasLrf ? (
              <span className="spot-lrf-reticle" aria-hidden />
            ) : null}
            {hasLrf && lrfReading ? (
              <span className="spot-lrf-readout">{lrfReading}</span>
            ) : null}
          </>
        )}
      </div>
      {mode === "binos" ? (
        <p className="spot-binos-hint">
          Dra for å speide hele landskapet · sikt LRF på fuglen og trykk LRF
        </p>
      ) : null}
    </div>
  );
}
