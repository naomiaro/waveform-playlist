import { useState, useCallback, useRef, type RefObject } from 'react';
import type { PlaylistEngine } from '@waveform-playlist/engine';

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
 * The master volume. This hook owns it (#826): the setter writes it here,
 * engine or not, and hands it to the engine there is, which gives it to its
 * adapter. The provider gives each new engine the value from the ref.
 * Nothing is read back from an engine.
 */
export function useMasterVolume({
  engineRef,
  initialVolume = 1.0,
}: UseMasterVolumeProps): MasterVolumeControls {
  const [masterVolume, setMasterVolumeState] = useState(initialVolume);

  // The value outside render: what a new engine is given.
  const masterVolumeRef = useRef(initialVolume);

  const setMasterVolume = useCallback(
    (volume: number) => {
      masterVolumeRef.current = volume;
      setMasterVolumeState(volume);
      engineRef.current?.setMasterVolume(volume);
    },
    [engineRef]
  );

  return {
    masterVolume,
    setMasterVolume,
    masterVolumeRef,
  };
}
