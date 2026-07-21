"use client";

import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { ZERO_CLICK_MM } from "@/lib/player";

/** Turret visual modes + optional field/app tabs (hunt). */
export type ScopeHudTab = "overhead" | "shooter" | "enviro" | "kestrel";

type TurretView = "overhead" | "shooter";

const VIEW_STORAGE_KEY = "toppjakt-scope-hud-tab";

type ScopeTurretsProps = {
  /** Session dial mm-at-100 m (+x = right, +y = down). */
  sessionZeroXMm: number;
  sessionZeroYMm: number;
  onNudge: (axis: "x" | "y", deltaMm: number) => void;
  disabled?: boolean;
  /** Optional actions under/ beside the turrets (save zero, abort, …). */
  actions?: ReactNode;
  /**
   * Enviro tab content (range, wind, DOPE…). When set, shows an Enviro tab
   * — switch away from turrets to read field data.
   */
  enviroPanel?: ReactNode;
  /**
   * Kestrel tab content. Only pass when Kestrel is in kit / solution exists.
   */
  kestrelPanel?: ReactNode;
};

function milLabel(clicks: number): string {
  if (clicks === 0) return "0.0";
  return Math.abs(clicks / 10).toFixed(1);
}

function milDir(clicks: number, pos: string, neg: string): string {
  if (clicks === 0) return "mil";
  return `mil ${clicks < 0 ? neg : pos}`;
}

function clickLabel(clicks: number, pos: string, neg: string): string {
  if (clicks === 0) return "0 klikk";
  return `${Math.abs(clicks)} klikk ${clicks < 0 ? neg : pos}`;
}

/** Visual rotation of the overhead turret cap (deg). */
function capRotationDeg(clicks: number): number {
  return clicks * 18;
}

function readStoredTab(allowed: ScopeHudTab[]): ScopeHudTab {
  if (typeof window === "undefined") return "overhead";
  try {
    const v =
      window.localStorage.getItem(VIEW_STORAGE_KEY) ??
      window.localStorage.getItem("toppjakt-scope-turret-view");
    if (v === "shooter" || v === "overhead" || v === "enviro" || v === "kestrel") {
      if (allowed.includes(v)) return v;
    }
  } catch {
    /* ignore */
  }
  return "overhead";
}

function useHoldRepeat(action: () => void, disabled: boolean) {
  const actionRef = useRef(action);
  actionRef.current = action;
  const timersRef = useRef<{ delay?: number; interval?: number }>({});

  function clear() {
    if (timersRef.current.delay != null) {
      window.clearTimeout(timersRef.current.delay);
    }
    if (timersRef.current.interval != null) {
      window.clearInterval(timersRef.current.interval);
    }
    timersRef.current = {};
  }

  function start() {
    if (disabled) return;
    clear();
    actionRef.current();
    timersRef.current.delay = window.setTimeout(() => {
      timersRef.current.interval = window.setInterval(() => {
        actionRef.current();
      }, 70);
    }, 380);
  }

  useEffect(() => () => clear(), []);

  return {
    onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      start();
    },
    onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
      clear();
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    onPointerCancel: () => clear(),
    onLostPointerCapture: () => clear(),
    onContextMenu: (e: ReactMouseEvent) => e.preventDefault(),
  };
}

/** Tick width in px — must match CSS `.scope-turret-shooter-tick` width. */
const SHOOTER_TICK_PX = 14;
/** How many click-ticks visible on each side of the index. */
const SHOOTER_HALF_SPAN = 8;

type TurretDialProps = {
  title: string;
  axisHint: string;
  kind: "elevation" | "windage";
  view: TurretView;
  /** Raw session clicks (+x R, +y D). */
  clicks: number;
  /**
   * Drum face clicks for shooter view: elevation uses UP-positive (−y),
   * windage uses R-positive (+x).
   */
  faceClicks: number;
  milValue: string;
  milSuffix: string;
  clickText: string;
  disabled?: boolean;
  onNeg: () => void;
  onPos: () => void;
  /** Called with delta in face-clicks when dragging the shooter drum. */
  onFaceDelta: (deltaClicks: number) => void;
  negAria: string;
  posAria: string;
  negMark: string;
  posMark: string;
  /** Fixed base legend under the index (e.g. UP →). Omit to hide. */
  baseLegend?: string;
};

