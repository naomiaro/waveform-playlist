import type { SpectrogramConfig, ColorMapValue } from '../types/spectrogram';

/**
 * Default values for every `SpectrogramConfig` field. Used by both
 * `@dawcore/spectrogram`'s orchestrator and `@dawcore/components`'s
 * controller so defaults can't drift between layers.
 *
 * `maxFrequency` is intentionally omitted — it defaults to `sampleRate / 2`
 * at compute time (depends on the clip's audio).
 */
export const SPECTROGRAM_DEFAULTS: Required<
  Omit<SpectrogramConfig, 'maxFrequency' | 'labelsColor' | 'labelsBackground'>
> & {
  labelsColor: string | undefined;
  labelsBackground: string | undefined;
} = {
  fftSize: 2048,
  hopSize: 512,
  windowFunction: 'hann',
  alpha: 0.5,
  frequencyScale: 'mel',
  minFrequency: 0,
  gainDb: 20,
  rangeDb: 80,
  zeroPaddingFactor: 2,
  labels: false,
  labelsColor: undefined,
  labelsBackground: undefined,
};

/** Default color map when none is specified. */
export const DEFAULT_SPECTROGRAM_COLOR_MAP: ColorMapValue = 'viridis';
