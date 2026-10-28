import type { Tick } from '../types';
import type { MeterMap } from './meter-map';

/** Grid step for quantizeTick: a tick count (positive integer), or the bar or
 *  beat length of the meter in force at the tick's bar. */
export type GridSubdivision = number | 'bar' | 'beat';

/** 'nearest' (exact ties go up), 'next' (ceil), 'previous' (floor). A tick
 *  already on a grid line stays put in every mode. */
export type QuantizeMode = 'nearest' | 'next' | 'previous';

export interface QuantizeOptions {
  /** Default 'nearest'. */
  mode?: QuantizeMode;
  /** 0–1, default 1: how far to move toward the chosen line (1 = onto it). */
  strength?: number;
}

const MODES: readonly QuantizeMode[] = ['nearest', 'next', 'previous'];

/**
 * Snap a tick to a meter-aware grid. Pure: reads the MeterMap, mutates nothing.
 *
 * Grid lines restart at each bar line (the metronome re-anchors the same way
 * at each meter entry), so odd meters stay aligned: in 7/8 a quarter-note grid
 * is 0, 960, 1920, 2880 and then the next bar line at 3360 — never 3840. A
 * subdivision longer than the bar leaves only the bar lines.
 *
 * `tick` may be fractional (e.g. `Transport.timeToTickExact()` of a recorded
 * note); the result is always an integer Tick.
 */
export function quantizeTick(
  meterMap: MeterMap,
  tick: number,
  subdivision: GridSubdivision,
  options: QuantizeOptions = {}
): Tick {
  const mode = options.mode ?? 'nearest';
  const strength = options.strength ?? 1;
  validateQuantizeInput(tick, subdivision, mode, strength);

  const bar = meterMap.tickToBar(tick as Tick);
  const barStart = meterMap.barToTick(bar);
  const nextBarStart = meterMap.barToTick(bar + 1);
  const step = resolveStep(meterMap, subdivision, barStart);

  const previous = barStart + Math.floor((tick - barStart) / step) * step;
  const next = previous === tick ? tick : Math.min(previous + step, nextBarStart);
  const target = pickLine(mode, tick, previous, next);
  return Math.round(tick + (target - tick) * strength) as Tick;
}

function resolveStep(meterMap: MeterMap, subdivision: GridSubdivision, barStart: Tick): number {
  if (subdivision === 'bar') return meterMap.ticksPerBar(barStart);
  if (subdivision === 'beat') return meterMap.ticksPerBeat(barStart);
  return subdivision;
}

function pickLine(mode: QuantizeMode, tick: number, previous: number, next: number): number {
  if (mode === 'previous') return previous;
  if (mode === 'next') return next;
  return tick - previous < next - tick ? previous : next;
}

function validateQuantizeInput(
  tick: number,
  subdivision: GridSubdivision,
  mode: QuantizeMode,
  strength: number
): void {
  if (!Number.isFinite(tick) || tick < 0) {
    throw new Error(
      '[waveform-playlist] quantizeTick: tick must be a finite number >= 0, got ' + tick
    );
  }
  if (typeof subdivision === 'number' && (!Number.isInteger(subdivision) || subdivision <= 0)) {
    throw new Error(
      '[waveform-playlist] quantizeTick: subdivision must be a positive integer tick count, ' +
        "'bar' or 'beat', got " +
        subdivision
    );
  }
  if (!MODES.includes(mode)) {
    throw new Error(
      "[waveform-playlist] quantizeTick: mode must be 'nearest', 'next' or 'previous', got " +
        String(mode)
    );
  }
  if (!Number.isFinite(strength) || strength < 0 || strength > 1) {
    throw new Error(
      '[waveform-playlist] quantizeTick: strength must be between 0 and 1, got ' + strength
    );
  }
}
