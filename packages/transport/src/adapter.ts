import type { ClipTrack } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import { Transport } from './transport';
import type { TransportOptions } from './types';

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
    this._transport.setLoop(enabled, start, end);
  }

  dispose(): void {
    this._transport.dispose();
  }
}
