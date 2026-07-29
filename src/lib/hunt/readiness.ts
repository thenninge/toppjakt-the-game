import {
  getInventoryQty,
  isZeroVerified,
  zeroingKey,
  type InventoryEntry,
  type ZeroingProfile,
} from "@/lib/player";
import {
  isAmmoItem,
  isBackpackItem,
  isMiscItem,
  isMountItem,
  isRifleItem,
  isScopeItem,
  type ShopItem,
} from "@/lib/shop/types";
import { formatTubeDiameterMm, type ScopeTubeDiameterMm } from "@/lib/mount/spec";
import { isCamcorderMisc, isCamcorderTripodMisc } from "@/lib/misc/spec";
import { getHuntingTerrain } from "@/lib/hunt/terrain";
import { getHuntMap } from "@/lib/hunt/maps";
import type { JaktkortBook } from "@/lib/hunt/jaktkort";
import { getJaktkortForTerrain } from "@/lib/hunt/jaktkort";
import { isJegerproveCleared } from "@/lib/jegerprove/exam";

export type HuntReadyResult = {
  ok: boolean;
  /** Human-readable blockers for UI. */
  blockers: string[];
};

/**
 * At least one packed ammo (with rounds left) must have a verified zero
 * for the current rifle + scope combo.
 */
export function kitHasVerifiedHuntZero(input: {
  kitItems: ShopItem[];
  inventory: InventoryEntry[];
  zeroingProfiles: Record<string, ZeroingProfile>;
}): boolean {
  const rifle = input.kitItems.find(isRifleItem);
  const scope = input.kitItems.find(isScopeItem);
  if (!rifle || !scope) return false;
  const ammos = input.kitItems.filter(
    (i) => isAmmoItem(i) && getInventoryQty(input.inventory, i.id) > 0,
  );
  if (ammos.length === 0) return false;
  return ammos.some((ammo) =>
    isZeroVerified(
      input.zeroingProfiles[zeroingKey(rifle.id, scope.id, ammo.id)],
    ),
  );
}

/** Mount in kit that matches the packed scope tube diameter. */
export function kitHasMatchingScopeMount(kitItems: ShopItem[]): boolean {
  const scope = kitItems.find(isScopeItem);
  if (!scope) return false;
  return kitItems.some(
    (i) =>
      isMountItem(i) &&
      i.mount.tubeDiameterMm === scope.scope.tubeDiameterMm,
  );
}

/**
 * Inventory-wide “one mount per owned scope” — not used for hunt ready.
 * Hunt only requires the packed rifle’s scope + a matching mount in kit.
 * Kept for optional shop / UI hints.
 */
export function inventoryMountCoverageOk(input: {
  inventory: InventoryEntry[];
  /** Resolve catalog item; missing ids are skipped. */
  resolveItem: (id: string) => ShopItem | undefined;
}): { ok: boolean; detail?: string } {
  const scopeCount = new Map<number, number>();
  const mountCount = new Map<number, number>();

  for (const entry of input.inventory) {
    if (entry.qty <= 0) continue;
    const item = input.resolveItem(entry.itemId);
    if (!item) continue;
    if (isScopeItem(item)) {
      const d = item.scope.tubeDiameterMm;
      scopeCount.set(d, (scopeCount.get(d) ?? 0) + entry.qty);
    } else if (isMountItem(item)) {
      const d = item.mount.tubeDiameterMm;
      mountCount.set(d, (mountCount.get(d) ?? 0) + entry.qty);
    }
  }

  for (const [diameter, scopes] of scopeCount) {
    const mounts = mountCount.get(diameter) ?? 0;
    if (mounts < scopes) {
      return {
        ok: false,
        detail: `Trenger ${scopes}× ${formatTubeDiameterMm(diameter as ScopeTubeDiameterMm)}-montasje (har ${mounts}) — én pr kikkert`,
      };
    }
  }
  return { ok: true };
}

/**
 * Minimum kit to leave Home for a hunt: rifle, scope, matching mount, ammo,
 * backpack, verified zero, and a valid jaktkort.
 *
 * Mount rule: the scope packed on the rifle needs one matching-diameter
 * mount in kit. Spare scopes in inventory do not each need a mount.
 */
