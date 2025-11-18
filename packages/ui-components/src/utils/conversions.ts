export function samplesToSeconds(samples: number, sampleRate: number) {
  return samples / sampleRate;
}

export function secondsToSamples(seconds: number, sampleRate: number) {
  return Math.ceil(seconds * sampleRate);
}

export function samplesToPixels(samples: number, samplesPerPixel: number) {
  return Math.floor(samples / samplesPerPixel);
}

export function pixelsToSamples(pixels: number, samplesPerPixel: number) {
  return Math.floor(pixels * samplesPerPixel);
}

export function pixelsToSeconds(
  pixels: number,
  samplesPerPixel: number,
  sampleRate: number
) {
  return (pixels * samplesPerPixel) / sampleRate;
}

export function secondsToPixels(
  seconds: number,
  samplesPerPixel: number,
  sampleRate: number
) {
  return Math.ceil((seconds * sampleRate) / samplesPerPixel);
}
