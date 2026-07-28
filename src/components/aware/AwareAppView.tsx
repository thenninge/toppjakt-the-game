"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { flushSync } from "react-dom";
import {
  bearingHitsWedge,
  bearingIsSafe,
  coverFactorForCell,
  dangerHazardsForCell,
  dangerWedgesFromOrigin,
  type DangerWedge,
} from "@/lib/aware/cellSafety";
import {
  awareMapMaxMFor,
  awareMetersPerPctFor,
  cellCenterOnAwareMap,
  bearingDegFromTo,
  distanceMBetween,
  stepByKeys,
  stepToward,
  type CellPoint,
} from "@/lib/aware/cellGeometry";
import {
  CLOSE_RANGE_TREE_HENT_MAX_M,
  estimateEttersokFind,
  impactFromShot,
} from "@/lib/aware/ettersok";
import {
  shotPairAimPoint,
  shotPairTrueBirdPoint,
  type AwareAppMode,
  type ShotPair,
} from "@/lib/aware/types";
import type { BirdSpecies } from "@/lib/hunt/birds";
import {
  birdMarkerOnAwareMap,
  densityRatioFromTempC,
  exactBallisticHold,
} from "@/lib/ballistics/solver";
import {
  ShotPairOverlay,
  ShotPairPreview,
  ShotPairRangeRing,
  SearchTrackOverlay,
  FleeDirectionCue,
} from "@/components/aware/ShotPairOverlay";
import { BirdNerveBar } from "@/components/hunt/BirdNerveBar";
import {
  ENCOUNTER_NERVE,
  tickEncounterNerve,
} from "@/lib/game/nervousness";
import {
  CAMCORDER_SETUP_NERVE,
  CHRONO_SETUP_NERVE,
  KESTREL_MEASURE_NERVE,
  shotCamLabel,
  shotCamSetupNerve,
  type ShotCamKind,
} from "@/lib/hunt/shoot";
import {
  BAG_REST_NERVE,
  bipodDeployNerve,
  shootRestNerve,
  type HuntShootRest,
} from "@/lib/hunt/shootRest";
import {
  cellLabel,
  type HuntGridCell,
  type HuntMapAsset,
} from "@/lib/hunt/maps";
import {
  ETTERSOK_MINUTES_PER_TRACK_POINT,
  MINUTES_PER_100M,
  TREE_RECOVERY_MINUTES_PER_100M,
  ettersokMinutesForSearch,
  ettersokSearchDistanceM,
  formatHuntClock,
  treeRecoveryMinutes,
} from "@/lib/hunt/travel";
import {
  crosswindMs,
  formatWindCompass,
  formatWindSpeed,
  type DayWeather,
} from "@/lib/weather/spec";
import type { AmmoSpec } from "@/lib/ammo/spec";

/** Aware map zoom (Aware / Shoot / Track).
 * UI 1× = former ~2.4× visual scale (full terrain, player-centred). */
const AWARE_MAP_ZOOM_BASE = 2.4;
/** Discrete UI zoom levels — outs below 1×, then mild steps up to 2.5×. */
const AWARE_MAP_ZOOM_UI_STEPS = [
  0.25, 0.5, 0.75, 1, 1.25, 1.56, 1.95, 2.5,
] as const;
const AWARE_MAP_ZOOM_UI_MIN = AWARE_MAP_ZOOM_UI_STEPS[0];
const AWARE_MAP_ZOOM_UI_DEFAULT = 1;
const AWARE_MAP_ZOOM_UI_MAX =
  AWARE_MAP_ZOOM_UI_STEPS[AWARE_MAP_ZOOM_UI_STEPS.length - 1]!;
const AWARE_MAP_ZOOM_MIN = AWARE_MAP_ZOOM_BASE * AWARE_MAP_ZOOM_UI_MIN;
const AWARE_MAP_ZOOM_DEFAULT = AWARE_MAP_ZOOM_BASE * AWARE_MAP_ZOOM_UI_DEFAULT;
const AWARE_MAP_ZOOM_MAX = AWARE_MAP_ZOOM_BASE * AWARE_MAP_ZOOM_UI_MAX;

function awareZoomUi(actualZoom: number): number {
  return actualZoom / AWARE_MAP_ZOOM_BASE;
}

function awareZoomFromUi(ui: number): number {
  return ui * AWARE_MAP_ZOOM_BASE;
}

function awareZoomUiLabel(actualZoom: number): string {
  const ui = awareZoomUi(actualZoom);
  return `${ui.toFixed(2).replace(/\.?0+$/, "")}×`;
}

function nearestAwareZoomUiStep(ui: number): number {
  let best: number = AWARE_MAP_ZOOM_UI_STEPS[0]!;
  let bestDist = Math.abs(ui - best);
  for (const step of AWARE_MAP_ZOOM_UI_STEPS) {
    const d = Math.abs(ui - step);
    if (d < bestDist) {
      best = step;
      bestDist = d;
    }
  }
  return best;
}

function bumpAwareZoomUi(ui: number, dir: 1 | -1): number {
  const current = nearestAwareZoomUiStep(ui);
  const idx = AWARE_MAP_ZOOM_UI_STEPS.findIndex((s) => s === current);
  const safeIdx = idx < 0 ? 0 : idx;
  const nextIdx = Math.max(
    0,
    Math.min(AWARE_MAP_ZOOM_UI_STEPS.length - 1, safeIdx + dir),
  );
  return AWARE_MAP_ZOOM_UI_STEPS[nextIdx]!;
}

function mapZoomAllowsPan(zoom: number): boolean {
  return Math.abs(zoom - 1) > 0.001;
}

/** Map click tool under Aware tab (above Til spotting / Gun). */
type AwareMapTool = "aware" | "measure";

export type AwareShootStance = {
  bearingDeg: number;
  distanceM: number;
  hunter: CellPoint;
  bird: CellPoint;
  /** Camcorder was set up before leaving Aware (nerve cost already paid). */
  camcorderActive?: boolean;
  /** Chronograph set up before leaving Aware (nerve cost already paid). */
  chronoActive?: boolean;
  /** Kestrel enviro measured in Aware (nerve cost already paid). */
  kestrelEnviroActive?: boolean;
  /** Triggercam started in Aware before the shot. */
  triggercamActive?: boolean;
  /** Rifle already deployed in Aware (nerve paid). */
  gunDeployed?: boolean;
  /** Bird nervousness carried into the shoot scene (0–cap). */
  birdNerve?: number;
  /** Pack rest or deployed bipod — gates hunt weapon calm. */
  rest?: HuntShootRest;
};

/**
 * Snapshot when leaving Aware (Til spotting / Tilbake).
 * Gun + rest + Kestrel stick across spotting; camcorder / chrono / triggercam do not.
 */
export type AwareLeaveOpts = {
  hunter?: CellPoint;
  gunDeployed?: boolean;
  rest?: HuntShootRest;
  kestrelEnviroReady?: boolean;
};

type AwareAppViewProps = {
  map: HuntMapAsset;
  cell: HuntGridCell;
  /** Initial LRF distance to bird (hunter starts at cell center). */
  birdDistanceM: number;
  /** Initial firing bearing toward the bird (deg, 0 = north/up). */
  birdBearingDeg: number;
  /** Locked LRF reading vs eyes estimate. */
  rangeSource?: "lrf" | "estimated";
  weather: DayWeather;
  /** Resume hunter/bird markers (ettersøk) so map matches the shot. */
  initialHunter?: CellPoint | null;
  initialBird?: CellPoint | null;
  /** Kit camo bird-spot factor (lower = better). Used by nerve model. */
  camoSneakPct?: number;
  /**
   * Starting nerve for this encounter (e.g. already-spooked bird at 40%).
   * All player choices add on top of this baseline until flush.
   */
  initialBirdNerve?: number;
  /** Camcorder already deployed (e.g. returning from shoot). */
  initialCamcorderReady?: boolean;
  /** Chronograph already deployed (e.g. returning from shoot). */
  initialChronoReady?: boolean;
  /** Kestrel enviro already measured this encounter. */
  initialKestrelEnviroReady?: boolean;
  /** Triggercam already started this encounter. */
  initialTriggercamReady?: boolean;
  /** Rifle already deployed this encounter. */
  initialGunDeployed?: boolean;
  /** Rest choice restored when returning from shoot. */
  initialRest?: HuntShootRest;
  /** Has LRF — Shoot-tab still useful, but less critical. */
  hasLrf?: boolean;
  ammo?: Pick<AmmoSpec, "v0" | "bc" | "bcModel"> | null;
  hasKestrel?: boolean;
  hasBdx?: boolean;
  /** Kit includes a deployable hunt camcorder. */
  hasCamcorder?: boolean;
  /** Nerve bump (0–1) when deploying the equipped camcorder. */
  camcorderSetupNerve?: number;
  /** Kit includes Garmin Xero chronograph. */
  hasChronograph?: boolean;
  /** Triggercam or Scopemate in kit — start in Aware for AAR / skuddpar autofill. */
  hasTriggercam?: boolean;
  /** Which shot-cam is active when {@link hasTriggercam} (Triggercam preferred). */
  shotCamKind?: ShotCamKind | null;
  /** Backpack in kit — can use as shooting rest. */
  hasBackpack?: boolean;
  /** Bipod in kit — can deploy for calm (not auto). */
  hasBipod?: boolean;
  /** Kit bipod weaponCalm 1–10 (for nerve label). */
  bipodWeaponCalm?: number;
  /**
   * Bird-nerve when deploying the rifle (0–1), from backpack QR.
   * 10 QR → ~1 %, 1 QR → 10 %.
   */
  gunDeployNerve?: number;
  /** Rifle taken out of the pack (parent tracks for remount / auto-mount). */
  onGunDeployed?: () => void;
  /** Rifle mounted back into the pack (parent bumps unspotted birds). */
  onMountGun?: () => void;
  clockMinutes: number;
  shotPairs: ShotPair[];
  focusPairId?: string | null;
  onShotPairsChange: (pairs: ShotPair[]) => void;
  onGameSeconds: (sec: number) => void;
  /**
   * Real seconds spent sneaking (arrows / hold-to-sneak) — raises pulse.
   */
  onAwareSneakRealSec?: (realSec: number) => void;
  /**
   * Track effort: body/mind fatigue + distance travelled for ettersøk /
   * tree recovery (clock is still via onGameSeconds).
   */
  onEttersokEffort?: (opts: {
    minutes: number;
    distanceM: number;
  }) => void;
  onProceedToShoot: (stance?: AwareShootStance) => void;
  /**
   * Give up wounded ettersøk for one pair (active Track bird only).
   * Bird lost + mental hit — not used for tree-hent.
   */
  onAbandonSearch?: (pairId: string) => void;
  onBirdFlushed: (nervousness: number) => void;
  /** Live nerve for global HUD BIRD bar (0–cap). */
  onNerveChange?: (nerve: number) => void;
  /** Footer leave button label (default Back to Spot). */
  abortLabel?: string;
  /**
   * Leave Aware; pass current stand + sticky gear so Til spotting can restore
   * Deploy / rest / Kestrel without re-paying (cam/chrono/triggercam reset).
   */
  onAbort: (opts?: AwareLeaveOpts) => void;
  /** Called when a skuddpar is confirmed found (tree / ettersøk). */
  onPairFound?: (
    pair: ShotPair,
    opts?: { hunter?: CellPoint },
  ) => void;
  /**
   * Post-shot: bird already hit — register skuddpar while aim marker is up.
   * Starts on Shoot tab; no Klar til skudd / nerve flush.
   */
  postShotSkuddparMode?: boolean;
  /** Seconds left in the register window (HUD). */
  postShotSkuddparSecLeft?: number;
  /**
   * No live engage — Gun opens for turret prep (bakgrunn not required).
   */
  gunPrepOnly?: boolean;
  /** Persist skuddpar after a post-shot Shoot registration. */
  onPostShotSkuddparSaved?: (draft: {
    stand: CellPoint;
    target: CellPoint;
    distanceM: number;
    bearingDeg: number;
  }) => void;
};

