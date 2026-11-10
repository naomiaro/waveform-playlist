import { vi } from 'vitest';

/**
 * Raise the default ceiling of `vi.waitFor` for this package's tests.
 *
 * vitest's default is 1 s. Editor tests wait on work that crosses several
 * async hops (MutationObserver callbacks, deferred element events, mocked
 * decode and peak generation), and on a loaded CI runner one of those waits
 * occasionally took longer — failing a different test each time with nothing
 * actually wrong (e.g. `daw-editor-reorder.test.ts` on 2026-11-10, in a run
 * where the same commit passed in the sibling job).
 *
 * A polling wait returns as soon as its condition holds, so a generous
 * ceiling costs nothing on a fast machine. Calls that pass their own timeout
 * keep it.
 */
const DEFAULT_WAIT_TIMEOUT_MS = 10_000;

const originalWaitFor = vi.waitFor.bind(vi);

vi.waitFor = ((callback, options) => {
  if (typeof options === 'number') {
    return originalWaitFor(callback, options);
  }
  return originalWaitFor(callback, { timeout: DEFAULT_WAIT_TIMEOUT_MS, ...options });
}) as typeof vi.waitFor;
