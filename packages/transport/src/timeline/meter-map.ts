// packages/transport/src/timeline/meter-map.ts
import type { Tick, MeterEntry, MeterSignature } from '../types';

interface MutableMeterEntry {
  tick: Tick;
  numerator: number;
  denominator: number;
  barAtTick: number;
}

function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

export class MeterMap {
  private _ppqn: number;
  private _entries: MutableMeterEntry[];

  constructor(ppqn: number, numerator: number = 4, denominator: number = 4) {
    this._ppqn = ppqn;
    this._entries = [{ tick: 0 as Tick, numerator, denominator, barAtTick: 0 }];
  }

  get ppqn(): number {
    return this._ppqn;
  }

  getMeter(atTick: Tick = 0 as Tick): MeterSignature {
    const entry = this._entryAt(atTick);
    return { numerator: entry.numerator, denominator: entry.denominator };
  }

  setMeter(numerator: number, denominator: number, atTick: Tick = 0 as Tick): void {
    this._validateMeter(numerator, denominator);

    if (atTick < 0) {
      throw new Error('[waveform-playlist] MeterMap: atTick must be non-negative, got ' + atTick);
    }

    if (atTick === 0) {
      this._entries[0] = { ...this._entries[0], numerator, denominator };
      // Re-snap downstream entries to bar boundaries of the new meter
      this._resnapDownstreamEntries(0);
      this._recomputeCache(0);
      return;
    }

    // Snap to bar boundary of preceding meter
    const snapped = this._snapToBarBoundary(atTick);
    if (snapped !== atTick) {
      console.warn(
        '[waveform-playlist] MeterMap.setMeter: tick ' +
          atTick +
          ' is not on a bar boundary, snapped to ' +
          snapped
      );
    }

    let i = this._entries.length - 1;
    while (i > 0 && this._entries[i].tick > snapped) i--;

    if (this._entries[i].tick === snapped) {
      this._entries[i] = { ...this._entries[i], numerator, denominator };
    } else {
      const barAtTick = this._computeBarAtTick(snapped);
      this._entries.splice(i + 1, 0, { tick: snapped as Tick, numerator, denominator, barAtTick });
      i = i + 1;
    }
    this._resnapDownstreamEntries(i);
    this._recomputeCache(i);
  }

  removeMeter(atTick: Tick): void {
    if (atTick === 0) {
      throw new Error('[waveform-playlist] MeterMap: cannot remove meter at tick 0');
    }
    const idx = this._entries.findIndex((e) => e.tick === atTick);
    if (idx > 0) {
      this._entries.splice(idx, 1);
      this._recomputeCache(idx);
    } else if (idx === -1) {
      console.warn('[waveform-playlist] MeterMap.removeMeter: no entry at tick ' + atTick);
    }
  }

  clearMeters(): void {
    const first = this._entries[0];
    this._entries = [{ ...first, barAtTick: 0 }];
  }

  ticksPerBeat(atTick: Tick = 0 as Tick): number {
    const entry = this._entryAt(atTick);
    return this._ppqn * (4 / entry.denominator);
  }

  ticksPerBar(atTick: Tick = 0 as Tick): number {
    const entry = this._entryAt(atTick);
    return entry.numerator * this._ppqn * (4 / entry.denominator);
  }

  barToTick(bar: number): Tick {
    if (bar < 1) {
      throw new Error('[waveform-playlist] MeterMap: bar must be >= 1, got ' + bar);
    }
    const targetBar = bar - 1; // 0-indexed
    for (let i = 0; i < this._entries.length; i++) {
      const nextBar = i < this._entries.length - 1 ? this._entries[i + 1].barAtTick : Infinity;
      if (targetBar < nextBar) {
        const barsInto = targetBar - this._entries[i].barAtTick;
        const tpb = this._ticksPerBarForEntry(this._entries[i]);
        return (this._entries[i].tick + barsInto * tpb) as Tick;
      }
    }
    return 0 as Tick; // unreachable — last iteration always matches (nextBar = Infinity)
  }

  tickToBar(tick: Tick): number {
    const entry = this._entryAt(tick);
    const ticksInto = tick - entry.tick;
    const tpb = this._ticksPerBarForEntry(entry);
    return entry.barAtTick + Math.floor(ticksInto / tpb) + 1; // 1-indexed
  }

  isBarBoundary(tick: Tick): boolean {
    const entry = this._entryAt(tick);
    const ticksInto = tick - entry.tick;
    const tpb = this._ticksPerBarForEntry(entry);
    return ticksInto % tpb === 0;
  }

  /** Internal: get the full entry at a tick (for MetronomePlayer beat grid anchoring) */
  getEntryAt(tick: Tick): MeterEntry {
    return this._entryAt(tick);
  }

  private _entryAt(tick: Tick): MutableMeterEntry {
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
    return this._entries[lo];
  }

  private _ticksPerBarForEntry(entry: MutableMeterEntry): number {
    return entry.numerator * this._ppqn * (4 / entry.denominator);
  }

  private _snapToBarBoundary(atTick: Tick): Tick {
    const entry = this._entryAt(atTick);
    const tpb = this._ticksPerBarForEntry(entry);
    const ticksInto = atTick - entry.tick;
    if (ticksInto % tpb === 0) return atTick;
    // Snap forward to next bar boundary
    return (entry.tick + Math.ceil(ticksInto / tpb) * tpb) as Tick;
  }

  private _computeBarAtTick(tick: Tick): number {
    const entry = this._entryAt(tick);
    const ticksInto = tick - entry.tick;
    const tpb = this._ticksPerBarForEntry(entry);
    return entry.barAtTick + ticksInto / tpb;
  }

  private _recomputeCache(fromIndex: number): void {
    for (let i = Math.max(1, fromIndex); i < this._entries.length; i++) {
      const prev = this._entries[i - 1];
      const tickDelta = this._entries[i].tick - prev.tick;
      const tpb = this._ticksPerBarForEntry(prev);
      this._entries[i] = {
        ...this._entries[i],
        barAtTick: prev.barAtTick + tickDelta / tpb,
      };
    }
  }

  /**
   * After changing a meter entry, re-snap downstream entries to bar boundaries
   * of their preceding meter so barAtTick stays integer.
   */
  private _resnapDownstreamEntries(fromIndex: number): void {
    for (let i = Math.max(1, fromIndex + 1); i < this._entries.length; i++) {
      const prev = this._entries[i - 1];
      const tpb = this._ticksPerBarForEntry(prev);
      const tick = this._entries[i].tick;
      const ticksIntoPrev = tick - prev.tick;
      if (ticksIntoPrev % tpb !== 0) {
        const snapped = prev.tick + Math.ceil(ticksIntoPrev / tpb) * tpb;
        console.warn(
          '[waveform-playlist] MeterMap: meter change moved entry from tick ' +
            tick +
            ' to ' +
            snapped +
            ' (bar boundary alignment)'
        );
        this._entries[i] = { ...this._entries[i], tick: snapped as Tick };
      }
    }
  }

  private _validateMeter(numerator: number, denominator: number): void {
    if (!Number.isInteger(numerator) || numerator < 1 || numerator > 32) {
      throw new Error(
        '[waveform-playlist] MeterMap: numerator must be an integer 1-32, got ' + numerator
      );
    }
    if (!isPowerOf2(denominator) || denominator > 32) {
      throw new Error(
        '[waveform-playlist] MeterMap: denominator must be a power of 2 (1-32), got ' + denominator
      );
    }
  }
}
