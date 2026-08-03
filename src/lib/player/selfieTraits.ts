/** Deterministic hunter portrait traits from name + nickname. */

export type SelfieTraits = {
  seed: number;
  skin: string;
  skinShade: string;
  hair: string;
  hairShade: string;
  hairStyle: "bald" | "short" | "mop" | "side" | "mullet";
  facial: "none" | "stubble" | "beard" | "mustache";
  hat: "none" | "beanie" | "cap" | "wool";
  hatColor: string;
  jacket: string;
  jacketShade: string;
  eyes: string;
  bg: string;
  bgAccent: string;
};

const SKINS = [
  { base: "#f0c8a0", shade: "#d4a878" },
  { base: "#e8b888", shade: "#c99468" },
  { base: "#c88a5c", shade: "#a66e48" },
  { base: "#8d5a3c", shade: "#6e442c" },
  { base: "#5c3a28", shade: "#3e2818" },
] as const;

const HAIRS = [
  { base: "#1a120c", shade: "#0a0806" },
  { base: "#3a2818", shade: "#241810" },
  { base: "#8a5a28", shade: "#6a4218" },
  { base: "#c4a060", shade: "#a08040" },
  { base: "#d8d0c0", shade: "#a8a090" },
  { base: "#4a2020", shade: "#2e1414" },
] as const;

const HATS = [
  "#2a4a28",
  "#1a3050",
  "#5a3a18",
  "#3a3a3a",
  "#6b4420",
  "#204028",
] as const;

const JACKETS = [
  { base: "#3a4a28", shade: "#2a3820" },
  { base: "#4a3a28", shade: "#322818" },
  { base: "#2a3a48", shade: "#1a2834" },
  { base: "#5a4828", shade: "#403420" },
  { base: "#284028", shade: "#1a2e1a" },
] as const;

const BGS = [
  { base: "#0055aa", accent: "#003366" },
  { base: "#004488", accent: "#002244" },
  { base: "#226644", accent: "#114422" },
  { base: "#664422", accent: "#442210" },
  { base: "#553355", accent: "#331133" },
] as const;

const HAIR_STYLES: SelfieTraits["hairStyle"][] = [
  "bald",
  "short",
  "mop",
  "side",
  "mullet",
];
const FACIALS: SelfieTraits["facial"][] = [
  "none",
  "stubble",
  "beard",
  "mustache",
];
const HAT_STYLES: SelfieTraits["hat"][] = ["none", "beanie", "cap", "wool"];

/** Stable 32-bit hash from name + nickname. */
export function hashSelfieSeed(name: string, nickname: string): number {
  const s = `${name.trim().toLowerCase()}|${nickname.trim().toLowerCase()}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], n: number): T {
  return arr[n % arr.length]!;
}

export function deriveSelfieTraits(
  name: string,
  nickname: string,
): SelfieTraits {
  const seed = hashSelfieSeed(name || "?", nickname || "?");
  const r = (shift: number) => (seed >>> shift) & 0xff;

  const skin = pick(SKINS, r(0));
  const hair = pick(HAIRS, r(8));
  const jacket = pick(JACKETS, r(16));
  const bg = pick(BGS, r(24));

  return {
    seed,
    skin: skin.base,
    skinShade: skin.shade,
    hair: hair.base,
    hairShade: hair.shade,
    hairStyle: pick(HAIR_STYLES, r(3)),
    facial: pick(FACIALS, r(11)),
    hat: pick(HAT_STYLES, r(19)),
    hatColor: pick(HATS, r(5)),
    jacket: jacket.base,
    jacketShade: jacket.shade,
    eyes: r(13) > 180 ? "#3a2010" : "#1a120c",
    bg: bg.base,
    bgAccent: bg.accent,
  };
}
