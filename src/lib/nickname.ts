/** Weapon / ballistics slang that sounds good as a handle. */
const TERMS = [
  "Sniper",
  "Longshot",
  "Sabot",
  "Full Metal Jacket",
  "Full Auto",
  "Gatling",
  "Small Bore",
  "Round Rifling",
  "Chipped Crown",
  "Pump Action",
  "Cold Bore",
  "Scattergun",
  "Magnum",
  "Bolt Action",
  "Side-by-Side",
  "Iron Sight",
  "Birdshot",
  "Full Choke",
  "Subsonic",
  "Hot Load",
  "Steel Shot",
  "Rimfire",
  "Over-Under",
  "Open Sight",
  "Zeroing",
  "Deadeye",
  "Clean Kill",
  "Muzzle Brake",
  "Twist Rate",
  "Grain Weight",
  "Hollow Point",
  "Soft Point",
  "Boat Tail",
  "Match Grade",
  "Hair Trigger",
  "Free Float",
  "Glass Bed",
  "Cold Clean",
] as const;

/** Names that land well after a gun term. */
const HANDLES = [
  "Pete",
  "Slim",
  "Jack",
  "Danny",
  "Kenny",
  "Rex",
  "Duke",
  "Max",
  "Roy",
  "Bud",
  "Tex",
  "Hank",
  "Clyde",
  "Vince",
  "Lenny",
  "Moe",
  "Gus",
  "Ned",
  "Cal",
  "Wes",
] as const;

/** Extra one-off absurd epithets kept for flavor. */
const EXTRAS = [
  "Killdozer Ken",
  "Roundhouse Kenny",
  "Trigger Happy Tim",
  "MOA Monster",
  "One Shot Wonder",
  "Missed by a Mile Mike",
  "Grouse Ghost",
  "Tiur Terror",
] as const;

function buildEpithets(): string[] {
  const combos: string[] = [];
  for (const term of TERMS) {
    for (const handle of HANDLES) {
      combos.push(`${term} ${handle}`);
    }
  }
  return [...combos, ...EXTRAS];
}

const EPITHETS = buildEpithets();

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** Builds nickname only, e.g. "Sniper Slim", from the entered first name. */
export function generateNickname(rawName: string): string {
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) return "";

  const key = name.toLowerCase();
  const index = hashName(key) % EPITHETS.length;
  return EPITHETS[index];
}
