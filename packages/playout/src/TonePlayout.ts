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
  private manualMuteState: Map<string, boolean> = new Map();

  constructor(options: TonePlayoutOptions = {}) {
    this.masterVolume = new Tone.Volume(this.gainToDb(options.masterGain ?? 1));
    this.masterVolume.toDestination();

    if (options.tracks) {
      options.tracks.forEach(track => {
        this.tracks.set(track.id, track);
        // Initialize manual mute state for constructor-provided tracks
        this.manualMuteState.set(track.id, track.muted);
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
    // Initialize manual mute state from track options
    this.manualMuteState.set(toneTrack.id, trackOptions.track.muted ?? false);
    return toneTrack;
  }

  removeTrack(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.dispose();
      this.tracks.delete(trackId);
      this.manualMuteState.delete(trackId);
      this.soloedTracks.delete(trackId);
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

    // Play all tracks - mute state will control volume
    this.tracks.forEach(track => {
      track.play(when, offset);
    });

    Tone.getTransport().start(when, offset);
  }

  pause(): void {
    Tone.getTransport().pause();
    this.tracks.forEach(track => {
      track.pause();
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
      console.log(`setSolo(${trackId}, ${soloed})`);
      console.log('Manual mute state before:', Array.from(this.manualMuteState.entries()));

      track.setSolo(soloed);
      if (soloed) {
        this.soloedTracks.add(trackId);
      } else {
        this.soloedTracks.delete(trackId);
      }

      console.log('Soloed tracks:', Array.from(this.soloedTracks));

      // Update mute state of all tracks based on solo logic
      this.updateSoloMuting();

      console.log('Manual mute state after:', Array.from(this.manualMuteState.entries()));
    }
  }

  private updateSoloMuting(): void {
    const hasSoloedTracks = this.soloedTracks.size > 0;
    console.log('updateSoloMuting - hasSoloedTracks:', hasSoloedTracks);

    this.tracks.forEach((track, id) => {
      if (hasSoloedTracks) {
        // If there are soloed tracks, mute all non-soloed tracks
        if (!this.soloedTracks.has(id)) {
          console.log(`  ${id}: muting (not soloed)`);
          track.setMute(true);
        } else {
          // Restore manual mute state for soloed tracks
          const manuallyMuted = this.manualMuteState.get(id) ?? false;
          console.log(`  ${id}: restoring manual mute state (${manuallyMuted}) for soloed track`);
          track.setMute(manuallyMuted);
        }
      } else {
        // No soloed tracks, restore original manual mute state for all tracks
        const manuallyMuted = this.manualMuteState.get(id) ?? false;
        console.log(`  ${id}: restoring manual mute state (${manuallyMuted})`);
        track.setMute(manuallyMuted);
      }
    });
  }

  setMute(trackId: string, muted: boolean): void {
    const track = this.tracks.get(trackId);
    if (track) {
      // Store the manual mute state
      this.manualMuteState.set(trackId, muted);
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
