import { Volume, Gain, Panner, Part, ToneAudioNode, getDestination, getContext } from 'tone';
import { Track, gainToDb } from '@waveform-playlist/core';
import { getUnderlyingAudioParam } from './fades';
import type { TrackEffectsFunction } from './ToneTrack';
import type { PlayableTrack, MidiClipInfo } from './MidiToneTrack';
import type { SoundFontCache } from './SoundFontCache';

export interface SoundFontToneTrackOptions {
  clips: MidiClipInfo[];
  track: Track;
  soundFontCache: SoundFontCache;
  /** GM program number (0-127) for melodic instruments */
  programNumber?: number;
  /** Whether this track uses percussion bank (channel 9) */
  isPercussion?: boolean;
  effects?: TrackEffectsFunction;
  destination?: ToneAudioNode;
}

/** Per-clip scheduling info */
interface ScheduledMidiClip {
  clipInfo: MidiClipInfo;
  part: Part;
}

/**
 * Analytic value of the scheduled AHD envelope at `tRel` seconds after
 * note-on. Mirrors the automation emitted by triggerNote exactly, including
 * the hold-event threshold: hold <= 0.001 emits no hold event, so the decay
 * ramp spans [attack, attack + hold + decay].
 *
 * Exported for direct unit testing; NOT part of the public API — do not
 * re-export from index.ts.
 */
export function envelopeValueAt(
  tRel: number,
  attack: number,
  hold: number,
  decay: number,
  peakGain: number,
  sustainGain: number
): number {
  if (tRel <= 0) return 0;
  if (tRel < attack) return peakGain * (tRel / attack);
  const rampStart = hold > 0.001 ? attack + hold : attack;
  const rampEnd = attack + hold + decay;
  if (tRel <= rampStart || rampEnd <= rampStart) {
    return tRel >= rampEnd ? sustainGain : peakGain;
  }
  if (tRel < rampEnd) {
    return peakGain + (sustainGain - peakGain) * ((tRel - rampStart) / (rampEnd - rampStart));
  }
  return sustainGain;
}

/**
 * MIDI track that uses SoundFont samples for playback.
 *
 * Instead of PolySynth synthesis, each note triggers the correct instrument
 * sample from an SF2 file, pitch-shifted via AudioBufferSourceNode.playbackRate.
 *
 * Audio graph per note:
 *   AudioBufferSourceNode (native, one-shot, pitch-shifted)
 *     → GainNode (native, per-note velocity)
 *     → Volume.input (Tone.js, shared per-track)
 *     → Panner → muteGain → effects/destination
 */
export class SoundFontToneTrack implements PlayableTrack {
  /** Rate-limit missing sample warnings — one per track instance (a page-
   *  lifetime static would silence diagnostics for unrelated later tracks
   *  and soundfont swaps). */
  private _missingSampleWarned = false;
  private scheduledClips: ScheduledMidiClip[];
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private soundFontCache: SoundFontCache;
  private programNumber: number;
  private bankNumber: number;
  private volumeNode: Volume;
  private panNode: Panner;
  private muteGain: Gain;
  private track: Track;
  private effectsCleanup?: () => void;

