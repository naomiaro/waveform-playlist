import { describe, it, expect } from 'vitest';
import { Clock } from '../core/clock';

function mockAudioContext(currentTime = 0): AudioContext {
  return { currentTime } as any;
}

describe('Clock', () => {
  it('getTime returns 0 when not started', () => {
    const ctx = mockAudioContext(10);
    const clock = new Clock(ctx);
    expect(clock.getTime()).toBe(0);
  });

  it('getTime returns elapsed time when running', () => {
    const ctx = mockAudioContext(10);
    const clock = new Clock(ctx);
    clock.start();
    (ctx as any).currentTime = 12;
    expect(clock.getTime()).toBe(2);
  });

  it('stop accumulates elapsed time', () => {
    const ctx = mockAudioContext(10);
    const clock = new Clock(ctx);
    clock.start();
    (ctx as any).currentTime = 13;
    clock.stop();
    // After stop, time is frozen at 3
    (ctx as any).currentTime = 20;
    expect(clock.getTime()).toBe(3);
  });

  it('start after stop resumes from accumulated time', () => {
    const ctx = mockAudioContext(10);
    const clock = new Clock(ctx);
    clock.start();
    (ctx as any).currentTime = 13;
    clock.stop(); // accumulated: 3
    (ctx as any).currentTime = 20;
    clock.start(); // resume from 3
    (ctx as any).currentTime = 22;
    expect(clock.getTime()).toBe(5); // 3 accumulated + 2 new
  });

  it('reset zeros everything', () => {
    const ctx = mockAudioContext(10);
    const clock = new Clock(ctx);
    clock.start();
    (ctx as any).currentTime = 15;
    clock.reset();
    expect(clock.getTime()).toBe(0);
    expect(clock.isRunning()).toBe(false);
  });

  it('seekTo jumps to arbitrary position', () => {
    const ctx = mockAudioContext(10);
    const clock = new Clock(ctx);
    clock.start();
    clock.seekTo(5);
    (ctx as any).currentTime = 12;
    expect(clock.getTime()).toBe(7); // 5 + 2 elapsed since seek
  });

  it('seekTo while stopped sets position for next start', () => {
    const ctx = mockAudioContext(10);
    const clock = new Clock(ctx);
    clock.seekTo(5);
    expect(clock.getTime()).toBe(5);
    clock.start();
    (ctx as any).currentTime = 12;
    expect(clock.getTime()).toBe(7);
  });

  it('toAudioTime converts transport time to AudioContext time', () => {
    const ctx = mockAudioContext(100);
    const clock = new Clock(ctx);
    clock.start();
    (ctx as any).currentTime = 102;
    // Transport time is 2.0. Event at transport time 2.5 is 0.5s in the future.
    // AudioContext time for that event = 102 + (2.5 - 2.0) = 102.5
    expect(clock.toAudioTime(2.5)).toBeCloseTo(102.5);
  });

  it('toAudioTime works after seek', () => {
    const ctx = mockAudioContext(100);
    const clock = new Clock(ctx);
    clock.start();
    clock.seekTo(10); // jump to transport time 10
    (ctx as any).currentTime = 101;
    // Transport time is 11.0 (10 + 1 elapsed). Event at 11.5 is 0.5s ahead.
    // AudioContext time = 101 + (11.5 - 11.0) = 101.5
    expect(clock.toAudioTime(11.5)).toBeCloseTo(101.5);
  });

  it('isRunning reflects state', () => {
    const ctx = mockAudioContext(0);
    const clock = new Clock(ctx);
    expect(clock.isRunning()).toBe(false);
    clock.start();
    expect(clock.isRunning()).toBe(true);
    clock.stop();
    expect(clock.isRunning()).toBe(false);
  });
});
