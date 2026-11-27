import { useState, useCallback, useRef, type RefObject } from 'react';
import type { PlaylistEngine } from '@waveform-playlist/engine';

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
 * The loop (on or off, and its region in seconds). This hook owns it (#826):
 * the setters write it here, engine or not, and hand it to the engine there
 * is, which gives it to its adapter. The provider gives each new engine the
 * value from the refs. Nothing is read back from an engine.
 */
export function useLoopState({ engineRef }: UseLoopStateProps): LoopControls {
  const [isLoopEnabled, setIsLoopEnabledState] = useState(false);
  const [loopStart, setLoopStartState] = useState(0);
  const [loopEnd, setLoopEndState] = useState(0);

  // The value outside render: the animation loop, and what a new engine is given.
  const isLoopEnabledRef = useRef(false);
  const loopStartRef = useRef(0);
  const loopEndRef = useRef(0);

  const setLoopEnabled = useCallback(
    (value: boolean) => {
      isLoopEnabledRef.current = value;
      setIsLoopEnabledState(value);
      engineRef.current?.setLoopEnabled(value);
    },
    [engineRef]
  );

  const setLoopRegion = useCallback(
    (start: number, end: number) => {
      const from = Math.min(start, end);
      const to = Math.max(start, end);
      loopStartRef.current = from;
      loopEndRef.current = to;
      setLoopStartState(from);
      setLoopEndState(to);
      engineRef.current?.setLoopRegion(from, to);
    },
    [engineRef]
  );

  const clearLoopRegion = useCallback(() => setLoopRegion(0, 0), [setLoopRegion]);

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
  };
}
