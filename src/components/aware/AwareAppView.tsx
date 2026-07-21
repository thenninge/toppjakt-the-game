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
import {
  ShotPairOverlay,
  ShotPairPreview,
  SearchTrackOverlay,
} from "@/components/aware/ShotPairOverlay";
import {
  ENCOUNTER_NERVE,
  tickEncounterNerve,
} from "@/lib/game/nervousness";
import { CAMCORDER_SETUP_NERVE } from "@/lib/hunt/shoot";
import {
  cellLabel,
  type HuntGridCell,
  type HuntMapAsset,
} from "@/lib/hunt/maps";
import {
  ETTERSOK_SEARCH_MINUTES,
  formatHuntClock,
} from "@/lib/hunt/travel";
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
  /** Camcorder was set up before leaving Aware (nerve cost already paid). */
  camcorderActive?: boolean;
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
  /** Kit includes a deployable hunt camcorder. */
  hasCamcorder?: boolean;
  clockMinutes: number;
  shotPairs: ShotPair[];
  focusPairId?: string | null;
  onShotPairsChange: (pairs: ShotPair[]) => void;
  onGameSeconds: (sec: number) => void;
  onProceedToShoot: (stance?: AwareShootStance) => void;
  onBirdFlushed: (nervousness: number) => void;
  onAbort: () => void;
  /** Called when a skuddpar is confirmed found (tree / ettersøk). */
  onPairFound?: (pair: ShotPair) => void;
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
}: {
  wedges: DangerWedge[];
  center: CellPoint;
  hunter: CellPoint;
  bird: CellPoint;
  shotSafe: boolean;
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
          fill={w.fill}
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
  hasCamcorder = false,
  clockMinutes,
  shotPairs,
  focusPairId = null,
  onShotPairsChange,
  onGameSeconds,
  onProceedToShoot,
  onBirdFlushed,
  onAbort,
  onPairFound,
}: AwareAppViewProps) {
  const stalking = !focusPairId;
  const [mode, setMode] = useState<AwareAppMode>(
    focusPairId ? "track" : "aware",
  );
  const [scanned, setScanned] = useState(true);
  const [camcorderReady, setCamcorderReady] = useState(false);
  const [hunter, setHunter] = useState<CellPoint>(
    () => initialHunter ?? { x: 50, y: 50 },
  );
  const [destination, setDestination] = useState<CellPoint | null>(null);
  const [nerve, setNerve] = useState(0);
  const [moveHoldSec, setMoveHoldSec] = useState(0);
  const [shootWizard, setShootWizard] = useState<ShootWizard>({
    phase: "idle",
  });
  const [status, setStatus] = useState(() => {
    if (stalking) {
      return "Trykk på kartet for trygg sone · hold piltaster for å flytte deg. Hold øye med nervøsitet.";
    }
    const pair = shotPairs.find((p) => p.id === focusPairId);
    if (pair?.resultKind === "ettersok" && pair.fleeObservation) {
      return `Ettersøk: flukt ${pair.fleeObservation.compassLabel}. Legg søkespor på kartet, deretter Ettersøk (+${ETTERSOK_SEARCH_MINUTES} min).`;
    }
    if (pair?.fleeObservation?.text) return pair.fleeObservation.text;
    return "Track — skuddpar: stand → stiplet linje → tre (+ ~20 m søkeradius). Finn riktig tre.";
  });
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
  const liveBearing = bearingDegFromTo(hunter, birdWorld);
  /** Clicked map mål: preview Aware cakes + shot line from there (planning). */
  const planOrigin = destination ?? hunter;
  const planDistanceM = distanceMBetween(planOrigin, birdWorld);
  const planBearing = bearingDegFromTo(planOrigin, birdWorld);
  const planning = destination != null;

  const dangerWedges = useMemo(
    () => dangerWedgesForCell(map.id, cell),
    [map.id, cell],
  );

  const windSnap = hasKestrel ? weather.live : weather.forecast;
  const shotCrosswind = crosswindMs(
    windSnap.windSpeedMs,
    windSnap.windFromDeg,
    planBearing,
  );
  const density = densityRatioFromTempC(windSnap.temperatureC);
  const holdHint =
    hasKestrel && hasBdx && ammo
      ? exactBallisticHold(ammo, planDistanceM, shotCrosswind, {
          densityRatio: density,
        })
      : null;

  /** Preview safety from plan stand (or hunter if no mål). */
  const bakgrunnOk = bearingIsSafe(planBearing, dangerWedges);
  const blockingWedge = dangerWedges.find((w) =>
    bearingHitsWedge(planBearing, w),
  );
  const safeHab = !dangerWedges.some(
    (w) => w.kind === "habitation" && bearingHitsWedge(planBearing, w),
  );
  const safeTerrain = !dangerWedges.some(
    (w) => w.kind === "terrain" && bearingHitsWedge(planBearing, w),
  );
  /** Actual stand — Klar til skudd must use where you are now. */
  const liveBakgrunnOk = bearingIsSafe(liveBearing, dangerWedges);
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
  /** Don't spoil wounded ettersøk — player uses flee cue + track clicks. */
  const hideTrueLand =
    !!activePair?.fleeObservation && activePair.resultKind === "ettersok";
  /** Skuddpar on this cell map (stand → aim + søkeradius). */
  const pairsOnCell = shotPairs.filter(
    (p) => p.cell.row === cell.row && p.cell.col === cell.col,
  );

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
      `Planleggingsmål satt. Kakene / skuddlinje fra målet — hold piltast for å gå dit.`,
    );
    stageRef.current?.focus();
  }

  function startShootPair() {
    const stand = { ...hunter };
    const rangeM = Math.min(
      450,
      Math.max(50, Math.round(liveDistanceM) || 200),
    );
    const bearingDeg = Math.round(liveBearing);
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
      target: impact,
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
      `Skuddpar lagret: ${Math.round(rangeM)} m / ${compassLabel(bearingDeg)} — synlig på kartet (stand → tre + 20 m).`,
    );
    setMode("track");
  }

  function addTrackPoint(e: MouseEvent<HTMLDivElement>) {
    if (!activePair || mode !== "track") return;
    if (activePair.found === true) return;
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
    setStatus(
      `Søkespor #${activePair.trackPoints.length + 1} markert — trykk «Ettersøk» når sporet er klart. Tidligere søk ligger igjen på kartet.`,
    );
  }

  function clearDraftTrack() {
    if (!activePair || activePair.found === true) return;
    if (activePair.trackPoints.length === 0) return;
    const next = shotPairs.map((p) =>
      p.id === activePair.id ? { ...p, trackPoints: [] } : p,
    );
    onShotPairsChange(next);
    setStatus(
      "Ulagret spor fjernet — gjennomførte søkespor ligger fortsatt på kartet.",
    );
  }

  function onStageClick(e: MouseEvent<HTMLDivElement>) {
    if (mode === "track") addTrackPoint(e);
    else if (mode === "aware" && stalking) setMapDestination(e);
  }

  function runEttersokSearch() {
    if (!activePair || activePair.found === true) return;
    onGameSeconds(ETTERSOK_SEARCH_MINUTES * 60);
    const attemptNo = (activePair.ettersokAttempts ?? 0) + 1;
    const est = estimateEttersokFind(activePair);
    const sweep = {
      points: [...activePair.trackPoints],
      atMs: Date.now(),
      found: est.found,
    };
    const updated: ShotPair = {
      ...activePair,
      ettersokAttempts: attemptNo,
      searchedTracks: [...(activePair.searchedTracks ?? []), sweep],
      // New draft for the next attempt; completed sweep stays on the map.
      trackPoints: [],
      lastEttersok: {
        found: est.found,
        reason: est.reason,
        findChance: est.findChance,
        atMs: Date.now(),
      },
      // Only lock on success — failed searches stay open for more attempts.
      found: est.found ? true : null,
    };
    const next = shotPairs.map((p) =>
      p.id === activePair.id ? updated : p,
    );
    onShotPairsChange(next);
    setStatus(
      est.found
        ? `FUNNET — ettersøk #${attemptNo} (+${ETTERSOK_SEARCH_MINUTES} min). ${est.reason}`
        : `IKKE FUNNET — ettersøk #${attemptNo} (+${ETTERSOK_SEARCH_MINUTES} min). ${est.reason} Søkespor #${attemptNo} ligger på kartet — legg et nytt spor i et annet område.`,
    );
    if (est.found) onPairFound?.(updated);
  }

  function markRecoveredAtTree() {
    if (!activePair || activePair.found === true) return;
    const updated: ShotPair = { ...activePair, found: true };
    const next = shotPairs.map((p) =>
      p.id === activePair.id ? updated : p,
    );
    onShotPairsChange(next);
    setStatus("Hentet ved treet — fasit på treffpunkt.");
    onPairFound?.(updated);
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
      bearingDeg: liveBearing,
      distanceM: liveDistanceM,
      hunter,
      bird: birdWorld,
      camcorderActive: hasCamcorder && camcorderReady,
    });
  }

  function deployCamcorder() {
    if (!hasCamcorder || camcorderReady || flushedRef.current) return;
    const next = Math.min(
      ENCOUNTER_NERVE.nerveCap,
      nerveRef.current + CAMCORDER_SETUP_NERVE,
    );
    nerveRef.current = next;
    setNerve(next);
    setCamcorderReady(true);
    setStatus(
      next >= ENCOUNTER_NERVE.flushThreshold
        ? "Camcorder oppe — men fuglen er svært urolig (+20% nervøsitet)!"
        : "Camcorder satt opp mot standplass (+20% nervøsitet). Bedre ettersøk-oversikt etter skudd.",
    );
    if (next >= ENCOUNTER_NERVE.flushThreshold) {
      flushedRef.current = true;
      onBirdFlushedRef.current(next);
    }
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
                center={planOrigin}
                hunter={planOrigin}
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
            {pairsOnCell.map((pair) => (
              <ShotPairOverlay
                key={pair.id}
                pair={pair}
                active={pair.id === activePair?.id}
              />
            ))}
            {pairsOnCell.map((pair) => (
              <SearchTrackOverlay
                key={`track-${pair.id}`}
                pair={pair}
                active={pair.id === activePair?.id}
              />
            ))}
            {mode === "shoot" &&
            shootWizard.phase !== "idle" &&
            shootPreviewImpact ? (
              <>
                <ShotPairPreview
                  stand={shootWizard.stand}
                  aim={shootPreviewImpact}
                />
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
            {/* Hunter always shown. Bird/land hidden on wounded ettersøk (use cue). */}
            <span
              className="aware-hunter-marker"
              style={{ left: `${hunter.x}%`, top: `${hunter.y}%` }}
              title="Deg"
            />
            {!hideTrueLand ? (
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
            ) : null}
            <div
              className="aware-wind-arrow"
              style={{
                transform: `translate(-50%, -50%) rotate(${windSnap.windFromDeg + 180}deg)`,
              }}
              title={`Vind fra ${formatWindCompass(windSnap.windFromDeg)}`}
              aria-hidden
            />
            {mode === "track" &&
            activePair?.fleeObservation &&
            activePair.resultKind === "ettersok" ? (
              <div
                className="aware-flee-needle"
                style={{
                  left: `${activePair.stand.x}%`,
                  top: `${activePair.stand.y}%`,
                  transform: `translate(-50%, -100%) rotate(${activePair.fleeObservation.observedBearingDeg}deg)`,
                }}
                title={`Observert flukt ${activePair.fleeObservation.compassLabel}`}
                aria-hidden
              />
            ) : null}
            {stalking && mode === "aware" && !scanned ? (
              <div
                className="aware-bearing-needle"
                style={{
                  left: `${hunter.x}%`,
                  top: `${hunter.y}%`,
                  transform: `translate(-50%, -100%) rotate(${liveBearing}deg)`,
                }}
                aria-hidden
              />
            ) : null}
          </div>
        </div>

        <div className="aware-panel">
          <p className="aware-cell-label">
            Celle {cellLabel(cell)} ·{" "}
            {planning ? "fra mål " : ""}
            {Math.round(planDistanceM)} m · skyteretning{" "}
            {Math.round(planBearing)}°
            {planning
              ? ` · her ${Math.round(liveDistanceM)} m / ${Math.round(liveBearing)}°`
              : ""}
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
                  setStatus(
                    `Scan: ${dangerWedges.length} faresoner (${dangerWedges.filter((w) => w.kind === "habitation").length} bebyggelse · ${dangerWedges.filter((w) => w.kind === "terrain").length} terreng). Kakene = klar-til-skudd.`,
                  );
                }}
              >
                {scanned ? "Scan på nytt" : "Scan område"}
              </button>
              {hasCamcorder ? (
                <button
                  type="button"
                  className="intro-button sheriff-secondary"
                  disabled={camcorderReady}
                  onClick={deployCamcorder}
                >
                  {camcorderReady
                    ? "Camcorder klar"
                    : "Sett opp camcorder (+20% nervøsitet)"}
                </button>
              ) : null}
              <p className="shop-row-note">
                Trykk kart → planleggingsmål (kakene + skuddlinje flyttes dit).
                Hold piltaster for å gå. Grønn linje = klar sektor; rød = fare.
                {hasCamcorder
                  ? camcorderReady
                    ? " Camcorder filmer stand — bedre ettersøk-cue etter skudd."
                    : " Camcorder i kit: sett opp før skudd for retning + landingsavstand (koster nervøsitet)."
                  : ""}
                {holdHint
                  ? " Kestrel AB dialer elev + windage når du går til skudd."
                  : ""}
              </p>
              <p className="shop-row-note">
                {planning ? "Fra målet — " : ""}
                Bebyggelse: {safeHab ? "klar" : "i sektor — farlig"}
                {" · "}
                Terrengbakgrunn: {safeTerrain ? "ok" : "i sektor — farlig"}
                {" · "}
                Skudd:{" "}
                {bakgrunnOk
                  ? "tillatt"
                  : `blokkert (${blockingWedge?.label ?? "faresone"})`}
                {planning
                  ? liveBakgrunnOk
                    ? " · her: klar"
                    : " · her: ikke klar"
                  : ""}
              </p>
            </div>
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
                  {shotPairs.length} skuddpar lagret · synlig på kartet (stand →
                  tre + 20 m)
                </p>
              ) : null}
            </div>
          ) : null}

          {mode === "track" ? (
            <div className="aware-actions">
              {shotPairs.length === 0 ? (
                <p className="shop-row-note">
                  Ingen skuddpar ennå. Lag et i Shoot, eller skyt — stand →
                  tre med ~20 m søkeradius vises på kartet.
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
                              : (p.ettersokAttempts ?? 0) > 0
                                ? ` · ${p.ettersokAttempts} søk`
                                : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  {activePair?.resultKind === "ettersok" &&
                  activePair.fleeObservation ? (
                    <div
                      className="aware-ettersok-flee"
                      role="status"
                    >
                      <strong>Fluktretning</strong>
                      <span>
                        {activePair.fleeObservation.compassLabel} (
                        {Math.round(
                          activePair.fleeObservation.observedBearingDeg,
                        )}
                        °)
                        {activePair.fleeObservation.observedLandDistanceM !=
                        null
                          ? ` · ca. ${Math.round(activePair.fleeObservation.observedLandDistanceM)} m`
                          : ""}
                      </span>
                      <p>{activePair.fleeObservation.text}</p>
                    </div>
                  ) : null}

                  {activePair?.lastEttersok ? (
                    <div
                      className={
                        activePair.lastEttersok.found
                          ? "aware-ettersok-result aware-ettersok-result-found"
                          : "aware-ettersok-result aware-ettersok-result-miss"
                      }
                      role="status"
                    >
                      <strong>
                        {activePair.lastEttersok.found
                          ? "FUNNET"
                          : "IKKE FUNNET"}
                      </strong>
                      <p>{activePair.lastEttersok.reason}</p>
                      {!activePair.lastEttersok.found &&
                      activePair.found !== true ? (
                        <p className="aware-ettersok-hint">
                          Forrige søkespor ligger på kartet. Legg et nytt spor i
                          et annet område og kjør ettersøk (+
                          {ETTERSOK_SEARCH_MINUTES} min).
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {activePair &&
                  (activePair.resultKind === "instant_kill" ||
                    activePair.resultKind === "vital_kill") ? (
                    <>
                      <p className="shop-row-note">
                        Drept fugl: skuddparet peker på treet. Marker spor eller
                        bekreft henting.
                      </p>
                      <button
                        type="button"
                        className="intro-button"
                        disabled={activePair.found === true}
                        onClick={markRecoveredAtTree}
                      >
                        Hentet ved treet
                      </button>
                    </>
                  ) : activePair?.resultKind === "ettersok" ? (
                    <>
                      <ol className="aware-ettersok-steps">
                        <li>
                          Trykk på kartet og legg et <strong>søkespor</strong>{" "}
                          i fluktretningen / rundt skuddplassen.
                        </li>
                        <li>
                          Kjør <strong>Ettersøk</strong> (
                          {ETTERSOK_SEARCH_MINUTES} min). Sporene blir liggende
                          på kartet så du ser hvor du allerede har søkt.
                        </li>
                      </ol>
                      <p className="shop-row-note">
                        Nytt spor: {activePair.trackPoints.length}
                        {(activePair.searchedTracks?.length ?? 0) > 0
                          ? ` · lagret på kart: ${activePair.searchedTracks!.length}`
                          : ""}
                        {(activePair.ettersokAttempts ?? 0) > 0
                          ? ` · forsøk: ${activePair.ettersokAttempts}`
                          : ""}
                        {activePair.found === true ? " · ferdig" : ""}
                      </p>
                      <div className="aware-ettersok-actions">
                        <button
                          type="button"
                          className="intro-button sheriff-secondary"
                          disabled={
                            activePair.found === true ||
                            activePair.trackPoints.length === 0
                          }
                          onClick={clearDraftTrack}
                        >
                          Fjern ulagret spor
                        </button>
                        <button
                          type="button"
                          className="intro-button"
                          disabled={activePair.found === true}
                          onClick={runEttersokSearch}
                        >
                          Ettersøk (+{ETTERSOK_SEARCH_MINUTES} min)
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="shop-row-note">
                      Trykk på kartet for spor. Deretter ettersøk.
                    </p>
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
              {activePair?.found === true
                ? "Ferdig — fugl funnet"
                : "Avslutt ettersøk"}
            </button>
          ) : (
            <button
              type="button"
              className="intro-button"
              disabled={!liveBakgrunnOk}
              title={
                liveBakgrunnOk
                  ? planning
                    ? "Bakgrunn OK her — gå til målet om du vil skyte derfra"
                    : "Bakgrunn OK"
                  : planning
                    ? "Bakgrunn ikke klar der du står nå — gå til et trygt mål"
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
