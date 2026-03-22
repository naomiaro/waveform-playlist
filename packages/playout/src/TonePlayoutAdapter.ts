import type { ClipTrack, Track } from '@waveform-playlist/core';
import {
  clipStartTime,
  clipEndTime,
  clipOffsetTime,
  clipDurationTime,
} from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import { TonePlayout } from './TonePlayout';
import type { EffectsFunction } from './TonePlayout';
import type { ClipInfo } from './ToneTrack';
import type { MidiClipInfo } from './MidiToneTrack';
import type { SoundFontCache } from './SoundFontCache';
import { now } from 'tone';

export interface ToneAdapterOptions {
  effects?: EffectsFunction;
  /** When provided, MIDI clips use SoundFont sample playback instead of PolySynth */
  soundFontCache?: SoundFontCache;
}

export function createToneAdapter(options?: ToneAdapterOptions): PlayoutAdapter {
  let playout: TonePlayout | null = null;
  let _isPlaying = false;
  let _playoutGeneration = 0;
  let _loopEnabled = false;
  let _loopStart = 0;
  let _loopEnd = 0;
  let _audioInitialized = false;
  let _pendingInit: Promise<void> | null = null;

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

  function buildPlayout(tracks: ClipTrack[]): void {
    if (playout) {
      try {
        playout.dispose();
      } catch (err) {
        console.warn('[waveform-playlist] Error disposing previous playout during rebuild:', err);
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
          '[waveform-playlist] Failed to re-initialize playout after rebuild. ' +
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
      buildPlayout(tracks);
    },

    addTrack(track: ClipTrack): void {
      if (!playout) {
        throw new Error(
          '[waveform-playlist] adapter.addTrack() called but no playout exists. ' +
            'Call setTracks() first to initialize the playout.'
        );
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

    dispose(): void {
      try {
        playout?.dispose();
      } catch (err) {
        console.warn('[waveform-playlist] Error disposing playout:', err);
      }
      playout = null;
      _isPlaying = false;
    },
  };
}
