import { SoundFont2, GeneratorType } from 'soundfont2';
import type { Key, Generator, ZoneMap } from 'soundfont2';

/**
 * Result of looking up a MIDI note in the SoundFont.
 * Contains the AudioBuffer, playbackRate, loop points, and volume envelope.
 */
export interface SoundFontSample {
  /** Cached AudioBuffer for this sample */
  buffer: AudioBuffer;
  /** Playback rate to pitch-shift from originalPitch to target note */
  playbackRate: number;
  /** Loop mode: 0=no loop, 1=continuous, 3=sustain loop */
  loopMode: number;
  /** Loop start in seconds, relative to AudioBuffer start */
  loopStart: number;
  /** Loop end in seconds, relative to AudioBuffer start */
  loopEnd: number;
  /** Volume envelope attack time in seconds */
  attackVolEnv: number;
  /** Volume envelope hold time in seconds */
  holdVolEnv: number;
  /** Volume envelope decay time in seconds */
  decayVolEnv: number;
  /** Volume envelope sustain level as linear gain 0-1 */
  sustainVolEnv: number;
  /** Volume envelope release time in seconds */
  releaseVolEnv: number;
}

/**
 * Convert SF2 timecents to seconds.
 * SF2 formula: seconds = 2^(timecents / 1200)
 * Default -12000 timecents ≈ 0.001s (effectively instant).
 */
export function timecentsToSeconds(tc: number): number {
  return Math.pow(2, tc / 1200);
}

/** Max release time to prevent extremely long tails from stale generators */
const MAX_RELEASE_SECONDS = 5;

/**
 * Get a numeric generator value from a zone map.
 */
export function getGeneratorValue(
  generators: ZoneMap<Generator>,
  type: GeneratorType
): number | undefined {
  return generators[type]?.value;
}

/**
 * Caches parsed SoundFont2 data and AudioBuffers for efficient playback.
 *
 * AudioBuffers are created lazily on first access and cached by sample index.
 * Pitch calculation uses the SF2 generator chain:
 *   OverridingRootKey → sample.header.originalPitch → fallback 60
 *
 * Audio graph per note:
 *   AudioBufferSourceNode (playbackRate for pitch) → GainNode (velocity) → track chain
 */
export class SoundFontCache {
  private sf2: SoundFont2 | null = null;
  private audioBufferCache: Map<number, AudioBuffer> = new Map();
  private context: BaseAudioContext;

  /**
   * @param context Optional AudioContext for createBuffer(). If omitted, uses
   *   an OfflineAudioContext which doesn't require user gesture — safe to
   *   construct before user interaction (avoids Firefox autoplay warnings).
   */
  constructor(context?: BaseAudioContext) {
    // OfflineAudioContext only needs valid params; we never call startRendering().
    // It's used solely for createBuffer() which works identically to AudioContext.
    this.context = context ?? new OfflineAudioContext(1, 1, 44100);
  }

