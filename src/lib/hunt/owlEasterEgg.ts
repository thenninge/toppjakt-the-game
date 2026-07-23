/**
 * Owl easter egg — after 25 bagged gamebirds (tiur+orre), observation #26
 * is an ugle; if missed, again at #36, #46, …
 */

export const OWL_FIRST_MILESTONE = 26;
export const OWL_MILESTONE_STEP = 10;
export const UGLE_TACO_NOK = 10_000;

export const UGLE_FUNN_IMAGE = "/images/funn/funn_ugle.png";
export const UGLE_FUNN_TITLE = "Aiaiai.. det var visst en ugle..";
export const UGLE_FUNN_SUBTITLE =
  "Tenker kanskje ikke at denne selges på det åpne markedet, men nederst i sekken er det ingen som sjekker";

export function lifetimeGamebirdsBagged(
  lifetimeTiur: number,
  lifetimeOrrhaner: number,
): number {
  return Math.max(0, lifetimeTiur) + Math.max(0, lifetimeOrrhaner);
}

/**
 * Active owl observation milestone for the current bag count.
 * bagged 25–34 → 26, 35–44 → 36, …
 */
export function owlMilestoneForBagged(bagged: number): number | null {
  if (bagged < OWL_FIRST_MILESTONE - 1) return null;
  return (
    OWL_FIRST_MILESTONE +
    Math.floor((bagged - (OWL_FIRST_MILESTONE - 1)) / OWL_MILESTONE_STEP) *
      OWL_MILESTONE_STEP
  );
}

export function shouldOfferOwl(opts: {
  lifetimeTiur: number;
  lifetimeOrrhaner: number;
  /** >0 once the owl has been harvested. */
  lifetimeUgle: number;
  owlLastOfferedMilestone: number | null;
}): boolean {
  if (opts.lifetimeUgle > 0) return false;
  const bagged = lifetimeGamebirdsBagged(
    opts.lifetimeTiur,
    opts.lifetimeOrrhaner,
  );
  const milestone = owlMilestoneForBagged(bagged);
  if (milestone == null) return false;
  if (
    opts.owlLastOfferedMilestone != null &&
    opts.owlLastOfferedMilestone >= milestone
  ) {
    return false;
  }
  return true;
}
