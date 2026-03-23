import { useState, useCallback, type RefObject } from 'react';
import type { PlaylistEngine, EngineState } from '@waveform-playlist/engine';

export interface UseUndoStateProps {
  engineRef: RefObject<PlaylistEngine | null>;
}

export interface UndoControls {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
}

/**
 * Hook for managing undo/redo state via PlaylistEngine delegation.
 *
 * undo/redo delegate to the engine. canUndo/canRedo are mirrored back
 * from the engine via onEngineState(), which the provider's statechange
 * handler calls on every engine event.
 */
export function useUndoState({ engineRef }: UseUndoStateProps): UndoControls & {
  onEngineState: (state: EngineState) => void;
} {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const undo = useCallback(() => {
    engineRef.current?.undo();
  }, [engineRef]);

  const redo = useCallback(() => {
    engineRef.current?.redo();
  }, [engineRef]);

  // Called by the provider's statechange handler to mirror engine state.
  const onEngineState = useCallback((state: EngineState) => {
    setCanUndo((prev) => (prev !== state.canUndo ? state.canUndo : prev));
    setCanRedo((prev) => (prev !== state.canRedo ? state.canRedo : prev));
  }, []);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    onEngineState,
  };
}
