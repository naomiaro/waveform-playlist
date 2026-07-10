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

import { getGlobalContext } from './audioContext';

// Map of MediaStream -> MediaStreamAudioSourceNode
const streamSources = new Map<MediaStream, MediaStreamAudioSourceNode>();

// Map of MediaStream -> cleanup handlers
const streamCleanupHandlers = new Map<MediaStream, () => void>();

/**
 * Get or create a MediaStreamAudioSourceNode for the given stream
 *
 * Automatic cleanup fires when the stream's tracks end remotely (device
 * unplugged, remote peer stopped). NOTE: a LOCAL `track.stop()` does NOT
 * fire the track-level 'ended' event (per spec) — call
 * releaseMediaStreamSource() when tearing a stream down yourself.
 *
 * @param stream - The MediaStream to create a source for
 * @returns MediaStreamAudioSourceNode that can be connected to multiple nodes
 */
export function getMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode {
  // Return existing source if we have one for this stream
  if (streamSources.has(stream)) {
    return streamSources.get(stream)!;
  }

  // Create on the package's global playout context — Tone's raw getContext()
  // would lazily create an orphaned default context when called before
  // configureGlobalContext()/getGlobalContext(), stranding this source on a
  // dead graph once the real global context is created.
  const context = getGlobalContext();
  const source = context.createMediaStreamSource(stream);
  streamSources.set(stream, source);

  // MediaStream itself has no 'ended'/'inactive' events ('ended' is
  // track-level; active/inactive were removed from the spec) — hook each
  // track and clean up once the stream reports inactive.
  const tracks = stream.getTracks();

  const onTrackEnded = () => {
    if (!stream.active) {
      cleanup();
    }
  };

  const cleanup = () => {
    source.disconnect();
    streamSources.delete(stream);
    streamCleanupHandlers.delete(stream);
    tracks.forEach((track) => track.removeEventListener('ended', onTrackEnded));
  };

  streamCleanupHandlers.set(stream, cleanup);
  tracks.forEach((track) => track.addEventListener('ended', onTrackEnded));

  return source;
}

/**
 * Manually release a MediaStreamSource
 *
 * Required after a local `track.stop()` (which fires no 'ended' event);
 * remote-ended streams clean up automatically.
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
