"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  effectiveSfxVolume,
  subscribeAudioVolumes,
} from "@/lib/audio/volumes";
import {
  playRangeShotSequence,
  startRangeAmbient,
  type RangeShotAudioOptions,
} from "@/lib/range/audio";
import { stopTurretBurst } from "@/lib/range/turretAudio";

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
    function stopAmbient() {
      stopAmbientRef.current?.();
      stopAmbientRef.current = null;
    }

    function syncAmbient() {
      stopAmbient();
      if (!enabled || !ambient) return;
      if (effectiveSfxVolume() <= 0) return;
      stopAmbientRef.current = startRangeAmbient();
    }

    syncAmbient();
    const unsub = subscribeAudioVolumes(() => {
      if (effectiveSfxVolume() <= 0) {
        stopAmbient();
        stopTurretBurst();
        return;
      }
      // Master mute lifted — restart ambient if still on range.
      if (enabled && ambient && !stopAmbientRef.current) {
        stopAmbientRef.current = startRangeAmbient();
      }
    });

    return () => {
      unsub();
      stopAmbient();
    };
  }, [enabled, ambient]);

  const playShot = useCallback(
    (hasSuppressorOrOptions: boolean | RangeShotAudioOptions) => {
      if (!enabled) return;
      if (effectiveSfxVolume() <= 0) return;
      playRangeShotSequence(hasSuppressorOrOptions);
    },
    [enabled],
  );

  return { playShot };
}
