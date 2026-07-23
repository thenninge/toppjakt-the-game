"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  playRangeShotSequence,
  startRangeAmbient,
  type RangeShotAudioOptions,
} from "@/lib/range/audio";

type UseRangeAudioOptions = {
  enabled: boolean;
  /**
   * Play range entry ambient while mounted.
   * Off on hunt shoot — hunt scene music must keep playing under shot SFX.
   */
  ambient?: boolean;
};

export function useRangeAudio({
  enabled,
  ambient = true,
}: UseRangeAudioOptions) {
  const stopAmbientRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled || !ambient) {
      stopAmbientRef.current?.();
      stopAmbientRef.current = null;
      return;
    }

    stopAmbientRef.current = startRangeAmbient();
    return () => {
      stopAmbientRef.current?.();
      stopAmbientRef.current = null;
    };
  }, [enabled, ambient]);

  const playShot = useCallback(
    (hasSuppressorOrOptions: boolean | RangeShotAudioOptions) => {
      if (!enabled) return;
      playRangeShotSequence(hasSuppressorOrOptions);
    },
    [enabled],
  );

  return { playShot };
}
