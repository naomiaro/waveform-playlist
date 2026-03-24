import type { SchedulerEvent, SchedulerListener } from '../types';

export interface SchedulerOptions {
  lookahead?: number;
  /** Called when the scheduler wraps at loopEnd — Transport uses this to seek the clock */
  onLoop?: (loopStartTime: number) => void;
}

export class Scheduler<T extends SchedulerEvent> {
  private _lookahead: number;
  private _rightEdge = 0;
  private _listeners: Set<SchedulerListener<T>> = new Set();
  private _loopEnabled = false;
  private _loopStart = 0;
  private _loopEnd = 0;
  private _onLoop: ((loopStartTime: number) => void) | undefined;

  constructor(options: SchedulerOptions = {}) {
    this._lookahead = options.lookahead ?? 0.2;
    this._onLoop = options.onLoop;
  }

  addListener(listener: SchedulerListener<T>): void {
    this._listeners.add(listener);
  }

  removeListener(listener: SchedulerListener<T>): void {
    this._listeners.delete(listener);
  }

  setLoop(enabled: boolean, start: number, end: number): void {
    if (enabled && start >= end) {
      console.warn(
        '[waveform-playlist] Scheduler.setLoop: start (' +
          start +
          ') must be less than end (' +
          end +
          ')'
      );
      return;
    }
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
      const loopDuration = this._loopEnd - this._loopStart;
      let remaining = targetEdge - this._rightEdge;

      // Handle multiple loop wraps (loop region shorter than lookahead)
      while (remaining > 0) {
        const distToEnd = this._loopEnd - this._rightEdge;
        if (distToEnd <= 0 || distToEnd > remaining) {
          // No wrap needed — generate remaining window
          this._generateAndConsume(this._rightEdge, this._rightEdge + remaining);
          this._rightEdge += remaining;
          break;
        }
        // Generate up to loopEnd
        this._generateAndConsume(this._rightEdge, this._loopEnd);
        remaining -= distToEnd;
        // Notify listeners of position jump
        for (const listener of this._listeners) {
          listener.onPositionJump(this._loopStart);
        }
        // Seek clock back to loopStart
        this._onLoop?.(this._loopStart);
        this._rightEdge = this._loopStart;

        // Guard against infinite loop from zero-length loop regions
        if (loopDuration <= 0) break;
      }
      return;
    }

    if (targetEdge > this._rightEdge) {
      this._generateAndConsume(this._rightEdge, targetEdge);
      this._rightEdge = targetEdge;
    }
  }

  private _generateAndConsume(from: number, to: number): void {
    for (const listener of this._listeners) {
      try {
        const events = listener.generate(from, to);
        for (const event of events) {
          try {
            listener.consume(event);
          } catch (err) {
            console.warn('[waveform-playlist] Scheduler: error consuming event:', String(err));
          }
        }
      } catch (err) {
        console.warn('[waveform-playlist] Scheduler: error generating events:', String(err));
      }
    }
  }
}
