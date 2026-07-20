"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  bearingHitsWedge,
  bearingIsSafe,
  coverFactorForCell,
  dangerWedgesForCell,
  type DangerWedge,
} from "@/lib/aware/cellSafety";
import {
  AWARE_METERS_PER_PCT,
  bearingDegFromTo,
  distanceMBetween,
  stepByKeys,
  stepToward,
  type CellPoint,
} from "@/lib/aware/cellGeometry";
import {
  estimateEttersokFind,
  impactFromShot,
} from "@/lib/aware/ettersok";
import {
  type AwareAppMode,
  type ShotPair,
} from "@/lib/aware/types";
import {
  birdMarkerOnAwareMap,
  densityRatioFromTempC,
  exactBallisticHold,
} from "@/lib/ballistics/solver";
import { KestrelFasitView } from "@/components/hunt/KestrelFasitView";
import {
  ENCOUNTER_NERVE,
  tickEncounterNerve,
} from "@/lib/game/nervousness";
import {
  cellLabel,
  type HuntGridCell,
  type HuntMapAsset,
} from "@/lib/hunt/maps";
import { formatHuntClock } from "@/lib/hunt/travel";
import {
  crosswindMs,
  formatWindCompass,
  formatWindSpeed,
  type DayWeather,
} from "@/lib/weather/spec";
import type { AmmoSpec } from "@/lib/ammo/spec";

export type AwareShootStance = {
  bearingDeg: number;
  distanceM: number;
  hunter: CellPoint;
  bird: CellPoint;
};

type AwareAppViewProps = {
  map: HuntMapAsset;
  cell: HuntGridCell;
  /** Initial LRF distance to bird (hunter starts at cell center). */
  birdDistanceM: number;
  /** Initial firing bearing toward the bird (deg, 0 = north/up). */
  birdBearingDeg: number;
  weather: DayWeather;
  /** Resume hunter/bird markers (ettersøk) so map matches the shot. */
  initialHunter?: CellPoint | null;
  initialBird?: CellPoint | null;
  /** Kit camo bird-spot factor (lower = better). Used by nerve model. */
  camoBirdSpot?: number;
  /** Has LRF — Shoot-tab still useful, but less critical. */
  hasLrf?: boolean;
  ammo?: Pick<AmmoSpec, "v0" | "bc" | "bcModel"> | null;
  hasKestrel?: boolean;
  hasBdx?: boolean;
  clockMinutes: number;
  shotPairs: ShotPair[];
  focusPairId?: string | null;
  onShotPairsChange: (pairs: ShotPair[]) => void;
  onGameSeconds: (sec: number) => void;
  onProceedToShoot: (stance?: AwareShootStance) => void;
  onBirdFlushed: (nervousness: number) => void;
  onAbort: () => void;
};

type MoveKeys = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

const MOVE_SPEED_MPS = 14;
const MOVE_PCT_PER_SEC = MOVE_SPEED_MPS / AWARE_METERS_PER_PCT;

/** Aware Shoot wizard: stand → skuddretning → avstand → lagre. */
type ShootWizard =
  | { phase: "idle" }
  | {
      phase: "direction" | "range";
      stand: CellPoint;
      rangeM: number;
      bearingDeg: number;
    };

function compassLabel(deg: number): string {
  const d = ((Math.round(deg) % 360) + 360) % 360;
  if (d === 0) return "N";
  if (d === 90) return "Ø";
  if (d === 180) return "S";
  if (d === 270) return "V";
  return `${d}°`;
}

