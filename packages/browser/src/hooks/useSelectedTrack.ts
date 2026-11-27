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
 * The id names a track of the arrangement: when that track is gone, nothing
 * is selected (the engine has the same rule for its own copy).
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

  useEffect(() => {
    const clearIfGone = () => {
      const selected = selectedTrackIdRef.current;
      if (selected === null) return;
      if (arrangement.getTracks().some((track) => track.id === selected)) return;
      setSelectedTrackId(null);
    };
    // A track removed between the render and this effect.
    clearIfGone();
    return arrangement.subscribe(clearIfGone);
  }, [arrangement, setSelectedTrackId]);

  return {
    selectedTrackId,
    setSelectedTrackId,
    selectedTrackIdRef,
  };
}
