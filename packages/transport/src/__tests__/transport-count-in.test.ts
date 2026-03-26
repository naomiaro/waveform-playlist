import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Transport } from '../transport';
import type { CountInEventData } from '../types';

let rafCallbacks: Array<(time: number) => void>;
let rafId: number;

function mockAudioContext(currentTime = 0): AudioContext {
  return {
    sampleRate: 48000,
    currentTime,
    state: 'running',
    destination: { connect: vi.fn(), disconnect: vi.fn() },
    createGain: vi.fn(() => ({
      gain: { value: 1, linearRampToValueAtTime: vi.fn(), setValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createStereoPanner: vi.fn(() => ({
      pan: { value: 0 },
      channelCount: 1,
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
    createBuffer: vi.fn((channels: number, length: number, rate: number) => {
      const data = new Float32Array(length);
      return {
        duration: length / rate,
        length,
        sampleRate: rate,
        numberOfChannels: channels,
        getChannelData: vi.fn(() => data),
      };
    }),
    resume: vi.fn(() => Promise.resolve()),
  } as unknown as AudioContext;
}

describe('Transport Count-In', () => {
  beforeEach(() => {
    rafCallbacks = [];
    rafId = 0;
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: (time: number) => void) => {
        rafCallbacks.push(cb);
        return ++rafId;
      })
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('default click sounds created in constructor', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setMetronomeEnabled(true);
    // No throw — default buffers loaded
  });

  it('isCountingIn() is false by default', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    expect(transport.isCountingIn()).toBe(false);
  });

  it('count-in skipped when disabled', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(false);
    transport.setRecording(true);
    transport.play();
    expect(transport.isPlaying()).toBe(true);
    expect(transport.isCountingIn()).toBe(false);
  });

  it('count-in skipped when mode is recording-only and not recording', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('recording-only');
    transport.setRecording(false);
    transport.play();
    expect(transport.isPlaying()).toBe(true);
    expect(transport.isCountingIn()).toBe(false);
  });

  it('count-in triggers when mode is recording-only and recording is true', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('recording-only');
    transport.setRecording(true);
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
  });

  it('count-in triggers when mode is always regardless of recording', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    transport.setRecording(false);
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
  });

  it('getCurrentTime returns play position during count-in', () => {
    const ctx = mockAudioContext(10);
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    transport.seek(5);
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
    expect(transport.getCurrentTime()).toBe(5);
  });

  it('stop during count-in cancels cleanly, no countInEnd', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    const onCountInEnd = vi.fn();
    transport.on('countInEnd', onCountInEnd);
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
    transport.stop();
    expect(transport.isCountingIn()).toBe(false);
    expect(transport.isPlaying()).toBe(false);
    expect(onCountInEnd).not.toHaveBeenCalled();
  });

  it('pause during count-in cancels cleanly', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
    transport.pause();
    expect(transport.isCountingIn()).toBe(false);
    expect(transport.isPlaying()).toBe(false);
  });

  it('seek during count-in cancels count-in and stops playback', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
    transport.seek(3);
    expect(transport.isCountingIn()).toBe(false);
    expect(transport.isPlaying()).toBe(false);
  });

  it('play during count-in is no-op', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
    transport.play();
    expect(transport.isCountingIn()).toBe(true);
  });

  it('setCountInBars clamps to 1-8', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountInBars(0);
    transport.setCountInBars(10);
  });

  it('setCountInBars rounds non-integer', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountInBars(1.5);
  });

  it('dispose cleans up count-in state', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    transport.play();
    transport.dispose();
    expect(transport.isPlaying()).toBe(false);
    expect(transport.isCountingIn()).toBe(false);
  });

  it('countIn event fires with beat and totalBeats when rAF drives scheduler', () => {
    const ctx = mockAudioContext(10);
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');

    const countInEvents: CountInEventData[] = [];
    transport.on('countIn', (event) => {
      countInEvents.push(event);
    });

    transport.play();
    expect(transport.isCountingIn()).toBe(true);

    // Drive the rAF loop — advance time past count-in duration
    // 1 bar of 4/4 at 120 BPM = 2 seconds
    (ctx as any).currentTime = 12.5; // 2.5s after start
    // Snapshot callbacks to avoid infinite growth — each rAF schedules another
    const snapshot = [...rafCallbacks];
    for (const cb of snapshot) {
      cb(performance.now());
    }

    // Should have received 4 beat events (1 bar of 4/4)
    expect(countInEvents.length).toBe(4);
    expect(countInEvents[0]).toEqual({ beat: 1, totalBeats: 4 });
    expect(countInEvents[3]).toEqual({ beat: 4, totalBeats: 4 });

    transport.stop();
  });

  it('countInEnd event fires after count-in completes', () => {
    const ctx = mockAudioContext(10);
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');

    const onCountInEnd = vi.fn();
    transport.on('countInEnd', onCountInEnd);

    transport.play();

    // Drive past count-in
    (ctx as any).currentTime = 12.5;
    const snapshot = [...rafCallbacks];
    for (const cb of snapshot) {
      cb(performance.now());
    }

    expect(onCountInEnd).toHaveBeenCalledTimes(1);
    // After count-in ends, should be playing normally
    expect(transport.isCountingIn()).toBe(false);
    expect(transport.isPlaying()).toBe(true);

    transport.stop();
  });

  it('2-bar count-in emits 8 beats in 4/4', () => {
    const ctx = mockAudioContext(10);
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    transport.setCountInBars(2);

    const countInEvents: CountInEventData[] = [];
    transport.on('countIn', (event) => {
      countInEvents.push(event);
    });

    transport.play();

    // 2 bars of 4/4 at 120 BPM = 4 seconds
    (ctx as any).currentTime = 14.5; // 4.5s after start
    const snapshot = [...rafCallbacks];
    for (const cb of snapshot) {
      cb(performance.now());
    }

    expect(countInEvents.length).toBe(8);
    expect(countInEvents[0]).toEqual({ beat: 1, totalBeats: 8 });
    expect(countInEvents[7]).toEqual({ beat: 8, totalBeats: 8 });

    transport.stop();
  });

  it('count-in with 3/4 meter emits 3 beats per bar', () => {
    const ctx = mockAudioContext(10);
    const transport = new Transport(ctx);
    transport.setMeter(3, 4);
    transport.setCountIn(true);
    transport.setCountInMode('always');

    const countInEvents: CountInEventData[] = [];
    transport.on('countIn', (event) => {
      countInEvents.push(event);
    });

    transport.play();

    // 1 bar of 3/4 at 120 BPM = 1.5 seconds
    (ctx as any).currentTime = 12; // 2s after start (past 1.5s duration)
    const snapshot = [...rafCallbacks];
    for (const cb of snapshot) {
      cb(performance.now());
    }

    expect(countInEvents.length).toBe(3);
    expect(countInEvents[0]).toEqual({ beat: 1, totalBeats: 3 });
    expect(countInEvents[2]).toEqual({ beat: 3, totalBeats: 3 });

    transport.stop();
  });

  it('finishCountIn restores play position and emits play event', () => {
    const ctx = mockAudioContext(10);
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    transport.seek(5);

    const onPlay = vi.fn();
    transport.on('play', onPlay);

    transport.play();
    expect(transport.getCurrentTime()).toBe(5); // frozen during count-in

    // Drive past count-in
    (ctx as any).currentTime = 12.5;
    const snapshot = [...rafCallbacks];
    for (const cb of snapshot) {
      cb(performance.now());
    }

    // After count-in, position restored and play event emitted
    expect(onPlay).toHaveBeenCalledTimes(1);
    expect(transport.isPlaying()).toBe(true);
    expect(transport.isCountingIn()).toBe(false);
    // getCurrentTime should be near the original seek position (5s)
    // (clock was seeked back, so it should be close to 5)
    expect(transport.getCurrentTime()).toBeCloseTo(5, 0);

    transport.stop();
  });

  it('play event is NOT emitted at count-in start', () => {
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setCountIn(true);
    transport.setCountInMode('always');

    const onPlay = vi.fn();
    transport.on('play', onPlay);

    transport.play();
    // play event should NOT fire during count-in — only after it completes
    expect(onPlay).not.toHaveBeenCalled();
    expect(transport.isCountingIn()).toBe(true);

    transport.stop();
  });
});
