/**
 * The editor's load events, read from its arrangement (#848): the tracks
 * (which clips are still loading) and `sources` (which sources failed). Each
 * event is sent once per transition. The announcer remembers what it last
 * announced, so that a statechange and a sources change telling of the same
 * transition do not both dispatch, and so that a track that comes back by an
 * undo or a redo is not announced again.
 *
 * - `daw-clip-error` when a clip's source goes into failed (again after a
 *   retry that fails, since the error is a new object).
 * - `daw-clip-ready` when a clip that was loading has loaded.
 * - `daw-track-ready` when no clip of the track is pending and one loaded,
 *   or the track asked for no audio; again after a retry loads it.
 * - `daw-track-error` when every clip of the track failed, also when they
 *   were refused for their kind (the track stays, like a broken `<img>`).
 */
import { isLoadingClip } from '@waveform-playlist/core';
import type { ArrangementTrack, ClipSource } from '@waveform-playlist/core';
import type { ArrangementSourceState } from '@waveform-playlist/engine';
import type {
  DawClipErrorDetail,
  DawClipIdDetail,
  DawTrackErrorDetail,
  DawTrackIdDetail,
} from '../events';

type TrackLoadState = 'pending' | 'ready' | 'failed';

interface TrackRecord {
  state: TrackLoadState | null;
  /** Clips refused for their kind when the track entered (never in the arrangement). */
  refused: number;
  /** What `daw-track-error` carried, while the track is failed. */
  error?: Error;
}

export class LoadAnnouncer {
  private _tracks = new Map<string, TrackRecord>();
  /** The failure each clip was last announced with. */
  private _clipErrors = new Map<string, Error>();
  /** Clips seen while loading, and not yet announced as loaded. */
  private _loadingClips = new Set<string>();

  constructor(private readonly _dispatch: (event: Event) => void) {}

  /** A track is about to enter, with `refused` clips left out for their kind. */
  expect(trackId: string, refused: number): void {
    this._tracks.set(trackId, { state: null, refused });
  }

  /**
   * A clip is about to enter while loading: it is announced ready when it
   * loads, also when its source was loaded already and it is never seen
   * loading.
   */
  expectClip(clipId: string): void {
    this._loadingClips.add(clipId);
  }

  /** The error a failed track was announced with. */
  errorOf(trackId: string): Error {
    return this._tracks.get(trackId)?.error ?? new Error('track "' + trackId + '" failed to load');
  }

  /** A track was removed by the page or an editor method: nothing more is said of it. */
  forget(trackId: string, clipIds: Iterable<string>): void {
    this._tracks.delete(trackId);
    for (const id of clipIds) {
      this._clipErrors.delete(id);
      this._loadingClips.delete(id);
    }
  }

  /** The state a track was last announced in (`null` before its first announcement). */
  stateOf(trackId: string): TrackLoadState | null {
    return this._tracks.get(trackId)?.state ?? null;
  }

  update(
    tracks: readonly ArrangementTrack[],
    sources: ReadonlyMap<ClipSource, ArrangementSourceState>
  ): void {
    for (const track of tracks) this._updateTrack(track, sources);
  }

  private _updateTrack(
    track: ArrangementTrack,
    sources: ReadonlyMap<ClipSource, ArrangementSourceState>
  ): void {
    const record = this._tracks.get(track.id) ?? { state: null, refused: 0 };
    this._tracks.set(track.id, record);
    let pending = 0;
    let failed = 0;
    let loaded = 0;
    let firstError: Error | null = null;
    for (const clip of track.clips) {
      if (!isLoadingClip(clip)) {
        loaded++;
        if (this._loadingClips.delete(clip.id)) {
          this._clipErrors.delete(clip.id);
          this._send<DawClipIdDetail>('daw-clip-ready', { trackId: track.id, clipId: clip.id });
        }
        continue;
      }
      this._loadingClips.add(clip.id);
      const source = sources.get(clip.src);
      if (source?.status !== 'failed') {
        pending++;
        this._clipErrors.delete(clip.id);
        continue;
      }
      failed++;
      const error = source.error ?? new Error('the audio of clip "' + clip.id + '" failed to load');
      firstError ??= error;
      if (this._clipErrors.get(clip.id) !== error) {
        this._clipErrors.set(clip.id, error);
        this._send<DawClipErrorDetail>('daw-clip-error', {
          trackId: track.id,
          clipId: clip.id,
          error,
        });
      }
    }
    const next: TrackLoadState =
      pending > 0 ? 'pending' : loaded > 0 || failed + record.refused === 0 ? 'ready' : 'failed';
    if (next === record.state) return;
    record.state = next;
    record.error = undefined;
    if (next === 'ready') {
      this._send<DawTrackIdDetail>('daw-track-ready', { trackId: track.id });
    } else if (next === 'failed') {
      const requested = failed + record.refused;
      const error =
        requested === 1 && firstError
          ? firstError
          : new Error(
              'all ' + requested + ' clip(s) failed to load — see prior daw-clip-error events'
            );
      record.error = error;
      this._send<DawTrackErrorDetail>('daw-track-error', { trackId: track.id, error });
    }
  }

  private _send<T>(type: string, detail: T): void {
    this._dispatch(new CustomEvent<T>(type, { bubbles: true, composed: true, detail }));
  }
}
