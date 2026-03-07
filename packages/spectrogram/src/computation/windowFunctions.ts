/**
 * Window functions for spectral analysis.
 *
 * Uses periodic (DFT-even) windows where the denominator is N, not N-1.
 * Periodic windows tile perfectly over consecutive FFT frames, giving better
 * frequency resolution in STFT/spectrogram computation. This matches the
 * convention used by Audacity, SciPy (sym=False), and MATLAB ('periodic').
 */

export function getWindowFunction(name: string, size: number, alpha?: number): Float32Array {
  const window = new Float32Array(size);
  const N = size;

  switch (name) {
    case 'rectangular':
      for (let i = 0; i < size; i++) window[i] = 1;
      break;

    case 'bartlett':
      for (let i = 0; i < size; i++) {
        window[i] = 1 - Math.abs((2 * i - N) / N);
      }
      break;

    case 'hann':
      for (let i = 0; i < size; i++) {
        window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / N));
      }
      break;

    case 'hamming':
      for (let i = 0; i < size; i++) {
        const a = alpha ?? 0.54;
        window[i] = a - (1 - a) * Math.cos((2 * Math.PI * i) / N);
      }
      break;

    case 'blackman': {
      const a0 = 0.42;
      const a1 = 0.5;
      const a2 = 0.08;
      for (let i = 0; i < size; i++) {
        window[i] =
          a0 - a1 * Math.cos((2 * Math.PI * i) / N) + a2 * Math.cos((4 * Math.PI * i) / N);
      }
      break;
    }

    case 'blackman-harris': {
      const c0 = 0.35875;
      const c1 = 0.48829;
      const c2 = 0.14128;
      const c3 = 0.01168;
      for (let i = 0; i < size; i++) {
        window[i] =
          c0 -
          c1 * Math.cos((2 * Math.PI * i) / N) +
          c2 * Math.cos((4 * Math.PI * i) / N) -
          c3 * Math.cos((6 * Math.PI * i) / N);
      }
      break;
    }

    default:
      console.warn(`[spectrogram] Unknown window function "${name}", falling back to hann`);
      for (let i = 0; i < size; i++) {
        window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / N));
      }
  }

  // Amplitude normalization: scale so a 0 dB sine produces a 0 dB spectrum peak.
  // Matches Audacity: scale = 2.0 / sum(window)
  let sum = 0;
  for (let i = 0; i < size; i++) sum += window[i];
  if (sum > 0) {
    const scale = 2.0 / sum;
    for (let i = 0; i < size; i++) window[i] *= scale;
  }

  return window;
}
