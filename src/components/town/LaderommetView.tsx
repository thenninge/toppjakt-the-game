"use client";

import { useEffect, useMemo, useState } from "react";
import { LocationNav } from "@/components/town/LocationNav";
import { LoadDevV0Chart } from "@/components/town/LoadDevV0Chart";
import { GameChoiceDialog } from "@/components/ui/GameChoiceDialog";
import {
  getInventoryQty,
  type InventoryEntry,
} from "@/lib/player";
import {
  brassItemCaliberKey,
  bulletFitsCaliber,
  dieQualityScore,
  dieSetCaliberKey,
  isBrassItem,
  isBulletItem,
  isDieSetItem,
  isPowderItem,
  isPrimerItem,
  LOAD_CALIBER_OPTIONS,
} from "@/lib/reloading/components";
import type { SpentBrassKey } from "@/lib/reloading/brass";
import type { LoadBenchRecipe } from "@/lib/reloading/recipe";
import {
  createLoadDevRowFromRecipe,
  deriveFromCol,
  patchLoadDevRow,
  removeLoadDevRow,
  upsertLoadDevRow,
  type LoadDevRow,
  type LoadDevTable,
} from "@/lib/reloading/loadDevTable";
import {
  buildLoadBookEntry,
  upsertLoadBookEntry,
  type LoadBookEntry,
} from "@/lib/reloading/loadBook";
import {
  estimateLoadPlanFromDevRow,
  formatKaboomChancePct,
  parseBulletWeightGrains,
  type ArmedLoadPlan,
} from "@/lib/reloading/loadPhysics";
import { getShopItem } from "@/lib/shop/catalog";
import type { ShopItem } from "@/lib/shop/types";
import { LadebokView } from "@/components/town/LadebokView";

type OwnedRow = { item: ShopItem; qty: number };

type PickField =
  | "caliber"
  | "sizingDie"
  | "seatingDie"
  | "brass"
  | "primer"
  | "powder"
  | "bullet"
  | null;

type RowPick =
  | { rowId: string; field: "powder" | "bullet" | "primer" }
  | null;

type LaderommetViewProps = {
  inventory: InventoryEntry[];
  recipe: LoadBenchRecipe;
  loadDevTable: LoadDevTable;
  loadBook: LoadBookEntry[];
  armedLoadPlan: ArmedLoadPlan | null;
  onChangeRecipe: (next: LoadBenchRecipe) => void;
  onChangeLoadDevTable: (next: LoadDevTable) => void;
  onChangeLoadBook: (next: LoadBookEntry[]) => void;
  onArmLoadPlan: (plan: ArmedLoadPlan) => void;
  onDisarmLoadPlan: () => void;
  onBack: () => void;
};

function ownedOf(
  inventory: InventoryEntry[],
  pred: (item: ShopItem) => boolean,
): OwnedRow[] {
  const rows: OwnedRow[] = [];
  for (const entry of inventory) {
    if (entry.qty <= 0) continue;
    const item = getShopItem(entry.itemId);
    if (!item || !pred(item)) continue;
    rows.push({ item, qty: entry.qty });
  }
  rows.sort(
    (a, b) =>
      a.item.brand.localeCompare(b.item.brand) ||
      a.item.name.localeCompare(b.item.name) ||
      a.item.priceNok - b.item.priceNok,
  );
  return rows;
}

function dieLabel(item: ShopItem): string {
  const q = dieQualityScore(item.priceNok);
  return `${item.brand} ${item.name} · kvalitet ${q.toFixed(1)}/10`;
}

function stockLabel(row: OwnedRow): string {
  const unit = row.item.unitLabel ?? "stk";
  return `${row.item.brand} ${row.item.name} (${row.qty} · ${unit})`;
}

function itemSummary(itemId: string | null, fallback: string): string {
  if (!itemId) return fallback;
  const item = getShopItem(itemId);
  if (!item) return fallback;
  return `${item.brand} ${item.name}`;
}

