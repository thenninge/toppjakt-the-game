/**
 * Cloud-scene admin allowlist — Google ids (NextAuth `user.googleId`).
 * Set `ADMIN_GOOGLE_IDS` as comma-separated list in env (server).
 */

export function parseAdminGoogleIds(
  raw: string | undefined = process.env.ADMIN_GOOGLE_IDS,
): Set<string> {
  if (!raw || !raw.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

export function isCloudSceneAdmin(googleId: string | null | undefined): boolean {
  if (!googleId) return false;
  return parseAdminGoogleIds().has(googleId);
}

export type SessionLike = {
  user?: {
    googleId?: string;
    email?: string | null;
    name?: string | null;
  };
} | null;

export function sessionGoogleId(session: SessionLike): string | null {
  if (!session?.user) return null;
  const id = session.user.googleId || session.user.email;
  return typeof id === "string" && id.length > 0 ? id : null;
}
