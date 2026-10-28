/**
 * Loop-range validation shared by Scheduler and Transport.
 *
 * Invalid loop points are rejected with a thrown Error — the same policy
 * TempoMap uses for BPM — instead of a console.warn that leaves the previous
 * loop silently in force (#636). Validation only applies when `enabled` is
 * true: disabling a loop carries no range to validate.
 */
import type { Tick } from '../types';

export type LoopRangeUnit = 'tick' | 'second' | 'sample';

export function assertValidLoopRange(
  source: string,
  enabled: boolean,
  start: number,
  end: number,
  unit: LoopRangeUnit
): void {
  if (!enabled) return;
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    throw new Error(
      '[waveform-playlist] ' +
        source +
        ': non-finite ' +
        unit +
        ' values (' +
        start +
        ', ' +
        end +
        ')'
    );
  }
  // Ticks are integers by contract; a fractional pair that straddles one
  // integer (960.6, 961.4) would otherwise pass here and round into an
  // empty loop one layer down.
  if (unit === 'tick' && (!Number.isInteger(start) || !Number.isInteger(end))) {
    throw new Error(
      '[waveform-playlist] ' + source + ': ticks must be integers, got (' + start + ', ' + end + ')'
    );
  }
  if (start >= end) {
    throw new Error(
      '[waveform-playlist] ' +
        source +
        ': start ' +
        unit +
        ' (' +
        start +
        ') must be less than end ' +
        unit +
        ' (' +
        end +
        ')'
    );
  }
}

/**
 * After converting a seconds/samples range to ticks: a range that is
 * non-empty in the caller's unit can still collapse to one tick. Throw in the
 * caller's unit before any state is touched — the tick-level assert in
 * setLoop would otherwise fire after the sample/seconds bookkeeping ran.
 */
export function assertLoopRangeSpansATick(
  source: string,
  enabled: boolean,
  start: number,
  end: number,
  unit: LoopRangeUnit,
  startTick: Tick,
  endTick: Tick
): void {
  if (!enabled || startTick < endTick) return;
  throw new Error(
    '[waveform-playlist] ' +
      source +
      ': range (' +
      start +
      ', ' +
      end +
      ' ' +
      unit +
      ') is shorter than one tick (both round to tick ' +
      startTick +
      ')'
  );
}
