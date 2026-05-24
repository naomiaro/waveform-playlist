import type { SpectrogramConfig, ColorMapValue } from '../types/spectrogram';

/**
 * Default values for `SpectrogramConfig` fields. Used by both the orchestrator
 * and the React controller so defaults can't drift between layers.
 *
 * Intentionally omitted:
 * - `maxFrequency` — defaults to `sampleRate / 2` at compute time (clip-dependent)
 * - `alpha` — window-specific (only used by the `hamming` window function); its
 *   canonical default (0.54) lives in `windowFunctions.ts` where the math is
 * - `labelsColor`, `labelsBackground` — kept as optional `undefined` so consumers
 *   can opt into label styling without forcing a color value
 */
export const SPECTROGRAM_DEFAULTS: Required<
  Omit<SpectrogramConfig, 'maxFrequency' | 'alpha' | 'labelsColor' | 'labelsBackground'>
> & {
  labelsColor: string | undefined;
  labelsBackground: string | undefined;
} = {
  fftSize: 2048,
  hopSize: 512,
  windowFunction: 'hann',
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
