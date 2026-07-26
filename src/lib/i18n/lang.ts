/**
 * Player UI language (Jegerprøve + preferences). Expand as more surfaces localize.
 */

export type GameLang = "nb" | "en" | "ja";

export const GAME_LANGS: readonly GameLang[] = ["nb", "en", "ja"] as const;

/** Native labels — same in every UI language. */
export const GAME_LANG_LABEL: Record<GameLang, string> = {
  nb: "Norsk",
  en: "English",
  ja: "日本語",
};

export function isGameLang(v: unknown): v is GameLang {
  return v === "nb" || v === "en" || v === "ja";
}

export function normalizeGameLang(v: unknown, fallback: GameLang = "nb"): GameLang {
  return isGameLang(v) ? v : fallback;
}
