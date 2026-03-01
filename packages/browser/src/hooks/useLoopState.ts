import { useState, useCallback, useRef, type RefObject } from 'react';
import type { PlaylistEngine, EngineState } from '@waveform-playlist/engine';

export interface UseLoopStateProps {
  engineRef: RefObject<PlaylistEngine | null>;
}

export interface LoopControls {
  isLoopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  setLoopEnabled: (value: boolean) => void;
  setLoopRegion: (start: number, end: number) => void;
  clearLoopRegion: () => void;
  isLoopEnabledRef: React.RefObject<boolean>;
  loopStartRef: React.RefObject<number>;
  loopEndRef: React.RefObject<number>;
}

/**
 * Hook for managing loop state via PlaylistEngine delegation.
 *
 * setLoopEnabled, setLoopRegion, and clearLoopRegion delegate to the
 * engine. State is mirrored back from the engine via onEngineState(),
 * which the provider's statechange handler calls on every engine event.
 */
export function useLoopState({ engineRef }: UseLoopStateProps): LoopControls & {
  onEngineState: (state: EngineState) => void;
} {
  const [isLoopEnabled, setIsLoopEnabledState] = useState(false);
  const [loopStart, setLoopStartState] = useState(0);
  const [loopEnd, setLoopEndState] = useState(0);

  // Internal refs for statechange guard + animation loop reads.
  const isLoopEnabledRef = useRef(false);
  const loopStartRef = useRef(0);
  const loopEndRef = useRef(0);

  const setLoopEnabled = useCallback(
    (value: boolean) => {
      engineRef.current?.setLoopEnabled(value);
    },
    [engineRef]
  );

  const setLoopRegion = useCallback(
    (start: number, end: number) => {
      engineRef.current?.setLoopRegion(start, end);
    },
    [engineRef]
  );

  const clearLoopRegion = useCallback(() => {
    engineRef.current?.setLoopRegion(0, 0);
  }, [engineRef]);

  // Called by the provider's statechange handler to mirror engine state.
  const onEngineState = useCallback((state: EngineState) => {
    if (state.isLoopEnabled !== isLoopEnabledRef.current) {
      isLoopEnabledRef.current = state.isLoopEnabled;
      setIsLoopEnabledState(state.isLoopEnabled);
    }
    if (state.loopStart !== loopStartRef.current) {
      loopStartRef.current = state.loopStart;
      setLoopStartState(state.loopStart);
    }
    if (state.loopEnd !== loopEndRef.current) {
      loopEndRef.current = state.loopEnd;
      setLoopEndState(state.loopEnd);
    }
  }, []);

  return {
    isLoopEnabled,
    loopStart,
    loopEnd,
    setLoopEnabled,
    setLoopRegion,
    clearLoopRegion,
    isLoopEnabledRef,
    loopStartRef,
    loopEndRef,
    onEngineState,
  };
}
