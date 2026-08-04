/**
 * Våpenskap — saved gun platforms (rifle + scope + mount).
 * Switching kits restores the binding without wiping zeros.
 */

import { getShopItem } from "@/lib/shop/catalog";
import {
  isMountItem,
  isRifleItem,
  isScopeItem,
  isSuppressorItem,
  type ShopItem,
} from "@/lib/shop/types";
import { kitScopeMountAddBlocked } from "@/lib/mount/fit";

/** Fixed cabinet slots (Gun kit 1…N). */
export const GUN_CABINET_SLOT_COUNT = 3;

export type GunKitBinding = {
  /** 1-based slot index. */
  slot: number;
  rifleId: string;
  scopeId: string;
  mountId: string;
  /** Optional remembered can when activating (not part of zero identity). */
  suppressorId?: string | null;
};

export function emptyGunKits(): GunKitBinding[] {
  return [];
}

export function normalizeGunKits(raw: unknown): GunKitBinding[] {
  if (!Array.isArray(raw)) return [];
  const next: GunKitBinding[] = [];
  const usedSlots = new Set<number>();
  for (const row of raw) {
    if (typeof row !== "object" || row == null) continue;
    const o = row as Record<string, unknown>;
    const slot = Math.floor(Number(o.slot));
    if (
      !Number.isFinite(slot) ||
      slot < 1 ||
      slot > GUN_CABINET_SLOT_COUNT ||
      usedSlots.has(slot)
    ) {
      continue;
    }
    const rifleId = typeof o.rifleId === "string" ? o.rifleId : "";
    const scopeId = typeof o.scopeId === "string" ? o.scopeId : "";
    const mountId = typeof o.mountId === "string" ? o.mountId : "";
    if (!rifleId || !scopeId || !mountId) continue;
    usedSlots.add(slot);
    const suppressorId =
      typeof o.suppressorId === "string" && o.suppressorId.length > 0
        ? o.suppressorId
        : o.suppressorId === null
          ? null
          : undefined;
    next.push({
      slot,
      rifleId,
      scopeId,
      mountId,
      ...(suppressorId !== undefined ? { suppressorId } : {}),
    });
  }
  return next.sort((a, b) => a.slot - b.slot);
}

export function gunKitFromKitIds(
  slot: number,
  kitIds: readonly string[],
): GunKitBinding | null {
  if (slot < 1 || slot > GUN_CABINET_SLOT_COUNT) return null;
  let rifleId = "";
  let scopeId = "";
  let mountId = "";
  let suppressorId: string | null = null;
  for (const id of kitIds) {
    const item = getShopItem(id);
    if (!item) continue;
    if (isRifleItem(item)) rifleId = item.id;
    else if (isScopeItem(item)) scopeId = item.id;
    else if (isMountItem(item)) mountId = item.id;
    else if (isSuppressorItem(item)) suppressorId = item.id;
  }
  if (!rifleId || !scopeId || !mountId) return null;
  // Diameter gate — refuse to save an illegal pairing.
  const probe: ShopItem[] = [];
  for (const id of [rifleId, scopeId, mountId]) {
    const item = getShopItem(id);
    if (item) probe.push(item);
  }
  if (kitScopeMountAddBlocked(probe, probe.find(isMountItem)!)) return null;
  return { slot, rifleId, scopeId, mountId, suppressorId };
}

/** True when kit already has exactly this rifle+scope+mount. */
export function gunKitIsActive(
  binding: GunKitBinding,
  kitIds: readonly string[],
): boolean {
  const has = new Set(kitIds);
  return (
    has.has(binding.rifleId) &&
    has.has(binding.scopeId) &&
    has.has(binding.mountId)
  );
}

/**
 * Swap rifle / scope / mount (and optional suppressor) into kit.
 * Other kit gear (ammo, sekk, …) is left alone.
 * Does not touch zeroing profiles — call separately only for manual toggles.
 */
