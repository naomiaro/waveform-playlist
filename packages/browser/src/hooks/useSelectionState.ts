import { useState, useCallback, useRef, type RefObject } from 'react';
import type { PlaylistEngine, EngineState } from '@waveform-playlist/engine';

export interface UseSelectionStateProps {
  engineRef: RefObject<PlaylistEngine | null>;
}

export interface SelectionControls {
  selectionStart: number;
  selectionEnd: number;
  setSelection: (start: number, end: number) => void;
  selectionStartRef: React.RefObject<number>;
  selectionEndRef: React.RefObject<number>;
}

/**
 * Hook for managing selection state via PlaylistEngine delegation.
 *
 * setSelection delegates to the engine. State is mirrored back from
 * the engine via onEngineState(), which the provider's statechange
 * handler calls on every engine event.
 *
 * Note: The provider wraps this setter with playback side-effects
 * (updating currentTime, restarting playback). This hook only handles
 * the engine delegation + state mirroring.
 */
export function useSelectionState({ engineRef }: UseSelectionStateProps): SelectionControls & {
  onEngineState: (state: EngineState) => void;
} {
  const [selectionStart, setSelectionStartState] = useState(0);
  const [selectionEnd, setSelectionEndState] = useState(0);

  // Internal refs for statechange guard + engine seeding on rebuild.
  const selectionStartRef = useRef(0);
  const selectionEndRef = useRef(0);

  const setSelection = useCallback(
    (start: number, end: number) => {
      engineRef.current?.setSelection(start, end);
    },
    [engineRef]
  );

  // Called by the provider's statechange handler to mirror engine state.
  const onEngineState = useCallback((state: EngineState) => {
    if (state.selectionStart !== selectionStartRef.current) {
      selectionStartRef.current = state.selectionStart;
      setSelectionStartState(state.selectionStart);
    }
    if (state.selectionEnd !== selectionEndRef.current) {
      selectionEndRef.current = state.selectionEnd;
      setSelectionEndState(state.selectionEnd);
    }
  }, []);

  return {
    selectionStart,
    selectionEnd,
    setSelection,
    selectionStartRef,
    selectionEndRef,
    onEngineState,
  };
}