  constructor(options: SoundFontToneTrackOptions) {
    this.track = options.track;
    this.soundFontCache = options.soundFontCache;
    this.programNumber = options.programNumber ?? 0;
    // Bank 128 for percussion (channel 9), bank 0 for melodic
    this.bankNumber = options.isPercussion ? 128 : 0;

    // Create shared track-level Tone.js nodes (same chain as ToneTrack)
    this.volumeNode = new Volume(gainToDb(options.track.gain));
    this.panNode = new Panner(options.track.stereoPan);
    this.muteGain = new Gain(options.track.muted ? 0 : 1);
    this.volumeNode.chain(this.panNode, this.muteGain);

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
        return note.time < clipInfo.offset + clipInfo.duration && noteEnd > clipInfo.offset;
      });

      const absClipStart = this.track.startTime + clipInfo.startTime;

      const partEvents = visibleNotes.map((note) => {
        const adjustedTime = note.time - clipInfo.offset;
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
          // Contain failures: nothing in Tone.js catches a throw from a Part
          // callback (ToneEvent._tick → Transport._processTick → Clock._loop
          // are all unguarded) — an escape aborts every other same-tick event
          // across ALL tracks. Same guard as startMidClipSources below.
          try {
            this.triggerNote(event.midi, event.duration, time, event.velocity, event.channel);
          } catch (err) {
            console.warn(
              `[waveform-playlist] Failed to trigger SoundFont note on track "${this.id}": ` +
                String(err)
            );
          }
        }
      }, partEvents);

      part.start(0);

      return { clipInfo, part };
    });
  }

  /**
   * Trigger a note by creating a native AudioBufferSourceNode from the SoundFont cache.
   *
   * Per-note routing: channel 9 → bank 128 (drums), others → bank 0 with programNumber.
   */
  private triggerNote(
    midiNote: number,
    duration: number,
    time: number,
    velocity: number,
    channel?: number
  ): void {
    const bank = channel === 9 ? 128 : this.bankNumber;
    const preset = channel === 9 ? 0 : this.programNumber;

    const sfSample = this.soundFontCache.getAudioBuffer(midiNote, bank, preset);
    if (!sfSample) {
      if (!this._missingSampleWarned) {
        console.warn(
          `[waveform-playlist] SoundFont sample not found for MIDI note ${midiNote} (bank ${bank}, preset ${preset}) on track "${this.id}". ` +
            'Subsequent missing samples on this track will be silent.'
        );
        this._missingSampleWarned = true;
      }
      return;
    }

    const rawContext = getContext().rawContext as BaseAudioContext;

    // Create AudioBufferSourceNode with optional looping
    const source = rawContext.createBufferSource();
    source.buffer = sfSample.buffer;
    source.playbackRate.value = sfSample.playbackRate;

    // Enable sample looping if SF2 zone defines loop mode
    if (sfSample.loopMode === 1 || sfSample.loopMode === 3) {
      source.loop = true;
      source.loopStart = sfSample.loopStart;
      source.loopEnd = sfSample.loopEnd;
    }

    // For non-looping samples (percussion, one-shots), use the sample's natural
    // buffer duration so cymbals/drums ring out fully. For looping samples
    // (sustained instruments), use the MIDI note duration for note-off timing.
    const sampleDuration = sfSample.buffer.duration / sfSample.playbackRate;
    const effectiveDuration =
      sfSample.loopMode === 0 ? Math.max(duration, sampleDuration) : duration;

    // Per-note gain with SF2 volume ADSR envelope
    const peakGain = velocity * velocity;
    const gainNode = rawContext.createGain();
    const { attackVolEnv, holdVolEnv, decayVolEnv, sustainVolEnv, releaseVolEnv } = sfSample;
    const sustainGain = peakGain * sustainVolEnv;

    // AHD envelope TRUNCATED at note-off. The duration is known up-front, so
    // schedule only the envelope that actually plays. Scheduling the full AHD
    // and stepping to sustain at note-off is a CONFIRMED click for staccato
    // notes on long-decay patches: the decay ramp's endpoint sorts after
    // note-off, so it never governs — the gain holds at PEAK for the whole
    // note, then steps peak→sustain in one sample (Chromium gain-curve
    // capture, 2026-07-09). A truncated partial ramp lies on the same decay
    // line, so notes that outlive the decay are scheduled identically to
    // before.
    const noteOff = time + effectiveDuration;
    const attackEnd = time + attackVolEnv;
    const decayStart = time + attackVolEnv + holdVolEnv;
    const decayEnd = decayStart + decayVolEnv;
    const heldAtNoteOff = envelopeValueAt(
      effectiveDuration,
      attackVolEnv,
      holdVolEnv,
      decayVolEnv,
      peakGain,
      sustainGain
    );

    gainNode.gain.setValueAtTime(0, time);
    if (noteOff < attackEnd) {
      // Note-off mid-attack: partial attack ramp
      gainNode.gain.linearRampToValueAtTime(heldAtNoteOff, noteOff);
    } else {
      gainNode.gain.linearRampToValueAtTime(peakGain, attackEnd);
      if (holdVolEnv > 0.001 && decayStart < noteOff) {
        gainNode.gain.setValueAtTime(peakGain, decayStart);
      }
      if (noteOff < decayEnd) {
        // Note-off mid-hold/mid-decay: partial ramp to the analytic value
        gainNode.gain.linearRampToValueAtTime(heldAtNoteOff, noteOff);
      } else {
        gainNode.gain.linearRampToValueAtTime(sustainGain, decayEnd);
        gainNode.gain.setValueAtTime(sustainGain, noteOff);
      }
    }
    // Release from wherever the envelope was at note-off
    gainNode.gain.linearRampToValueAtTime(0, noteOff + releaseVolEnv);

    // Connect: source → gainNode → Volume.input (Tone.js)
    source.connect(gainNode);
    gainNode.connect((this.volumeNode.input as unknown as Gain).input);

    // Track active sources for stopAllSources()
    this.activeSources.add(source);
    source.onended = () => {
      this.activeSources.delete(source);
      try {
        gainNode.disconnect();
      } catch (err) {
        console.warn('[waveform-playlist] GainNode already disconnected:' + ' ' + String(err));
      }
    };

    source.start(time);
    source.stop(time + effectiveDuration + releaseVolEnv);
  }

  /**
   * No-op — Tone.Part handles scheduling internally, no ghost tick guard needed.
   */
  setScheduleGuardOffset(_offset: number): void {
    // No-op
  }

  /**
   * Start notes that should already be sounding at the current transport offset.
   */
  startMidClipSources(transportOffset: number, audioContextTime: number): void {
    for (const { clipInfo } of this.scheduledClips) {
      const absClipStart = this.track.startTime + clipInfo.startTime;
      const absClipEnd = absClipStart + clipInfo.duration;

      if (absClipStart < transportOffset && absClipEnd > transportOffset) {
        for (const note of clipInfo.notes) {
          const adjustedTime = note.time - clipInfo.offset;
          const noteAbsStart = absClipStart + Math.max(0, adjustedTime);
          const noteAbsEnd = noteAbsStart + note.duration;

          if (noteAbsStart < transportOffset && noteAbsEnd > transportOffset) {
            const remainingDuration = noteAbsEnd - transportOffset;
            try {
              this.triggerNote(
                note.midi,
                remainingDuration,
                audioContextTime,
                note.velocity,
                note.channel
              );
            } catch (err) {
              console.warn(
                `[waveform-playlist] Failed to start mid-clip SoundFont note on track "${this.id}":` +
                  ' ' +
                  String(err)
              );
            }
          }
        }
      }
    }
  }

  /**
   * Stop all active AudioBufferSourceNodes.
   */
  stopAllSources(): void {
    for (const source of this.activeSources) {
      try {
        source.stop();
      } catch (err) {
        console.warn(
          '[waveform-playlist] Error stopping AudioBufferSourceNode:' + ' ' + String(err)
        );
      }
    }
    this.activeSources.clear();
  }

  /** No-op for MIDI — MIDI uses note velocity, not gain fades. */
  prepareFades(_when: number, _offset: number): void {}

  /** No-op for MIDI — no fade automation to cancel. */
  cancelFades(): void {}

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
          `[waveform-playlist] Error during SoundFont track "${this.id}" effects cleanup:` +
            ' ' +
            String(err)
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
          `[waveform-playlist] Error disposing Part ${index} on SoundFont track "${this.id}":` +
            ' ' +
            String(err)
        );
      }
    });

    try {
      this.volumeNode.dispose();
    } catch (err) {
      console.warn(
        `[waveform-playlist] Error disposing volumeNode on SoundFont track "${this.id}":` +
          ' ' +
          String(err)
      );
    }
    try {
      this.panNode.dispose();
    } catch (err) {
      console.warn(
        `[waveform-playlist] Error disposing panNode on SoundFont track "${this.id}":` +
          ' ' +
          String(err)
      );
    }
    try {
      this.muteGain.dispose();
    } catch (err) {
      console.warn(
        `[waveform-playlist] Error disposing muteGain on SoundFont track "${this.id}":` +
          ' ' +
          String(err)
      );
    }
  }

  get id(): string {
    return this.track.id;
  }

  get duration(): number {
    // Max end across clips — the array is NOT sorted by startTime.
    let max = 0;
    for (const { clipInfo } of this.scheduledClips) {
      const end = clipInfo.startTime + clipInfo.duration;
      if (end > max) max = end;
    }
    return max;
  }

  get muted(): boolean {
    return this.track.muted;
  }

  get startTime(): number {
    return this.track.startTime;
  }
}
