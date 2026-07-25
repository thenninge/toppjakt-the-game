/**
 * Cloud save client — talks to /api/game/save (NextAuth + Supabase).
 * localStorage remains the fast cache; cloud is source of truth when signed in.
 */

import type { PlayerStats } from "@/lib/player";
import type { PlayerSaveV1 } from "@/lib/playerSave";

export type CloudSaveResponse = {
  save: PlayerSaveV1 | null;
  error?: string;
};

export async function fetchCloudSave(): Promise<PlayerSaveV1 | null> {
  const res = await fetch("/api/game/save", { method: "GET" });
  if (res.status === 401) return null;
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Kunne ikke hente sky-save (${res.status})`);
  }
  const data = (await res.json()) as CloudSaveResponse;
  return data.save ?? null;
}

export async function putCloudSave(
  stats: PlayerStats,
  savedAtMs: number = Date.now(),
): Promise<PlayerSaveV1> {
  const res = await fetch("/api/game/save", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stats, savedAtMs }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Kunne ikke lagre til sky (${res.status})`);
  }
  const data = (await res.json()) as CloudSaveResponse;
  if (!data.save) {
    throw new Error("Tomt svar fra sky-lagring");
  }
  return data.save;
}

/** Delete the signed-in user's cloud save row. */
export async function deleteCloudSave(): Promise<void> {
  const res = await fetch("/api/game/save", { method: "DELETE" });
  if (res.status === 401) {
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || `Kunne ikke slette sky-save (${res.status})`);
  }
}

/**
 * Pick which save wins when both local and cloud exist.
 * Newer `savedAtMs` wins; ties prefer cloud.
 */
export function pickPreferredSave(
  local: PlayerSaveV1 | null,
  cloud: PlayerSaveV1 | null,
): { save: PlayerSaveV1 | null; uploadLocal: boolean } {
  if (!local && !cloud) return { save: null, uploadLocal: false };
  if (!cloud) return { save: local, uploadLocal: !!local?.stats.name };
  if (!local) return { save: cloud, uploadLocal: false };
  if (local.savedAtMs > cloud.savedAtMs) {
    return { save: local, uploadLocal: true };
  }
  return { save: cloud, uploadLocal: false };
}
