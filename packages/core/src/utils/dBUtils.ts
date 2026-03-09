const DEFAULT_FLOOR = -100;

/**
 * Convert a dB value to a normalized 0-1 range.
 *
 * @param dB - Decibel value (typically -Infinity to 0)
 * @param floor - Minimum dB value mapped to 0. Default: -100 (Firefox compat)
 * @returns Clamped value between 0 and 1
 */
export function dBToNormalized(dB: number, floor: number = DEFAULT_FLOOR): number {
  if (!isFinite(dB) || dB <= floor) return 0;
  if (dB >= 0) return 1;
  return (dB - floor) / -floor;
}

/**
 * Convert a normalized 0-1 value back to dB.
 *
 * @param normalized - Value between 0 and 1 (clamped if outside range)
 * @param floor - Minimum dB value (maps from 0). Must be negative. Default: -100
 * @returns dB value between floor and 0
 */
export function normalizedToDb(normalized: number, floor: number = DEFAULT_FLOOR): number {
  if (!isFinite(normalized)) return floor;
  const clamped = Math.max(0, Math.min(1, normalized));
  return clamped * -floor + floor;
}
