import * as Tone from 'tone';
import { ToneTrack, ToneTrackOptions } from './ToneTrack';

export interface TonePlayoutOptions {
  tracks?: ToneTrack[];
  masterGain?: number;
}

export class TonePlayout {
  private tracks: Map<string, ToneTrack> = new Map();
  private masterVolume: Tone.Volume;
  private isInitialized = false;
  private soloedTracks: Set<string> = new Set();

  constructor(options: TonePlayoutOptions = {}) {
    this.masterVolume = new Tone.Volume(this.gainToDb(options.masterGain ?? 1));
    this.masterVolume.toDestination();

    if (options.tracks) {
      options.tracks.forEach(track => {
        this.tracks.set(track.id, track);
      });
    }
  }

  private gainToDb(gain: number): number {
    return 20 * Math.log10(gain);
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;

    await Tone.start();
    this.isInitialized = true;
  }

  addTrack(trackOptions: ToneTrackOptions): ToneTrack {
    const toneTrack = new ToneTrack(trackOptions);
    this.tracks.set(toneTrack.id, toneTrack);
    return toneTrack;
  }

  removeTrack(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.dispose();
      this.tracks.delete(trackId);
    }
  }

  getTrack(trackId: string): ToneTrack | undefined {
    return this.tracks.get(trackId);
  }

  play(when: number = Tone.now(), offset: number = 0): void {
    if (!this.isInitialized) {
      console.warn('TonePlayout not initialized. Call init() first.');
      return;
    }

    // Handle solo logic
    const hassoloedTracks = this.soloedTracks.size > 0;

    this.tracks.forEach(track => {
      if (hassoloedTracks) {
        // Only play soloed tracks
        if (this.soloedTracks.has(track.id)) {
          track.play(when, offset);
        }
      } else {
        // Play all non-muted tracks
        track.play(when, offset);
      }
    });

    Tone.getTransport().start(when, offset);
  }

  pause(): void {
    Tone.getTransport().pause();
    this.tracks.forEach(track => {
      track.stop();
    });
  }

  stop(): void {
    Tone.getTransport().stop();
    this.tracks.forEach(track => {
      track.stop();
    });
  }

  setMasterGain(gain: number): void {
    this.masterVolume.volume.value = this.gainToDb(gain);
  }

  setSolo(trackId: string, soloed: boolean): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.setSolo(soloed);
      if (soloed) {
        this.soloedTracks.add(trackId);
      } else {
        this.soloedTracks.delete(trackId);
      }
    }
  }

  setMute(trackId: string, muted: boolean): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.setMute(muted);
    }
  }

  getCurrentTime(): number {
    return Tone.getTransport().seconds;
  }

  seekTo(time: number): void {
    Tone.getTransport().seconds = time;
  }

  dispose(): void {
    this.tracks.forEach(track => {
      track.dispose();
    });
    this.tracks.clear();
    this.masterVolume.dispose();
  }

  get context(): Tone.BaseContext {
    return Tone.getContext();
  }

  get sampleRate(): number {
    return Tone.getContext().sampleRate;
  }
}
