/**
 * Peaks type - represents a typed array of peak data
 */
export type Peaks = Int8Array | Int16Array;

/**
 * Bits type - number of bits for peak data
 */
export type Bits = 8 | 16;

/**
 * PeakData - result of peak extraction
 */
export interface PeakData {
  /** Number of peaks extracted */
  length: number;
  /** Array of peak data for each channel */
  data: Peaks[];
  /** Bit depth of peak data */
  bits: Bits;
}

/**
 * Find minimum and maximum values in a typed array
 */
function findMinMax(array: Float32Array): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < array.length; i++) {
    const curr = array[i];
    if (min > curr) {
      min = curr;
    }
    if (max < curr) {
      max = curr;
    }
  }

  return { min, max };
}

/**
 * Convert a float peak to an integer based on bit depth
 */
function convert(n: number, bits: Bits): number {
  const maxValue = Math.pow(2, bits - 1);
  const v = n < 0 ? n * maxValue : n * (maxValue - 1);
  return Math.max(-maxValue, Math.min(maxValue - 1, v));
}

/**
 * Create a typed array based on bit depth
 */
function makeTypedArray(bits: Bits, length: number): Peaks {
  switch (bits) {
    case 8:
      return new Int8Array(length);
    case 16:
      return new Int16Array(length);
  }
}

/**
 * Extract peaks from a single audio channel
 */
function extractPeaks(
  channel: Float32Array,
  samplesPerPixel: number,
  bits: Bits
): Peaks {
  const chanLength = channel.length;
  const numPeaks = Math.ceil(chanLength / samplesPerPixel);

  // Create interleaved array of min,max
  const peaks = makeTypedArray(bits, numPeaks * 2);

  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerPixel;
    const end = Math.min((i + 1) * samplesPerPixel, chanLength);

    const segment = channel.subarray(start, end);
    const extrema = findMinMax(segment);
    const min = convert(extrema.min, bits);
    const max = convert(extrema.max, bits);

    peaks[i * 2] = min;
    peaks[i * 2 + 1] = max;
  }

  return peaks;
}

/**
 * Merge multiple channel peaks into a mono peak array
 */
function makeMono(channelPeaks: Peaks[], bits: Bits): Peaks[] {
  const numChan = channelPeaks.length;
  const weight = 1 / numChan;
  const numPeaks = channelPeaks[0].length / 2;
  const peaks = makeTypedArray(bits, numPeaks * 2);

  for (let i = 0; i < numPeaks; i++) {
    let min = 0;
    let max = 0;

    for (let c = 0; c < numChan; c++) {
      min += weight * channelPeaks[c][i * 2];
      max += weight * channelPeaks[c][i * 2 + 1];
    }

    peaks[i * 2] = min;
    peaks[i * 2 + 1] = max;
  }

  // Return in array so channel number counts still work
  return [peaks];
}

/**
 * Extract peaks from an AudioBuffer or Float32Array for waveform visualization
 *
 * @param source - AudioBuffer or Float32Array to extract peaks from
 * @param samplesPerPixel - Number of audio samples per peak (default: 1000)
 * @param isMono - Whether to merge channels to mono (default: true)
 * @param cueIn - Start index for peak extraction (default: 0)
 * @param cueOut - End index for peak extraction (default: source.length)
 * @param bits - Bit depth for peak data: 8 or 16 (default: 16)
 * @returns PeakData object containing peak arrays for each channel
 */
export default function extractPeaksFromBuffer(
  source: AudioBuffer | Float32Array,
  samplesPerPixel: number = 1000,
  isMono: boolean = true,
  cueIn: number = 0,
  cueOut?: number,
  bits: Bits = 16
): PeakData {
  if (bits !== 8 && bits !== 16) {
    throw new Error('Invalid number of bits specified for peaks. Must be 8 or 16.');
  }

  let peaks: Peaks[] = [];

  // Check if source is an AudioBuffer or Float32Array
  if ('getChannelData' in source) {
    // AudioBuffer
    const numChan = source.numberOfChannels;
    const actualCueOut = cueOut ?? source.length;

    for (let c = 0; c < numChan; c++) {
      const channel = source.getChannelData(c);
      const slice = channel.subarray(cueIn, actualCueOut);
      peaks.push(extractPeaks(slice, samplesPerPixel, bits));
    }
  } else {
    // Float32Array
    const actualCueOut = cueOut ?? source.length;
    const slice = source.subarray(cueIn, actualCueOut);
    peaks.push(extractPeaks(slice, samplesPerPixel, bits));
  }

  if (isMono && peaks.length > 1) {
    peaks = makeMono(peaks, bits);
  }

  const numPeaks = peaks[0].length / 2;

  return {
    length: numPeaks,
    data: peaks,
    bits: bits,
  };
}
