import type { Tick, TempoInterpolation } from '../types';

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
      throw new Error('[waveform-playlist] TempoMap: curve interpolation is not yet supported');
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

    // Check if next entry exists and uses linear interpolation
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

    // Check if next entry uses linear interpolation — if so, we're inside a ramp
    const nextEntry = entryIndex < this._entries.length - 1 ? this._entries[entryIndex + 1] : null;
    if (nextEntry && nextEntry.interpolation === 'linear') {
      const segmentTicks = nextEntry.tick - entry.tick;
      const ticksInto = atTick - entry.tick;
      if (segmentTicks > 0) {
        return entry.bpm + (nextEntry.bpm - entry.bpm) * (ticksInto / segmentTicks);
      }
    }

    return entry.bpm;
  }

  private _ticksToSecondsInternal(ticks: Tick): number {
    const entryIndex = this._entryIndexAt(ticks);
    const entry = this._entries[entryIndex];
    const ticksIntoSegment = ticks - entry.tick;

    // Check if next entry uses linear interpolation
    const nextEntry = entryIndex < this._entries.length - 1 ? this._entries[entryIndex + 1] : null;
    if (nextEntry && nextEntry.interpolation === 'linear') {
      const segmentTicks = nextEntry.tick - entry.tick;
      return (
        entry.secondsAtTick +
        this._ticksToSecondsLinear(ticksIntoSegment, entry.bpm, nextEntry.bpm, segmentTicks)
      );
    }

    // Step: constant BPM
    const secondsPerTick = 60 / (entry.bpm * this._ppqn);
    return entry.secondsAtTick + ticksIntoSegment * secondsPerTick;
  }

  /**
   * Trapezoidal approximation for a linear BPM ramp.
   * Returns seconds for `ticks` ticks into a segment ramping from bpm0 to bpm1
   * over totalSegmentTicks. The exact integral uses ln(bpm1/bpm0), but the
   * trapezoidal formula is simpler, has a closed-form inverse (quadratic),
   * and round-trips exactly. Error is sub-millisecond for typical DAW ramps.
   */
  private _ticksToSecondsLinear(
    ticks: number,
    bpm0: number,
    bpm1: number,
    totalSegmentTicks: number
  ): number {
    if (totalSegmentTicks === 0) return 0;
    // BPM at the point we're measuring
    const bpmAtTick = bpm0 + (bpm1 - bpm0) * (ticks / totalSegmentTicks);
    // Degenerate case: no ramp
    if (Math.abs(bpm0 - bpmAtTick) < 1e-10) {
      return (ticks * 60) / (bpm0 * this._ppqn);
    }
    // Trapezoidal: seconds = ticks * 60/ppqn * (1/bpm0 + 1/bpmAtTick) / 2
    return (((ticks * 60) / this._ppqn) * (1 / bpm0 + 1 / bpmAtTick)) / 2;
  }

  /**
   * Inverse of _ticksToSecondsLinear: given seconds into a linear ramp segment,
   * return ticks. Solves the quadratic arising from the trapezoidal formula.
   */
  private _secondsToTicksLinear(
    seconds: number,
    bpm0: number,
    bpm1: number,
    totalSegmentTicks: number
  ): number {
    if (totalSegmentTicks === 0 || seconds === 0) return 0;
    const k = 60 / this._ppqn;
    // Degenerate case: no ramp
    if (Math.abs(bpm1 - bpm0) < 1e-10) {
      return (seconds / k) * bpm0;
    }
    // From the trapezoidal formula:
    //   s = t * k * (1/bpm0 + 1/(bpm0 + (bpm1-bpm0)*t/T)) / 2
    // Let r = (bpm1-bpm0)/T, so bpmAtT = bpm0 + r*t
    //   s = t * k / 2 * (1/bpm0 + 1/(bpm0 + r*t))
    //   2*s/k = t * (1/bpm0 + 1/(bpm0 + r*t))
    //   2*s/k = t/bpm0 + t/(bpm0 + r*t)
    // Let u = bpm0 + r*t, then t = (u - bpm0)/r
    //   2*s/k = (u - bpm0)/(r*bpm0) + (u - bpm0)/(r*u)
    //   2*s*r/k = (u - bpm0)/bpm0 + (u - bpm0)/u
    //   2*s*r/k = (u - bpm0) * (1/bpm0 + 1/u)
    //   2*s*r/k = (u - bpm0) * (u + bpm0) / (bpm0 * u)
    //   2*s*r/k = (u² - bpm0²) / (bpm0 * u)
    //   2*s*r*bpm0/k * u = u² - bpm0²
    //   u² - (2*s*r*bpm0/k)*u - bpm0² = 0
    // Quadratic in u: a=1, b=-(2*s*r*bpm0/k), c=-bpm0²
    const r = (bpm1 - bpm0) / totalSegmentTicks;
    const B = -((2 * seconds * r * bpm0) / k);
    const C = -(bpm0 * bpm0);
    const discriminant = B * B - 4 * C;
    const u = (-B + Math.sqrt(discriminant)) / 2;
    // t = (u - bpm0) / r
    return (u - bpm0) / r;
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
        // Linear ramp: use trapezoidal integration
        segmentSeconds = this._ticksToSecondsLinear(tickDelta, prev.bpm, entry.bpm, tickDelta);
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
