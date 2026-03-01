import { useState, useCallback, useRef, type RefObject } from 'react';
import type { PlaylistEngine, EngineState } from '@waveform-playlist/engine';

export interface UseSelectedTrackProps {
  engineRef: RefObject<PlaylistEngine | null>;
}

export interface SelectedTrackControls {
  selectedTrackId: string | null;
  setSelectedTrackId: (trackId: string | null) => void;
}

/**
 * Hook for managing selected track state via PlaylistEngine delegation.
 *
 * setSelectedTrackId delegates to the engine's selectTrack method.
 * State is mirrored back from the engine via onEngineState(), which
 * the provider's statechange handler calls on every engine event.
 */
export function useSelectedTrack({ engineRef }: UseSelectedTrackProps): SelectedTrackControls & {
  onEngineState: (state: EngineState) => void;
  selectedTrackIdRef: React.RefObject<string | null>;
} {
  const [selectedTrackId, setSelectedTrackIdState] = useState<string | null>(null);

  // Internal ref for statechange guard.
  const selectedTrackIdRef = useRef<string | null>(null);

  const setSelectedTrackId = useCallback(
    (trackId: string | null) => {
      engineRef.current?.selectTrack(trackId);
    },
    [engineRef]
  );

  // Called by the provider's statechange handler to mirror engine state.
  const onEngineState = useCallback((state: EngineState) => {
    if (state.selectedTrackId !== selectedTrackIdRef.current) {
      selectedTrackIdRef.current = state.selectedTrackId;
      setSelectedTrackIdState(state.selectedTrackId);
    }
  }, []);

  return {
    selectedTrackId,
    setSelectedTrackId,
    onEngineState,
    selectedTrackIdRef,
  };
}
