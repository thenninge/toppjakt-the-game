"use client";

import { useCallback, useState } from "react";
import { LocationNav } from "@/components/town/LocationNav";
import {
  COLD_BARREL_IG_HANDLE,
  COLD_BARREL_IG_POSTS,
  COLD_BARREL_IG_PROFILE_EMBED_URL,
  COLD_BARREL_IG_PROFILE_URL,
  coldBarrelPostEmbedUrl,
  coldBarrelPostUrl,
  pickColdBarrelPost,
} from "@/lib/social/coldBarrelAdjacent";

type InstagramFeedViewProps = {
  onBack: () => void;
};

export function InstagramFeedView({ onBack }: InstagramFeedViewProps) {
  const hasCurated = COLD_BARREL_IG_POSTS.length > 0;
  const [shortcode, setShortcode] = useState<string | null>(() =>
    pickColdBarrelPost(),
  );
  /** Bump to force iframe reload (profile embed / same post). */
  const [reloadKey, setReloadKey] = useState(0);

  const showRandom = useCallback(() => {
    if (!hasCurated) {
      setReloadKey((k) => k + 1);
      return;
    }
    setShortcode((prev) => pickColdBarrelPost(prev));
    setReloadKey((k) => k + 1);
  }, [hasCurated]);

  const embedSrc = shortcode
    ? coldBarrelPostEmbedUrl(shortcode)
    : COLD_BARREL_IG_PROFILE_EMBED_URL;
  const openUrl = shortcode
    ? coldBarrelPostUrl(shortcode)
    : COLD_BARREL_IG_PROFILE_URL;

  return (
    <div className="ig-feed">
      <LocationNav
        onBackToTown={onBack}
        backLabel="← Tilbake til hjem"
        hint="Cold Barrel Adjacent — felt, glass og cold bore."
      />

      <header className="shop-header">
        <p className="intro-line intro-gift">Instagram</p>
        <p className="shop-row-note">
          @{COLD_BARREL_IG_HANDLE}
          {hasCurated
            ? ` · ${COLD_BARREL_IG_POSTS.length} kuraterte innlegg`
            : " · profil-feed (legg inn post-shortcodes for ekte random)"}
        </p>
      </header>

      <div className="ig-feed-actions">
        <button
          type="button"
          className="intro-button home-ig-btn"
          onClick={showRandom}
        >
          {hasCurated ? "Tilfeldig innlegg" : "Oppdater feed"}
        </button>
        <a
          className="intro-button sheriff-secondary ig-feed-external"
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Åpne på Instagram ↗
        </a>
        <a
          className="intro-button sheriff-secondary ig-feed-external"
          href={COLD_BARREL_IG_PROFILE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          @{COLD_BARREL_IG_HANDLE} ↗
        </a>
      </div>

      <div className="ig-feed-frame-wrap">
        <iframe
          key={`${embedSrc}-${reloadKey}`}
          title={
            shortcode
              ? `Instagram-innlegg ${shortcode}`
              : `@${COLD_BARREL_IG_HANDLE} feed`
          }
          src={embedSrc}
          className="ig-feed-frame"
          loading="lazy"
          allow="encrypted-media; clipboard-write"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      {!hasCurated ? (
        <p className="shop-row-note ig-feed-hint">
          Tip: lim inn noen post-lenker (shortcodes) i{" "}
          <code>src/lib/social/coldBarrelAdjacent.ts</code> så «Tilfeldig
          innlegg» trekker blant dem.
        </p>
      ) : null}
    </div>
  );
}
