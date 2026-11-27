import { useState, useCallback, useEffect, useRef, type RefObject } from 'react';
import type { Arrangement, PlaylistEngine } from '@waveform-playlist/engine';

export interface UseSelectedTrackProps {
  engineRef: RefObject<PlaylistEngine | null>;
  /** The selected id names one of its tracks. */
  arrangement: Arrangement;
}

export interface SelectedTrackControls {
  selectedTrackId: string | null;
  setSelectedTrackId: (trackId: string | null) => void;
}

/**
 * The selected track id. This hook owns it (#826): the setter writes it
 * here, engine or not, and hands it to the engine there is. The provider
 * gives each new engine the value from the ref. Nothing is read back from an
 * engine.
 *
 * The id names a track of the arrangement: when that track is removed, taken
 * away by an undo, a redo or an abort, or given a new id, nothing is
 * selected. A `setTracks` that drops the track keeps the id. The engine has
 * the same rule for its own copy.
 */
export function useSelectedTrack({
  engineRef,
  arrangement,
}: UseSelectedTrackProps): SelectedTrackControls & {
  selectedTrackIdRef: React.RefObject<string | null>;
} {
  const [selectedTrackId, setSelectedTrackIdState] = useState<string | null>(null);

  // The value outside render: what a new engine is given.
  const selectedTrackIdRef = useRef<string | null>(null);

  const setSelectedTrackId = useCallback(
    (trackId: string | null) => {
      selectedTrackIdRef.current = trackId;
      setSelectedTrackIdState(trackId);
      engineRef.current?.selectTrack(trackId);
    },
    [engineRef]
  );

  useEffect(
    () =>
      arrangement.subscribe((change) => {
        // The engine's rule (`_onArrangementChange`): a removal, an undo, a
        // redo or an abort, and a track given a new id. Not `setTracks`: a
        // host may empty the tracks and add them again. An arrangement made
        // by an older copy of the engine package says nothing about the
        // change: then every change is looked at.
        const type: string | undefined = change?.type;
        const mayTakeTrackAway =
          type === undefined || type === 'remove' || type === 'restore' || type === 'update';
        if (!mayTakeTrackAway) return;
        const selected = selectedTrackIdRef.current;
        if (selected === null) return;
        if (arrangement.getTracks().some((track) => track.id === selected)) return;
        setSelectedTrackId(null);
      }),
    [arrangement, setSelectedTrackId]
  );

  return {
    selectedTrackId,
    setSelectedTrackId,
    selectedTrackIdRef,
  };
}
