import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnimationController } from '../controllers/animation-controller';

describe('AnimationController', () => {
  let rafCallbacks: Array<(time: number) => void>;

  beforeEach(() => {
    rafCallbacks = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: (time: number) => void) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      })
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls callback on each animation frame', () => {
    const callback = vi.fn();
    const host = { addController: vi.fn() } as any;
    const controller = new AnimationController(host);

    controller.start(callback);
    expect(rafCallbacks.length).toBe(1);

    rafCallbacks[0](16);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('stops the animation loop', () => {
    const callback = vi.fn();
    const host = { addController: vi.fn() } as any;
    const controller = new AnimationController(host);

    controller.start(callback);
    controller.stop();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('cleans up on hostDisconnected', () => {
    const callback = vi.fn();
    const host = { addController: vi.fn() } as any;
    const controller = new AnimationController(host);

    controller.start(callback);
    controller.hostDisconnected();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
