import { useRef } from 'react';

/**
 * A counter that goes up each time `value` is a different object from the
 * previous render's.
 *
 * Canvas components fold it into the "draw version" they stamp on each canvas:
 * an array or map can be replaced by one with the same length and contents, and
 * that must still redraw, which a fingerprint of primitives alone cannot see.
 */
export function useIdentityVersion(value: unknown): number {
  const versionRef = useRef(0);
  const previousRef = useRef(value);
  if (previousRef.current !== value) {
    versionRef.current += 1;
    previousRef.current = value;
  }
  return versionRef.current;
}
