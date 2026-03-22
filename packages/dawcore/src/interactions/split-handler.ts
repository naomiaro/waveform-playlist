import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import type { DawClipSplitDetail } from '../events';

// ---------------------------------------------------------------------------
// Host interface
// ---------------------------------------------------------------------------

export interface SplitHost {
  readonly effectiveSampleRate: number;
  readonly currentTime: number;
  readonly engine: {
    getState(): { selectedTrackId: string | null; tracks: ClipTrack[] };
    splitClip(trackId: string, clipId: string, atSample: number): void;
  } | null;
  dispatchEvent(event: Event): boolean;
}

// ---------------------------------------------------------------------------
// splitAtPlayhead
// ---------------------------------------------------------------------------

/**
 * Splits the clip under the playhead on the selected track.
 *
 * Returns true if the split occurred and dispatched a daw-clip-split event.
 * Returns false for any guard failure or engine no-op.
 */
export function splitAtPlayhead(host: SplitHost): boolean {
  const { engine } = host;
  if (!engine) return false;

  const stateBefore = engine.getState();
  const { selectedTrackId, tracks } = stateBefore;

  if (!selectedTrackId) return false;

  const track = tracks.find((t) => t.id === selectedTrackId);
  if (!track) return false;

  const atSample = Math.round(host.currentTime * host.effectiveSampleRate);

  const clip = findClipAtSample(track.clips, atSample);
  if (!clip) return false;

  const originalClipId = clip.id;
  const clipIdsBefore = new Set(track.clips.map((c) => c.id));

  engine.splitClip(selectedTrackId, originalClipId, atSample);

  const stateAfter = engine.getState();
  const trackAfter = stateAfter.tracks.find((t) => t.id === selectedTrackId);
  if (!trackAfter) return false;

  const newClips = trackAfter.clips.filter((c) => !clipIdsBefore.has(c.id));
  if (newClips.length !== 2) return false;

  // Sort by startSample: lower = left, higher = right
  const sorted = [...newClips].sort((a, b) => a.startSample - b.startSample);
  const leftClipId = sorted[0].id;
  const rightClipId = sorted[sorted.length - 1].id;

  host.dispatchEvent(
    new CustomEvent<DawClipSplitDetail>('daw-clip-split', {
      bubbles: true,
      composed: true,
      detail: {
        trackId: selectedTrackId,
        originalClipId,
        leftClipId,
        rightClipId,
      },
    })
  );

  return true;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Finds a clip that strictly contains the given sample position.
 * The position must be > clip.startSample and < clip.startSample + clip.durationSamples.
 */
function findClipAtSample(clips: AudioClip[], atSample: number): AudioClip | undefined {
  return clips.find(
    (c) => atSample > c.startSample && atSample < c.startSample + c.durationSamples
  );
}
