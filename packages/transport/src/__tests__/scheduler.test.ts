import { describe, it, expect, vi } from 'vitest';
import { Scheduler } from '../core/scheduler';
import { TempoMap } from '../timeline/tempo-map';
import type { SchedulerEvent, SchedulerListener, SchedulerListenerError, Tick } from '../types';

interface TestEvent extends SchedulerEvent {
  id: string;
}

function createMockListener(): SchedulerListener<TestEvent> & {
  generated: TestEvent[];
  consumed: TestEvent[];
  jumpedTo: number[];
  silenced: number;
  generateRanges: Array<[number, number]>;
} {
  const state = {
    generated: [] as TestEvent[],
    consumed: [] as TestEvent[],
    jumpedTo: [] as number[],
    silenced: 0,
    generateRanges: [] as Array<[number, number]>,
  };
  return {
    ...state,
    generate(fromTick, toTick) {
      state.generateRanges.push([fromTick, toTick]);
      const events: TestEvent[] = [];
      const step = 480;
      const start = Math.ceil(fromTick / step) * step;
      for (let t = start; t < toTick; t += step) {
        const event = { tick: t as Tick, id: 'e-' + t };
        events.push(event);
        state.generated.push(event);
      }
      return events;
    },
    consume(event) {
      state.consumed.push(event);
    },
    onPositionJump(newTick) {
      state.jumpedTo.push(newTick);
    },
    silence() {
      state.silenced++;
    },
  };
}

