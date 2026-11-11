import { useRef } from 'react';

function shallowEqual(a: object, b: object): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  return aKeys.every(
    (key) =>
      Object.prototype.hasOwnProperty.call(bRecord, key) && Object.is(aRecord[key], bRecord[key])
  );
}

/**
 * Returns the previous object while the new one is shallow-equal to it.
 *
 * Consumers usually pass small config objects as inline literals
 * (`controls={{ show: true, width: 200 }}`), which have a new identity on every
 * render of the parent. Passing such a prop through this hook before using it
 * as a `useMemo` dependency keeps the memo from being invalidated by a render
 * in which the object's contents did not change.
 */
export function useShallowStable<T extends object | undefined>(value: T): T {
  const ref = useRef(value);
  const previous = ref.current;
  if (previous !== value) {
    if (previous === undefined || value === undefined || !shallowEqual(previous, value)) {
      ref.current = value;
    }
  }
  return ref.current;
}
