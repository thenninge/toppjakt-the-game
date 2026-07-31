"use client";

import { useEffect, useMemo, useState } from "react";
import { ScopeOpticFit } from "@/components/range/ScopeOpticFit";
import { ScopeReticle } from "@/components/range/ScopeReticle";
import { VectorReticleSvg } from "@/components/range/VectorReticleSvg";
import {
  SCOPE_FOV_DIAMETER_PREMIUM,
  type ScopeSpec,
} from "@/lib/optics/spec";
import {
  clampBrokenGapDeg,
  defaultCustomScopeDraft,
  loadCustomScopeDraft,
  MOA_TO_MRAD,
  newVecId,
  saveCustomScopeDraft,
  type CustomScopeDraft,
  type VecElement,
  type VecFill,
  type VecIllum,
  type VecStroke,
} from "@/lib/optics/vectorReticle";
import {
  SCOPE_FOV_CAL_HALF_MRAD,
  SCOPE_FOV_CAL_ZOOM,
} from "@/lib/range/precision";
import { getReticleDef } from "@/lib/range/reticles";
import { opticReticleImgScale } from "@/lib/range/scopeViewScale";
import { spotImagesWithPerches } from "@/lib/hunt/spotPerches";

type AdminCustomScopePanelProps = {
  onLeave: () => void;
};

type EditorTool =
  | "select"
  | "line"
  | "hash"
  | "arrow"
  | "number"
  | "rect"
  | "dot"
  | "circle"
  | "brokenCircle";

type DragState =
  | null
  | {
      tool: "line" | "arrow" | "rect" | "circle";
      start: { x: number; y: number };
    };

function magCalFromFov(
  zoom: number,
  fovHalfMrad: number,
): number {
  const z = Math.max(0.5, zoom);
  const fov = Math.max(0.5, fovHalfMrad);
  return (SCOPE_FOV_CAL_HALF_MRAD * SCOPE_FOV_CAL_ZOOM) / (z * fov);
}

