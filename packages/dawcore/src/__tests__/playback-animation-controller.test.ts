import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlaybackAnimationController } from '../controllers/playback-animation-controller';

describe('PlaybackAnimationController', () => {
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

  function makeHost() {
    const dispatchEvent = vi.fn();
    const host = {
      addController: vi.fn(),
      dispatchEvent,
    } as any;
    return { host, dispatchEvent };
  }

  it('positions the playhead and dispatches daw-timeupdate each frame', () => {
    const { host, dispatchEvent } = makeHost();
    const setPosition = vi.fn();
    const controller = new PlaybackAnimationController(host, {
      timeToPixels: (t) => t * 100,
      getPlayhead: () => ({ setPosition }),
    });

    controller.start(() => 1.5);
    rafCallbacks[0](16);

    expect(setPosition).toHaveBeenCalledWith(150);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    const event = dispatchEvent.mock.calls[0][0] as CustomEvent;
    expect(event.type).toBe('daw-timeupdate');
    expect(event.detail).toEqual({ time: 1.5 });
  });

  it('does not dispatch a trailing daw-timeupdate for a frame whose getTime() callback called stop() mid-frame', () => {
    // Mirrors the editor's auto-stop paths (end-of-timeline, bounded
    // play(start, end)): the frame callback (`getTime`) itself calls
    // controller.stop(finalTime), which synchronously dispatches its own
    // settle daw-timeupdate. The rAF wrapper must not dispatch a second,
    // stale one for the same frame afterward.
    const { host, dispatchEvent } = makeHost();
    const setPosition = vi.fn();
    const controller = new PlaybackAnimationController(host, {
      timeToPixels: (t) => t * 100,
      getPlayhead: () => ({ setPosition }),
    });

    controller.start(() => {
      // Simulate the editor's in-frame auto-stop: stop() dispatches its own
      // settle event at the resting position (0), distinct from the raw
      // playing time this callback would otherwise return.
      controller.stop(0);
      return 9.99;
    });
    rafCallbacks[0](16);

    // Exactly one dispatch: the settle event from stop(0), never a trailing
    // one from the frame wrapper using the stale return value (9.99).
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    const event = dispatchEvent.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ time: 0 });

    // setPosition is called once too — by stop(), not a second time by the
    // frame wrapper with the stale 9.99 value.
    expect(setPosition).toHaveBeenCalledTimes(1);
    expect(setPosition).toHaveBeenCalledWith(0);
  });

  it('manual stop() still dispatches its settle daw-timeupdate (unaffected by the in-frame guard)', () => {
    const { host, dispatchEvent } = makeHost();
    const setPosition = vi.fn();
    const controller = new PlaybackAnimationController(host, {
      timeToPixels: (t) => t * 100,
      getPlayhead: () => ({ setPosition }),
    });

    controller.start(() => 2);
    rafCallbacks[0](16);
    dispatchEvent.mockClear();
    setPosition.mockClear();

    controller.stop(3.25);

    expect(setPosition).toHaveBeenCalledWith(325);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    const event = dispatchEvent.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toEqual({ time: 3.25 });
  });
});
