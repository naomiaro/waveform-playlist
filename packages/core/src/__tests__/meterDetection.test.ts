import { describe, it, expect } from 'vitest';
import { detectMeterChanges } from '../utils/meterDetection';

const PPQN = 192;

describe('detectMeterChanges', () => {
  describe('4/4 throughout', () => {
    it('returns a single 4/4 entry at tick 0', () => {
      // beats: 1,2,3,4,1,2,3,4
      const beats = [
        { time: 0.0, beat: 1 },
        { time: 0.5, beat: 2 },
        { time: 1.0, beat: 3 },
        { time: 1.5, beat: 4 },
        { time: 2.0, beat: 1 },
        { time: 2.5, beat: 2 },
        { time: 3.0, beat: 3 },
        { time: 3.5, beat: 4 },
        { time: 4.0, beat: 1 },
      ];
      const result = detectMeterChanges(beats, 0, PPQN);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ tick: 0, numerator: 4, denominator: 4 });
    });

    it('does not generate duplicate entries for repeated same meter', () => {
      // Three full bars of 4/4
      const beats = [
        { time: 0.0, beat: 1 },
        { time: 0.5, beat: 2 },
        { time: 1.0, beat: 3 },
        { time: 1.5, beat: 4 },
        { time: 2.0, beat: 1 },
        { time: 2.5, beat: 2 },
        { time: 3.0, beat: 3 },
        { time: 3.5, beat: 4 },
        { time: 4.0, beat: 1 },
        { time: 4.5, beat: 2 },
        { time: 5.0, beat: 3 },
        { time: 5.5, beat: 4 },
        { time: 6.0, beat: 1 },
      ];
      const result = detectMeterChanges(beats, 0, PPQN);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ tick: 0, numerator: 4, denominator: 4 });
    });
  });

  describe('3/4 throughout', () => {
    it('returns a single 3/4 entry at tick 0', () => {
      // beats: 1,2,3,1,2,3
      const beats = [
        { time: 0.0, beat: 1 },
        { time: 0.5, beat: 2 },
        { time: 1.0, beat: 3 },
        { time: 1.5, beat: 1 },
        { time: 2.0, beat: 2 },
        { time: 2.5, beat: 3 },
        { time: 3.0, beat: 1 },
      ];
      const result = detectMeterChanges(beats, 0, PPQN);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ tick: 0, numerator: 3, denominator: 4 });
    });
  });

  describe('meter change from 4/4 to 3/4', () => {
    it('returns two entries: 4/4 at tick 0 and 3/4 at the bar where meter changes', () => {
      // Two bars of 4/4 then two bars of 3/4
      // firstBeatTick=0, ppqn=192
      // Bar 1: beats 1,2,3,4 at indices 0-3 → bar ends at beat index 4 (tick 4*192=768)
      // Bar 2: beats 1,2,3,4 at indices 4-7 → bar ends at beat index 8 (tick 8*192=1536)
      // Bar 3: beats 1,2,3 at indices 8-10 → bar ends at beat index 11 (tick 11*192=2112)
      // Bar 4: beats 1,2,3 at indices 11-13
      const beats = [
        { time: 0.0, beat: 1 }, // index 0
        { time: 0.5, beat: 2 }, // index 1
        { time: 1.0, beat: 3 }, // index 2
        { time: 1.5, beat: 4 }, // index 3
        { time: 2.0, beat: 1 }, // index 4 — bar 2 starts
        { time: 2.5, beat: 2 }, // index 5
        { time: 3.0, beat: 3 }, // index 6
        { time: 3.5, beat: 4 }, // index 7
        { time: 4.0, beat: 1 }, // index 8 — bar 3 starts, meter changes to 3/4
        { time: 4.5, beat: 2 }, // index 9
        { time: 5.0, beat: 3 }, // index 10
        { time: 5.5, beat: 1 }, // index 11 — bar 4 starts
        { time: 6.0, beat: 2 }, // index 12
        { time: 6.5, beat: 3 }, // index 13
        { time: 7.0, beat: 1 }, // index 14 — bar 5 starts (confirms 3 beats in bar 4)
      ];
      const result = detectMeterChanges(beats, 0, PPQN);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ tick: 0, numerator: 4, denominator: 4 });
      // Bar 3 starts at beat index 8 → tick = 0 + 8*192 = 1536
      expect(result[1]).toEqual({ tick: 8 * PPQN, numerator: 3, denominator: 4 });
    });
  });

  describe('meter change from 3/4 to 4/4', () => {
    it('returns two entries: 3/4 at tick 0 and 4/4 at the bar where meter changes', () => {
      // Two bars of 3/4 then two bars of 4/4
      const beats = [
        { time: 0.0, beat: 1 }, // index 0
        { time: 0.5, beat: 2 }, // index 1
        { time: 1.0, beat: 3 }, // index 2
        { time: 1.5, beat: 1 }, // index 3 — bar 2 starts
        { time: 2.0, beat: 2 }, // index 4
        { time: 2.5, beat: 3 }, // index 5
        { time: 3.0, beat: 1 }, // index 6 — bar 3 starts, meter changes to 4/4
        { time: 3.5, beat: 2 }, // index 7
        { time: 4.0, beat: 3 }, // index 8
        { time: 4.5, beat: 4 }, // index 9
        { time: 5.0, beat: 1 }, // index 10 — bar 4 starts
        { time: 5.5, beat: 2 }, // index 11
        { time: 6.0, beat: 3 }, // index 12
        { time: 6.5, beat: 4 }, // index 13
        { time: 7.0, beat: 1 }, // index 14 — bar 5 starts (confirms 4 beats in bar 4)
      ];
      const result = detectMeterChanges(beats, 0, PPQN);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ tick: 0, numerator: 3, denominator: 4 });
      // Bar 3 starts at beat index 6 → tick = 0 + 6*192 = 1152
      expect(result[1]).toEqual({ tick: 6 * PPQN, numerator: 4, denominator: 4 });
    });
  });

  describe('firstBeatTick offset', () => {
    it('places first meter entry at tick 0 and subsequent entries offset by firstBeatTick', () => {
      // Beats start at tick 100 (pickup before the grid)
      // 4/4 throughout
      const firstBeatTick = 100;
      const beats = [
        { time: 0.0, beat: 1 },
        { time: 0.5, beat: 2 },
        { time: 1.0, beat: 3 },
        { time: 1.5, beat: 4 },
        { time: 2.0, beat: 1 },
        { time: 2.5, beat: 2 },
        { time: 3.0, beat: 3 },
        { time: 3.5, beat: 4 },
        { time: 4.0, beat: 1 },
      ];
      const result = detectMeterChanges(beats, firstBeatTick, PPQN);
      // tick 0 entry should always be present
      expect(result[0].tick).toBe(0);
      expect(result[0].numerator).toBe(4);
    });

    it('offsets bar start ticks by firstBeatTick when meter changes', () => {
      const firstBeatTick = 192; // first beat at tick 192
      // One bar of 4/4 then 3/4
      const beats = [
        { time: 0.0, beat: 1 }, // index 0
        { time: 0.5, beat: 2 }, // index 1
        { time: 1.0, beat: 3 }, // index 2
        { time: 1.5, beat: 4 }, // index 3
        { time: 2.0, beat: 1 }, // index 4 — bar 2 starts, meter changes to 3/4
        { time: 2.5, beat: 2 }, // index 5
        { time: 3.0, beat: 3 }, // index 6
        { time: 3.5, beat: 1 }, // index 7 — bar 3 starts (confirms 3 beats in bar 2)
        { time: 4.0, beat: 2 }, // index 8
        { time: 4.5, beat: 3 }, // index 9
        { time: 5.0, beat: 1 }, // index 10
      ];
      const result = detectMeterChanges(beats, firstBeatTick, PPQN);
      // First entry always at tick 0
      expect(result[0]).toEqual({ tick: 0, numerator: 4, denominator: 4 });
      // Bar 2 starts at beat index 4 → tick = firstBeatTick + 4*192 = 192 + 768 = 960
      expect(result[1]).toEqual({ tick: firstBeatTick + 4 * PPQN, numerator: 3, denominator: 4 });
    });
  });

  describe('pickup beats before first downbeat', () => {
    it('handles beats that do not start with beat 1', () => {
      // Pickup: beat 3,4 then full 4/4 bars
      const beats = [
        { time: 0.0, beat: 3 }, // pickup
        { time: 0.5, beat: 4 }, // pickup
        { time: 1.0, beat: 1 }, // index 2 — first downbeat
        { time: 1.5, beat: 2 },
        { time: 2.0, beat: 3 },
        { time: 2.5, beat: 4 },
        { time: 3.0, beat: 1 }, // confirms 4 beats in previous bar
      ];
      const result = detectMeterChanges(beats, 0, PPQN);
      // Should have tick 0 entry; the pickup is treated as pre-beat
      expect(result[0].tick).toBe(0);
      expect(result[0].numerator).toBe(4);
    });

    it('handles beats starting with beat 2 (partial pickup bar)', () => {
      // Pickup: beat 2, 3 then 3/4 bars
      const beats = [
        { time: 0.0, beat: 2 }, // pickup
        { time: 0.5, beat: 3 }, // pickup
        { time: 1.0, beat: 1 }, // first downbeat, index 2
        { time: 1.5, beat: 2 },
        { time: 2.0, beat: 3 },
        { time: 2.5, beat: 1 }, // confirms 3 beats
      ];
      const result = detectMeterChanges(beats, 0, PPQN);
      expect(result[0].tick).toBe(0);
      expect(result[0].numerator).toBe(3);
    });
  });

  describe('single beat input', () => {
    it('returns default 4/4 at tick 0 for a single beat', () => {
      const beats = [{ time: 0.0, beat: 1 }];
      const result = detectMeterChanges(beats, 0, PPQN);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ tick: 0, numerator: 4, denominator: 4 });
    });

    it('returns default 4/4 at tick 0 for empty input', () => {
      const result = detectMeterChanges([], 0, PPQN);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ tick: 0, numerator: 4, denominator: 4 });
    });

    it('returns default 4/4 for beats with no downbeat (beat never resets to 1)', () => {
      const beats = [
        { time: 0.0, beat: 2 },
        { time: 0.5, beat: 3 },
        { time: 1.0, beat: 4 },
      ];
      const result = detectMeterChanges(beats, 0, PPQN);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ tick: 0, numerator: 4, denominator: 4 });
    });
  });

  describe('denominator', () => {
    it('always returns denominator 4', () => {
      const beats = [
        { time: 0.0, beat: 1 },
        { time: 0.5, beat: 2 },
        { time: 1.0, beat: 3 },
        { time: 1.5, beat: 1 },
      ];
      const result = detectMeterChanges(beats, 0, PPQN);
      expect(result.every((e) => e.denominator === 4)).toBe(true);
    });
  });

  describe('meter change back and forth', () => {
    it('detects 4/4 → 3/4 → 4/4', () => {
      // Bar 1: 4/4, Bar 2: 3/4, Bar 3: 4/4
      const beats = [
        { time: 0, beat: 1 },
        { time: 0.5, beat: 2 },
        { time: 1.0, beat: 3 },
        { time: 1.5, beat: 4 },
        { time: 2.0, beat: 1 }, // bar 2: 3/4
        { time: 2.5, beat: 2 },
        { time: 3.0, beat: 3 },
        { time: 3.5, beat: 1 }, // bar 3: back to 4/4
        { time: 4.0, beat: 2 },
        { time: 4.5, beat: 3 },
        { time: 5.0, beat: 4 },
        { time: 5.5, beat: 1 },
      ];
      const result = detectMeterChanges(beats, 0, PPQN);
      expect(result.length).toBe(3);
      expect(result[0]).toEqual({ tick: 0, numerator: 4, denominator: 4 });
      expect(result[1].numerator).toBe(3);
      expect(result[2].numerator).toBe(4);
    });
  });
});
