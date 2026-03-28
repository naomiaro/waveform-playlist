import { computeMusicalTicks } from '@waveform-playlist/core';
import type { MusicalTickParams, MusicalTickData } from '@waveform-playlist/core';

let cachedParams: MusicalTickParams | null = null;
let cachedResult: MusicalTickData | null = null;

function paramsMatch(a: MusicalTickParams, b: MusicalTickParams): boolean {
  return (
    a.ticksPerPixel === b.ticksPerPixel &&
    a.startPixel === b.startPixel &&
    a.endPixel === b.endPixel &&
    a.timeSignature[0] === b.timeSignature[0] &&
    a.timeSignature[1] === b.timeSignature[1] &&
    (a.ppqn ?? 960) === (b.ppqn ?? 960)
  );
}

export function getCachedMusicalTicks(params: MusicalTickParams): MusicalTickData {
  if (cachedParams && cachedResult && paramsMatch(cachedParams, params)) {
    return cachedResult;
  }
  cachedResult = computeMusicalTicks(params);
  cachedParams = { ...params, timeSignature: [...params.timeSignature] as [number, number] };
  return cachedResult;
}

export function clearMusicalTickCache(): void {
  cachedParams = null;
  cachedResult = null;
}
