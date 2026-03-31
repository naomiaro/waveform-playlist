import {
  Volume,
  Gain,
  Panner,
  PolySynth,
  Synth,
  MembraneSynth,
  MetalSynth,
  NoiseSynth,
  Part,
  ToneAudioNode,
  getDestination,
  getContext,
} from 'tone';
import type { SynthOptions } from 'tone';
import { Track, gainToDb, type MidiNoteData } from '@waveform-playlist/core';
import { getUnderlyingAudioParam } from './fades';
import type { TrackEffectsFunction } from './ToneTrack';

/**
 * Shared interface for tracks managed by TonePlayout.
 * Both ToneTrack (audio) and MidiToneTrack (MIDI) implement this,
 * allowing TonePlayout to manage them uniformly.
 */
export interface PlayableTrack {
  id: string;
  startTime: number;
  muted: boolean;
  duration: number;
  stopAllSources(): void;
  startMidClipSources(offset: number, time: number): void;
  setScheduleGuardOffset(offset: number): void;
  prepareFades(when: number, offset: number): void;
  cancelFades(): void;
  setVolume(gain: number): void;
  setPan(pan: number): void;
  setMute(muted: boolean): void;
  setSolo(soloed: boolean): void;
  dispose(): void;
}

export interface MidiClipInfo {
  notes: MidiNoteData[];
  startTime: number; // When this clip starts relative to track start (seconds)
  duration: number; // Clip duration (seconds)
  offset: number; // Trim offset into the MIDI data (seconds)
}

export interface MidiToneTrackOptions {
  clips: MidiClipInfo[];
  track: Track;
  effects?: TrackEffectsFunction;
  destination?: ToneAudioNode;
  synthOptions?: Partial<SynthOptions>;
}

/**
 * Categorize GM percussion note numbers into synth types.
 * See: https://www.midi.org/specifications-old/item/gm-level-1-sound-set
 */
type DrumCategory = 'kick' | 'snare' | 'cymbal' | 'tom';

function getDrumCategory(midiNote: number): DrumCategory {
  // Bass drums
  if (midiNote === 35 || midiNote === 36) return 'kick';
  // Snare, side stick, clap
  if (midiNote >= 37 && midiNote <= 40) return 'snare';
  // Toms (low floor tom through high tom)
  if (
    midiNote === 41 ||
    midiNote === 43 ||
    midiNote === 45 ||
    midiNote === 47 ||
    midiNote === 48 ||
    midiNote === 50
  )
    return 'tom';
  // Hi-hats, cymbals, bells, tambourine, cowbell, etc.
  return 'cymbal';
}

/** Per-clip scheduling info */
interface ScheduledMidiClip {
  clipInfo: MidiClipInfo;
  part: Part;
}

/**
 * MIDI track that always creates both melodic and percussion synths.
 * Per-note routing uses the `channel` field on each MidiNoteData:
 * channel 9 → percussion synths, all others → melodic PolySynth.
 * This enables flattened tracks (mixed channels) to play correctly.
 */
export class MidiToneTrack implements PlayableTrack {
  private scheduledClips: ScheduledMidiClip[];
  // Melodic synth — always created
  private synth: PolySynth;
  // Percussion synths — always created (PolySynth wrappers for polyphony)
  private kickSynth: PolySynth<MembraneSynth>;
  private snareSynth: NoiseSynth; // No pitch param, can't wrap in PolySynth
  private cymbalSynth: PolySynth<MetalSynth>;
  private tomSynth: PolySynth<MembraneSynth>;
  private volumeNode: Volume;
  private panNode: Panner;
  private muteGain: Gain;
  private track: Track;
  private effectsCleanup?: () => void;

