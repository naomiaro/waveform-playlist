/**
 * AdapterSync — keeps a PlayoutAdapter in step with an arrangement.
 *
 * The engine subscribes to its arrangement and hands each change here; this
 * makes the adapter call for it. It also holds the projection the adapter
 * and `getState()` are given: the arrangement's tracks without the clips
 * that are still loading and with the current mixer values in their fields
 * (the track a take is recording onto muted, #843). The adapter is given
 * that projection without the fields that say how a track is drawn (core's
 * `TRACK_VIEW_FIELDS`), and a change of those fields alone makes no adapter
 * call. Everything here is derived from the
 * arrangement or is bookkeeping about what the adapter was sent; nothing is
 * written back.
 */

import { isLoadingClip, TRACK_VIEW_FIELDS } from '@waveform-playlist/core';
import type {
  ArrangementTrack,
  AudioClip,
  ClipTrack,
  PanLaw,
  PlayoutTrack,
  TrackViewField,
} from '@waveform-playlist/core';
import type {
  ArrangementChange,
  ArrangementImpl,
  ArrangementVersions,
} from './arrangement/Arrangement';
import { freezeTrackInDevelopment, freezeTracksInDevelopment } from './arrangement/devFreeze';
import { mixerChanges, withMixerValues } from './arrangement/mixer';
import type { Mixer, TrackMixerValues } from './arrangement/mixer';
import type { PlayoutAdapter } from './types';

/** A change to the tracks: the ones that can need an adapter track call. */
export type TracksChange = Exclude<
  ArrangementChange,
  { type: 'mixer' | 'restoreMix' | 'recording' | 'reorder' | 'history' }
