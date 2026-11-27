import { useState, useCallback, useRef, type RefObject } from 'react';
import type { PlaylistEngine } from '@waveform-playlist/engine';

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
 * The selection (start and end, in seconds). This hook owns it (#826): the
 * setter writes it here, engine or not, and hands it to the engine there is.
 * The provider gives each new engine the value from the refs. Nothing is
 * read back from an engine.
 *
 * Note: The provider wraps this setter with playback side-effects
 * (updating currentTime, restarting playback).
 */
export function useSelectionState({ engineRef }: UseSelectionStateProps): SelectionControls {
  const [selectionStart, setSelectionStartState] = useState(0);
  const [selectionEnd, setSelectionEndState] = useState(0);

  // The value outside render: the animation loop, and what a new engine is given.
  const selectionStartRef = useRef(0);
  const selectionEndRef = useRef(0);

  const setSelection = useCallback(
    (start: number, end: number) => {
      const from = Math.min(start, end);
      const to = Math.max(start, end);
      selectionStartRef.current = from;
      selectionEndRef.current = to;
      setSelectionStartState(from);
      setSelectionEndState(to);
      engineRef.current?.setSelection(from, to);
    },
    [engineRef]
  );

  return {
    selectionStart,
    selectionEnd,
    setSelection,
    selectionStartRef,
    selectionEndRef,
  };
}
