"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useSession } from "next-auth/react";
import { SpotView } from "@/components/hunt/SpotView";
import type { BirdObservedInfo } from "@/components/hunt/SpotView";
import { adminPlacementsFromPerches } from "@/lib/hunt/birds";
import {
  getBirdSpriteScalePercent,
  setBirdSpriteScalePercent,
  subscribeBirdSpriteScales,
  BIRD_SPRITE_SCALE_MAX,
  BIRD_SPRITE_SCALE_MIN,
} from "@/lib/hunt/birdSpriteScale";
import { spriteIdsForSpecies, type BirdSpriteId } from "@/lib/hunt/birdSprites";
import { compressImageForCloudScene } from "@/lib/hunt/compressCloudSceneImage";
import { ensureCloudScenesLoaded } from "@/lib/hunt/cloudScenes";
import { SPOT_IMAGES } from "@/lib/hunt/images";
import { spotImagesWithPerches } from "@/lib/hunt/spotPerches";
import {
  draftPerchesFromCatalog,
  renumberDraftPerches,
  toSpotPerches,
  type SceneDraftPerch,
} from "@/lib/hunt/sceneAuthoring";
import {
  PERCH_SCALE_DEFAULT,
  PERCH_SCALE_MAX,
  PERCH_SCALE_MIN,
} from "@/lib/hunt/perchDistanceOverrides";
import { getCatalogByCategory } from "@/lib/shop/catalog";
import { isLrfItem, isThermalItem } from "@/lib/shop/types";
import { lrfOpticalMagnification } from "@/lib/optics/spec";

const TIUR_SPRITES = spriteIdsForSpecies("tiur");
const ORRE_SPRITES = spriteIdsForSpecies("orrhane");

function SceneSpriteScaleField({ spriteId }: { spriteId: BirdSpriteId }) {
  const [scale, setScale] = useState(() =>
    getBirdSpriteScalePercent(spriteId),
  );
  useEffect(() => {
    setScale(getBirdSpriteScalePercent(spriteId));
    return subscribeBirdSpriteScales(() => {
      setScale(getBirdSpriteScalePercent(spriteId));
    });
  }, [spriteId]);
  return (
    <label className="admin-spot-field admin-spot-scale">
      <span>Scale %</span>
      <input
        type="number"
        className="admin-spot-scale-num"
        min={BIRD_SPRITE_SCALE_MIN}
        max={BIRD_SPRITE_SCALE_MAX}
        step={1}
        value={scale}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          setScale(setBirdSpriteScalePercent(spriteId, n));
        }}
        aria-label="Sprite scale prosent"
      />
    </label>
  );
}

type AdminSceneCreationPanelProps = {
  onLeave: () => void;
};

const ADMIN_BATTERY_SEC = 60 * 60;
const DEFAULT_MIN_M = 180;
const DEFAULT_MAX_M = 230;

function spotLabel(src: string): string {
  const base = src.split("/").pop() ?? src;
  return base.replace(/\.(png|jpe?g|webp)$/i, "");
}