function OverheadDrum({
  clicks,
  milValue,
  milSuffix,
  clickText,
}: {
  clicks: number;
  milValue: string;
  milSuffix: string;
  clickText: string;
}) {
  const rot = capRotationDeg(clicks);
  return (
    <div className="scope-turret-drum" aria-hidden>
      <div className="scope-turret-drum-rim">
        {Array.from({ length: 20 }, (_, i) => (
          <span
            key={i}
            className={
              i % 5 === 0
                ? "scope-turret-hash scope-turret-hash--major"
                : "scope-turret-hash"
            }
            style={{
              transform: `rotate(${i * 18}deg) translateY(-2.55rem)`,
            }}
          />
        ))}
      </div>
      <div
        className="scope-turret-cap"
        style={{ transform: `rotate(${rot}deg)` }}
      >
        <span className="scope-turret-cap-knurl" />
        <span className="scope-turret-cap-index" />
      </div>
      <div className="scope-turret-readout" aria-live="polite">
        <span className="scope-turret-mil">
          {milValue}
          <small> {milSuffix}</small>
        </span>
        <span className="scope-turret-clicks">{clickText}</span>
      </div>
    </div>
  );
}

function ShooterDrum({
  faceClicks,
  baseLegend,
  disabled,
  onFaceDelta,
  /** horizontal = top elevation turret; vertical = side windage turret */
  orientation,
  /**
   * +1 = lower face values on the start side (left / top).
   * -1 = reverse scale (elevation: higher UP to the left;
   *      windage: scroll down = R).
   */
  scaleDir,
}: {
  faceClicks: number;
  baseLegend?: string;
  disabled?: boolean;
  onFaceDelta: (deltaClicks: number) => void;
  orientation: "horizontal" | "vertical";
  scaleDir: 1 | -1;
}) {
  const dragRef = useRef<{
    start: number;
    lastEmitted: number;
  } | null>(null);

  const ticks = Array.from({ length: SHOOTER_HALF_SPAN * 2 + 1 }, (_, i) => {
    const offset = i - SHOOTER_HALF_SPAN;
    return faceClicks + offset * scaleDir;
  });

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (disabled) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const start = orientation === "vertical" ? e.clientY : e.clientX;
    dragRef.current = { start, lastEmitted: 0 };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || disabled) return;
    const pos = orientation === "vertical" ? e.clientY : e.clientX;
    const delta = pos - drag.start;
    /* Dragging the drum with the finger: surface follows pointer.
       scaleDir flips which way face value changes for a given drag. */
    const clicksMoved = Math.trunc((-delta * scaleDir) / SHOOTER_TICK_PX);
    if (clicksMoved !== drag.lastEmitted) {
      onFaceDelta(clicksMoved - drag.lastEmitted);
      drag.lastEmitted = clicksMoved;
    }
  }

  function endDrag(e: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function tickClass(tick: number): string {
    const isMajor = tick % 10 === 0;
    const isSemi = !isMajor && tick % 5 === 0;
    const isCurrent = tick === faceClicks;
    const parts = ["scope-turret-shooter-tick"];
    if (isMajor) parts.push("is-major");
    else if (isSemi) parts.push("is-semi");
    if (isCurrent) parts.push("is-current");
    return parts.join(" ");
  }

  const rootClass =
    orientation === "vertical"
      ? "scope-turret-shooter scope-turret-shooter--vertical"
      : "scope-turret-shooter scope-turret-shooter--horizontal";

  const base = (
    <div className="scope-turret-shooter-base">
      <span className="scope-turret-shooter-index" />
      {baseLegend ? (
        <span className="scope-turret-shooter-legend">{baseLegend}</span>
      ) : null}
    </div>
  );

  return (
    <div className={rootClass} aria-hidden>
      {orientation === "horizontal" ? (
        <div className="scope-turret-shooter-knurl" />
      ) : null}
      <div className="scope-turret-shooter-main">
        {orientation === "vertical" ? base : null}
        <div
          className="scope-turret-shooter-cylinder"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onContextMenu={(ev) => ev.preventDefault()}
          role="presentation"
        >
          <div className="scope-turret-shooter-shade scope-turret-shooter-shade--a" />
          <div className="scope-turret-shooter-shade scope-turret-shooter-shade--b" />
          <div className="scope-turret-shooter-band">
            {ticks.map((tick) => {
              const isMajor = tick % 10 === 0;
              const isCurrent = tick === faceClicks;
              const milWhole = tick / 10;
              let label = "";
              if (isMajor) {
                label = Number.isInteger(milWhole)
                  ? String(milWhole)
                  : milWhole.toFixed(1);
              } else if (isCurrent) {
                label = milWhole.toFixed(1);
              }
              const rev2 =
                isMajor && Math.abs(tick) >= 100
                  ? String(Math.trunc(tick / 10))
                  : "";
              return (
                <div key={`${orientation}-${tick}`} className={tickClass(tick)}>
                  {rev2 ? (
                    <span className="scope-turret-shooter-rev2">{rev2}</span>
                  ) : null}
                  {label ? (
                    <span className="scope-turret-shooter-num">{label}</span>
                  ) : null}
                  <span className="scope-turret-shooter-hash" />
                </div>
              );
            })}
          </div>
        </div>
        {orientation === "vertical" ? (
          <div className="scope-turret-shooter-knurl" />
        ) : null}
      </div>
      {orientation === "horizontal" ? base : null}
    </div>
  );
}

