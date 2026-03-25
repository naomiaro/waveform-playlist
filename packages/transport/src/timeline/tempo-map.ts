import type { Tick, TempoInterpolation } from '../types';

const CURVE_EPSILON = 1e-15;
/** Number of subdivisions for trapezoidal integration over curved segments */
const CURVE_SUBDIVISIONS = 64;

/**
 * Möbius-Ease curve: maps x in [0,1] to [0,1] with shape controlled by slope.
 * slope = 0.5 → linear. slope < 0.5 → concave. slope > 0.5 → convex.
 * Reference: http://werner.yellowcouch.org/Papers/fastenv12/index.html
 */
function curveNormalizedAt(x: number, slope: number): number {
  if (slope > 0.499999 && slope < 0.500001) return x;
  const p = Math.max(CURVE_EPSILON, Math.min(1 - CURVE_EPSILON, slope));
  return ((p * p) / (1 - p * 2)) * (Math.pow((1 - p) / p, 2 * x) - 1);
}

/** Mutable internal version of TempoEntry (exported interface has readonly fields) */
interface MutableTempoEntry {
  tick: Tick;
  bpm: number;
  interpolation: TempoInterpolation;
  secondsAtTick: number;
}

export interface SetTempoOptions {
  interpolation?: TempoInterpolation;
}

export class TempoMap {
  private _ppqn: number;
  private _entries: MutableTempoEntry[];

  constructor(ppqn: number = 960, initialBpm: number = 120) {
    this._ppqn = ppqn;
    this._entries = [{ tick: 0 as Tick, bpm: initialBpm, interpolation: 'step', secondsAtTick: 0 }];
  }

  getTempo(atTick: Tick = 0 as Tick): number {
    return this._getTempoAt(atTick);
  }

  setTempo(bpm: number, atTick: Tick = 0 as Tick, options?: SetTempoOptions): void {
    const interpolation = options?.interpolation ?? 'step';

    if (typeof interpolation === 'object' && interpolation.type === 'curve') {
      const s = interpolation.slope;
      if (!Number.isFinite(s) || s <= 0 || s >= 1) {
        throw new Error(
          '[waveform-playlist] TempoMap: curve slope must be between 0 and 1 (exclusive), got ' + s
        );
      }
    }

    if (atTick === 0) {
      // First entry is always 'step' — there's no previous entry to ramp from
      this._entries[0] = { ...this._entries[0], bpm, interpolation: 'step' };
      this._recomputeCache(0);
      return;
    }
    // Find insertion point
    let i = this._entries.length - 1;
    while (i > 0 && this._entries[i].tick > atTick) i--;

    if (this._entries[i].tick === atTick) {
      this._entries[i] = { ...this._entries[i], bpm, interpolation };
    } else {
      const secondsAtTick = this._ticksToSecondsInternal(atTick);
      this._entries.splice(i + 1, 0, { tick: atTick, bpm, interpolation, secondsAtTick });
      i = i + 1;
    }
    this._recomputeCache(i);
  }

  ticksToSeconds(ticks: Tick): number {
    return this._ticksToSecondsInternal(ticks);
  }

  secondsToTicks(seconds: number): Tick {
    let lo = 0;
    let hi = this._entries.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this._entries[mid].secondsAtTick <= seconds) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    const entry = this._entries[lo];
    const secondsIntoSegment = seconds - entry.secondsAtTick;

    const nextEntry = lo < this._entries.length - 1 ? this._entries[lo + 1] : null;
    if (nextEntry && nextEntry.interpolation === 'linear') {
      return Math.round(
        entry.tick +
          this._secondsToTicksLinear(
            secondsIntoSegment,
            entry.bpm,
            nextEntry.bpm,
            nextEntry.tick - entry.tick
          )
      ) as Tick;
    }

    if (nextEntry && typeof nextEntry.interpolation === 'object') {
      return Math.round(
        entry.tick +
          this._secondsToTicksCurve(
            secondsIntoSegment,
            entry.bpm,
            nextEntry.bpm,
            nextEntry.tick - entry.tick,
            nextEntry.interpolation.slope
          )
      ) as Tick;
    }

