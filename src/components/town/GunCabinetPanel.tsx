"use client";

import { useMemo, useState } from "react";
import { getShopItem } from "@/lib/shop/catalog";
import {
  GUN_CABINET_SLOT_COUNT,
  gunKitFromParts,
  gunKitIsActive,
  gunKitLabel,
  unassignedGunKitParts,
  type GunKitBinding,
} from "@/lib/gunKit";
import { isZeroVerified, type ZeroingProfile } from "@/lib/player";
import { formatTubeDiameterMm } from "@/lib/mount/spec";
import { isMountItem, isScopeItem, type ShopItem } from "@/lib/shop/types";
import {
  GameChoiceDialog,
  type GameChoiceOption,
} from "@/components/ui/GameChoiceDialog";

type GunCabinetPanelProps = {
  gunKits: GunKitBinding[];
  kit: string[];
  /** Inventory ids with qty > 0. */
  ownedItemIds: ReadonlySet<string>;
  zeroingProfiles: Record<string, ZeroingProfile>;
  /** Snapshot current rifle+scope+mount (+can) into slot. */
  onSaveGunKit: (slot: number) => void;
  /** Activate slot into kit without wiping zeros. */
  onActivateGunKit: (slot: number) => void;
  onClearGunKit: (slot: number) => void;
  /** Assign a chosen rifle+scope+mount to an empty (or overwrite) slot. */
  onAssignGunKit: (binding: GunKitBinding) => void;
};

type PickStep = "rifle" | "scope" | "mount";

type DraftPick = {
  slot: number;
  step: PickStep;
  rifleId: string | null;
  scopeId: string | null;
};

function partLine(id: string): string {
  const item = getShopItem(id);
  if (!item) return id;
  return `${item.brand} ${item.name}`;
}

function itemChoice(item: ShopItem, note?: string): GameChoiceOption {
  return {
    id: item.id,
    label: `${item.brand} ${item.name}`,
    note,
  };
}

function bindingHasVerifiedZero(
  binding: GunKitBinding,
  profiles: Record<string, ZeroingProfile>,
): boolean {
  const prefix = `${binding.rifleId}::${binding.scopeId}::`;
  for (const [key, profile] of Object.entries(profiles)) {
    if (key.startsWith(prefix) && isZeroVerified(profile)) return true;
  }
  return false;
}

function slotOwned(
  binding: GunKitBinding,
  owned: ReadonlySet<string>,
): boolean {
  return (
    owned.has(binding.rifleId) &&
    owned.has(binding.scopeId) &&
    owned.has(binding.mountId) &&
    (binding.suppressorId == null ||
      binding.suppressorId === "" ||
      owned.has(binding.suppressorId))
  );
}

