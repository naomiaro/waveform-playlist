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
import { now } from 'tone';

export interface ToneAdapterOptions {
  effects?: EffectsFunction;
}

export function createToneAdapter(options?: ToneAdapterOptions): PlayoutAdapter {
  let playout: TonePlayout | null = null;
  let _isPlaying = false;
  let _playoutGeneration = 0;

  function buildPlayout(tracks: ClipTrack[]): void {
    if (playout) {
      playout.dispose();
    }

    _playoutGeneration++;
    const generation = _playoutGeneration;

    playout = new TonePlayout({
      effects: options?.effects,
    });

    for (const track of tracks) {
      const playableClips = track.clips.filter((c) => c.audioBuffer);
      if (playableClips.length === 0) continue;

      const startTime = Math.min(...playableClips.map(clipStartTime));
      const endTime = Math.max(...playableClips.map(clipEndTime));

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

      const clipInfos: ClipInfo[] = playableClips.map((clip) => ({
        buffer: clip.audioBuffer!,
        startTime: clipStartTime(clip) - startTime,
        duration: clipDurationTime(clip),
        offset: clipOffsetTime(clip),
        fadeIn: clip.fadeIn,
        fadeOut: clip.fadeOut,
        gain: clip.gain,
      }));

      playout.addTrack({
        clips: clipInfos,
        track: trackObj,
        effects: track.effects,
      });
    }

    playout.applyInitialSoloState();

    playout.setOnPlaybackComplete(() => {
      if (generation === _playoutGeneration) {
        _isPlaying = false;
      }
    });
  }

  return {
    async init(): Promise<void> {
      if (playout) {
        await playout.init();
      }
    },

    setTracks(tracks: ClipTrack[]): void {
      buildPlayout(tracks);
    },

    async play(startTime: number, endTime?: number): Promise<void> {
      if (!playout) return;
      await playout.init();
      const duration = endTime !== undefined ? endTime - startTime : undefined;
      playout.play(now(), startTime, duration);
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

    dispose(): void {
      playout?.dispose();
      playout = null;
      _isPlaying = false;
    },
  };
}
