import { useState, useCallback, RefObject } from 'react';
import { TonePlayout } from '@waveform-playlist/playout';

export interface UseMasterVolumeProps {
  playoutRef: RefObject<TonePlayout | null>;
  initialVolume?: number; // 0-100
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
 *   initialVolume: 100,
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
  initialVolume = 100,
  onVolumeChange,
}: UseMasterVolumeProps): MasterVolumeControls {
  const [masterVolume, setMasterVolumeState] = useState(initialVolume);

  const setMasterVolume = useCallback((volume: number) => {
    setMasterVolumeState(volume);

    // Update the playout - convert 0-100 to 0-1 linear gain
    if (playoutRef.current) {
      const linearGain = volume / 100;
      playoutRef.current.setMasterGain(linearGain);
    }

    // Call optional callback
    onVolumeChange?.(volume);
  }, [playoutRef, onVolumeChange]);

  return {
    masterVolume,
    setMasterVolume,
  };
}
