/**
 * `viewport-ready` fires at most once per `(generation, trackId)` pair after
 * the viewport-tier FFT completes. Generation bumps (setViewport with a real
 * change, setConfig, setColorMap, setDevicePixelRatio) reset the dispatched-set
 * so the event re-fires on the next render. The `generation` field lets
 * consumers correlate ready events to their own state.
 */
export interface ViewportReadyDetail {
  readonly trackId: string;
  readonly generation: number;
}

/**
 * `viewport-error` fires when a render (FFT compute, chunk render, or worker
 * crash) fails for non-abort reasons. AbortError / SpectrogramAbortError are
 * NOT surfaced here — they are part of the normal generation-bump flow.
 */
export interface ViewportErrorDetail {
  readonly trackId: string;
  readonly generation: number;
  readonly error: Error;
}

export type SpectrogramOrchestratorEventMap = {
  'viewport-ready': CustomEvent<ViewportReadyDetail>;
  'viewport-error': CustomEvent<ViewportErrorDetail>;
};
