import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Timer } from '../core/timer';

describe('Timer', () => {
  let rafCallbacks: Array<(time: number) => void>;
  let rafId: number;

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

  it('calls onTick on each animation frame', () => {
    const onTick = vi.fn();
    const timer = new Timer(onTick);
    timer.start();

    expect(rafCallbacks.length).toBe(1);
    rafCallbacks[0](16);
    expect(onTick).toHaveBeenCalledTimes(1);
    // rAF should be re-requested
    expect(rafCallbacks.length).toBe(2);
  });

  it('stop cancels animation frame', () => {
    const onTick = vi.fn();
    const timer = new Timer(onTick);
    timer.start();
    timer.stop();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('does not tick after stop', () => {
    const onTick = vi.fn();
    const timer = new Timer(onTick);
    timer.start();
    timer.stop();
    // Simulate late rAF callback
    if (rafCallbacks.length > 0) rafCallbacks[0](16);
    expect(onTick).not.toHaveBeenCalled();
  });

  it('start is idempotent', () => {
    const onTick = vi.fn();
    const timer = new Timer(onTick);
    timer.start();
    timer.start();
    expect(rafCallbacks.length).toBe(1);
  });
});
