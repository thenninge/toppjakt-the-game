"use client";

import {
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  AWARE_MAP_MAX_M,
  AWARE_MAP_RADIUS_PCT,
  awareMapMaxMFor,
  awareMetersPerPctFor,
  cellCenterOnAwareMap,
  distanceMBetween,
  type CellPoint,
} from "@/lib/aware/cellGeometry";
import {
  awareMapMaxMFromKnownSpan,
  awareRingDiameterPct,
  awareScaleRingDiameterPct,
  cellFromMapPct,
  countSeats,
  eraseSeatsNear,
  formatSeatSummary,
  seatAtClick,
  startCellLabel,
  type JaktfeltMapTool,
} from "@/lib/hunt/jaktfeltAuthoring";
import {
  HUNT_MAPS,
  cellLabel,
  type HuntGridCell,
  type HuntMapId,
} from "@/lib/hunt/maps";
import {
  getMapBirdSeats,
  type MapBirdSeat,
} from "@/lib/hunt/mapPlacements";

type AdminJaktfeltPanelProps = {
  onLeave: () => void;
};

const MAP_LIST = Object.values(HUNT_MAPS);
const AWARE_SAFETY_RING_M = 1000;

type MeasureState = {
  a: CellPoint | null;
  b: CellPoint | null;
};

