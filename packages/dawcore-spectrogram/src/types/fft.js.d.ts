declare module 'fft.js' {
  /**
   * Radix-4 FFT implementation.
   * Complex arrays are interleaved [re0, im0, re1, im1, ...].
   */
  class FFT {
    constructor(size: number);

    readonly size: number;
    readonly table: number[];

    /** Create a zero-filled interleaved complex array of length `2 * size`. */
    createComplexArray(): number[];

    /** Extract real parts from an interleaved complex array. */
    fromComplexArray(complex: number[], storage?: number[]): number[];

    /** Convert a real array to interleaved complex format (imaginary parts set to 0). */
    toComplexArray(input: number[], storage?: number[]): number[];

    /** Mirror positive frequencies to complete the spectrum (in-place). */
    completeSpectrum(spectrum: number[]): void;

    /** Forward FFT on interleaved complex data. `out` and `data` must be different arrays. */
    transform(out: number[], data: number[]): void;

    /** Forward FFT optimised for real-valued input. `out` and `data` must be different arrays. */
    realTransform(out: number[], data: number[] | Float32Array): void;

    /** Inverse FFT on interleaved complex data. `out` and `data` must be different arrays. */
    inverseTransform(out: number[], data: number[]): void;
  }

  export default FFT;
}
