// src/index.ts
function findMinMax(array) {
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
function convert(n, bits) {
  const maxValue = Math.pow(2, bits - 1);
  const v = n < 0 ? n * maxValue : n * (maxValue - 1);
  return Math.max(-maxValue, Math.min(maxValue - 1, v));
}
function makeTypedArray(bits, length) {
  switch (bits) {
    case 8:
      return new Int8Array(length);
    case 16:
      return new Int16Array(length);
    case 32:
      return new Int32Array(length);
  }
}
function extractPeaks(channel, samplesPerPixel, bits) {
  const chanLength = channel.length;
  const numPeaks = Math.ceil(chanLength / samplesPerPixel);
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
function makeMono(channelPeaks, bits) {
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
  return [peaks];
}
function extractPeaksFromBuffer(source, samplesPerPixel = 1e3, isMono = true, cueIn = 0, cueOut, bits = 16) {
  if (bits !== 8 && bits !== 16 && bits !== 32) {
    throw new Error("Invalid number of bits specified for peaks.");
  }
  let peaks = [];
  if ("getChannelData" in source) {
    const numChan = source.numberOfChannels;
    const actualCueOut = cueOut ?? source.length;
    for (let c = 0; c < numChan; c++) {
      const channel = source.getChannelData(c);
      const slice = channel.subarray(cueIn, actualCueOut);
      peaks.push(extractPeaks(slice, samplesPerPixel, bits));
    }
  } else {
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
    bits
  };
}
export {
  extractPeaksFromBuffer as default
};
//# sourceMappingURL=index.mjs.map