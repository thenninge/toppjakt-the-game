/**
 * Ammo ballistics & terminal effects for the game engine.
 *
 * damageFactor — how we set it:
 *   From projectile *construction*, not “stopping power”:
 *   - FMJ / match OTM (Scenar, ELD-M, MatchKing): LOW ≈ 0.18–0.28
 *     little expansion → clean meat, poor placement forgiveness
 *   - Controlled expansion (Gamehead, Speedhead, Bondstrike): MID ≈ 0.55–0.70
 *   - Aggressive expansion (Oryx, Hammerhead, Core-Lokt, V-MAX): HIGH ≈ 0.70–0.85
 *
 *   LOW ≠ weak/bad. Low = less ruined meat; you must hit vitals better
 *   to avoid tracking. Engine: meat-ruin + forgiveness — never DPS.
 *
 * maxAchievableMoa (INTERNAL — never show in UI):
 *   Ammo contribution to the angular dispersion envelope, in MOA.
 *   Combined with rifle additively: envelope = rifleMoa + ammoMoa×affinity.
 *   That envelope is N σ (default N=2) of a Gaussian — see
 *   `src/lib/ballistics/dispersion.ts`.
 *   1 MOA ≈ 29.4 mm at 100 m.
 *   Example: Lapua Scenar ≈ 0.25 MOA; hunting SP ≈ 0.5 MOA.
 *   Optional later: `v0SigmaMps` for muzzle-velocity SD (else type default).
 */

export type ProjectileType = "FMJ" | "OTM" | "SP";

export type BallisticModel = "G1" | "G7";

export type AmmoSpec = {
  caliber: string;
  projectileType: ProjectileType;
  /** Muzzle velocity (m/s). */
  v0: number;
  /** Ballistic coefficient (paired with bcModel). */
  bc: number;
  bcModel: BallisticModel;
  /**
   * Meat destruction / expansion (0–1). See file header for how we set it.
   */
  damageFactor: number;
  /**
   * @internal Never expose to the player.
   * Ammo contribution to angular envelope (MOA), additive with rifle.
   * See `src/lib/ballistics/dispersion.ts`.
   */
  maxAchievableMoa: number;
  /**
   * Optional 1σ muzzle-velocity SD (m/s). If omitted, type default is used.
   */
  v0SigmaMps?: number;
  /**
   * True subsonic load (v0 under ~340 m/s by design).
   * With a suppressor the shot is quiet enough that birds do not flush.
   */
  subsonic?: boolean;
};

/** Sort order for shop listing: caliber groups, then projectile type. */
export const CALIBER_SORT_ORDER: string[] = [
  "6,5×55",
  "6,5 Creedmoor",
  ".223 Rem",
  ".300 BLK",
  ".22 LR",
  ".17 HMR",
  ".308 Win",
  ".30-06",
];

export const PROJECTILE_TYPE_SORT_ORDER: ProjectileType[] = [
  "FMJ",
  "OTM",
  "SP",
];

export function caliberSortIndex(caliber: string): number {
  const i = CALIBER_SORT_ORDER.indexOf(caliber);
  return i === -1 ? CALIBER_SORT_ORDER.length : i;
}

export function projectileTypeSortIndex(type: ProjectileType): number {
  return PROJECTILE_TYPE_SORT_ORDER.indexOf(type);
}

/** Subsonic hunting load (catalog flag, or v0 clearly under sound barrier). */
export function isSubsonicAmmo(
  ammo: Pick<AmmoSpec, "subsonic" | "v0"> | null | undefined,
): boolean {
  if (!ammo) return false;
  if (ammo.subsonic === true) return true;
  return false;
}

/**
 * Shot is quiet enough that perched birds do not flush:
 * subsonic ammo + suppressor on the rifle.
 */
export function isSilentSuppressedShot(
  hasSuppressor: boolean,
  ammo: Pick<AmmoSpec, "subsonic" | "v0"> | null | undefined,
): boolean {
  return !!hasSuppressor && isSubsonicAmmo(ammo);
}

/** Convert MOA to group diameter in mm at a given distance (meters). */
export function moaToGroupMm(moa: number, distanceM: number): number {
  // 1 MOA ≈ 29.4 mm at 100 m (≈ 1.047" at 100 yd ≈ 29.1–29.4 mm convention).
  return moa * 29.4 * (distanceM / 100);
}
