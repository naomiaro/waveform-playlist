import type { Tick, TempoEntry } from '../types';

/** Mutable internal version of TempoEntry (exported interface has readonly secondsAtTick) */
interface MutableTempoEntry {
  tick: Tick;
  bpm: number;
  secondsAtTick: number;
}

export class TempoMap {
  private _ppqn: number;
  private _entries: MutableTempoEntry[];

  constructor(ppqn: number = 960, initialBpm: number = 120) {
    this._ppqn = ppqn;
    this._entries = [{ tick: 0 as Tick, bpm: initialBpm, secondsAtTick: 0 }];
  }

  getTempo(atTick: Tick = 0 as Tick): number {
    const entry = this._entryAt(atTick);
    return entry.bpm;
  }

  setTempo(bpm: number, atTick: Tick = 0 as Tick): void {
    if (atTick === 0) {
      this._entries[0] = { ...this._entries[0], bpm };
      this._recomputeCache(0);
      return;
    }
    // Find insertion point
    let i = this._entries.length - 1;
    while (i > 0 && this._entries[i].tick > atTick) i--;

    if (this._entries[i].tick === atTick) {
      this._entries[i] = { ...this._entries[i], bpm };
    } else {
      const secondsAtTick = this._ticksToSecondsInternal(atTick);
      this._entries.splice(i + 1, 0, { tick: atTick, bpm, secondsAtTick });
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
    this._entries = [{ tick: 0 as Tick, bpm: first.bpm, secondsAtTick: 0 }];
  }

  private _ticksToSecondsInternal(ticks: Tick): number {
    const entry = this._entryAt(ticks);
    const ticksIntoSegment = ticks - entry.tick;
    const secondsPerTick = 60 / (entry.bpm * this._ppqn);
    return entry.secondsAtTick + ticksIntoSegment * secondsPerTick;
  }

  private _entryAt(tick: Tick): TempoEntry {
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

  private _recomputeCache(fromIndex: number): void {
    for (let i = Math.max(1, fromIndex); i < this._entries.length; i++) {
      const prev = this._entries[i - 1];
      const tickDelta = this._entries[i].tick - prev.tick;
      const secondsPerTick = 60 / (prev.bpm * this._ppqn);
      this._entries[i] = {
        ...this._entries[i],
        secondsAtTick: prev.secondsAtTick + tickDelta * secondsPerTick,
      };
    }
  }
}
