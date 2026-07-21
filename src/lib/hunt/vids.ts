/**
 * Post-shot atmosphere videos under /public/vids — sorted by folder.
 *
 *   /vids/kill/  — clean kill at the tree (instant_kill / vital_kill)
 *   /vids/hit/   — wound → ettersøk
 *   /vids/miss/  — clean miss
 *
 * Drop new clips in the folder and append the path below.
 * Prefer .mp4 (H.264) or .webm for broad browser support.
 */

import type { HuntShotResultKind } from "@/lib/hunt/shoot";

export type ShotVideoKind = "kill" | "hit" | "miss";

const KILL_VIDEOS: string[] = [
  "/vids/kill/kill1.mp4",
  "/vids/kill/kill2.mp4",
  "/vids/kill/kill3.mp4",
  "/vids/kill/kill4.mp4",
  "/vids/kill/kill5.mp4",
  "/vids/kill/kill6.mp4",
];

const HIT_VIDEOS: string[] = ["/vids/hit/hit1.mp4"];

const MISS_VIDEOS: string[] = [
  "/vids/miss/miss1.mp4",
  "/vids/miss/miss2.mp4",
  "/vids/miss/miss3.mp4",
];

const POOLS: Record<ShotVideoKind, string[]> = {
  kill: KILL_VIDEOS,
  hit: HIT_VIDEOS,
  miss: MISS_VIDEOS,
};

export function shotVideoKindForResult(
  kind: HuntShotResultKind,
): ShotVideoKind {
  if (kind === "instant_kill" || kind === "vital_kill") return "kill";
  if (kind === "ettersok") return "hit";
  return "miss";
}

export function shotVideoTitle(kind: ShotVideoKind): string {
  if (kind === "kill") return "Treff!";
  if (kind === "hit") return "Treff — ettersøk";
  return "Bom";
}

function pickRandom(pool: readonly string[]): string | null {
  if (pool.length === 0) return null;
  const i = Math.floor(Math.random() * pool.length);
  return pool[i] ?? null;
}

/** Random clip for a shot outcome, or null if the pool is empty. */
export function pickShotVideo(kind: ShotVideoKind): string | null {
  return pickRandom(POOLS[kind]);
}

export function pickShotVideoForResult(
  resultKind: HuntShotResultKind,
): { kind: ShotVideoKind; src: string; title: string } | null {
  const kind = shotVideoKindForResult(resultKind);
  const src = pickShotVideo(kind);
  if (!src) return null;
  return { kind, src, title: shotVideoTitle(kind) };
}
