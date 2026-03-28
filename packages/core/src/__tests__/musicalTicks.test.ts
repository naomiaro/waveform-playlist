import { describe, it, expect } from 'vitest';
import { snapToTicks, snapTickToGrid } from '../utils/musicalTicks';
import type { SnapTo } from '../utils/musicalTicks';

const PPQN = 960;

// ---------------------------------------------------------------------------
// snapToTicks — 4/4 at 960 PPQN
// ---------------------------------------------------------------------------
describe('snapToTicks — 4/4 at 960 PPQN', () => {
  const ts: [number, number] = [4, 4];

  it('bar → 3840', () => {
    expect(snapToTicks('bar', ts, PPQN)).toBe(3840);
  });

  it('beat → 960', () => {
    expect(snapToTicks('beat', ts, PPQN)).toBe(960);
  });

  it('1/2 → 1920', () => {
    expect(snapToTicks('1/2', ts, PPQN)).toBe(1920);
  });

  it('1/4 → 960', () => {
    expect(snapToTicks('1/4', ts, PPQN)).toBe(960);
  });

  it('1/8 → 480', () => {
    expect(snapToTicks('1/8', ts, PPQN)).toBe(480);
  });

  it('1/16 → 240', () => {
    expect(snapToTicks('1/16', ts, PPQN)).toBe(240);
  });

  it('1/32 → 120', () => {
    expect(snapToTicks('1/32', ts, PPQN)).toBe(120);
  });

  it('1/2T → 1280', () => {
    expect(snapToTicks('1/2T', ts, PPQN)).toBe(1280);
  });

  it('1/4T → 640', () => {
    expect(snapToTicks('1/4T', ts, PPQN)).toBe(640);
  });

  it('1/8T → 320', () => {
    expect(snapToTicks('1/8T', ts, PPQN)).toBe(320);
  });

  it('1/16T → 160', () => {
    expect(snapToTicks('1/16T', ts, PPQN)).toBe(160);
  });

  it('off → 0', () => {
    expect(snapToTicks('off', ts, PPQN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// snapToTicks — 6/8 at 960 PPQN
// ---------------------------------------------------------------------------
describe('snapToTicks — 6/8 at 960 PPQN', () => {
  const ts: [number, number] = [6, 8];

  // beat = ppqn * (4 / 8) = 480
  // bar  = 6 * 480 = 2880
  it('bar → 2880', () => {
    expect(snapToTicks('bar', ts, PPQN)).toBe(2880);
  });

  it('beat → 480', () => {
    expect(snapToTicks('beat', ts, PPQN)).toBe(480);
  });

  // Straight subdivisions are always relative to a quarter note (ppqn), independent of time sig
  it('1/4 → 960', () => {
    expect(snapToTicks('1/4', ts, PPQN)).toBe(960);
  });

  it('1/8 → 480', () => {
    expect(snapToTicks('1/8', ts, PPQN)).toBe(480);
  });

  it('1/16 → 240', () => {
    expect(snapToTicks('1/16', ts, PPQN)).toBe(240);
  });

  it('off → 0', () => {
    expect(snapToTicks('off', ts, PPQN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// snapToTicks — 3/4 at 960 PPQN
// ---------------------------------------------------------------------------
describe('snapToTicks — 3/4 at 960 PPQN', () => {
  const ts: [number, number] = [3, 4];

  // beat = 960, bar = 3 * 960 = 2880
  it('bar → 2880', () => {
    expect(snapToTicks('bar', ts, PPQN)).toBe(2880);
  });

  it('beat → 960', () => {
    expect(snapToTicks('beat', ts, PPQN)).toBe(960);
  });

  it('1/4 → 960', () => {
    expect(snapToTicks('1/4', ts, PPQN)).toBe(960);
  });

  it('1/8 → 480', () => {
    expect(snapToTicks('1/8', ts, PPQN)).toBe(480);
  });

  it('1/4T → 640', () => {
    expect(snapToTicks('1/4T', ts, PPQN)).toBe(640);
  });

  it('off → 0', () => {
    expect(snapToTicks('off', ts, PPQN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// snapTickToGrid
// ---------------------------------------------------------------------------
describe('snapTickToGrid', () => {
  const ts: [number, number] = [4, 4];

  it('snaps to nearest beat (960)', () => {
    // 500 is closer to 960 than to 0 — rounds to 960
    expect(snapTickToGrid(500, 'beat', ts, PPQN)).toBe(960);
  });

  it('snaps down to nearest beat', () => {
    // 400 is closer to 0 than to 960 — rounds to 0
    expect(snapTickToGrid(400, 'beat', ts, PPQN)).toBe(0);
  });

  it('snaps down to nearest bar when closer to 0', () => {
    // 1900 / 3840 = 0.495 → rounds to 0
    expect(snapTickToGrid(1900, 'bar', ts, PPQN)).toBe(0);
  });

  it('snaps up to nearest bar', () => {
    // 2000 when bar=3840 → 2000/3840=0.52 → rounds to 1 → 3840
    expect(snapTickToGrid(2100, 'bar', ts, PPQN)).toBe(3840);
  });

  it('snaps to nearest 1/16 (240)', () => {
    // 250 / 240 = 1.04 → rounds to 1 → 240
    expect(snapTickToGrid(250, '1/16', ts, PPQN)).toBe(240);
  });

  it('snaps to nearest 1/4T (640)', () => {
    // 650 / 640 = 1.015 → rounds to 1 → 640
    expect(snapTickToGrid(650, '1/4T', ts, PPQN)).toBe(640);
  });

  it('off — returns tick unchanged', () => {
    expect(snapTickToGrid(777, 'off', ts, PPQN)).toBe(777);
  });

  it('zero tick returns zero', () => {
    expect(snapTickToGrid(0, 'beat', ts, PPQN)).toBe(0);
  });

  it('tick already on grid returns same value', () => {
    expect(snapTickToGrid(1920, '1/2', ts, PPQN)).toBe(1920);
  });
});
