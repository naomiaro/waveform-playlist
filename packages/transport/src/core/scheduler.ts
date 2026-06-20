import type { Tick, SchedulerEvent, SchedulerListener } from '../types';
import type { TempoMap } from '../timeline/tempo-map';

export interface SchedulerOptions {
  lookahead?: number;
  /** Called when the scheduler wraps at loopEnd.
   *  Receives loopStart, loopEnd, and the currentTimeSeconds snapshot from
   *  advance() so the Transport can compute the correct clock seek target
   *  without re-reading the live AudioContext.currentTime. */
  onLoop?: (loopStartSeconds: number, loopEndSeconds: number, currentTimeSeconds: number) => void;
}

export class Scheduler<T extends SchedulerEvent> {
  private _lookahead: number;
  private _rightEdge = 0; // integer ticks
  private _listeners: Set<SchedulerListener<T>> = new Set();
  private _loopEnabled = false;
  private _loopStart = 0; // integer ticks
  private _loopEnd = 0; // integer ticks
  private _playEnd: number | null = null; // integer ticks; hard end bound (non-loop)
  private _onLoop:
    | ((loopStartSeconds: number, loopEndSeconds: number, currentTimeSeconds: number) => void)
    | undefined;
  private _tempoMap: TempoMap;

  constructor(tempoMap: TempoMap, options: SchedulerOptions = {}) {
    this._tempoMap = tempoMap;
    this._lookahead = options.lookahead ?? 0.2;
    this._onLoop = options.onLoop;
  }

  addListener(listener: SchedulerListener<T>): void {
    this._listeners.add(listener);
  }

  removeListener(listener: SchedulerListener<T>): void {
    this._listeners.delete(listener);
  }

  /** Primary API — ticks as source of truth */
  setLoop(enabled: boolean, startTick: Tick, endTick: Tick): void {
    if (enabled && (!Number.isFinite(startTick) || !Number.isFinite(endTick))) {
      console.warn(
        '[waveform-playlist] Scheduler.setLoop: non-finite tick values (' +
          startTick +
          ', ' +
          endTick +
          ')'
      );
      return;
    }
    if (enabled && startTick >= endTick) {
      console.warn(
        '[waveform-playlist] Scheduler.setLoop: startTick (' +
          startTick +
          ') must be less than endTick (' +
          endTick +
          ')'
      );
      return;
    }
    this._loopEnabled = enabled;
    this._loopStart = Math.round(startTick);
    this._loopEnd = Math.round(endTick);
  }

  /** Convenience — converts seconds to ticks via TempoMap */
  setLoopSeconds(enabled: boolean, startSec: number, endSec: number): void {
    const startTick = this._tempoMap.secondsToTicks(startSec);
    const endTick = this._tempoMap.secondsToTicks(endSec);
    this.setLoop(enabled, startTick, endTick);
  }

  /** Hard end bound (ticks) for non-loop playback: the lookahead window never
   *  generates events at or beyond this tick, so audio (metronome clicks, clips)
   *  can't be scheduled past the playback end and sound a beat into the next
   *  (nonexistent) bar. Null = unbounded. Set from Transport.play()'s endTime; the
   *  loop path is unaffected (loopEnd already bounds it). */
  setPlayEnd(endTick: Tick | null): void {
    this._playEnd = endTick == null ? null : Math.round(endTick);
  }

  /** Reset scheduling cursor. Takes seconds (from Clock), converts to ticks. */
  reset(timeSeconds: number): void {
    this._rightEdge = this._tempoMap.secondsToTicks(timeSeconds);
  }

  /** Advance the scheduling window. Takes seconds (from Clock), converts to ticks. */
  advance(currentTimeSeconds: number): void {
    const targetTick = this._tempoMap.secondsToTicks(currentTimeSeconds + this._lookahead);

    if (this._loopEnabled && this._loopEnd > this._loopStart) {
      const loopDuration = this._loopEnd - this._loopStart;
      let remaining = targetTick - this._rightEdge;

      while (remaining > 0) {
        const distToEnd = this._loopEnd - this._rightEdge;
        if (distToEnd <= 0 || distToEnd > remaining) {
          this._generateAndConsume(this._rightEdge, this._rightEdge + remaining);
          this._rightEdge += remaining;
          break;
        }
        // Generate up to loopEnd
        this._generateAndConsume(this._rightEdge, this._loopEnd);
        remaining -= distToEnd;
        // Notify listeners of position jump (in ticks)
        for (const listener of this._listeners) {
          listener.onPositionJump(this._loopStart as Tick);
        }
        // Seek clock — passes the currentTimeSeconds snapshot so Transport
        // uses the same clock reading as advance(), not a live re-read.
        this._onLoop?.(
          this._tempoMap.ticksToSeconds(this._loopStart as Tick),
          this._tempoMap.ticksToSeconds(this._loopEnd as Tick),
          currentTimeSeconds
        );
        this._rightEdge = this._loopStart;

        // Guard against infinite loop
        if (loopDuration <= 0) break;
      }
      return;
    }

    // Clamp the lookahead window to the play-end bound so nothing is generated at or
    // beyond it (generate() uses `tick < toTick`, so the boundary tick is excluded).
    const bound = this._playEnd !== null && targetTick > this._playEnd ? this._playEnd : targetTick;
    if (bound > this._rightEdge) {
      this._generateAndConsume(this._rightEdge, bound);
      this._rightEdge = bound;
    }
  }

  private _generateAndConsume(fromTick: number, toTick: number): void {
    for (const listener of this._listeners) {
      try {
        const events = listener.generate(fromTick as Tick, toTick as Tick);
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
