/**
 * @cold_barrel_adjacent — curated Instagram posts for the in-game feed.
 *
 * Instagram blocks anonymous scraping, so random posts need explicit shortcodes.
 * Add more from post URLs: https://www.instagram.com/p/SHORTCODE/ → "SHORTCODE"
 */

export const COLD_BARREL_IG_HANDLE = "cold_barrel_adjacent";

export const COLD_BARREL_IG_PROFILE_URL =
  `https://www.instagram.com/${COLD_BARREL_IG_HANDLE}/`;

export const COLD_BARREL_IG_PROFILE_EMBED_URL =
  `https://www.instagram.com/${COLD_BARREL_IG_HANDLE}/embed`;

/** Post shortcodes — fill these for true random single-post embeds. */
export const COLD_BARREL_IG_POSTS: readonly string[] = [
  // e.g. "DHxYzAbCdEf",
];

export function coldBarrelPostUrl(shortcode: string): string {
  return `https://www.instagram.com/p/${shortcode}/`;
}

export function coldBarrelPostEmbedUrl(shortcode: string): string {
  return `https://www.instagram.com/p/${shortcode}/embed`;
}

/** Pick a random shortcode, optionally avoiding the previous one. */
export function pickColdBarrelPost(
  previous: string | null = null,
  random: () => number = Math.random,
): string | null {
  const posts = COLD_BARREL_IG_POSTS;
  if (posts.length === 0) return null;
  if (posts.length === 1) return posts[0]!;
  let next = posts[Math.floor(random() * posts.length)]!;
  if (previous != null && posts.length > 1) {
    let guard = 0;
    while (next === previous && guard++ < 8) {
      next = posts[Math.floor(random() * posts.length)]!;
    }
  }
  return next;
}
