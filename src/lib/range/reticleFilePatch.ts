/**
 * Shared helpers for admin routes that patch {@code reticles.ts} on disk.
 * Keys may be quoted (`"mpct3x":`) or bare (`kahles:`) — both must match.
 */

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type ReticleFileEntryMatch = {
  index: number;
  open: string;
  inner: string;
  close: string;
  fullLength: number;
};

/**
 * Locate `id: { ... },` or `"id": { ... },` with brace matching so nested
 * objects (illumination / imageCrop / hiRes) do not truncate the entry.
 */
export function findReticleEntry(
  src: string,
  reticleId: string,
): ReticleFileEntryMatch | null {
  const id = escapeRegExp(reticleId);
  const openRe = new RegExp(`("${id}"|\\b${id}):\\s*\\{`);
  const openMatch = openRe.exec(src);
  if (!openMatch || openMatch.index == null) return null;
  const open = openMatch[0];
  const bodyStart = openMatch.index + open.length;
  let depth = 1;
  let i = bodyStart;
  for (; i < src.length; i += 1) {
    const ch = src[i]!;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        i += 1;
        break;
      }
    }
  }
  if (depth !== 0) return null;
  let closeEnd = i;
  while (closeEnd < src.length && /\s/.test(src[closeEnd]!)) closeEnd += 1;
  if (src[closeEnd] === ",") closeEnd += 1;
  const close = src.slice(i - 1, closeEnd);
  return {
    index: openMatch.index,
    open,
    inner: src.slice(bodyStart, i - 1),
    close,
    fullLength: closeEnd - openMatch.index,
  };
}

/**
 * Remove later duplicate entries for the same reticle id (keeps the first).
 * Prevents bare `kahles:` + appended `"kahles":` from fighting in JS.
 */
export function removeDuplicateReticleEntries(
  src: string,
  reticleId: string,
): string {
  const first = findReticleEntry(src, reticleId);
  if (!first) return src;
  let out = src;
  let guard = 0;
  while (guard < 8) {
    guard += 1;
    const afterStart = first.index + first.fullLength;
    const rest = out.slice(afterStart);
    const dup = findReticleEntry(rest, reticleId);
    if (!dup) break;
    const abs = afterStart + dup.index;
    out = out.slice(0, abs) + out.slice(abs + dup.fullLength);
  }
  return out;
}
