"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  playRangeShotSequence,
  startRangeAmbient,
  type RangeShotAudioOptions,
} from "@/lib/range/audio";

type UseRangeAudioOptions = {
  enabled: boolean;
};

export function useRangeAudio({ enabled }: UseRangeAudioOptions) {
  const stopAmbientRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!enabled) {
      stopAmbientRef.current?.();
      stopAmbientRef.current = null;
      return;
    }

    stopAmbientRef.current = startRangeAmbient();
    return () => {
      stopAmbientRef.current?.();
      stopAmbientRef.current = null;
    };
  }, [enabled]);

  const playShot = useCallback(
    (hasSuppressorOrOptions: boolean | RangeShotAudioOptions) => {
      if (!enabled) return;
      playRangeShotSequence(hasSuppressorOrOptions);
    },
    [enabled],
  );

  return { playShot };
}
