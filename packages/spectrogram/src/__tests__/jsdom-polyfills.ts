// Minimal browser globals that jsdom omits but the waveform-playlist render graph
// references at module-load time (e.g. @dnd-kit/dom's ResizeNotifier). Imported
// FIRST in tests that pull in WaveformPlaylistContext so these exist before the
// transitive module graph evaluates.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof (globalThis as Record<string, unknown>).ResizeObserver === 'undefined') {
  (globalThis as Record<string, unknown>).ResizeObserver = ResizeObserverStub;
}