function clampNum(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Admin → Custom Scope: zoom + FOV (mrad) + vector reticle editor.
 */
export function AdminCustomScopePanel({ onLeave }: AdminCustomScopePanelProps) {
  const [draft, setDraft] = useState<CustomScopeDraft>(() =>
    loadCustomScopeDraft(),
  );
  const [tool, setTool] = useState<EditorTool>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [illumDrum, setIllumDrum] = useState(0.85);
  const [previewZoom, setPreviewZoom] = useState(25);
  const [editorHalfMils, setEditorHalfMils] = useState(10);
  const [status, setStatus] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState>(null);
  const [cursorMils, setCursorMils] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [hashAxis, setHashAxis] = useState<"h" | "v">("v");
  const [defaultStroke, setDefaultStroke] = useState<VecStroke>("thin");
  const [defaultFill, setDefaultFill] = useState<VecFill>("none");
  const [defaultIllum, setDefaultIllum] = useState<VecIllum>("both");
  const [defaultDotRMils, setDefaultDotRMils] = useState(0.035);
  const [defaultBrokenRMils, setDefaultBrokenRMils] = useState(0.2);
  const [defaultBrokenGapDeg, setDefaultBrokenGapDeg] = useState(20);
  const [defaultCircleDiameterMoa, setDefaultCircleDiameterMoa] =
    useState(0.5);
  /** When true, new circles use diameterMoa; drag otherwise sets rMils. */
  const [circleUseMoa, setCircleUseMoa] = useState(true);
  const [spotSceneSrc, setSpotSceneSrc] = useState<string | null>(null);
  const [landAspect, setLandAspect] = useState(16 / 9);

  const spotPool = useMemo(() => spotImagesWithPerches(), []);

  useEffect(() => {
    saveCustomScopeDraft(draft);
  }, [draft]);

  useEffect(() => {
    setPreviewZoom((z) =>
      clampNum(z, draft.minZoom, draft.maxZoom),
    );
  }, [draft.minZoom, draft.maxZoom]);

  const selected = useMemo(
    () => draft.reticle.elements.find((e) => e.id === selectedId) ?? null,
    [draft.reticle.elements, selectedId],
  );

  const zoomMagCal = magCalFromFov(draft.maxZoom, draft.fovHalfMradAtMax);
  const minZoomMagCal = magCalFromFov(draft.minZoom, draft.fovHalfMradAtMin);
  const previewFovHalf =
    draft.minZoom >= draft.maxZoom
      ? draft.fovHalfMradAtMax
      : draft.fovHalfMradAtMin +
        ((previewZoom - draft.minZoom) /
          (draft.maxZoom - draft.minZoom)) *
          (draft.fovHalfMradAtMax - draft.fovHalfMradAtMin);

  const previewScope: ScopeSpec = useMemo(
    () => ({
      tubeDiameterMm: 34,
      minZoom: draft.minZoom,
      maxZoom: draft.maxZoom,
      focalPlane: "FFP",
      reticleId: draft.reticleId || "p5fl",
      clickUnit: draft.clickUnit,
      clickErrorPercent: 0,
      zeroRetentionInaccuracy: 0.03,
      fovDiameterScale: SCOPE_FOV_DIAMETER_PREMIUM,
      zoomMagCal,
      minZoomMagCal,
    }),
    [
      draft.minZoom,
      draft.maxZoom,
      draft.reticleId,
      draft.clickUnit,
      zoomMagCal,
      minZoomMagCal,
    ],
  );

  const reticleDef = getReticleDef(previewScope.reticleId);
  const reticleImgScale = opticReticleImgScale(previewZoom, previewScope);

  function pickRandomScene() {
    if (spotPool.length === 0) {
      setStatus("Ingen spotting-scener med perches funnet.");
      return;
    }
    const next = spotPool[Math.floor(Math.random() * spotPool.length)]!;
    setSpotSceneSrc(next);
    setLandAspect(16 / 9);
    const label = next.split("/").pop() ?? next;
    setStatus(`Scene: ${label}`);
  }

  function patchDraft(patch: Partial<CustomScopeDraft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setStatus(null);
  }

  function patchReticleElements(
    updater: (els: VecElement[]) => VecElement[],
  ) {
    setDraft((d) => ({
      ...d,
      reticle: { ...d.reticle, elements: updater(d.reticle.elements) },
    }));
    setStatus(null);
  }

  function updateSelected(patch: Partial<VecElement>) {
    if (!selectedId) return;
    patchReticleElements((els) =>
      els.map((e) =>
        e.id === selectedId ? ({ ...e, ...patch } as VecElement) : e,
      ),
    );
  }

  function deleteSelected() {
    if (!selectedId) return;
    patchReticleElements((els) => els.filter((e) => e.id !== selectedId));
    setSelectedId(null);
  }

  const addElement = (el: VecElement) => {
    patchReticleElements((els) => [...els, el]);
    setSelectedId(el.id);
  };

  function onPointerDownMils(pt: { x: number; y: number }) {
    if (tool === "select") return;
    if (tool === "hash") {
      addElement({
        id: newVecId("hash"),
        kind: "hash",
        axis: hashAxis,
        at: hashAxis === "v" ? Math.round(pt.y * 10) / 10 : Math.round(pt.x * 10) / 10,
        len: 0.25,
        stroke: defaultStroke,
        illum: defaultIllum,
      });
      return;
    }
    if (tool === "number") {
      const text = window.prompt("Tall / tekst", "1");
      if (text == null || !text.trim()) return;
      addElement({
        id: newVecId("num"),
        kind: "number",
        x: Math.round(pt.x * 100) / 100,
        y: Math.round(pt.y * 100) / 100,
        text: text.trim(),
        sizeMils: 0.55,
        illum: defaultIllum,
      });
      return;
    }
    if (tool === "dot") {
      addElement({
        id: newVecId("dot"),
        kind: "dot",
        x: Math.round(pt.x * 100) / 100,
        y: Math.round(pt.y * 100) / 100,
        rMils: defaultDotRMils,
        illum: defaultIllum,
      });
      return;
    }
    if (tool === "brokenCircle") {
      addElement({
        id: newVecId("broken"),
        kind: "brokenCircle",
        x: Math.round(pt.x * 100) / 100,
        y: Math.round(pt.y * 100) / 100,
        rMils: defaultBrokenRMils,
        gapDeg: clampBrokenGapDeg(defaultBrokenGapDeg),
        stroke: defaultStroke,
        illum: defaultIllum,
      });
      return;
    }
    if (tool === "circle" && circleUseMoa) {
      addElement({
        id: newVecId("circle"),
        kind: "circle",
        x: Math.round(pt.x * 100) / 100,
        y: Math.round(pt.y * 100) / 100,
        rMils: (defaultCircleDiameterMoa / 2) * MOA_TO_MRAD,
        diameterMoa: defaultCircleDiameterMoa,
        stroke: defaultStroke,
        illum: defaultIllum,
      });
      return;
    }
    if (tool === "line" || tool === "arrow" || tool === "rect" || tool === "circle") {
      setDrag({ tool, start: pt });
    }
  }

  function onPointerUpMils(pt: { x: number; y: number }) {
    if (!drag) return;
    const { start, tool: t } = drag;
    setDrag(null);
    const dx = pt.x - start.x;
    const dy = pt.y - start.y;
    if (Math.hypot(dx, dy) < 0.08) return;

    if (t === "line") {
      addElement({
        id: newVecId("line"),
        kind: "line",
        x1: start.x,
        y1: start.y,
        x2: pt.x,
        y2: pt.y,
        stroke: defaultStroke,
        illum: defaultIllum,
      });
    } else if (t === "arrow") {
      addElement({
        id: newVecId("arrow"),
        kind: "arrow",
        tipX: pt.x,
        tipY: pt.y,
        baseX: start.x,
        baseY: start.y,
        fill: defaultFill,
        stroke: defaultStroke,
        illum: defaultIllum,
      });
    } else if (t === "rect") {
      addElement({
        id: newVecId("rect"),
        kind: "rect",
        x: (start.x + pt.x) / 2,
        y: (start.y + pt.y) / 2,
        w: Math.max(0.15, Math.abs(dx)),
        h: Math.max(0.15, Math.abs(dy)),
        fill: defaultFill,
        stroke: defaultStroke,
        illum: defaultIllum,
      });
    } else if (t === "circle") {
      const r = Math.max(0.05, Math.hypot(dx, dy));
      addElement({
        id: newVecId("circle"),
        kind: "circle",
        x: start.x,
        y: start.y,
        rMils: Math.round(r * 1000) / 1000,
        stroke: defaultStroke,
        illum: defaultIllum,
      });
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Delete" || e.key === "Backspace") {
        const t = e.target as HTMLElement | null;
        if (
          t &&
          (t.tagName === "INPUT" ||
            t.tagName === "TEXTAREA" ||
            t.tagName === "SELECT" ||
            t.isContentEditable)
        ) {
          return;
        }
        if (!selectedId) return;
        e.preventDefault();
        const id = selectedId;
        setDraft((d) => ({
          ...d,
          reticle: {
            ...d.reticle,
            elements: d.reticle.elements.filter((el) => el.id !== id),
          },
        }));
        setSelectedId(null);
      }
      if (e.key === "Escape") {
        setTool("select");
        setSelectedId(null);
        setDrag(null);
      }
      if (e.key === "1") setTool("select");
      if (e.key === "2") setTool("line");
      if (e.key === "3") setTool("hash");
      if (e.key === "4") setTool("arrow");
      if (e.key === "5") setTool("number");
      if (e.key === "6") setTool("rect");
      if (e.key === "7") setTool("dot");
      if (e.key === "8") setTool("circle");
      if (e.key === "9") setTool("brokenCircle");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId]);

  function resetReticle() {
    const next = defaultCustomScopeDraft();
    setDraft((d) => ({
      ...d,
      reticle: next.reticle,
    }));
    setSelectedId(null);
    setStatus("Retikkel nullstilt til S&B P5FL (datasheet).");
  }

  function resetAll() {
    setDraft(defaultCustomScopeDraft());
    setSelectedId(null);
    setStatus("Custom scope nullstilt til 6-36×56 PM II P5FL.");
  }

  const tools: { id: EditorTool; label: string; hint: string }[] = [
    { id: "select", label: "Velg", hint: "1" },
    { id: "line", label: "Strek", hint: "2 · dra" },
    { id: "hash", label: "Hash", hint: "3 · klikk" },
    { id: "arrow", label: "Pil", hint: "4 · dra" },
    { id: "number", label: "Tall", hint: "5 · klikk" },
    { id: "rect", label: "Rektangel", hint: "6 · dra" },
    { id: "dot", label: "Dot", hint: "7 · klikk" },
    { id: "circle", label: "Sirkel", hint: "8 · klikk/dra" },
    { id: "brokenCircle", label: "Brutt sirkel", hint: "9 · klikk" },
  ];

  return (
    <div className="admin-custom-scope">
      <header className="admin-custom-scope-head">
        <div>
          <p className="intro-line intro-gift">Custom Scope</p>
          <p className="shop-row-note">
            PNG-glass: P5FL ({draft.reticleId || "p5fl"} min/max). Scene plukker
            tilfeldig spotting-bakgrunn. Vektor-editor under er valgfri overlay.
          </p>
        </div>
        <button type="button" className="intro-button" onClick={onLeave}>
          ← Byen
        </button>
      </header>

      <div className="admin-custom-scope-grid">
        <aside className="admin-custom-scope-side" aria-label="Scope-parametre">
          <label className="admin-spot-field">
            <span>Brand</span>
            <input
              value={draft.brand}
              onChange={(e) => patchDraft({ brand: e.target.value })}
            />
          </label>
          <label className="admin-spot-field">
            <span>Navn</span>
            <input
              value={draft.name}
              onChange={(e) => patchDraft({ name: e.target.value })}
            />
          </label>
          <div className="admin-custom-scope-row2">
            <label className="admin-spot-field">
              <span>Min zoom</span>
              <input
                type="number"
                min={1}
                max={40}
                step={0.5}
                value={draft.minZoom}
                onChange={(e) =>
                  patchDraft({
                    minZoom: clampNum(Number(e.target.value), 1, 40),
                  })
                }
              />
            </label>
            <label className="admin-spot-field">
              <span>Max zoom</span>
              <input
                type="number"
                min={1}
                max={60}
                step={0.5}
                value={draft.maxZoom}
                onChange={(e) =>
                  patchDraft({
                    maxZoom: clampNum(Number(e.target.value), 1, 60),
                  })
                }
              />
            </label>
          </div>
          <label className="admin-spot-field">
            <span>FOV @ max zoom (lite synsfelt) — half mrad</span>
            <input
              type="number"
              min={1}
              max={40}
              step={0.1}
              value={draft.fovHalfMradAtMax}
              onChange={(e) =>
                patchDraft({
                  fovHalfMradAtMax: clampNum(Number(e.target.value), 1, 40),
                })
              }
            />
          </label>
          <label className="admin-spot-field">
            <span>FOV @ min zoom (stort synsfelt) — half mrad</span>
            <input
              type="number"
              min={2}
              max={120}
              step={0.1}
              value={draft.fovHalfMradAtMin}
              onChange={(e) =>
                patchDraft({
                  fovHalfMradAtMin: clampNum(Number(e.target.value), 2, 120),
                })
              }
            />
          </label>
          <p className="admin-spot-meta">
            ⇒ zoomMagCal {zoomMagCal.toFixed(3)} @ {draft.maxZoom}× · minZoomMagCal{" "}
            {minZoomMagCal.toFixed(3)} @ {draft.minZoom}×
            <br />
            Preview {previewZoom.toFixed(1)}× → ±{previewFovHalf.toFixed(2)} mrad
            centre→edge
          </p>
          <label className="admin-spot-field">
            <span>Preview zoom</span>
            <input
              type="range"
              min={draft.minZoom}
              max={draft.maxZoom}
              step={0.5}
              value={previewZoom}
              onChange={(e) => setPreviewZoom(Number(e.target.value))}
            />
          </label>
          <label className="admin-spot-field">
            <span>Belysning (trommel)</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={illumDrum}
              onChange={(e) => setIllumDrum(Number(e.target.value))}
            />
          </label>
          <label className="admin-spot-field">
            <span>Editor grid ±mils</span>
            <input
              type="number"
              min={4}
              max={20}
              step={1}
              value={editorHalfMils}
              onChange={(e) =>
                setEditorHalfMils(clampNum(Number(e.target.value), 4, 20))
              }
            />
          </label>
          <div className="admin-custom-scope-actions">
            <button
              type="button"
              className="intro-button admin-spot-btn"
              onClick={pickRandomScene}
              disabled={spotPool.length === 0}
              title="Tilfeldig spotting-scene bak glasset"
            >
              Scene
            </button>
            <button
              type="button"
              className="intro-button admin-spot-btn"
              onClick={() => {
                setSpotSceneSrc(null);
                setStatus("Scene fjernet.");
              }}
              disabled={!spotSceneSrc}
            >
              Fjern scene
            </button>
            <button
              type="button"
              className="intro-button admin-spot-btn"
              onClick={resetReticle}
            >
              Nullstill overlay
            </button>
            <button
              type="button"
              className="intro-button admin-spot-btn"
              onClick={resetAll}
            >
              Nullstill alt
            </button>
          </div>
          {status ? <p className="admin-spot-meta">{status}</p> : null}
        </aside>

        <section className="admin-custom-scope-main" aria-label="Scope-glass">
          <div className="admin-custom-scope-glass-hero">
            <p className="admin-spot-meta">
              Glass · {previewZoom.toFixed(1)}× · FOV ±{previewFovHalf.toFixed(2)}{" "}
              mrad · retikkel {draft.reticleId || "p5fl"}
              {spotSceneSrc
                ? ` · ${spotSceneSrc.split("/").pop()}`
                : " · (trykk Scene)"}
            </p>
            <ScopeOpticFit className="admin-custom-scope-optic-fit">
              <div className="admin-custom-scope-glass is-live">
                {spotSceneSrc ? (
                  <div className="admin-custom-scope-scene" aria-hidden>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={spotSceneSrc}
                      alt=""
                      draggable={false}
                      style={{
                        width: `${Math.max(120, 100 * (landAspect / (16 / 9)))}%`,
                        height: "auto",
                        minHeight: "100%",
                        objectFit: "cover",
                      }}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                          setLandAspect(img.naturalWidth / img.naturalHeight);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="admin-custom-scope-scene-empty" aria-hidden />
                )}
                {reticleDef ? (
                  <ScopeReticle
                    scope={previewScope}
                    zoom={previewZoom}
                    imgScale={reticleImgScale}
                    illumination={illumDrum}
                    illuminationColor="red"
                  />
                ) : (
                  <p className="admin-spot-meta">Mangler retikkel {draft.reticleId}</p>
                )}
                {draft.reticle.elements.length > 0 ? (
                  <VectorReticleSvg
                    className="admin-custom-scope-vector-overlay"
                    reticle={draft.reticle}
                    halfMils={Math.max(previewFovHalf, 1)}
                    illumination={illumDrum}
                  />
                ) : null}
              </div>
            </ScopeOpticFit>
          </div>

          <details className="admin-custom-scope-vector" open={false}>
            <summary>Vektor-overlay (valgfritt)</summary>
          <div className="admin-custom-scope-toolbar" role="toolbar">
            {tools.map((t) => (
              <button
                key={t.id}
                type="button"
                className={
                  tool === t.id
                    ? "intro-button admin-spot-btn is-active"
                    : "intro-button admin-spot-btn"
                }
                title={t.hint}
                onClick={() => setTool(t.id)}
              >
                {t.label}
              </button>
            ))}
            <label className="admin-spot-field admin-custom-scope-inline">
              <span>Strek</span>
              <select
                value={defaultStroke}
                onChange={(e) =>
                  setDefaultStroke(e.target.value as VecStroke)
                }
              >
                <option value="thin">Tynn</option>
                <option value="thick">Tykk</option>
              </select>
            </label>
            <label className="admin-spot-field admin-custom-scope-inline">
              <span>Fyll</span>
              <select
                value={defaultFill}
                onChange={(e) => setDefaultFill(e.target.value as VecFill)}
              >
                <option value="none">Ingen</option>
                <option value="solid">Fylt</option>
              </select>
            </label>
            <label className="admin-spot-field admin-custom-scope-inline">
              <span>Illum</span>
              <select
                value={defaultIllum}
                onChange={(e) => setDefaultIllum(e.target.value as VecIllum)}
              >
                <option value="both">Etch+illum</option>
                <option value="etch">Kun etch</option>
                <option value="illum">Kun illum</option>
              </select>
            </label>
            {tool === "hash" ? (
              <label className="admin-spot-field admin-custom-scope-inline">
                <span>Hash-akse</span>
                <select
                  value={hashAxis}
                  onChange={(e) =>
                    setHashAxis(e.target.value as "h" | "v")
                  }
                >
                  <option value="v">På vertikal (↔)</option>
                  <option value="h">På horisontal (↕)</option>
                </select>
              </label>
            ) : null}
            {tool === "dot" ? (
              <label className="admin-spot-field admin-custom-scope-inline">
                <span>Dot r (mrad)</span>
                <input
                  type="number"
                  min={0.01}
                  max={1}
                  step={0.005}
                  value={defaultDotRMils}
                  onChange={(e) =>
                    setDefaultDotRMils(
                      clampNum(Number(e.target.value), 0.01, 1),
                    )
                  }
                />
              </label>
            ) : null}
            {tool === "circle" ? (
              <>
                <label className="admin-spot-field admin-custom-scope-inline">
                  <span>Modus</span>
                  <select
                    value={circleUseMoa ? "moa" : "drag"}
                    onChange={(e) =>
                      setCircleUseMoa(e.target.value === "moa")
                    }
                  >
                    <option value="moa">MOA-diameter · klikk</option>
                    <option value="drag">mrad · dra radius</option>
                  </select>
                </label>
                {circleUseMoa ? (
                  <label className="admin-spot-field admin-custom-scope-inline">
                    <span>Ø (MOA)</span>
                    <input
                      type="number"
                      min={0.1}
                      max={10}
                      step={0.05}
                      value={defaultCircleDiameterMoa}
                      onChange={(e) =>
                        setDefaultCircleDiameterMoa(
                          clampNum(Number(e.target.value), 0.1, 10),
                        )
                      }
                    />
                  </label>
                ) : null}
              </>
            ) : null}
            {tool === "brokenCircle" ? (
              <>
                <label className="admin-spot-field admin-custom-scope-inline">
                  <span>r (mrad)</span>
                  <input
                    type="number"
                    min={0.05}
                    max={5}
                    step={0.05}
                    value={defaultBrokenRMils}
                    onChange={(e) =>
                      setDefaultBrokenRMils(
                        clampNum(Number(e.target.value), 0.05, 5),
                      )
                    }
                  />
                </label>
                <label className="admin-spot-field admin-custom-scope-inline">
                  <span>Gap (°)</span>
                  <input
                    type="number"
                    min={0}
                    max={45}
                    step={1}
                    value={defaultBrokenGapDeg}
                    onChange={(e) =>
                      setDefaultBrokenGapDeg(
                        clampBrokenGapDeg(Number(e.target.value)),
                      )
                    }
                  />
                </label>
              </>
            ) : null}
            <button
              type="button"
              className="intro-button admin-spot-btn"
              disabled={!selectedId}
              onClick={deleteSelected}
            >
              Slett
            </button>
          </div>

          <div className="admin-custom-scope-canvases">
            <div className="admin-custom-scope-editor-wrap">
              <p className="admin-spot-meta">
                Editor (mils) ·{" "}
                {cursorMils
                  ? `${cursorMils.x.toFixed(2)}, ${cursorMils.y.toFixed(2)}`
                  : "—"}
                {drag ? " · drar…" : ""}
              </p>
              <VectorReticleSvg
                className="admin-custom-scope-editor"
                reticle={draft.reticle}
                halfMils={editorHalfMils}
                illumination={illumDrum}
                selectedId={selectedId}
                onSelectId={(id) => {
                  setSelectedId(id);
                  if (id) setTool("select");
                }}
                onPointerMils={setCursorMils}
                onPointerDownMils={onPointerDownMils}
                onPointerUpMils={onPointerUpMils}
              />
            </div>
          </div>

          {selected ? (
            <div className="admin-custom-scope-props" aria-label="Valgt element">
              <p className="admin-spot-meta">
                Valgt: <strong>{selected.kind}</strong> · {selected.id}
              </p>
              <div className="admin-custom-scope-row2">
                <label className="admin-spot-field">
                  <span>Illum</span>
                  <select
                    value={selected.illum}
                    onChange={(e) =>
                      updateSelected({
                        illum: e.target.value as VecIllum,
                      })
                    }
                  >
                    <option value="both">Etch+illum</option>
                    <option value="etch">Kun etch</option>
                    <option value="illum">Kun illum</option>
                  </select>
                </label>
                {"stroke" in selected ? (
                  <label className="admin-spot-field">
                    <span>Strek</span>
                    <select
                      value={selected.stroke}
                      onChange={(e) =>
                        updateSelected({
                          stroke: e.target.value as VecStroke,
                        })
                      }
                    >
                      <option value="thin">Tynn</option>
                      <option value="thick">Tykk</option>
                    </select>
                  </label>
                ) : null}
                {"fill" in selected ? (
                  <label className="admin-spot-field">
                    <span>Fyll</span>
                    <select
                      value={selected.fill}
                      onChange={(e) =>
                        updateSelected({
                          fill: e.target.value as VecFill,
                        })
                      }
                    >
                      <option value="none">Ingen</option>
                      <option value="solid">Fylt</option>
                    </select>
                  </label>
                ) : null}
              </div>
              {selected.kind === "line" ? (
                <div className="admin-custom-scope-row2">
                  {(
                    [
                      ["x1", selected.x1],
                      ["y1", selected.y1],
                      ["x2", selected.x2],
                      ["y2", selected.y2],
                    ] as const
                  ).map(([k, v]) => (
                    <label key={k} className="admin-spot-field">
                      <span>{k}</span>
                      <input
                        type="number"
                        step={0.05}
                        value={v}
                        onChange={(e) =>
                          updateSelected({
                            [k]: Number(e.target.value),
                          } as Partial<VecElement>)
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : null}
              {selected.kind === "hash" ? (
                <div className="admin-custom-scope-row2">
                  <label className="admin-spot-field">
                    <span>at (mils)</span>
                    <input
                      type="number"
                      step={0.1}
                      value={selected.at}
                      onChange={(e) =>
                        updateSelected({ at: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="admin-spot-field">
                    <span>len</span>
                    <input
                      type="number"
                      step={0.05}
                      min={0.05}
                      value={selected.len}
                      onChange={(e) =>
                        updateSelected({ len: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="admin-spot-field">
                    <span>akse</span>
                    <select
                      value={selected.axis}
                      onChange={(e) =>
                        updateSelected({
                          axis: e.target.value as "h" | "v",
                        })
                      }
                    >
                      <option value="v">Vertikal wire</option>
                      <option value="h">Horisontal wire</option>
                    </select>
                  </label>
                  <label className="admin-spot-field">
                    <span>side</span>
                    <select
                      value={selected.side ?? "both"}
                      onChange={(e) =>
                        updateSelected({
                          side: e.target.value as "both" | "neg" | "pos",
                        })
                      }
                    >
                      <option value="both">Begge</option>
                      <option value="neg">− (opp / venstre)</option>
                      <option value="pos">+ (ned / høyre)</option>
                    </select>
                  </label>
                </div>
              ) : null}
              {selected.kind === "number" ? (
                <div className="admin-custom-scope-row2">
                  <label className="admin-spot-field">
                    <span>tekst</span>
                    <input
                      value={selected.text}
                      onChange={(e) =>
                        updateSelected({ text: e.target.value })
                      }
                    />
                  </label>
                  <label className="admin-spot-field">
                    <span>x</span>
                    <input
                      type="number"
                      step={0.05}
                      value={selected.x}
                      onChange={(e) =>
                        updateSelected({ x: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="admin-spot-field">
                    <span>y</span>
                    <input
                      type="number"
                      step={0.05}
                      value={selected.y}
                      onChange={(e) =>
                        updateSelected({ y: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="admin-spot-field">
                    <span>størrelse</span>
                    <input
                      type="number"
                      step={0.05}
                      min={0.2}
                      value={selected.sizeMils}
                      onChange={(e) =>
                        updateSelected({ sizeMils: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
              ) : null}
              {selected.kind === "arrow" ? (
                <div className="admin-custom-scope-row2">
                  {(
                    [
                      ["tipX", selected.tipX],
                      ["tipY", selected.tipY],
                      ["baseX", selected.baseX],
                      ["baseY", selected.baseY],
                    ] as const
                  ).map(([k, v]) => (
                    <label key={k} className="admin-spot-field">
                      <span>{k}</span>
                      <input
                        type="number"
                        step={0.05}
                        value={v}
                        onChange={(e) =>
                          updateSelected({
                            [k]: Number(e.target.value),
                          } as Partial<VecElement>)
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : null}
              {selected.kind === "rect" ? (
                <div className="admin-custom-scope-row2">
                  {(
                    [
                      ["x", selected.x],
                      ["y", selected.y],
                      ["w", selected.w],
                      ["h", selected.h],
                    ] as const
                  ).map(([k, v]) => (
                    <label key={k} className="admin-spot-field">
                      <span>{k}</span>
                      <input
                        type="number"
                        step={0.05}
                        value={v}
                        onChange={(e) =>
                          updateSelected({
                            [k]: Number(e.target.value),
                          } as Partial<VecElement>)
                        }
                      />
                    </label>
                  ))}
                </div>
              ) : null}
              {selected.kind === "dot" ? (
                <div className="admin-custom-scope-row2">
                  <label className="admin-spot-field">
                    <span>x</span>
                    <input
                      type="number"
                      step={0.05}
                      value={selected.x}
                      onChange={(e) =>
                        updateSelected({ x: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="admin-spot-field">
                    <span>y</span>
                    <input
                      type="number"
                      step={0.05}
                      value={selected.y}
                      onChange={(e) =>
                        updateSelected({ y: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="admin-spot-field">
                    <span>r (mrad)</span>
                    <input
                      type="number"
                      step={0.005}
                      min={0.01}
                      value={selected.rMils}
                      onChange={(e) =>
                        updateSelected({
                          rMils: clampNum(Number(e.target.value), 0.01, 2),
                        })
                      }
                    />
                  </label>
                </div>
              ) : null}
              {selected.kind === "circle" ? (
                <div className="admin-custom-scope-row2">
                  <label className="admin-spot-field">
                    <span>x</span>
                    <input
                      type="number"
                      step={0.05}
                      value={selected.x}
                      onChange={(e) =>
                        updateSelected({ x: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="admin-spot-field">
                    <span>y</span>
                    <input
                      type="number"
                      step={0.05}
                      value={selected.y}
                      onChange={(e) =>
                        updateSelected({ y: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="admin-spot-field">
                    <span>Ø (MOA)</span>
                    <input
                      type="number"
                      step={0.05}
                      min={0}
                      value={selected.diameterMoa ?? ""}
                      placeholder="valgfritt"
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "") {
                          updateSelected({ diameterMoa: undefined });
                          return;
                        }
                        const d = clampNum(Number(raw), 0.05, 20);
                        updateSelected({
                          diameterMoa: d,
                          rMils: (d / 2) * MOA_TO_MRAD,
                        });
                      }}
                    />
                  </label>
                  <label className="admin-spot-field">
                    <span>r (mrad)</span>
                    <input
                      type="number"
                      step={0.01}
                      min={0.01}
                      value={
                        selected.diameterMoa != null
                          ? (selected.diameterMoa / 2) * MOA_TO_MRAD
                          : selected.rMils
                      }
                      onChange={(e) =>
                        updateSelected({
                          rMils: clampNum(Number(e.target.value), 0.01, 10),
                          diameterMoa: undefined,
                        })
                      }
                    />
                  </label>
                </div>
              ) : null}
              {selected.kind === "brokenCircle" ? (
                <div className="admin-custom-scope-row2">
                  <label className="admin-spot-field">
                    <span>x</span>
                    <input
                      type="number"
                      step={0.05}
                      value={selected.x}
                      onChange={(e) =>
                        updateSelected({ x: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="admin-spot-field">
                    <span>y</span>
                    <input
                      type="number"
                      step={0.05}
                      value={selected.y}
                      onChange={(e) =>
                        updateSelected({ y: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="admin-spot-field">
                    <span>r (mrad)</span>
                    <input
                      type="number"
                      step={0.05}
                      min={0.05}
                      value={selected.rMils}
                      onChange={(e) =>
                        updateSelected({
                          rMils: clampNum(Number(e.target.value), 0.05, 10),
                        })
                      }
                    />
                  </label>
                  <label className="admin-spot-field">
                    <span>Gap (°)</span>
                    <input
                      type="number"
                      step={1}
                      min={0}
                      max={45}
                      value={selected.gapDeg}
                      onChange={(e) =>
                        updateSelected({
                          gapDeg: clampBrokenGapDeg(Number(e.target.value)),
                        })
                      }
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="admin-spot-meta">
              Velg element eller tegn med verktøy. Delete sletter. Esc = velg.
              PNG P5FL er glasset — dette er valgfri vektor-overlay.
            </p>
          )}

          <details className="admin-custom-scope-list">
            <summary>
              Elementer ({draft.reticle.elements.length})
            </summary>
            <ul>
              {draft.reticle.elements.map((el) => (
                <li key={el.id}>
                  <button
                    type="button"
                    className={
                      el.id === selectedId
                        ? "admin-custom-scope-el is-active"
                        : "admin-custom-scope-el"
                    }
                    onClick={() => {
                      setSelectedId(el.id);
                      setTool("select");
                    }}
                  >
                    {el.kind}
                    {el.kind === "number" ? ` “${el.text}”` : ""}
                    {el.kind === "hash" ? ` @${el.at}` : ""}
                    {el.kind === "brokenCircle"
                      ? ` r=${el.rMils} gap=${el.gapDeg}°`
                      : ""}
                    {el.kind === "circle" && el.diameterMoa != null
                      ? ` Ø${el.diameterMoa} MOA`
                      : ""}
                    {el.kind === "dot" ? ` r=${el.rMils}` : ""}
                    {" · "}
                    {el.illum}
                  </button>
                </li>
              ))}
            </ul>
          </details>
          </details>
        </section>
      </div>
    </div>
  );
}
