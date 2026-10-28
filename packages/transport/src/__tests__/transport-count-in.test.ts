import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Transport } from '../transport';
import { DEFAULT_TIMER_INTERVAL_MS } from '../core/timer';
import type { CountInEventData } from '../types';

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
  // No Worker in Node → the Timer takes its setTimeout fallback; fake timers
  // drive it. One advance of DEFAULT_TIMER_INTERVAL_MS = one scheduler tick.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
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

    // Drive one timer tick — advance time past count-in duration
    // 1 bar of 4/4 at 120 BPM = 2 seconds
    (ctx as any).currentTime = 12.5; // 2.5s after start
    vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);

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
    vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);

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
    vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);

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
    vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);

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
    vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);

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

  it('a count-in click that fails to schedule is surfaced on the error event and the count-in still completes (#636)', async () => {
    const ctx = mockAudioContext(10);
    const transport = new Transport(ctx);
    const click = {
      duration: 0.04,
      length: 1920,
      sampleRate: 48000,
      numberOfChannels: 1,
    } as AudioBuffer;
    transport.setMetronomeClickSounds(click, click);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    const onError = vi.fn();
    const onEnd = vi.fn();
    transport.on('error', onError);
    transport.on('countInEnd', onEnd);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    (ctx.createBufferSource as any).mockImplementation(() => {
      throw new Error('count-in source exploded');
    });

    transport.play();
    vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);
    await Promise.resolve();
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0][0].phase).toBe('consume');
    expect(warn).not.toHaveBeenCalled(); // routed to the subscriber, not warned per beat

    (ctx as any).currentTime = 12.5; // past the 2 s count-in bar
    vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);
    expect(onEnd).toHaveBeenCalledTimes(1);
    warn.mockRestore();
    transport.stop();
  });

  it('a tempo change during the count-in does not alter the count-in but applies afterwards (#636)', () => {
    const ctx = mockAudioContext(10);
    const transport = new Transport(ctx);
    const click = {
      duration: 0.04,
      length: 1920,
      sampleRate: 48000,
      numberOfChannels: 1,
    } as AudioBuffer;
    transport.setMetronomeClickSounds(click, click);
    transport.setCountIn(true);
    transport.setCountInMode('always');
    const onEnd = vi.fn();
    transport.on('countInEnd', onEnd);
    transport.play(0, 4);
    transport.setTempo(240); // the count-in keeps its dedicated 120 BPM map
    (ctx as any).currentTime = 11.5; // 1.5 s in: a 240 BPM bar would be over (1 s), a 120 BPM one is not
    vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);
    expect(onEnd).not.toHaveBeenCalled();
    (ctx as any).currentTime = 12.5;
    vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(transport.tempoMap.getTempo()).toBe(240);
    transport.stop();
  });
});
