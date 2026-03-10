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
  const clamped = Math.max(0, normalized);
  return clamped * -floor + floor;
}
