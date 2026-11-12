import { useCallback, useRef } from 'react';

/** Per-frame data passed to registered animation callbacks. */
export interface FrameData {
  /** Raw engine time (for state/logic — NOT for visual positioning). */
  readonly time: number;
  /** Visually-aligned time for DOM positioning: engine.getAudibleTime() while
   *  playing (matches speaker output), raw time when resting. */
  readonly visualTime: number;
  readonly sampleRate: number;
  readonly samplesPerPixel: number;
}

export type FrameCallback = (data: FrameData) => void;

export interface FrameCallbacks {
  /** Register a per-frame callback. A second registration under the same id replaces the first. */
  registerFrameCallback: (id: string, cb: FrameCallback) => void;
  unregisterFrameCallback: (id: string) => void;
  /** For the provider's animation loop: call every registered callback. */
  runFrameCallbacks: (data: FrameData) => void;
}

/**
 * The frame-callback registry of a provider. Components that draw during
 * playback register a callback instead of running their own
 * `requestAnimationFrame` loop; the provider's one loop calls them all with
 * the time it read for that frame. All three functions are stable.
 */
export function useFrameCallbacks(): FrameCallbacks {
  const callbacksRef = useRef<Map<string, FrameCallback>>(new Map());

  const registerFrameCallback = useCallback((id: string, cb: FrameCallback) => {
    callbacksRef.current.set(id, cb);
  }, []);

  const unregisterFrameCallback = useCallback((id: string) => {
    callbacksRef.current.delete(id);
  }, []);

  const runFrameCallbacks = useCallback((data: FrameData) => {
    for (const cb of callbacksRef.current.values()) {
      cb(data);
    }
  }, []);

  return { registerFrameCallback, unregisterFrameCallback, runFrameCallbacks };
}
