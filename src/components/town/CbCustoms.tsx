"use client";

import { LocationNav } from "@/components/town/LocationNav";

type CbCustomsProps = {
  onLeave: () => void;
};

/**
 * CB Customs — custom rifle / bil / 3D-print workshop.
 * Placeholder until CNC + configurator ship.
 */
export function CbCustoms({ onLeave }: CbCustomsProps) {
  return (
    <div className="cb-customs">
      <LocationNav onBackToTown={onLeave} />
      <p className="intro-line intro-gift">CB Customs</p>
      <p className="intro-line">Børsemaker · bil · 3D-print</p>
      <p className="intro-line">
        Her kan du etter hvert custom-lage din egen rifle — fra blank til
        ferdig pipe, chassis og finish.
      </p>
      <blockquote className="intro-thought">
        Åpner så snart vi får opp CNC-fresen
      </blockquote>
      <button type="button" className="intro-button" onClick={onLeave}>
        Tilbake til byen
      </button>
    </div>
  );
}
