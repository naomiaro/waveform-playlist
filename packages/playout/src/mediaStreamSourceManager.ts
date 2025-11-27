/**
 * MediaStreamSource Manager
 *
 * Manages MediaStreamAudioSourceNode instances to ensure only one source
 * is created per MediaStream per AudioContext.
 *
 * Web Audio API constraint: You can only create one MediaStreamAudioSourceNode
 * per MediaStream per AudioContext. Multiple attempts will fail or disconnect
 * previous sources.
 *
 * This manager ensures a single source is shared across multiple consumers
 * (e.g., AnalyserNode for VU meter, AudioWorkletNode for recording).
 *
 * NOTE: With Tone.js Context, you can also use context.createMediaStreamSource()
 * directly, which handles cross-browser compatibility internally.
 */

import { getContext } from 'tone';

// Map of MediaStream -> MediaStreamAudioSourceNode
const streamSources = new Map<MediaStream, MediaStreamAudioSourceNode>();

// Map of MediaStream -> cleanup handlers
const streamCleanupHandlers = new Map<MediaStream, () => void>();

/**
 * Get or create a MediaStreamAudioSourceNode for the given stream
 *
 * @param stream - The MediaStream to create a source for
 * @returns MediaStreamAudioSourceNode that can be connected to multiple nodes
 *
 * @example
 * ```typescript
 * const source = getMediaStreamSource(stream);
 *
 * // Multiple consumers can connect to the same source
 * source.connect(analyserNode);  // For VU meter
 * source.connect(workletNode);   // For recording
 * ```
 */
export function getMediaStreamSource(
  stream: MediaStream
): MediaStreamAudioSourceNode {
  // Return existing source if we have one for this stream
  if (streamSources.has(stream)) {
    return streamSources.get(stream)!;
  }

  // Create new source using Tone.js's shared context for cross-browser compatibility
  const context = getContext();
  const source = context.createMediaStreamSource(stream);
  streamSources.set(stream, source);

  // Set up cleanup when stream ends
  const cleanup = () => {
    source.disconnect();
    streamSources.delete(stream);
    streamCleanupHandlers.delete(stream);

    // Remove event listener
    stream.removeEventListener('ended', cleanup);
    stream.removeEventListener('inactive', cleanup);
  };

  streamCleanupHandlers.set(stream, cleanup);

  // Clean up when stream ends or becomes inactive
  stream.addEventListener('ended', cleanup);
  stream.addEventListener('inactive', cleanup);

  return source;
}

/**
 * Manually release a MediaStreamSource
 *
 * Normally you don't need to call this - cleanup happens automatically
 * when the stream ends. Only call this if you need to force cleanup.
 *
 * @param stream - The MediaStream to release the source for
 */
export function releaseMediaStreamSource(stream: MediaStream): void {
  const cleanup = streamCleanupHandlers.get(stream);
  if (cleanup) {
    cleanup();
  }
}

/**
 * Check if a MediaStreamSource exists for the given stream
 *
 * @param stream - The MediaStream to check
 * @returns true if a source exists for this stream
 */
export function hasMediaStreamSource(stream: MediaStream): boolean {
  return streamSources.has(stream);
}