function TurretDial({
  title,
  axisHint,
  kind,
  view,
  clicks,
  faceClicks,
  milValue,
  milSuffix,
  clickText,
  disabled = false,
  onNeg,
  onPos,
  onFaceDelta,
  negAria,
  posAria,
  negMark,
  posMark,
  baseLegend,
}: TurretDialProps) {
  const negHold = useHoldRepeat(onNeg, !!disabled);
  const posHold = useHoldRepeat(onPos, !!disabled);

  return (
    <div
      className={
        disabled
          ? `scope-turret scope-turret--${kind} scope-turret-view--${view} is-disabled`
          : `scope-turret scope-turret--${kind} scope-turret-view--${view}`
      }
      aria-label={title}
    >
      <div className="scope-turret-head">
        <p className="scope-turret-title">{title}</p>
        <p className="scope-turret-axis">{axisHint}</p>
      </div>

      <div className="scope-turret-body">
        {view === "shooter" ? (
          <>
            <ShooterDrum
              faceClicks={faceClicks}
              baseLegend={baseLegend}
              disabled={disabled}
              onFaceDelta={onFaceDelta}
              orientation={kind === "windage" ? "vertical" : "horizontal"}
              scaleDir={-1}
            />
            <div className="scope-turret-click-row">
              <button
                type="button"
                className="scope-turret-click scope-turret-click--neg"
                disabled={disabled}
                aria-label={negAria}
                {...negHold}
              >
                <span aria-hidden>{negMark}</span>
              </button>
              <button
                type="button"
                className="scope-turret-click scope-turret-click--pos"
                disabled={disabled}
                aria-label={posAria}
                {...posHold}
              >
                <span aria-hidden>{posMark}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className="scope-turret-click scope-turret-click--neg"
              disabled={disabled}
              aria-label={negAria}
              {...negHold}
            >
              <span aria-hidden>{negMark}</span>
            </button>
            <OverheadDrum
              clicks={clicks}
              milValue={milValue}
              milSuffix={milSuffix}
              clickText={clickText}
            />
            <button
              type="button"
              className="scope-turret-click scope-turret-click--pos"
              disabled={disabled}
              aria-label={posAria}
              {...posHold}
            >
              <span aria-hidden>{posMark}</span>
            </button>
          </>
        )}
      </div>

      <p className="scope-turret-readout-line" aria-live="polite">
        <span className="scope-turret-mil">
          {milValue}
          <small> {milSuffix}</small>
        </span>
        <span className="scope-turret-clicks">{clickText}</span>
      </p>
      <p className="scope-turret-step">
        {view === "shooter"
          ? "0.1 mil / klikk · dra trommelen eller hold knapp"
          : "0.1 mil / klikk · hold for rask dial"}
      </p>
    </div>
  );
}

/**
 * Scope elevation (top turret) + windage (side turret) — click dials with mil readout.
 * Tabs: Oversikt / Shooter for turrets; optional Enviro / Kestrel for field apps.
 */
