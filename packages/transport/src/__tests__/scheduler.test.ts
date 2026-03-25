import { describe, it, expect, vi } from 'vitest';
import { Scheduler } from '../core/scheduler';
import { TempoMap } from '../timeline/tempo-map';
import type { SchedulerEvent, SchedulerListener } from '../types';

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
        const event = { tick: t, id: 'e-' + t };
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
    scheduler.setLoop(true, 0, 960);
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
    scheduler.setLoop(true, 0, 480);
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
    scheduler.setLoop(true, 0, 480);
    scheduler.advance(0);
    expect(listener.jumpedTo.length).toBeGreaterThanOrEqual(2);
  });

  it('setLoop rejects start >= end', () => {
    const scheduler = createScheduler();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    scheduler.setLoop(true, 960, 480);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
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
});
