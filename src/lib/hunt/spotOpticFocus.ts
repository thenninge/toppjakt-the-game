/**
 * High-realism binocular / thermal focus — scene offset + dialed focus.
 * Blur uses a soft sweet-spot around the scene target (0–1 dial).
 */

const MEMORY = new Map<
  string,
  { target: number; binos: number; thermal: number }
>();

export const SPOT_FOCUS_BLUR_CAP_PX = 6.5;
/** Dial steps for I/O and scroll wheel. */
export const SPOT_FOCUS_STEP = 0.035;
/** |dial − target| below this → sharp. */
const SPOT_FOCUS_SWEET = 0.045;

export function clampSpotFocusDial(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

/** Random focus plane for a spotting landscape (0 = near, 1 = far). */
export function rollSpotFocusTarget(random: () => number = Math.random): number {
  return clampSpotFocusDial(0.12 + random() * 0.76);
}

/** Start dial slightly off the target so the player must adjust. */
export function rollSpotFocusStartDial(
  target: number,
  random: () => number = Math.random,
): number {
  const mag = 0.16 + random() * 0.32;
  const sign = random() < 0.5 ? -1 : 1;
  return clampSpotFocusDial(target + mag * sign);
}

export function spotFocusBlurPx(dial: number, target: number): number {
  const mismatch = Math.abs(
    clampSpotFocusDial(dial) - clampSpotFocusDial(target),
  );
  if (mismatch < SPOT_FOCUS_SWEET) return 0;
  const t = (mismatch - SPOT_FOCUS_SWEET) / (0.55 - SPOT_FOCUS_SWEET);
  const px = Math.min(SPOT_FOCUS_BLUR_CAP_PX, Math.max(0, t) * SPOT_FOCUS_BLUR_CAP_PX);
  return px < 0.04 ? 0 : px;
}

/** dir −1 = fokus in (nearer), +1 = focus out (farther). */
export function nudgeSpotFocusDial(dial: number, dir: -1 | 1): number {
  return clampSpotFocusDial(dial + dir * SPOT_FOCUS_STEP);
}

export type SpotFocusMemory = {
  target: number;
  binos: number;
  thermal: number;
};

/** Per spotting image — survives leave/re-enter until a new imageSrc. */
export function ensureSpotFocusMemory(imageSrc: string): SpotFocusMemory {
  const key = imageSrc || "__empty__";
  let row = MEMORY.get(key);
  if (!row) {
    const target = rollSpotFocusTarget();
    const start = rollSpotFocusStartDial(target);
    row = { target, binos: start, thermal: start };
    MEMORY.set(key, row);
  }
  return row;
}

export function writeSpotFocusDial(
  imageSrc: string,
  mode: "binos" | "thermal",
  dial: number,
): void {
  const row = ensureSpotFocusMemory(imageSrc);
  const next = clampSpotFocusDial(dial);
  if (mode === "binos") row.binos = next;
  else row.thermal = next;
}
