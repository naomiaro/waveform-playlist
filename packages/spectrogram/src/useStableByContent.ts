import { useMemo } from 'react';

/**
 * The value as it was the last time its JSON content changed. For plain-data
 * props an app often writes inline (`config={{ fftSize: 2048 }}`): a new
 * object with the same content keeps the old one, so the context value and
 * the effects that depend on it do not change on every render of the app
 * (#821). Only for values JSON describes completely (no functions, no class
 * instances); a key whose value is `undefined` counts as absent.
 */
export function useStableByContent<T>(value: T): T {
  const content = JSON.stringify(value);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the content, not the identity
  return useMemo(() => value, [content]);
}
