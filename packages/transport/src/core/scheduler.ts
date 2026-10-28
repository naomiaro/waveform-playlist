import type { Tick, SchedulerEvent, SchedulerListener, SchedulerListenerError } from '../types';
import type { TempoMap } from '../timeline/tempo-map';
import { assertValidLoopRange, assertLoopRangeSpansATick } from './loop-range';

export interface SchedulerOptions {
  lookahead?: number;
  /** Called when the scheduler wraps at loopEnd.
   *  Receives loopStart, loopEnd, and the currentTimeSeconds snapshot from
   *  advance() so the Transport can compute the correct clock seek target
   *  without re-reading the live AudioContext.currentTime. */
  onLoop?: (loopStartSeconds: number, loopEndSeconds: number, currentTimeSeconds: number) => void;
  /** Called when a listener's generate(), consume() or onPositionJump()
   *  throws. The failing listener is skipped for that window (consume: that
   *  event; positionJump: that jump) and the remaining listeners/events still
   *  run. Without a handler the failure is reported with console.warn, once
   *  per listener and failure kind, so it is never silent. */
  onError?: (error: SchedulerListenerError) => void;
}

/** One-line description of a listener failure for the console fallback. */
export function formatSchedulerListenerError(error: SchedulerListenerError): string {
  const where =
    error.phase === 'consume'
      ? ' at tick ' + error.event.tick
      : error.phase === 'generate'
        ? ' for ticks [' + error.fromTick + ', ' + error.toTick + ')'
        : ' jumping to tick ' + error.tick;
  return (
    'scheduler listener threw during ' +
    error.phase +
    '()' +
    where +
    ': ' +
    describeError(error.error)
  );
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.name + ': ' + error.message : String(error);
}

/** Distinct failure kinds reported per listener before the log goes quiet
 *  for that listener — enough to see a progression of different faults,
 *  bounded so a listener that throws a fresh message every tick cannot flood. */
const MAX_LOGGED_KINDS_PER_LISTENER = 16;

/**
 * Console fallback for listener failures when no handler is subscribed. A
 * listener that fails on every window would otherwise log ~40 lines a second
 * for the whole playback, so each distinct failure (listener, phase, error
 * name + message) is reported once; a NEW kind of failure from the same
 * listener is still reported.
 */
export class ListenerErrorLog {
  private readonly _seen = new WeakMap<object, Set<string>>();

  constructor(private readonly _prefix: string) {}

  warnOnce(error: SchedulerListenerError): void {
    let kinds = this._seen.get(error.listener);
    if (!kinds) {
      kinds = new Set();
      this._seen.set(error.listener, kinds);
    }
    const kind = error.phase + '|' + describeError(error.error);
    if (kinds.has(kind) || kinds.size >= MAX_LOGGED_KINDS_PER_LISTENER) return;
    kinds.add(kind);
    console.warn(
      this._prefix +
        formatSchedulerListenerError(error) +
        ' (further failures of this kind are not logged; subscribe to the "error" event to handle them)'
    );
  }
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
  private _onError: ((error: SchedulerListenerError) => void) | undefined;
  private readonly _errorLog = new ListenerErrorLog('[waveform-playlist] Scheduler: ');
  private _tempoMap: TempoMap;

  constructor(tempoMap: TempoMap, options: SchedulerOptions = {}) {
    this._tempoMap = tempoMap;
    this._lookahead = options.lookahead ?? 0.2;
    this._onLoop = options.onLoop;
    this._onError = options.onError;
  }

  addListener(listener: SchedulerListener<T>): void {
    this._listeners.add(listener);
  }

  removeListener(listener: SchedulerListener<T>): void {
    this._listeners.delete(listener);
  }

  /** Primary API — ticks as source of truth. Throws on a non-finite or
   *  inverted/empty range when `enabled`; the previous loop stays in force. */
  setLoop(enabled: boolean, startTick: Tick, endTick: Tick): void {
    assertValidLoopRange('Scheduler.setLoop', enabled, startTick, endTick, 'tick');
    this._loopEnabled = enabled;
    this._loopStart = Math.round(startTick);
    this._loopEnd = Math.round(endTick);
  }

  /** Convenience — converts seconds to ticks via TempoMap */
  setLoopSeconds(enabled: boolean, startSec: number, endSec: number): void {
    assertValidLoopRange('Scheduler.setLoopSeconds', enabled, startSec, endSec, 'second');
    const startTick = this._tempoMap.secondsToTicks(startSec);
    const endTick = this._tempoMap.secondsToTicks(endSec);
    assertLoopRangeSpansATick(
      'Scheduler.setLoopSeconds',
      enabled,
      startSec,
      endSec,
      'second',
      startTick,
      endTick
    );
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
        // Notify listeners of position jump (in ticks). A throwing listener
        // must not abort the wrap: the cursor reset and clock seek below
        // have to happen or the next window generates past loopEnd again.
        for (const listener of this._listeners) {
          try {
            listener.onPositionJump(this._loopStart as Tick);
          } catch (err) {
            this._reportError({
              phase: 'positionJump',
              listener,
              tick: this._loopStart as Tick,
              error: err,
            });
          }
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
      let events: T[];
      try {
        events = listener.generate(fromTick as Tick, toTick as Tick);
      } catch (err) {
        this._reportError({
          phase: 'generate',
          listener,
          fromTick: fromTick as Tick,
          toTick: toTick as Tick,
          error: err,
        });
        continue;
      }
      for (const event of events) {
        try {
          listener.consume(event);
        } catch (err) {
          this._reportError({ phase: 'consume', listener, event, error: err });
        }
      }
    }
  }

  private _reportError(error: SchedulerListenerError): void {
    if (this._onError) {
      this._onError(error);
      return;
    }
    this._errorLog.warnOnce(error);
  }
}