describe('Scheduler (tick-based)', () => {
  const ppqn = 960;
  const bpm = 120;

  function createScheduler(
    lookahead = 0.2,
    onLoop?: (loopStartSec: number, loopEndSec: number, currentTimeSec: number) => void
  ) {
    const tempoMap = new TempoMap(ppqn, bpm);
    return new Scheduler<TestEvent>(tempoMap, { lookahead, onLoop });
  }

  it('advance generates and consumes events in lookahead window', () => {
    const scheduler = createScheduler(0.2);
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.advance(0);
    expect(listener.consumed.length).toBe(1);
    expect(listener.consumed[0].tick).toBe(0);
  });

  it('advance does not re-generate consumed window', () => {
    const scheduler = createScheduler(0.2);
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.advance(0);
    const count1 = listener.consumed.length;
    scheduler.advance(0.05);
    expect(listener.consumed.length).toBeGreaterThanOrEqual(count1);
  });

  it('loop: wraps at loopEnd and generates from loopStart', () => {
    const loopCalls: Array<[number, number, number]> = [];
    const scheduler = createScheduler(0.3, (start, end, currentTime) =>
      loopCalls.push([start, end, currentTime])
    );
    const listener = createMockListener();
    scheduler.addListener(listener);
    // Loop [0, 960) ticks = [0, 0.5s) at 120 BPM
    scheduler.setLoop(true, 0 as Tick, 960 as Tick);
    scheduler.advance(0.35);
    expect(listener.jumpedTo.length).toBe(1);
    expect(listener.jumpedTo[0]).toBe(0);
    expect(loopCalls.length).toBe(1);
    // onLoop receives loopStart, loopEnd (seconds), and currentTimeSeconds snapshot
    expect(loopCalls[0][0]).toBeCloseTo(0); // loopStart = 0s
    expect(loopCalls[0][1]).toBeCloseTo(0.5); // loopEnd = 960 ticks = 0.5s
    expect(loopCalls[0][2]).toBe(0.35); // currentTimeSeconds passed to advance()
  });

  it('loop: _rightEdge is exact integer after wrap (no drift)', () => {
    const scheduler = createScheduler(0.2);
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.setLoop(true, 0 as Tick, 480 as Tick);
    for (let i = 0; i < 100; i++) {
      scheduler.advance(i * 0.01);
    }
    for (const [from] of listener.generateRanges) {
      expect(Number.isInteger(from)).toBe(true);
    }
  });

  it('loop: multi-wrap when lookahead spans multiple loop regions', () => {
    const scheduler = createScheduler(0.5);
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.setLoop(true, 0 as Tick, 480 as Tick);
    scheduler.advance(0);
    expect(listener.jumpedTo.length).toBeGreaterThanOrEqual(2);
  });

  it('setLoop throws on start >= end', () => {
    const scheduler = createScheduler();
    expect(() => scheduler.setLoop(true, 960 as Tick, 480 as Tick)).toThrow(/must be less than/);
    expect(() => scheduler.setLoop(true, 960 as Tick, 960 as Tick)).toThrow(/must be less than/);
  });

  it('setLoop throws on non-finite ticks', () => {
    const scheduler = createScheduler();
    expect(() => scheduler.setLoop(true, NaN as Tick, 480 as Tick)).toThrow(/non-finite/);
    expect(() => scheduler.setLoop(true, 0 as Tick, Infinity as Tick)).toThrow(/non-finite/);
  });

  it('setLoop rejects fractional ticks instead of rounding them into an empty loop', () => {
    const scheduler = createScheduler();
    expect(() => scheduler.setLoop(true, 960.6 as Tick, 961.4 as Tick)).toThrow(/integer/);
  });

  it('setLoopSeconds throws in seconds for a range shorter than one tick', () => {
    const scheduler = createScheduler();
    expect(() => scheduler.setLoopSeconds(true, 1, 1.0001)).toThrow(
      /setLoopSeconds: range \(1, 1\.0001 second\) is shorter than one tick/
    );
  });

  it('setLoop(false) accepts a degenerate range (nothing to validate when disabled)', () => {
    const scheduler = createScheduler();
    expect(() => scheduler.setLoop(false, 0 as Tick, 0 as Tick)).not.toThrow();
  });

  it('rejected setLoop leaves the previous loop in force', () => {
    const scheduler = createScheduler(0.3);
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.setLoop(true, 0 as Tick, 960 as Tick);
    expect(() => scheduler.setLoop(true, 960 as Tick, 480 as Tick)).toThrow();
    scheduler.advance(0.35);
    expect(listener.jumpedTo).toEqual([0]); // still wraps at the original loopEnd
  });

  it('setLoopSeconds converts seconds to ticks', () => {
    const scheduler = createScheduler(0.3);
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.setLoopSeconds(true, 0, 0.5);
    scheduler.advance(0.35);
    expect(listener.jumpedTo.length).toBe(1);
    expect(listener.jumpedTo[0]).toBe(0);
  });

  it('removeListener stops generating for that listener', () => {
    const scheduler = createScheduler();
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.removeListener(listener);
    scheduler.advance(0);
    expect(listener.consumed.length).toBe(0);
  });

  it('reset keeps the cursor on whole ticks for a fractional-second position', () => {
    const scheduler = createScheduler();
    scheduler.reset(0.0005); // 0.96 ticks at 120 BPM
    expect((scheduler as unknown as { _rightEdge: number })._rightEdge).toBe(1);
  });

  it('reset clears rightEdge', () => {
    const scheduler = createScheduler();
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.advance(1.0);
    const count1 = listener.consumed.length;
    scheduler.reset(0);
    scheduler.advance(0);
    expect(listener.consumed.length).toBeGreaterThan(count1);
  });

  it('setPlayEnd: lookahead never generates at or beyond the play-end bound', () => {
    // Big lookahead so a single advance() would otherwise overshoot far past the bound.
    const scheduler = createScheduler(10);
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.setPlayEnd(960 as Tick); // bound = tick 960 (events at step 480)
    scheduler.advance(0);
    // Ticks 0 and 480 are < 960; the boundary tick 960 (and beyond) is excluded.
    expect(listener.consumed.map((e) => e.tick)).toEqual([0, 480]);
  });

  it('setPlayEnd: further advances generate nothing once the bound is reached', () => {
    const scheduler = createScheduler(10);
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.setPlayEnd(960 as Tick);
    scheduler.advance(0);
    const afterFirst = listener.consumed.length;
    scheduler.advance(1.0);
    expect(listener.consumed.length).toBe(afterFirst); // nothing past the bound
  });

  it('setPlayEnd(null) restores unbounded scheduling', () => {
    const scheduler = createScheduler(10);
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.setPlayEnd(960 as Tick);
    scheduler.advance(0);
    const bounded = listener.consumed.length;
    scheduler.setPlayEnd(null);
    scheduler.advance(0);
    expect(listener.consumed.length).toBeGreaterThan(bounded); // generates past 960 again
  });

  describe('listener error surfacing (#636)', () => {
    function throwingListener(opts: {
      generate?: Error;
      consumeAt?: number;
      consumeError?: Error;
    }): SchedulerListener<TestEvent> & { consumed: number[] } {
      const consumed: number[] = [];
      return {
        consumed,
        generate(fromTick, toTick) {
          if (opts.generate) throw opts.generate;
          const events: TestEvent[] = [];
          for (let t = Math.ceil(fromTick / 480) * 480; t < toTick; t += 480) {
            events.push({ tick: t as Tick, id: 'e-' + t });
          }
          return events;
        },
        consume(event) {
          if (opts.consumeAt !== undefined && event.tick === opts.consumeAt) {
            throw opts.consumeError ?? new Error('consume failed');
          }
          consumed.push(event.tick);
        },
        onPositionJump() {},
        silence() {},
      };
    }

    it('reports a generate() failure through onError with phase and listener', () => {
      const errors: SchedulerListenerError[] = [];
      const tempoMap = new TempoMap(ppqn, bpm);
      const scheduler = new Scheduler<TestEvent>(tempoMap, {
        lookahead: 0.6,
        onError: (e) => errors.push(e),
      });
      const failure = new Error('generate failed');
      const bad = throwingListener({ generate: failure });
      const good = createMockListener();
      scheduler.addListener(bad);
      scheduler.addListener(good);

      scheduler.advance(0);

      expect(errors).toHaveLength(1);
      expect(errors[0].phase).toBe('generate');
      expect(errors[0].listener).toBe(bad);
      expect('event' in errors[0]).toBe(false);
      expect(errors[0].error).toBe(failure);
      // The other listener still got its window
      expect(good.consumed.length).toBeGreaterThan(0);
    });

    it('reports a consume() failure with the offending event and keeps consuming the rest', () => {
      const errors: SchedulerListenerError[] = [];
      const tempoMap = new TempoMap(ppqn, bpm);
      const scheduler = new Scheduler<TestEvent>(tempoMap, {
        lookahead: 0.6, // 0.6s at 120 BPM = 1152 ticks → events at 0, 480, 960
        onError: (e) => errors.push(e),
      });
      const failure = new Error('consume failed');
      const listener = throwingListener({ consumeAt: 480, consumeError: failure });
      scheduler.addListener(listener);

      scheduler.advance(0);

      expect(errors).toHaveLength(1);
      expect(errors[0].phase).toBe('consume');
      expect(errors[0].listener).toBe(listener);
      expect(errors[0].phase === 'consume' && errors[0].event).toEqual({ tick: 480, id: 'e-480' });
      expect(errors[0].error).toBe(failure);
      expect(listener.consumed).toEqual([0, 960]);
    });

    it('reports an onPositionJump() failure and still completes the loop wrap', () => {
      const errors: SchedulerListenerError[] = [];
      const loopCalls: number[] = [];
      const tempoMap = new TempoMap(ppqn, bpm);
      const scheduler = new Scheduler<TestEvent>(tempoMap, {
        lookahead: 0.3,
        onLoop: (start) => loopCalls.push(start),
        onError: (e) => errors.push(e),
      });
      scheduler.setLoop(true, 0 as Tick, 960 as Tick); // [0, 0.5 s)
      const failure = new Error('jump failed');
      const bad = {
        ...throwingListener({}),
        onPositionJump() {
          throw failure;
        },
      };
      const good = createMockListener();
      scheduler.addListener(bad);
      scheduler.addListener(good);

      scheduler.advance(0.35); // crosses loopEnd once

      expect(errors).toHaveLength(1);
      expect(errors[0].phase).toBe('positionJump');
      expect(errors[0].listener).toBe(bad);
      expect(errors[0].error).toBe(failure);
      // The wrap finished: the other listener jumped, the clock was re-seeked,
      // and the cursor restarted from loopStart (next window begins at 288).
      expect(good.jumpedTo).toEqual([0]);
      expect(loopCalls).toEqual([0]);
      expect(good.generateRanges).toEqual([
        [0, 960],
        [0, 288],
      ]);
    });

    it('an onPositionJump() failure in the LAST listener still completes the loop wrap', () => {
      const loopCalls: number[] = [];
      const tempoMap = new TempoMap(ppqn, bpm);
      const scheduler = new Scheduler<TestEvent>(tempoMap, {
        lookahead: 0.3,
        onLoop: (start) => loopCalls.push(start),
        onError: () => {},
      });
      scheduler.setLoop(true, 0 as Tick, 960 as Tick);
      const good = createMockListener();
      const bad = {
        ...throwingListener({}),
        onPositionJump() {
          throw new Error('jump failed');
        },
      };
      scheduler.addListener(good);
      scheduler.addListener(bad);
      scheduler.advance(0.35);
      expect(loopCalls).toEqual([0]);
      expect(good.generateRanges).toEqual([
        [0, 960],
        [0, 288],
      ]);
    });

    it('generate and positionJump failures carry their window and target tick', () => {
      const errors: SchedulerListenerError[] = [];
      const tempoMap = new TempoMap(ppqn, bpm);
      const scheduler = new Scheduler<TestEvent>(tempoMap, {
        lookahead: 0.3,
        onError: (e) => errors.push(e),
      });
      scheduler.setLoop(true, 0 as Tick, 960 as Tick);
      const bad = {
        ...throwingListener({ generate: new Error('generate failed') }),
        onPositionJump() {
          throw new Error('jump failed');
        },
      };
      scheduler.addListener(bad);
      scheduler.advance(0.35);
      const gen = errors.find((e) => e.phase === 'generate');
      const jump = errors.find((e) => e.phase === 'positionJump');
      expect(gen && gen.phase === 'generate' && [gen.fromTick, gen.toTick]).toEqual([0, 960]);
      expect(jump && jump.phase === 'positionJump' && jump.tick).toBe(0);
    });

    it('falls back to console.warn when no onError handler is configured', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const scheduler = createScheduler(0.2);
      scheduler.addListener(throwingListener({ generate: new Error('generate failed') }));

      scheduler.advance(0);

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('generate failed'));
      warn.mockRestore();
    });

    it('the console fallback warns again for a different failure of the same listener and phase', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const scheduler = createScheduler(0.2);
      let message = 'first failure';
      scheduler.addListener({
        ...throwingListener({}),
        generate() {
          throw new Error(message);
        },
      });
      scheduler.advance(0);
      scheduler.advance(0.05);
      message = 'a different failure';
      scheduler.advance(0.1);
      scheduler.advance(0.15);
      expect(warn).toHaveBeenCalledTimes(2);
      expect(warn.mock.calls[1][0]).toContain('a different failure');
      warn.mockRestore();
    });

    it('the console fallback is keyed per listener: two failing listeners warn twice', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const scheduler = createScheduler(0.2);
      scheduler.addListener(throwingListener({ generate: new Error('generate failed') }));
      scheduler.addListener(throwingListener({ generate: new Error('generate failed') }));
      scheduler.advance(0);
      scheduler.advance(0.05);
      expect(warn).toHaveBeenCalledTimes(2);
      warn.mockRestore();
    });

    it('the console fallback warns once per listener and phase, not once per tick', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const scheduler = createScheduler(0.2);
      scheduler.addListener(throwingListener({ generate: new Error('generate failed') }));
      for (let i = 0; i < 50; i++) scheduler.advance(i * 0.05);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('further failures of this kind are not logged');
      warn.mockRestore();
    });
  });

  describe('tempo map swapping (#636)', () => {
    it('setTempoMap makes later windows convert with the new map', () => {
      const scheduler = createScheduler(0.5);
      const listener = createMockListener();
      scheduler.addListener(listener);
      scheduler.advance(0); // 0.5 s at 120 BPM = 960 ticks → events 0, 480
      expect(listener.consumed.map((e) => e.tick)).toEqual([0, 480]);
      scheduler.setTempoMap(new TempoMap(ppqn, 240)); // the 0.5 s edge is now tick 1920
      scheduler.advance(0.5); // window [0.5 s, 1.0 s) = [1920, 3840) at 240 BPM
      expect(listener.consumed.map((e) => e.tick)).toEqual([0, 480, 1920, 2400, 2880, 3360]);
    });

    it('setTempoMap re-anchors the cursor so already-scheduled seconds are neither skipped nor regenerated', () => {
      const scheduler = createScheduler(0.2);
      const listener = createMockListener();
      scheduler.addListener(listener);
      scheduler.advance(0); // 120 BPM: window [0, 0.2 s) = [0, 384) ticks → event 0
      expect(listener.consumed.map((e) => e.tick)).toEqual([0]);
      // 0.2 s is 768 ticks at 240 BPM. The next window must start there — not at
      // tick 384 (which would regenerate 0.1 s of already-scheduled audio) and
      // not stall until the clock reaches the old edge's new seconds value.
      scheduler.setTempoMap(new TempoMap(ppqn, 240));
      scheduler.advance(0.1); // window [0.2 s, 0.3 s) = [768, 1152) ticks → event 960
      expect(listener.consumed.map((e) => e.tick)).toEqual([0, 960]);
      expect(listener.generateRanges[1]).toEqual([768, 1152]);
    });

    it('a swap during a listener callback does not change the in-progress window', () => {
      const loopCalls: Array<[number, number]> = [];
      const scheduler = createScheduler(0.3, (start, end) => loopCalls.push([start, end]));
      // Loop [0, 960) ticks = [0, 0.5 s) at 120 BPM. The first consume swaps
      // to 240 BPM mid-advance; this advance must still report the loop
      // boundary in 120-BPM seconds and generate the same 120-BPM window.
      scheduler.setLoop(true, 0 as Tick, 960 as Tick);
      const listener = createMockListener();
      const original = listener.consume.bind(listener);
      let swapped = false;
      listener.consume = (event) => {
        original(event);
        if (!swapped) {
          swapped = true;
          scheduler.setTempoMap(new TempoMap(ppqn, 240));
        }
      };
      scheduler.addListener(listener);
      scheduler.advance(0.35); // target = 0.65 s = 1248 ticks at 120 BPM → one wrap
      expect(loopCalls).toEqual([[0, 0.5]]);
      expect(listener.generateRanges).toEqual([
        [0, 960],
        [0, 288],
      ]);
      // The swap must still re-anchor the cursor once the window is done:
      // 288 ticks at 120 BPM is 0.15 s, which is 576 ticks at 240 BPM. The
      // next window starts there — not at a stale 288 (which would regenerate
      // 0.075 s of already-scheduled audio).
      scheduler.advance(0.5);
      expect(listener.generateRanges[2][0]).toBe(576);
    });

    it('raising the tempo while looping never leaves the cursor past loopEnd', () => {
      // Loop [0, 3840) at 120 BPM; the edge sits at 1.9 s = 3648 ticks. At
      // 140 BPM that same 1.9 s is 4256 ticks — past loopEnd. The next
      // advance() must wrap (not run past the loop forever).
      const loopCalls: number[] = [];
      const scheduler = createScheduler(0.2, (start) => loopCalls.push(start));
      const listener = createMockListener();
      scheduler.addListener(listener);
      scheduler.setLoop(true, 0 as Tick, 3840 as Tick);
      scheduler.advance(1.7);
      expect(loopCalls).toHaveLength(0);
      scheduler.setTempoMap(new TempoMap(ppqn, 140));
      scheduler.advance(1.8);
      expect(loopCalls).toHaveLength(1);
      for (let t = 1.9; t < 6; t += 0.1) scheduler.advance(t);
      expect(loopCalls.length).toBeGreaterThan(1);
      for (const [from, to] of listener.generateRanges) {
        expect(from).toBeGreaterThanOrEqual(0);
        expect(to).toBeLessThanOrEqual(3840);
      }
    });
  });
});
