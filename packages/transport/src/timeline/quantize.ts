import type { Tick } from '../types';
import type { MeterMap } from './meter-map';

/** Grid step for quantizeTick.
 *  - `{ ticks }`: an explicit tick count (positive integer) — a duration, not
 *    a position, hence the object form rather than a bare number.
 *  - `{ note, dotted?, triplet? }`: a note value by denominator (4 = quarter,
 *    8 = eighth, 16 = sixteenth …), resolved against the MeterMap's PPQN;
 *    dotted ×3/2, triplet ×2/3.
 *  - `'bar'` / `'beat'`: the bar or beat length of the meter in force at the
 *    tick's bar. */
export type GridSubdivision =
  | { readonly ticks: number }
  | { readonly note: number; readonly dotted?: boolean; readonly triplet?: boolean }
  | 'bar'
  | 'beat';

/** 'nearest' (exact ties go up), 'next' (ceiling), 'previous' (floor). All
 *  three are idempotent: a tick already on a grid line stays put. This differs
 *  from Tone's `nextSubdivision`, which is strictly after the current time —
 *  for "the line after this one" pass `tick + 1` with 'next'. */
export type QuantizeMode = 'nearest' | 'next' | 'previous';

export interface QuantizeOptions {
  /** Default 'nearest'. */
  mode?: QuantizeMode;
  /** 0–1, default 1: how far to move toward the chosen line (1 = onto it). */
  strength?: number;
}

const MODES: readonly QuantizeMode[] = ['nearest', 'next', 'previous'];

/** A fractional tick this close to a grid line is treated as on it. Exact
 *  positions from timeToTickExact() carry ~1e-13 of float noise (e.g.
 *  1920.0000000000002 for a note on the beat); without this, 'previous' and
 *  'next' would jump a whole step away from a line the tick is already on. */
const ON_LINE_EPSILON = 1e-6;

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

  // MeterMap keeps every entry on a bar boundary of the preceding meter, so
  // the bar containing `tick` is plain arithmetic from the entry in force —
  // one lookup, no bar-number round trip.
  const entry = meterMap.getEntryAt(tick as Tick);
  const ticksPerBar = meterMap.ticksPerBar(entry.tick);
  const barStart = entry.tick + Math.floor((tick - entry.tick) / ticksPerBar) * ticksPerBar;
  const nextBarStart = barStart + ticksPerBar;
  const step = resolveStep(meterMap, subdivision, ticksPerBar, meterMap.ticksPerBeat(entry.tick));

  const previous = barStart + Math.floor((tick - barStart) / step) * step;
  const candidateNext = Math.min(previous + step, nextBarStart);
  const onLine =
    Math.abs(tick - previous) < ON_LINE_EPSILON || Math.abs(tick - candidateNext) < ON_LINE_EPSILON;
  if (onLine) {
    const line = Math.abs(tick - previous) < ON_LINE_EPSILON ? previous : candidateNext;
    return Math.round(tick + (line - tick) * strength) as Tick;
  }
  const target = pickLine(mode, tick, previous, candidateNext);
  return Math.round(tick + (target - tick) * strength) as Tick;
}

function resolveStep(
  meterMap: MeterMap,
  subdivision: GridSubdivision,
  ticksPerBar: number,
  ticksPerBeat: number
): number {
  if (subdivision === 'bar') return ticksPerBar;
  if (subdivision === 'beat') return ticksPerBeat;
  if ('ticks' in subdivision) return subdivision.ticks;
  let step = (meterMap.ppqn * 4) / subdivision.note;
  if (subdivision.dotted) step = (step * 3) / 2;
  if (subdivision.triplet) step = (step * 2) / 3;
  return step;
}

const NOTE_VALUES = [1, 2, 4, 8, 16, 32, 64];

function isValidSubdivision(subdivision: GridSubdivision): boolean {
  if (subdivision === 'bar' || subdivision === 'beat') return true;
  if (typeof subdivision !== 'object' || subdivision === null) return false;
  if ('ticks' in subdivision) {
    return Number.isInteger(subdivision.ticks) && subdivision.ticks > 0;
  }
  return 'note' in subdivision && NOTE_VALUES.includes(subdivision.note);
}

function describeSubdivision(subdivision: unknown): string {
  if (typeof subdivision === 'object' && subdivision !== null) {
    return JSON.stringify(subdivision);
  }
  return String(subdivision);
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
  if (!isValidSubdivision(subdivision)) {
    throw new Error(
      '[waveform-playlist] quantizeTick: subdivision must be { ticks: positive integer }, ' +
        "{ note: 1 | 2 | 4 | 8 | 16 | 32 | 64, dotted?, triplet? }, 'bar' or 'beat', got " +
        describeSubdivision(subdivision)
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