  /**
   * Load and parse an SF2 file from a URL.
   */
  async load(url: string, signal?: AbortSignal): Promise<void> {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch SoundFont ${url}: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    try {
      this.sf2 = new SoundFont2(new Uint8Array(arrayBuffer));
    } catch (err) {
      throw new Error(
        `Failed to parse SoundFont ${url}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Load from an already-fetched ArrayBuffer.
   */
  loadFromBuffer(data: ArrayBuffer): void {
    try {
      this.sf2 = new SoundFont2(new Uint8Array(data));
    } catch (err) {
      throw new Error(
        `Failed to parse SoundFont from buffer: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  get isLoaded(): boolean {
    return this.sf2 !== null;
  }

  /**
   * Look up a MIDI note and return the AudioBuffer + playbackRate.
   *
   * @param midiNote - MIDI note number (0-127)
   * @param bankNumber - Bank number (0 for melodic, 128 for percussion/drums)
   * @param presetNumber - GM program number (0-127)
   * @returns SoundFontSample or null if no sample found for this note
   */
  getAudioBuffer(
    midiNote: number,
    bankNumber: number = 0,
    presetNumber: number = 0
  ): SoundFontSample | null {
    if (!this.sf2) return null;

    const keyData = this.sf2.getKeyData(midiNote, bankNumber, presetNumber);
    if (!keyData) return null;

    const sample = keyData.sample;
    const sampleIndex = this.sf2.samples.indexOf(sample);

    // Get or create the AudioBuffer for this sample
    let buffer = this.audioBufferCache.get(sampleIndex);
    if (!buffer) {
      buffer = this.int16ToAudioBuffer(sample.data, sample.header.sampleRate);
      this.audioBufferCache.set(sampleIndex, buffer);
    }

    // Calculate playback rate using SF2 generator chain for root key.
    // Priority: OverridingRootKey generator → sample.header.originalPitch → 60
    const playbackRate = this.calculatePlaybackRate(midiNote, keyData);

    // Extract per-zone loop points and volume envelope from generators
    const loopAndEnvelope = this.extractLoopAndEnvelope(keyData);

    return { buffer, playbackRate, ...loopAndEnvelope };
  }

  /**
   * Extract loop points and volume envelope data from per-zone generators.
   *
   * Loop points are stored as absolute indices into the SF2 sample pool.
   * We convert to AudioBuffer-relative seconds by subtracting header.start
   * and dividing by sampleRate.
   *
   * Volume envelope times are in SF2 timecents; sustain is centibels attenuation.
   */
  private extractLoopAndEnvelope(keyData: Key): Omit<SoundFontSample, 'buffer' | 'playbackRate'> {
    const { generators } = keyData;
    const header = keyData.sample.header;

    // --- Loop points ---
    const loopMode = getGeneratorValue(generators, GeneratorType.SampleModes) ?? 0;

    // Compute actual loop positions (header + fine/coarse generator offsets)
    const rawLoopStart =
      header.startLoop +
      (getGeneratorValue(generators, GeneratorType.StartLoopAddrsOffset) ?? 0) +
      (getGeneratorValue(generators, GeneratorType.StartLoopAddrsCoarseOffset) ?? 0) * 32768;
    const rawLoopEnd =
      header.endLoop +
      (getGeneratorValue(generators, GeneratorType.EndLoopAddrsOffset) ?? 0) +
      (getGeneratorValue(generators, GeneratorType.EndLoopAddrsCoarseOffset) ?? 0) * 32768;

    // The soundfont2 library already converts startLoop/endLoop to be
    // relative to sample.data (subtracts header.start during parsing),
    // so we only need to divide by sampleRate to get seconds.
    const loopStart = rawLoopStart / header.sampleRate;
    const loopEnd = rawLoopEnd / header.sampleRate;

    // --- Volume envelope ---
    const attackVolEnv = timecentsToSeconds(
      getGeneratorValue(generators, GeneratorType.AttackVolEnv) ?? -12000
    );
    const holdVolEnv = timecentsToSeconds(
      getGeneratorValue(generators, GeneratorType.HoldVolEnv) ?? -12000
    );
    const decayVolEnv = timecentsToSeconds(
      getGeneratorValue(generators, GeneratorType.DecayVolEnv) ?? -12000
    );
    const releaseVolEnv = Math.min(
      timecentsToSeconds(getGeneratorValue(generators, GeneratorType.ReleaseVolEnv) ?? -12000),
      MAX_RELEASE_SECONDS
    );

    // SustainVolEnv is centibels attenuation: 0 = full volume, 1440 = silence
    // Convert to linear gain: 10^(-cb / 200)
    const sustainCb = getGeneratorValue(generators, GeneratorType.SustainVolEnv) ?? 0;
    const sustainVolEnv = Math.pow(10, -sustainCb / 200);

    return {
      loopMode,
      loopStart,
      loopEnd,
      attackVolEnv,
      holdVolEnv,
      decayVolEnv,
      sustainVolEnv,
      releaseVolEnv,
    };
  }

  /**
   * Calculate playback rate for a MIDI note using the SF2 generator chain.
   *
   * SF2 root key resolution priority:
   *   1. OverridingRootKey generator (per-zone, most specific)
   *   2. sample.header.originalPitch (sample header)
   *   3. MIDI note 60 (middle C fallback)
   *
   * Tuning adjustments:
   *   - CoarseTune generator (semitones, additive)
   *   - FineTune generator (cents, additive)
   *   - sample.header.pitchCorrection (cents, additive)
   */
  private calculatePlaybackRate(midiNote: number, keyData: Key): number {
    const sample = keyData.sample;
    const generators = keyData.generators;

    // Resolve root key: OverridingRootKey → originalPitch → 60
    const overrideRootKey = getGeneratorValue(generators, GeneratorType.OverridingRootKey);
    const originalPitch = sample.header.originalPitch;
    const rootKey =
      overrideRootKey !== undefined ? overrideRootKey : originalPitch !== 255 ? originalPitch : 60;

    // Tuning adjustments in semitones
    const coarseTune = getGeneratorValue(generators, GeneratorType.CoarseTune) ?? 0;
    const fineTune = getGeneratorValue(generators, GeneratorType.FineTune) ?? 0;
    const pitchCorrection = sample.header.pitchCorrection ?? 0;

    // Total offset in semitones: target note - root key + tuning
    const totalSemitones = midiNote - rootKey + coarseTune + (fineTune + pitchCorrection) / 100;

    return Math.pow(2, totalSemitones / 12);
  }

  /**
   * Convert Int16Array sample data to an AudioBuffer.
   * SF2 samples are 16-bit signed integers; Web Audio needs Float32 [-1, 1].
   */
  private int16ToAudioBuffer(data: Int16Array, sampleRate: number): AudioBuffer {
    const buffer = this.context.createBuffer(1, data.length, sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      channel[i] = data[i] / 32768;
    }
    return buffer;
  }

  /**
   * Clear all cached AudioBuffers and release the parsed SF2.
   */
  dispose(): void {
    this.audioBufferCache.clear();
    this.sf2 = null;
  }
}
