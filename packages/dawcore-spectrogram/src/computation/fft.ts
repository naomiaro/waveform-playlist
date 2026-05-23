import FFT from 'fft.js';

/**
 * Cache fft.js instances per size (pre-computes twiddle factors).
 */
const fftInstances = new Map<number, FFT>();
const complexBuffers = new Map<number, number[]>();

function getFftInstance(size: number): FFT {
  let instance = fftInstances.get(size);
  if (!instance) {
    instance = new FFT(size);
    fftInstances.set(size, instance);
    complexBuffers.set(size, instance.createComplexArray());
  }
  return instance;
}

function getComplexBuffer(size: number): number[] {
  const buffer = complexBuffers.get(size);
  if (!buffer) {
    throw new Error(`No complex buffer for size ${size}. Call getFftInstance first.`);
  }
  return buffer;
}

/**
 * In-place FFT using fft.js (radix-4).
 * @param real - Real part (modified in place)
 * @param imag - Imaginary part (modified in place)
 */
export function fft(real: Float32Array, imag: Float32Array): void {
  const n = real.length;
  const f = getFftInstance(n);
  const input = f.createComplexArray();
  const out = getComplexBuffer(n);

  for (let i = 0; i < n; i++) {
    input[i * 2] = real[i];
    input[i * 2 + 1] = imag[i];
  }

  f.transform(out, input);

  for (let i = 0; i < n; i++) {
    real[i] = out[i * 2];
    imag[i] = out[i * 2 + 1];
  }
}

/**
 * Fused FFT → magnitude → decibels for real-valued input.
 * Uses fft.js realTransform (radix-4, ~25% faster for real input).
 * Writes dB values for positive frequencies (n/2 bins) into `out`.
 *
 * @param real - Real input (windowed audio frame, length n)
 * @param out - Output array for dB values (length >= n/2)
 */
export function fftMagnitudeDb(real: Float32Array, out: Float32Array): void {
  const n = real.length;
  const f = getFftInstance(n);
  const complexOut = getComplexBuffer(n);

  f.realTransform(complexOut, real);

  const half = n >> 1;
  for (let i = 0; i < half; i++) {
    const re = complexOut[i * 2];
    const im = complexOut[i * 2 + 1];
    let db = 20 * Math.log10(Math.sqrt(re * re + im * im) + 1e-10);
    if (db < -160) db = -160;
    out[i] = db;
  }
}

/**
 * Compute magnitude spectrum from FFT output.
 * Returns only the first half (positive frequencies).
 */
export function magnitudeSpectrum(real: Float32Array, imag: Float32Array): Float32Array {
  const n = real.length >> 1;
  const magnitudes = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    magnitudes[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
  return magnitudes;
}

/**
 * Convert magnitudes to decibels with a fixed -160 dB floor.
 * Gain is applied at render time, not during FFT.
 */
export function toDecibels(magnitudes: Float32Array): Float32Array {
  const result = new Float32Array(magnitudes.length);
  for (let i = 0; i < magnitudes.length; i++) {
    let db = 20 * Math.log10(magnitudes[i] + 1e-10);
    if (db < -160) db = -160;
    result[i] = db;
  }
  return result;
}