function sliceWedgePath(
  cx: number,
  cy: number,
  r: number,
  bearingDeg: number,
  halfAngleDeg: number,
): string {
  /** Same %-space as bearingDegFromTo (0° = up / north). */
  const start = ((bearingDeg - halfAngleDeg - 90) * Math.PI) / 180;
  const end = ((bearingDeg + halfAngleDeg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(start);
  const y1 = cy + r * Math.sin(start);
  const x2 = cx + r * Math.cos(end);
  const y2 = cy + r * Math.sin(end);
  const large = halfAngleDeg * 2 > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

/** Extend hunter→bird past the bird so backstop vs kakestykker is obvious. */
function shotRayPoints(
  hunter: CellPoint,
  bird: CellPoint,
  extendPast = 1.35,
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = bird.x - hunter.x;
  const dy = bird.y - hunter.y;
  return {
    x1: hunter.x,
    y1: hunter.y,
    x2: hunter.x + dx * extendPast,
    y2: hunter.y + dy * extendPast,
  };
}

function DangerOverlay({
  wedges,
  center,
  hunter,
  bird,
  shotSafe,
  highlightFaresok,
}: {
  wedges: DangerWedge[];
  center: CellPoint;
  hunter: CellPoint;
  bird: CellPoint;
  shotSafe: boolean;
  /** Faresøk: same wedges, stronger red tint — bearings unchanged. */
  highlightFaresok: boolean;
}) {
  const r = 48;
  const ray = shotRayPoints(hunter, bird);
  return (
    <svg
      className="aware-hab-svg"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      aria-hidden
    >
      {wedges.map((w, i) => (
        <path
          key={`${w.kind}-${i}`}
          d={sliceWedgePath(center.x, center.y, r, w.bearingDeg, w.halfAngleDeg)}
          fill={
            highlightFaresok
              ? w.kind === "terrain"
                ? "rgba(120, 40, 180, 0.55)"
                : "rgba(200, 40, 40, 0.58)"
              : w.fill
          }
          stroke="rgba(255,220,160,0.35)"
          strokeWidth="0.25"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {/* Shot line in the SAME % space as wedges + Klar til skudd. */}
      <line
        x1={ray.x1}
        y1={ray.y1}
        x2={ray.x2}
        y2={ray.y2}
        stroke={shotSafe ? "rgba(143, 239, 106, 0.95)" : "rgba(240, 80, 70, 0.95)"}
        strokeWidth="0.7"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <polygon
        points="0,-2.2 1.4,1.2 -1.4,1.2"
        fill={shotSafe ? "rgba(143, 239, 106, 0.95)" : "rgba(240, 80, 70, 0.95)"}
        transform={`translate(${bird.x} ${bird.y}) rotate(${Math.atan2(bird.x - hunter.x, -(bird.y - hunter.y)) * (180 / Math.PI)})`}
      />
    </svg>
  );
}

function NerveProgressBar({
  nerve,
  threshold,
}: {
  nerve: number;
  threshold: number;
}) {
  const pct = Math.min(100, Math.max(0, (nerve / threshold) * 100));
  const hot = pct >= 75;
  return (
    <div
      className="aware-nerve-wrap"
      role="meter"
      aria-label="Fuglens nervøsitet"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
    >
      <div className="aware-nerve-label">
        <span>Nervøsitet</span>
        <span>
          {pct.toFixed(0)}%
          {pct >= 100 ? " — letter!" : ""}
        </span>
      </div>
      <div className="aware-nerve-track">
        <div
          className={
            hot ? "aware-nerve-fill aware-nerve-fill-hot" : "aware-nerve-fill"
          }
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Phone-shell Aware view: Aware scan, stalk, Shoot (skuddpar), Track.
 */
export function AwareAppView({
  map,
  cell,
  birdDistanceM,
  birdBearingDeg,
  weather,
  initialHunter = null,
  initialBird = null,
  camoBirdSpot = 0.55,
  hasLrf = false,
  ammo = null,
  hasKestrel = false,
  hasBdx = false,
  clockMinutes,
  shotPairs,
  focusPairId = null,
  onShotPairsChange,
  onGameSeconds,
  onProceedToShoot,
  onBirdFlushed,
  onAbort,
}: AwareAppViewProps) {
  const stalking = !focusPairId;
  const [mode, setMode] = useState<AwareAppMode>(
    focusPairId ? "track" : "aware",
  );
  const [scanned, setScanned] = useState(true);
  const [faresok, setFaresok] = useState(false);
  const [hunter, setHunter] = useState<CellPoint>(
    () => initialHunter ?? { x: 50, y: 50 },
  );
  const [destination, setDestination] = useState<CellPoint | null>(null);
  const [nerve, setNerve] = useState(0);
  const [moveHoldSec, setMoveHoldSec] = useState(0);
  const [shootWizard, setShootWizard] = useState<ShootWizard>({
    phase: "idle",
  });
  const [status, setStatus] = useState(
    stalking
      ? "Trykk på kartet for trygg sone · hold piltaster for å flytte deg. Hold øye med nervøsitet."
      : "Track — skuddpar viser stand og tre. Finn riktig tre (lett å glemme ved flere fugler).",
  );
  const [activePairId, setActivePairId] = useState<string | null>(
    focusPairId,
  );

  const keysRef = useRef<MoveKeys>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const hunterRef = useRef(hunter);
  hunterRef.current = hunter;
  const destRef = useRef(destination);
  destRef.current = destination;
  const nerveRef = useRef(nerve);
  nerveRef.current = nerve;
  const moveHoldRef = useRef(0);
  const flushedRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const onGameSecondsRef = useRef(onGameSeconds);
  onGameSecondsRef.current = onGameSeconds;
  const onBirdFlushedRef = useRef(onBirdFlushed);
  onBirdFlushedRef.current = onBirdFlushed;
  const camoRef = useRef(camoBirdSpot);
  camoRef.current = camoBirdSpot;

  /** Bird world position — fixed from LRF/init, or resumed for ettersøk. */
  const birdWorld = useMemo(
    () =>
      initialBird ??
      birdMarkerOnAwareMap(birdDistanceM, birdBearingDeg),
    [initialBird, birdDistanceM, birdBearingDeg],
  );

  const liveDistanceM = distanceMBetween(hunter, birdWorld);
  const bearing = bearingDegFromTo(hunter, birdWorld);

  const dangerWedges = useMemo(
    () => dangerWedgesForCell(map.id, cell),
    [map.id, cell],
  );

  const windSnap = hasKestrel ? weather.live : weather.forecast;
  const shotCrosswind = crosswindMs(
    windSnap.windSpeedMs,
    windSnap.windFromDeg,
    bearing,
  );
  const density = densityRatioFromTempC(windSnap.temperatureC);
  const holdHint =
    hasKestrel && hasBdx && ammo
      ? exactBallisticHold(ammo, liveDistanceM, shotCrosswind, {
          densityRatio: density,
        })
      : null;

  /** Exact same wedges as drawn — no hidden margin / separate terrain check. */
  const bakgrunnOk = bearingIsSafe(bearing, dangerWedges);
  const blockingWedge = dangerWedges.find((w) => bearingHitsWedge(bearing, w));
  const safeHab = !dangerWedges.some(
    (w) => w.kind === "habitation" && bearingHitsWedge(bearing, w),
  );
  const safeTerrain = !dangerWedges.some(
    (w) => w.kind === "terrain" && bearingHitsWedge(bearing, w),
  );
  const coverFactor = useMemo(
    () => coverFactorForCell(map.id, cell),
    [map.id, cell],
  );

  const shootPreviewImpact =
    shootWizard.phase === "range" || shootWizard.phase === "direction"
      ? impactFromShot({
          stand: shootWizard.stand,
          bearingDeg: shootWizard.bearingDeg,
          distanceM: shootWizard.rangeM,
        })
      : null;

  // Keyboard: arrow movement while stalking
  useEffect(() => {
    if (!stalking) return;

    function setKey(code: string, down: boolean) {
      const k = keysRef.current;
      if (code === "ArrowUp") k.up = down;
      else if (code === "ArrowDown") k.down = down;
      else if (code === "ArrowLeft") k.left = down;
      else if (code === "ArrowRight") k.right = down;
      else return false;
      return true;
    }

    function onKeyDown(e: KeyboardEvent) {
      if (!setKey(e.code, true)) return;
      e.preventDefault();
    }
    function onKeyUp(e: KeyboardEvent) {
      if (!setKey(e.code, false)) return;
      e.preventDefault();
    }
    function onBlur() {
      keysRef.current = { up: false, down: false, left: false, right: false };
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    stageRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [stalking]);

  // rAF: move + nerve + clock
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let accGame = 0;

    function tick(now: number) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      const gameDt = dt * 8;
      accGame += gameDt;
      if (accGame >= 1) {
        const whole = Math.floor(accGame);
        accGame -= whole;
        onGameSecondsRef.current(whole);
      }

      if (stalking && !flushedRef.current) {
        const keys = keysRef.current;
        const moving =
          keys.up || keys.down || keys.left || keys.right;
        if (moving) {
          moveHoldRef.current += dt;
          const step = MOVE_PCT_PER_SEC * dt;
          const dest = destRef.current;
          let next = hunterRef.current;
          if (dest) {
            next = stepToward(next, dest, step);
            if (distanceMBetween(next, dest) < AWARE_METERS_PER_PCT * 0.4) {
              setDestination(null);
              destRef.current = null;
            }
          } else {
            next = stepByKeys(next, keys, step);
          }
          if (next.x !== hunterRef.current.x || next.y !== hunterRef.current.y) {
            hunterRef.current = next;
            setHunter(next);
          }
        } else {
          moveHoldRef.current = 0;
        }
        setMoveHoldSec(moveHoldRef.current);

        const dist = distanceMBetween(hunterRef.current, birdWorld);
        const result = tickEncounterNerve(nerveRef.current, dt, {
          distanceM: dist,
          isMoving: moving,
          moveHoldSec: moveHoldRef.current,
          camoBirdSpot: camoRef.current,
          coverFactor,
        });
        nerveRef.current = result.nerve;
        setNerve(result.nerve);
        if (result.flushes) {
          flushedRef.current = true;
          onBirdFlushedRef.current(result.nerve);
        }
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stalking, birdWorld, coverFactor]);

  const activePair =
    shotPairs.find((p) => p.id === activePairId) ?? shotPairs[0] ?? null;

  function mapClickPoint(e: MouseEvent<HTMLDivElement>): CellPoint {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }

  function setMapDestination(e: MouseEvent<HTMLDivElement>) {
    if (!stalking || mode !== "aware") return;
    const point = mapClickPoint(e);
    setDestination(point);
    setStatus(
      `Mål satt (${point.x.toFixed(0)},${point.y.toFixed(0)}). Hold piltast for å gå dit — sjekk bakgrunn.`,
    );
    stageRef.current?.focus();
  }

  function startShootPair() {
    const stand = { ...hunter };
    const rangeM = Math.min(
      450,
      Math.max(50, Math.round(liveDistanceM) || 200),
    );
    const bearingDeg = Math.round(bearing);
    setShootWizard({
      phase: "direction",
      stand,
      rangeM,
      bearingDeg,
    });
    setStatus(
      "Skuddpar: sett skuddretning, deretter avstand — lagre treffpunkt.",
    );
  }

  function cancelShootWizard() {
    setShootWizard({ phase: "idle" });
    setStatus("Shoot avbrutt.");
  }

  function saveShootPair() {
    if (shootWizard.phase === "idle") return;
    const { stand, rangeM, bearingDeg } = shootWizard;
    const impact = impactFromShot({
      stand,
      bearingDeg,
      distanceM: rangeM,
    });
    const pair: ShotPair = {
      id: `pair-${Date.now()}`,
      atMs: Date.now(),
      cell: { ...cell },
      cellLabel: cellLabel(cell),
      stand,
      impact,
      distanceM: Math.round(rangeM),
      bearingDeg: ((bearingDeg % 360) + 360) % 360,
      resultKind: "ettersok",
      trackPoints: [],
      found: null,
    };
    onShotPairsChange([pair, ...shotPairs]);
    setActivePairId(pair.id);
    setShootWizard({ phase: "idle" });
    setStatus(
      `Skuddpar lagret: ${Math.round(rangeM)} m / ${compassLabel(bearingDeg)}. Bytt til Track for søk.`,
    );
    setMode("track");
  }

  function addTrackPoint(e: MouseEvent<HTMLDivElement>) {
    if (!activePair || mode !== "track") return;
    if (activePair.found != null) return;
    const point = mapClickPoint(e);
    const next = shotPairs.map((p) =>
      p.id === activePair.id
        ? {
            ...p,
            trackPoints: [
              ...p.trackPoints,
              { ...point, atMs: Date.now() },
            ],
          }
        : p,
    );
    onShotPairsChange(next);
    setStatus(`Spor #${activePair.trackPoints.length + 1} markert.`);
  }

  function onStageClick(e: MouseEvent<HTMLDivElement>) {
    if (mode === "track") addTrackPoint(e);
    else if (mode === "aware" && stalking) setMapDestination(e);
  }

  function runEttersokSearch() {
    if (!activePair || activePair.found != null) return;
    const est = estimateEttersokFind(activePair);
    const next = shotPairs.map((p) =>
      p.id === activePair.id ? { ...p, found: est.found } : p,
    );
    onShotPairsChange(next);
    setStatus(
      est.found
        ? `Funnet! (${Math.round(est.findChance * 100)}%) — ${est.reason}`
        : `Ikke funnet (${Math.round(est.findChance * 100)}%) — ${est.reason}`,
    );
  }

  function markRecoveredAtTree() {
    if (!activePair || activePair.found != null) return;
    const next = shotPairs.map((p) =>
      p.id === activePair.id ? { ...p, found: true } : p,
    );
    onShotPairsChange(next);
    setStatus("Hentet ved treet — skuddparet beholder posisjonen for oversikten.");
  }

  function pairKindLabel(kind: ShotPair["resultKind"]): string {
    if (kind === "instant_kill") return "instant";
    if (kind === "vital_kill") return "vital";
    if (kind === "ettersok") return "ettersøk";
    if (kind === "miss") return "bom";
    return kind;
  }

  function proceed() {
    if (focusPairId) {
      onProceedToShoot();
      return;
    }
    onProceedToShoot({
      bearingDeg: bearing,
      distanceM: liveDistanceM,
      hunter,
      bird: birdWorld,
    });
  }

  const nerveHint =
    liveDistanceM > ENCOUNTER_NERVE.stillSafeDistanceM
      ? moveHoldSec >= ENCOUNTER_NERVE.moveGraceSec
        ? "Bevegelse — fuglen merker deg selv på lang hold"
        : "Ro: >350 m, stå stille = rolig fugl"
      : liveDistanceM <= ENCOUNTER_NERVE.alwaysFlushDistanceM
        ? "For nærme (≤80 m) — letter!"
        : "Innen 350 m — nærmere / mer bevegelse = raskere nervøs";

  return (
    <div className="aware-app" role="dialog" aria-modal="true" aria-label="Aware">
      <div className="aware-phone">
        <header className="aware-phone-bar">
          <span className="aware-brand">AWARE</span>
          <span className="aware-clock">{formatHuntClock(clockMinutes)}</span>
        </header>

        {stalking ? (
          <NerveProgressBar
            nerve={nerve}
            threshold={ENCOUNTER_NERVE.flushThreshold}
          />
        ) : null}

        <div className="aware-mode-tabs" role="tablist">
          {(
            [
              ["aware", "Aware"],
              ["shoot", "Shoot"],
              ["track", "Track"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={
                mode === id ? "aware-tab aware-tab-active" : "aware-tab"
              }
              onClick={() => setMode(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="aware-map-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="aware-map-img"
            src={map.src}
            alt={map.label}
            draggable={false}
          />
          <div
            className="aware-cell-highlight"
            style={{
              left: `${(cell.col / map.cols) * 100}%`,
              bottom: `${(cell.row / map.rows) * 100}%`,
              width: `${100 / map.cols}%`,
              height: `${100 / map.rows}%`,
            }}
          />
          <div
            ref={stageRef}
            className="aware-cell-stage"
            tabIndex={stalking ? 0 : undefined}
            onClick={onStageClick}
          >
            {mode === "aware" && scanned ? (
              <DangerOverlay
                wedges={dangerWedges}
                highlightFaresok={faresok}
                center={faresok ? birdWorld : hunter}
                hunter={hunter}
                bird={birdWorld}
                shotSafe={bakgrunnOk}
              />
            ) : null}
            {stalking && destination && mode === "aware" ? (
              <span
                className="aware-dest-marker"
                style={{ left: `${destination.x}%`, top: `${destination.y}%` }}
                title="Gå hit"
              />
            ) : null}
            {mode === "shoot" && shootWizard.phase !== "idle" ? (
              <>
                <span
                  className="aware-pair-stand"
                  style={{
                    left: `${shootWizard.stand.x}%`,
                    top: `${shootWizard.stand.y}%`,
                  }}
                  title="Skyteplass"
                />
                <div
                  className="aware-shot-radius"
                  style={{
                    left: `${shootWizard.stand.x}%`,
                    top: `${shootWizard.stand.y}%`,
                    width: `${(shootWizard.rangeM / AWARE_METERS_PER_PCT) * 2}%`,
                    height: `${(shootWizard.rangeM / AWARE_METERS_PER_PCT) * 2}%`,
                  }}
                  aria-hidden
                />
                {shootPreviewImpact ? (
                  <span
                    className="aware-pair-impact"
                    style={{
                      left: `${shootPreviewImpact.x}%`,
                      top: `${shootPreviewImpact.y}%`,
                    }}
                    title="Treffpunkt"
                  />
                ) : null}
                <div
                  className="aware-bearing-needle aware-shot-bearing"
                  style={{
                    left: `${shootWizard.stand.x}%`,
                    top: `${shootWizard.stand.y}%`,
                    transform: `translate(-50%, -100%) rotate(${shootWizard.bearingDeg}deg)`,
                  }}
                  aria-hidden
                />
              </>
            ) : null}
            {/* Hunter + bird always shown so Aware → Track matches. */}
            <span
              className="aware-hunter-marker"
              style={{ left: `${hunter.x}%`, top: `${hunter.y}%` }}
              title="Deg"
            />
            <span
              className="aware-bird-marker"
              style={{ left: `${birdWorld.x}%`, top: `${birdWorld.y}%` }}
              title={`Fugl ${Math.round(liveDistanceM)} m`}
            >
              <span className="aware-bird-dot" />
              <span className="aware-bird-label">
                {Math.round(liveDistanceM)} m
              </span>
            </span>
            <div
              className="aware-wind-arrow"
              style={{
                transform: `translate(-50%, -50%) rotate(${windSnap.windFromDeg + 180}deg)`,
              }}
              title={`Vind fra ${formatWindCompass(windSnap.windFromDeg)}`}
              aria-hidden
            />
            {(mode === "track" || mode === "shoot") && activePair ? (
              <>
                <span
                  className="aware-pair-stand"
                  style={{
                    left: `${activePair.stand.x}%`,
                    top: `${activePair.stand.y}%`,
                  }}
                />
                <span
                  className="aware-pair-impact"
                  style={{
                    left: `${activePair.impact.x}%`,
                    top: `${activePair.impact.y}%`,
                  }}
                />
                {mode === "track"
                  ? activePair.trackPoints.map((t, i) => (
                      <span
                        key={i}
                        className="aware-track-dot"
                        style={{ left: `${t.x}%`, top: `${t.y}%` }}
                      >
                        {i + 1}
                      </span>
                    ))
                  : null}
              </>
            ) : null}
            {stalking && mode === "aware" && !scanned ? (
              <div
                className="aware-bearing-needle"
                style={{
                  left: `${hunter.x}%`,
                  top: `${hunter.y}%`,
                  transform: `translate(-50%, -100%) rotate(${bearing}deg)`,
                }}
                aria-hidden
              />
            ) : null}
          </div>
        </div>

        <div className="aware-panel">
          <p className="aware-cell-label">
            Celle {cellLabel(cell)} · {Math.round(liveDistanceM)} m · skyteretning{" "}
            {Math.round(bearing)}°
          </p>
          {stalking ? (
            <p className="shop-row-note aware-weather-line">{nerveHint}</p>
          ) : null}
          <p className="shop-row-note aware-weather-line">
            {hasKestrel ? "Kestrel" : "Prognose"}:{" "}
            {windSnap.temperatureC.toFixed(1)}°C ·{" "}
            {formatWindSpeed(windSnap.windSpeedMs)} fra{" "}
            {formatWindCompass(windSnap.windFromDeg)} (
            {Math.round(windSnap.windFromDeg)}°)
            {" · "}
            crosswind {shotCrosswind >= 0 ? "+" : ""}
            {shotCrosswind.toFixed(1)} m/s
          </p>

          {mode === "aware" ? (
            <div className="aware-actions">
              <button
                type="button"
                className="intro-button sheriff-secondary"
                onClick={() => {
                  setScanned(true);
                  setFaresok(false);
                  setStatus(
                    `Scan: ${dangerWedges.length} faresoner (${dangerWedges.filter((w) => w.kind === "habitation").length} bebyggelse · ${dangerWedges.filter((w) => w.kind === "terrain").length} terreng). Kakene = klar-til-skudd.`,
                  );
                }}
              >
                {scanned ? "Scan på nytt" : "Scan område"}
              </button>
              <button
                type="button"
                className="intro-button sheriff-secondary"
                disabled={!scanned}
                onClick={() => {
                  setFaresok((v) => !v);
                  setStatus(
                    faresok
                      ? "Faresøk av — kake rundt deg (samme sektorer)."
                      : "Faresøk: samme faresoner, sentrert på fuglen (ingen vri).",
                  );
                }}
              >
                Faresøk
              </button>
              <p className="shop-row-note">
                Trykk kart → mål · piltaster → gå. Grønn skuddlinje = klar
                sektor (utenfor kakene); rød = fare. Kakene og Klar til skudd
                bruker samme vinkler.
                Faresøk flytter bare kakesentrum til fuglen.
                {holdHint
                  ? " Kestrel AB dialer elev + windage før skudd."
                  : ""}
              </p>
              <p className="shop-row-note">
                Bebyggelse: {safeHab ? "klar" : "i sektor — farlig"}
                {" · "}
                Terrengbakgrunn: {safeTerrain ? "ok" : "i sektor — farlig"}
                {" · "}
                Skudd:{" "}
                {bakgrunnOk
                  ? "tillatt"
                  : `blokkert (${blockingWedge?.label ?? "faresone"})`}
              </p>
            </div>
          ) : null}

          {holdHint && stalking ? (
            <KestrelFasitView
              hold={holdHint}
              shotBearingDeg={bearing}
              windFromDeg={windSnap.windFromDeg}
              windSpeedMs={windSnap.windSpeedMs}
              compact
            />
          ) : null}

          {mode === "shoot" ? (
            <div className="aware-actions">
              <p className="shop-row-note">
                {hasLrf
                  ? "Shoot: lås stand → sett skuddretning → sett avstand → lagre."
                  : "Uten LRF er Shoot nødvendig: sett retning og avstand til treffpunkt for ettersøk."}
              </p>

              {shootWizard.phase === "idle" ? (
                <button
                  type="button"
                  className="intro-button"
                  onClick={startShootPair}
                >
                  Nytt skuddpar (Target)
                </button>
              ) : null}

              {shootWizard.phase === "direction" ? (
                <>
                  <p className="shop-row-note aware-shoot-step">
                    1/2 — Sett skuddretning ({compassLabel(shootWizard.bearingDeg)})
                  </p>
                  <label className="shop-filter aware-shoot-slider">
                    Retning {Math.round(shootWizard.bearingDeg)}°
                    <input
                      type="range"
                      min={0}
                      max={359}
                      step={1}
                      value={Math.round(shootWizard.bearingDeg)}
                      onChange={(e) =>
                        setShootWizard({
                          ...shootWizard,
                          bearingDeg: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <div className="aware-shoot-nav">
                    <button
                      type="button"
                      className="intro-button sheriff-secondary"
                      onClick={cancelShootWizard}
                    >
                      Avbryt
                    </button>
                    <button
                      type="button"
                      className="intro-button"
                      onClick={() =>
                        setShootWizard({ ...shootWizard, phase: "range" })
                      }
                    >
                      Neste: avstand
                    </button>
                  </div>
                </>
              ) : null}

              {shootWizard.phase === "range" ? (
                <>
                  <p className="shop-row-note aware-shoot-step">
                    2/2 — Sett skuddavstand
                  </p>
                  <label className="shop-filter aware-shoot-slider">
                    Avstand {shootWizard.rangeM} m
                    <input
                      type="range"
                      min={50}
                      max={450}
                      step={5}
                      value={shootWizard.rangeM}
                      onChange={(e) =>
                        setShootWizard({
                          ...shootWizard,
                          rangeM: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                  <p className="shop-row-note">
                    Forhåndsvisning: {shootWizard.rangeM} m /{" "}
                    {compassLabel(shootWizard.bearingDeg)}
                  </p>
                  <div className="aware-shoot-nav">
                    <button
                      type="button"
                      className="intro-button sheriff-secondary"
                      onClick={() =>
                        setShootWizard({ ...shootWizard, phase: "direction" })
                      }
                    >
                      Tilbake
                    </button>
                    <button
                      type="button"
                      className="intro-button"
                      onClick={saveShootPair}
                    >
                      Lagre skuddpar
                    </button>
                  </div>
                </>
              ) : null}

              {shotPairs.length > 0 ? (
                <p className="shop-row-note">
                  {shotPairs.length} skuddpar lagret · åpne Track for søk
                </p>
              ) : null}
            </div>
          ) : null}

          {mode === "track" ? (
            <div className="aware-actions">
              {shotPairs.length === 0 ? (
                <p className="shop-row-note">
                  Ingen skuddpar ennå. Etter hvert skudd lagres stand → tre — også
                  ved instant kill (lett å glemme treet).
                </p>
              ) : (
                <>
                  <label className="shop-filter">
                    Skuddpar
                    <select
                      value={activePair?.id ?? ""}
                      onChange={(e) => setActivePairId(e.target.value)}
                    >
                      {shotPairs.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.cellLabel} · {p.distanceM} m ·{" "}
                          {pairKindLabel(p.resultKind)}
                          {p.found === true
                            ? " · funnet"
                            : p.found === false
                              ? " · tapt"
                              : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="shop-row-note">
                    {activePair &&
                    (activePair.resultKind === "instant_kill" ||
                      activePair.resultKind === "vital_kill")
                      ? "Drept fugl: skuddparet peker på treet. Marker spor eller bekreft henting."
                      : "Trykk på kartet for spor. Deretter søk / ettersøk."}
                  </p>
                  {activePair &&
                  (activePair.resultKind === "instant_kill" ||
                    activePair.resultKind === "vital_kill") ? (
                    <button
                      type="button"
                      className="intro-button"
                      disabled={!activePair || activePair.found != null}
                      onClick={markRecoveredAtTree}
                    >
                      Hentet ved treet
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="intro-button"
                      disabled={!activePair || activePair.found != null}
                      onClick={runEttersokSearch}
                    >
                      Søk / ettersøk
                    </button>
                  )}
                </>
              )}
            </div>
          ) : null}

          <p className="aware-status">{status}</p>
        </div>

        <footer className="aware-footer">
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={onAbort}
          >
            Avbryt
          </button>
          {focusPairId ? (
            <button
              type="button"
              className="intro-button"
              onClick={proceed}
            >
              Ferdig (skuddpar lagret)
            </button>
          ) : (
            <button
              type="button"
              className="intro-button"
              disabled={!bakgrunnOk}
              title={
                bakgrunnOk
                  ? "Bakgrunn OK"
                  : "Flytt deg til sone uten farlig bakgrunn"
              }
              onClick={proceed}
            >
              Klar til skudd
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
