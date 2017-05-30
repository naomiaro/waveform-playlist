export default function () {
  // http://jsperf.com/typed-array-min-max/2
  // plain for loop for finding min/max is way faster than anything else.
  /**
  * @param {TypedArray} array - Subarray of audio to calculate peaks from.
  */
  function findMinMax(array) {
    let min = Infinity;
    let max = -Infinity;
    let curr;

    for (let i = 0; i < array.length; i += 1) {
      curr = array[i];
      if (min > curr) {
        min = curr;
      }
      if (max < curr) {
        max = curr;
      }
    }

    return {
      min,
      max,
    };
  }

  /**
  * @param {Number} n - peak to convert from float to Int8, Int16 etc.
  * @param {Number} bits - convert to #bits two's complement signed integer
  */
  function convert(n, bits) {
    const max = 2 ** (bits - 1);
    const v = n < 0 ? (n * max) : (n * max) - 1;
    return Math.max(-max, Math.min(max - 1, v));
  }

  /**
  * @param {TypedArray} channel - Audio track frames to calculate peaks from.
  * @param {Number} samplesPerPixel - Audio frames per peak
  */
  function extractPeaks(channel, samplesPerPixel, bits) {
    const chanLength = channel.length;
    const numPeaks = Math.ceil(chanLength / samplesPerPixel);
    let start;
    let end;
    let segment;
    let max;
    let min;
    let extrema;

    // create interleaved array of min,max
    const peaks = new self[`Int${bits}Array`](numPeaks * 2);

    for (let i = 0; i < numPeaks; i += 1) {
      start = i * samplesPerPixel;
      end = (i + 1) * samplesPerPixel > chanLength ? chanLength : (i + 1) * samplesPerPixel;

      segment = channel.subarray(start, end);
      extrema = findMinMax(segment);
      min = convert(extrema.min, bits);
      max = convert(extrema.max, bits);

      peaks[i * 2] = min;
      peaks[(i * 2) + 1] = max;
    }

    return peaks;
  }

  /**
  * @param {TypedArray} source - Source of audio samples for peak calculations.
  * @param {Number} samplesPerPixel - Number of audio samples per peak.
  * @param {Number} cueIn - index in channel to start peak calculations from.
  * @param {Number} cueOut - index in channel to end peak calculations from (non-inclusive).
  */
  function audioPeaks(source, samplesPerPixel = 10000, bits = 8) {
    if ([8, 16, 32].indexOf(bits) < 0) {
      throw new Error('Invalid number of bits specified for peaks.');
    }

    const peaks = [];
    const start = 0;
    const end = source.length;
    peaks.push(extractPeaks(source.subarray(start, end), samplesPerPixel, bits));

    const length = peaks[0].length / 2;

    return {
      bits,
      length,
      data: peaks,
    };
  }

  onmessage = function onmessage(e) {
    const peaks = audioPeaks(e.data.samples, e.data.samplesPerPixel);

    postMessage(peaks);
  };
}
