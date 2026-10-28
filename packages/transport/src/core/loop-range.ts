/**
 * Loop-range validation shared by Scheduler and Transport.
 *
 * Invalid loop points are rejected with a thrown Error — the same policy
 * TempoMap uses for BPM — instead of a console.warn that leaves the previous
 * loop silently in force (#636). Validation only applies when `enabled` is
 * true: disabling a loop carries no range to validate.
 */
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
