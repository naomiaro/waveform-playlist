import { computeMusicalTicks } from '@waveform-playlist/core';
import type { MusicalTickParams, MusicalTickData, MeterEntry } from '@waveform-playlist/core';

let cachedParams: MusicalTickParams | null = null;
let cachedResult: MusicalTickData | null = null;

function meterEntriesMatch(
  a: { tick: number; numerator: number; denominator: number }[],
  b: { tick: number; numerator: number; denominator: number }[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].tick !== b[i].tick ||
      a[i].numerator !== b[i].numerator ||
      a[i].denominator !== b[i].denominator
    )
      return false;
  }
  return true;
}

function paramsMatch(a: MusicalTickParams, b: MusicalTickParams): boolean {
  return (
    a.ticksPerPixel === b.ticksPerPixel &&
    a.startPixel === b.startPixel &&
    a.endPixel === b.endPixel &&
    meterEntriesMatch(a.meterEntries, b.meterEntries) &&
    (a.ppqn ?? 960) === (b.ppqn ?? 960)
  );
}

export function getCachedMusicalTicks(params: MusicalTickParams): MusicalTickData {
  if (cachedParams && cachedResult && paramsMatch(cachedParams, params)) {
    return cachedResult;
  }
  cachedResult = computeMusicalTicks(params);
  cachedParams = {
    ...params,
    meterEntries: params.meterEntries.map((e: MeterEntry) => ({ ...e })),
  };
  return cachedResult;
}

export function clearMusicalTickCache(): void {
  cachedParams = null;
  cachedResult = null;
}
