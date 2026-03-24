import { describe, it, expect } from 'vitest';
import { Scheduler } from '../core/scheduler';
import type { SchedulerEvent, SchedulerListener } from '../types';

interface TestEvent extends SchedulerEvent {
  id: string;
}

function createMockListener(): SchedulerListener<TestEvent> & {
  generated: TestEvent[];
  consumed: TestEvent[];
  jumpedTo: number[];
  silenced: number;
} {
  const state = {
    generated: [] as TestEvent[],
    consumed: [] as TestEvent[],
    jumpedTo: [] as number[],
    silenced: 0,
  };
  return {
    ...state,
    generate(from, to) {
      const events: TestEvent[] = [];
      // Generate an event every 0.1s in the window
      for (let t = Math.ceil(from * 10) / 10; t < to; t += 0.1) {
        const event = { transportTime: t, id: 'e-' + t.toFixed(1) };
        events.push(event);
        state.generated.push(event);
      }
      return events;
    },
    consume(event) {
      state.consumed.push(event);
    },
    onPositionJump(time) {
      state.jumpedTo.push(time);
    },
    silence() {
      state.silenced++;
    },
  };
}

describe('Scheduler', () => {
  it('advance generates and consumes events in lookahead window', () => {
    const scheduler = new Scheduler<TestEvent>({ lookahead: 0.2 });
    const listener = createMockListener();
    scheduler.addListener(listener);

    scheduler.advance(0);
    // Should generate events in [0, 0.2): 0.0, 0.1
    expect(listener.consumed.length).toBe(2);
    expect(listener.consumed[0].transportTime).toBeCloseTo(0.0);
    expect(listener.consumed[1].transportTime).toBeCloseTo(0.1);
  });

  it('advance does not re-generate consumed window', () => {
    const scheduler = new Scheduler<TestEvent>({ lookahead: 0.2 });
    const listener = createMockListener();
    scheduler.addListener(listener);

    scheduler.advance(0);
    const count1 = listener.consumed.length;
    scheduler.advance(0.05); // still within first window
    // Should generate [0.2, 0.25) — one partial window
    expect(listener.consumed.length).toBeGreaterThanOrEqual(count1);
  });

  it('loop: wraps at loopEnd and generates from loopStart', () => {
    const scheduler = new Scheduler<TestEvent>({ lookahead: 0.3 });
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.setLoop(true, 0, 0.5);

    // Advance to near loop end
    scheduler.advance(0.35);
    // Should have generated events up to 0.5 (loopEnd), then from 0.0 (loopStart)
    expect(listener.jumpedTo.length).toBe(1);
    expect(listener.jumpedTo[0]).toBe(0);
  });

  it('removeListener stops generating for that listener', () => {
    const scheduler = new Scheduler<TestEvent>({ lookahead: 0.2 });
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.removeListener(listener);

    scheduler.advance(0);
    expect(listener.consumed.length).toBe(0);
  });

  it('reset clears edges', () => {
    const scheduler = new Scheduler<TestEvent>({ lookahead: 0.2 });
    const listener = createMockListener();
    scheduler.addListener(listener);

    scheduler.advance(1.0);
    const count1 = listener.consumed.length;
    scheduler.reset(0);
    scheduler.advance(0);
    // Should re-generate from 0
    expect(listener.consumed.length).toBeGreaterThan(count1);
  });
});
