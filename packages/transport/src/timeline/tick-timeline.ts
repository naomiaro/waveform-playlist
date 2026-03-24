import type { TransportPosition } from '../types';

export class TickTimeline {
  private _ppqn: number;

  constructor(ppqn: number = 960) {
    this._ppqn = ppqn;
  }

  get ppqn(): number {
    return this._ppqn;
  }

  ticksPerBeat(): number {
    return this._ppqn;
  }

  ticksPerBar(beatsPerBar: number): number {
    return this._ppqn * beatsPerBar;
  }

  toPosition(ticks: number, beatsPerBar: number): TransportPosition {
    const ticksPerBar = this.ticksPerBar(beatsPerBar);
    const bar = Math.floor(ticks / ticksPerBar) + 1;
    const remaining = ticks % ticksPerBar;
    const beat = Math.floor(remaining / this._ppqn) + 1;
    const tick = remaining % this._ppqn;
    return { bar, beat, tick };
  }

  fromPosition(bar: number, beat: number, tick: number, beatsPerBar: number): number {
    const ticksPerBar = this.ticksPerBar(beatsPerBar);
    return (bar - 1) * ticksPerBar + (beat - 1) * this._ppqn + tick;
  }
}
