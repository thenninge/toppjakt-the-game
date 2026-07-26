import {
  getInventoryQty,
  isZeroVerified,
  zeroingKey,
  type InventoryEntry,
  type ZeroingProfile,
} from "@/lib/player";
import {
  isAmmoItem,
  isRifleItem,
  isScopeItem,
  type ShopItem,
} from "@/lib/shop/types";
import { getHuntingTerrain } from "@/lib/hunt/terrain";
import { getHuntMap } from "@/lib/hunt/maps";
import type { ActiveJaktkort } from "@/lib/hunt/jaktkort";

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

/**
 * Minimum kit to leave Home for a hunt: rifle, scope, ammo, verified zero,
 * and a valid jaktkort.
 */
export function huntReadyCheck(input: {
  kitItems: ShopItem[];
  inventory: InventoryEntry[];
  selectedHuntingTerrainId: string | null;
  jaktkort: ActiveJaktkort | null;
  zeroingProfiles: Record<string, ZeroingProfile>;
  /** Required for new hunters (Norwegian-style exam). */
  jegerprovePassed?: boolean;
}): HuntReadyResult {
  const blockers: string[] = [];
  const terrain = getHuntingTerrain(input.selectedHuntingTerrainId);
  const kort = input.jaktkort;

  if (!input.jegerprovePassed) {
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

  return { ok: blockers.length === 0, blockers };
}
