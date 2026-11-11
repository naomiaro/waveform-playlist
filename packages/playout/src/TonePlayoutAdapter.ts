import type { ClipTrack, Track } from '@waveform-playlist/core';
import {
  clipStartTime,
  clipEndTime,
  clipOffsetTime,
  clipDurationTime,
  trackChannelCount,
  trackKind,
} from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import { TonePlayout } from './TonePlayout';
import type { EffectsFunction } from './TonePlayout';
import type { ClipInfo, TrackEffectsFunction } from './ToneTrack';
import type { MidiClipInfo } from './MidiToneTrack';
import type { SoundFontCache } from './SoundFontCache';
import { now } from 'tone';
import { getGlobalAudioContext, getGlobalContext, isNativeGlobalContext } from './audioContext';

export interface ToneAdapterOptions {
  /** Master effects chain. */
  effects?: EffectsFunction;
  /**
   * Returns the effects function of a track, or `undefined` for none. Called
   * with the track's id each time the adapter builds that track's audio graph:
   * `setTracks`, `addTrack`, a SoundFont swap, and an `updateTrack` that
   * builds rather than edits in place (a MIDI track, or an audio track that
   * had no clips before). An `updateTrack` that only changes the clips of an
   * existing audio track keeps its graph and does not ask.
   */
  trackEffects?: (trackId: string) => TrackEffectsFunction | undefined;
  /** When provided, MIDI clips use SoundFont sample playback instead of PolySynth */
  soundFontCache?: SoundFontCache;
  /** Pulses per quarter note. Defaults to 192 (Tone.js native). */
  ppqn?: number;
}

/**
 * Effects wiring hooks consumed by dawcore's EffectsManager (structural match
 * for its EffectsTransportLike). All hooks require native-context mode —
 * effect chains carry native AudioNodes (incl. WAM worklets) that cannot join
 * a standardized-audio-context graph.
 */
export interface ToneEffectsTransport {
  /** Pre-fader track insert: clips → input … output → volume → pan → mute. */
  connectTrackEffects(trackId: string, input: AudioNode, output: AudioNode): void;
  disconnectTrackEffects(trackId: string): void;
  connectMasterOutput(node: AudioNode): void;
  disconnectMasterOutput(): void;
  readonly masterOutputNode: AudioNode;
}

export interface ToneAdapter extends PlayoutAdapter {
  /**
   * Provide or swap the SoundFont after creation. Rebuilds only the MIDI
   * tracks whose routing changes; audio tracks keep playing untouched.
   * Pass undefined to revert MIDI tracks to PolySynth synthesis.
   */
  setSoundFontCache(cache: SoundFontCache | undefined): void;
  /** Effects wiring hooks (dawcore EffectsManager). Requires native-context mode. */
  readonly transport: ToneEffectsTransport;
}

/**
 * Capability check for Tone-specific adapter features. Structural, not
 * instanceof — any adapter implementing setSoundFontCache passes. Narrows a
 * generic PlayoutAdapter so soundfont calls typecheck without casts.
 */
export function isToneAdapter(adapter: PlayoutAdapter | null | undefined): adapter is ToneAdapter {
  return typeof (adapter as Partial<ToneAdapter>)?.setSoundFontCache === 'function';
}