  constructor(options: MidiToneTrackOptions) {
    this.track = options.track;

    // Create shared track-level Tone.js nodes (same chain as ToneTrack)
    this.volumeNode = new Volume(gainToDb(options.track.gain));
    this.panNode = new Panner(options.track.stereoPan);
    this.muteGain = new Gain(options.track.muted ? 0 : 1);
    this.volumeNode.chain(this.panNode, this.muteGain);

    // Melodic: PolySynth with basic Synth voice
    this.synth = new PolySynth(Synth, options.synthOptions);
    this.synth.connect(this.volumeNode);

    // Percussion: PolySynth wrappers for polyphonic playback
    this.kickSynth = new PolySynth(MembraneSynth, {
      voice: MembraneSynth,
      options: {
        pitchDecay: 0.05,
        octaves: 6,
        envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 },
      },
    } as never);
    this.snareSynth = new NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.05 },
    });
    this.cymbalSynth = new PolySynth(MetalSynth, {
      voice: MetalSynth,
      options: {
        envelope: { attack: 0.001, decay: 0.3, release: 0.1 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5,
      },
    } as never);
    this.tomSynth = new PolySynth(MembraneSynth, {
      voice: MembraneSynth,
      options: {
        pitchDecay: 0.08,
        octaves: 4,
        envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
      },
    } as never);

    this.kickSynth.connect(this.volumeNode);
    this.snareSynth.connect(this.volumeNode);
    this.cymbalSynth.connect(this.volumeNode);
    this.tomSynth.connect(this.volumeNode);

    // Connect to destination or apply effects chain
    const destination = options.destination || getDestination();
    if (options.effects) {
      const cleanup = options.effects(this.muteGain, destination, false);
      if (cleanup) {
        this.effectsCleanup = cleanup;
      }
    } else {
      this.muteGain.connect(destination);
    }

    // Create a Tone.Part for each clip, scheduling notes relative to Transport
    this.scheduledClips = options.clips.map((clipInfo) => {
      // Filter notes within the clip's visible window (after trim offset)
      const visibleNotes = clipInfo.notes.filter((note) => {
        const noteEnd = note.time + note.duration;
        // Note must start before clip ends and end after clip's trim offset
        return note.time < clipInfo.offset + clipInfo.duration && noteEnd > clipInfo.offset;
      });

      // Create Part events with absolute Transport times
      const absClipStart = this.track.startTime + clipInfo.startTime;

      const partEvents = visibleNotes.map((note) => {
        // Adjust note timing relative to clip's trim offset
        const adjustedTime = note.time - clipInfo.offset;
        // Clamp to clip boundaries
        const clampedStart = Math.max(0, adjustedTime);
        const clampedDuration = Math.min(
          note.duration - Math.max(0, clipInfo.offset - note.time),
          clipInfo.duration - clampedStart
        );

        return {
          time: absClipStart + clampedStart,
          note: note.name,
          midi: note.midi,
          duration: Math.max(0, clampedDuration),
          velocity: note.velocity,
          channel: note.channel,
        };
      });

      const part = new Part((time, event) => {
        if (event.duration > 0) {
          this.triggerNote(
            event.midi,
            event.note,
            event.duration,
            time,
            event.velocity,
            event.channel
          );
        }
      }, partEvents);

      // Part starts automatically with Transport
      part.start(0);

      return { clipInfo, part };
    });
  }

  /**
   * Trigger a note using the appropriate synth.
   * Routes per-note: channel 9 → percussion synths, others → melodic PolySynth.
   */
  private triggerNote(
    midiNote: number,
    noteName: string,
    duration: number,
    time: number,
    velocity: number,
    channel?: number
  ): void {
    if (channel === 9) {
      const category = getDrumCategory(midiNote);
      switch (category) {
        case 'kick':
          this.kickSynth.triggerAttackRelease('C1', duration, time, velocity);
          break;
        case 'snare':
          // NoiseSynth is monophonic — wrap in try-catch for rare overlaps
          try {
            this.snareSynth.triggerAttackRelease(duration, time, velocity);
          } catch (err) {
            console.warn(
              '[waveform-playlist] Snare overlap — previous hit still decaying, skipped:',
              err
            );
          }
          break;
        case 'tom': {
          const tomPitches: Record<number, string> = {
            41: 'G1',
            43: 'A1',
            45: 'C2',
            47: 'D2',
            48: 'E2',
            50: 'G2',
          };
          this.tomSynth.triggerAttackRelease(
            tomPitches[midiNote] || 'C2',
            duration,
            time,
            velocity
          );
          break;
        }
        case 'cymbal':
          // PolySynth requires a note arg; MetalSynth uses it as fundamental frequency.
          // 'C4' provides a reasonable metallic timbre for all cymbal/hi-hat hits.
          this.cymbalSynth.triggerAttackRelease('C4', duration, time, velocity);
          break;
      }
    } else {
      this.synth.triggerAttackRelease(noteName, duration, time, velocity);
    }
  }

  /**
   * No-op for MIDI — schedule guard is for AudioBufferSourceNode ghost tick prevention.
   * Tone.Part handles its own scheduling relative to Transport.
   */
  setScheduleGuardOffset(_offset: number): void {
    // No-op: Tone.Part handles scheduling internally
  }

  /**
   * For MIDI, mid-clip sources are notes that should already be sounding.
   * We trigger them with their remaining duration.
   */
  startMidClipSources(transportOffset: number, audioContextTime: number): void {
    for (const { clipInfo } of this.scheduledClips) {
      const absClipStart = this.track.startTime + clipInfo.startTime;
      const absClipEnd = absClipStart + clipInfo.duration;

      if (absClipStart < transportOffset && absClipEnd > transportOffset) {
        // Find notes that should be currently sounding
        for (const note of clipInfo.notes) {
          const adjustedTime = note.time - clipInfo.offset;
          const noteAbsStart = absClipStart + Math.max(0, adjustedTime);
          const noteAbsEnd = noteAbsStart + note.duration;

          if (noteAbsStart < transportOffset && noteAbsEnd > transportOffset) {
            const remainingDuration = noteAbsEnd - transportOffset;
            try {
              this.triggerNote(
                note.midi,
                note.name,
                remainingDuration,
                audioContextTime,
                note.velocity,
                note.channel
              );
            } catch (err) {
              console.warn(
                `[waveform-playlist] Failed to start mid-clip MIDI note "${note.name}" on track "${this.id}":`,
                err
              );
            }
          }
        }
      }
    }
  }

  /**
   * Stop all sounding notes and cancel scheduled Part events.
   */
  stopAllSources(): void {
    const now = getContext().rawContext.currentTime;
    try {
      this.synth.releaseAll(now);
      this.kickSynth.releaseAll(now);
      this.cymbalSynth.releaseAll(now);
      this.tomSynth.releaseAll(now);
      // NoiseSynth has no releaseAll — it decays naturally via short envelope
    } catch (err) {
      console.warn(`[waveform-playlist] Error releasing synth on track "${this.id}":`, err);
    }
  }

  /**
   * No-op for MIDI — MIDI uses note velocity, not gain fades.
   */
  prepareFades(_when: number, _offset: number): void {
    // No-op: MIDI clips don't use fade envelopes
  }

  /**
   * No-op for MIDI — no fade automation to cancel.
   */
  cancelFades(): void {
    // No-op: MIDI clips don't use fade envelopes
  }

  setVolume(gain: number): void {
    this.track.gain = gain;
    this.volumeNode.volume.value = gainToDb(gain);
  }

  setPan(pan: number): void {
    this.track.stereoPan = pan;
    this.panNode.pan.value = pan;
  }

  setMute(muted: boolean): void {
    this.track.muted = muted;
    const value = muted ? 0 : 1;
    const audioParam = getUnderlyingAudioParam(this.muteGain.gain);
    audioParam?.setValueAtTime(value, 0);
    this.muteGain.gain.value = value;
  }

  setSolo(soloed: boolean): void {
    this.track.soloed = soloed;
  }

  dispose(): void {
    if (this.effectsCleanup) {
      try {
        this.effectsCleanup();
      } catch (err) {
        console.warn(
          `[waveform-playlist] Error during MIDI track "${this.id}" effects cleanup:`,
          err
        );
      }
    }

    this.stopAllSources();

    // Dispose Parts
    this.scheduledClips.forEach(({ part }, index) => {
      try {
        part.dispose();
      } catch (err) {
        console.warn(
          `[waveform-playlist] Error disposing Part ${index} on MIDI track "${this.id}":`,
          err
        );
      }
    });

    // Dispose all synths
    const synthsToDispose = [
      this.synth,
      this.kickSynth,
      this.snareSynth,
      this.cymbalSynth,
      this.tomSynth,
    ];
    for (const s of synthsToDispose) {
      try {
        s?.dispose();
      } catch (err) {
        console.warn(`[waveform-playlist] Error disposing synth on MIDI track "${this.id}":`, err);
      }
    }
    try {
      this.volumeNode.dispose();
    } catch (err) {
      console.warn(
        `[waveform-playlist] Error disposing volumeNode on MIDI track "${this.id}":`,
        err
      );
    }
    try {
      this.panNode.dispose();
    } catch (err) {
      console.warn(`[waveform-playlist] Error disposing panNode on MIDI track "${this.id}":`, err);
    }
    try {
      this.muteGain.dispose();
    } catch (err) {
      console.warn(`[waveform-playlist] Error disposing muteGain on MIDI track "${this.id}":`, err);
    }
  }

  get id(): string {
    return this.track.id;
  }

  get duration(): number {
    if (this.scheduledClips.length === 0) return 0;
    const lastClip = this.scheduledClips[this.scheduledClips.length - 1];
    return lastClip.clipInfo.startTime + lastClip.clipInfo.duration;
  }

  get muted(): boolean {
    return this.track.muted;
  }

  get startTime(): number {
    return this.track.startTime;
  }
}
