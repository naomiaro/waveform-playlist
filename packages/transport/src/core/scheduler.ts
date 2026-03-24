import type { SchedulerEvent, SchedulerListener } from '../types';

export interface SchedulerOptions {
  lookahead?: number;
}

export class Scheduler<T extends SchedulerEvent> {
  private _lookahead: number;
  private _rightEdge = 0;
  private _listeners: Set<SchedulerListener<T>> = new Set();
  private _loopEnabled = false;
  private _loopStart = 0;
  private _loopEnd = 0;

  constructor(options: SchedulerOptions = {}) {
    this._lookahead = options.lookahead ?? 0.2;
  }

  addListener(listener: SchedulerListener<T>): void {
    this._listeners.add(listener);
  }

  removeListener(listener: SchedulerListener<T>): void {
    this._listeners.delete(listener);
  }

  setLoop(enabled: boolean, start: number, end: number): void {
    this._loopEnabled = enabled;
    this._loopStart = start;
    this._loopEnd = end;
  }

  reset(time: number): void {
    this._rightEdge = time;
  }

  advance(currentTime: number): void {
    const targetEdge = currentTime + this._lookahead;

    if (this._loopEnabled && this._loopEnd > this._loopStart) {
      // Check if window crosses loop boundary
      if (this._rightEdge < this._loopEnd && targetEdge >= this._loopEnd) {
        // Generate up to loopEnd
        this._generateAndConsume(this._rightEdge, this._loopEnd);
        // Notify listeners of position jump
        for (const listener of this._listeners) {
          listener.onPositionJump(this._loopStart);
        }
        // Continue from loopStart
        const remaining = targetEdge - this._loopEnd;
        this._generateAndConsume(this._loopStart, this._loopStart + remaining);
        this._rightEdge = this._loopStart + remaining;
        return;
      }
    }

    if (targetEdge > this._rightEdge) {
      this._generateAndConsume(this._rightEdge, targetEdge);
      this._rightEdge = targetEdge;
    }
  }

  private _generateAndConsume(from: number, to: number): void {
    for (const listener of this._listeners) {
      const events = listener.generate(from, to);
      for (const event of events) {
        listener.consume(event);
      }
    }
  }
}
