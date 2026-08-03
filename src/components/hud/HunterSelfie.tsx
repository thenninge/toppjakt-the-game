"use client";

import { deriveSelfieTraits, type SelfieTraits } from "@/lib/player/selfieTraits";

type HunterSelfieProps = {
  name: string;
  nickname: string;
};

/** Amiga-style pixel portrait derived from name + nickname. */
export function HunterSelfie({ name, nickname }: HunterSelfieProps) {
  const t = deriveSelfieTraits(name, nickname);
  const label = name.trim() || "Jeger";
  const nick = nickname.trim();

  return (
    <div className="hunter-selfie">
      <div className="hunter-selfie-window">
        <div className="hunter-selfie-titlebar">
          <span className="hunter-selfie-gadget" />
          <span className="hunter-selfie-titlebar-text">SELFIE · CAM 1</span>
          <span className="hunter-selfie-gadget hunter-selfie-gadget-depth" />
        </div>
        <div
          className="hunter-selfie-stage"
          style={{ background: t.bg }}
        >
          <svg
            className="hunter-selfie-svg"
            viewBox="0 0 64 80"
            width="100%"
            height="100%"
            role="img"
            aria-label={`Selfie av ${label}${nick ? ` «${nick}»` : ""}`}
          >
            <rect x="0" y="0" width="64" height="80" fill={t.bg} />
            {/* backdrop blocks */}
            <rect x="0" y="56" width="64" height="24" fill={t.bgAccent} />
            <rect x="4" y="4" width="8" height="8" fill={t.bgAccent} opacity="0.45" />
            <rect x="52" y="10" width="6" height="6" fill={t.bgAccent} opacity="0.35" />

            {/* shoulders / jacket */}
            <rect x="10" y="52" width="44" height="28" fill={t.jacket} />
            <rect x="10" y="52" width="44" height="6" fill={t.jacketShade} />
            <rect x="28" y="56" width="8" height="16" fill={t.jacketShade} />
            <rect x="6" y="58" width="8" height="22" fill={t.jacketShade} />
            <rect x="50" y="58" width="8" height="22" fill={t.jacketShade} />

            {/* neck */}
            <rect x="28" y="46" width="8" height="8" fill={t.skinShade} />

            {/* head */}
            <rect x="20" y="22" width="24" height="26" fill={t.skin} />
            <rect x="22" y="20" width="20" height="4" fill={t.skin} />
            <rect x="18" y="26" width="4" height="16" fill={t.skinShade} />
            <rect x="42" y="26" width="4" height="16" fill={t.skinShade} />
            <rect x="24" y="46" width="16" height="4" fill={t.skinShade} />

            {/* ears */}
            <rect x="16" y="32" width="4" height="8" fill={t.skin} />
            <rect x="44" y="32" width="4" height="8" fill={t.skin} />

            {/* hair */}
            <Hair t={t} />

            {/* eyes */}
            <rect x="24" y="32" width="4" height="4" fill="#ffffff" />
            <rect x="36" y="32" width="4" height="4" fill="#ffffff" />
            <rect x="25" y="33" width="2" height="2" fill={t.eyes} />
            <rect x="37" y="33" width="2" height="2" fill={t.eyes} />

            {/* brows */}
            <rect x="23" y="30" width="6" height="2" fill={t.hairShade} />
            <rect x="35" y="30" width="6" height="2" fill={t.hairShade} />

            {/* nose */}
            <rect x="30" y="36" width="4" height="4" fill={t.skinShade} />
            <rect x="32" y="38" width="2" height="2" fill={t.skinShade} />

            {/* mouth */}
            <rect x="28" y="42" width="8" height="2" fill={t.skinShade} />

            {/* facial hair */}
            <Facial t={t} />

            {/* hat over hair */}
            <Hat t={t} />
          </svg>
          <div className="hunter-selfie-scanlines" />
        </div>
        <div className="hunter-selfie-caption">
          <span className="hunter-selfie-name">{label}</span>
          {nick ? (
            <span className="hunter-selfie-nick">&quot;{nick}&quot;</span>
          ) : null}
        </div>
      </div>
      <p className="shop-row-note hunter-selfie-note">
        Generert fra navn + nickname — samme input, samme fjes.
      </p>
    </div>
  );
}

