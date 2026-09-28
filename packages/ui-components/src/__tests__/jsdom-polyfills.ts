// Minimal browser globals that jsdom omits but @dnd-kit/dom references at
// module-load time (ResizeNotifier). Import FIRST in tests that mount
// dnd-kit-backed components so these exist before the module graph evaluates.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof (globalThis as Record<string, unknown>).ResizeObserver === 'undefined') {
  (globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverStub;
}
