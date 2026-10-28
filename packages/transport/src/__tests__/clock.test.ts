import { describe, it, expect } from 'vitest';
import { Clock } from '../core/clock';
import type { ContextFrame, Sample } from '../types';

function mockAudioContext(currentTime = 0): AudioContext {
  return { currentTime, sampleRate: 48000 } as any;
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

describe('Clock frame lattice (#636)', () => {
  const RATE = 48000;
  const QUANTUM = 128;
  function ctxAt(frames: number): AudioContext {
    return { currentTime: frames / RATE, sampleRate: RATE } as unknown as AudioContext;
  }
  function setFrames(ctx: AudioContext, frames: number): void {
    (ctx as unknown as { currentTime: number }).currentTime = frames / RATE;
  }

  it('getFrame returns integer context frames and getTime is derived from them', () => {
    const ctx = ctxAt(QUANTUM * 1000);
    const clock = new Clock(ctx);
    clock.start();
    setFrames(ctx, QUANTUM * 1000 + QUANTUM * 375); // 48000 frames = 1 s later
    expect(clock.getFrame()).toBe(48000);
    expect(Number.isInteger(clock.getFrame())).toBe(true);
    expect(clock.getTime()).toBe(1);
  });

  it('snaps a context reading to the 128-frame render quantum lattice', () => {
    // currentTime is a quantum multiple by spec; float noise on the way in and
    // out must not produce a fractional frame or an off-by-one.
    const ctx = ctxAt(0);
    const clock = new Clock(ctx);
    clock.start();
    (ctx as unknown as { currentTime: number }).currentTime = (QUANTUM * 3) / RATE + 1e-12;
    expect(clock.getFrame()).toBe(QUANTUM * 3);
    (ctx as unknown as { currentTime: number }).currentTime = (QUANTUM * 3) / RATE - 1e-12;
    expect(clock.getFrame()).toBe(QUANTUM * 3);
  });

  it('seekToFrame places the position on an exact frame; getTime follows', () => {
    const ctx = ctxAt(0);
    const clock = new Clock(ctx);
    clock.seekToFrame(12345 as ContextFrame);
    expect(clock.getFrame()).toBe(12345);
    expect(clock.getTime()).toBeCloseTo(12345 / RATE, 15);
    clock.start();
    setFrames(ctx, QUANTUM * 10);
    expect(clock.getFrame()).toBe(12345 + QUANTUM * 10);
  });

  it('seekTo keeps sub-frame precision in getTime while getFrame rounds', () => {
    const ctx = ctxAt(0);
    const clock = new Clock(ctx);
    clock.seekTo(0.00001); // 0.48 frames
    expect(clock.getTime()).toBeCloseTo(0.00001, 15);
    expect(clock.getFrame()).toBe(0);
    expect(clock.getFrameExact()).toBeCloseTo(0.48, 10);
  });

  it('a backward re-based context reading holds the position instead of jumping back', () => {
    const ctx = ctxAt(QUANTUM * 1000);
    const clock = new Clock(ctx);
    clock.start();
    setFrames(ctx, QUANTUM * 1000 + 24000); // +0.5 s
    expect(clock.getTime()).toBeCloseTo(0.5, 12);
    setFrames(ctx, QUANTUM * 1000 + 9600); // context re-based backwards by 0.3 s
    expect(clock.getTime()).toBeCloseTo(0.5, 12); // held
    expect(clock.rebaseCount).toBe(1);
    setFrames(ctx, QUANTUM * 1000 + 14400); // advances 0.1 s from the re-based reading
    expect(clock.getTime()).toBeCloseTo(0.6, 12);
  });

  it('a stalled context reading freezes the position (no drift, no jump)', () => {
    const ctx = ctxAt(0);
    const clock = new Clock(ctx);
    clock.start();
    setFrames(ctx, 48000);
    expect(clock.getTime()).toBe(1);
    const when = clock.toAudioTime(2.5);
    // The context stalls: reads keep returning the same frame.
    expect(clock.getTime()).toBe(1);
    expect(clock.getFrame()).toBe(48000);
    expect(clock.toAudioTime(2.5)).toBe(when); // a stall is not a re-base: nothing is re-anchored
    expect(clock.rebaseCount).toBe(0);
  });

  it('toAudioTime is anchored, not re-read: raw currentTime noise cannot shift scheduled events', () => {
    const ctx = ctxAt(QUANTUM * 100);
    const clock = new Clock(ctx);
    clock.start();
    clock.seekTo(10);
    const expected = clock.toAudioTime(11.5);
    (ctx as unknown as { currentTime: number }).currentTime += 1e-9; // sub-quantum noise
    expect(clock.toAudioTime(11.5)).toBe(expected);
  });

  it('rejects a context without a finite positive sampleRate at construction', () => {
    // A `{ currentTime }`-only mock used to work (the Clock never read the
    // rate); now every position would be NaN and bounded playback never ends.
    expect(() => new Clock({ currentTime: 0 } as unknown as AudioContext)).toThrow(/sampleRate/);
    expect(() => new Clock({ currentTime: 0, sampleRate: 0 } as unknown as AudioContext)).toThrow(
      /sampleRate/
    );
  });

  it.each([NaN, Infinity, -Infinity])('rejects a non-finite seek (%s)', (bad) => {
    const clock = new Clock(ctxAt(0));
    expect(() => clock.seekTo(bad)).toThrow(/finite/);
    expect(() => clock.seekToFrame(bad as ContextFrame)).toThrow(/finite/);
    expect(clock.getTime()).toBe(0);
  });

  it('a seconds seek round-trips bit-exactly through getTime, stopped and running', () => {
    // (0.031 × 44100) / 44100 !== 0.031 in doubles (about 12% of millisecond
    // positions at 44.1 kHz); the seconds a caller compares with >= / ===
    // elsewhere must come back unchanged.
    const t = 0.031;
    expect((t * 44100) / 44100).not.toBe(t); // the premise
    const ctx = { currentTime: 0, sampleRate: 44100 } as unknown as AudioContext;
    const clock = new Clock(ctx);
    clock.seekTo(t);
    expect(clock.getTime()).toBe(t);
    clock.start();
    expect(clock.getTime()).toBe(t);
    clock.stop();
    expect(clock.getTime()).toBe(t);
    clock.start();
    (ctx as unknown as { currentTime: number }).currentTime = QUANTUM / 44100;
    expect(clock.getTime()).toBeCloseTo(t + QUANTUM / 44100, 15);
  });

  it('secondsToFrame rounds once at the ContextFrame boundary', () => {
    const clock = new Clock(ctxAt(0));
    expect(clock.secondsToFrame(0.5)).toBe(24000);
    expect(clock.secondsToFrame(0.00001)).toBe(0); // 0.48 frames
    expect(clock.secondsToFrame(0.0000105)).toBe(1); // 0.504 frames
  });

  it('context frames are a distinct brand from timeline Samples', () => {
    const clock = new Clock(ctxAt(0));
    const timelineSample = 5 as Sample;
    // @ts-expect-error — a SampleTimeline sample (option rate) is not a context frame
    clock.seekToFrame(timelineSample);
    const frame: ContextFrame = clock.getFrame();
    // @ts-expect-error — and a context frame is not a timeline sample
    const asSample: Sample = frame;
    expect(asSample).toBe(5);
  });

  it('stopped toAudioTime uses the same snapped reading as the running branch', () => {
    const ctx = ctxAt(QUANTUM * 3);
    const clock = new Clock(ctx);
    (ctx as unknown as { currentTime: number }).currentTime = (QUANTUM * 3) / RATE + 1e-12;
    expect(clock.toAudioTime(1)).toBe((QUANTUM * 3) / RATE + 1);
  });

  it('a backward reading is absorbed once, whichever reader sees it first', () => {
    const ctx = ctxAt(QUANTUM * 1000);
    const clock = new Clock(ctx);
    clock.start();
    setFrames(ctx, QUANTUM * 1000 + 24000);
    clock.getFrame();
    setFrames(ctx, QUANTUM * 1000 + 9600);
    const a = clock.getTime(); // "UI" reader
    const b = clock.getFrameExact(); // "timer" reader
    expect(a).toBeCloseTo(0.5, 12);
    expect(b).toBe(24000);
    expect(clock.rebaseCount).toBe(1);
    expect(clock.lastRebaseFrames).toBe(14400); // 0.3 s at 48 kHz
  });

  it('the seconds and frame views stay consistent across many pause/resume cycles', () => {
    // One integer accumulator for elapsed frames: getTime() is the exact seek
    // target plus (total elapsed) / rate, not a thousand accumulated float adds.
    const RATE44 = 44100;
    const ctx = { currentTime: 0, sampleRate: RATE44 } as unknown as AudioContext;
    const clock = new Clock(ctx);
    clock.seekTo(0.031);
    let frames = 0;
    for (let i = 0; i < 1000; i++) {
      clock.start();
      frames += QUANTUM;
      (ctx as unknown as { currentTime: number }).currentTime = frames / RATE44;
      clock.stop();
    }
    expect(clock.getFrameExact()).toBe(0.031 * RATE44 + 128000);
    expect(clock.getTime()).toBe(0.031 + 128000 / RATE44);
  });

  it('seekToFrame rounds a fractional frame at the boundary', () => {
    const clock = new Clock(ctxAt(0));
    clock.seekToFrame(12345.4 as ContextFrame);
    expect(clock.getFrameExact()).toBe(12345);
    expect(clock.getTime()).toBe(12345 / RATE);
  });

  it('frameToSeconds is the inverse view of secondsToFrame', () => {
    const clock = new Clock(ctxAt(0));
    expect(clock.frameToSeconds(24000 as ContextFrame)).toBe(0.5);
    expect(clock.frameToSeconds(clock.secondsToFrame(1.25))).toBe(1.25);
  });

  it('a when computed just before start() equals one computed just after', () => {
    const ctx = ctxAt(QUANTUM * 100);
    const clock = new Clock(ctx);
    clock.seekTo(0.031);
    const before = clock.toAudioTime(1);
    clock.start();
    expect(clock.toAudioTime(1)).toBe(before);
  });

  it('exposes the context sample rate the lattice is measured in', () => {
    expect(new Clock(ctxAt(0)).sampleRate).toBe(RATE);
  });
});
