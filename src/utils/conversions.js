export function samplesToSeconds(samples, sampleRate) {
  return samples / sampleRate;
}

export function secondsToSamples(seconds, sampleRate) {
  return Math.ceil(seconds * sampleRate);
}

export function samplesToPixels(samples, resolution) {
  return Math.floor(samples / resolution);
}

export function pixelsToSamples(pixels, resolution) {
  return Math.floor(pixels * resolution);
}

export function pixelsToSeconds(pixels, resolution, sampleRate) {
  return (pixels * resolution) / sampleRate;
}

export function secondsToPixels(seconds, resolution, sampleRate) {
  return Math.ceil((seconds * sampleRate) / resolution);
}