function shortItem(itemId: string | null): string {
  if (!itemId) return "—";
  const item = getShopItem(itemId);
  if (!item) return "—";
  return item.name.length > 18 ? `${item.name.slice(0, 16)}…` : item.name;
}

function bulletLabel(itemId: string | null): string {
  if (!itemId) return "—";
  const item = getShopItem(itemId);
  if (!item) return "—";
  const gr = parseBulletWeightGrains(item);
  const name =
    item.name.length > 14 ? `${item.name.slice(0, 12)}…` : item.name;
  return gr != null ? `${name} · ${gr} gr` : name;
}

export function LaderommetView({
  inventory,
  recipe,
  loadDevTable,
  loadBook,
  armedLoadPlan,
  onChangeRecipe,
  onChangeLoadDevTable,
  onChangeLoadBook,
  onArmLoadPlan,
  onDisarmLoadPlan,
  onBack,
}: LaderommetViewProps) {
  const [pick, setPick] = useState<PickField>(null);
  const [rowPick, setRowPick] = useState<RowPick>(null);
  const [tab, setTab] = useState<"plan" | "bok">("plan");

  const patch = (partial: Partial<LoadBenchRecipe>) => {
    onChangeRecipe({ ...recipe, ...partial, annealing: false });
  };

  const dies = useMemo(
    () =>
      ownedOf(inventory, (item) => {
        if (!isDieSetItem(item)) return false;
        return dieSetCaliberKey(item) === recipe.caliberKey;
      }),
    [inventory, recipe.caliberKey],
  );

  const brass = useMemo(
    () =>
      ownedOf(inventory, (item) => {
        if (!isBrassItem(item)) return false;
        return brassItemCaliberKey(item) === recipe.caliberKey;
      }),
    [inventory, recipe.caliberKey],
  );

  const primers = useMemo(
    () => ownedOf(inventory, isPrimerItem),
    [inventory],
  );

  const powders = useMemo(
    () => ownedOf(inventory, isPowderItem),
    [inventory],
  );

  const bullets = useMemo(
    () =>
      ownedOf(inventory, (item) => {
        if (!isBulletItem(item)) return false;
        return bulletFitsCaliber(item, recipe.caliberKey);
      }),
    [inventory, recipe.caliberKey],
  );

  // Drop stale powder picks (e.g. funnel/scale left from old classifier).
  useEffect(() => {
    if (!recipe.powderItemId) return;
    const item = getShopItem(recipe.powderItemId);
    if (item && isPowderItem(item)) return;
    onChangeRecipe({
      ...recipe,
      powderItemId: null,
      annealing: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe.powderItemId]);

  const setCaliber = (caliberKey: SpentBrassKey) => {
    const opt = LOAD_CALIBER_OPTIONS.find((o) => o.key === caliberKey);
    const nextDies = ownedOf(inventory, (item) => {
      if (!isDieSetItem(item)) return false;
      return dieSetCaliberKey(item) === caliberKey;
    });
    const nextBrass = ownedOf(inventory, (item) => {
      if (!isBrassItem(item)) return false;
      return brassItemCaliberKey(item) === caliberKey;
    });
    const nextBullets = ownedOf(inventory, (item) => {
      if (!isBulletItem(item)) return false;
      return bulletFitsCaliber(item, caliberKey);
    });
    const keepSizing =
      recipe.sizingDieId &&
      nextDies.some((r) => r.item.id === recipe.sizingDieId)
        ? recipe.sizingDieId
        : null;
    const keepSeating =
      recipe.seatingDieId &&
      nextDies.some((r) => r.item.id === recipe.seatingDieId)
        ? recipe.seatingDieId
        : null;
    const keepBrass =
      recipe.brassItemId &&
      nextBrass.some((r) => r.item.id === recipe.brassItemId)
        ? recipe.brassItemId
        : null;
    const keepBullet =
      recipe.bulletItemId &&
      nextBullets.some((r) => r.item.id === recipe.bulletItemId)
        ? recipe.bulletItemId
        : null;

    onChangeRecipe({
      ...recipe,
      caliberKey,
      powderGrains: opt?.defaultPowderGrains ?? recipe.powderGrains,
      sizingDieId: keepSizing,
      seatingDieId: keepSeating,
      brassItemId: keepBrass,
      bulletItemId: keepBullet,
      annealing: false,
    });
  };

  const hasAnyComponents =
    dies.length > 0 ||
    brass.length > 0 ||
    primers.length > 0 ||
    powders.length > 0 ||
    bullets.length > 0;

  const caliberLabel =
    LOAD_CALIBER_OPTIONS.find((o) => o.key === recipe.caliberKey)?.label ??
    recipe.caliberKey;

  const sortedRows = useMemo(
    () =>
      [...loadDevTable.rows].sort((a, b) => a.powderGrains - b.powderGrains),
    [loadDevTable.rows],
  );

  function addRow(grainsDelta = 0) {
    const last = sortedRows[sortedRows.length - 1];
    const baseGrains = last?.powderGrains ?? recipe.powderGrains;
    const baseRecipe: LoadBenchRecipe = {
      ...recipe,
      powderItemId: last?.powderItemId ?? recipe.powderItemId,
      bulletItemId: last?.bulletItemId ?? recipe.bulletItemId,
      primerItemId: last?.primerItemId ?? recipe.primerItemId,
      powderGrains: Math.round((baseGrains + grainsDelta) * 10) / 10,
      seatingDepthThou: last
        ? deriveFromCol(recipe.caliberKey, last.colMm).seatingDepthThou
        : recipe.seatingDepthThou,
    };
    const row = createLoadDevRowFromRecipe(baseRecipe, {
      powderGrains: baseRecipe.powderGrains,
      shotsLoaded: last?.shotsLoaded ?? 5,
    });
    if (last) row.colMm = last.colMm;
    onChangeLoadDevTable(upsertLoadDevRow(loadDevTable, row));
  }

  function updateRow(rowId: string, patch: Partial<LoadDevRow>) {
    onChangeLoadDevTable(patchLoadDevRow(loadDevTable, rowId, patch));
  }

  function saveRowToBook(row: LoadDevRow) {
    const entry = buildLoadBookEntry({
      caliberKey: recipe.caliberKey,
      row,
      brassItemId: recipe.brassItemId,
    });
    onChangeLoadBook(upsertLoadBookEntry(loadBook, entry));
  }

  function armRow(row: LoadDevRow) {
    const powder = row.powderItemId
      ? getShopItem(row.powderItemId)
      : null;
    const bullet = row.bulletItemId
      ? getShopItem(row.bulletItemId)
      : null;
    if (!powder || !bullet) return;
    const est = estimateLoadPlanFromDevRow(recipe.caliberKey, row, {
      powder,
      bullet,
    });
    const seating = deriveFromCol(recipe.caliberKey, row.colMm);
    saveRowToBook(row);
    onArmLoadPlan({
      caliberKey: recipe.caliberKey,
      pressurePct: est.pressurePct,
      overpressurePct: est.overpressurePct,
      kaboomChance: est.kaboomChance,
      v0Mps: est.v0Mps,
      powderGrains: row.powderGrains,
      seatingDepthThou: seating.seatingDepthThou,
      colMm: est.colMm,
      armedAtMs: Date.now(),
      loadDevRowId: row.id,
    });
  }

  const pickDialog = (() => {
    if (!pick) return null;
    if (pick === "caliber") {
      return (
        <GameChoiceDialog
          title="Velg kaliber"
          message="Hvilket kaliber lader du til?"
          choices={LOAD_CALIBER_OPTIONS.map((o) => ({
            id: o.key,
            label: o.label,
            note: `Standard kruttvekt ~${o.defaultPowderGrains} gr`,
          }))}
          selectedId={recipe.caliberKey}
          allowClear={false}
          onChoose={(id) => {
            if (id) setCaliber(id as SpentBrassKey);
            setPick(null);
          }}
          onCancel={() => setPick(null)}
        />
      );
    }
    if (pick === "sizingDie") {
      return (
        <GameChoiceDialog
          title="Sizing die"
          message="Dyrere dies gir jevnere hylser og bedre grupper."
          choices={dies.map(({ item }) => ({
            id: item.id,
            label: dieLabel(item),
            note: item.note,
          }))}
          selectedId={recipe.sizingDieId}
          emptyLabel="Ingen dies for dette kaliberet — kjøp på XXL."
          onChoose={(id) => {
            patch({ sizingDieId: id });
            setPick(null);
          }}
          onCancel={() => setPick(null)}
        />
      );
    }
    if (pick === "seatingDie") {
      return (
        <GameChoiceDialog
          title="Seating die"
          message="Samme die-sett kan brukes til seating. Kvalitet teller."
          choices={dies.map(({ item }) => ({
            id: item.id,
            label: dieLabel(item),
            note: item.note,
          }))}
          selectedId={recipe.seatingDieId}
          emptyLabel="Ingen dies for dette kaliberet — kjøp på XXL."
          onChoose={(id) => {
            patch({ seatingDieId: id });
            setPick(null);
          }}
          onCancel={() => setPick(null)}
        />
      );
    }
    if (pick === "brass") {
      return (
        <GameChoiceDialog
          title="Hylse"
          message="Nye hylser fra XXL, eller felthylser etter skudd (merke følger ammo)."
          choices={brass.map((row) => ({
            id: row.item.id,
            label: stockLabel(row),
            note: row.item.note,
          }))}
          selectedId={recipe.brassItemId}
          emptyLabel="Ingen hylser for kaliberet — kjøp nye eller skytt mer."
          onChoose={(id) => {
            patch({ brassItemId: id });
            setPick(null);
          }}
          onCancel={() => setPick(null)}
        />
      );
    }
    if (pick === "primer") {
      return (
        <GameChoiceDialog
          title="Primer"
          message="CCI, Federal m.fl. — velg tennhette fra inventory."
          choices={primers.map((row) => ({
            id: row.item.id,
            label: stockLabel(row),
            note: row.item.note,
          }))}
          selectedId={recipe.primerItemId}
          emptyLabel="Ingen primers — kjøp på XXL."
          onChoose={(id) => {
            patch({ primerItemId: id });
            setPick(null);
          }}
          onCancel={() => setPick(null)}
        />
      );
    }
    if (pick === "powder") {
      return (
        <GameChoiceDialog
          title="Krutt"
          message="Kun krutt-type (N140, Varget, 203-B …). Vekt og trakt brukes automatisk for nå."
          choices={powders.map((row) => ({
            id: row.item.id,
            label: stockLabel(row),
            note: row.item.note,
          }))}
          selectedId={recipe.powderItemId}
          emptyLabel="Ingen krutt i inventory — kjøp på XXL."
          onChoose={(id) => {
            patch({ powderItemId: id });
            setPick(null);
          }}
          onCancel={() => setPick(null)}
        />
      );
    }
    if (pick === "bullet") {
      return (
        <GameChoiceDialog
          title="Kule"
          message="Match/jaktkuler som passer kaliberet."
          choices={bullets.map((row) => ({
            id: row.item.id,
            label: stockLabel(row),
            note: row.item.note,
          }))}
          selectedId={recipe.bulletItemId}
          emptyLabel="Ingen kuler for kaliberet — kjøp på XXL."
          onChoose={(id) => {
            patch({ bulletItemId: id });
            setPick(null);
          }}
          onCancel={() => setPick(null)}
        />
      );
    }
    return null;
  })();

  const rowPickDialog = (() => {
    if (!rowPick) return null;
    if (rowPick.field === "powder") {
      return (
        <GameChoiceDialog
          title="Krutt (rad)"
          message="Velg krutttype for denne testladen."
          choices={powders.map((row) => ({
            id: row.item.id,
            label: stockLabel(row),
            note: row.item.note,
          }))}
          selectedId={
            loadDevTable.rows.find((r) => r.id === rowPick.rowId)
              ?.powderItemId ?? null
          }
          emptyLabel="Ingen krutt i inventory."
          onChoose={(id) => {
            updateRow(rowPick.rowId, { powderItemId: id });
            setRowPick(null);
          }}
          onCancel={() => setRowPick(null)}
        />
      );
    }
    if (rowPick.field === "bullet") {
      return (
        <GameChoiceDialog
          title="Kule (rad)"
          message="Type og vekt følger katalog."
          choices={bullets.map((row) => ({
            id: row.item.id,
            label: stockLabel(row),
            note: row.item.note,
          }))}
          selectedId={
            loadDevTable.rows.find((r) => r.id === rowPick.rowId)
              ?.bulletItemId ?? null
          }
          emptyLabel="Ingen kuler for kaliberet."
          onChoose={(id) => {
            updateRow(rowPick.rowId, { bulletItemId: id });
            setRowPick(null);
          }}
          onCancel={() => setRowPick(null)}
        />
      );
    }
    return (
      <GameChoiceDialog
        title="Tennhette (rad)"
        message="Velg primer for denne raden."
        choices={primers.map((row) => ({
          id: row.item.id,
          label: stockLabel(row),
          note: row.item.note,
        }))}
        selectedId={
          loadDevTable.rows.find((r) => r.id === rowPick.rowId)
            ?.primerItemId ?? null
        }
        emptyLabel="Ingen primers."
        onChoose={(id) => {
          updateRow(rowPick.rowId, { primerItemId: id });
          setRowPick(null);
        }}
        onCancel={() => setRowPick(null)}
      />
    );
  })();

  return (
    <div className="laderommet">
      <LocationNav
        onBackToTown={onBack}
        backLabel="← Tilbake til hjem"
        hint="Fyll ladeplanen, test på banen — v₀ og samling skrives inn etter målt serie."
      />

      <header className="shop-header">
        <p className="intro-line intro-gift">Laderommet</p>
        <p className="intro-line">
          Ladeplan for testing · ladebok for gamle oppskrifter. Høy ladning kan
          sprenge våpenet.
        </p>
      </header>

      <div
        className="home-data-tabs"
        role="tablist"
        aria-label="Ladeplan eller ladebok"
      >
        <button
          type="button"
          role="tab"
          aria-selected={tab === "plan"}
          className={
            tab === "plan" ? "home-data-tab is-active" : "home-data-tab"
          }
          onClick={() => setTab("plan")}
        >
          Ladeplan ({loadDevTable.rows.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "bok"}
          className={
            tab === "bok" ? "home-data-tab is-active" : "home-data-tab"
          }
          onClick={() => setTab("bok")}
        >
          Ladebok ({loadBook.length})
        </button>
      </div>

      {tab === "bok" ? (
        <LadebokView
          book={loadBook}
          onChangeBook={onChangeLoadBook}
          onRestoreToPlan={(row, caliberKey) => {
            if (caliberKey !== recipe.caliberKey) {
              setCaliber(caliberKey);
            }
            onChangeLoadDevTable(upsertLoadDevRow(loadDevTable, row));
            setTab("plan");
          }}
        />
      ) : (
        <>
      {!hasAnyComponents ? (
        <p className="shop-row-note">
          Ingen hjemmeladingskomponenter i inventory ennå. Kjøp dies, hylser,
          primer, krutt og kuler på XXL — eller samle felthylser ved å skyte.
        </p>
      ) : null}

      <div className="laderommet-form">
        <label className="sheriff-field">
          Kaliber
          <button
            type="button"
            className="intro-button laderommet-pick"
            onClick={() => setPick("caliber")}
          >
            {caliberLabel}
          </button>
        </label>

        <label className="sheriff-field">
          Sizing die
          <button
            type="button"
            className="intro-button laderommet-pick"
            onClick={() => setPick("sizingDie")}
          >
            {itemSummary(recipe.sizingDieId, "— Velg die —")}
          </button>
        </label>

        <label className="sheriff-field">
          Seating die
          <button
            type="button"
            className="intro-button laderommet-pick"
            onClick={() => setPick("seatingDie")}
          >
            {itemSummary(recipe.seatingDieId, "— Velg die —")}
          </button>
        </label>

        <label className="sheriff-field">
          Hylse
          <button
            type="button"
            className="intro-button laderommet-pick"
            onClick={() => setPick("brass")}
          >
            {itemSummary(recipe.brassItemId, "— Velg hylse —")}
          </button>
        </label>

        <label className="sheriff-field">
          Standard primer
          <button
            type="button"
            className="intro-button laderommet-pick"
            onClick={() => setPick("primer")}
          >
            {itemSummary(recipe.primerItemId, "— Velg primer —")}
          </button>
        </label>

        <label className="sheriff-field">
          Standard krutt
          <button
            type="button"
            className="intro-button laderommet-pick"
            onClick={() => setPick("powder")}
          >
            {itemSummary(recipe.powderItemId, "— Velg krutt —")}
          </button>
        </label>

        <label className="sheriff-field">
          Standard kule
          <button
            type="button"
            className="intro-button laderommet-pick"
            onClick={() => setPick("bullet")}
          >
            {itemSummary(recipe.bulletItemId, "— Velg kule —")}
          </button>
        </label>

        <label className="sheriff-field laderommet-anneal">
          <span className="laderommet-anneal-row">
            <input type="checkbox" checked={false} disabled />
            Anealing
          </span>
          <span className="shop-row-note">Kommer senere — disabled for nå.</span>
        </label>
      </div>

      <section className="laderommet-plan" aria-label="Ladeplan">
        <p className="intro-line intro-gift">Ladeplan</p>
        <p className="shop-row-note">
          Fyll antall skudd, krutt, vekt, kule, tennhette og COL. Seating/friflukt
          regnes fra COL. Est. v₀ / trykk / spreng oppdateres live. Målt v₀ og
          samling fylles etter serie på banen. Over 5 % overtrykk: sprengfare pr.
          skudd mens testladning er aktiv.
        </p>

        <div className="laderommet-plan-actions">
          <button
            type="button"
            className="intro-button"
            onClick={() => addRow(0)}
          >
            Legg til rad
          </button>
          <button
            type="button"
            className="intro-button sheriff-secondary"
            disabled={sortedRows.length === 0}
            onClick={() => addRow(0.5)}
            title="Ny rad med +0,5 gr krutt"
          >
            +0,5 gr steg
          </button>
          {armedLoadPlan ? (
            <button
              type="button"
              className="intro-button sheriff-secondary"
              onClick={onDisarmLoadPlan}
            >
              Avslutt testladning
            </button>
          ) : null}
        </div>

        {armedLoadPlan ? (
          <p className="shop-row-note laderommet-plan-armed">
            Aktiv testladning: {armedLoadPlan.powderGrains.toFixed(1)} gr · COL{" "}
            {armedLoadPlan.colMm.toFixed(1)} mm · trykk{" "}
            {armedLoadPlan.pressurePct.toFixed(1)} % · est. v₀{" "}
            {armedLoadPlan.v0Mps} m/s · sprengfare{" "}
            <span
              className={
                armedLoadPlan.kaboomChance > 0
                  ? "laderommet-plan-danger"
                  : undefined
              }
            >
              {formatKaboomChancePct(armedLoadPlan.kaboomChance)}
            </span>{" "}
            pr. skudd. Mål serie på banen for målt v₀ / samling (skrives til
            ladebok).
          </p>
        ) : null}

        {sortedRows.length === 0 ? (
          <p className="shop-row-note">
            Ingen rader ennå. Sett standard komponenter over, deretter «Legg til
            rad» for første charge.
          </p>
        ) : (
          <div className="load-dev-table-wrap">
            <table className="load-dev-table">
              <thead>
                <tr>
                  <th scope="col">n</th>
                  <th scope="col">Krutt</th>
                  <th scope="col">gr</th>
                  <th scope="col">Kule</th>
                  <th scope="col">Primer</th>
                  <th scope="col">COL</th>
                  <th scope="col">Seat</th>
                  <th scope="col">Friflukt</th>
                  <th scope="col">Est. v₀</th>
                  <th scope="col">Trykk</th>
                  <th scope="col">Spreng</th>
                  <th scope="col">Avg v₀</th>
                  <th scope="col">Min</th>
                  <th scope="col">Max</th>
                  <th scope="col">SD</th>
                  <th scope="col">Samling</th>
                  <th scope="col"> </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => {
                  const derived = deriveFromCol(recipe.caliberKey, row.colMm);
                  const powder = row.powderItemId
                    ? getShopItem(row.powderItemId)
                    : null;
                  const bullet = row.bulletItemId
                    ? getShopItem(row.bulletItemId)
                    : null;
                  const est =
                    powder && bullet
                      ? estimateLoadPlanFromDevRow(recipe.caliberKey, row, {
                          powder,
                          bullet,
                        })
                      : null;
                  const isActive =
                    armedLoadPlan?.loadDevRowId === row.id ||
                    loadDevTable.activeRowId === row.id;
                  const canArm = !!row.powderItemId && !!row.bulletItemId;
                  return (
                    <tr
                      key={row.id}
                      className={isActive ? "is-active-load" : undefined}
                    >
                      <td>
                        <input
                          className="intro-input load-dev-input"
                          type="number"
                          min={1}
                          max={50}
                          step={1}
                          value={row.shotsLoaded}
                          onChange={(e) => {
                            const v = Number.parseInt(e.target.value, 10);
                            if (!Number.isFinite(v)) return;
                            updateRow(row.id, {
                              shotsLoaded: Math.max(1, Math.min(50, v)),
                            });
                          }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="intro-button sheriff-secondary load-dev-cell-btn"
                          onClick={() =>
                            setRowPick({ rowId: row.id, field: "powder" })
                          }
                        >
                          {shortItem(row.powderItemId)}
                        </button>
                      </td>
                      <td>
                        <input
                          className="intro-input load-dev-input"
                          type="number"
                          min={0}
                          max={120}
                          step={0.1}
                          value={row.powderGrains}
                          onChange={(e) => {
                            const v = Number.parseFloat(e.target.value);
                            if (!Number.isFinite(v)) return;
                            updateRow(row.id, {
                              powderGrains: Math.max(0, Math.min(120, v)),
                            });
                          }}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="intro-button sheriff-secondary load-dev-cell-btn"
                          onClick={() =>
                            setRowPick({ rowId: row.id, field: "bullet" })
                          }
                        >
                          {bulletLabel(row.bulletItemId)}
                        </button>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="intro-button sheriff-secondary load-dev-cell-btn"
                          onClick={() =>
                            setRowPick({ rowId: row.id, field: "primer" })
                          }
                        >
                          {shortItem(row.primerItemId)}
                        </button>
                      </td>
                      <td>
                        <input
                          className="intro-input load-dev-input"
                          type="number"
                          min={20}
                          max={120}
                          step={0.1}
                          value={row.colMm}
                          onChange={(e) => {
                            const v = Number.parseFloat(e.target.value);
                            if (!Number.isFinite(v)) return;
                            updateRow(row.id, {
                              colMm: Math.max(20, Math.min(120, v)),
                            });
                          }}
                        />
                      </td>
                      <td className="load-dev-derived">
                        {derived.seatingDepthThou}
                      </td>
                      <td className="load-dev-derived">
                        {derived.frifluktThou}
                      </td>
                      <td className="load-dev-derived">
                        {est ? `${est.v0Mps}` : "—"}
                      </td>
                      <td
                        className={
                          est && est.pressurePct > 105
                            ? "laderommet-plan-danger"
                            : est && est.isOverpressure
                              ? "laderommet-plan-warn"
                              : "load-dev-derived"
                        }
                      >
                        {est ? `${est.pressurePct.toFixed(1)}%` : "—"}
                      </td>
                      <td
                        className={
                          est && est.kaboomChance > 0
                            ? "laderommet-plan-danger"
                            : "load-dev-derived"
                        }
                        title={
                          est && est.kaboomChance > 0
                            ? "Sannsynlighet for våpenspreng pr. skudd mens test er aktiv"
                            : undefined
                        }
                      >
                        {est ? formatKaboomChancePct(est.kaboomChance) : "—"}
                      </td>
                      <td className="load-dev-measured">
                        {row.measuredV0Mps != null
                          ? `${row.measuredV0Mps.toFixed(1)}`
                          : "—"}
                      </td>
                      <td className="load-dev-measured">
                        {row.measuredV0LowMps != null
                          ? row.measuredV0LowMps.toFixed(1)
                          : "—"}
                      </td>
                      <td className="load-dev-measured">
                        {row.measuredV0HighMps != null
                          ? row.measuredV0HighMps.toFixed(1)
                          : "—"}
                      </td>
                      <td className="load-dev-measured">
                        {row.measuredV0StdevMps != null
                          ? row.measuredV0StdevMps.toFixed(2)
                          : "—"}
                      </td>
                      <td className="load-dev-measured">
                        {row.measuredGroupMoa != null
                          ? `${row.measuredGroupMoa.toFixed(2)}″`
                          : "—"}
                      </td>
                      <td className="load-dev-row-actions">
                        <button
                          type="button"
                          className="intro-button"
                          disabled={!canArm || isActive}
                          title={
                            canArm
                              ? est && est.kaboomChance > 0
                                ? `Test på banen — sprengfare ${formatKaboomChancePct(est.kaboomChance)} pr. skudd`
                                : "Test denne laden på skytebanen (lagres i ladebok)"
                              : "Velg krutt og kule først"
                          }
                          onClick={() => armRow(row)}
                        >
                          {isActive ? "Aktiv" : "Test"}
                        </button>
                        <button
                          type="button"
                          className="intro-button sheriff-secondary"
                          disabled={!canArm}
                          title="Lagre i ladebok uten å aktivere test"
                          onClick={() => saveRowToBook(row)}
                        >
                          Bok
                        </button>
                        <button
                          type="button"
                          className="intro-button sheriff-secondary"
                          onClick={() =>
                            onChangeLoadDevTable(
                              removeLoadDevRow(loadDevTable, row.id),
                            )
                          }
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="load-dev-chart-block">
          <p className="intro-line intro-gift">v₀ mot kruttvekt</p>
          <p className="shop-row-note">
            Kurven er sjelden helt lineær. Noder der +0,5 gr nesten ikke øker
            v₀ er ofte et godt tegn.
          </p>
          <LoadDevV0Chart rows={loadDevTable.rows} />
        </div>
      </section>

      <p className="shop-row-note laderommet-stock-hint">
        {recipe.brassItemId
          ? `Valgt hylse på lager: ${getInventoryQty(inventory, recipe.brassItemId)}`
          : "Velg hylse for å se beholdning."}
      </p>
        </>
      )}

      <button type="button" className="intro-button" onClick={onBack}>
        Tilbake
      </button>

      {pickDialog}
      {rowPickDialog}
    </div>
  );
}