export function AdminJaktfeltPanel({ onLeave }: AdminJaktfeltPanelProps) {
  const [mapId, setMapId] = useState<HuntMapId>("finnskogen");
  const catalog = HUNT_MAPS[mapId];

  const [seats, setSeats] = useState<MapBirdSeat[]>(() => [
    ...getMapBirdSeats("finnskogen"),
  ]);
  const [start, setStart] = useState<HuntGridCell>(() => ({
    ...HUNT_MAPS.finnskogen.start,
  }));
  const [awareMaxM, setAwareMaxM] = useState(
    () => awareMapMaxMFor(HUNT_MAPS.finnskogen),
  );
  const [tool, setTool] = useState<JaktfeltMapTool>("tiur");
  const [showGrid, setShowGrid] = useState(true);
  const [showSeats, setShowSeats] = useState(true);
  const [showAwareScaleRing, setShowAwareScaleRing] = useState(true);
  const [showSafetyRing, setShowSafetyRing] = useState(true);
  const [ringCell, setRingCell] = useState<HuntGridCell | null>(null);
  const [measure, setMeasure] = useState<MeasureState>({ a: null, b: null });
  const [knownSpanM, setKnownSpanM] = useState(1000);
  const [status, setStatus] = useState<string | null>(null);
  const [baking, setBaking] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const panDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origPanX: number;
    origPanY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const metersPerPct = awareMetersPerPctFor({ awareMapMaxM: awareMaxM });
  const counts = useMemo(() => countSeats(seats), [seats]);
  const measureM =
    measure.a && measure.b
      ? distanceMBetween(measure.a, measure.b, metersPerPct)
      : null;

  const ringOrigin = ringCell
    ? cellCenterOnAwareMap(ringCell, catalog)
    : cellCenterOnAwareMap(start, catalog);
  const safetyDiamPct = awareRingDiameterPct(AWARE_SAFETY_RING_M, {
    awareMapMaxM: awareMaxM,
  });
  const scaleDiamPct = awareScaleRingDiameterPct();

  function loadMap(id: HuntMapId) {
    const m = HUNT_MAPS[id];
    setMapId(id);
    setSeats([...getMapBirdSeats(id)]);
    setStart({ ...m.start });
    setAwareMaxM(awareMapMaxMFor(m));
    setMeasure({ a: null, b: null });
    setRingCell(null);
    setSelectedSeat(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setStatus(`Lastet ${m.label}`);
  }

  function mapClickPoint(e: MouseEvent<HTMLDivElement>): CellPoint {
    const el = stageRef.current;
    if (!el) return { x: 50, y: 50 };
    const rect = el.getBoundingClientRect();
    // Account for zoom/pan: click is in screen space of the zoomed layer child.
    const layer = el.querySelector(".jaktfelt-zoom-layer") as HTMLElement | null;
    const layerRect = layer?.getBoundingClientRect() ?? rect;
    return {
      x: ((e.clientX - layerRect.left) / layerRect.width) * 100,
      y: ((e.clientY - layerRect.top) / layerRect.height) * 100,
    };
  }

  function onStageClick(e: MouseEvent<HTMLDivElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const p = mapClickPoint(e);
    const x = Math.min(100, Math.max(0, p.x));
    const y = Math.min(100, Math.max(0, p.y));

    if (tool === "tiur" || tool === "orrhane") {
      const seat = seatAtClick(tool, x, y, catalog);
      setSeats((prev) => [...prev, seat]);
      setSelectedSeat(seats.length);
      setStatus(
        `Plassert ${tool === "tiur" ? "tiur" : "orre"} i ${cellLabel(seat)} (${seat.xPct.toFixed(1)}%, ${seat.yPct.toFixed(1)}%)`,
      );
      return;
    }
    if (tool === "erase") {
      const next = eraseSeatsNear(seats, x, y);
      const removed = seats.length - next.length;
      setSeats(next);
      setSelectedSeat(null);
      setStatus(
        removed === 0
          ? "Ingen sete nær klikket"
          : `Slettet ${removed} sete(r) nær ${x.toFixed(1)}%, ${y.toFixed(1)}%`,
      );
      return;
    }
    if (tool === "start") {
      const cell = cellFromMapPct(x, y, catalog);
      setStart(cell);
      setStatus(`Startcelle: ${cellLabel(cell)}`);
      return;
    }
    if (tool === "measure") {
      if (!measure.a || measure.b) {
        setMeasure({ a: { x, y }, b: null });
        setStatus("Measure: punkt 1 — klikk punkt 2");
      } else {
        const b = { x, y };
        setMeasure({ a: measure.a, b });
        const m = distanceMBetween(measure.a, b, metersPerPct);
        setStatus(
          `Measure: ${Math.round(m)} m (skala ${Math.round(awareMaxM)} m @ ${AWARE_MAP_RADIUS_PCT}%)`,
        );
      }
      return;
    }
    if (tool === "aware-ring") {
      const cell = cellFromMapPct(x, y, catalog);
      setRingCell(cell);
      setStatus(
        `Aware-sirkel i ${cellLabel(cell)} — ${AWARE_SAFETY_RING_M} m + ${AWARE_MAP_RADIUS_PCT}% skala-ring`,
      );
    }
  }

  function applyScaleFromMeasure() {
    if (!measure.a || !measure.b) {
      setStatus("Measure to punkter først, deretter sett kjent avstand.");
      return;
    }
    const next = awareMapMaxMFromKnownSpan(measure.a, measure.b, knownSpanM);
    setAwareMaxM(next);
    setStatus(
      `Aware-skala satt: ${next} m @ ${AWARE_MAP_RADIUS_PCT}% (fra ${knownSpanM} m kjent spann)`,
    );
  }

  function resetSeatsFromCatalog() {
    setSeats([...getMapBirdSeats(mapId)]);
    setSelectedSeat(null);
    setStatus("Seter tilbakestilt fra katalog");
  }

  function deleteSelected() {
    if (selectedSeat == null) return;
    setSeats((prev) => prev.filter((_, i) => i !== selectedSeat));
    setSelectedSeat(null);
  }

  async function bakeToRepo() {
    setBaking(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/jaktfelt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapId,
          seats,
          awareMapMaxM: awareMaxM,
          start,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        seats?: number;
        paths?: string[];
      };
      if (!res.ok || !data.ok) {
        setStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      setStatus(
        `Lagret ${data.seats ?? seats.length} seter → ${(data.paths ?? []).join(", ")}`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Bake feilet");
    } finally {
      setBaking(false);
    }
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (zoom <= 1.001 || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    panDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origPanX: pan.x,
      origPanY: pan.y,
      moved: false,
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 5) drag.moved = true;
    if (!drag.moved) return;
    setPan({ x: drag.origPanX + dx, y: drag.origPanY + dy });
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = panDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (drag.moved) suppressClickRef.current = true;
    panDragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  const tools: { id: JaktfeltMapTool; label: string }[] = [
    { id: "tiur", label: "Tiur" },
    { id: "orrhane", label: "Orre" },
    { id: "erase", label: "Slett" },
    { id: "start", label: "Start" },
    { id: "measure", label: "Measure" },
    { id: "aware-ring", label: "Aware-ring" },
  ];

  return (
    <div className="jaktfelt-panel">
      <header className="jaktfelt-header">
        <div>
          <h2 className="jaktfelt-title">Jaktfelt</h2>
          <p className="shop-row-note">
            Kartskala (Aware), startcelle og utplassering av tiur/orre. Bake
            skriver til <code>mapPlacements.ts</code> + <code>maps.ts</code>.
          </p>
        </div>
        <button
          type="button"
          className="intro-button sheriff-secondary"
          onClick={onLeave}
        >
          Til byen
        </button>
      </header>

      <div className="jaktfelt-toolbar">
        <label className="shop-filter">
          Terreng
          <select
            value={mapId}
            onChange={(e) => loadMap(e.target.value as HuntMapId)}
          >
            {MAP_LIST.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.regionHint})
              </option>
            ))}
          </select>
        </label>

        <div className="jaktfelt-tool-tabs" role="tablist" aria-label="Verktøy">
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tool === t.id}
              className={
                tool === t.id
                  ? "jaktfelt-tool is-active"
                  : "jaktfelt-tool"
              }
              onClick={() => setTool(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="jaktfelt-layout">
        <div className="jaktfelt-map-wrap">
          <div
            ref={stageRef}
            className={
              zoom > 1.001 ? "jaktfelt-stage is-zoomed" : "jaktfelt-stage"
            }
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={onStageClick}
          >
            <div
              className="jaktfelt-zoom-layer"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="jaktfelt-map-img"
                src={catalog.src}
                alt={catalog.label}
                draggable={false}
              />

              {showGrid ? (
                <div className="jaktfelt-grid" aria-hidden>
                  {Array.from({ length: catalog.rows }, (_, rFromTop) =>
                    Array.from({ length: catalog.cols }, (_, col) => {
                      const row = catalog.rows - 1 - rFromTop;
                      const isStart = start.row === row && start.col === col;
                      return (
                        <span
                          key={`${row}-${col}`}
                          className={
                            isStart
                              ? "jaktfelt-cell is-start"
                              : "jaktfelt-cell"
                          }
                          style={{
                            left: `${(col / catalog.cols) * 100}%`,
                            top: `${(rFromTop / catalog.rows) * 100}%`,
                            width: `${100 / catalog.cols}%`,
                            height: `${100 / catalog.rows}%`,
                          }}
                        >
                          {cellLabel({ row, col })}
                        </span>
                      );
                    }),
                  )}
                </div>
              ) : null}

              {showAwareScaleRing ? (
                <div
                  className="jaktfelt-ring jaktfelt-ring-scale"
                  style={{
                    left: `${ringOrigin.x}%`,
                    top: `${ringOrigin.y}%`,
                    width: `${scaleDiamPct}%`,
                  }}
                  title={`${AWARE_MAP_RADIUS_PCT}% = ${Math.round(awareMaxM)} m`}
                />
              ) : null}

              {showSafetyRing ? (
                <div
                  className="jaktfelt-ring jaktfelt-ring-safety"
                  style={{
                    left: `${ringOrigin.x}%`,
                    top: `${ringOrigin.y}%`,
                    width: `${safetyDiamPct}%`,
                  }}
                  title={`${AWARE_SAFETY_RING_M} m Aware-sikkerhet`}
                />
              ) : null}

              {showSeats
                ? seats.map((s, i) => (
                    <button
                      key={`${s.species}-${s.xPct}-${s.yPct}-${i}`}
                      type="button"
                      className={
                        selectedSeat === i
                          ? `jaktfelt-seat jaktfelt-seat-${s.species} is-selected`
                          : `jaktfelt-seat jaktfelt-seat-${s.species}`
                      }
                      style={{ left: `${s.xPct}%`, top: `${s.yPct}%` }}
                      title={`${s.species === "tiur" ? "Tiur" : "Orre"} · ${cellLabel(s)}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSeat(i);
                      }}
                    />
                  ))
                : null}

              <span
                className="jaktfelt-start-marker"
                style={{
                  left: `${cellCenterOnAwareMap(start, catalog).x}%`,
                  top: `${cellCenterOnAwareMap(start, catalog).y}%`,
                }}
                title={`Start ${startCellLabel(start)}`}
              />

              {measure.a ? (
                <span
                  className="jaktfelt-measure-dot"
                  style={{ left: `${measure.a.x}%`, top: `${measure.a.y}%` }}
                />
              ) : null}
              {measure.b ? (
                <>
                  <svg
                    className="jaktfelt-measure-svg"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    <line
                      x1={measure.a!.x}
                      y1={measure.a!.y}
                      x2={measure.b.x}
                      y2={measure.b.y}
                    />
                  </svg>
                  <span
                    className="jaktfelt-measure-dot"
                    style={{ left: `${measure.b.x}%`, top: `${measure.b.y}%` }}
                  />
                  {measureM != null ? (
                    <span
                      className="jaktfelt-measure-label"
                      style={{
                        left: `${(measure.a!.x + measure.b.x) / 2}%`,
                        top: `${(measure.a!.y + measure.b.y) / 2}%`,
                      }}
                    >
                      {Math.round(measureM)} m
                    </span>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          <div className="jaktfelt-zoom-bar" role="group" aria-label="Zoom">
            <button
              type="button"
              className="jaktfelt-zoom-btn"
              disabled={zoom <= 1.001}
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              1×
            </button>
            <button
              type="button"
              className="jaktfelt-zoom-btn"
              onClick={() => setZoom((z) => Math.min(4, Math.round(z * 1.25 * 100) / 100))}
            >
              +
            </button>
            <button
              type="button"
              className="jaktfelt-zoom-btn"
              disabled={zoom <= 1.001}
              onClick={() => setZoom((z) => Math.max(1, Math.round((z / 1.25) * 100) / 100))}
            >
              −
            </button>
            <span className="jaktfelt-zoom-label">{zoom}×</span>
          </div>
        </div>

        <aside className="jaktfelt-side">
          <section className="jaktfelt-card">
            <h3>Terreng</h3>
            <p className="shop-row-note">{formatSeatSummary(seats, catalog)}</p>
            <p className="shop-row-note">
              Start: <strong>{startCellLabel(start)}</strong>
              {" · "}
              {counts.tiur} tiur / {counts.orrhane} orre
            </p>
            <label className="shop-filter">
              Aware max (m @ {AWARE_MAP_RADIUS_PCT}%)
              <input
                type="number"
                min={100}
                max={5000}
                step={10}
                value={Math.round(awareMaxM)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setAwareMaxM(Math.max(100, n));
                }}
              />
            </label>
            <p className="shop-row-note">
              ≈ {metersPerPct.toFixed(1)} m/% · default {Math.round(AWARE_MAP_MAX_M)} m
              {catalog.awareMapMaxM != null
                ? ` · katalog ${Math.round(catalog.awareMapMaxM)} m`
                : " · katalog: default"}
            </p>
          </section>

          <section className="jaktfelt-card">
            <h3>Visning</h3>
            <label className="jaktfelt-check">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              Rutenett
            </label>
            <label className="jaktfelt-check">
              <input
                type="checkbox"
                checked={showSeats}
                onChange={(e) => setShowSeats(e.target.checked)}
              />
              Fugleseter
            </label>
            <label className="jaktfelt-check">
              <input
                type="checkbox"
                checked={showAwareScaleRing}
                onChange={(e) => setShowAwareScaleRing(e.target.checked)}
              />
              Skala-ring ({AWARE_MAP_RADIUS_PCT}% = max)
            </label>
            <label className="jaktfelt-check">
              <input
                type="checkbox"
                checked={showSafetyRing}
                onChange={(e) => setShowSafetyRing(e.target.checked)}
              />
              Aware 1000 m-sirkel
            </label>
          </section>

          <section className="jaktfelt-card">
            <h3>Measure → skala</h3>
            <p className="shop-row-note">
              Klikk Measure, to punkter med kjent avstand, deretter beregn
              awareMapMaxM.
            </p>
            <label className="shop-filter">
              Kjent avstand (m)
              <input
                type="number"
                min={50}
                max={5000}
                step={10}
                value={knownSpanM}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setKnownSpanM(Math.max(50, n));
                }}
              />
            </label>
            <button
              type="button"
              className="intro-button"
              disabled={!measure.a || !measure.b}
              onClick={applyScaleFromMeasure}
            >
              Sett skala fra Measure
            </button>
            {measureM != null ? (
              <p className="shop-row-note">
                Nåværende spann: {Math.round(measureM)} m
              </p>
            ) : null}
          </section>

          <section className="jaktfelt-card">
            <h3>Handlinger</h3>
            <div className="jaktfelt-actions">
              <button
                type="button"
                className="intro-button sheriff-secondary"
                onClick={resetSeatsFromCatalog}
              >
                Tilbakestill seter
              </button>
              <button
                type="button"
                className="intro-button sheriff-secondary"
                disabled={selectedSeat == null}
                onClick={deleteSelected}
              >
                Slett valgt
              </button>
              <button
                type="button"
                className="intro-button"
                disabled={baking}
                onClick={bakeToRepo}
              >
                {baking ? "Skriver…" : "Lagre til repo"}
              </button>
            </div>
            {status ? <p className="jaktfelt-status">{status}</p> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
