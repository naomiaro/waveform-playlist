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

  function makeMono(channelPeaks, bits) {
    const numChan = channelPeaks.length;
    const weight = 1 / numChan;
    const numPeaks = channelPeaks[0].length / 2;
    let min;
    let max;
    const peaks = new self[`Int${bits}Array`](numPeaks * 2);

    for (let i = 0; i < numPeaks; i += 1) {
      min = 0;
      max = 0;

      for (let c = 0; c < numChan; c += 1) {
        min += weight * channelPeaks[c][i * 2];
        max += weight * channelPeaks[c][(i * 2) + 1];
      }

      peaks[i * 2] = min;
      peaks[(i * 2) + 1] = max;
    }

    // return in array so channel number counts still work.
    return [peaks];
  }

  /**
  * @param {AudioBuffer,TypedArray} source - Source of audio samples for peak calculations.
  * @param {Number} samplesPerPixel - Number of audio samples per peak.
  * @param {Number} cueIn - index in channel to start peak calculations from.
  * @param {Number} cueOut - index in channel to end peak calculations from (non-inclusive).
  */
  function audioPeaks(source, samplesPerPixel = 10000, isMono = true, cueIn, cueOut, bits = 8) {
    if ([8, 16, 32].indexOf(bits) < 0) {
      throw new Error('Invalid number of bits specified for peaks.');
    }

    const numChan = source.numberOfChannels;
    let peaks = [];

    if (typeof source.subarray === 'undefined') {
      for (let c = 0; c < numChan; c += 1) {
        const channel = source.getChannelData(c);
        const start = cueIn || 0;
        const end = cueOut || channel.length;
        const slice = channel.subarray(start, end);
        peaks.push(extractPeaks(slice, samplesPerPixel, bits));
      }
    } else {
      const start = cueIn || 0;
      const end = cueOut || source.length;
      peaks.push(extractPeaks(source.subarray(start, end), samplesPerPixel, bits));
    }

    if (isMono && peaks.length > 1) {
      peaks = makeMono(peaks, bits);
    }

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