export function GunCabinetPanel({
  gunKits,
  kit,
  ownedItemIds,
  zeroingProfiles,
  onSaveGunKit,
  onActivateGunKit,
  onClearGunKit,
  onAssignGunKit,
}: GunCabinetPanelProps) {
  const bySlot = new Map(gunKits.map((g) => [g.slot, g]));
  const [draft, setDraft] = useState<DraftPick | null>(null);

  const available = useMemo(() => {
    if (!draft) return null;
    return unassignedGunKitParts(ownedItemIds, gunKits, {
      exceptSlot: draft.slot,
      forScopeId: draft.step === "mount" ? draft.scopeId : null,
    });
  }, [draft, ownedItemIds, gunKits]);

  function startPick(slot: number) {
    setDraft({
      slot,
      step: "rifle",
      rifleId: null,
      scopeId: null,
    });
  }

  function cancelPick() {
    setDraft(null);
  }

  function onChoosePart(id: string | null) {
    if (!draft || id == null) {
      cancelPick();
      return;
    }
    if (draft.step === "rifle") {
      setDraft({
        ...draft,
        step: "scope",
        rifleId: id,
        scopeId: null,
      });
      return;
    }
    if (draft.step === "scope") {
      setDraft({
        ...draft,
        step: "mount",
        scopeId: id,
      });
      return;
    }
    // mount
    if (!draft.rifleId || !draft.scopeId) {
      cancelPick();
      return;
    }
    const binding = gunKitFromParts(draft.slot, {
      rifleId: draft.rifleId,
      scopeId: draft.scopeId,
      mountId: id,
    });
    setDraft(null);
    if (binding) onAssignGunKit(binding);
  }

  const pickChoices: GameChoiceOption[] = (() => {
    if (!draft || !available) return [];
    if (draft.step === "rifle") {
      return available.rifles.map((r) => itemChoice(r, "Våpen"));
    }
    if (draft.step === "scope") {
      return available.scopes.map((s) =>
        itemChoice(
          s,
          isScopeItem(s)
            ? `Rør ${formatTubeDiameterMm(s.scope.tubeDiameterMm)}`
            : undefined,
        ),
      );
    }
    return available.mounts.map((m) =>
      itemChoice(
        m,
        isMountItem(m)
          ? `Rør ${formatTubeDiameterMm(m.mount.tubeDiameterMm)}`
          : undefined,
      ),
    );
  })();

  const pickTitle =
    draft?.step === "rifle"
      ? `Velg våpen — ${gunKitLabel(draft.slot)}`
      : draft?.step === "scope"
        ? `Velg kikkert — ${gunKitLabel(draft.slot)}`
        : draft
          ? `Velg montasje — ${gunKitLabel(draft.slot)}`
          : "";

  const pickMessage =
    draft?.step === "rifle"
      ? "Kun våpen som ikke allerede ligger i et annet gun-kit."
      : draft?.step === "scope"
        ? draft.rifleId
          ? `Våpen: ${partLine(draft.rifleId)}. Velg ledig kikkert.`
          : "Velg kikkert."
        : draft?.scopeId
          ? `Kikkert: ${partLine(draft.scopeId)}. Velg montasje som matcher rørdiameter.`
          : "Velg montasje.";

  const hasUnassignedRifle = useMemo(() => {
    const parts = unassignedGunKitParts(ownedItemIds, gunKits);
    return parts.rifles.length > 0;
  }, [ownedItemIds, gunKits]);

  return (
    <div className="gun-cabinet" aria-label="Våpenskap">
      <p className="shop-row-note current-rig-inline-note">
        Våpenskap — lagre våpen + kikkert + montasje som Gun kit 1–
        {GUN_CABINET_SLOT_COUNT}. Bytt mellom plattformer uten å skyte inn på
        nytt (zero følger rifle×kikkert×ammo).
      </p>
      <ul className="gun-cabinet-list">
        {Array.from({ length: GUN_CABINET_SLOT_COUNT }, (_, i) => {
          const slot = i + 1;
          const binding = bySlot.get(slot) ?? null;
          const active = binding ? gunKitIsActive(binding, kit) : false;
          const owned = binding ? slotOwned(binding, ownedItemIds) : false;
          const verified = binding
            ? bindingHasVerifiedZero(binding, zeroingProfiles)
            : false;
          return (
            <li
              key={slot}
              className={
                active
                  ? "gun-cabinet-slot is-active"
                  : binding
                    ? "gun-cabinet-slot"
                    : "gun-cabinet-slot is-empty"
              }
            >
              <div className="gun-cabinet-slot-head">
                <strong>{gunKitLabel(slot)}</strong>
                {active ? (
                  <span className="gun-cabinet-badge">Aktiv</span>
                ) : null}
                {verified ? (
                  <span className="gun-cabinet-badge is-zero">Innskutt</span>
                ) : null}
              </div>
              {binding ? (
                <div className="gun-cabinet-parts">
                  <span>Våpen: {partLine(binding.rifleId)}</span>
                  <span>Kikkert: {partLine(binding.scopeId)}</span>
                  <span>Montasje: {partLine(binding.mountId)}</span>
                  {binding.suppressorId ? (
                    <span>Lyddemper: {partLine(binding.suppressorId)}</span>
                  ) : (
                    <span className="gun-cabinet-muted">Uten lyddemper</span>
                  )}
                  {!owned ? (
                    <span className="gun-cabinet-warn">
                      Mangler deler i inventory
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="shop-row-note">Tom plass</p>
              )}
              <div className="gun-cabinet-actions">
                {!binding ? (
                  <button
                    type="button"
                    className="intro-button shop-buy"
                    disabled={!hasUnassignedRifle}
                    onClick={() => startPick(slot)}
                    title="Velg ledig våpen + kikkert + montasje"
                  >
                    Velg
                  </button>
                ) : null}
                <button
                  type="button"
                  className="intro-button shop-buy"
                  onClick={() => onSaveGunKit(slot)}
                  title="Lagre current rifle + kikkert + montasje her"
                >
                  {binding ? "Overskriv" : "Lagre current"}
                </button>
                <button
                  type="button"
                  className={
                    active
                      ? "intro-button shop-buy kit-equipped"
                      : "intro-button shop-buy"
                  }
                  disabled={!binding || !owned || active}
                  onClick={() => onActivateGunKit(slot)}
                >
                  {active ? "I kit" : "Aktiver"}
                </button>
                <button
                  type="button"
                  className="intro-button shop-buy sheriff-secondary"
                  disabled={!binding}
                  onClick={() => onClearGunKit(slot)}
                >
                  Tøm
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {draft ? (
        <GameChoiceDialog
          title={pickTitle}
          message={pickMessage}
          choices={pickChoices}
          allowClear={false}
          emptyLabel={
            draft.step === "rifle"
              ? "Ingen ledige våpen — alt er allerede i våpenskapet, eller inventory er tomt."
              : draft.step === "scope"
                ? "Ingen ledige kikkerter."
                : "Ingen ledig montasje som matcher kikkert-røret."
          }
          onChoose={onChoosePart}
          onCancel={cancelPick}
        />
      ) : null}
    </div>
  );
}