export function huntReadyCheck(input: {
  kitItems: ShopItem[];
  inventory: InventoryEntry[];
  selectedHuntingTerrainId: string | null;
  jaktkort: JaktkortBook;
  zeroingProfiles: Record<string, ZeroingProfile>;
  /** Required for new hunters (Norwegian-style exam). */
  jegerprovePassed?: boolean;
}): HuntReadyResult {
  const blockers: string[] = [];
  const terrain = getHuntingTerrain(input.selectedHuntingTerrainId);
  const kort = getJaktkortForTerrain(
    input.jaktkort,
    input.selectedHuntingTerrainId,
  );

  if (!isJegerproveCleared(input.jegerprovePassed ?? false)) {
    blockers.push("Bestå jegerprøven i byen før du kan jakte");
  }

  if (!terrain || !kort || kort.daysRemaining <= 0) {
    blockers.push("Kjøp jaktkort på inatur.no");
  } else if (kort.terrainId !== terrain.id) {
    blockers.push("Jaktkortet matcher ikke valgt terreng — kjøp på nytt via inatur.no");
  } else {
    const map = getHuntMap(terrain.mapId);
    if (!map.playable) {
      blockers.push(
        `${terrain.region}-kartet er ikke spillbart ennå — velg et annet terreng`,
      );
    }
  }

  if (!input.kitItems.some(isRifleItem)) {
    blockers.push("Ta med rifle i kit");
  }
  if (!input.kitItems.some(isScopeItem)) {
    blockers.push("Ta med kikkert i kit");
  }

  const scope = input.kitItems.find(isScopeItem);
  const hasAnyMount = input.kitItems.some(isMountItem);
  if (scope && !hasAnyMount) {
    blockers.push(
      `Ta med kikkertmontasje i kit (${formatTubeDiameterMm(scope.scope.tubeDiameterMm)})`,
    );
  } else if (scope && !kitHasMatchingScopeMount(input.kitItems)) {
    const packedMount = input.kitItems.find(isMountItem);
    blockers.push(
      packedMount
        ? `Montasje må matche kikkert-rør (${formatTubeDiameterMm(scope.scope.tubeDiameterMm)} — ikke ${formatTubeDiameterMm(packedMount.mount.tubeDiameterMm)})`
        : `Ta med kikkertmontasje i kit (${formatTubeDiameterMm(scope.scope.tubeDiameterMm)})`,
    );
  }

  if (!input.kitItems.some(isBackpackItem)) {
    blockers.push("Ta med sekk (backpack) i kit");
  }

  const ammoInKit = input.kitItems.filter(isAmmoItem);
  if (ammoInKit.length === 0) {
    blockers.push("Ta med ammo i kit");
  } else {
    const hasRounds = ammoInKit.some(
      (a) => getInventoryQty(input.inventory, a.id) > 0,
    );
    if (!hasRounds) {
      blockers.push("Du er tom for ammo — kjøp mer hos XXL");
    }
  }

  if (
    input.kitItems.some(isRifleItem) &&
    input.kitItems.some(isScopeItem) &&
    ammoInKit.some((a) => getInventoryQty(input.inventory, a.id) > 0) &&
    !kitHasVerifiedHuntZero(input)
  ) {
    blockers.push(
      "Ingen lagret zero — skyte inn rifle+kikkert+ammo på skytebanen og trykk «Lagre zero»",
    );
  }

  const hasCamcorder = input.kitItems.some(
    (i) => isMiscItem(i) && isCamcorderMisc(i.misc),
  );
  const hasCamcorderTripod = input.kitItems.some(
    (i) => isMiscItem(i) && isCamcorderTripodMisc(i.misc),
  );
  if (hasCamcorder && !hasCamcorderTripod) {
    blockers.push(
      "Camcorder krever stativ i kit (Biltema, Manfrotto eller Triggerstick)",
    );
  }

  return { ok: blockers.length === 0, blockers };
}
