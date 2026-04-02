import { describe, it, expect } from 'vitest';
import { snapToTicks, snapTickToGrid, computeMusicalTicks } from '../utils/musicalTicks';
import type { MusicalTickParams } from '../utils/musicalTicks';

const PPQN = 960;

// ---------------------------------------------------------------------------
// snapToTicks — 4/4 at 960 PPQN
// ---------------------------------------------------------------------------
describe('snapToTicks — 4/4 at 960 PPQN', () => {
  const ts44: [number, number] = [4, 4];

  it('bar → 3840', () => {
    expect(snapToTicks('bar', ts44, PPQN)).toBe(3840);
  });

  it('beat → 960', () => {
    expect(snapToTicks('beat', ts44, PPQN)).toBe(960);
  });

  it('1/2 → 1920', () => {
    expect(snapToTicks('1/2', ts44, PPQN)).toBe(1920);
  });

  it('1/4 → 960', () => {
    expect(snapToTicks('1/4', ts44, PPQN)).toBe(960);
  });

  it('1/8 → 480', () => {
    expect(snapToTicks('1/8', ts44, PPQN)).toBe(480);
  });

  it('1/16 → 240', () => {
    expect(snapToTicks('1/16', ts44, PPQN)).toBe(240);
  });

  it('1/32 → 120', () => {
    expect(snapToTicks('1/32', ts44, PPQN)).toBe(120);
  });

  it('1/2T → 1280', () => {
    expect(snapToTicks('1/2T', ts44, PPQN)).toBe(1280);
  });

  it('1/4T → 640', () => {
    expect(snapToTicks('1/4T', ts44, PPQN)).toBe(640);
  });

  it('1/8T → 320', () => {
    expect(snapToTicks('1/8T', ts44, PPQN)).toBe(320);
  });

  it('1/16T → 160', () => {
    expect(snapToTicks('1/16T', ts44, PPQN)).toBe(160);
  });

  it('off → 0', () => {
    expect(snapToTicks('off', ts44, PPQN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// snapToTicks — 6/8 at 960 PPQN
// ---------------------------------------------------------------------------
describe('snapToTicks — 6/8 at 960 PPQN', () => {
  const ts68: [number, number] = [6, 8];

  // beat = ppqn * (4 / 8) = 480
  // bar  = 6 * 480 = 2880
  it('bar → 2880', () => {
    expect(snapToTicks('bar', ts68, PPQN)).toBe(2880);
  });

  it('beat → 480', () => {
    expect(snapToTicks('beat', ts68, PPQN)).toBe(480);
  });

  // Straight subdivisions are always relative to a quarter note (ppqn), independent of time sig
  it('1/4 → 960', () => {
    expect(snapToTicks('1/4', ts68, PPQN)).toBe(960);
  });

  it('1/8 → 480', () => {
    expect(snapToTicks('1/8', ts68, PPQN)).toBe(480);
  });

  it('1/16 → 240', () => {
    expect(snapToTicks('1/16', ts68, PPQN)).toBe(240);
  });

  it('off → 0', () => {
    expect(snapToTicks('off', ts68, PPQN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// snapToTicks — 3/4 at 960 PPQN
// ---------------------------------------------------------------------------
describe('snapToTicks — 3/4 at 960 PPQN', () => {
  const ts34: [number, number] = [3, 4];

  // beat = 960, bar = 3 * 960 = 2880
  it('bar → 2880', () => {
    expect(snapToTicks('bar', ts34, PPQN)).toBe(2880);
  });

  it('beat → 960', () => {
    expect(snapToTicks('beat', ts34, PPQN)).toBe(960);
  });

  it('1/4 → 960', () => {
    expect(snapToTicks('1/4', ts34, PPQN)).toBe(960);
  });

  it('1/8 → 480', () => {
    expect(snapToTicks('1/8', ts34, PPQN)).toBe(480);
  });

  it('1/4T → 640', () => {
    expect(snapToTicks('1/4T', ts34, PPQN)).toBe(640);
  });

  it('off → 0', () => {
    expect(snapToTicks('off', ts34, PPQN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// snapTickToGrid
// ---------------------------------------------------------------------------
describe('snapTickToGrid', () => {
  const meterEntries44 = [{ tick: 0, numerator: 4, denominator: 4 }];

  it('snaps to nearest beat (960)', () => {
    // 500 is closer to 960 than to 0 — rounds to 960
    expect(snapTickToGrid(500, 'beat', meterEntries44, PPQN)).toBe(960);
  });

  it('snaps down to nearest beat', () => {
    // 400 is closer to 0 than to 960 — rounds to 0
    expect(snapTickToGrid(400, 'beat', meterEntries44, PPQN)).toBe(0);
  });

  it('snaps down to nearest bar when closer to 0', () => {
    // 1900 / 3840 = 0.495 → rounds to 0
    expect(snapTickToGrid(1900, 'bar', meterEntries44, PPQN)).toBe(0);
  });

  it('snaps up to nearest bar', () => {
    // 2000 when bar=3840 → 2000/3840=0.52 → rounds to 1 → 3840
    expect(snapTickToGrid(2100, 'bar', meterEntries44, PPQN)).toBe(3840);
  });

  it('snaps to nearest 1/16 (240)', () => {
    // 250 / 240 = 1.04 → rounds to 1 → 240
    expect(snapTickToGrid(250, '1/16', meterEntries44, PPQN)).toBe(240);
  });

  it('snaps to nearest 1/4T (640)', () => {
    // 650 / 640 = 1.015 → rounds to 1 → 640
    expect(snapTickToGrid(650, '1/4T', meterEntries44, PPQN)).toBe(640);
  });

  it('off — returns tick unchanged', () => {
    expect(snapTickToGrid(777, 'off', meterEntries44, PPQN)).toBe(777);
  });

  it('zero tick returns zero', () => {
    expect(snapTickToGrid(0, 'beat', meterEntries44, PPQN)).toBe(0);
  });

  it('tick already on grid returns same value', () => {
    expect(snapTickToGrid(1920, '1/2', meterEntries44, PPQN)).toBe(1920);
  });

  // Multi-meter snapping
  const multiMeter = [
    { tick: 0, numerator: 4, denominator: 4 },
    { tick: 3840, numerator: 3, denominator: 4 },
  ];

  it('snaps to bar in 3/4 region relative to meter start', () => {
    // 3/4 bar = 2880 ticks. Bar 3 starts at 3840 + 2880 = 6720.
    // Tick 5500 is in the 3/4 region. 5500 - 3840 = 1660, 1660/2880 = 0.576 → rounds to 1 → 3840 + 2880 = 6720
    expect(snapTickToGrid(5500, 'bar', multiMeter, PPQN)).toBe(6720);
  });

  it('snaps to beat in 3/4 region relative to meter start', () => {
    // In 3/4 region (starts at 3840), beat = 960 ticks.
    // Tick 4500, offset from 3840 = 660, 660/960 = 0.6875 → rounds to 1 → 3840 + 960 = 4800
    expect(snapTickToGrid(4500, 'beat', multiMeter, PPQN)).toBe(4800);
  });

  it('tick at meter boundary uses new meter', () => {
    // Tick 3840 is exactly at the 3/4 boundary.
    // Snapping to bar: offset = 0, rounds to 0 → 3840
    expect(snapTickToGrid(3840, 'bar', multiMeter, PPQN)).toBe(3840);
  });

  it('tick just before meter boundary uses old meter', () => {
    // Tick 3839 is in the 4/4 region. 3839/3840 ≈ 1 → rounds to 1 → 3840
    expect(snapTickToGrid(3839, 'bar', multiMeter, PPQN)).toBe(3840);
  });
});

// ---------------------------------------------------------------------------
// computeMusicalTicks
// ---------------------------------------------------------------------------
// At 4/4, 960 PPQN:
//   ticksPerBeat = 960, ticksPerBar = 3840
//   ticksPerEighth = 480, ticksPerSixteenth = 240
// ---------------------------------------------------------------------------
describe('computeMusicalTicks', () => {
  const meterEntries44 = [{ tick: 0, numerator: 4, denominator: 4 }];

  it('generates bar ticks at bar zoom (ticksPerPixel=200)', () => {
    // pixelsPerQuarterNote = 960 / 200 = 4.8 (<8) → 'bar' zoom (quarter notes too small for beats)
    const params: MusicalTickParams = {
      meterEntries: meterEntries44,
      ticksPerPixel: 200,
      startPixel: 0,
      endPixel: 400,
      ppqn: PPQN,
    };
    const result = computeMusicalTicks(params);

    expect(result.zoomLevel).toBe('bar');
    expect(result.ticks.length).toBeGreaterThan(0);
    // All ticks at bar zoom should be major (bar boundaries)
    result.ticks.forEach((t) => expect(t.type).toBe('major'));
  });

  it('generates beat ticks at beat zoom (ticksPerPixel=100)', () => {
    // pixelsPerQuarterNote = 960 / 100 = 9.6 (≥8), pixelsPerEighth = 480/100=4.8 (<8) → 'beat' zoom
    const params: MusicalTickParams = {
      meterEntries: meterEntries44,
      ticksPerPixel: 100,
      startPixel: 0,
      endPixel: 400,
      ppqn: PPQN,
    };
    const result = computeMusicalTicks(params);

    expect(result.zoomLevel).toBe('beat');
    expect(result.ticks.length).toBeGreaterThan(0);
    // Should have both major (bar) and minor (beat) ticks
    const types = new Set(result.ticks.map((t) => t.type));
    expect(types.has('major')).toBe(true);
    expect(types.has('minor')).toBe(true);
  });

  it('filters ticks to visible range only', () => {
    // ticksPerPixel=200, bar zoom — only bars within [100, 300] pixels
    const params: MusicalTickParams = {
      meterEntries: meterEntries44,
      ticksPerPixel: 200,
      startPixel: 100,
      endPixel: 300,
      ppqn: PPQN,
    };
    const result = computeMusicalTicks(params);

    result.ticks.forEach((t) => {
      expect(t.pixel).toBeGreaterThanOrEqual(100);
      expect(t.pixel).toBeLessThanOrEqual(300);
    });
  });

  it('ticks are sorted by pixel', () => {
    const params: MusicalTickParams = {
      meterEntries: meterEntries44,
      ticksPerPixel: 100,
      startPixel: 0,
      endPixel: 500,
      ppqn: PPQN,
    };
    const result = computeMusicalTicks(params);

    for (let i = 1; i < result.ticks.length; i++) {
      expect(result.ticks[i].pixel).toBeGreaterThanOrEqual(result.ticks[i - 1].pixel);
    }
  });

  it('bar ticks have sequential indices for striping', () => {
    // bar zoom: ticksPerPixel=200, multiple bars visible
    const params: MusicalTickParams = {
      meterEntries: meterEntries44,
      ticksPerPixel: 200,
      startPixel: 0,
      endPixel: 1000,
      ppqn: PPQN,
    };
    const result = computeMusicalTicks(params);

    const majorTicks = result.ticks.filter((t) => t.type === 'major');
    // Bar indices should be consecutive integers
    for (let i = 1; i < majorTicks.length; i++) {
      expect(majorTicks[i].barIndex).toBe(majorTicks[i - 1].barIndex + 1);
    }
  });

  it('coarse zoom has coarseQuarterNoteStep > 1', () => {
    // pixelsPerQuarterNote = 960 / 5000 = 0.192, * 4 = 0.768 (<8) → 'coarse' zoom
    const params: MusicalTickParams = {
      meterEntries: meterEntries44,
      ticksPerPixel: 5000,
      startPixel: 0,
      endPixel: 1000,
      ppqn: PPQN,
    };
    const result = computeMusicalTicks(params);

    expect(result.zoomLevel).toBe('coarse');
    expect(result.coarseQuarterNoteStep).toBeDefined();
    expect(result.coarseQuarterNoteStep).toBeGreaterThan(1);
  });

  it('includes all levels at sixteenth zoom', () => {
    // pixelsPerSixteenth = 240 / 10 = 24 (≥8) → 'sixteenth' zoom
    const params: MusicalTickParams = {
      meterEntries: meterEntries44,
      ticksPerPixel: 10,
      startPixel: 0,
      endPixel: 500,
      ppqn: PPQN,
    };
    const result = computeMusicalTicks(params);

    expect(result.zoomLevel).toBe('sixteenth');
    const types = new Set(result.ticks.map((t) => t.type));
    expect(types.has('major')).toBe(true);
    expect(types.has('minor')).toBe(true);
    expect(types.has('minorMinor')).toBe(true);
  });

  it('returns correct pixelsPerQuarterNote', () => {
    const params: MusicalTickParams = {
      meterEntries: meterEntries44,
      ticksPerPixel: 100,
      startPixel: 0,
      endPixel: 100,
      ppqn: PPQN,
    };
    const result = computeMusicalTicks(params);

    // pixelsPerQuarterNote = ppqn / ticksPerPixel = 960 / 100 = 9.6
    expect(result.pixelsPerQuarterNote).toBeCloseTo(PPQN / 100);
  });

  it('bar ticks have labels', () => {
    const params: MusicalTickParams = {
      meterEntries: meterEntries44,
      ticksPerPixel: 200,
      startPixel: 0,
      endPixel: 500,
      ppqn: PPQN,
    };
    const result = computeMusicalTicks(params);

    const majorTicks = result.ticks.filter((t) => t.type === 'major');
    majorTicks.forEach((t) => {
      expect(t.label).toBeDefined();
      expect(t.label).not.toBe('');
    });
  });

  it('handles meter change from 4/4 to 3/4', () => {
    const result = computeMusicalTicks({
      meterEntries: [
        { tick: 0, numerator: 4, denominator: 4 },
        { tick: 3840, numerator: 3, denominator: 4 },
      ],
      ticksPerPixel: 100,
      startPixel: 0,
      endPixel: 1000,
      ppqn: 960,
    });
    const majors = result.ticks.filter((t) => t.type === 'major');
    expect(majors.length).toBeGreaterThan(0);
    // Bar 1 at tick 0
    expect(majors[0].pixel).toBeCloseTo(0);
    expect(majors[0].label).toBe('1');
    // Bar 2 at tick 3840 (4/4 bar = 3840 ticks)
    const bar2 = majors.find((t) => Math.abs(t.pixel - 38.4) < 0.1);
    expect(bar2).toBeDefined();
    expect(bar2!.label).toBe('2');
    // Bar 3 at tick 6720 (3840 + 2880 for 3/4 bar)
    const bar3 = majors.find((t) => Math.abs(t.pixel - 67.2) < 0.1);
    expect(bar3).toBeDefined();
    expect(bar3!.label).toBe('3');
  });

  it('handles meter change back and forth (4/4 → 3/4 → 4/4)', () => {
    // Bar 1: 4/4 = 3840 ticks. Bar 2: 3/4 = 2880 ticks. Bar 3: 4/4 = 3840 ticks.
    const result = computeMusicalTicks({
      meterEntries: [
        { tick: 0, numerator: 4, denominator: 4 },
        { tick: 3840, numerator: 3, denominator: 4 },
        { tick: 6720, numerator: 4, denominator: 4 },
      ],
      ticksPerPixel: 100,
      startPixel: 0,
      endPixel: 1200,
      ppqn: 960,
    });
    const majors = result.ticks.filter((t) => t.type === 'major');
    // Bar 1 at tick 0
    expect(majors[0].label).toBe('1');
    // Bar 2 at tick 3840
    const bar2 = majors.find((t) => Math.abs(t.pixel - 38.4) < 0.1);
    expect(bar2).toBeDefined();
    expect(bar2!.label).toBe('2');
    // Bar 3 at tick 6720 (3840 + 2880)
    const bar3 = majors.find((t) => Math.abs(t.pixel - 67.2) < 0.1);
    expect(bar3).toBeDefined();
    expect(bar3!.label).toBe('3');
    // Bar 4 at tick 10560 (6720 + 3840, back to 4/4)
    const bar4 = majors.find((t) => Math.abs(t.pixel - 105.6) < 0.1);
    expect(bar4).toBeDefined();
    expect(bar4!.label).toBe('4');
    // barIndex should be sequential
    const barIndices = majors.map((t) => t.barIndex);
    for (let i = 1; i < barIndices.length; i++) {
      expect(barIndices[i]).toBeGreaterThan(barIndices[i - 1]);
    }
  });
});