export function createToneAdapter(options?: ToneAdapterOptions): ToneAdapter {
  // Ensure the global shared context exists BEFORE creating the playout.
  // Without this, TonePlayout's Volume is created on Tone's default context,
  // which is replaced by getGlobalContext() later — causing cross-context errors.
  getGlobalContext();

  let _playoutGeneration = 1;
  let playout: TonePlayout | null = new TonePlayout({ effects: options?.effects });
  let _onPlaybackEnded: (() => void) | null = null;
  playout.setOnPlaybackComplete(() => {
    if (_playoutGeneration === 1) {
      _isPlaying = false;
      _onPlaybackEnded?.();
    }
  });
  let _isPlaying = false;
  let _loopEnabled = false;
  let _loopStart = 0;
  let _loopEnd = 0;
  let _audioInitialized = false;
  let _pendingInit: Promise<void> | null = null;
  const _ppqn = options?.ppqn ?? 192;
  let _bpm = 120;
  let _soundFontCache = options?.soundFontCache;
  // Snapshot of the adapter's tracks, kept fresh by setTracks/addTrack/
  // updateTrack/removeTrack and the per-track control setters. Used by
  // setSoundFontCache to rebuild MIDI tracks without an engine round-trip.
  const _currentTracks = new Map<string, ClipTrack>();
  // What each MIDI track was built with (null = PolySynth), by track id. The
  // rebuild guard compares effective routing against this build record —
  // not against the previous setSoundFontCache argument — because the same
  // cache object can flip isLoaded after a late load().
  const _midiTrackBuild = new Map<string, SoundFontCache | null>();

  // A track is ONE playout track under its own id, built from its kind
  // (#756): audio clips for an audio track, MIDI clips for a MIDI track. The
  // engine rejects a track whose clips do not match its kind, so the filters
  // below only drop what cannot play yet (an undecoded clip, an empty note list).
  function playableAudioClips(track: ClipTrack) {
    return track.clips.filter((c) => c.audioBuffer && !c.midiNotes);
  }

  function addAudioTrackToPlayout(p: TonePlayout, track: ClipTrack): void {
    const audioClips = playableAudioClips(track);
    if (audioClips.length === 0) return;

    const startTime = Math.min(...audioClips.map(clipStartTime));
    const endTime = Math.max(...audioClips.map(clipEndTime));

    const trackObj: Track = {
      id: track.id,
      name: track.name,
      gain: track.volume,
      muted: track.muted,
      soloed: track.soloed,
      stereoPan: track.pan,
      startTime,
      endTime,
    };

    const clipInfos: ClipInfo[] = audioClips.map((clip) => ({
      buffer: clip.audioBuffer!,
      startTime: clipStartTime(clip) - startTime,
      duration: clipDurationTime(clip),
      offset: clipOffsetTime(clip),
      fadeIn: clip.fadeIn,
      fadeOut: clip.fadeOut,
      gain: clip.gain,
    }));

    p.addTrack({
      clips: clipInfos,
      track: trackObj,
      effects: options?.trackEffects?.(track.id),
      channelCount: trackChannelCount(track),
    });
  }

  function addMidiTrackToPlayout(p: TonePlayout, track: ClipTrack): void {
    const midiClips = track.clips.filter((c) => c.midiNotes && c.midiNotes.length > 0);
    if (midiClips.length === 0) return;

    const startTime = Math.min(...midiClips.map(clipStartTime));
    const endTime = Math.max(...midiClips.map(clipEndTime));

    const trackId = track.id;

    const trackObj: Track = {
      id: trackId,
      name: track.name,
      gain: track.volume,
      muted: track.muted,
      soloed: track.soloed,
      stereoPan: track.pan,
      startTime,
      endTime,
    };

    const effects = options?.trackEffects?.(track.id);

    const midiClipInfos: MidiClipInfo[] = midiClips.map((clip) => ({
      notes: clip.midiNotes!,
      startTime: clipStartTime(clip) - startTime,
      duration: clipDurationTime(clip),
      offset: clipOffsetTime(clip),
    }));

    if (_soundFontCache?.isLoaded) {
      const firstClip = midiClips[0];
      const midiChannel = firstClip.midiChannel;
      const isPercussion = midiChannel === 9;
      const programNumber = firstClip.midiProgram ?? 0;

      p.addSoundFontTrack({
        clips: midiClipInfos,
        track: trackObj,
        soundFontCache: _soundFontCache,
        programNumber,
        isPercussion,
        effects,
      });
      _midiTrackBuild.set(trackId, _soundFontCache);
    } else {
      if (_soundFontCache) {
        console.warn(
          `[waveform-playlist] SoundFont not loaded for track "${track.name}" — falling back to PolySynth.`
        );
      }
      p.addMidiTrack({
        clips: midiClipInfos,
        track: trackObj,
        effects,
      });
      _midiTrackBuild.set(trackId, null);
    }
  }

  // Add a single ClipTrack to the playout (shared by buildPlayout and addTrack)
  function addTrackToPlayout(p: TonePlayout, track: ClipTrack): void {
    if (trackKind(track) === 'midi') {
      addMidiTrackToPlayout(p, track);
    } else {
      addAudioTrackToPlayout(p, track);
    }
  }

  // Recreates TonePlayout after dispose. The initial playout is created eagerly
  // above. setTracks() uses the incremental path when playout exists.
  function buildPlayout(tracks: ClipTrack[]): void {
    if (playout) {
      try {
        playout.dispose();
      } catch (err) {
        console.warn('[waveform-playlist] Error disposing previous playout:' + ' ' + String(err));
      }
      playout = null;
    }

    _playoutGeneration++;
    const generation = _playoutGeneration;

    playout = new TonePlayout({
      effects: options?.effects,
    });

    // If Tone.start() was already called (AudioContext resumed), carry
    // initialization forward. Store the promise so adapter.init() can await it.
    if (_audioInitialized) {
      _pendingInit = playout.init().catch((err) => {
        console.warn(
          '[waveform-playlist] Failed to initialize playout. ' +
            'Audio playback will require another user gesture.' +
            ' ' +
            String(err)
        );
        _audioInitialized = false;
      });
    }

    for (const track of tracks) {
      addTrackToPlayout(playout, track);
    }
    playout.applyInitialSoloState();
    playout.setLoop(_loopEnabled, _loopStart, _loopEnd);

    playout.setOnPlaybackComplete(() => {
      if (generation === _playoutGeneration) {
        _isPlaying = false;
        _onPlaybackEnded?.();
      }
    });
  }

  function requireEffectsPlayout(): TonePlayout {
    if (!isNativeGlobalContext()) {
      throw new Error(
        '[waveform-playlist] Effects chains on the Tone adapter require a native ' +
          'AudioContext. Call configureGlobalContext({ nativeAudioContext: true }) from ' +
          '@waveform-playlist/playout before any audio initialization.'
      );
    }
    if (!playout) {
      throw new Error('[waveform-playlist] adapter.transport accessed after dispose.');
    }
    return playout;
  }

  const effectsTransport: ToneEffectsTransport = {
    connectTrackEffects: (trackId, input, output) =>
      requireEffectsPlayout().connectTrackEffects(trackId, input, output),
    disconnectTrackEffects: (trackId) => requireEffectsPlayout().disconnectTrackEffects(trackId),
    connectMasterOutput: (node) => requireEffectsPlayout().connectMasterOutput(node),
    disconnectMasterOutput: () => requireEffectsPlayout().disconnectMasterOutput(),
    get masterOutputNode(): AudioNode {
      return requireEffectsPlayout().masterBusInputNode;
    },
  };

  return {
    async init(): Promise<void> {
      // If buildPlayout already started init (rebuild after setTracks), await it
      if (_pendingInit) {
        await _pendingInit;
        _pendingInit = null;
        return;
      }
      if (playout) {
        await playout.init();
        _audioInitialized = true;
      }
    },

    setTracks(tracks: ClipTrack[]): void {
      _currentTracks.clear();
      _midiTrackBuild.clear();
      for (const track of tracks) {
        _currentTracks.set(track.id, track);
      }

      if (!playout) {
        buildPlayout(tracks);
        return;
      }
      // Incremental: diff by track ID — only remove/add what changed
      const newTrackIds = new Set(tracks.map((t) => t.id));
      const oldTrackIds = new Set(playout.getTrackIds());

      // Remove tracks no longer present
      for (const id of oldTrackIds) {
        if (!newTrackIds.has(id)) {
          playout.removeTrack(id);
        }
      }
      // Add or replace tracks
      for (const track of tracks) {
        if (oldTrackIds.has(track.id)) {
          playout.removeTrack(track.id);
        }
        addTrackToPlayout(playout, track);
      }
      playout.applyInitialSoloState();
      // Resume mid-clip sources if playing
      if (_isPlaying) {
        for (const track of tracks) {
          playout.resumeTrackMidPlayback(track.id);
        }
      }
    },

    updateTrack(trackId: string, track: ClipTrack): void {
      _currentTracks.set(trackId, track);

      if (!playout) return;

      // Audio track: try a clip-level update, which keeps the track's audio
      // graph (no glitch). A MIDI track is always rebuilt.
      const audioClips = trackKind(track) === 'midi' ? [] : playableAudioClips(track);
      if (audioClips.length > 0) {
        const startTime = Math.min(...audioClips.map(clipStartTime));
        const clipInfos: ClipInfo[] = audioClips.map((clip) => ({
          buffer: clip.audioBuffer!,
          startTime: clipStartTime(clip) - startTime,
          duration: clipDurationTime(clip),
          offset: clipOffsetTime(clip),
          fadeIn: clip.fadeIn,
          fadeOut: clip.fadeOut,
          gain: clip.gain,
        }));

        // The pan law follows the track's clips (a stereo take on a mono
        // track), exactly as on the native transport and in the export.
        const audioUpdated = playout.replaceTrackClips(
          trackId,
          clipInfos,
          startTime,
          trackChannelCount(track)
        );
        if (audioUpdated) {
          playout.applyInitialSoloState();
          return;
        }
      }

      // Full remove and re-add: a MIDI track, or an audio track with no
      // playout track yet (an empty placeholder getting its first clip).
      playout.removeTrack(trackId);
      _midiTrackBuild.delete(trackId);
      addTrackToPlayout(playout, track);
      playout.applyInitialSoloState();
      if (_isPlaying) {
        playout.resumeTrackMidPlayback(trackId);
      }
    },

    addTrack(track: ClipTrack): void {
      _currentTracks.set(track.id, track);

      if (!playout) {
        console.warn(
          '[waveform-playlist] adapter.addTrack() called but playout is not available ' +
            '(adapter may have been disposed).'
        );
        return;
      }
      addTrackToPlayout(playout, track);
      playout.applyInitialSoloState();
    },

    removeTrack(trackId: string): void {
      _currentTracks.delete(trackId);
      _midiTrackBuild.delete(trackId);

      if (!playout) return;
      playout.removeTrack(trackId);
      playout.applyInitialSoloState();
    },

    play(startTime: number, endTime?: number): void {
      if (!playout) {
        console.warn(
          '[waveform-playlist] adapter.play() called but no playout is available. ' +
            'Tracks may not have been set, or the adapter was disposed.'
        );
        return;
      }
      const duration = endTime !== undefined ? endTime - startTime : undefined;
      playout.play(now(), startTime, duration);
      // Only set _isPlaying if play() didn't throw
      // (TonePlayout.play() re-throws after cleanup on Transport failure)
      _isPlaying = true;
    },

    pause(): void {
      playout?.pause();
      _isPlaying = false;
    },

    stop(): void {
      playout?.stop();
      _isPlaying = false;
    },

    seek(time: number): void {
      playout?.seekTo(time);
    },

    getCurrentTime(): number {
      return playout?.getCurrentTime() ?? 0;
    },

    isPlaying(): boolean {
      return _isPlaying;
    },

    onPlaybackEnded(callback: (() => void) | null): void {
      _onPlaybackEnded = callback;
    },

    setMasterVolume(volume: number): void {
      playout?.setMasterGain(volume);
    },

    setTrackVolume(trackId: string, volume: number): void {
      const existing = _currentTracks.get(trackId);
      if (existing) _currentTracks.set(trackId, { ...existing, volume });
      playout?.getTrack(trackId)?.setVolume(volume);
    },

    setTrackMute(trackId: string, muted: boolean): void {
      const existing = _currentTracks.get(trackId);
      if (existing) _currentTracks.set(trackId, { ...existing, muted });
      playout?.setMute(trackId, muted);
    },

    setTrackSolo(trackId: string, soloed: boolean): void {
      const existing = _currentTracks.get(trackId);
      if (existing) _currentTracks.set(trackId, { ...existing, soloed });
      playout?.setSolo(trackId, soloed);
    },

    setTrackPan(trackId: string, pan: number): void {
      const existing = _currentTracks.get(trackId);
      if (existing) _currentTracks.set(trackId, { ...existing, pan });
      playout?.getTrack(trackId)?.setPan(pan);
    },

    setLoop(enabled: boolean, start: number, end: number): void {
      _loopEnabled = enabled;
      _loopStart = start;
      _loopEnd = end;
      playout?.setLoop(enabled, start, end);
    },

    get audioContext(): AudioContext {
      return getGlobalAudioContext();
    },

    get lookAhead(): number {
      // Tone.js Transport reports a position `lookAhead` ahead of what's audible.
      // Consumers visualizing playback should subtract this to align the playhead
      // with the listener's "now". Default is 0.1s on Tone Context wrappers.
      return getGlobalContext().lookAhead ?? 0;
    },

    get ppqn(): number {
      return _ppqn;
    },

    setTempo(bpm: number, atTick?: number): void {
      if (atTick !== undefined) {
        throw new Error(
          'Multiple tempo changes not supported by TonePlayoutAdapter. ' +
            'Use NativePlayoutAdapter from @dawcore/transport for multi-tempo support.'
        );
      }
      _bpm = bpm;
    },

    setMeter(_numerator: number, _denominator: number, atTick?: number): void {
      if (atTick !== undefined) {
        throw new Error(
          'Multiple meter changes not supported by TonePlayoutAdapter. ' +
            'Use NativePlayoutAdapter from @dawcore/transport for multi-meter support.'
        );
      }
      // No-op — Tone.js timeSignature is metadata-only, not used for scheduling
    },

    ticksToSeconds(tick: number): number {
      return (tick * 60) / (_bpm * _ppqn);
    },

    /** Integer tick (engine `PlayoutAdapter.secondsToTicks` contract): the
     *  exact position rounded once here, as NativePlayoutAdapter does. */
    secondsToTicks(seconds: number): number {
      return Math.round((seconds * _bpm * _ppqn) / 60);
    },

    /** Fractional tick position (engine `PlayoutAdapter.secondsToTicksExact`). */
    secondsToTicksExact(seconds: number): number {
      return (seconds * _bpm * _ppqn) / 60;
    },

    // --- Cross-context worklet support ---
    // Tone.js wraps standardized-audio-context. Native AudioWorkletNode constructor
    // rejects it ("parameter 1 is not of type 'BaseAudioContext'").
    // These methods use Tone.js Context wrappers that handle both context types.
    // Note: addWorkletModule is NOT needed — rawContext.audioWorklet.addModule() works
    // identically for both native and standardized contexts. Only node/source creation differs.

    createAudioWorkletNode(name: string, options?: AudioWorkletNodeOptions): AudioWorkletNode {
      return getGlobalContext().createAudioWorkletNode(name, options);
    },

    createMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode {
      return getGlobalContext().createMediaStreamSource(stream);
    },

    get masterOutputNode(): AudioNode {
      if (!playout) {
        throw new Error(
          '[waveform-playlist] adapter.masterOutputNode accessed after dispose. ' +
            'Disconnect your analyzer before disposing the adapter.'
        );
      }
      return playout.masterOutputNode;
    },

    get transport(): ToneEffectsTransport {
      return effectsTransport;
    },

    setSoundFontCache(cache: SoundFontCache | undefined): void {
      _soundFontCache = cache;
      if (cache && !cache.isLoaded) {
        console.warn(
          '[waveform-playlist] setSoundFontCache called with a SoundFontCache that is not ' +
            'loaded — MIDI tracks remain on PolySynth. Await cache.load() and call again.'
        );
      }
      if (!playout) return;

      const effective = cache?.isLoaded ? cache : null;
      let changed = false;

      for (const track of _currentTracks.values()) {
        if (trackKind(track) !== 'midi') continue;
        const hasNotes = track.clips.some((c) => c.midiNotes && c.midiNotes.length > 0);
        if (!hasNotes) continue;

        const midiTrackId = track.id;
        if (_midiTrackBuild.get(midiTrackId) === effective) continue;

        // Isolate per-track failures — a Tone.js graph error on one track
        // must not leave the remaining tracks stuck on their old routing
        // or escape into the caller (in React that unmounts the playlist
        // via the error boundary).
        try {
          playout.removeTrack(midiTrackId);
          addMidiTrackToPlayout(playout, track);
          if (_isPlaying) {
            playout.resumeTrackMidPlayback(midiTrackId);
          }
          changed = true;
        } catch (err) {
          console.warn(
            `[waveform-playlist] SoundFont swap failed for track "${track.name}": ` + String(err)
          );
        }
      }

      if (changed) {
        playout.applyInitialSoloState();
      }
    },

    dispose(): void {
      try {
        playout?.dispose();
      } catch (err) {
        console.warn('[waveform-playlist] Error disposing playout: ' + String(err));
      }
      playout = null;
      _isPlaying = false;
      _onPlaybackEnded = null;
      _currentTracks.clear();
      _midiTrackBuild.clear();
    },
  };
}
