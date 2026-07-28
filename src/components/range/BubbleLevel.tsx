"use client";

import type { BubbleLevelVisualId } from "@/lib/range/bubbleLevel";
import { UlfBubbleLevel } from "@/components/range/UlfBubbleLevel";

export type BubbleLevelProps = {
  visualId: BubbleLevelVisualId;
  cantDeg: number;
  onCantChange: (cantDeg: number) => void;
  disabled?: boolean;
  /** When true, mounts bottom-left under the optic chrome. */
  docked?: boolean;
  className?: string;
};

/**
 * Kit bubble-level HUD — picks a visual skin; cant wiring is shared.
 * Place inside `.scope-optic` (absolute) or pass docked for the default slot.
 */
export function BubbleLevel({
  visualId,
  cantDeg,
  onCantChange,
  disabled = false,
  docked = true,
  className,
}: BubbleLevelProps) {
  const body =
    visualId === "ulf" ? (
      <UlfBubbleLevel
        cantDeg={cantDeg}
        onCantChange={onCantChange}
        disabled={disabled}
      />
    ) : (
      <UlfBubbleLevel
        cantDeg={cantDeg}
        onCantChange={onCantChange}
        disabled={disabled}
      />
    );

  if (!docked) {
    return className ? <div className={className}>{body}</div> : body;
  }

  return (
    <div
      className={
        className
          ? `bubble-level-dock ${className}`
          : "bubble-level-dock"
      }
    >
      {body}
    </div>
  );
}
