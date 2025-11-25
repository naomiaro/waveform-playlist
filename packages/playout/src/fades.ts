/**
 * Fade utilities for Web Audio API
 *
 * Applies fade in/out envelopes to AudioParam (typically gain)
 * using various curve types.
 */

export type FadeType = 'linear' | 'logarithmic' | 'exponential' | 'sCurve';

/**
 * Simple fade configuration - just duration and type
 */
export interface FadeConfig {
  /** Duration of the fade in seconds */
  duration: number;
  /** Type of fade curve (default: 'linear') */
  type?: FadeType;
}

/**
 * Generate a linear fade curve
 */
function linearCurve(length: number, fadeIn: boolean): Float32Array {
  const curve = new Float32Array(length);
  const scale = length - 1;

  for (let i = 0; i < length; i++) {
    const x = i / scale;
    curve[i] = fadeIn ? x : 1 - x;
  }

  return curve;
}

/**
 * Generate an exponential fade curve
 */
function exponentialCurve(length: number, fadeIn: boolean): Float32Array {
  const curve = new Float32Array(length);
  const scale = length - 1;

  for (let i = 0; i < length; i++) {
    const x = i / scale;
    const index = fadeIn ? i : length - 1 - i;
    curve[index] = Math.exp(2 * x - 1) / Math.E;
  }

  return curve;
}

/**
 * Generate an S-curve (sine-based smooth curve)
 */
function sCurveCurve(length: number, fadeIn: boolean): Float32Array {
  const curve = new Float32Array(length);
  const phase = fadeIn ? Math.PI / 2 : -Math.PI / 2;

  for (let i = 0; i < length; i++) {
    curve[i] = Math.sin((Math.PI * i) / length - phase) / 2 + 0.5;
  }

  return curve;
}

/**
 * Generate a logarithmic fade curve
 */
function logarithmicCurve(length: number, fadeIn: boolean, base: number = 10): Float32Array {
  const curve = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    const index = fadeIn ? i : length - 1 - i;
    const x = i / length;
    curve[index] = Math.log(1 + base * x) / Math.log(1 + base);
  }

  return curve;
}

/**
 * Generate a fade curve of the specified type
 */
function generateCurve(type: FadeType, length: number, fadeIn: boolean): Float32Array {
  switch (type) {
    case 'linear':
      return linearCurve(length, fadeIn);
    case 'exponential':
      return exponentialCurve(length, fadeIn);
    case 'sCurve':
      return sCurveCurve(length, fadeIn);
    case 'logarithmic':
      return logarithmicCurve(length, fadeIn);
    default:
      return linearCurve(length, fadeIn);
  }
}

/**
 * Apply a fade in to an AudioParam
 *
 * @param param - The AudioParam to apply the fade to (usually gain)
 * @param startTime - When the fade starts (in seconds, AudioContext time)
 * @param duration - Duration of the fade in seconds
 * @param type - Type of fade curve
 * @param startValue - Starting value (default: 0)
 * @param endValue - Ending value (default: 1)
 */
export function applyFadeIn(
  param: AudioParam,
  startTime: number,
  duration: number,
  type: FadeType = 'linear',
  startValue: number = 0,
  endValue: number = 1
): void {
  if (duration <= 0) return;

  if (type === 'linear') {
    // Use native linear ramp for better performance
    param.setValueAtTime(startValue, startTime);
    param.linearRampToValueAtTime(endValue, startTime + duration);
  } else if (type === 'exponential') {
    // Exponential ramp can't start/end at 0, use small value
    param.setValueAtTime(Math.max(startValue, 0.001), startTime);
    param.exponentialRampToValueAtTime(Math.max(endValue, 0.001), startTime + duration);
  } else {
    // Use curve for sCurve and logarithmic
    const curve = generateCurve(type, 10000, true);
    // Scale curve to value range
    const scaledCurve = new Float32Array(curve.length);
    const range = endValue - startValue;
    for (let i = 0; i < curve.length; i++) {
      scaledCurve[i] = startValue + curve[i] * range;
    }
    param.setValueCurveAtTime(scaledCurve, startTime, duration);
  }
}

/**
 * Apply a fade out to an AudioParam
 *
 * @param param - The AudioParam to apply the fade to (usually gain)
 * @param startTime - When the fade starts (in seconds, AudioContext time)
 * @param duration - Duration of the fade in seconds
 * @param type - Type of fade curve
 * @param startValue - Starting value (default: 1)
 * @param endValue - Ending value (default: 0)
 */
export function applyFadeOut(
  param: AudioParam,
  startTime: number,
  duration: number,
  type: FadeType = 'linear',
  startValue: number = 1,
  endValue: number = 0
): void {
  if (duration <= 0) return;

  if (type === 'linear') {
    // Use native linear ramp for better performance
    param.setValueAtTime(startValue, startTime);
    param.linearRampToValueAtTime(endValue, startTime + duration);
  } else if (type === 'exponential') {
    // Exponential ramp can't start/end at 0, use small value
    param.setValueAtTime(Math.max(startValue, 0.001), startTime);
    param.exponentialRampToValueAtTime(Math.max(endValue, 0.001), startTime + duration);
  } else {
    // Use curve for sCurve and logarithmic
    const curve = generateCurve(type, 10000, false);
    // Scale curve to value range
    const scaledCurve = new Float32Array(curve.length);
    const range = startValue - endValue;
    for (let i = 0; i < curve.length; i++) {
      scaledCurve[i] = endValue + curve[i] * range;
    }
    param.setValueCurveAtTime(scaledCurve, startTime, duration);
  }
}
