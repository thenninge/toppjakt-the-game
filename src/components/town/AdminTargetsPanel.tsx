"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  RANGE_TARGET_IDS,
  RANGE_TARGETS,
  getRangeTarget,
  type RangeTargetDef,
  type RangeTargetId,
} from "@/lib/range/targets";

type AdminTargetsPanelProps = {
  onLeave: () => void;
};

type CalMode = "bullseye" | "grid-x" | "grid-y";

type DraftCal = {
  bullseyeXPx: number;
  bullseyeYPx: number;
  pxPerMm: number;
  pxPerMmY: number;
  visualScale: number;
  /** Paper length of one thin grid square (mm). */
  gridMm: number;
  /** How many squares the measure span covers. */
  gridSquares: number;
};

function draftFromTarget(t: RangeTargetDef): DraftCal {
  return {
    bullseyeXPx: t.bullseyeXPx,
    bullseyeYPx: t.bullseyeYPx,
    pxPerMm: t.pxPerMm,
    pxPerMmY: t.pxPerMmY ?? t.pxPerMm,
    visualScale: t.visualScale,
    gridMm: t.id === "cba-100" || t.id === "tracking-test" ? 10 : 20,
    gridSquares: 1,
  };
}

function formatPpm(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Admin → Targets: define bullseye + paper mm↔px once, bake into
 * {@link RANGE_TARGETS}.
 */
export function AdminTargetsPanel({ onLeave }: AdminTargetsPanelProps) {
  const [targetId, setTargetId] = useState<RangeTargetId>("target-500");
  const target = getRangeTarget(targetId);
  const [draft, setDraft] = useState<DraftCal>(() => draftFromTarget(target));
  /** Snapshot after last bake / load — dirty vs this. */
  const [saved, setSaved] = useState<DraftCal>(() => draftFromTarget(target));
  const [mode, setMode] = useState<CalMode>("bullseye");
  const [status, setStatus] = useState<string | null>(null);
  const [baking, setBaking] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [gridAnchor, setGridAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [cursorPt, setCursorPt] = useState<{ x: number; y: number } | null>(
    null,
  );
  const frameRef = useRef<HTMLDivElement>(null);

  const dirty = useMemo(() => {
    return (
      Math.abs(draft.bullseyeXPx - saved.bullseyeXPx) > 0.05 ||
      Math.abs(draft.bullseyeYPx - saved.bullseyeYPx) > 0.05 ||
      Math.abs(draft.pxPerMm - saved.pxPerMm) > 1e-6 ||
      Math.abs(draft.pxPerMmY - saved.pxPerMmY) > 1e-6 ||
      Math.abs(draft.visualScale - saved.visualScale) > 1e-6
    );
  }, [draft, saved]);

  function selectTarget(id: RangeTargetId) {
    const next = draftFromTarget(getRangeTarget(id));
    setTargetId(id);
    setDraft(next);
    setSaved(next);
    setGridAnchor(null);
    setCursorPt(null);
    setStatus(null);
    setZoom(1);
  }

  const clientToNative = useCallback(
    (clientX: number, clientY: number) => {
      const el = frameRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return null;
      const x = ((clientX - rect.left) / rect.width) * target.nativeWidth;
      const y = ((clientY - rect.top) / rect.height) * target.nativeHeight;
      return {
        x: Math.max(0, Math.min(target.nativeWidth, x)),
        y: Math.max(0, Math.min(target.nativeHeight, y)),
      };
    },
    [target.nativeHeight, target.nativeWidth],
  );

  function onImageClick(e: MouseEvent<HTMLDivElement>) {
    const pt = clientToNative(e.clientX, e.clientY);
    if (!pt) return;

    if (mode === "bullseye") {
      const bx = round1(pt.x);
      const by = round1(pt.y);
      setDraft((d) => ({ ...d, bullseyeXPx: bx, bullseyeYPx: by }));
      setStatus(`Bullseye → ${bx}, ${by} px`);
      return;
    }

    if (!gridAnchor) {
      setGridAnchor(pt);
      setStatus(
        mode === "grid-x"
          ? `Anker X — klikk ${draft.gridSquares} rute(r) til høyre/venstre`
          : `Anker Y — klikk ${draft.gridSquares} rute(r) opp/ned`,
      );
      return;
    }

    const dx = Math.abs(pt.x - gridAnchor.x);
    const dy = Math.abs(pt.y - gridAnchor.y);
    const spanPx = mode === "grid-x" ? dx : dy;
    const spanMm = draft.gridMm * draft.gridSquares;
    if (spanPx < 2) {
      setStatus("For kort span — klikk lengre fra ankeret.");
      return;
    }
    const ppm = round3(spanPx / spanMm);
    if (mode === "grid-x") {
      setDraft((d) => ({ ...d, pxPerMm: ppm }));
      setStatus(
        `X: ${spanPx.toFixed(1)} px / ${spanMm} mm (${draft.gridSquares}×${draft.gridMm}) → ${formatPpm(ppm)} px/mm`,
      );
    } else {
      setDraft((d) => ({ ...d, pxPerMmY: ppm }));
      setStatus(
        `Y: ${spanPx.toFixed(1)} px / ${spanMm} mm (${draft.gridSquares}×${draft.gridMm}) → ${formatPpm(ppm)} px/mm`,
      );
    }
    setGridAnchor(null);
  }

  function onImageMove(e: MouseEvent<HTMLDivElement>) {
    if (!gridAnchor || mode === "bullseye") {
      setCursorPt(null);
      return;
    }
    setCursorPt(clientToNative(e.clientX, e.clientY));
  }

  async function bakeToRepo() {
    setBaking(true);
    setStatus(null);
    try {
      const sameXY = Math.abs(draft.pxPerMmY - draft.pxPerMm) < 1e-6;
      const res = await fetch("/api/admin/target-cal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetId,
          bullseyeXPx: draft.bullseyeXPx,
          bullseyeYPx: draft.bullseyeYPx,
          pxPerMm: draft.pxPerMm,
          pxPerMmY: sameXY ? null : draft.pxPerMmY,
          visualScale: draft.visualScale,
        }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setStatus(data.error ?? `Bake feilet (${res.status})`);
        return;
      }
      // Keep in-memory catalog in sync for this session.
      const live = RANGE_TARGETS[targetId];
      live.bullseyeXPx = draft.bullseyeXPx;
      live.bullseyeYPx = draft.bullseyeYPx;
      live.pxPerMm = draft.pxPerMm;
      if (sameXY) delete live.pxPerMmY;
      else live.pxPerMmY = draft.pxPerMmY;
      live.visualScale = draft.visualScale;
      setSaved({ ...draft });
      setStatus(`Lagret ${target.label} til targets.ts`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Bake feilet");
    } finally {
      setBaking(false);
    }
  }

  const gridXPx = draft.pxPerMm * draft.gridMm;
  const gridYPx = draft.pxPerMmY * draft.gridMm;
  const measureSpanMm = draft.gridMm * draft.gridSquares;

  return (
    <div className="admin-office admin-targets">
      <header className="admin-spot-controls">
        <p className="intro-line intro-gift">Targets — skivekalibrering</p>
        <p className="shop-row-note">
          1) Sett bullseye (kryss i midten). 2) Mål tynn rute X/Y — klikk to
          sider av {draft.gridSquares}×{draft.gridMm} mm. 3) Lagre til repo.
          Bruk bare det prikkete rutenettet, ikke Dot/mrad-merker.
        </p>

        <div className="admin-spot-row">
          <label className="admin-spot-field">
            <span>Skive</span>
            <select
              value={targetId}
              onChange={(e) => selectTarget(e.target.value as RangeTargetId)}
            >
              {RANGE_TARGET_IDS.map((id) => (
                <option key={id} value={id}>
                  {RANGE_TARGETS[id].label}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-spot-field">
            <span>Rute mm</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              min={5}
              max={200}
              step={1}
              value={draft.gridMm}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n) || n <= 0) return;
                setDraft((d) => ({ ...d, gridMm: n }));
              }}
            />
          </label>
          <label className="admin-spot-field">
            <span>× ruter</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              min={1}
              max={10}
              step={1}
              value={draft.gridSquares}
              onChange={(e) => {
                const n = Math.round(Number(e.target.value));
                if (!Number.isFinite(n) || n < 1) return;
                setDraft((d) => ({ ...d, gridSquares: n }));
              }}
            />
          </label>
          <label className="admin-spot-field">
            <span>Zoom</span>
            <select
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
            >
              <option value={1}>1×</option>
              <option value={1.5}>1.5×</option>
              <option value={2}>2×</option>
              <option value={3}>3×</option>
              <option value={4}>4×</option>
            </select>
          </label>
        </div>

        <div className="admin-spot-row">
          <button
            type="button"
            className={
              mode === "bullseye"
                ? "intro-button admin-spot-btn is-selected"
                : "intro-button admin-spot-btn"
            }
            onClick={() => {
              setMode("bullseye");
              setGridAnchor(null);
              setCursorPt(null);
            }}
          >
            Sett bullseye
          </button>
          <button
            type="button"
            className={
              mode === "grid-x"
                ? "intro-button admin-spot-btn is-selected"
                : "intro-button admin-spot-btn"
            }
            onClick={() => {
              setMode("grid-x");
              setGridAnchor(null);
              setCursorPt(null);
            }}
          >
            Mål rute X
          </button>
          <button
            type="button"
            className={
              mode === "grid-y"
                ? "intro-button admin-spot-btn is-selected"
                : "intro-button admin-spot-btn"
            }
            onClick={() => {
              setMode("grid-y");
              setGridAnchor(null);
              setCursorPt(null);
            }}
          >
            Mål rute Y
          </button>
          <button
            type="button"
            className="intro-button admin-spot-btn"
            title="Kopier X-skala til Y"
            onClick={() => {
              setDraft((d) => ({ ...d, pxPerMmY: d.pxPerMm }));
              setStatus("Y = X");
            }}
          >
            Y = X
          </button>
          <button
            type="button"
            className="intro-button admin-spot-btn"
            onClick={() => {
              const next = draftFromTarget(getRangeTarget(targetId));
              setDraft(next);
              setSaved(next);
              setGridAnchor(null);
              setCursorPt(null);
              setStatus("Tilbakestilt fra katalog");
            }}
          >
            Tilbakestill
          </button>
        </div>

        <div className="admin-spot-row">
          <label className="admin-spot-field">
            <span>bullseyeX</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              step={0.1}
              value={draft.bullseyeXPx}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                setDraft((d) => ({ ...d, bullseyeXPx: n }));
              }}
            />
          </label>
          <label className="admin-spot-field">
            <span>bullseyeY</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              step={0.1}
              value={draft.bullseyeYPx}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                setDraft((d) => ({ ...d, bullseyeYPx: n }));
              }}
            />
          </label>
          <label className="admin-spot-field">
            <span>pxPerMm X</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              step={0.001}
              min={0.01}
              value={draft.pxPerMm}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n) || n <= 0) return;
                setDraft((d) => ({ ...d, pxPerMm: n }));
              }}
            />
          </label>
          <label className="admin-spot-field">
            <span>pxPerMm Y</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              step={0.001}
              min={0.01}
              value={draft.pxPerMmY}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n) || n <= 0) return;
                setDraft((d) => ({ ...d, pxPerMmY: n }));
              }}
            />
          </label>
          <label className="admin-spot-field">
            <span>visualScale</span>
            <input
              type="number"
              className="admin-spot-scale-num"
              min={0.1}
              max={10}
              step={0.01}
              value={draft.visualScale}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n) || n <= 0) return;
                setDraft((d) => ({ ...d, visualScale: n }));
              }}
            />
          </label>
        </div>

        <div className="admin-spot-row admin-spot-meta">
          <span>
            {target.nativeWidth}×{target.nativeHeight} px
          </span>
          <span>
            1 rute ≈ {gridXPx.toFixed(1)}×{gridYPx.toFixed(1)} px
          </span>
          <span>
            Målspan {measureSpanMm} mm · modus:{" "}
            {mode === "bullseye"
              ? "bullseye"
              : mode === "grid-x"
                ? "X"
                : "Y"}
          </span>
        </div>

        <div className="admin-spot-bake">
          <button
            type="button"
            className="intro-button"
            disabled={!dirty || baking}
            onClick={() => void bakeToRepo()}
          >
            {baking ? "Skriver…" : "Lagre til repo"}
          </button>
          {status ? (
            <span className="admin-spot-allow-hint">{status}</span>
          ) : dirty ? (
            <span className="admin-spot-allow-hint">Ulagrede endringer</span>
          ) : null}
          <button type="button" className="intro-button" onClick={onLeave}>
            ← Byen
          </button>
        </div>
      </header>

      <div className="admin-targets-scroll">
        <div
          ref={frameRef}
          className="admin-targets-frame"
          style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
          onClick={onImageClick}
          onMouseMove={onImageMove}
          onMouseLeave={() => setCursorPt(null)}
          role="presentation"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={target.src}
            alt={target.label}
            width={target.nativeWidth}
            height={target.nativeHeight}
            draggable={false}
            className="admin-targets-img"
          />
          <svg
            className="admin-targets-overlay"
            viewBox={`0 0 ${target.nativeWidth} ${target.nativeHeight}`}
            aria-hidden
          >
            <line
              x1={draft.bullseyeXPx - 48}
              y1={draft.bullseyeYPx}
              x2={draft.bullseyeXPx + 48}
              y2={draft.bullseyeYPx}
              className="admin-targets-bull"
            />
            <line
              x1={draft.bullseyeXPx}
              y1={draft.bullseyeYPx - 48}
              x2={draft.bullseyeXPx}
              y2={draft.bullseyeYPx + 48}
              className="admin-targets-bull"
            />
            <circle
              cx={draft.bullseyeXPx}
              cy={draft.bullseyeYPx}
              r={7}
              className="admin-targets-bull-dot"
            />
            {/* Predicted thin-grid square at bullseye */}
            <rect
              x={draft.bullseyeXPx - gridXPx / 2}
              y={draft.bullseyeYPx - gridYPx / 2}
              width={gridXPx}
              height={gridYPx}
              className="admin-targets-grid-box"
            />
            {/* Multi-square guide from bullseye (right / down) */}
            <rect
              x={draft.bullseyeXPx}
              y={draft.bullseyeYPx}
              width={gridXPx * draft.gridSquares}
              height={gridYPx * draft.gridSquares}
              className="admin-targets-grid-multi"
            />
            {gridAnchor ? (
              <circle
                cx={gridAnchor.x}
                cy={gridAnchor.y}
                r={6}
                className="admin-targets-anchor"
              />
            ) : null}
            {gridAnchor && cursorPt ? (
              <line
                x1={gridAnchor.x}
                y1={gridAnchor.y}
                x2={mode === "grid-x" ? cursorPt.x : gridAnchor.x}
                y2={mode === "grid-y" ? cursorPt.y : gridAnchor.y}
                className="admin-targets-measure"
              />
            ) : null}
          </svg>
        </div>
      </div>
    </div>
  );
}
