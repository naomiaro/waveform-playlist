export interface ClickSoundOptions {
  /** Frequency for accent click (beat 1). Default: 1000 Hz */
  accentFrequency?: number;
  /** Frequency for normal click (other beats). Default: 800 Hz */
  normalFrequency?: number;
}

const DEFAULT_ACCENT_FREQUENCY = 1000;
const DEFAULT_NORMAL_FREQUENCY = 800;
const ACCENT_DURATION = 0.04; // 40ms
const NORMAL_DURATION = 0.03; // 30ms

function synthesizeClick(
  audioContext: AudioContext,
  frequency: number,
  duration: number
): AudioBuffer {
  const sampleRate = audioContext.sampleRate;
  const length = Math.ceil(sampleRate * duration);
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * 50);
    data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope;
  }

  return buffer;
}

export function createDefaultClickSounds(
  audioContext: AudioContext,
  options?: ClickSoundOptions
): { accent: AudioBuffer; normal: AudioBuffer } {
  const accentFreq = options?.accentFrequency ?? DEFAULT_ACCENT_FREQUENCY;
  const normalFreq = options?.normalFrequency ?? DEFAULT_NORMAL_FREQUENCY;

  if (accentFreq <= 0 || normalFreq <= 0) {
    console.warn(
      '[waveform-playlist] createDefaultClickSounds: frequency must be positive, got accent=' +
        accentFreq +
        ' normal=' +
        normalFreq
    );
  }

  return {
    accent: synthesizeClick(audioContext, accentFreq, ACCENT_DURATION),
    normal: synthesizeClick(audioContext, normalFreq, NORMAL_DURATION),
  };
}