    // Step: constant BPM
    const ticksPerSecond = (entry.bpm / 60) * this._ppqn;
    return Math.round(entry.tick + secondsIntoSegment * ticksPerSecond) as Tick;
  }

  beatsToSeconds(beats: number): number {
    return this.ticksToSeconds((beats * this._ppqn) as Tick);
  }

  secondsToBeats(seconds: number): number {
    return this.secondsToTicks(seconds) / this._ppqn;
  }

  clearTempos(): void {
    const first = this._entries[0];
    this._entries = [{ tick: 0 as Tick, bpm: first.bpm, interpolation: 'step', secondsAtTick: 0 }];
  }

  /** Get the interpolated BPM at a tick position */
  private _getTempoAt(atTick: Tick): number {
    const entryIndex = this._entryIndexAt(atTick);
    const entry = this._entries[entryIndex];
    const nextEntry = entryIndex < this._entries.length - 1 ? this._entries[entryIndex + 1] : null;

    if (nextEntry && nextEntry.interpolation !== 'step') {
      const segmentTicks = nextEntry.tick - entry.tick;
      const ticksInto = atTick - entry.tick;
      if (segmentTicks > 0) {
        const progress = ticksInto / segmentTicks;
        if (nextEntry.interpolation === 'linear') {
          return entry.bpm + (nextEntry.bpm - entry.bpm) * progress;
        }
        // Curve (Möbius-Ease)
        const t = curveNormalizedAt(progress, nextEntry.interpolation.slope);
        return entry.bpm + (nextEntry.bpm - entry.bpm) * t;
      }
    }

    return entry.bpm;
  }

  private _ticksToSecondsInternal(ticks: Tick): number {
    const entryIndex = this._entryIndexAt(ticks);
    const entry = this._entries[entryIndex];
    const ticksIntoSegment = ticks - entry.tick;
    const nextEntry = entryIndex < this._entries.length - 1 ? this._entries[entryIndex + 1] : null;

    if (nextEntry && nextEntry.interpolation === 'linear') {
      const segmentTicks = nextEntry.tick - entry.tick;
      return (
        entry.secondsAtTick +
        this._ticksToSecondsLinear(ticksIntoSegment, entry.bpm, nextEntry.bpm, segmentTicks)
      );
    }

    if (nextEntry && typeof nextEntry.interpolation === 'object') {
      const segmentTicks = nextEntry.tick - entry.tick;
      return (
        entry.secondsAtTick +
        this._ticksToSecondsCurve(
          ticksIntoSegment,
          entry.bpm,
          nextEntry.bpm,
          segmentTicks,
          nextEntry.interpolation.slope
        )
      );
    }

    // Step: constant BPM
    const secondsPerTick = 60 / (entry.bpm * this._ppqn);
    return entry.secondsAtTick + ticksIntoSegment * secondsPerTick;
  }

  /**
   * Exact integration for a linear BPM ramp using the logarithmic formula.
   * For bpm(t) = bpm0 + r*t where r = (bpm1-bpm0)/T:
   *   seconds = (T * 60) / (ppqn * (bpm1-bpm0)) * ln(bpmAtTick / bpm0)
   */
  private _ticksToSecondsLinear(
    ticks: number,
    bpm0: number,
    bpm1: number,
    totalSegmentTicks: number
  ): number {
    if (totalSegmentTicks === 0) return 0;
    const bpmAtTick = bpm0 + (bpm1 - bpm0) * (ticks / totalSegmentTicks);
    // Degenerate case: no ramp (avoids ln(1)/0 = 0/0)
    if (Math.abs(bpm1 - bpm0) < 1e-10) {
      return (ticks * 60) / (bpm0 * this._ppqn);
    }
    // Exact: ∫₀ᵗ 60/(ppqn * bpm(u)) du = (T * 60 / (ppqn * deltaBpm)) * ln(bpmAtTick/bpm0)
    const deltaBpm = bpm1 - bpm0;
    return ((totalSegmentTicks * 60) / (this._ppqn * deltaBpm)) * Math.log(bpmAtTick / bpm0);
  }

  /**
   * Inverse of _ticksToSecondsLinear: given seconds, return ticks.
   * Closed-form via exponential: bpmAtTick = bpm0 * exp(seconds * deltaBpm * ppqn / (60 * T))
   * then ticks = (bpmAtTick - bpm0) * T / deltaBpm
   *
   * Note: exp(log(x)) has ~1 ULP floating-point error, so round-trips depend on
   * Math.round() in the caller (secondsToTicks). This is sufficient for all tested
   * BPM ranges (10–300 BPM) but is not algebraically exact like the previous
   * trapezoidal/quadratic approach was.
   */
  private _secondsToTicksLinear(
    seconds: number,
    bpm0: number,
    bpm1: number,
    totalSegmentTicks: number
  ): number {
    if (totalSegmentTicks === 0 || seconds === 0) return 0;
    // Degenerate case: no ramp
    if (Math.abs(bpm1 - bpm0) < 1e-10) {
      return (seconds * bpm0 * this._ppqn) / 60;
    }
    const deltaBpm = bpm1 - bpm0;
    const bpmAtTick = bpm0 * Math.exp((seconds * deltaBpm * this._ppqn) / (60 * totalSegmentTicks));
    return ((bpmAtTick - bpm0) / deltaBpm) * totalSegmentTicks;
  }

  /**
   * Subdivided trapezoidal integration for a Möbius-Ease tempo curve.
   * The BPM at progress p is: bpm0 + curveNormalizedAt(p, slope) * (bpm1 - bpm0).
   * We subdivide into CURVE_SUBDIVISIONS intervals and apply trapezoidal rule.
   */
  private _ticksToSecondsCurve(
    ticks: number,
    bpm0: number,
    bpm1: number,
    totalSegmentTicks: number,
    slope: number
  ): number {
    if (totalSegmentTicks === 0 || ticks === 0) return 0;
    const n = CURVE_SUBDIVISIONS;
    const dt = ticks / n;
    let seconds = 0;
    let prevBpm = bpm0;
    for (let i = 1; i <= n; i++) {
      const progress = (dt * i) / totalSegmentTicks;
      const curBpm = bpm0 + curveNormalizedAt(progress, slope) * (bpm1 - bpm0);
      // Trapezoidal rule for this subdivision
      seconds += (((dt * 60) / this._ppqn) * (1 / prevBpm + 1 / curBpm)) / 2;
      prevBpm = curBpm;
    }
    return seconds;
  }

  /**
   * Inverse of _ticksToSecondsCurve: given seconds into a curved segment,
   * return ticks. Uses binary search since there's no closed-form inverse.
   */
  private _secondsToTicksCurve(
    seconds: number,
    bpm0: number,
    bpm1: number,
    totalSegmentTicks: number,
    slope: number
  ): number {
    if (totalSegmentTicks === 0 || seconds === 0) return 0;
    // Binary search: find ticks such that _ticksToSecondsCurve(ticks) ≈ seconds.
    // Need totalSegmentTicks / 2^N < 0.5 for Math.round() to land on the right
    // tick. Iterations = ceil(log2(2 * totalSegmentTicks)), clamped to [1, 40].
    const iterations = Math.min(40, Math.max(1, Math.ceil(Math.log2(2 * totalSegmentTicks))));
    let lo = 0;
    let hi = totalSegmentTicks;
    for (let i = 0; i < iterations; i++) {
      const mid = (lo + hi) / 2;
      const midSeconds = this._ticksToSecondsCurve(mid, bpm0, bpm1, totalSegmentTicks, slope);
      if (midSeconds < seconds) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return (lo + hi) / 2;
  }

  private _entryIndexAt(tick: Tick): number {
    let lo = 0;
    let hi = this._entries.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this._entries[mid].tick <= tick) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return lo;
  }

  private _recomputeCache(fromIndex: number): void {
    for (let i = Math.max(1, fromIndex); i < this._entries.length; i++) {
      const prev = this._entries[i - 1];
      const tickDelta = this._entries[i].tick - prev.tick;
      const entry = this._entries[i];

      let segmentSeconds: number;
      if (entry.interpolation === 'linear') {
        segmentSeconds = this._ticksToSecondsLinear(tickDelta, prev.bpm, entry.bpm, tickDelta);
      } else if (typeof entry.interpolation === 'object') {
        segmentSeconds = this._ticksToSecondsCurve(
          tickDelta,
          prev.bpm,
          entry.bpm,
          tickDelta,
          entry.interpolation.slope
        );
      } else {
        // Step: constant BPM from previous entry
        const secondsPerTick = 60 / (prev.bpm * this._ppqn);
        segmentSeconds = tickDelta * secondsPerTick;
      }

      this._entries[i] = {
        ...entry,
        secondsAtTick: prev.secondsAtTick + segmentSeconds,
      };
    }
  }
}
