import { getColorMap } from '../computation';
import type { ColorMapValue } from '@waveform-playlist/core';

/**
 * Cache of color LUTs (Uint8Array of length 768 = 256 RGB).
 *
 * `getColorMap` already returns shared module-level constants for the named
 * maps, but rebuilds an interpolated LUT every call for custom
 * `ColorMapEntry[]` stops. This cache memoizes by stringified key so the
 * orchestrator does not re-interpolate per render.
 *
 * Worst case ~8 entries × 768B = ~6KB total — no eviction needed.
 */
export class ColorLUTCache {
  private cache = new Map<string, Uint8Array>();

  get(colorMap: ColorMapValue): Uint8Array {
    const key = cacheKey(colorMap);
    let lut = this.cache.get(key);
    if (!lut) {
      // Copy so clear() yields a fresh reference even for named maps backed
      // by module-level constants in getColorMap.
      lut = new Uint8Array(getColorMap(colorMap));
      this.cache.set(key, lut);
    }
    return lut;
  }

  clear(): void {
    this.cache.clear();
  }
}

function cacheKey(colorMap: ColorMapValue): string {
  return typeof colorMap === 'string' ? colorMap : JSON.stringify(colorMap);
}
