import { describe, it, expect } from 'vitest';
import { TickTimeline } from '../timeline/tick-timeline';

describe('TickTimeline', () => {
  const tt = new TickTimeline(960);

  it('ticksPerBeat returns ppqn', () => {
    expect(tt.ticksPerBeat()).toBe(960);
  });

  it('ticksPerBar returns ppqn * beatsPerBar', () => {
    expect(tt.ticksPerBar(4)).toBe(3840);
    expect(tt.ticksPerBar(3)).toBe(2880);
  });

  it('toPosition converts ticks to bar/beat/tick', () => {
    // Bar 1, beat 1, tick 0
    expect(tt.toPosition(0, 4)).toEqual({ bar: 1, beat: 1, tick: 0 });
    // Bar 1, beat 2, tick 0
    expect(tt.toPosition(960, 4)).toEqual({ bar: 1, beat: 2, tick: 0 });
    // Bar 2, beat 1, tick 0
    expect(tt.toPosition(3840, 4)).toEqual({ bar: 2, beat: 1, tick: 0 });
    // Bar 1, beat 1, tick 480 (half beat)
    expect(tt.toPosition(480, 4)).toEqual({ bar: 1, beat: 1, tick: 480 });
  });

  it('fromPosition converts bar/beat/tick to ticks', () => {
    expect(tt.fromPosition(1, 1, 0, 4)).toBe(0);
    expect(tt.fromPosition(1, 2, 0, 4)).toBe(960);
    expect(tt.fromPosition(2, 1, 0, 4)).toBe(3840);
    expect(tt.fromPosition(1, 1, 480, 4)).toBe(480);
  });

  it('round-trips position conversion', () => {
    const ticks = 5280; // some arbitrary position
    const pos = tt.toPosition(ticks, 4);
    expect(tt.fromPosition(pos.bar, pos.beat, pos.tick, 4)).toBe(ticks);
  });
});
