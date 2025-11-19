/**
 * Time format utilities for displaying and parsing audio timestamps
 */

export type TimeFormat = 'seconds' | 'thousandths' | 'hh:mm:ss' | 'hh:mm:ss.u' | 'hh:mm:ss.uu' | 'hh:mm:ss.uuu';

/**
 * Format time in clock format (hh:mm:ss with optional decimals)
 */
function clockFormat(seconds: number, decimals: number): string {
  const hours = Math.floor(seconds / 3600) % 24;
  const minutes = Math.floor(seconds / 60) % 60;
  const secs = (seconds % 60).toFixed(decimals);

  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    secs.padStart(decimals + 3, '0')
  );
}

/**
 * Format seconds according to the specified format
 */
export function formatTime(seconds: number, format: TimeFormat): string {
  switch (format) {
    case 'seconds':
      return seconds.toFixed(0);
    case 'thousandths':
      return seconds.toFixed(3);
    case 'hh:mm:ss':
      return clockFormat(seconds, 0);
    case 'hh:mm:ss.u':
      return clockFormat(seconds, 1);
    case 'hh:mm:ss.uu':
      return clockFormat(seconds, 2);
    case 'hh:mm:ss.uuu':
      return clockFormat(seconds, 3);
    default:
      return clockFormat(seconds, 3);
  }
}

/**
 * Parse a formatted time string back to seconds
 */
export function parseTime(timeStr: string, format: TimeFormat): number {
  if (!timeStr) return 0;

  switch (format) {
    case 'seconds':
    case 'thousandths':
      return parseFloat(timeStr) || 0;

    case 'hh:mm:ss':
    case 'hh:mm:ss.u':
    case 'hh:mm:ss.uu':
    case 'hh:mm:ss.uuu': {
      // Parse hh:mm:ss format
      const parts = timeStr.split(':');
      if (parts.length !== 3) return 0;

      const hours = parseInt(parts[0], 10) || 0;
      const minutes = parseInt(parts[1], 10) || 0;
      const seconds = parseFloat(parts[2]) || 0;

      return hours * 3600 + minutes * 60 + seconds;
    }

    default:
      return 0;
  }
}