function Hair({ t }: { t: SelfieTraits }) {
  if (t.hairStyle === "bald") {
    return (
      <g>
        <rect x="22" y="20" width="20" height="2" fill={t.skinShade} />
      </g>
    );
  }
  if (t.hairStyle === "short") {
    return (
      <g>
        <rect x="20" y="18" width="24" height="6" fill={t.hair} />
        <rect x="18" y="22" width="4" height="8" fill={t.hair} />
        <rect x="42" y="22" width="4" height="8" fill={t.hair} />
      </g>
    );
  }
  if (t.hairStyle === "mop") {
    return (
      <g>
        <rect x="18" y="16" width="28" height="10" fill={t.hair} />
        <rect x="16" y="22" width="6" height="12" fill={t.hair} />
        <rect x="42" y="22" width="6" height="12" fill={t.hair} />
        <rect x="22" y="14" width="20" height="4" fill={t.hairShade} />
      </g>
    );
  }
  if (t.hairStyle === "side") {
    return (
      <g>
        <rect x="20" y="18" width="24" height="6" fill={t.hair} />
        <rect x="18" y="22" width="4" height="14" fill={t.hair} />
        <rect x="42" y="22" width="4" height="6" fill={t.hair} />
      </g>
    );
  }
  // mullet
  return (
    <g>
      <rect x="20" y="18" width="24" height="6" fill={t.hair} />
      <rect x="18" y="22" width="4" height="10" fill={t.hair} />
      <rect x="42" y="22" width="4" height="10" fill={t.hair} />
      <rect x="22" y="46" width="20" height="6" fill={t.hair} />
      <rect x="20" y="48" width="4" height="6" fill={t.hairShade} />
      <rect x="40" y="48" width="4" height="6" fill={t.hairShade} />
    </g>
  );
}

function Facial({ t }: { t: SelfieTraits }) {
  if (t.facial === "none") return null;
  if (t.facial === "stubble") {
    return (
      <g opacity="0.55">
        <rect x="24" y="40" width="16" height="6" fill={t.hair} />
        <rect x="22" y="42" width="4" height="4" fill={t.hair} />
        <rect x="38" y="42" width="4" height="4" fill={t.hair} />
      </g>
    );
  }
  if (t.facial === "mustache") {
    return (
      <g>
        <rect x="26" y="40" width="12" height="3" fill={t.hair} />
        <rect x="24" y="41" width="4" height="2" fill={t.hairShade} />
        <rect x="36" y="41" width="4" height="2" fill={t.hairShade} />
      </g>
    );
  }
  // beard
  return (
    <g>
      <rect x="22" y="40" width="20" height="10" fill={t.hair} />
      <rect x="24" y="48" width="16" height="4" fill={t.hairShade} />
      <rect x="26" y="40" width="12" height="3" fill={t.hairShade} />
    </g>
  );
}

function Hat({ t }: { t: SelfieTraits }) {
  if (t.hat === "none") return null;
  if (t.hat === "beanie") {
    return (
      <g>
        <rect x="18" y="12" width="28" height="10" fill={t.hatColor} />
        <rect x="20" y="8" width="24" height="6" fill={t.hatColor} />
        <rect x="28" y="6" width="8" height="4" fill={t.hatColor} />
      </g>
    );
  }
  if (t.hat === "cap") {
    return (
      <g>
        <rect x="18" y="14" width="28" height="8" fill={t.hatColor} />
        <rect x="14" y="20" width="22" height="4" fill={t.hatColor} />
        <rect x="20" y="12" width="24" height="4" fill={t.hatColor} />
      </g>
    );
  }
  // wool
  return (
    <g>
      <rect x="16" y="10" width="32" height="12" fill={t.hatColor} />
      <rect x="20" y="6" width="24" height="6" fill={t.hatColor} />
      <rect x="18" y="20" width="4" height="8" fill={t.hatColor} />
      <rect x="42" y="20" width="4" height="8" fill={t.hatColor} />
    </g>
  );
}
