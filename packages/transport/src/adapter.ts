import type { ClipTrack } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import { Transport } from './transport';
import type { TransportOptions, CountInMode } from './types';

export class NativePlayoutAdapter implements PlayoutAdapter {
  private _transport: Transport;
  private _audioContext: AudioContext;

  constructor(audioContext: AudioContext, options?: TransportOptions) {
    this._audioContext = audioContext;
    this._transport = new Transport(audioContext, options);
  }

  get transport(): Transport {
    return this._transport;
  }

  async init(): Promise<void> {
    if (this._audioContext.state === 'closed') {
      throw new Error('[waveform-playlist] Cannot init: AudioContext is closed');
    }
    if (this._audioContext.state === 'suspended') {
      await this._audioContext.resume();
      // Safari's audio thread may not be ready to output audio immediately
      // after resume() resolves. Wait for currentTime to advance past the
      // output latency, indicating the hardware pipeline is warm.
      // Minimum warmup ensures the audio thread has time to spin up even
      // when outputLatency reports 0 (Chrome on low-latency hardware).
      const MIN_WARMUP = 0.02; // 20ms
      const warmupTarget = Math.max(MIN_WARMUP, this._audioContext.outputLatency ?? MIN_WARMUP);
      if (this._audioContext.currentTime < warmupTarget) {
        const MAX_WARMUP_MS = 2000;
        await new Promise<void>((resolve) => {
          const startMs = performance.now();
          const check = () => {
            if (this._audioContext.currentTime >= warmupTarget) {
              resolve();
            } else if (
              this._audioContext.state === 'closed' ||
              performance.now() - startMs > MAX_WARMUP_MS
            ) {
              console.warn(
                '[waveform-playlist] AudioContext warmup timed out' +
                  ' (currentTime=' +
                  this._audioContext.currentTime +
                  ', target=' +
                  warmupTarget +
                  ', state=' +
                  this._audioContext.state +
                  '). Proceeding without warmup.'
              );
              resolve();
            } else {
              requestAnimationFrame(check);
            }
          };
          requestAnimationFrame(check);
        });
      }
    }
  }

  setTracks(tracks: ClipTrack[]): void {
    this._transport.setTracks(tracks);
  }

  addTrack(track: ClipTrack): void {
    this._transport.addTrack(track);
  }

  removeTrack(trackId: string): void {
    this._transport.removeTrack(trackId);
  }

  updateTrack(trackId: string, track: ClipTrack): void {
    this._transport.updateTrack(trackId, track);
  }

  play(startTime: number, endTime?: number): void {
    this._transport.play(startTime, endTime);
  }

  pause(): void {
    this._transport.pause();
  }

  stop(): void {
    this._transport.stop();
  }

  seek(time: number): void {
    this._transport.seek(time);
  }

  getCurrentTime(): number {
    return this._transport.getCurrentTime();
  }

  isPlaying(): boolean {
    return this._transport.isPlaying();
  }

  setMasterVolume(volume: number): void {
    this._transport.setMasterVolume(volume);
  }

  setTrackVolume(trackId: string, volume: number): void {
    this._transport.setTrackVolume(trackId, volume);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    this._transport.setTrackMute(trackId, muted);
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    this._transport.setTrackSolo(trackId, soloed);
  }

  setTrackPan(trackId: string, pan: number): void {
    this._transport.setTrackPan(trackId, pan);
  }

  setLoop(enabled: boolean, start: number, end: number): void {
    this._transport.setLoopSeconds(enabled, start, end);
  }

  setCountIn(enabled: boolean): void {
    this._transport.setCountIn(enabled);
  }

  setCountInBars(bars: number): void {
    this._transport.setCountInBars(bars);
  }

  setCountInMode(mode: CountInMode): void {
    this._transport.setCountInMode(mode);
  }

  setRecording(recording: boolean): void {
    this._transport.setRecording(recording);
  }

  isCountingIn(): boolean {
    return this._transport.isCountingIn();
  }

  dispose(): void {
    this._transport.dispose();
  }
}