function fileToBase64(file: File): Promise<{ base64: string; ext: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      const base64 = comma >= 0 ? result.slice(comma + 1) : result;
      const name = file.name.toLowerCase();
      const ext = name.endsWith(".webp")
        ? "webp"
        : name.endsWith(".jpg") || name.endsWith(".jpeg")
          ? "jpg"
          : "png";
      resolve({ base64, ext });
    };
    reader.onerror = () => reject(new Error("Klarte ikke å lese filen"));
    reader.readAsDataURL(file);
  });
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function AdminSceneCreationPanel({ onLeave }: AdminSceneCreationPanelProps) {
  const { data: session, status: authStatus } = useSession();
  const lrfItems = useMemo(
    () => getCatalogByCategory("lrf").filter(isLrfItem),
    [],
  );
  const thermalItems = useMemo(
    () => getCatalogByCategory("thermal").filter(isThermalItem),
    [],
  );
  const existingScenes = useMemo(() => {
    const withPerches = spotImagesWithPerches();
    const all = new Set([...SPOT_IMAGES, ...withPerches]);
    return [...all].sort();
  }, []);

  const [imageSrc, setImageSrc] = useState("");
  const [repoImageSrc, setRepoImageSrc] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{
    base64: string;
    ext: string;
  } | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [perches, setPerches] = useState<SceneDraftPerch[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [toolSpecies, setToolSpecies] = useState<"tiur" | "orrhane">("tiur");
  const [toolMinM, setToolMinM] = useState(DEFAULT_MIN_M);
  const [toolMaxM, setToolMaxM] = useState(DEFAULT_MAX_M);
  const [toolScale, setToolScale] = useState(PERCH_SCALE_DEFAULT);
  const [toolEyes, setToolEyes] = useState(true);
  const [toolSpriteId, setToolSpriteId] = useState<"" | BirdSpriteId>("");

  const [tiurSpriteId, setTiurSpriteId] = useState<BirdSpriteId>(
    TIUR_SPRITES[0] ?? "tiur-1",
  );
  const [orreSpriteId, setOrreSpriteId] = useState<BirdSpriteId>(
    ORRE_SPRITES[0] ?? "orre-1",
  );
  const [scaleEpoch, setScaleEpoch] = useState(0);
  const [binoId, setBinoId] = useState(lrfItems[0]?.id ?? "");
  const [thermalId, setThermalId] = useState(thermalItems[0]?.id ?? "");
  const [battery, setBattery] = useState(ADMIN_BATTERY_SEC);
  const [baking, setBaking] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [syncingRepo, setSyncingRepo] = useState(false);
  const [canPublishCloud, setCanPublishCloud] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  useEffect(() => {
    return subscribeBirdSpriteScales(() => {
      setScaleEpoch((n) => n + 1);
    });
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      setCanPublishCloud(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/cloud-scenes");
        const data = (await res.json()) as { canPublish?: boolean };
        if (!cancelled) setCanPublishCloud(!!data.canPublish);
      } catch {
        if (!cancelled) setCanPublishCloud(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authStatus, session?.user?.googleId]);

  const birdPlacements = useMemo(() => {
    void scaleEpoch;
    return adminPlacementsFromPerches(toSpotPerches(perches), {
      tiurSpriteId,
      orreSpriteId,
      stableDistance: true,
    });
  }, [perches, tiurSpriteId, orreSpriteId, scaleEpoch]);

  const selected = perches.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    setToolSpecies(selected.species);
    setToolMinM(selected.distanceMinM);
    setToolMaxM(selected.distanceMaxM);
    setToolScale(selected.scalePercent);
    setToolEyes(selected.eyesVisible);
    setToolSpriteId(selected.spriteId ?? "");
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps -- sync form when selection changes

  function applySelectedFields(
    patch: Partial<
      Pick<
        SceneDraftPerch,
        | "species"
        | "distanceMinM"
        | "distanceMaxM"
        | "scalePercent"
        | "eyesVisible"
        | "spriteId"
      >
    >,
  ) {
    if (!selectedId) return;
    setPerches((prev) =>
      prev.map((p) => {
        if (p.id !== selectedId) return p;
        const next: SceneDraftPerch = { ...p, ...patch };
        if ("spriteId" in patch && !patch.spriteId) {
          delete next.spriteId;
        }
        if (patch.species && next.spriteId) {
          const ok = spriteIdsForSpecies(patch.species).includes(next.spriteId);
          if (!ok) delete next.spriteId;
        }
        return next;
      }),
    );
    setDirty(true);
  }

  function loadExisting(src: string) {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPendingUpload(null);
    setRepoImageSrc(src);
    setImageSrc(src);
    const draft = draftPerchesFromCatalog(src);
    setPerches(draft);
    setSelectedId(draft[0]?.id ?? null);
    setDirty(false);
    setStatus(`Lastet ${spotLabel(src)} · ${draft.length} perch`);
  }

  async function onUpload(file: File | null) {
    if (!file) return;
    try {
      const { base64, ext } = await fileToBase64(file);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      setPendingUpload({ base64, ext });
      setRepoImageSrc(null);
      setImageSrc(url);
      setPerches([]);
      setSelectedId(null);
      setDirty(true);
      setStatus(`Ny scene fra «${file.name}» — plasser perch, deretter Lagre til repo`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Opplasting feilet");
    }
  }

  const placeAt = useCallback(
    (x: number, y: number) => {
      if (!imageSrc) return;
      const nx = Math.max(0, Math.min(100, x));
      const ny = Math.max(0, Math.min(100, y));
      if (selectedId) {
        setPerches((prev) =>
          prev.map((p) =>
            p.id === selectedId ? { ...p, x: nx, y: ny } : p,
          ),
        );
        setDirty(true);
        return;
      }
      setPerches((prev) => {
        const id = `p${prev.length}`;
        const next: SceneDraftPerch = {
          id,
          x: nx,
          y: ny,
          species: toolSpecies,
          distanceMinM: Math.min(toolMinM, toolMaxM),
          distanceMaxM: Math.max(toolMinM, toolMaxM),
          eyesVisible: toolEyes,
          scalePercent: toolScale,
          ...(toolSpriteId ? { spriteId: toolSpriteId } : {}),
        };
        queueMicrotask(() => setSelectedId(id));
        return [...prev, next];
      });
      setDirty(true);
    },
    [
      imageSrc,
      selectedId,
      toolSpecies,
      toolMinM,
      toolMaxM,
      toolEyes,
      toolScale,
      toolSpriteId,
    ],
  );

  function deleteSelected() {
    if (!selectedId) return;
    const next = renumberDraftPerches(
      perches.filter((p) => p.id !== selectedId),
    );
    setPerches(next);
    setSelectedId(next[0]?.id ?? null);
    setDirty(true);
  }

  function onMarkerPointerDown(
    e: ReactPointerEvent<HTMLButtonElement>,
    id: string,
  ) {
    e.stopPropagation();
    e.preventDefault();
    const p = perches.find((x) => x.id === id);
    if (!p) return;
    setSelectedId(id);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: p.x,
      origY: p.y,
    };
  }

  function onMarkerPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.id !== selectedId) return;
    const frame = e.currentTarget.closest(".spot-eyes-frame");
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    // Approximate: in eyes mode 1:1; in optic, markers are in world % so
    // delta client / world size. Use frame size as proxy for eyes; for optic
    // the marker is inside scaled world — use parent .spot-binos-world.
    const world = e.currentTarget.parentElement;
    const wrect = world?.getBoundingClientRect() ?? rect;
    const dx = ((e.clientX - drag.startX) / wrect.width) * 100;
    const dy = ((e.clientY - drag.startY) / wrect.height) * 100;
    const x = Math.max(0, Math.min(100, drag.origX + dx));
    const y = Math.max(0, Math.min(100, drag.origY + dy));
    setPerches((prev) =>
      prev.map((p) => (p.id === drag.id ? { ...p, x, y } : p)),
    );
    setDirty(true);
  }

  function onMarkerPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    if (dragRef.current) {
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  }

  async function bakeToRepo() {
    if (!imageSrc || perches.length === 0) {
      setStatus("Trenger bilde og minst én perch.");
      return;
    }
    setBaking(true);
    setStatus("Skriver scene til repo…");
    try {
      const payload: Record<string, unknown> = {
        imageSrc: repoImageSrc ?? undefined,
        perches: toSpotPerches(perches),
      };
      if (pendingUpload) {
        payload.imageBase64 = pendingUpload.base64;
        payload.imageExt = pendingUpload.ext;
      }
      const res = await fetch("/api/admin/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        imageSrc?: string;
        perches?: number;
      };
      if (!res.ok || !data.ok || !data.imageSrc) {
        setStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      setRepoImageSrc(data.imageSrc);
      setPendingUpload(null);
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      setImageSrc(data.imageSrc);
      setPerches(renumberDraftPerches(perches));
      setDirty(false);
      setStatus(
        `OK ${data.perches} perch → ${data.imageSrc}. Last siden på nytt / commit + push.`,
      );
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Klarte ikke å skrive filen.",
      );
    } finally {
      setBaking(false);
    }
  }

  async function resolveSceneImageBlob(): Promise<Blob> {
    if (pendingUpload) {
      const bin = atob(pendingUpload.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const mime =
        pendingUpload.ext === "jpg" || pendingUpload.ext === "jpeg"
          ? "image/jpeg"
          : pendingUpload.ext === "webp"
            ? "image/webp"
            : "image/png";
      return new Blob([bytes], { type: mime });
    }
    if (!imageSrc) throw new Error("Mangler bilde");
    const res = await fetch(imageSrc);
    if (!res.ok) throw new Error("Klarte ikke å hente bildet");
    return res.blob();
  }

  async function publishToCloud() {
    if (!imageSrc || perches.length === 0) {
      setStatus("Trenger bilde og minst én perch.");
      return;
    }
    if (!canPublishCloud) {
      setStatus(
        authStatus !== "authenticated"
          ? "Logg inn med Google for å publisere til sky."
          : "Ingen cloud-admin-tilgang (ADMIN_GOOGLE_IDS).",
      );
      return;
    }
    setPublishing(true);
    setStatus("Komprimerer og publiserer til sky…");
    try {
      const raw = await resolveSceneImageBlob();
      const compressed = await compressImageForCloudScene(raw);
      const title = repoImageSrc
        ? spotLabel(repoImageSrc)
        : `scene-${new Date().toISOString().slice(0, 10)}`;
      const res = await fetch("/api/admin/cloud-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          imageBase64: compressed.base64,
          perches: toSpotPerches(perches),
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        imageUrl?: string;
        perches?: number;
        bytes?: number;
      };
      if (!res.ok || !data.ok) {
        setStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      await ensureCloudScenesLoaded({ force: true });
      setDirty(false);
      const kb = data.bytes ? Math.round(data.bytes / 1024) : "?";
      setStatus(
        `Publisert til sky · ${data.perches ?? perches.length} perch · ${kb} KB JPEG. Synlig for spillere etter refresh.`,
      );
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Klarte ikke å publisere.",
      );
    } finally {
      setPublishing(false);
    }
  }

  async function exportScenePackage() {
    if (!imageSrc || perches.length === 0) {
      setStatus("Trenger bilde og minst én perch for eksport.");
      return;
    }
    try {
      const raw = await resolveSceneImageBlob();
      const compressed = await compressImageForCloudScene(raw);
      const base = repoImageSrc
        ? spotLabel(repoImageSrc)
        : `scene-${Date.now().toString(36)}`;
      const scene = {
        version: 1,
        title: base,
        exportedAt: new Date().toISOString(),
        perches: toSpotPerches(perches),
        image: {
          filename: `${base}.jpg`,
          mime: "image/jpeg",
          bytes: compressed.bytes,
        },
      };
      downloadBlob(
        `${base}.scene.json`,
        new Blob([JSON.stringify(scene, null, 2)], {
          type: "application/json",
        }),
      );
      downloadBlob(`${base}.jpg`, compressed.blob);
      setStatus(
        `Eksportert ${base}.scene.json + ${base}.jpg (${Math.round(compressed.bytes / 1024)} KB).`,
      );
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Eksport feilet.",
      );
    }
  }

  async function syncRepoFromCloud() {
    if (!canPublishCloud) {
      setStatus(
        authStatus !== "authenticated"
          ? "Logg inn med Google først."
          : "Krever ADMIN_GOOGLE_IDS (kun lokal dev).",
      );
      return;
    }
    setSyncingRepo(true);
    setStatus("Henter cloud-scener til repo…");
    try {
      const res = await fetch("/api/admin/cloud-scenes/sync-to-repo", {
        method: "POST",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        added?: number;
        updated?: number;
        skipped?: number;
        failed?: number;
        hint?: string;
      };
      if (!res.ok || !data.ok) {
        setStatus(data.error ?? `Feil ${res.status}`);
        return;
      }
      setStatus(
        `Repo oppdatert fra sky: +${data.added ?? 0} nye, ${data.updated ?? 0} oppdatert` +
          (data.skipped ? `, ${data.skipped} hoppet over` : "") +
          (data.failed ? `, ${data.failed} feilet` : "") +
          `. ${data.hint ?? "Commit + push."}`,
      );
    } catch (err) {
      setStatus(
        err instanceof Error ? err.message : "Sync feilet.",
      );
    } finally {
      setSyncingRepo(false);
    }
  }

  const binoItem = lrfItems.find((i) => i.id === binoId) ?? null;
  const thermalItem = thermalItems.find((i) => i.id === thermalId) ?? null;
  const isHabrok = !!thermalItem?.thermal.isThermalBinocular;
  const hasBinos = !!binoItem || isHabrok;
  const hasThermal = !!thermalItem;
  const lrfSpec = binoItem
    ? {
        ...binoItem.lrf,
        id: binoItem.id,
        brand: binoItem.brand,
      }
    : null;
  const thermalLrfSpec =
    thermalItem?.thermal.hasIntegratedLrf
      ? {
          id: thermalItem.id,
          brand: thermalItem.brand,
          rangeErrorPercent: thermalItem.thermal.rangeErrorPercent ?? 1,
          hasOnboardBallistics:
            thermalItem.thermal.integratedLrfHasBallistics === false
              ? false
              : (thermalItem.thermal.integratedLrfHasBallistics ??
                !!thermalItem.thermal.isThermalBinocular),
        }
      : null;
  const binoZoom = binoItem
    ? lrfOpticalMagnification(binoItem)
    : isHabrok
      ? (thermalItem?.thermal.magnification ?? 10)
      : 10;
  const binosLabel = binoItem
    ? `${binoItem.brand} ${binoItem.name}`
    : isHabrok && thermalItem
      ? `${thermalItem.brand} ${thermalItem.name}`
      : null;
  const thermalLabel = thermalItem
    ? `${thermalItem.brand} ${thermalItem.name}`
    : null;

  const worldOverlay = (
    <>
      {perches.map((p) => (
        <button
          key={p.id}
          type="button"
          className={
            p.id === selectedId
              ? "scene-perch-marker is-selected"
              : "scene-perch-marker"
          }
          data-species={p.species}
          style={{ left: `${p.x}%`, top: `${p.y}%` }}
          title={`${p.id} · ${p.species} · ${p.distanceMinM}–${p.distanceMaxM} m`}
          onPointerDown={(e) => onMarkerPointerDown(e, p.id)}
          onPointerMove={onMarkerPointerMove}
          onPointerUp={onMarkerPointerUp}
          onPointerCancel={onMarkerPointerUp}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="scene-perch-marker-dot" aria-hidden />
          <span className="scene-perch-marker-id">{p.id}</span>
        </button>
      ))}
    </>
  );

  if (!imageSrc) {
    return (
      <div className="admin-scene-create">
        <p className="intro-line intro-gift">Scene creation</p>
        <p className="intro-line">
          Last opp et landskapsbilde eller åpne en eksisterende spotting-scene.
          F / LRF plasserer perch i krysspunktet (øyne: klikk i bildet).
        </p>
        <div className="admin-spot-controls">
          <div className="admin-spot-row">
            <label className="admin-spot-field admin-spot-field-wide">
              <span>Last opp bilde</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="admin-spot-field admin-spot-field-wide">
              <span>Eksisterende scene</span>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) loadExisting(e.target.value);
                }}
              >
                <option value="">Velg…</option>
                {existingScenes.map((src) => (
                  <option key={src} value={src}>
                    {spotLabel(src)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <button type="button" className="intro-button" onClick={onLeave}>
          ← Tilbake
        </button>
      </div>
    );
  }

  return (
    <SpotView
      imageSrc={imageSrc}
      birdPlacements={birdPlacements}
      viewBearingDeg={0}
      magnification={binoZoom}
      lrfSpec={lrfSpec}
      thermalMagnification={thermalItem?.thermal.magnification ?? 3}
      thermalPixelFactor={thermalItem?.thermal.pixelFactor ?? 10}
      thermalTimeFactor={thermalItem?.thermal.timeFactor ?? 1}
      thermalLrfSpec={thermalLrfSpec}
      isThermalBinocular={isHabrok}
      thermalMinZoom={thermalItem?.thermal.minZoom ?? 5}
      thermalMaxZoom={thermalItem?.thermal.maxZoom ?? 22}
      hasThermalOutline={!!thermalItem?.thermal.hasOutlineMode}
      hasThermalFusion={!!thermalItem?.thermal.hasFusionMode}
      binosPriceNok={
        binoItem?.priceNok ?? (isHabrok ? thermalItem?.priceNok ?? 0 : 0)
      }
      binosAperturePercent={binoItem?.lrf.aperturePercent ?? null}
      thermalPriceNok={thermalItem?.priceNok ?? 0}
      clockMinutes={12 * 60}
      hasBinos={hasBinos}
      hasThermal={hasThermal}
      hasLrf={!!lrfSpec || !!thermalLrfSpec}
      hasKestrel={false}
      binosLabel={binosLabel}
      thermalLabel={thermalLabel}
      thermalBatteryGameSec={battery}
      thermalBatteryMaxGameSec={ADMIN_BATTERY_SEC}
      onThermalBatteryDrain={(sec) => {
        let left = 0;
        setBattery((b) => {
          left = Math.max(0, b - sec);
          return left;
        });
        return left;
      }}
      onGameSeconds={() => {}}
      solveLrfHold={() => null}
      onBirdObserved={(info: BirdObservedInfo) => {
        const id = info.placement.perchId;
        if (id) setSelectedId(id);
      }}
      onDone={() => onLeave()}
      initialMode="eyes"
      adminEyesFlagPreview
      opticsRaiseTransitionSec={0}
      showPerchLabels
      onPlacePoint={(pt) => placeAt(pt.x, pt.y)}
      worldOverlay={worldOverlay}
      belowFrame={
        <div className="admin-spot-controls admin-scene-controls">
          <div className="admin-spot-row">
            <label className="admin-spot-field admin-spot-field-wide">
              <span>Last opp nytt</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="admin-spot-field admin-spot-field-wide">
              <span>Åpne scene</span>
              <select
                value={repoImageSrc ?? ""}
                onChange={(e) => {
                  if (e.target.value) loadExisting(e.target.value);
                }}
              >
                <option value="">
                  {repoImageSrc ? spotLabel(repoImageSrc) : "Ny / ulagret…"}
                </option>
                {existingScenes.map((src) => (
                  <option key={src} value={src}>
                    {spotLabel(src)}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-spot-field admin-spot-field-wide">
              <span>Kikkert</span>
              <select
                value={binoId}
                onChange={(e) => setBinoId(e.target.value)}
              >
                <option value="">Ingen</option>
                {lrfItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.brand} {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="admin-spot-field admin-spot-field-wide">
              <span>Termisk</span>
              <select
                value={thermalId}
                onChange={(e) => setThermalId(e.target.value)}
              >
                <option value="">Ingen</option>
                {thermalItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.brand} {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-spot-row">
            <label className="admin-spot-field">
              <span>Tiur</span>
              <select
                value={tiurSpriteId}
                onChange={(e) =>
                  setTiurSpriteId(e.target.value as BirdSpriteId)
                }
              >
                {TIUR_SPRITES.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            <SceneSpriteScaleField spriteId={tiurSpriteId} />
            <label className="admin-spot-field">
              <span>Orre</span>
              <select
                value={orreSpriteId}
                onChange={(e) =>
                  setOrreSpriteId(e.target.value as BirdSpriteId)
                }
              >
                {ORRE_SPRITES.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            <SceneSpriteScaleField spriteId={orreSpriteId} />
          </div>

          <div className="admin-spot-row">
            <label className="admin-spot-field">
              <span>Art</span>
              <select
                value={toolSpecies}
                onChange={(e) => {
                  const v = e.target.value as "tiur" | "orrhane";
                  setToolSpecies(v);
                  setToolSpriteId("");
                  applySelectedFields({ species: v, spriteId: undefined });
                }}
              >
                <option value="tiur">Tiur</option>
                <option value="orrhane">Orre</option>
              </select>
            </label>
            <label className="admin-spot-field admin-spot-scale">
              <span>Fra m</span>
              <input
                type="number"
                className="admin-spot-scale-num"
                min={50}
                max={800}
                value={toolMinM}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setToolMinM(n);
                  applySelectedFields({ distanceMinM: n });
                }}
              />
            </label>
            <label className="admin-spot-field admin-spot-scale">
              <span>Til m</span>
              <input
                type="number"
                className="admin-spot-scale-num"
                min={50}
                max={800}
                value={toolMaxM}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setToolMaxM(n);
                  applySelectedFields({ distanceMaxM: n });
                }}
              />
            </label>
            <label className="admin-spot-field admin-spot-scale">
              <span>Perch %</span>
              <input
                type="number"
                className="admin-spot-scale-num"
                min={PERCH_SCALE_MIN}
                max={PERCH_SCALE_MAX}
                value={toolScale}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setToolScale(n);
                  applySelectedFields({ scalePercent: n });
                }}
              />
            </label>
            <label className="admin-spot-field admin-spot-allow">
              <span>Eyes only</span>
              <span className="admin-spot-allow-row">
                <input
                  type="checkbox"
                  checked={toolEyes}
                  onChange={(e) => {
                    setToolEyes(e.target.checked);
                    applySelectedFields({ eyesVisible: e.target.checked });
                  }}
                />
                <span className="admin-spot-allow-hint">
                  {toolEyes ? "øyne" : "optikk"}
                </span>
              </span>
            </label>
            <label className="admin-spot-field">
              <span>Perch-sprite</span>
              <select
                value={toolSpriteId}
                onChange={(e) => {
                  const v = e.target.value as "" | BirdSpriteId;
                  setToolSpriteId(v);
                  if (!selectedId) return;
                  applySelectedFields(
                    v
                      ? { spriteId: v }
                      : { spriteId: undefined },
                  );
                }}
                aria-label="Tvunget sprite på valgt/ny perch"
              >
                <option value="">Auto (pool)</option>
                {(toolSpecies === "orrhane" ? ORRE_SPRITES : TIUR_SPRITES).map(
                  (id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>

          <div className="admin-spot-row">
            <label className="admin-spot-field">
              <span>Perch</span>
              <select
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(e.target.value || null)}
              >
                <option value="">Ny (F / klikk)…</option>
                {perches.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} · {p.species} · {p.distanceMinM}–{p.distanceMaxM} m
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="intro-button admin-spot-btn"
              disabled={!selectedId}
              onClick={() => setSelectedId(null)}
            >
              Ny perch
            </button>
            <button
              type="button"
              className="intro-button admin-spot-btn"
              disabled={!selectedId}
              onClick={deleteSelected}
            >
              Slett
            </button>
            <button
              type="button"
              className="intro-button admin-spot-btn"
              disabled={!dirty || baking || publishing || perches.length === 0}
              onClick={() => void bakeToRepo()}
            >
              {baking ? "Skriver…" : "Lagre til repo"}
            </button>
            <button
              type="button"
              className="intro-button admin-spot-btn"
              disabled={
                publishing ||
                baking ||
                perches.length === 0 ||
                !imageSrc ||
                !canPublishCloud
              }
              title={
                canPublishCloud
                  ? "Publiser komprimert JPEG + perches til Supabase"
                  : authStatus !== "authenticated"
                    ? "Logg inn med Google først"
                    : "Krever ADMIN_GOOGLE_IDS"
              }
              onClick={() => void publishToCloud()}
            >
              {publishing ? "Publiserer…" : "Publiser til sky"}
            </button>
            <button
              type="button"
              className="intro-button admin-spot-btn"
              disabled={publishing || baking || perches.length === 0 || !imageSrc}
              onClick={() => void exportScenePackage()}
            >
              Eksporter JSON+JPG
            </button>
            <button
              type="button"
              className="intro-button admin-spot-btn"
              disabled={
                syncingRepo ||
                baking ||
                publishing ||
                !canPublishCloud
              }
              title="Kun lokal dev: last ned alle published cloud-scener til batchB/cloud/ + katalog"
              onClick={() => void syncRepoFromCloud()}
            >
              {syncingRepo
                ? "Synker…"
                : "Oppdater spotting-repo fra sky"}
            </button>
          </div>

          <p className="admin-spot-meta">
            {repoImageSrc ? spotLabel(repoImageSrc) : "Ulaget bilde"} ·{" "}
            {perches.length} perch
            {selected
              ? ` · valgt ${selected.id} @ (${selected.x.toFixed(1)}, ${selected.y.toFixed(1)})`
              : " · F/LRF eller klikk (øyne) for ny"}
            {dirty ? " · ulagret" : ""}
          </p>
          {status ? <p className="admin-spot-meta">{status}</p> : null}
        </div>
      }
    />
  );
}