>;

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
    { values: TrackMixerValues | undefined; recording: boolean; merged: ClipTrack }
  >();
  /** Per track object of the arrangement that holds a loading clip: the track without them. */
  private _loadedMemo = new WeakMap<ArrangementTrack, ClipTrack>();

  constructor(
    private readonly _arrangement: ArrangementImpl,
    private readonly _adapter: PlayoutAdapter | null
  ) {}

  /**
   * The arrangement's tracks, each without its loading clips and with the
   * current mixer values in its fields (muted while a take records onto it): what every
   * adapter track call and `getState().tracks` use. The same
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
      this._arrangement.getTracks().map((track) => this._project(track))
    );
    this._projection = { tracksVersion, mixerVersion, tracks };
    return tracks;
  }

  /**
   * `tracks()` as the adapter is given them: without the view fields. Made
   * for each send; nothing depends on the adapter's tracks keeping their
   * identity between sends.
   */
  private _playoutTracks(): readonly PlayoutTrack[] {
    return freezeTracksInDevelopment(this.tracks().map((track) => this._playout(track)));
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
    this._adapter?.setTracks(this._playoutTracks());
    // Only now: a send that threw has covered nothing.
    this._syncedTracksVersion = version;
  }

  /** Send the arrangement's current track to the adapter. False when there is no such track. */
  sendTrack(trackId: string): boolean {
    const track = this._arrangement.getTracks().find((t) => t.id === trackId);
    if (!track) return false;
    if (this._adapter?.updateTrack) {
      this._adapter.updateTrack(trackId, this._playout(this._project(track)));
    } else {
      this.sendAllTracks();
    }
    return true;
  }

  /**
   * A mixer value changed: the adapter's setter for it. The mute sent is the
   * one the track plays with: muted while a take records onto the track,
   * whatever the value given.
   */
  sendMixerValues(trackId: string, values: Partial<TrackMixerValues>): void {
    if (values.volume !== undefined) this._adapter?.setTrackVolume(trackId, values.volume);
    if (values.muted !== undefined) {
      this._adapter?.setTrackMute(trackId, values.muted || this._recordingNow(trackId));
    }
    if (values.soloed !== undefined) this._adapter?.setTrackSolo(trackId, values.soloed);
    if (values.pan !== undefined) this._adapter?.setTrackPan(trackId, values.pan);
    if (values.panLaw !== undefined) this._sendPanLaw(trackId, values.panLaw);
  }

  /** The adapter's setter for a pan law, or, for an adapter without one, the track again (#684). */
  private _sendPanLaw(trackId: string, panLaw: PanLaw): void {
    if (!this._adapter) return;
    if (this._adapter.setTrackPanLaw) this._adapter.setTrackPanLaw(trackId, panLaw);
    else this.sendTrack(trackId);
  }

  /**
   * After an undo, a redo or an abort brought back another mix: the setter
   * for each field that differs, of each current track that had an entry in
   * `previousMixer` too. A track that entered with the restore was sent
   * whole, with its mix in its fields.
   */
  sendMixerDiff(previousMixer: Mixer): void {
    for (const { trackId, values } of mixerChanges(previousMixer, this._arrangement.getMixer())) {
      this.sendMixerValues(trackId, values);
    }
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
      // Clips of other tracks became loaded inside this change: those tracks
      // too, unless everything was just sent.
      if (at.switched && this._syncedTracksVersion < at.tracksVersion) this._restore(at.switched);
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
        if (this._playsTheSame(change.previous, change.trackId)) break;
        // A track that was given a new id is not found under the old one.
        if (!this.sendTrack(change.trackId)) this.sendAllTracks();
        break;
      case 'restore':
      case 'load':
        // After a load: each track that gained a clip (the rest plays the same).
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
      this._adapter.addTrack(this._playout(this._project(track)));
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
  private _restore(previous: readonly ArrangementTrack[]): void {
    const restored = this._arrangement.getTracks();
    const oldById = new Map(previous.map((t) => [t.id, t]));
    const sameSet = previous.length === restored.length && restored.every((t) => oldById.has(t.id));
    if (this._adapter && sameSet) {
      for (const track of restored) {
        // `sameSet`: every restored track has a track of its id in `previous`.
        const old = oldById.get(track.id) as ArrangementTrack;
        if (!this._playsTheSame(old, track.id)) this.sendTrack(track.id);
      }
    } else {
      this.sendAllTracks();
    }
  }

  /**
   * True when the arrangement's current track of that id is, for an adapter,
   * what `previous` was: the same loaded clip objects in the same order and
   * the same fields. Only its loading clips differ, and an adapter is not
   * given those, so there is nothing to send.
   */
  private _playsTheSame(previous: ArrangementTrack, trackId: string): boolean {
    const current = this._arrangement.getTracks().find((t) => t.id === trackId);
    if (!current) return false;
    if (current === previous) return true;
    const before = this._loaded(previous);
    const now = this._loaded(current);
    if (before.clips.length !== now.clips.length) return false;
    if (before.clips.some((clip, i) => clip !== now.clips[i])) return false;
    const keys = new Set([...Object.keys(before), ...Object.keys(now)]) as Set<keyof ClipTrack>;
    keys.delete('clips');
    // How a track is drawn is not what the adapter plays (TRACK_VIEW_FIELDS).
    for (const field of TRACK_VIEW_FIELDS) keys.delete(field);
    return [...keys].every((key) => Object.is(before[key], now[key]));
  }

  /** What `getState()` is given for one of the arrangement's tracks (an adapter: `_playout` of it). */
  private _project(track: ArrangementTrack): ClipTrack {
    return this._withMix(this._loaded(track));
  }

  /**
   * The track without the clips that are still loading: an adapter plays
   * loaded clips only. A track that holds none is the arrangement's own
   * object (memoized per track object otherwise).
   */
  private _loaded(track: ArrangementTrack): ClipTrack {
    const known = this._loadedMemo.get(track);
    if (known) return known;
    const clips = track.clips.filter((clip): clip is AudioClip => !isLoadingClip(clip));
    const loaded: ClipTrack =
      clips.length === track.clips.length ? (track as ClipTrack) : { ...track, clips };
    this._loadedMemo.set(track, loaded);
    return loaded;
  }

  /**
   * True when a take is recording onto the track and it is a current track
   * (it has an entry in the current mix): it plays muted. A recording id that
   * is not in the tracks mutes nothing until it enters.
   */
  private _recordingNow(trackId: string): boolean {
    return (
      this._arrangement.recordingTrackIds.has(trackId) && this._arrangement.getMixer().has(trackId)
    );
  }

  /** A projected track without its view fields: a copy that shares its clips. */
  private _playout(track: ClipTrack): PlayoutTrack {
    const copy: Partial<Pick<ClipTrack, TrackViewField>> & PlayoutTrack = { ...track };
    for (const field of TRACK_VIEW_FIELDS) delete copy[field];
    return freezeTrackInDevelopment(copy);
  }

  /**
   * One track with its current mixer values in its fields, muted while a
   * take records onto it (memoized per track object).
   */
  private _withMix(track: ClipTrack): ClipTrack {
    const values = this._arrangement.getMixer().get(track.id);
    const recording = this._recordingNow(track.id);
    const memo = this._withMixMemo.get(track);
    if (memo && memo.values === values && memo.recording === recording) return memo.merged;
    const playing = recording && values && !values.muted ? { ...values, muted: true } : values;
    const merged = freezeTrackInDevelopment(withMixerValues(track, playing));
    this._withMixMemo.set(track, { values, recording, merged });
    return merged;
  }
}
