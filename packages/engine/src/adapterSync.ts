/**
 * AdapterSync — keeps a PlayoutAdapter in step with an arrangement.
 *
 * The engine subscribes to its arrangement and hands each change here; this
 * makes the adapter call for it. It also holds the projection the adapter
 * and `getState()` are given: the arrangement's tracks with the current
 * mixer values in their fields. Everything here is derived from the
 * arrangement or is bookkeeping about what the adapter was sent; nothing is
 * written back.
 */

import type { ClipTrack } from '@waveform-playlist/core';
import type {
  ArrangementChange,
  ArrangementImpl,
  ArrangementVersions,
} from './arrangement/Arrangement';
import { freezeTrackInDevelopment, freezeTracksInDevelopment } from './arrangement/devFreeze';
import { withMixerValues } from './arrangement/mixer';
import type { TrackMixerValues } from './arrangement/mixer';
import type { PlayoutAdapter } from './types';

/** A change to the tracks: the ones that can need an adapter track call. */
export type TracksChange = Exclude<ArrangementChange, { type: 'mixer' | 'reorder' | 'history' }>;

export class AdapterSync {
  /**
   * The `tracksVersion` of each change made with `skipAdapter`. A change is
   * delivered later than it is made when it comes from inside a listener, so
   * the mark travels with the change's version, not with the call.
   */
  private _skipAt = new Set<number>();
  /**
   * The arrangement's `tracksVersion` when the adapter was last sent every
   * track. A change that is delivered later than it was made (from inside a
   * listener) may already be in what the adapter was sent.
   */
  private _syncedTracksVersion = -1;
  /**
   * An adapter call for a track change threw, so what the adapter holds is
   * not known: the next track change sends it every track.
   */
  private _needsAllTracks = false;
  private _projection: {
    tracksVersion: number;
    mixerVersion: number;
    tracks: readonly ClipTrack[];
  } | null = null;
  private _withMixMemo = new WeakMap<
    ClipTrack,
    { values: TrackMixerValues | undefined; merged: ClipTrack }
  >();

  constructor(
    private readonly _arrangement: ArrangementImpl,
    private readonly _adapter: PlayoutAdapter | null
  ) {}

  /**
   * The arrangement's tracks with the current mixer values in their fields:
   * what every adapter track call and `getState().tracks` use. The same
   * array until the tracks or the mix change, and the same track object
   * while neither that track nor its mix changed.
   */
  tracks(): readonly ClipTrack[] {
    const { tracksVersion, mixerVersion } = this._arrangement;
    const cached = this._projection;
    if (cached && cached.tracksVersion === tracksVersion && cached.mixerVersion === mixerVersion) {
      return cached.tracks;
    }
    const tracks = freezeTracksInDevelopment(
      this._arrangement.getTracks().map((track) => this._withMix(track))
    );
    this._projection = { tracksVersion, mixerVersion, tracks };
    return tracks;
  }

  /** When an engine attaches: send the tracks that are there. With none, the adapter is in step as it is. */
  sendInitialTracks(): void {
    if (this._arrangement.getTracks().length > 0) {
      this.sendAllTracks();
    } else {
      this._syncedTracksVersion = this._arrangement.tracksVersion;
    }
  }

  /** Send the adapter every track, and remember up to which change that covers. */
  sendAllTracks(): void {
    const version = this._arrangement.tracksVersion;
    this._adapter?.setTracks(this.tracks());
    // Only now: a send that threw has covered nothing.
    this._syncedTracksVersion = version;
  }

  /** Send the arrangement's current track to the adapter. False when there is no such track. */
  sendTrack(trackId: string): boolean {
    const track = this._arrangement.getTracks().find((t) => t.id === trackId);
    if (!track) return false;
    if (this._adapter?.updateTrack) {
      this._adapter.updateTrack(trackId, this._withMix(track));
    } else {
      this.sendAllTracks();
    }
    return true;
  }

