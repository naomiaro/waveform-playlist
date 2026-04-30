import type { ClipTrack, Track } from '@waveform-playlist/core';
import {
  clipStartTime,
  clipEndTime,
  clipOffsetTime,
  clipDurationTime,
  trackChannelCount,
} from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import { TonePlayout } from './TonePlayout';
import type { EffectsFunction } from './TonePlayout';
import type { ClipInfo } from './ToneTrack';
import type { MidiClipInfo } from './MidiToneTrack';
import type { SoundFontCache } from './SoundFontCache';
import { now } from 'tone';
import { getGlobalAudioContext, getGlobalContext } from './audioContext';

export interface ToneAdapterOptions {
  effects?: EffectsFunction;
  /** When provided, MIDI clips use SoundFont sample playback instead of PolySynth */
  soundFontCache?: SoundFontCache;
  /** Pulses per quarter note. Defaults to 192 (Tone.js native). */
  ppqn?: number;
}

export function createToneAdapter(options?: ToneAdapterOptions): PlayoutAdapter {
  // Ensure the global shared context exists BEFORE creating the playout.
  // Without this, TonePlayout's Volume is created on Tone's default context,
  // which is replaced by getGlobalContext() later — causing cross-context errors.
  getGlobalContext();

  let _playoutGeneration = 1;
  let playout: TonePlayout | null = new TonePlayout({ effects: options?.effects });
  playout.setOnPlaybackComplete(() => {
    if (_playoutGeneration === 1) {
      _isPlaying = false;
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

  // Add a single ClipTrack to the playout (shared by buildPlayout and addTrack)
  function addTrackToPlayout(p: TonePlayout, track: ClipTrack): void {
    const audioClips = track.clips.filter((c) => c.audioBuffer && !c.midiNotes);
    const midiClips = track.clips.filter((c) => c.midiNotes && c.midiNotes.length > 0);

    if (audioClips.length > 0) {
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
        effects: track.effects,
        channelCount: trackChannelCount(track),
      });
    }

    if (midiClips.length > 0) {
      const startTime = Math.min(...midiClips.map(clipStartTime));
      const endTime = Math.max(...midiClips.map(clipEndTime));

      const trackId = audioClips.length > 0 ? `${track.id}:midi` : track.id;

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

      const midiClipInfos: MidiClipInfo[] = midiClips.map((clip) => ({
        notes: clip.midiNotes!,
        startTime: clipStartTime(clip) - startTime,
        duration: clipDurationTime(clip),
        offset: clipOffsetTime(clip),
      }));

      if (options?.soundFontCache?.isLoaded) {
        const firstClip = midiClips[0];
        const midiChannel = firstClip.midiChannel;
        const isPercussion = midiChannel === 9;
        const programNumber = firstClip.midiProgram ?? 0;

        p.addSoundFontTrack({
          clips: midiClipInfos,
          track: trackObj,
          soundFontCache: options.soundFontCache,
          programNumber,
          isPercussion,
          effects: track.effects,
        });
      } else {
        if (options?.soundFontCache) {
          console.warn(
            `[waveform-playlist] SoundFont not loaded for track "${track.name}" — falling back to PolySynth.`
          );
        }
        p.addMidiTrack({
          clips: midiClipInfos,
          track: trackObj,
          effects: track.effects,
        });
      }
    }
  }

  // Recreates TonePlayout after dispose. The initial playout is created eagerly
  // above. setTracks() uses the incremental path when playout exists.
  function buildPlayout(tracks: ClipTrack[]): void {
    if (playout) {
      try {
        playout.dispose();
      } catch (err) {
        console.warn('[waveform-playlist] Error disposing previous playout:', err);
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
            'Audio playback will require another user gesture.',
          err
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
      }
    });
  }

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
          playout.removeTrack(track.id + ':midi');
        }
        addTrackToPlayout(playout, track);
      }
      playout.applyInitialSoloState();
      // Resume mid-clip sources if playing
      if (_isPlaying) {
        for (const track of tracks) {
          playout.resumeTrackMidPlayback(track.id);
          playout.resumeTrackMidPlayback(track.id + ':midi');
        }
      }
    },

    updateTrack(trackId: string, track: ClipTrack): void {
      if (!playout) return;

      // Try clip-level update — preserves track audio graph (no glitch)
      const audioClips = track.clips.filter((c) => c.audioBuffer && !c.midiNotes);
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

        const audioUpdated = playout.replaceTrackClips(trackId, clipInfos, startTime);

        // Also update companion MIDI track if present
        const midiClips = track.clips.filter((c) => c.midiNotes && c.midiNotes.length > 0);
        if (midiClips.length > 0) {
          const midiTrackId = trackId + ':midi';
          playout.removeTrack(midiTrackId);
          addTrackToPlayout(playout, track);
          if (_isPlaying) {
            playout.resumeTrackMidPlayback(midiTrackId);
          }
        }

        if (audioUpdated) {
          playout.applyInitialSoloState();
          return;
        }
      }

      // Fallback: full track remove+re-add (MIDI-only or no audio clips)
      playout.removeTrack(trackId);
      playout.removeTrack(trackId + ':midi');
      addTrackToPlayout(playout, track);
      playout.applyInitialSoloState();
      if (_isPlaying) {
        playout.resumeTrackMidPlayback(trackId);
        playout.resumeTrackMidPlayback(trackId + ':midi');
      }
    },

    addTrack(track: ClipTrack): void {
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

    setMasterVolume(volume: number): void {
      playout?.setMasterGain(volume);
    },

    setTrackVolume(trackId: string, volume: number): void {
      playout?.getTrack(trackId)?.setVolume(volume);
    },

    setTrackMute(trackId: string, muted: boolean): void {
      playout?.setMute(trackId, muted);
    },

    setTrackSolo(trackId: string, soloed: boolean): void {
      playout?.setSolo(trackId, soloed);
    },

    setTrackPan(trackId: string, pan: number): void {
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

    secondsToTicks(seconds: number): number {
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

    dispose(): void {
      try {
        playout?.dispose();
      } catch (err) {
        console.warn('[waveform-playlist] Error disposing playout: ' + String(err));
      }
      playout = null;
      _isPlaying = false;
    },
  };
}