type MoveKeys = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
};

const MOVE_SPEED_MPS = 14;
/** Game seconds per real second while sneaking toward an Aware plan point. */
const AWARE_SNEAK_TIME_FACTOR = 10;
/** Ambient Aware clock when standing still (unchanged feel). */
const AWARE_IDLE_TIME_FACTOR = 8;
/** Extra nerve while moving — stalking was too safe. */
const AWARE_SNEAK_NERVE_MULT = 2;

/** Aware Shoot wizard: stand → avstand (sirkel) → skuddretning → lagre. */
type ShootWizard =
  | { phase: "idle" }
  | {
      phase: "range" | "direction";
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

/** Store/display bearing always in 0–359. */
function normalizeBearingDeg(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

/**
 * Skuddpar direction slider: center = N (0°), right = clockwise,
 * left = counter-clockwise. Maps 0–359 ↔ −180…+180 for the thumb.
 */
function bearingToSliderOffset(bearingDeg: number): number {
  let d = normalizeBearingDeg(bearingDeg);
  if (d > 180) d -= 360;
  return d;
}

function sliderOffsetToBearing(offset: number): number {
  return normalizeBearingDeg(offset);
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

/** Aware safety ring — kakestykker are drawn inside this radius. */
const AWARE_RING_RADIUS_M = 1000;

function DangerOverlay({
  wedges,
  center,
  bearingDeg,
  shotSafe,
  ringRadiusPct,
}: {
  wedges: DangerWedge[];
  center: CellPoint;
  /** Locked LRF / F mark compass bearing (direction only). */
  bearingDeg: number;
  shotSafe: boolean;
  /** Map-% radius of the 1000 m Aware ring. */
  ringRadiusPct: number;
}) {
  const tipRad = ((bearingDeg - 90) * Math.PI) / 180;
  const tipX = center.x + ringRadiusPct * 0.92 * Math.cos(tipRad);
  const tipY = center.y + ringRadiusPct * 0.92 * Math.sin(tipRad);
  const ringDiamPct = ringRadiusPct * 2;
  return (
    <>
      <div
        className="aware-safety-ring"
        style={{
          left: `${center.x}%`,
          top: `${center.y}%`,
          width: `${ringDiamPct}%`,
        }}
        title={`${AWARE_RING_RADIUS_M} m`}
        aria-hidden
      />
      <svg
        className="aware-hab-svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden
      >
        {wedges.map((w, i) => (
          <path
            key={`${w.kind}-${i}`}
            d={sliceWedgePath(
              center.x,
              center.y,
              ringRadiusPct,
              w.bearingDeg,
              w.halfAngleDeg,
            )}
            fill={w.fill}
            stroke="rgba(255,220,160,0.55)"
            strokeWidth="0.35"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {/* Direction only — LRF / F mark bearing from ring centre. */}
        <line
          x1={center.x}
          y1={center.y}
          x2={tipX}
          y2={tipY}
          stroke={
            shotSafe ? "rgba(143, 239, 106, 0.95)" : "rgba(240, 80, 70, 0.95)"
          }
          strokeWidth="0.7"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <polygon
          points="0,-2.2 1.4,1.2 -1.4,1.2"
          fill={
            shotSafe ? "rgba(143, 239, 106, 0.95)" : "rgba(240, 80, 70, 0.95)"
          }
          transform={`translate(${tipX} ${tipY}) rotate(${bearingDeg})`}
        />
      </svg>
    </>
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
  rangeSource = "estimated",
  weather,
  initialHunter = null,
  initialBird = null,
  camoSneakPct = 0,
  initialBirdNerve = 0,
  initialCamcorderReady = false,
  initialChronoReady = false,
  initialKestrelEnviroReady = false,
  initialTriggercamReady = false,
  initialGunDeployed = false,
  initialRest = "none",
  hasLrf = false,
  ammo = null,
  hasKestrel = false,
  hasBdx = false,
  hasCamcorder = false,
  camcorderSetupNerve = CAMCORDER_SETUP_NERVE,
  hasChronograph = false,
  hasTriggercam = false,
  shotCamKind = null,
  hasBackpack = false,
  hasBipod = false,
  bipodWeaponCalm = 5,
  gunDeployNerve = 0.1,
  onGunDeployed,
  onMountGun,
  clockMinutes,
  shotPairs,
  focusPairId = null,
  onShotPairsChange,
  onGameSeconds,
  onAwareSneakRealSec,
  onEttersokEffort,
  onProceedToShoot,
  onAbandonSearch,
  onBirdFlushed,
  onNerveChange,
  abortLabel = "Til spotting",
  onAbort,
  onPairFound,
  postShotSkuddparMode = false,
  postShotSkuddparSecLeft = 0,
  gunPrepOnly = false,
  onPostShotSkuddparSaved,
}: AwareAppViewProps) {
  const stalking = !focusPairId;
  const [mode, setMode] = useState<AwareAppMode>(
    focusPairId ? "track" : postShotSkuddparMode ? "shoot" : "aware",
  );
  const [camcorderReady, setCamcorderReady] = useState(initialCamcorderReady);
  const [chronoReady, setChronoReady] = useState(initialChronoReady);
  const [kestrelEnviroReady, setKestrelEnviroReady] = useState(
    initialKestrelEnviroReady,
  );
  const [triggercamReady, setTriggercamReady] = useState(
    initialTriggercamReady,
  );
  const [gunDeployed, setGunDeployed] = useState(initialGunDeployed);
  const [rest, setRest] = useState<HuntShootRest>(() => {
    if (initialRest === "bipod" && !hasBipod) return "none";
    if (initialRest === "backpack" && !hasBackpack) return "none";
    if (!initialGunDeployed && (initialRest === "bipod" || initialRest === "backpack")) {
      return "none";
    }
    return initialRest;
  });
  const [hunter, setHunter] = useState<CellPoint>(
    () => initialHunter ?? cellCenterOnAwareMap(cell, map),
  );
  const [destination, setDestination] = useState<CellPoint | null>(null);
  const [mapTool, setMapTool] = useState<AwareMapTool>("aware");
  const [measureA, setMeasureA] = useState<CellPoint | null>(null);
  const [measureB, setMeasureB] = useState<CellPoint | null>(null);
  const [nerve, setNerve] = useState(() =>
    Math.min(ENCOUNTER_NERVE.nerveCap, Math.max(0, initialBirdNerve)),
  );
  const [moveHoldSec, setMoveHoldSec] = useState(0);
  /** Mobile: hold «Sneak to Aware-point» — UI active state. */
  const [sneakToPointHeld, setSneakToPointHeld] = useState(false);
  const [shootWizard, setShootWizard] = useState<ShootWizard>({
    phase: "idle",
  });
  const [status, setStatus] = useState(() => {
    if (postShotSkuddparMode) {
      return "Skudd avfyrt — fugleposisjonen er synlig en kort stund. Shoot → registrer stand og tre før tiden går ut.";
    }
    if (stalking) {
      if (initialBirdNerve > 0) {
        return "Fuglen er allerede skremt én gang — mer nervøs. Trykk på kartet · hold piltaster. Hold øye med nervøsitet.";
      }
      return "Trykk på kartet for trygg sone · hold piltaster for å flytte deg. Hold øye med nervøsitet.";
    }
    const pair = shotPairs.find((p) => p.id === focusPairId);
    if (
      pair?.resultKind === "instant_kill" ||
      pair?.resultKind === "vital_kill"
    ) {
      return `Hent/søk — drept fugl i treet. «Hent ved treet» tar tid fra der du står (${TREE_RECOVERY_MINUTES_PER_100M} min/100 m).`;
    }
    if (pair?.resultKind === "ettersok" && pair.fleeObservation) {
      return `Ettersøk: flukt ${pair.fleeObservation.compassLabel}. Legg søkespor på kartet (${ETTERSOK_MINUTES_PER_TRACK_POINT} min/punkt + ${MINUTES_PER_100M} min/100 m), deretter utfør ettersøk.`;
    }
    if (pair?.fleeObservation?.text) return pair.fleeObservation.text;
    return "Hent/søk — lagret skuddpar: stand → stiplet linje → tre. Finn riktig tre eller følg flukt.";
  });
  const [activePairId, setActivePairId] = useState<string | null>(
    focusPairId,
  );
  /** Map zoom for Shoot (skuddpar) + Track only. Cap 3×. */
  const [mapZoom, setMapZoom] = useState(AWARE_MAP_ZOOM_DEFAULT);
  const [mapPanPx, setMapPanPx] = useState({ x: 0, y: 0 });
  const mapZoomRef = useRef(mapZoom);
  mapZoomRef.current = mapZoom;

  const keysRef = useRef<MoveKeys>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  /** Touch: hold button under map to sneak toward destination. */
  const sneakToPointHeldRef = useRef(false);
  const hunterRef = useRef(hunter);
  hunterRef.current = hunter;
  const destRef = useRef(destination);
  destRef.current = destination;
  /** Source of truth for the rAF sim — do not sync from state (wipes instant bumps). */
  const nerveRef = useRef(
    Math.min(ENCOUNTER_NERVE.nerveCap, Math.max(0, initialBirdNerve)),
  );
  const onNerveChangeRef = useRef(onNerveChange);
  onNerveChangeRef.current = onNerveChange;
  const moveHoldRef = useRef(0);
  const flushedRef = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const mapFrameRef = useRef<HTMLDivElement>(null);
  const mapPanDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
    moved: boolean;
  } | null>(null);
  const suppressMapClickRef = useRef(false);

  const onGameSecondsRef = useRef(onGameSeconds);
  onGameSecondsRef.current = onGameSeconds;
  const onAwareSneakRealSecRef = useRef(onAwareSneakRealSec);
  onAwareSneakRealSecRef.current = onAwareSneakRealSec;
  const onBirdFlushedRef = useRef(onBirdFlushed);
  onBirdFlushedRef.current = onBirdFlushed;
  const camoRef = useRef(camoSneakPct);
  camoRef.current = camoSneakPct;

  /** Per-terrain Aware distance scale (Finnskogen default when unset). */
  const mapMaxM = awareMapMaxMFor(map);
  const metersPerPct = awareMetersPerPctFor(map);
  const movePctPerSec = MOVE_SPEED_MPS / metersPerPct;

  /** Bird world position — fixed from LRF/init, or resumed for ettersøk. */
  const birdWorld = useMemo(() => {
    if (initialBird) return initialBird;
    const origin = initialHunter ?? cellCenterOnAwareMap(cell, map);
    return birdMarkerOnAwareMap(birdDistanceM, birdBearingDeg, {
      origin,
      maxM: mapMaxM,
    });
  }, [
    initialBird,
    initialHunter,
    birdDistanceM,
    birdBearingDeg,
    cell,
    map,
    mapMaxM,
  ]);

  const liveDistanceM = distanceMBetween(hunter, birdWorld, metersPerPct);
  const liveBearing = bearingDegFromTo(hunter, birdWorld);
  /** Clicked map mål: preview Aware cakes + direction from there (planning). */
  const planOrigin = destination ?? hunter;
  const planDistanceM = distanceMBetween(planOrigin, birdWorld, metersPerPct);
  /** Locked LRF / F mark — direction only (not toward live bird seat). */
  const measuredBearing = normalizeBearingDeg(birdBearingDeg);
  const planning = destination != null;
  /** Walk distance from current stand to the clicked Aware plan point. */
  const walkToPlanM = planning
    ? distanceMBetween(hunter, destination, metersPerPct)
    : null;
  const measureDistM =
    measureA && measureB
      ? distanceMBetween(measureA, measureB, metersPerPct)
      : null;
  const ringRadiusPct = AWARE_RING_RADIUS_M / metersPerPct;

  /** Fixed far hazards for this cell — bearing + width frozen for the encounter. */
  const dangerHazards = useMemo(
    () => dangerHazardsForCell(map.id, cell),
    [map.id, cell],
  );
  /** Cakes: same frozen angles; only apex follows plan / hunter. */
  const dangerWedges = useMemo(
    () => dangerWedgesFromOrigin(dangerHazards, planOrigin),
    [dangerHazards, planOrigin],
  );
  /** Klar til skudd — same frozen wedges, apex at where you stand. */
  const liveDangerWedges = useMemo(
    () => dangerWedgesFromOrigin(dangerHazards, hunter),
    [dangerHazards, hunter],
  );

  const windSnap =
    hasKestrel && kestrelEnviroReady ? weather.live : weather.forecast;
  const shotCrosswind = crosswindMs(
    windSnap.windSpeedMs,
    windSnap.windFromDeg,
    measuredBearing,
  );
  const density = densityRatioFromTempC(windSnap.temperatureC);
  const holdHint =
    hasKestrel && hasBdx && ammo
      ? exactBallisticHold(ammo, planDistanceM, shotCrosswind, {
          densityRatio: density,
          powderTempC: windSnap.temperatureC,
        })
      : null;

  /** Preview safety from plan stand (or hunter if no mål) along LRF/F bearing. */
  const bakgrunnOk = bearingIsSafe(measuredBearing, dangerWedges);
  const blockingWedge = dangerWedges.find((w) =>
    bearingHitsWedge(measuredBearing, w),
  );
  const safeHab = !dangerWedges.some(
    (w) => w.kind === "habitation" && bearingHitsWedge(measuredBearing, w),
  );
  const safeTerrain = !dangerWedges.some(
    (w) => w.kind === "terrain" && bearingHitsWedge(measuredBearing, w),
  );
  /** Actual stand — Klar til skudd must use where you are now. */
  const liveBakgrunnOk = bearingIsSafe(measuredBearing, liveDangerWedges);
  const coverFactor = useMemo(
    () => coverFactorForCell(map.id, cell),
    [map.id, cell],
  );

  const shootWizardActive = shootWizard.phase !== "idle";
  /** Cam gear that "remembers" stand→bird for skuddpar autofill. */
  const skuddparAutofill = triggercamReady || camcorderReady;
  const activeShotCam: ShotCamKind | null = hasTriggercam
    ? (shotCamKind ?? "triggercam")
    : null;
  const shotCamName = activeShotCam
    ? shotCamLabel(activeShotCam)
    : "Triggercam";
  const shotCamNervePct = activeShotCam
    ? Math.round(shotCamSetupNerve(activeShotCam) * 100)
    : 5;
  /** Stand→bird while defining skuddpar (wizard stand is frozen). */
  const wizardBirdDistanceM =
    shootWizardActive && skuddparAutofill
      ? distanceMBetween(shootWizard.stand, birdWorld, metersPerPct)
      : null;
  const wizardBirdBearingDeg =
    shootWizardActive && skuddparAutofill
      ? bearingDegFromTo(shootWizard.stand, birdWorld)
      : null;

  // Keyboard: arrow movement while stalking (not during skuddpar wizard)
  useEffect(() => {
    if (!stalking || shootWizardActive) return;

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
      sneakToPointHeldRef.current = false;
      setSneakToPointHeld(false);
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
  }, [stalking, shootWizardActive]);

  // rAF: move + nerve + clock
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let accGame = 0;

    function tick(now: number) {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (stalking && !flushedRef.current && !shootWizardActive) {
        const keys = keysRef.current;
        const arrowMoving =
          keys.up || keys.down || keys.left || keys.right;
        const dest = destRef.current;
        const sneakBtnMoving = sneakToPointHeldRef.current && dest != null;
        const moving = arrowMoving || sneakBtnMoving;
        if (moving) {
          moveHoldRef.current += dt;
          onAwareSneakRealSecRef.current?.(dt);
          const step = movePctPerSec * dt;
          let next = hunterRef.current;
          if (dest && (sneakBtnMoving || arrowMoving)) {
            next = stepToward(next, dest, step);
            if (distanceMBetween(next, dest, metersPerPct) < metersPerPct * 0.4) {
              setDestination(null);
              destRef.current = null;
              if (sneakToPointHeldRef.current) {
                sneakToPointHeldRef.current = false;
                setSneakToPointHeld(false);
              }
            }
          } else if (arrowMoving) {
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

        // 10× while sneaking; idle keeps ambient clock.
        const timeFactor = moving
          ? AWARE_SNEAK_TIME_FACTOR
          : AWARE_IDLE_TIME_FACTOR;
        const gameDt = dt * timeFactor;
        accGame += gameDt;
        if (accGame >= 1) {
          const whole = Math.floor(accGame);
          accGame -= whole;
          onGameSecondsRef.current(whole);
        }

        if (!postShotSkuddparMode && !gunPrepOnly) {
          const dist = distanceMBetween(hunterRef.current, birdWorld, metersPerPct);
          const nerveDt = moving ? dt * AWARE_SNEAK_NERVE_MULT : dt;
          const result = tickEncounterNerve(nerveRef.current, nerveDt, {
            distanceM: dist,
            isMoving: moving,
            moveHoldSec: moveHoldRef.current,
            camoSneakPct: camoRef.current,
            coverFactor,
          });
          nerveRef.current = result.nerve;
          setNerve(result.nerve);
          onNerveChangeRef.current?.(result.nerve);
          if (result.flushes) {
            flushedRef.current = true;
            onBirdFlushedRef.current(result.nerve);
          }
        }
      } else {
        const gameDt = dt * AWARE_IDLE_TIME_FACTOR;
        accGame += gameDt;
        if (accGame >= 1) {
          const whole = Math.floor(accGame);
          accGame -= whole;
          onGameSecondsRef.current(whole);
        }
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stalking, birdWorld, coverFactor, shootWizardActive, postShotSkuddparMode, gunPrepOnly]);

  const activePair = shotPairs.find((p) => p.id === activePairId) ?? null;

  /**
   * Track actions only for pairs tied to a real shot (harvestDraft).
   * Planning-only Shoot skuddpar must not appear as «Søk tiur».
   */
  const actionableTrackPairs = useMemo(() => {
    const open = shotPairs.filter(
      (p) =>
        p.found == null &&
        !!p.harvestDraft &&
        (p.resultKind === "instant_kill" ||
          p.resultKind === "vital_kill" ||
          p.resultKind === "ettersok"),
    );
    const onCell = open.filter(
      (p) => p.cell.row === cell.row && p.cell.col === cell.col,
    );
    return onCell.length > 0 ? onCell : open;
  }, [shotPairs, cell.row, cell.col]);

  const trackActivePair =
    actionableTrackPairs.find((p) => p.id === activePairId) ??
    actionableTrackPairs[0] ??
    null;

  /** Walk distance from current stand to this pair's tree (true fall). */
  const recoveryWalkM =
    trackActivePair &&
    (trackActivePair.resultKind === "instant_kill" ||
      trackActivePair.resultKind === "vital_kill") &&
    trackActivePair.found !== true
      ? Math.round(
          distanceMBetween(
            hunter,
            shotPairTrueBirdPoint(trackActivePair),
            metersPerPct,
          ),
        )
      : null;
  const recoveryMinutes =
    recoveryWalkM != null ? treeRecoveryMinutes(recoveryWalkM) : null;
  /**
   * Don't spoil exact land / bird seat during ettersøk or hent/søk — player
   * uses skuddpar (stand → aim) + flee cue. Also never show the live bird X on
   * Shoot/Track tabs (pair aim uses a distinct tre-marker). Keep visible during
   * the 60 s post-shot skuddpar window, and during Aware stalk.
   */
  const hideTrueLand =
    !postShotSkuddparMode &&
    !!focusPairId &&
    !!activePair &&
    activePair.found !== true;
  /**
   * Active bird encounter (LRF/Engage stalk or post-shot ghost).
   * Gun-prep / review / hidden ettersøk — no bird distances.
   */
  const hasActiveBird = !gunPrepOnly && !hideTrueLand;
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

  /** Pan so `point` (map %) sits at the viewport centre (clamped to map). */
  function panToMapPoint(
    point: CellPoint,
    zoom: number,
  ): { x: number; y: number } {
    const frame = mapFrameRef.current;
    if (!frame || !mapZoomAllowsPan(zoom)) return { x: 0, y: 0 };
    const w = frame.clientWidth;
    const h = frame.clientHeight;
    if (w < 2 || h < 2) return { x: 0, y: 0 };
    const nx = point.x / 100;
    const ny = point.y / 100;
    return clampMapPan(
      {
        x: -w * (nx - 0.5) * zoom,
        y: -h * (ny - 0.5) * zoom,
      },
      zoom,
    );
  }

  function panToPlayer(zoom: number): { x: number; y: number } {
    return panToMapPoint(hunterRef.current, zoom);
  }

  function clampMapPan(
    pan: { x: number; y: number },
    zoom: number,
  ): { x: number; y: number } {
    const frame = mapFrameRef.current;
    if (!frame || !mapZoomAllowsPan(zoom)) return { x: 0, y: 0 };
    const w = frame.clientWidth;
    const h = frame.clientHeight;
    // zoom > 1: pan within magnified excess; zoom < 1: nudge shrunk map in frame.
    const maxX = (Math.abs(zoom - 1) / 2) * w;
    const maxY = (Math.abs(zoom - 1) / 2) * h;
    return {
      x: Math.max(-maxX, Math.min(maxX, pan.x)),
      y: Math.max(-maxY, Math.min(maxY, pan.y)),
    };
  }

  function bumpMapZoom(dir: 1 | -1) {
    setMapZoom((z) => {
      const nextUi = bumpAwareZoomUi(awareZoomUi(z), dir);
      const clamped = awareZoomFromUi(nextUi);
      setMapPanPx((pan) => clampMapPan(pan, clamped));
      return clamped;
    });
  }

  function resetMapZoom() {
    setMapZoom(AWARE_MAP_ZOOM_DEFAULT);
    setMapPanPx(panToPlayer(AWARE_MAP_ZOOM_DEFAULT));
  }

  // Default 1× (base 2.4) centred on the player; re-centre when stand cell / map changes.
  useLayoutEffect(() => {
    const frame = mapFrameRef.current;
    if (!frame) return;
    const apply = () => setMapPanPx(panToPlayer(mapZoomRef.current));
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(frame);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pan helpers close over hunter/map
  }, [cell.row, cell.col, map.id, map.cols, map.rows]);

  function setMapDestination(e: MouseEvent<HTMLDivElement>) {
    if (!stalking || mode !== "aware") return;
    const point = mapClickPoint(e);
    setDestination(point);
    const walkM = Math.round(distanceMBetween(hunter, point, metersPerPct));
    const nHab = dangerHazards.filter((h) => h.kind === "habitation").length;
    const nTerr = dangerHazards.filter((h) => h.kind === "terrain").length;
    const cakes =
      nHab + nTerr === 0
        ? "Ingen farlige kakestykker i denne cellen (stiplet 1000 m-sirkel · grønn/rød = LRF/F-retning)."
        : `Kakestykker fra punktet: ${nHab} bebyggelse · ${nTerr} terreng (i 1000 m-sirkel).`;
    const birdBit = hasActiveBird
      ? ` · ${Math.round(distanceMBetween(point, birdWorld, metersPerPct))} m til fugl`
      : "";
    setStatus(
      `${cakes} (${walkM} m å gå${birdBit}). Hold piltast — eller «Sneak to Aware-point» — for å snike dit.`,
    );
    stageRef.current?.focus();
  }

  function setMapMeasurePoint(e: MouseEvent<HTMLDivElement>) {
    if (!stalking || mode !== "aware") return;
    const point = mapClickPoint(e);
    if (!measureA || measureB) {
      setMeasureA(point);
      setMeasureB(null);
      setStatus("Measure: punkt 1 satt — klikk punkt 2 for avstand.");
    } else {
      setMeasureB(point);
      const m = Math.round(distanceMBetween(measureA, point, metersPerPct));
      setStatus(`Measure: ${m} m mellom punktene.`);
    }
    stageRef.current?.focus();
  }

  function selectMapTool(tool: AwareMapTool) {
    setMapTool(tool);
    if (tool === "measure") {
      setStatus("Measure: klikk to punkter på kartet for å måle avstand.");
    } else {
      setMeasureA(null);
      setMeasureB(null);
      if (stalking) {
        setStatus(
          "Aware: klikk på kartet for å regne kakestykker fra det punktet.",
        );
      }
    }
  }

  function startShootPair() {
    const stand = { ...hunter };
    if (skuddparAutofill) {
      const exactDist = distanceMBetween(stand, birdWorld, metersPerPct);
      const exactBearing = bearingDegFromTo(stand, birdWorld);
      const rangeM = Math.max(
        50,
        Math.min(mapMaxM, Math.round(exactDist / 5) * 5),
      );
      const bearingDeg = normalizeBearingDeg(exactBearing);
      setShootWizard({
        phase: "range",
        stand,
        rangeM,
        bearingDeg,
      });
      setStatus(
        `Skuddpar (cam): stand låst. Prefylt ${Math.round(exactDist)} m / ${bearingDeg}° — juster avstand (sirkel), deretter retning og lagre.`,
      );
      return;
    }
    // No cam: blank dials — player must knote range/direction from memory.
    setShootWizard({
      phase: "range",
      stand,
      rangeM: 200,
      bearingDeg: 0,
    });
    setStatus(
      "Skuddpar: stand låst. Sett avstand (sirkel), deretter skuddretning — ingen autofyll uten cam.",
    );
  }

  /** Cancel only the skuddpar wizard — does not abort ettersøk / Aware. */
  function cancelShootWizard() {
    setShootWizard({ phase: "idle" });
    setStatus("Skuddpar-registrering avbrutt.");
  }

  function saveShootPair() {
    if (shootWizard.phase === "idle") return;
    const { stand, rangeM, bearingDeg } = shootWizard;
    const dialed = impactFromShot({
      stand,
      bearingDeg,
      distanceM: rangeM,
      metersPerPct,
    });
    // Snap to true bird only when cam autofill is allowed (within one slider step).
    const snapM = distanceMBetween(dialed, birdWorld, metersPerPct);
    const target =
      skuddparAutofill && snapM <= 12 ? { ...birdWorld } : dialed;
    const distanceM = Math.round(distanceMBetween(stand, target, metersPerPct));
    const bearing = Math.round(bearingDegFromTo(stand, target));

    if (postShotSkuddparMode && onPostShotSkuddparSaved) {
      onPostShotSkuddparSaved({
        stand,
        target,
        distanceM,
        bearingDeg: bearing,
      });
      setShootWizard({ phase: "idle" });
      return;
    }

    const pair: ShotPair = {
      id: `pair-${Date.now()}`,
      atMs: Date.now(),
      cell: { ...cell },
      cellLabel: cellLabel(cell),
      stand,
      target,
      impact: target,
      distanceM,
      bearingDeg: bearing,
      resultKind: "ettersok",
      trackPoints: [],
      found: null,
      skuddparCommitted: true,
    };
    onShotPairsChange([pair, ...shotPairs]);
    setShootWizard({ phase: "idle" });
    setStatus(
      `Skuddpar lagret: ${pair.distanceM} m / ${compassLabel(pair.bearingDeg)} — synlig på kartet (stand → tre + 20 m). Kobles til neste treff i denne cella.`,
    );
    // Stay on Shoot — planning pairs are not Track targets until a shot lands.
  }

  function addTrackPoint(e: MouseEvent<HTMLDivElement>) {
    if (!trackActivePair || mode !== "track") return;
    if (trackActivePair.found === true) return;
    // Tree kills: only «Hent ved treet» — no søkespor / ettersøk.
    if (
      trackActivePair.resultKind === "instant_kill" ||
      trackActivePair.resultKind === "vital_kill"
    ) {
      return;
    }
    if (trackActivePair.resultKind !== "ettersok") return;
    const point = mapClickPoint(e);
    const next = shotPairs.map((p) =>
      p.id === trackActivePair.id
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
    const nextN = trackActivePair.trackPoints.length + 1;
    const searchMin = ettersokMinutesForSearch(
      nextN,
      trackActivePair.distanceM,
    );
    setStatus(
      `Søkespor #${nextN} markert (${searchMin} min) — trykk «Utfør ettersøk» når sporet er klart.`,
    );
  }

  function clearDraftTrack() {
    if (!trackActivePair || trackActivePair.found === true) return;
    if (trackActivePair.trackPoints.length === 0) return;
    const next = shotPairs.map((p) =>
      p.id === trackActivePair.id ? { ...p, trackPoints: [] } : p,
    );
    onShotPairsChange(next);
    setStatus(
      "Ulagret spor fjernet — gjennomførte søkespor ligger fortsatt på kartet.",
    );
  }

  function onStageClick(e: MouseEvent<HTMLDivElement>) {
    if (mode === "track") addTrackPoint(e);
    else if (mode === "aware" && stalking) {
      if (mapTool === "measure") setMapMeasurePoint(e);
      else setMapDestination(e);
    }
  }

  function onMapPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!mapZoomAllowsPan(mapZoom)) return;
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    mapPanDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origPanX: mapPanPx.x,
      origPanY: mapPanPx.y,
      moved: false,
    };
  }

  function onMapPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = mapPanDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    if (!drag.moved) return;
    setMapPanPx(
      clampMapPan(
        { x: drag.origPanX + dx, y: drag.origPanY + dy },
        mapZoom,
      ),
    );
  }

  function onMapPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = mapPanDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (drag.moved) suppressMapClickRef.current = true;
    mapPanDragRef.current = null;
  }

  function runEttersokSearch() {
    if (!trackActivePair || trackActivePair.found === true) return;
    const trackN = trackActivePair.trackPoints.length;
    if (trackN < 1) {
      setStatus(
        `Legg minst ett søkespor først (${ETTERSOK_MINUTES_PER_TRACK_POINT} min/punkt + ${MINUTES_PER_100M} min/100 m).`,
      );
      return;
    }
    const searchMin = ettersokMinutesForSearch(
      trackN,
      trackActivePair.distanceM,
    );
    onGameSeconds(searchMin * 60);
    onEttersokEffort?.({
      minutes: searchMin,
      distanceM: ettersokSearchDistanceM(trackN, trackActivePair.distanceM),
    });
    const attemptNo = (trackActivePair.ettersokAttempts ?? 0) + 1;
    const est = estimateEttersokFind(trackActivePair);
    const sweep = {
      points: [...trackActivePair.trackPoints],
      atMs: Date.now(),
      found: est.found,
    };
    const updated: ShotPair = {
      ...trackActivePair,
      ettersokAttempts: attemptNo,
      searchedTracks: [...(trackActivePair.searchedTracks ?? []), sweep],
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
      p.id === trackActivePair.id ? updated : p,
    );
    onShotPairsChange(next);
    setStatus(
      est.found
        ? `FUNNET — ettersøk #${attemptNo} (+${searchMin} min). ${est.reason}`
        : `IKKE FUNNET — ettersøk #${attemptNo} (+${searchMin} min). ${est.reason} Søkespor #${attemptNo} ligger på kartet — legg et nytt spor i et annet område.`,
    );
    if (est.found) onPairFound?.(updated, { hunter: { ...hunter } });
  }

  function markRecoveredAtTree() {
    if (!trackActivePair || trackActivePair.found === true) return;
    if (
      trackActivePair.resultKind !== "instant_kill" &&
      trackActivePair.resultKind !== "vital_kill"
    ) {
      return;
    }
    const tree = shotPairTrueBirdPoint(trackActivePair);
    const walkM = Math.round(distanceMBetween(hunter, tree, metersPerPct));
    const recoverMin = treeRecoveryMinutes(walkM);
    onGameSeconds(recoverMin * 60);
    onEttersokEffort?.({
      minutes: recoverMin,
      distanceM: Math.max(0, walkM),
    });
    // Next hent starts from this tree (e.g. another bird 10 m away).
    hunterRef.current = tree;
    setHunter(tree);
    const updated: ShotPair = { ...trackActivePair, found: true };
    const next = shotPairs.map((p) =>
      p.id === trackActivePair.id ? updated : p,
    );
    onShotPairsChange(next);
    setStatus(
      walkM <= 5
        ? `Hentet ved treet (+${recoverMin} min) — du står ved treet. Fasit på treffpunkt.`
        : `Hentet ved treet (+${recoverMin} min · ${walkM} m fra der du sto). Fasit på treffpunkt.`,
    );
    onPairFound?.(updated, { hunter: tree });
  }

  function pairBirdShortNb(pair: ShotPair): string {
    const s = pair.harvestDraft?.species as BirdSpecies | undefined;
    if (s === "orrhane") return "Orre";
    if (s === "ugle") return "Ugle";
    return "Tiur";
  }

  useEffect(() => {
    if (actionableTrackPairs.length === 0) {
      // Planning-only skuddpar must not stay selected as a Track target.
      if (
        activePairId &&
        !shotPairs.some((p) => p.id === activePairId && !!p.harvestDraft)
      ) {
        setActivePairId(null);
      }
      return;
    }
    const stillOpen = actionableTrackPairs.some((p) => p.id === activePairId);
    if (!stillOpen) {
      setActivePairId(actionableTrackPairs[0]!.id);
    }
  }, [actionableTrackPairs, activePairId, shotPairs]);

  function trackPairPickLabel(pair: ShotPair): string {
    const bird = pairBirdShortNb(pair);
    const point =
      pair.resultKind === "instant_kill" || pair.resultKind === "vital_kill"
        ? shotPairTrueBirdPoint(pair)
        : shotPairAimPoint(pair);
    const walkM = Math.round(distanceMBetween(hunter, point, metersPerPct));
    const verb =
      pair.resultKind === "ettersok" ? "Søk" : "Hent";
    return `${verb} ${bird} ${walkM}m`;
  }

  function proceed() {
    if (focusPairId) {
      onProceedToShoot();
      return;
    }
    if (!gunDeployed) {
      setStatus("Deploy gun først — ta rifla frem før tårn / skudd.");
      return;
    }
    onProceedToShoot({
      bearingDeg: hasActiveBird ? liveBearing : measuredBearing,
      distanceM: hasActiveBird ? liveDistanceM : birdDistanceM,
      hunter,
      bird: birdWorld,
      camcorderActive: hasCamcorder && camcorderReady,
      chronoActive: hasChronograph && chronoReady,
      kestrelEnviroActive: hasKestrel && kestrelEnviroReady,
      triggercamActive: hasTriggercam && triggercamReady,
      gunDeployed: true,
      birdNerve: nerveRef.current,
      rest,
    });
  }

  function deployGun() {
    if (gunDeployed || flushedRef.current) return;
    // Nerve only once per «gun out» cycle — Til spotting keeps gun deployed
    // (no re-click). Mount refunds Deploy QR so Redeploy is a single charge.
    const cost = gunPrepOnly ? 0 : Math.max(0, gunDeployNerve);
    const next = Math.min(
      ENCOUNTER_NERVE.nerveCap,
      nerveRef.current + cost,
    );
    nerveRef.current = next;
    flushSync(() => {
      setNerve(next);
      setGunDeployed(true);
    });
    onNerveChangeRef.current?.(next);
    onGunDeployed?.();
    const pct = Math.round(cost * 100);
    setStatus(
      gunPrepOnly
        ? "Gun deployed — klar for tårn / prep."
        : next >= ENCOUNTER_NERVE.flushThreshold
          ? `Gun deployed — men fuglen er svært urolig (+${pct}% nervøsitet)!`
          : `Gun deployed (+${pct}% nervøsitet). Sekk-anlegg / bipod / tårn er tilgjengelig.`,
    );
    if (!gunPrepOnly && next >= ENCOUNTER_NERVE.flushThreshold) {
      flushedRef.current = true;
      onBirdFlushedRef.current(next);
    }
  }

  function mountGun() {
    if (!gunDeployed || flushedRef.current) return;
    /**
     * Refund Deploy QR + anlegg. Leaving deploy on the bird meant Mount →
     * Deploy stacked the same backpack QR cost twice (deploy + deploy).
     * Til spotting with gun still out never hits this path.
     */
    const restRefund =
      rest !== "none" ? shootRestNerve(rest, bipodWeaponCalm) : 0;
    const deployRefund = gunPrepOnly ? 0 : Math.max(0, gunDeployNerve);
    const cleared = Math.max(
      0,
      nerveRef.current - restRefund - deployRefund,
    );
    nerveRef.current = cleared;
    flushSync(() => {
      setNerve(cleared);
      setRest("none");
      setGunDeployed(false);
    });
    onNerveChangeRef.current?.(cleared);
    onMountGun?.();
    setStatus(
      gunPrepOnly
        ? "Gun mounted — rifla i sekken."
        : "Gun mounted — rifla i sekken. Uspottede fugler i feltet blir mer nervøse.",
    );
  }

  function applyRestChoice(next: HuntShootRest) {
    if (!gunDeployed) {
      setStatus("Deploy gun først — anlegg krever at rifla er fremme.");
      return;
    }
    if (flushedRef.current) return;
    if (next === "backpack" && !hasBackpack) return;
    if (next === "bipod" && !hasBipod) return;
    if (next === rest) {
      // Toggle off → none (revert nerve).
      if (rest === "none") return;
      const revert = shootRestNerve(rest, bipodWeaponCalm);
      const cleared = Math.max(0, nerveRef.current - revert);
      nerveRef.current = cleared;
      flushSync(() => {
        setNerve(cleared);
        setRest("none");
      });
      onNerveChangeRef.current?.(cleared);
      setStatus("Anlegg fjernet — skyter uten sekk/bipod-calm.");
      return;
    }
    const prevCost = shootRestNerve(rest, bipodWeaponCalm);
    const nextCost = shootRestNerve(next, bipodWeaponCalm);
    const nextNerve = Math.min(
      ENCOUNTER_NERVE.nerveCap,
      Math.max(0, nerveRef.current - prevCost + nextCost),
    );
    nerveRef.current = nextNerve;
    flushSync(() => {
      setNerve(nextNerve);
      setRest(next);
    });
    onNerveChangeRef.current?.(nextNerve);
    const pct = Math.round(nextCost * 100);
    if (next === "backpack") {
      setStatus(
        nextNerve >= ENCOUNTER_NERVE.flushThreshold
          ? `Sekk som anlegg — men fuglen er svært urolig (+${pct}% nervøsitet)!`
          : `Sekk som anlegg (+${pct}% nervøsitet). Svært stabilt, men mer synlig/lyd.`,
      );
    } else if (next === "bipod") {
      setStatus(
        nextNerve >= ENCOUNTER_NERVE.flushThreshold
          ? `Bipod nede — men fuglen er svært urolig (+${pct}% nervøsitet)!`
          : `Bipod deployet (+${pct}% nervøsitet). Calm fra tofot aktiv i skuddet.`,
      );
    }
    if (nextNerve >= ENCOUNTER_NERVE.flushThreshold) {
      flushedRef.current = true;
      onBirdFlushedRef.current(nextNerve);
    }
  }

  function deployCamcorder() {
    if (!hasCamcorder || camcorderReady || flushedRef.current) return;
    const setupNerve = camcorderSetupNerve;
    const pct = Math.round(setupNerve * 100);
    const next = Math.min(
      ENCOUNTER_NERVE.nerveCap,
      nerveRef.current + setupNerve,
    );
    // Force paint now so the bar jumps before the next rAF tick.
    nerveRef.current = next;
    flushSync(() => {
      setNerve(next);
      setCamcorderReady(true);
    });
    onNerveChangeRef.current?.(next);
    setStatus(
      next >= ENCOUNTER_NERVE.flushThreshold
        ? `Camcorder oppe — men fuglen er svært urolig (+${pct}% nervøsitet)!`
        : `Camcorder satt opp mot standplass (+${pct}% nervøsitet). Bedre ettersøk-oversikt etter skudd.`,
    );
    if (next >= ENCOUNTER_NERVE.flushThreshold) {
      flushedRef.current = true;
      onBirdFlushedRef.current(next);
    }
  }

  function deployChrono() {
    if (!hasChronograph || chronoReady || flushedRef.current) return;
    const next = Math.min(
      ENCOUNTER_NERVE.nerveCap,
      nerveRef.current + CHRONO_SETUP_NERVE,
    );
    nerveRef.current = next;
    flushSync(() => {
      setNerve(next);
      setChronoReady(true);
    });
    onNerveChangeRef.current?.(next);
    setStatus(
      next >= ENCOUNTER_NERVE.flushThreshold
        ? "Chrono oppe — men fuglen er svært urolig (+5% nervøsitet)!"
        : "Chrono satt opp foran stand (+5% nervøsitet). Jakt-skudd logges i shotlog med v0 + temperatur.",
    );
    if (next >= ENCOUNTER_NERVE.flushThreshold) {
      flushedRef.current = true;
      onBirdFlushedRef.current(next);
    }
  }

  function measureKestrelEnviro() {
    if (!hasKestrel || kestrelEnviroReady || flushedRef.current) return;
    const next = Math.min(
      ENCOUNTER_NERVE.nerveCap,
      nerveRef.current + KESTREL_MEASURE_NERVE,
    );
    nerveRef.current = next;
    flushSync(() => {
      setNerve(next);
      setKestrelEnviroReady(true);
    });
    onNerveChangeRef.current?.(next);
    const live = weather.live;
    setStatus(
      next >= ENCOUNTER_NERVE.flushThreshold
        ? `Kestrel målt — men fuglen er svært urolig (+5% nervøsitet)! ${live.temperatureC.toFixed(1)}°C · ${formatWindSpeed(live.windSpeedMs)} fra ${formatWindCompass(live.windFromDeg)}.`
        : `Enviro målt med Kestrel (+5% nervøsitet): ${live.temperatureC.toFixed(1)}°C · ${formatWindSpeed(live.windSpeedMs)} fra ${formatWindCompass(live.windFromDeg)}. App prefyller vind/temp.`,
    );
    if (next >= ENCOUNTER_NERVE.flushThreshold) {
      flushedRef.current = true;
      onBirdFlushedRef.current(next);
    }
  }

  function startTriggercam() {
    if (!activeShotCam || triggercamReady || flushedRef.current) return;
    const nerveCost = shotCamSetupNerve(activeShotCam);
    const next = Math.min(
      ENCOUNTER_NERVE.nerveCap,
      nerveRef.current + nerveCost,
    );
    nerveRef.current = next;
    flushSync(() => {
      setNerve(next);
      setTriggercamReady(true);
    });
    onNerveChangeRef.current?.(next);
    const pct = Math.round(nerveCost * 100);
    setStatus(
      next >= ENCOUNTER_NERVE.flushThreshold
        ? `${shotCamName} startet — men fuglen er svært urolig (+${pct}% nervøsitet)!`
        : `${shotCamName} startet (+${pct}% nervøsitet) — filmer skuddet (AAR) og hjelper skuddpar-autofill.`,
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
          {rangeSource === "lrf" ? (
            <span
              className="lrf-range-callout"
              aria-label={
                hasActiveBird
                  ? Math.abs(liveDistanceM - birdDistanceM) > 3
                    ? `LRF ${Math.round(birdDistanceM)} meter, stand ${Math.round(liveDistanceM)} meter`
                    : `LRF ${Math.round(birdDistanceM)} meter`
                  : `LRF-retning ${measuredBearing}°`
              }
            >
              {hasActiveBird
                ? Math.abs(liveDistanceM - birdDistanceM) > 3
                  ? `Stand ${Math.round(liveDistanceM)} m · LRF ${Math.round(birdDistanceM)} m`
                  : `LRF: ${Math.round(birdDistanceM)} m`
                : `LRF ${measuredBearing}°`}
            </span>
          ) : null}
          <span className="aware-clock">{formatHuntClock(clockMinutes)}</span>
        </header>

        {stalking && !postShotSkuddparMode && !gunPrepOnly ? (
          <BirdNerveBar
            nerve={nerve}
            threshold={ENCOUNTER_NERVE.flushThreshold}
          />
        ) : null}

        {postShotSkuddparMode ? (
          <p className="shop-row-note" style={{ margin: "0.35rem 0.75rem 0" }}>
            Skuddpar-vindu: {postShotSkuddparSecLeft} s — fugleprikk = siktepunkt
          </p>
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

        <div
          ref={mapFrameRef}
          className={
            mapZoomAllowsPan(mapZoom)
              ? "aware-map-frame is-zoomed"
              : "aware-map-frame"
          }
        >
          <div
            className="aware-map-zoom-layer"
            style={
              {
                transform: `translate(${mapPanPx.x}px, ${mapPanPx.y}px) scale(${mapZoom})`,
                ["--aware-marker-inv-zoom"]: String(1 / mapZoom),
              } as CSSProperties
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="aware-map-img"
              src={map.src}
              alt={map.label}
              draggable={false}
            />
            <div
              ref={stageRef}
              className="aware-cell-stage"
              tabIndex={stalking ? 0 : undefined}
              onPointerDown={onMapPointerDown}
              onPointerMove={onMapPointerMove}
              onPointerUp={onMapPointerUp}
              onPointerCancel={onMapPointerUp}
              onClick={(e) => {
                if (suppressMapClickRef.current) {
                  suppressMapClickRef.current = false;
                  return;
                }
                onStageClick(e);
              }}
            >
              {mode === "aware" ? (
                <DangerOverlay
                  wedges={dangerWedges}
                  center={planOrigin}
                  bearingDeg={measuredBearing}
                  shotSafe={bakgrunnOk}
                  ringRadiusPct={ringRadiusPct}
                />
              ) : null}
              {stalking && destination && mode === "aware" ? (
                <span
                  className="aware-dest-marker"
                  style={{ left: `${destination.x}%`, top: `${destination.y}%` }}
                  title="Gå hit"
                />
              ) : null}
              {mode === "aware" && measureA ? (
                <div className="aware-measure-overlay" aria-hidden>
                  {measureB ? (
                    <svg
                      className="aware-measure-line"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                    >
                      <line
                        x1={measureA.x}
                        y1={measureA.y}
                        x2={measureB.x}
                        y2={measureB.y}
                      />
                    </svg>
                  ) : null}
                  <span
                    className="aware-measure-dot"
                    style={{ left: `${measureA.x}%`, top: `${measureA.y}%` }}
                    title="Punkt 1"
                  />
                  {measureB ? (
                    <>
                      <span
                        className="aware-measure-dot"
                        style={{ left: `${measureB.x}%`, top: `${measureB.y}%` }}
                        title="Punkt 2"
                      />
                      {measureDistM != null ? (
                        <span
                          className="aware-measure-label"
                          style={{
                            left: `${(measureA.x + measureB.x) / 2}%`,
                            top: `${(measureA.y + measureB.y) / 2}%`,
                          }}
                        >
                          {Math.round(measureDistM)} m
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : null}
              {pairsOnCell.map((pair) => (
                <ShotPairOverlay
                  key={pair.id}
                  pair={pair}
                  active={pair.id === (trackActivePair ?? activePair)?.id}
                  metersPerPct={metersPerPct}
                />
              ))}
              {pairsOnCell.map((pair) => (
                <SearchTrackOverlay
                  key={`track-${pair.id}`}
                  pair={pair}
                  active={pair.id === (trackActivePair ?? activePair)?.id}
                />
              ))}
              {mode === "shoot" &&
              shootWizard.phase !== "idle" ? (
                <>
                  <ShotPairRangeRing
                    stand={shootWizard.stand}
                    distanceM={shootWizard.rangeM}
                    metersPerPct={metersPerPct}
                  />
                  {shootWizard.phase === "direction" ? (
                    <ShotPairPreview
                      stand={shootWizard.stand}
                      bearingDeg={shootWizard.bearingDeg}
                      rangeM={shootWizard.rangeM}
                      metersPerPct={metersPerPct}
                    />
                  ) : null}
                </>
              ) : null}
              {/* Hunter always shown. True bird only on Aware stalk (or post-shot aim cue). */}
              <span
                className="aware-hunter-marker"
                style={{ left: `${hunter.x}%`, top: `${hunter.y}%` }}
                title="Deg"
              />
              {!hideTrueLand &&
              !gunPrepOnly &&
              (mode === "aware" || postShotSkuddparMode) ? (
                <span
                  className="aware-bird-marker"
                  style={{ left: `${birdWorld.x}%`, top: `${birdWorld.y}%` }}
                  title={
                    postShotSkuddparMode
                      ? `Siktepunkt ${Math.round(liveDistanceM)} m`
                      : `Fugl ${Math.round(liveDistanceM)} m`
                  }
                >
                  <span className="aware-bird-x" aria-hidden />
                  <span className="aware-bird-label">
                    {Math.round(liveDistanceM)} m
                  </span>
                </span>
              ) : null}
              <div
                className="aware-wind-arrow"
                style={{
                  transform: `translate(-50%, -50%) rotate(${windSnap.windFromDeg + 180}deg) scale(var(--aware-marker-inv-zoom, 1))`,
                }}
                title={`Vind fra ${formatWindCompass(windSnap.windFromDeg)}`}
                aria-hidden
              />
              {mode === "track" &&
              trackActivePair?.fleeObservation &&
              trackActivePair.resultKind === "ettersok" ? (
                <FleeDirectionCue
                  origin={trackActivePair.target}
                  bearingDeg={trackActivePair.fleeObservation.observedBearingDeg}
                  compassLabel={trackActivePair.fleeObservation.compassLabel}
                  observedLandDistanceM={
                    trackActivePair.fleeObservation.observedLandDistanceM
                  }
                  metersPerPct={metersPerPct}
                />
              ) : null}
            </div>
          </div>

          <div className="aware-map-zoom" role="group" aria-label="Kartzoom">
              <button
                type="button"
                className="aware-map-zoom-btn"
                disabled={mapZoom <= AWARE_MAP_ZOOM_MIN + 0.001}
                onClick={() => bumpMapZoom(-1)}
                aria-label="Zoom ut"
              >
                −
              </button>
              <button
                type="button"
                className="aware-map-zoom-label"
                onClick={resetMapZoom}
                title="Tilbakestill til 3× på aktiv rute"
              >
                {awareZoomUiLabel(mapZoom)}
              </button>
              <button
                type="button"
                className="aware-map-zoom-btn"
                disabled={mapZoom >= AWARE_MAP_ZOOM_MAX - 0.001}
                onClick={() => bumpMapZoom(1)}
                aria-label="Zoom inn"
              >
                +
              </button>
            </div>
        </div>

        {stalking && mode === "aware" && destination ? (
          <div className="aware-sneak-touch" aria-label="Mobilkontroller">
            <button
              type="button"
              className={
                sneakToPointHeld
                  ? "intro-button aware-sneak-btn is-active"
                  : "intro-button aware-sneak-btn"
              }
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                sneakToPointHeldRef.current = true;
                setSneakToPointHeld(true);
                stageRef.current?.focus();
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
                sneakToPointHeldRef.current = false;
                setSneakToPointHeld(false);
              }}
              onPointerCancel={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                }
                sneakToPointHeldRef.current = false;
                setSneakToPointHeld(false);
              }}
              onContextMenu={(e) => e.preventDefault()}
            >
              Sneak to Aware-point
            </button>
          </div>
        ) : null}

        <div
          className={
            mode === "shoot"
              ? "aware-map-actions aware-map-actions-shoot"
              : mode === "aware"
                ? "aware-map-actions aware-map-actions-aware"
                : "aware-map-actions"
          }
        >
          {mode === "shoot" ? (
            <>
              {shootWizard.phase === "idle" ? (
                <button
                  type="button"
                  className="intro-button"
                  onClick={startShootPair}
                >
                  Registrer nytt skuddpar
                </button>
              ) : null}

              {shootWizard.phase === "range" ? (
                <>
                  <p className="shop-row-note aware-shoot-step">
                    1/2 — Skuddavstand
                    {wizardBirdDistanceM != null
                      ? ` · fugl ${Math.round(wizardBirdDistanceM)} m`
                      : ""}
                  </p>
                  <label className="shop-filter aware-shoot-slider">
                    Avstand {shootWizard.rangeM} m
                    <input
                      type="range"
                      min={50}
                      max={mapMaxM}
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
                        setShootWizard({ ...shootWizard, phase: "direction" })
                      }
                    >
                      Neste: retning
                    </button>
                  </div>
                </>
              ) : null}

              {shootWizard.phase === "direction" ? (
                <>
                  <p className="shop-row-note aware-shoot-step">
                    2/2 — Skuddretning ({compassLabel(shootWizard.bearingDeg)})
                    {wizardBirdBearingDeg != null
                      ? ` · fugl ${normalizeBearingDeg(wizardBirdBearingDeg)}°`
                      : ""}
                  </p>
                  <label className="shop-filter aware-shoot-slider">
                    Retning {normalizeBearingDeg(shootWizard.bearingDeg)}° (0° =
                    N)
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={1}
                      value={bearingToSliderOffset(shootWizard.bearingDeg)}
                      onChange={(e) =>
                        setShootWizard({
                          ...shootWizard,
                          bearingDeg: sliderOffsetToBearing(
                            Number(e.target.value),
                          ),
                        })
                      }
                    />
                  </label>
                  <div className="aware-shoot-nav">
                    <button
                      type="button"
                      className="intro-button sheriff-secondary"
                      onClick={() =>
                        setShootWizard({ ...shootWizard, phase: "range" })
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
            </>
          ) : (
            <>
          {mode === "aware" ? (
            <div className="aware-map-tool-tabs" role="tablist" aria-label="Kartverktøy">
              <button
                type="button"
                role="tab"
                aria-selected={mapTool === "aware"}
                className={
                  mapTool === "aware"
                    ? "aware-map-tool aware-map-tool-active"
                    : "aware-map-tool"
                }
                onClick={() => selectMapTool("aware")}
              >
                Aware
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mapTool === "measure"}
                className={
                  mapTool === "measure"
                    ? "aware-map-tool aware-map-tool-active"
                    : "aware-map-tool"
                }
                onClick={() => selectMapTool("measure")}
              >
                Measure
                {measureDistM != null
                  ? ` · ${Math.round(measureDistM)} m`
                  : ""}
              </button>
            </div>
          ) : null}
          <div className="aware-map-actions-row">
          <button
            type="button"
            className="intro-button sheriff-secondary"
            onClick={() =>
              onAbort({
                hunter: { ...hunter },
                gunDeployed,
                rest,
                kestrelEnviroReady,
              })
            }
          >
            {abortLabel}
          </button>
          {mode === "track" &&
          trackActivePair?.resultKind === "ettersok" &&
          trackActivePair.found !== true ? (
            <>
              <button
                type="button"
                className="intro-button sheriff-secondary"
                disabled={trackActivePair.trackPoints.length === 0}
                onClick={clearDraftTrack}
              >
                Fjern spor
              </button>
              <button
                type="button"
                className="intro-button"
                disabled={trackActivePair.trackPoints.length === 0}
                onClick={runEttersokSearch}
                title={`Utfør ettersøk (${ettersokMinutesForSearch(
                  trackActivePair.trackPoints.length,
                  trackActivePair.distanceM,
                )} min)`}
              >
                Søk ·{" "}
                {ettersokMinutesForSearch(
                  trackActivePair.trackPoints.length,
                  trackActivePair.distanceM,
                )}{" "}
                min
              </button>
              {onAbandonSearch ? (
                <button
                  type="button"
                  className="intro-button sheriff-secondary"
                  onClick={() => onAbandonSearch(trackActivePair.id)}
                  title="Gir opp søket etter denne fuglen — fuglen tapes (mentalt −30 %)"
                >
                  Gi opp søket
                </button>
              ) : null}
            </>
          ) : trackActivePair?.found === true ||
            (focusPairId &&
              (trackActivePair ?? activePair)?.found === true) ? (
            <button
              type="button"
              className="intro-button"
              onClick={proceed}
              title="Ferdig — fugl funnet"
            >
              Ferdig
            </button>
          ) : postShotSkuddparMode ? null : focusPairId ? null : (
            <button
              type="button"
              className="intro-button"
              disabled={
                (!gunPrepOnly && !liveBakgrunnOk) ||
                (!focusPairId && !postShotSkuddparMode && !gunDeployed)
              }
              title={
                gunPrepOnly
                  ? gunDeployed
                    ? "Gun — still tårn / prep (ingen skudd)"
                    : "Deploy gun først"
                  : !gunDeployed
                    ? "Deploy gun først — ta rifla frem"
                    : liveBakgrunnOk
                      ? planning
                        ? "Bakgrunn OK her — gå til målet om du vil skyte derfra"
                        : "Gun · Skuddklar — bakgrunn OK"
                      : planning
                        ? "Bakgrunn ikke klar der du står nå — gå til et trygt mål"
                        : "Flytt deg til sone uten farlig bakgrunn"
              }
              onClick={proceed}
            >
              {gunPrepOnly ? "Gun · tårn" : "Gun · Skuddklar"}
            </button>
          )}
          </div>
            </>
          )}
        </div>

        <div className="aware-panel">
          <p className="aware-cell-label">Celle {cellLabel(cell)}</p>
          {stalking || postShotSkuddparMode ? (
            <dl className="aware-distance-list">
              {hasActiveBird ? (
                <>
                  <div>
                    <dt>Avstand fra deg til fugl</dt>
                    <dd>
                      {Math.round(liveDistanceM)} m · {Math.round(liveBearing)}°
                    </dd>
                  </div>
                  <div>
                    <dt>Avstand fra Aware-point til fugl</dt>
                    <dd>
                      {Math.round(planDistanceM)} m ·{" "}
                      {Math.round(
                        bearingDegFromTo(planOrigin, birdWorld),
                      )}
                      °
                      {!planning ? " · (point = der du står)" : ""}
                    </dd>
                  </div>
                </>
              ) : null}
              <div>
                <dt>Avstand fra deg til Aware-point</dt>
                <dd>
                  {planning
                    ? `${Math.round(walkToPlanM ?? 0)} m`
                    : "0 m · (ingen point valgt — trykk kart)"}
                </dd>
              </div>
              <div>
                <dt>LRF / F-retning</dt>
                <dd>
                  {measuredBearing}° ({compassLabel(measuredBearing)})
                  {bakgrunnOk ? " · trygg" : " · farlig bakgrunn"}
                </dd>
              </div>
            </dl>
          ) : hideTrueLand ? (
            <p className="shop-row-note">
              Eksakt landingspunkt er skjult — bruk skuddpar og fluktretning.
            </p>
          ) : (
            <p className="shop-row-note">
              {Math.round(liveDistanceM)} m · skyteretning{" "}
              {Math.round(liveBearing)}°
            </p>
          )}
          {stalking ? (
            <p className="shop-row-note aware-weather-line">{nerveHint}</p>
          ) : null}
          <p className="shop-row-note aware-weather-line">
            {hasKestrel && kestrelEnviroReady ? "Kestrel" : "Prognose"}:{" "}
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
                className={
                  gunDeployed
                    ? "intro-button sheriff-secondary is-active"
                    : "intro-button sheriff-secondary"
                }
                disabled={gunDeployed}
                onClick={deployGun}
                title={
                  gunPrepOnly
                    ? "Ta rifla frem for tårn-prep"
                    : `Backpack QR: +${Math.round(gunDeployNerve * 100)}% bird nerve (10 QR → +1 %, 1 QR → +10 %)`
                }
              >
                {gunDeployed
                  ? "Gun deployed"
                  : gunPrepOnly
                    ? "Deploy gun"
                    : `Deploy gun (+${Math.round(gunDeployNerve * 100)}% nervøsitet)`}
              </button>
              {gunDeployed ? (
                <button
                  type="button"
                  className="intro-button sheriff-secondary"
                  onClick={mountGun}
                  title="Sett rifla tilbake i sekken. Uspottede fugler i feltet +30% bird nerve."
                >
                  Mount gun
                </button>
              ) : null}
              {hasBackpack ? (
                <button
                  type="button"
                  className={
                    rest === "backpack"
                      ? "intro-button sheriff-secondary is-active"
                      : "intro-button sheriff-secondary"
                  }
                  aria-pressed={rest === "backpack"}
                  disabled={!gunDeployed}
                  onClick={() => applyRestChoice("backpack")}
                  title={
                    gunDeployed
                      ? "Dobbelt calm vs beste bipod — +25% bird nerve"
                      : "Deploy gun først"
                  }
                >
                  {rest === "backpack"
                    ? "Sekk-anlegg aktiv"
                    : `Bruk sekk som anlegg (+${Math.round(BAG_REST_NERVE * 100)}% nervøsitet)`}
                </button>
              ) : null}
              {hasBipod ? (
                <button
                  type="button"
                  className={
                    rest === "bipod"
                      ? "intro-button sheriff-secondary is-active"
                      : "intro-button sheriff-secondary"
                  }
                  aria-pressed={rest === "bipod"}
                  disabled={!gunDeployed}
                  onClick={() => applyRestChoice("bipod")}
                  title={
                    gunDeployed
                      ? "Calm fra tofot bare når den er deployet"
                      : "Deploy gun først"
                  }
                >
                  {rest === "bipod"
                    ? "Bipod deployet"
                    : `Deploy bipod (+${Math.round(bipodDeployNerve(bipodWeaponCalm) * 100)}% nervøsitet)`}
                </button>
              ) : null}
              {hasBackpack || hasBipod ? (
                <p className="shop-row-note">
                  Anlegg krever Deploy gun. Sekk = maks calm (+25% nerve). Bipod
                  = tofot-calm (nerve 5–15% etter kvalitet). Uten valg: ingen
                  bipod/sekk-calm i skuddet.
                </p>
              ) : null}
              {hasKestrel ? (
                <button
                  type="button"
                  className="intro-button sheriff-secondary"
                  disabled={kestrelEnviroReady}
                  onClick={measureKestrelEnviro}
                >
                  {kestrelEnviroReady
                    ? "Kestrel enviro målt"
                    : "Mål enviro med Kestrel (+5% nervøsitet)"}
                </button>
              ) : null}
              {hasTriggercam ? (
                <button
                  type="button"
                  className="intro-button sheriff-secondary"
                  disabled={triggercamReady}
                  onClick={startTriggercam}
                >
                  {triggercamReady
                    ? `${shotCamName} aktiv`
                    : `Start ${shotCamName} (+${shotCamNervePct}% nervøsitet)`}
                </button>
              ) : null}
              {hasCamcorder ? (
                <button
                  type="button"
                  className="intro-button sheriff-secondary"
                  disabled={camcorderReady}
                  onClick={deployCamcorder}
                >
                  {camcorderReady
                    ? "Camcorder klar"
                    : `Sett opp camcorder (+${Math.round(camcorderSetupNerve * 100)}% nervøsitet)`}
                </button>
              ) : null}
              {hasChronograph ? (
                <button
                  type="button"
                  className="intro-button sheriff-secondary"
                  disabled={chronoReady}
                  onClick={deployChrono}
                >
                  {chronoReady
                    ? "Chrono klar"
                    : "Sett opp Chrono (+5% nervøsitet)"}
                </button>
              ) : null}
              <p className="shop-row-note">
                Trykk kart → planleggingsmål (kakene flytter apex hit, samme
                retning/bredde · skuddlinje følger).
                Hold piltaster for å gå. Grønn linje = klar sektor; rød = fare.
                {gunDeployed
                  ? " Gun deployed — Mount gun for å legge den i sekken."
                  : " Deploy gun før tårn / skudd / anlegg."}
                {hasKestrel
                  ? kestrelEnviroReady
                    ? " Kestrel enviro målt — app prefyller vind/temp."
                    : " Kestrel i kit: Mål enviro (+5% nervøsitet) for auto vind/temp i app."
                  : ""}
                {hasTriggercam
                  ? triggercamReady
                    ? ` ${shotCamName} filmer — AAR + skuddpar-autofill.`
                    : ` ${shotCamName} i kit: Start ${shotCamName} (+${shotCamNervePct}% nervøsitet) før skudd.`
                  : ""}
                {hasCamcorder
                  ? camcorderReady
                    ? " Camcorder filmer stand — bedre ettersøk-cue etter skudd."
                    : " Camcorder i kit: sett opp før skudd for retning + landingsavstand (koster nervøsitet)."
                  : ""}
                {hasChronograph
                  ? chronoReady
                    ? " Chrono måler foran stand (+5% nerve) — shotlog får v0 + °C."
                    : " Xero i kit: Sett opp Chrono (+5% nervøsitet)."
                  : ""}
                {holdHint
                  ? " Kestrel AB dialer elev + windage når du går til skudd."
                  : ""}
              </p>
              <p className="shop-row-note">
                {dangerHazards.length === 0 ? (
                  <>
                    Ingen farlige kakestykker i denne cellen
                    {planning ? " (fra målet)" : ""} — stiplet sirkel = 1000 m;
                    grønn/rød pil = LRF/F-retning
                    {bakgrunnOk ? " (trygg)" : " (farlig)"}.
                  </>
                ) : (
                  <>
                    {planning ? "Fra målet — " : ""}
                    Bebyggelse:{" "}
                    {dangerHazards.some((h) => h.kind === "habitation")
                      ? safeHab
                        ? "klar"
                        : "i sektor — farlig"
                      : "ingen"}
                    {" · "}
                    Terrengbakgrunn:{" "}
                    {dangerHazards.some((h) => h.kind === "terrain")
                      ? safeTerrain
                        ? "ok"
                        : "i sektor — farlig"
                      : "ingen"}
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
                    {" · "}
                    {dangerHazards.length} kakestykke
                    {dangerHazards.length === 1 ? "" : "r"} · 1000 m-sirkel
                  </>
                )}
              </p>
            </div>
          ) : null}

          {mode === "shoot" ? (
            <div className="aware-actions">
              <p className="shop-row-note">
                {postShotSkuddparMode
                  ? `Etter skudd: marker stand og tre (${postShotSkuddparSecLeft} s igjen).`
                  : skuddparAutofill
                    ? "Cam i bruk: avstand/retning prefylles — juster ved behov under kartet."
                    : "Sett avstand (sirkel) og retning under kartet — uten cam ingen autofyll."}
              </p>

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
              {actionableTrackPairs.length === 0 ? (
                <p className="shop-row-note">
                  Ingen åpne hent/søk. Track krever et treff med camcorder,
                  triggercam, EL Range, lagret skuddpar etter skudd — eller
                  instant kill under {CLOSE_RANGE_TREE_HENT_MAX_M} m (hent ved
                  treet). Planlagte skuddpar uten skudd vises bare på kartet.
                </p>
              ) : (
                <>
                  {actionableTrackPairs.length > 1 ? (
                    <div className="aware-track-pick" role="group" aria-label="Velg fugl">
                      <p className="shop-row-note aware-track-pick-label">
                        Velg hvilken fugl du skal hente / søke
                      </p>
                      <div className="aware-track-pick-btns">
                        {actionableTrackPairs.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className={
                              p.id === trackActivePair?.id
                                ? "intro-button aware-track-pick-btn is-active"
                                : "intro-button sheriff-secondary aware-track-pick-btn"
                            }
                            aria-pressed={p.id === trackActivePair?.id}
                            onClick={() => setActivePairId(p.id)}
                          >
                            {trackPairPickLabel(p)}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : trackActivePair ? (
                    <p className="shop-row-note">
                      {trackPairPickLabel(trackActivePair)}
                    </p>
                  ) : null}

                  {trackActivePair?.resultKind === "ettersok" &&
                  trackActivePair.fleeObservation ? (
                    <div
                      className="aware-ettersok-flee"
                      role="status"
                    >
                      <strong>Fluktretning</strong>
                      <span>
                        {trackActivePair.fleeObservation.compassLabel}
                        {trackActivePair.fleeObservation.hasTriggercam ||
                        trackActivePair.fleeObservation.hasCamcorder ||
                        trackActivePair.fleeObservation.fromScopeRecoil
                          ? ` (${Math.round(
                              trackActivePair.fleeObservation.observedBearingDeg,
                            )}°)`
                          : ""}
                        {trackActivePair.fleeObservation.observedLandDistanceM !=
                        null
                          ? ` · ca. ${Math.round(trackActivePair.fleeObservation.observedLandDistanceM)} m`
                          : ""}
                      </span>
                      <p>{trackActivePair.fleeObservation.text}</p>
                    </div>
                  ) : null}

                  {trackActivePair?.lastEttersok ? (
                    <div
                      className={
                        trackActivePair.lastEttersok.found
                          ? "aware-ettersok-result aware-ettersok-result-found"
                          : "aware-ettersok-result aware-ettersok-result-miss"
                      }
                      role="status"
                    >
                      <strong>
                        {trackActivePair.lastEttersok.found
                          ? "FUNNET"
                          : "IKKE FUNNET"}
                      </strong>
                      <p>{trackActivePair.lastEttersok.reason}</p>
                      {!trackActivePair.lastEttersok.found &&
                      trackActivePair.found !== true ? (
                        <p className="aware-ettersok-hint">
                          Forrige søkespor ligger på kartet. Legg et nytt spor i
                          fluktretningen — {ETTERSOK_MINUTES_PER_TRACK_POINT}{" "}
                          min/punkt + {MINUTES_PER_100M} min/100 m.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {trackActivePair &&
                  recoveryMinutes != null &&
                  recoveryWalkM != null &&
                  (trackActivePair.resultKind === "instant_kill" ||
                    trackActivePair.resultKind === "vital_kill") ? (
                    <>
                      <p className="shop-row-note">
                        Drept fugl i treet. Tid fra der du står nå —{" "}
                        {recoveryMinutes} min (
                        {TREE_RECOVERY_MINUTES_PER_100M} min/100 m ·{" "}
                        {recoveryWalkM} m).
                      </p>
                      <button
                        type="button"
                        className="intro-button"
                        disabled={trackActivePair.found === true}
                        onClick={markRecoveredAtTree}
                      >
                        Hent ved treet ({recoveryMinutes} min)
                      </button>
                    </>
                  ) : trackActivePair?.resultKind === "ettersok" ? (
                    <>
                      <ol className="aware-ettersok-steps">
                        <li>
                          Trykk på kartet og legg et <strong>søkespor</strong>{" "}
                          ut fra lagret skuddpar (
                          {ETTERSOK_MINUTES_PER_TRACK_POINT} min/punkt +{" "}
                          {MINUTES_PER_100M} min/100 m).
                        </li>
                        <li>
                          Kjør <strong>Ettersøk</strong> — tid = punkter +
                          avstand.
                        </li>
                      </ol>
                      <p className="shop-row-note">
                        Nytt spor: {trackActivePair.trackPoints.length}
                        {trackActivePair.trackPoints.length > 0
                          ? ` · ${ettersokMinutesForSearch(trackActivePair.trackPoints.length, trackActivePair.distanceM)} min`
                          : ""}
                        {(trackActivePair.searchedTracks?.length ?? 0) > 0
                          ? ` · lagret på kart: ${trackActivePair.searchedTracks!.length}`
                          : ""}
                        {(trackActivePair.ettersokAttempts ?? 0) > 0
                          ? ` · forsøk: ${trackActivePair.ettersokAttempts}`
                          : ""}
                        {trackActivePair.found === true ? " · ferdig" : ""}
                      </p>
                    </>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          <p className="aware-status">{status}</p>
        </div>
      </div>
    </div>
  );
}
