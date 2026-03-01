import { useState, useCallback, useRef, type RefObject } from 'react';
import type { PlaylistEngine, EngineState } from '@waveform-playlist/engine';

export interface UseMasterVolumeProps {
  engineRef: RefObject<PlaylistEngine | null>;
  initialVolume?: number; // 0-1.0 (linear gain, consistent with Web Audio API)
}

export interface MasterVolumeControls {
  masterVolume: number;
  setMasterVolume: (volume: number) => void;
  /** Ref holding the current masterVolume for seeding a fresh engine. */
  masterVolumeRef: React.RefObject<number>;
}

/**
 * Hook for managing master volume via PlaylistEngine delegation.
 *
 * setMasterVolume delegates to the engine. State is mirrored back from
 * the engine via onEngineState(), which the provider's statechange
 * handler calls on every engine event.
 */
export function useMasterVolume({
  engineRef,
  initialVolume = 1.0,
}: UseMasterVolumeProps): MasterVolumeControls & {
  onEngineState: (state: EngineState) => void;
} {
  const [masterVolume, setMasterVolumeState] = useState(initialVolume);

  // Internal ref for statechange guard + engine seeding on rebuild.
  const masterVolumeRef = useRef(initialVolume);

  const setMasterVolume = useCallback(
    (volume: number) => {
      if (engineRef.current) {
        // Engine exists — delegate; statechange will update ref + React state.
        engineRef.current.setMasterVolume(volume);
      } else {
        // No engine yet — persist locally so loadAudio() seeds correctly.
        masterVolumeRef.current = volume;
        setMasterVolumeState(volume);
      }
    },
    [engineRef]
  );

  // Called by the provider's statechange handler to mirror engine state.
  const onEngineState = useCallback((state: EngineState) => {
    if (state.masterVolume !== masterVolumeRef.current) {
      masterVolumeRef.current = state.masterVolume;
      setMasterVolumeState(state.masterVolume);
    }
  }, []);

  return {
    masterVolume,
    setMasterVolume,
    masterVolumeRef,
    onEngineState,
  };
}
