import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import type { DawClipSplitDetail } from '../events';

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

/** Narrow engine contract for split operations. */
export interface SplitEngineContract {
  getState(): { selectedTrackId: string | null; tracks: ClipTrack[] };
  splitClip(trackId: string, clipId: string, atSample: number): void;
}

/** Host interface for splitAtPlayhead. */
export interface SplitHost {
  readonly effectiveSampleRate: number;
  readonly currentTime: number;
  readonly isPlaying: boolean;
  readonly engine: SplitEngineContract | null;
  dispatchEvent(event: Event): boolean;
  stop(): void;
  play(time: number): void;
}

// ---------------------------------------------------------------------------
// splitAtPlayhead
// ---------------------------------------------------------------------------

/**
 * Split the clip under the playhead on the selected track.
 * Stops playback before split and resumes after to avoid duplicate audio
 * from Transport rescheduling during playback.
 *
 * Returns true if the split occurred and dispatched a daw-clip-split event.
 * Returns false for any guard failure or engine no-op.
 */
export function splitAtPlayhead(host: SplitHost): boolean {
  const wasPlaying = host.isPlaying;
  const time = host.currentTime;

  // Check guards before stopping playback — don't interrupt audio for a no-op
  if (!canSplitAtTime(host, time)) return false;

  if (wasPlaying) {
    host.stop();
  }

  let result: boolean;
  try {
    result = performSplit(host, time);
  } catch (err) {
    console.warn('[dawcore] splitAtPlayhead failed: ' + String(err));
    result = false;
  }

  // Always resume if was playing — even on failed split, don't leave audio stopped
  if (wasPlaying) {
    host.play(time);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

/** Pre-flight check — can a split happen at this time without touching playback? */
function canSplitAtTime(host: SplitHost, time: number): boolean {
  const { engine } = host;
  if (!engine) return false;

  const state = engine.getState();
  if (!state.selectedTrackId) return false;

  const track = state.tracks.find((t) => t.id === state.selectedTrackId);
  if (!track) return false;

  const atSample = Math.round(time * host.effectiveSampleRate);
  return !!findClipAtSample(track.clips, atSample);
}

/** Core split logic — finds clip at position, calls engine, diffs state for new IDs. */
function performSplit(host: SplitHost, time: number): boolean {
  const { engine } = host;
  if (!engine) return false;

  const stateBefore = engine.getState();
  const { selectedTrackId, tracks } = stateBefore;

  if (!selectedTrackId) return false;

  const track = tracks.find((t) => t.id === selectedTrackId);
  if (!track) return false;

  const atSample = Math.round(time * host.effectiveSampleRate);

  const clip = findClipAtSample(track.clips, atSample);
  if (!clip) return false;

  const originalClipId = clip.id;
  const clipIdsBefore = new Set(track.clips.map((c) => c.id));

  engine.splitClip(selectedTrackId, originalClipId, atSample);

  const stateAfter = engine.getState();
  const trackAfter = stateAfter.tracks.find((t) => t.id === selectedTrackId);
  if (!trackAfter) {
    console.warn(
      '[dawcore] splitAtPlayhead: track "' + selectedTrackId + '" disappeared after split'
    );
    return false;
  }

  // Engine replaces the original clip with two halves; both get new IDs
  const newClips = trackAfter.clips.filter((c) => !clipIdsBefore.has(c.id));
  if (newClips.length !== 2) {
    if (newClips.length > 0) {
      console.warn(
        '[dawcore] splitAtPlayhead: expected 2 new clips after split but got ' + newClips.length
      );
    }
    return false;
  }

  // Sort by startSample: lower = left, higher = right
  const sorted = [...newClips].sort((a, b) => a.startSample - b.startSample);
  const leftClipId = sorted[0].id;
  const rightClipId = sorted[1].id;

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

/**
 * Finds a clip that strictly contains the given sample position.
 * The position must be > clip.startSample and < clip.startSample + clip.durationSamples.
 */
function findClipAtSample(clips: AudioClip[], atSample: number): AudioClip | undefined {
  return clips.find(
    (c) => atSample > c.startSample && atSample < c.startSample + c.durationSamples
  );
}