export function ScopeTurrets({
  sessionZeroXMm,
  sessionZeroYMm,
  onNudge,
  disabled = false,
  actions,
  enviroPanel,
  kestrelPanel,
}: ScopeTurretsProps) {
  const hasEnviro = enviroPanel != null;
  const hasKestrel = kestrelPanel != null;
  const allowedTabs: ScopeHudTab[] = [
    "overhead",
    "shooter",
    ...(hasEnviro ? (["enviro"] as const) : []),
    ...(hasKestrel ? (["kestrel"] as const) : []),
  ];

  const [tab, setTab] = useState<ScopeHudTab>("overhead");

  useEffect(() => {
    setTab(readStoredTab(allowedTabs));
    // Re-read when kit gains/loses Kestrel or Enviro.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- allowedTabs derived from panels
  }, [hasEnviro, hasKestrel]);

  function setAndStoreTab(next: ScopeHudTab) {
    setTab(next);
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const windClicks = Math.round(sessionZeroXMm / ZERO_CLICK_MM);
  const elevClicks = Math.round(sessionZeroYMm / ZERO_CLICK_MM);
  /* Face: elevation UP-positive, windage R-positive. */
  const elevFace = -elevClicks;
  const windFace = windClicks;

  const turretView: TurretView =
    tab === "shooter" ? "shooter" : "overhead";
  const showTurrets = tab === "overhead" || tab === "shooter";
  const showEnviro = tab === "enviro" && hasEnviro;
  const showKestrel = tab === "kestrel" && hasKestrel;

  return (
    <div
      className={
        showTurrets
          ? "scope-turrets"
          : "scope-turrets scope-turrets--app"
      }
    >
      <div className="scope-turrets-view-toggle" role="tablist" aria-label="Skyte-HUD">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overhead"}
          className={
            tab === "overhead"
              ? "scope-turrets-view-btn is-active"
              : "scope-turrets-view-btn"
          }
          disabled={disabled}
          onClick={() => setAndStoreTab("overhead")}
        >
          Oversikt
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "shooter"}
          className={
            tab === "shooter"
              ? "scope-turrets-view-btn is-active"
              : "scope-turrets-view-btn"
          }
          disabled={disabled}
          onClick={() => setAndStoreTab("shooter")}
        >
          Shooter
        </button>
        {hasEnviro ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "enviro"}
            className={
              tab === "enviro"
                ? "scope-turrets-view-btn is-active"
                : "scope-turrets-view-btn"
            }
            disabled={disabled}
            onClick={() => setAndStoreTab("enviro")}
          >
            Enviro/App
          </button>
        ) : null}
        {hasKestrel ? (
          <button
            type="button"
            role="tab"
            aria-selected={tab === "kestrel"}
            className={
              tab === "kestrel"
                ? "scope-turrets-view-btn is-active"
                : "scope-turrets-view-btn"
            }
            disabled={disabled}
            onClick={() => setAndStoreTab("kestrel")}
          >
            Kestrel
          </button>
        ) : null}
      </div>

      {showTurrets ? (
        <>
          <TurretDial
            title="Elevation"
            axisHint="Topptårn"
            kind="elevation"
            view={turretView}
            clicks={elevClicks}
            faceClicks={elevFace}
            milValue={milLabel(elevClicks)}
            milSuffix={milDir(elevClicks, "D", "U")}
            clickText={clickLabel(elevClicks, "ned", "opp")}
            disabled={disabled}
            onNeg={() => onNudge("y", -ZERO_CLICK_MM)}
            onPos={() => onNudge("y", ZERO_CLICK_MM)}
            onFaceDelta={(d) => {
              /* face UP+ → session y − */
              if (d !== 0) onNudge("y", -d * ZERO_CLICK_MM);
            }}
            negAria="Elevation opp (ett klikk)"
            posAria="Elevation ned (ett klikk)"
            negMark="▲ U"
            posMark="▼ D"
            baseLegend="UP →"
          />
          <TurretDial
            title="Windage"
            axisHint="Sidetårn"
            kind="windage"
            view={turretView}
            clicks={windClicks}
            faceClicks={windFace}
            milValue={milLabel(windClicks)}
            milSuffix={milDir(windClicks, "R", "L")}
            clickText={clickLabel(windClicks, "høyre", "venstre")}
            disabled={disabled}
            onNeg={() => onNudge("x", -ZERO_CLICK_MM)}
            onPos={() => onNudge("x", ZERO_CLICK_MM)}
            onFaceDelta={(d) => {
              if (d !== 0) onNudge("x", d * ZERO_CLICK_MM);
            }}
            negAria="Windage venstre (ett klikk)"
            posAria="Windage høyre (ett klikk)"
            negMark="◀ L"
            posMark="R ▶"
          />
        </>
      ) : null}

      {showEnviro ? (
        <div className="scope-turrets-app-panel" role="tabpanel">
          {enviroPanel}
        </div>
      ) : null}

      {showKestrel ? (
        <div className="scope-turrets-app-panel scope-turrets-app-panel--kestrel" role="tabpanel">
          {kestrelPanel}
        </div>
      ) : null}

      {actions ? <div className="scope-turrets-actions">{actions}</div> : null}
    </div>
  );
}