export function applyGunKitToKitIds(
  kitIds: readonly string[],
  binding: GunKitBinding,
  opts?: { applySuppressor?: boolean },
): string[] {
  const applyCan = opts?.applySuppressor !== false;
  const next = kitIds.filter((id) => {
    const item = getShopItem(id);
    if (!item) return true;
    if (isRifleItem(item) || isScopeItem(item) || isMountItem(item)) {
      return false;
    }
    if (applyCan && isSuppressorItem(item)) return false;
    return true;
  });
  next.push(binding.rifleId, binding.scopeId, binding.mountId);
  if (applyCan && binding.suppressorId) {
    next.push(binding.suppressorId);
  }
  return next;
}

export function upsertGunKit(
  kits: readonly GunKitBinding[],
  binding: GunKitBinding,
): GunKitBinding[] {
  const without = kits.filter((k) => k.slot !== binding.slot);
  return [...without, binding].sort((a, b) => a.slot - b.slot);
}

export function clearGunKitSlot(
  kits: readonly GunKitBinding[],
  slot: number,
): GunKitBinding[] {
  return kits.filter((k) => k.slot !== slot);
}

export function gunKitLabel(slot: number): string {
  return `Gun kit ${slot}`;
}

/** Rifle / scope / mount ids already saved in other cabinet slots. */
export function assignedGunKitPartIds(
  kits: readonly GunKitBinding[],
  opts?: { exceptSlot?: number },
): Set<string> {
  const used = new Set<string>();
  for (const k of kits) {
    if (opts?.exceptSlot != null && k.slot === opts.exceptSlot) continue;
    used.add(k.rifleId);
    used.add(k.scopeId);
    used.add(k.mountId);
  }
  return used;
}

export type UnassignedGunKitParts = {
  rifles: ShopItem[];
  scopes: ShopItem[];
  mounts: ShopItem[];
};

/**
 * Owned gun-kit parts not already bound in våpenskapet.
 * Mounts optionally filtered to match a chosen scope tube diameter.
 */
export function unassignedGunKitParts(
  ownedItemIds: ReadonlySet<string>,
  kits: readonly GunKitBinding[],
  opts?: { exceptSlot?: number; forScopeId?: string | null },
): UnassignedGunKitParts {
  const used = assignedGunKitPartIds(kits, { exceptSlot: opts?.exceptSlot });
  const rifles: ShopItem[] = [];
  const scopes: ShopItem[] = [];
  const mounts: ShopItem[] = [];
  let scopeTube: number | null = null;
  if (opts?.forScopeId) {
    const sc = getShopItem(opts.forScopeId);
    if (sc && isScopeItem(sc)) scopeTube = sc.scope.tubeDiameterMm;
  }
  for (const id of ownedItemIds) {
    if (used.has(id)) continue;
    const item = getShopItem(id);
    if (!item) continue;
    if (isRifleItem(item)) rifles.push(item);
    else if (isScopeItem(item)) scopes.push(item);
    else if (isMountItem(item)) {
      if (scopeTube != null && item.mount.tubeDiameterMm !== scopeTube) {
        continue;
      }
      mounts.push(item);
    }
  }
  const byName = (a: ShopItem, b: ShopItem) =>
    a.brand.localeCompare(b.brand) || a.name.localeCompare(b.name);
  rifles.sort(byName);
  scopes.sort(byName);
  mounts.sort(byName);
  return { rifles, scopes, mounts };
}

/** Build a binding from chosen ids (validates scope↔mount fit). */
export function gunKitFromParts(
  slot: number,
  parts: { rifleId: string; scopeId: string; mountId: string },
): GunKitBinding | null {
  if (slot < 1 || slot > GUN_CABINET_SLOT_COUNT) return null;
  const rifle = getShopItem(parts.rifleId);
  const scope = getShopItem(parts.scopeId);
  const mount = getShopItem(parts.mountId);
  if (
    !rifle ||
    !scope ||
    !mount ||
    !isRifleItem(rifle) ||
    !isScopeItem(scope) ||
    !isMountItem(mount)
  ) {
    return null;
  }
  if (kitScopeMountAddBlocked([rifle, scope], mount)) return null;
  return {
    slot,
    rifleId: rifle.id,
    scopeId: scope.id,
    mountId: mount.id,
    suppressorId: null,
  };
}
