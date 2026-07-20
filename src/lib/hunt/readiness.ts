import { getInventoryQty, type InventoryEntry } from "@/lib/player";
import {
  isAmmoItem,
  isRifleItem,
  isScopeItem,
  type ShopItem,
} from "@/lib/shop/types";
import { getHuntingTerrain } from "@/lib/hunt/terrain";
import { getHuntMap } from "@/lib/hunt/maps";

export type HuntReadyResult = {
  ok: boolean;
  /** Human-readable blockers for UI. */
  blockers: string[];
};

/**
 * Minimum kit to leave Home for a hunt: rifle, scope, and ammo with rounds.
 */
export function huntReadyCheck(input: {
  kitItems: ShopItem[];
  inventory: InventoryEntry[];
  selectedHuntingTerrainId: string | null;
}): HuntReadyResult {
  const blockers: string[] = [];
  const terrain = getHuntingTerrain(input.selectedHuntingTerrainId);

  if (!terrain) {
    blockers.push("Velg jaktterreng på inatur.no");
  } else {
    const map = getHuntMap(terrain.mapId);
    if (!map.playable) {
      blockers.push(
        `${terrain.region}-kartet er ikke spillbart ennå — velg Trøndelag`,
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
      blockers.push("Du er tom for ammo — kjøp mer hos Pike Pro");
    }
  }

  return { ok: blockers.length === 0, blockers };
}
