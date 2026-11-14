/**
 * A loading clip names audio; a MIDI track holds only MIDI clips. Resolution
 * leaves such a clip out of both lists (`resolveTracks`, `rejected`), and this
 * reports it through `onError`, once per clip object, from an effect.
 */

import { useEffect, useRef, useState } from 'react';
import type { PlaylistTrack } from '@waveform-playlist/core';
import type { RejectedClip } from '../utils/resolveTracks';

export function useReportRejectedClips(
  rejected: readonly RejectedClip[],
  tracks: PlaylistTrack[],
  onError: ((error: Error) => void) | undefined
): void {
  const latestRef = useRef({ tracks, onError });
  latestRef.current = { tracks, onError };
  const [reported] = useState(() => new WeakSet<object>());

  useEffect(() => {
    for (const { trackId, clipId } of rejected) {
      const track = latestRef.current.tracks.find((candidate) => candidate.id === trackId);
      const clip = track?.clips.find((candidate) => candidate.id === clipId);
      if (!clip || reported.has(clip)) continue;
      reported.add(clip);
      const message =
        `Clip "${clipId}" on MIDI track "${trackId}" names audio to load (src). ` +
        'A MIDI track holds only MIDI clips; the clip is left out.';
      console.warn('[waveform-playlist] ' + message);
      latestRef.current.onError?.(new Error(message));
    }
  }, [rejected, reported]);
}
