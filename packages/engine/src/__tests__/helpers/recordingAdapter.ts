import type { ClipTrack } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '../../types';

/** A track as an adapter call names it: its id and the ids of its clips, in order. */
export interface TrackSummary {
  id: string;
  clips: string[];
}

export interface AdapterCall {
  method: string;
  /** Track arguments are summarised when the call is made; other arguments are passed as given. */
  args: unknown[];
}

export interface RecordingAdapterOptions {
  /**
   * `false` leaves out the three optional track methods (`addTrack`,
   * `removeTrack`, `updateTrack`), so the engine falls back to `setTracks`.
   */
  incremental?: boolean;
  /** What `setTempo` returns. `false` refuses the tempo. Left out: no `setTempo` method. */
  setTempoResult?: boolean | 'void';
}

export interface RecordingAdapter extends PlayoutAdapter {
  /** Every track, mixer and tempo call, in the order it was made. */
  readonly calls: AdapterCall[];
  /** The arguments of the same calls, as the objects that were passed. */
  readonly rawCalls: AdapterCall[];
  /** Forget the calls made so far. */
  reset(): void;
}

export function summarize(track: ClipTrack): TrackSummary {
  return { id: track.id, clips: track.clips.map((clip) => clip.id) };
}

/**
 * A fake `PlayoutAdapter` that records what it is called with.
 * Transport methods do nothing and are not recorded.
 */
export function recordingAdapter(options: RecordingAdapterOptions = {}): RecordingAdapter {
  const { incremental = true, setTempoResult } = options;
  const calls: AdapterCall[] = [];
  const rawCalls: AdapterCall[] = [];

  const record = (method: string, raw: unknown[], summary: unknown[] = raw): void => {
    calls.push({ method, args: summary });
    rawCalls.push({ method, args: raw });
  };

  const adapter: RecordingAdapter = {
    calls,
    rawCalls,
    reset() {
      calls.length = 0;
      rawCalls.length = 0;
    },
    audioContext: {} as AudioContext,
    ppqn: 960,
    init: async () => {},
    setTracks(tracks) {
      record('setTracks', [tracks], [tracks.map(summarize)]);
    },
    play() {},
    pause() {},
    stop() {},
    seek() {},
    getCurrentTime: () => 0,
    isPlaying: () => false,
    setMasterVolume() {},
    setTrackVolume(trackId, volume) {
      record('setTrackVolume', [trackId, volume]);
    },
    setTrackMute(trackId, muted) {
      record('setTrackMute', [trackId, muted]);
    },
    setTrackSolo(trackId, soloed) {
      record('setTrackSolo', [trackId, soloed]);
    },
    setTrackPan(trackId, pan) {
      record('setTrackPan', [trackId, pan]);
    },
    setLoop() {},
    dispose() {},
  };

  if (incremental) {
    adapter.addTrack = (track) => {
      record('addTrack', [track], [summarize(track)]);
    };
    adapter.removeTrack = (trackId) => {
      record('removeTrack', [trackId]);
    };
    adapter.updateTrack = (trackId, track) => {
      record('updateTrack', [trackId, track], [trackId, summarize(track)]);
    };
  }

  if (setTempoResult !== undefined) {
    adapter.setTempo = (bpm, atTick) => {
      record('setTempo', [bpm, atTick]);
      return setTempoResult === 'void' ? undefined : setTempoResult;
    };
  }

  return adapter;
}
