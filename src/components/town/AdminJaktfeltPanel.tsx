"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useSession } from "next-auth/react";
import {
  AWARE_MAP_MAX_M,
  AWARE_MAP_RADIUS_PCT,
  awareMapMaxMFor,
  awareMetersPerPctFor,
  cellCenterOnAwareMap,
  distanceMBetween,
  type CellPoint,
} from "@/lib/aware/cellGeometry";
import { compressImageForCloudTerrain } from "@/lib/hunt/compressCloudTerrainMap";
import {
  ensureCloudTerrainsLoaded,
  type CloudHuntTerrain,
} from "@/lib/hunt/cloudTerrains";
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
  listHuntMaps,
  type HuntGridCell,
  type HuntMapAsset,
  type HuntMapId,
} from "@/lib/hunt/maps";
import {
  getMapBirdSeats,
  type MapBirdSeat,
} from "@/lib/hunt/mapPlacements";

type AdminJaktfeltPanelProps = {
  onLeave: () => void;
};

const AWARE_SAFETY_RING_M = 1000;

type MeasureState = {
  a: CellPoint | null;
  b: CellPoint | null;
};

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugTitle(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9æøå]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return s || `terreng-${Date.now().toString(36)}`;
}

export function AdminJaktfeltPanel({ onLeave }: AdminJaktfeltPanelProps) {
  const { status: authStatus } = useSession();
  const [mapId, setMapId] = useState<HuntMapId>("finnskogen");
  const [draftTitle, setDraftTitle] = useState(HUNT_MAPS.finnskogen.label);
  const [draftRegion, setDraftRegion] = useState(
    HUNT_MAPS.finnskogen.regionHint,
  );
  const [draftCols, setDraftCols] = useState(HUNT_MAPS.finnskogen.cols);
  const [draftRows, setDraftRows] = useState(HUNT_MAPS.finnskogen.rows);
  /** Uploaded / cloud preview src (blob URL or remote). Null → catalog map. */
  const [customImageSrc, setCustomImageSrc] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<Blob | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const catalogAsset: HuntMapAsset = useMemo(() => {
    try {
      return (
        listHuntMaps().find((m) => m.id === mapId) ?? HUNT_MAPS.finnskogen
      );
    } catch {
      return HUNT_MAPS.finnskogen;
    }
  }, [mapId]);

  const catalog: Pick<HuntMapAsset, "cols" | "rows" | "src" | "label" | "awareMapMaxM"> =
    {
      cols: draftCols,
      rows: draftRows,
      src: customImageSrc ?? catalogAsset.src,
      label: draftTitle,
      awareMapMaxM: catalogAsset.awareMapMaxM,
    };

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
  const knownSpanInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [baking, setBaking] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [canPublishCloud, setCanPublishCloud] = useState(false);
  const [cloudList, setCloudList] = useState<CloudHuntTerrain[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);

  const isCustomDraft = !!customImageSrc || !!pendingUpload;
  const mapList = useMemo(() => listHuntMaps(), [cloudList, syncing]);

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/cloud-terrains");
        const data = (await res.json()) as { canPublish?: boolean };
        if (!cancelled) setCanPublishCloud(!!data.canPublish);
      } catch {
        if (!cancelled) setCanPublishCloud(false);
      }
      const terrains = await ensureCloudTerrainsLoaded();
      if (!cancelled) setCloudList(terrains);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

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

  function clearUpload() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPendingUpload(null);
    setCustomImageSrc(null);
  }

  function loadMap(id: HuntMapId) {
    clearUpload();
    let m: HuntMapAsset;
    try {
      m = listHuntMaps().find((x) => x.id === id) ?? HUNT_MAPS.finnskogen;
    } catch {
      m = HUNT_MAPS.finnskogen;
    }
    setMapId(id);
    setDraftTitle(m.label);
    setDraftRegion(m.regionHint);
    setDraftCols(m.cols);
    setDraftRows(m.rows);
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

  function loadCloudTerrain(t: CloudHuntTerrain) {
    clearUpload();
    setMapId(`cloud-preview:${t.id}`);
    setCustomImageSrc(t.imageUrl);
    setDraftTitle(t.title || "Cloud-terreng");
    setDraftRegion(t.regionHint || "Cloud");
    setDraftCols(t.cols);
    setDraftRows(t.rows);
    setStart({ ...t.start });
    setAwareMaxM(
      t.awareMapMaxM != null && Number.isFinite(t.awareMapMaxM)
        ? t.awareMapMaxM
        : AWARE_MAP_MAX_M,
    );
    setSeats([...t.seats]);
    setMeasure({ a: null, b: null });
    setRingCell(null);
    setSelectedSeat(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setStatus(`Cloud-terreng: ${t.title || t.id} (${t.seats.length} seter)`);
  }

  async function onUploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setStatus("Velg PNG eller JPEG.");
      return;
    }
    clearUpload();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setPendingUpload(file);
    setCustomImageSrc(url);
    setMapId(`draft:${Date.now().toString(36)}`);
    setDraftTitle(file.name.replace(/\.(png|jpe?g|webp)$/i, "") || "Nytt terreng");
    setDraftRegion("Nytt");
    setDraftCols(7);
    setDraftRows(6);
    setStart({ row: 0, col: 0 });
    setAwareMaxM(AWARE_MAP_MAX_M);
    setSeats([]);
    setMeasure({ a: null, b: null });
    setRingCell(null);
    setSelectedSeat(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setStatus(
      `Nytt kart lastet opp — sett start, skala, tiur/orre, deretter publiser eller eksporter.`,
    );
  }

  async function resolveMapBlob(): Promise<Blob> {
    if (pendingUpload) return pendingUpload;
    const src = customImageSrc ?? catalogAsset.src;
    const res = await fetch(src);
    if (!res.ok) throw new Error(`Kunne ikke hente kartbilde (${res.status})`);
    return res.blob();
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
        const a = measure.a;
        const b = { x, y };
        setMeasure({ a, b });
        promptRealDistanceAndCalibrate(a, b);
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

  function applyScaleFromMeasure(realDistanceM?: number) {
    if (!measure.a || !measure.b) {
      setStatus("Measure to punkter først, deretter skriv inn reell avstand.");
      return;
    }
    const span =
      realDistanceM != null && Number.isFinite(realDistanceM)
        ? realDistanceM
        : knownSpanM;
    if (!(span >= 10)) {
      setStatus("Reell avstand må være minst 10 m.");
      return;
    }
    const rounded = Math.round(span);
    setKnownSpanM(rounded);
    const next = awareMapMaxMFromKnownSpan(measure.a, measure.b, rounded);
    setAwareMaxM(next);
    setStatus(
      `Skala kalibrert: ${rounded} m reelt spann → awareMapMaxM ${next} m @ ${AWARE_MAP_RADIUS_PCT}%`,
    );
  }

  /** After two measure clicks — ask admin for the true ground distance. */
  function promptRealDistanceAndCalibrate(
    a: CellPoint,
    b: CellPoint,
  ) {
    const currentM = distanceMBetween(a, b, metersPerPct);
    const raw = window.prompt(
      `Measure ferdig.\n\nHvor mange meter er denne strekningen i virkeligheten?\n(Med nåværende skala er den ca. ${Math.round(currentM)} m)`,
      String(Math.round(knownSpanM)),
    );
    if (raw == null) {
      setStatus(
        `Measure: ca. ${Math.round(currentM)} m (gammel skala). Skriv inn reell avstand under «Measure → skala» og trykk Enter.`,
      );
      window.setTimeout(() => knownSpanInputRef.current?.focus(), 50);
      return;
    }
    const realM = Number(String(raw).replace(",", ".").trim());
    if (!Number.isFinite(realM) || realM < 10) {
      setStatus(
        "Ugyldig meterverdi — skriv inn reell avstand under «Measure → skala».",
      );
      window.setTimeout(() => knownSpanInputRef.current?.focus(), 50);
      return;
    }
    setMeasure({ a, b });
    setKnownSpanM(Math.round(realM));
    const next = awareMapMaxMFromKnownSpan(a, b, realM);
    setAwareMaxM(next);
    setStatus(
      `Skala kalibrert: ${Math.round(realM)} m reelt spann → awareMapMaxM ${next} m @ ${AWARE_MAP_RADIUS_PCT}%`,
    );
  }

  function resetSeatsFromCatalog() {
    if (isCustomDraft || String(mapId).startsWith("cloud-preview:")) {
      setSeats([]);
      setSelectedSeat(null);
      setStatus("Seter tømt (nytt terreng)");
      return;
    }
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
    if (isCustomDraft || String(mapId).startsWith("cloud-preview:")) {
      await bakeCustomToRepo();
      return;
    }
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

  /** New / imported terrain → public/maps/cloud + cloudHuntMapsCatalog.ts */
  async function bakeCustomToRepo() {
    if (!pendingUpload && !customImageSrc) {
      setStatus("Last opp kartbilde (PNG) før du skriver til repo.");
      return;
    }
    setBaking(true);
    setStatus("Skriver terreng til lokal repo…");
    try {
      const raw = await resolveMapBlob();
      const compressed = await compressImageForCloudTerrain(raw);
      const buf = await compressed.blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      const imageBase64 = btoa(binary);
      const slug = slugTitle(draftTitle).replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a");
      const res = await fetch("/api/admin/jaktfelt/write-custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          title: draftTitle,
          regionHint: draftRegion,
          cols: draftCols,
          rows: draftRows,
          start,
          awareMapMaxM: awareMaxM,
          seats,
          imageBase64,
          imageExt: compressed.ext,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        id?: string;
        seats?: number;
        paths?: string[];
        hint?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      setStatus(
        `Skrevet til repo: ${data.id} · ${data.seats ?? seats.length} seter → ${(data.paths ?? []).join(", ")}. ${data.hint ?? ""}`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Repo-skriving feilet");
    } finally {
      setBaking(false);
    }
  }

  async function publishToCloud() {
    if (!canPublishCloud) {
      setStatus(
        authStatus !== "authenticated"
          ? "Logg inn med Google for å publisere til sky."
          : "Ingen cloud-admin-tilgang (ADMIN_GOOGLE_IDS).",
      );
      return;
    }
    setPublishing(true);
    setStatus("Komprimerer kart og publiserer til sky…");
    try {
      const raw = await resolveMapBlob();
      const compressed = await compressImageForCloudTerrain(raw);
      const res = await fetch("/api/admin/cloud-terrains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draftTitle,
          regionHint: draftRegion,
          imageBase64: compressed.base64,
          cols: draftCols,
          rows: draftRows,
          start,
          awareMapMaxM: awareMaxM,
          seats,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        seats?: number;
        bytes?: number;
        id?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      const terrains = await ensureCloudTerrainsLoaded({ force: true });
      setCloudList(terrains);
      const kb = data.bytes ? Math.round(data.bytes / 1024) : "?";
      setStatus(
        `Publisert til sky · ${data.seats ?? seats.length} seter · ${kb} KB. Main admin: «Oppdater repo fra sky».`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Publisering feilet");
    } finally {
      setPublishing(false);
    }
  }

  async function exportTerrainPackage() {
    try {
      const raw = await resolveMapBlob();
      const compressed = await compressImageForCloudTerrain(raw);
      const base = slugTitle(draftTitle);
      const pack = {
        version: 1,
        title: draftTitle,
        regionHint: draftRegion,
        exportedAt: new Date().toISOString(),
        cols: draftCols,
        rows: draftRows,
        start,
        awareMapMaxM: awareMaxM,
        seats,
        image: {
          filename: `${base}.${compressed.ext}`,
          mime: compressed.mime,
          bytes: compressed.bytes,
        },
      };
      downloadBlob(
        `${base}.terrain.json`,
        new Blob([JSON.stringify(pack, null, 2)], {
          type: "application/json",
        }),
      );
      downloadBlob(`${base}.${compressed.ext}`, compressed.blob);
      setStatus(
        `Eksportert ${base}.terrain.json + ${base}.${compressed.ext} (${Math.round(compressed.bytes / 1024)} KB).`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Eksport feilet");
    }
  }

  async function syncRepoFromCloud() {
    if (!canPublishCloud) {
      setStatus(
        authStatus !== "authenticated"
          ? "Logg inn med Google for å synke fra sky."
          : "Ingen cloud-admin-tilgang (ADMIN_GOOGLE_IDS).",
      );
      return;
    }
    setSyncing(true);
    setStatus("Henter terreng fra sky til lokal repo…");
    try {
      const res = await fetch("/api/admin/cloud-terrains/sync-to-repo", {
        method: "POST",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        terrains?: number;
        added?: number;
        updated?: number;
        failed?: number;
        hint?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      const terrains = await ensureCloudTerrainsLoaded({ force: true });
      setCloudList(terrains);
      setStatus(
        `Synket ${data.terrains ?? 0} terreng (ny ${data.added ?? 0} · oppdatert ${data.updated ?? 0}${data.failed ? ` · feil ${data.failed}` : ""}). ${data.hint ?? ""}`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Sync feilet");
    } finally {
      setSyncing(false);
    }
  }

  async function onImportPackage(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as {
        title?: string;
        regionHint?: string;
        cols?: number;
        rows?: number;
        start?: HuntGridCell;
        awareMapMaxM?: number;
        seats?: MapBirdSeat[];
      };
      if (!Array.isArray(data.seats)) {
        setStatus("Ugyldig .terrain.json (mangler seats).");
        return;
      }
      setDraftTitle(typeof data.title === "string" ? data.title : draftTitle);
      setDraftRegion(
        typeof data.regionHint === "string" ? data.regionHint : draftRegion,
      );
      if (typeof data.cols === "number") setDraftCols(data.cols);
      if (typeof data.rows === "number") setDraftRows(data.rows);
      if (data.start) setStart({ ...data.start });
      if (typeof data.awareMapMaxM === "number") setAwareMaxM(data.awareMapMaxM);
      setSeats(data.seats.filter(Boolean));
      setStatus(
        `Importert JSON (${data.seats.length} seter). Last opp kartbilde hvis det mangler.`,
      );
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Import feilet");
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
            Last opp PNG/screenshot, definer grid/seter/Aware-skala. Assistent
            publiserer til sky; main admin henter med «Oppdater fra sky»
            (samme mønster som spotting-scener).
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
            value={
              String(mapId).startsWith("draft:") ||
              String(mapId).startsWith("cloud-preview:")
                ? ""
                : mapId
            }
            onChange={(e) => {
              if (e.target.value) loadMap(e.target.value as HuntMapId);
            }}
          >
            {isCustomDraft || String(mapId).startsWith("cloud-preview:") ? (
              <option value="">— utkast / cloud —</option>
            ) : null}
            {mapList.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.regionHint})
              </option>
            ))}
          </select>
        </label>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUploadFile(f);
            e.target.value = "";
          }}
        />
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImportPackage(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          className="intro-button sheriff-secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          Last opp kart
        </button>
        <button
          type="button"
          className="intro-button sheriff-secondary"
          onClick={() => importInputRef.current?.click()}
        >
          Importer JSON
        </button>

        {cloudList.length > 0 ? (
          <label className="shop-filter">
            Fra sky
            <select
              defaultValue=""
              onChange={(e) => {
                const t = cloudList.find((x) => x.id === e.target.value);
                if (t) loadCloudTerrain(t);
                e.target.value = "";
              }}
            >
              <option value="">— åpne cloud-terreng —</option>
              {cloudList.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title || t.id} · {t.seats.length} seter
                </option>
              ))}
            </select>
          </label>
        ) : null}

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
            <label className="shop-filter">
              Navn
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
              />
            </label>
            <label className="shop-filter">
              Region
              <input
                type="text"
                value={draftRegion}
                onChange={(e) => setDraftRegion(e.target.value)}
              />
            </label>
            <div className="jaktfelt-grid-fields">
              <label className="shop-filter">
                Kolonner
                <input
                  type="number"
                  min={2}
                  max={24}
                  value={draftCols}
                  onChange={(e) => {
                    const n = Math.round(Number(e.target.value));
                    if (!Number.isFinite(n)) return;
                    setDraftCols(Math.max(2, Math.min(24, n)));
                  }}
                />
              </label>
              <label className="shop-filter">
                Rader
                <input
                  type="number"
                  min={2}
                  max={24}
                  value={draftRows}
                  onChange={(e) => {
                    const n = Math.round(Number(e.target.value));
                    if (!Number.isFinite(n)) return;
                    setDraftRows(Math.max(2, Math.min(24, n)));
                  }}
                />
              </label>
            </div>
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
              Velg Measure, klikk to punkter med kjent avstand. Etter punkt 2
              skriver du inn hvor mange meter strekningen er i virkeligheten —
              da settes awareMapMaxM automatisk.
            </p>
            <label className="shop-filter">
              Reell avstand (m)
              <input
                ref={knownSpanInputRef}
                type="number"
                min={10}
                max={5000}
                step={1}
                value={Math.round(knownSpanM)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  setKnownSpanM(Math.max(10, n));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyScaleFromMeasure();
                  }
                }}
              />
            </label>
            <button
              type="button"
              className="intro-button"
              disabled={!measure.a || !measure.b}
              onClick={() => applyScaleFromMeasure()}
            >
              Sett skala fra Measure
            </button>
            {measureM != null ? (
              <p className="shop-row-note">
                Spann med nåværende skala: {Math.round(measureM)} m
                {measure.a && measure.b
                  ? ` · map ${Math.hypot(measure.b.x - measure.a.x, measure.b.y - measure.a.y).toFixed(1)} %`
                  : ""}
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
                className="intro-button sheriff-secondary"
                disabled={baking}
                onClick={() => void bakeToRepo()}
                title={
                  isCustomDraft
                    ? "Skriv nytt/importert terreng til public/maps/cloud + katalog"
                    : "Oppdater kjernekart i lokal repo"
                }
              >
                {baking
                  ? "Skriver…"
                  : isCustomDraft
                    ? "Skriv terreng til repo"
                    : "Lagre til repo"}
              </button>
              <button
                type="button"
                className="intro-button"
                disabled={publishing || !canPublishCloud}
                title={
                  canPublishCloud
                    ? "Publiser kart + seter til Supabase"
                    : "Krever Google + ADMIN_GOOGLE_IDS"
                }
                onClick={() => void publishToCloud()}
              >
                {publishing ? "Publiserer…" : "Publiser til sky"}
              </button>
              <button
                type="button"
                className="intro-button sheriff-secondary"
                onClick={() => void exportTerrainPackage()}
              >
                Eksporter JSON+PNG
              </button>
              <button
                type="button"
                className="intro-button"
                disabled={syncing || !canPublishCloud}
                onClick={() => void syncRepoFromCloud()}
              >
                {syncing ? "Synker…" : "Oppdater repo fra sky"}
              </button>
            </div>
            {status ? <p className="jaktfelt-status">{status}</p> : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
