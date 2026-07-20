"use client";

import { AtmospherePauseView } from "@/components/hunt/AtmospherePauseView";

type WalkViewProps = {
  imageSrc: string;
  fromLabel: string;
  toLabel: string;
  travelMinutes: number;
  clockMinutes: number;
  paceLabel: string;
  onContinue: () => void;
};

/** Lost Patrol-style pause while moving between grid cells. */
export function WalkView({
  imageSrc,
  fromLabel,
  toLabel,
  travelMinutes,
  clockMinutes,
  paceLabel,
  onContinue,
}: WalkViewProps) {
  return (
    <AtmospherePauseView
      imageSrc={imageSrc}
      title="På vei…"
      subtitle={`${fromLabel} → ${toLabel} · ${paceLabel}`}
      durationMinutes={travelMinutes}
      clockMinutes={clockMinutes}
      onContinue={onContinue}
      ariaLabel="På vei"
    />
  );
}
