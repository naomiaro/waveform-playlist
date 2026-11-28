// Mounts a hook inside an <Activity>, so a test can hide and show it: a hide
// runs the hook's effect cleanups and keeps its state, as Fast Refresh does.
import { Activity } from 'react';
import { render } from '@testing-library/react';

export function renderHookInActivity<T>(useHook: () => T) {
  const latest: { value: T | undefined } = { value: undefined };
  const Probe = () => {
    latest.value = useHook();
    return null;
  };
  const tree = (mode: 'visible' | 'hidden') => (
    <Activity mode={mode}>
      <Probe />
    </Activity>
  );
  const view = render(tree('visible'));
  return {
    result: {
      get current(): T {
        return latest.value as T;
      },
    },
    hide: () => view.rerender(tree('hidden')),
    show: () => view.rerender(tree('visible')),
    unmount: () => view.unmount(),
  };
}
