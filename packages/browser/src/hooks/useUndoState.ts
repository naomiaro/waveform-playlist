import { useState, useCallback, useRef, type RefObject } from 'react';
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
 *
 * No refs are exposed for engine seeding — undo history intentionally
 * resets on engine rebuild (setTracks calls clearHistory).
 */
export function useUndoState({ engineRef }: UseUndoStateProps): UndoControls & {
  onEngineState: (state: EngineState) => void;
} {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Internal refs for statechange guard (same pattern as useSelectionState etc.)
  const canUndoRef = useRef(false);
  const canRedoRef = useRef(false);

  const undo = useCallback(() => {
    if (!engineRef.current) {
      console.warn('[waveform-playlist] undo: engine not ready, call ignored');
      return;
    }
    engineRef.current.undo();
  }, [engineRef]);

  const redo = useCallback(() => {
    if (!engineRef.current) {
      console.warn('[waveform-playlist] redo: engine not ready, call ignored');
      return;
    }
    engineRef.current.redo();
  }, [engineRef]);

  // Called by the provider's statechange handler to mirror engine state.
  const onEngineState = useCallback((state: EngineState) => {
    if (state.canUndo !== canUndoRef.current) {
      canUndoRef.current = state.canUndo;
      setCanUndo(state.canUndo);
    }
    if (state.canRedo !== canRedoRef.current) {
      canRedoRef.current = state.canRedo;
      setCanRedo(state.canRedo);
    }
  }, []);

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    onEngineState,
  };
}
