const DEFAULT_FLOOR = -100;

/**
 * Convert a dB value to a normalized range.
 *
 * Maps dB values linearly: floor → 0, 0 dB → 1.
 * Values above 0 dB map to > 1 (e.g., +5 dB → 1.05 with default floor).
 *
 * @param dB - Decibel value (typically -Infinity to +5)
 * @param floor - Minimum dB value mapped to 0. Default: -100 (Firefox compat)
 * @returns Normalized value (0 at floor, 1 at 0 dB, >1 above 0 dB)
 */
export function dBToNormalized(dB: number, floor: number = DEFAULT_FLOOR): number {
  if (Number.isNaN(dB)) {
    console.warn('[waveform-playlist] dBToNormalized received NaN');
    return 0;
  }
  if (floor >= 0) {
    console.warn('[waveform-playlist] dBToNormalized floor must be negative, got:', floor);
    return 0;
  }
  if (!isFinite(dB) || dB <= floor) return 0;
  return (dB - floor) / -floor;
}

/**
 * Convert a normalized value back to dB.
 *
 * Maps linearly: 0 → floor, 1 → 0 dB.
 * Values above 1 map to positive dB (e.g., 1.05 → +5 dB with default floor).
 *
 * @param normalized - Normalized value (0 = floor, 1 = 0 dB)
 * @param floor - Minimum dB value (maps from 0). Must be negative. Default: -100
 * @returns dB value (floor at 0, 0 dB at 1, positive dB above 1)
 */
export function normalizedToDb(normalized: number, floor: number = DEFAULT_FLOOR): number {
  if (!isFinite(normalized)) return floor;
  if (floor >= 0) {
    console.warn('[waveform-playlist] normalizedToDb floor must be negative, got:', floor);
    return DEFAULT_FLOOR;
  }
  const clamped = Math.max(0, normalized);
  return clamped * -floor + floor;
}

/**
 * Convert a linear gain value to decibels.
 *
 * @param gain - Linear gain (0 = silence, 1 = unity)
 * @returns Decibel value (e.g., 0.5 → ≈ -6.02 dB)
 */
export function gainToDb(gain: number): number {
  return 20 * Math.log10(Math.max(gain, 0.0001));
}

/**
 * Convert a linear gain value (0-1+) to normalized 0-1 via dB.
 *
 * Combines gain-to-dB (20 * log10) with dBToNormalized for a consistent
 * mapping from raw AudioWorklet peak/RMS values to the 0-1 range used
 * by UI meter components.
 *
 * @param gain - Linear gain value (typically 0 to 1, can exceed 1)
 * @param floor - Minimum dB value mapped to 0. Default: -100
 * @returns Normalized value (0 at silence/floor, 1 at 0 dB, >1 above 0 dB)
 */
export function gainToNormalized(gain: number, floor: number = DEFAULT_FLOOR): number {
  if (gain <= 0) return 0;
  // Use raw log10 (no clamp) — gain > 0 is guaranteed above,
  // and dBToNormalized handles -Infinity via its floor check.
  const db = 20 * Math.log10(gain);
  return dBToNormalized(db, floor);
}
