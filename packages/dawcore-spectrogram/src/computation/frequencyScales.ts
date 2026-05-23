/**
 * Frequency scale mapping functions.
 * Each maps a frequency (Hz) to a normalized position [0, 1].
 */

function linearScale(f: number, minF: number, maxF: number): number {
  if (maxF === minF) return 0;
  return (f - minF) / (maxF - minF);
}

function logarithmicScale(f: number, minF: number, maxF: number): number {
  const logMin = Math.log2(Math.max(minF, 1));
  const logMax = Math.log2(maxF);
  if (logMax === logMin) return 0;
  return (Math.log2(Math.max(f, 1)) - logMin) / (logMax - logMin);
}

function hzToMel(f: number): number {
  return 2595 * Math.log10(1 + f / 700);
}

function melScale(f: number, minF: number, maxF: number): number {
  const melMin = hzToMel(minF);
  const melMax = hzToMel(maxF);
  if (melMax === melMin) return 0;
  return (hzToMel(f) - melMin) / (melMax - melMin);
}

function hzToBark(f: number): number {
  return 13 * Math.atan(0.00076 * f) + 3.5 * Math.atan((f / 7500) ** 2);
}

function barkScale(f: number, minF: number, maxF: number): number {
  const barkMin = hzToBark(minF);
  const barkMax = hzToBark(maxF);
  if (barkMax === barkMin) return 0;
  return (hzToBark(f) - barkMin) / (barkMax - barkMin);
}

function hzToErb(f: number): number {
  return 21.4 * Math.log10(1 + 0.00437 * f);
}

function erbScale(f: number, minF: number, maxF: number): number {
  const erbMin = hzToErb(minF);
  const erbMax = hzToErb(maxF);
  if (erbMax === erbMin) return 0;
  return (hzToErb(f) - erbMin) / (erbMax - erbMin);
}

export type FrequencyScaleName = 'linear' | 'logarithmic' | 'mel' | 'bark' | 'erb';

/**
 * Returns a mapping function: (frequencyHz, minFrequency, maxFrequency) → [0, 1]
 */
export function getFrequencyScale(
  name: FrequencyScaleName
): (f: number, minF: number, maxF: number) => number {
  switch (name) {
    case 'logarithmic':
      return logarithmicScale;
    case 'mel':
      return melScale;
    case 'bark':
      return barkScale;
    case 'erb':
      return erbScale;
    case 'linear':
      return linearScale;
    default:
      console.warn(`[spectrogram] Unknown frequency scale "${name}", falling back to linear`);
      return linearScale;
  }
}
