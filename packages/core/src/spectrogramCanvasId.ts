/**
 * Canonical spectrogram canvas-ID contract.
 *
 * Spectrogram canvases are identified by `${clipId}-ch${channelIndex}-chunk${chunkIndex}`.
 * This format is produced (builders) and consumed (parsers) by several packages
 * — the React `SpectrogramProvider`/`SpectrogramChannel`, the `<daw-spectrogram>`
 * Lit element, and the `@dawcore/spectrogram` worker pool. Single-sourcing the
 * build + parse here prevents the drift class where a format change lands in some
 * sites but not others (the pool's no-match fallback then routes every channel to
 * worker 0 → channel 0's data rendered for all channels — #556).
 *
 * `@waveform-playlist/core` is the home because it is zero-dependency and already
 * a dependency of every producer and consumer (unlike `@dawcore/spectrogram`,
 * which `@waveform-playlist/ui-components` does not depend on). The format is a
 * pure string contract with no FFT/compute dependency.
 */

export interface SpectrogramCanvasIdParts {
  clipId: string;
  channelIndex: number;
  chunkIndex: number;
}

/**
 * Anchored to the trailing `-ch{N}-chunk{M}` segment. The greedy first group lets
 * the clip ID contain hyphens — and even a `-ch{N}-chunk{M}`-looking substring —
 * without misrouting: it always binds to the LAST such segment.
 */
const CANVAS_ID_RE = /^(.+)-ch(\d+)-chunk(\d+)$/;

/** Build a spectrogram canvas ID from its parts. */
export function buildSpectrogramCanvasId(parts: SpectrogramCanvasIdParts): string {
  return `${parts.clipId}-ch${parts.channelIndex}-chunk${parts.chunkIndex}`;
}

/**
 * Parse a spectrogram canvas ID into its parts, or `null` when it doesn't match
 * the `${clipId}-ch${channelIndex}-chunk${chunkIndex}` format.
 */
export function parseSpectrogramCanvasId(canvasId: string): SpectrogramCanvasIdParts | null {
  const match = canvasId.match(CANVAS_ID_RE);
  if (!match) return null;
  return {
    clipId: match[1],
    channelIndex: parseInt(match[2], 10),
    chunkIndex: parseInt(match[3], 10),
  };
}
