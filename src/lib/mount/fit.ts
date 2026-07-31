/**
 * Scope ↔ mount tube-diameter fit for kit packing.
 * Rings must match the scope main tube exactly (1" / 30 / 34 / 35 / 36 mm).
 */

import {
  formatTubeDiameterMm,
  type ScopeTubeDiameterMm,
} from "@/lib/mount/spec";
import {
  isMountItem,
  isScopeItem,
  type ShopItem,
} from "@/lib/shop/types";

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

/** Human-readable blocker when scope tube ≠ mount rings. */
export function scopeMountMismatchDetail(
  scopeTubeMm: ScopeTubeDiameterMm,
  mountTubeMm: ScopeTubeDiameterMm,
): string {
  return `Montasje må matche kikkert-rør (${formatTubeDiameterMm(scopeTubeMm)} — ikke ${formatTubeDiameterMm(mountTubeMm)})`;
}

/**
 * Block packing a scope onto rings of the wrong diameter, or a mount that
 * cannot hold the packed scope. Unequip is always allowed.
 */
export function kitScopeMountAddBlocked(
  kitItems: ShopItem[],
  adding: ShopItem,
): string | null {
  if (isScopeItem(adding)) {
    const mount = kitItems.find(isMountItem);
    if (
      mount &&
      mount.mount.tubeDiameterMm !== adding.scope.tubeDiameterMm
    ) {
      return (
        `${scopeMountMismatchDetail(adding.scope.tubeDiameterMm, mount.mount.tubeDiameterMm)}.\n\n` +
        `Bytt eller fjern montasjen først (${formatTubeDiameterMm(mount.mount.tubeDiameterMm)} sitter i kit).`
      );
    }
    return null;
  }
  if (isMountItem(adding)) {
    const scope = kitItems.find(isScopeItem);
    if (
      scope &&
      scope.scope.tubeDiameterMm !== adding.mount.tubeDiameterMm
    ) {
      return (
        `${scopeMountMismatchDetail(scope.scope.tubeDiameterMm, adding.mount.tubeDiameterMm)}.\n\n` +
        `Kikkerten i kit er ${formatTubeDiameterMm(scope.scope.tubeDiameterMm)} — velg montasje med samme diameter.`
      );
    }
  }
  return null;
}

/**
 * Drop a packed mount that does not fit the packed scope (e.g. favorite kit
 * apply / legacy saves). Keeps the scope.
 */
export function sanitizeKitScopeMountIds(
  kitIds: readonly string[],
  resolveItem: (id: string) => ShopItem | undefined,
): string[] {
  const scope = kitIds
    .map(resolveItem)
    .find((i): i is ShopItem => !!i && isScopeItem(i));
  const mount = kitIds
    .map(resolveItem)
    .find((i): i is ShopItem => !!i && isMountItem(i));
  if (
    scope &&
    mount &&
    isScopeItem(scope) &&
    isMountItem(mount) &&
    scope.scope.tubeDiameterMm !== mount.mount.tubeDiameterMm
  ) {
    return kitIds.filter((id) => id !== mount.id);
  }
  return [...kitIds];
}
