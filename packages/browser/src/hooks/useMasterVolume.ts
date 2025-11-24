import { useState, useCallback, RefObject } from 'react';
import { TonePlayout } from '@waveform-playlist/playout';

export interface UseMasterVolumeProps {
  playoutRef: RefObject<TonePlayout | null>;
  initialVolume?: number; // 0-1.0 (linear gain, consistent with Web Audio API)
  onVolumeChange?: (volume: number) => void;
}

export interface MasterVolumeControls {
  masterVolume: number;
  setMasterVolume: (volume: number) => void;
}

/**
 * Hook for managing master volume control
 *
 * @example
 * ```tsx
 * const { masterVolume, setMasterVolume } = useMasterVolume({
 *   playoutRef,
 *   initialVolume: 1.0,
 * });
 *
 * <MasterVolumeControl
 *   volume={masterVolume}
 *   onChange={setMasterVolume}
 * />
 * ```
 */
export function useMasterVolume({
  playoutRef,
  initialVolume = 1.0,
  onVolumeChange,
}: UseMasterVolumeProps): MasterVolumeControls {
  const [masterVolume, setMasterVolumeState] = useState(initialVolume);

  const setMasterVolume = useCallback((volume: number) => {
    setMasterVolumeState(volume);

    // Update the playout with linear gain (0-1.0 range)
    if (playoutRef.current) {
      playoutRef.current.setMasterGain(volume);
    }

    // Call optional callback
    onVolumeChange?.(volume);
  }, [playoutRef, onVolumeChange]);

  return {
    masterVolume,
    setMasterVolume,
  };
}
