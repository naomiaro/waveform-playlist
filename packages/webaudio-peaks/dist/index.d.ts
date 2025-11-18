/**
 * Peaks type - represents a typed array of peak data
 */
type Peaks = Int8Array | Int16Array | Int32Array;
/**
 * Bits type - number of bits for peak data
 */
type Bits = 8 | 16 | 32;
/**
 * PeakData - result of peak extraction
 */
interface PeakData {
    /** Number of peaks extracted */
    length: number;
    /** Array of peak data for each channel */
    data: Peaks[];
    /** Bit depth of peak data */
    bits: Bits;
}
/**
 * Extract peaks from an AudioBuffer or Float32Array for waveform visualization
 *
 * @param source - AudioBuffer or Float32Array to extract peaks from
 * @param samplesPerPixel - Number of audio samples per peak (default: 1000)
 * @param isMono - Whether to merge channels to mono (default: true)
 * @param cueIn - Start index for peak extraction (default: 0)
 * @param cueOut - End index for peak extraction (default: source.length)
 * @param bits - Bit depth for peak data: 8, 16, or 32 (default: 16)
 * @returns PeakData object containing peak arrays for each channel
 */
declare function extractPeaksFromBuffer(source: AudioBuffer | Float32Array, samplesPerPixel?: number, isMono?: boolean, cueIn?: number, cueOut?: number, bits?: Bits): PeakData;

export { type Bits, type PeakData, type Peaks, extractPeaksFromBuffer as default };