  /** A mixer value changed: the adapter's setter for it. */
  sendMixerValues(trackId: string, values: Partial<TrackMixerValues>): void {
    if (values.volume !== undefined) this._adapter?.setTrackVolume(trackId, values.volume);
    if (values.muted !== undefined) this._adapter?.setTrackMute(trackId, values.muted);
    if (values.soloed !== undefined) this._adapter?.setTrackSolo(trackId, values.soloed);
    if (values.pan !== undefined) this._adapter?.setTrackPan(trackId, values.pan);
  }

  /**
   * The adapter call for a change to the tracks.
   *
   * A change made from inside a listener is delivered later than it was
   * made. If the tracks have changed again by then, what this change did
   * cannot be told from the current tracks alone: the adapter is sent every
   * track, once, and the changes still waiting are then already sent.
   */
  follow(change: TracksChange, at: ArrangementVersions): void {
    const skipped = change.type === 'update' && this._skipAt.delete(at.tracksVersion);
    if (skipped || at.tracksVersion <= this._syncedTracksVersion) return;
    const needsAllTracks = this._needsAllTracks;
    // Until the calls below have returned, the adapter's state is not known.
    this._needsAllTracks = true;
    if (needsAllTracks || at.tracksVersion < this._arrangement.tracksVersion) {
      this.sendAllTracks();
    } else {
      this._sendChange(change);
    }
    this._needsAllTracks = false;
  }

  /**
   * Before a change made with `skipAdapter`: mark the version that change
   * will have. Returns the mark, or null without `skipAdapter`.
   */
  markSkip(skipAdapter: boolean): number | null {
    if (!skipAdapter) return null;
    const mark = this._arrangement.tracksVersion + 1;
    this._skipAt.add(mark);
    return mark;
  }

  /** After the call: a call that changed nothing has no change to carry its mark. */
  unmarkIfUnchanged(mark: number | null): void {
    if (mark !== null && this._arrangement.tracksVersion < mark) {
      this._skipAt.delete(mark);
    }
  }

  /** One change, made just now, as the adapter call that brings it in step. */
  private _sendChange(change: TracksChange): void {
    switch (change.type) {
      case 'set':
        this.sendAllTracks();
        break;
      case 'add':
        this._addTrack(change.trackId);
        break;
      case 'remove':
        if (this._adapter?.removeTrack) {
          this._adapter.removeTrack(change.trackId);
        } else {
          this.sendAllTracks();
        }
        break;
      case 'update':
        // A track that was given a new id is not found under the old one.
        if (!this.sendTrack(change.trackId)) this.sendAllTracks();
        break;
      case 'restore':
        this._restore(change.previous);
        break;
      case 'recompute':
        // Use incremental updates to avoid full playout rebuild during playback
        for (const track of this._arrangement.getTracks()) {
          this.sendTrack(track.id);
        }
        break;
    }
  }

  private _addTrack(trackId: string): void {
    const track = this._arrangement.getTracks().find((t) => t.id === trackId);
    if (track && this._adapter?.addTrack) {
      this._adapter.addTrack(this._withMix(track));
    } else {
      this.sendAllTracks();
    }
  }

  /**
   * After an undo, a redo or an abort. Use incremental adapter updates when
   * the same tracks are there before and after — avoids full playout rebuild
   * that interrupts playback. A track the restore did not touch is the same
   * object in both states and is skipped; so is a change of order only.
   */
  private _restore(previous: readonly ClipTrack[]): void {
    const restored = this._arrangement.getTracks();
    const oldById = new Map(previous.map((t) => [t.id, t]));
    const sameSet = previous.length === restored.length && restored.every((t) => oldById.has(t.id));
    if (this._adapter && sameSet) {
      for (const track of restored) {
        if (oldById.get(track.id) !== track) {
          this.sendTrack(track.id);
        }
      }
    } else {
      this.sendAllTracks();
    }
  }

  /** One track with its current mixer values in its fields (memoized per track object). */
  private _withMix(track: ClipTrack): ClipTrack {
    const values = this._arrangement.getMixer().get(track.id);
    const memo = this._withMixMemo.get(track);
    if (memo && memo.values === values) return memo.merged;
    const merged = freezeTrackInDevelopment(withMixerValues(track, values));
    this._withMixMemo.set(track, { values, merged });
    return merged;
  }
}
