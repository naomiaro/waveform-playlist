/**
 * The default way a provider turns a clip's source into an `AudioBuffer`:
 * fetch and decode for a URL, `arrayBuffer()` and decode for a Blob or File.
 * The abort signal is checked before the work starts and after each await, so
 * a cancelled load never decodes or resolves.
 */

import type { ClipSource } from '@waveform-playlist/core';

export type LoadSource = (
  src: ClipSource,
  context: { signal: AbortSignal; audioContext: BaseAudioContext }
) => Promise<AudioBuffer>;

/**
 * What an error message calls a source. A URL loses its query string and
 * fragment (they can hold a token, and messages reach the app's `onError`); a
 * `data:` or `blob:` URL is not echoed at all.
 */
function sourceLabel(src: ClipSource): string {
  if (typeof src === 'string') {
    if (/^data:/i.test(src)) return 'data: URL';
    if (/^blob:/i.test(src)) return 'blob: URL';
    return src.split(/[?#]/)[0];
  }
  if (typeof File !== 'undefined' && src instanceof File) return src.name;
  return 'Blob';
}

async function readBytes(
  src: ClipSource,
  label: string,
  signal: AbortSignal
): Promise<ArrayBuffer> {
  if (typeof src !== 'string') {
    const bytes = await src.arrayBuffer();
    signal.throwIfAborted();
    return bytes;
  }
  const response = await fetch(src, { signal });
  signal.throwIfAborted();
  if (!response.ok) {
    throw new Error(`Failed to fetch ${label}: ${response.status} ${response.statusText}`);
  }
  const bytes = await response.arrayBuffer();
  signal.throwIfAborted();
  return bytes;
}

function isUsable(buffer: AudioBuffer | null | undefined): buffer is AudioBuffer {
  return (
    !!buffer && buffer.length > 0 && typeof buffer.sampleRate === 'number' && buffer.sampleRate > 0
  );
}

export const defaultLoadSource: LoadSource = async (src, { signal, audioContext }) => {
  signal.throwIfAborted();
  const label = sourceLabel(src);
  const bytes = await readBytes(src, label, signal);
  let buffer: AudioBuffer;
  try {
    buffer = await audioContext.decodeAudioData(bytes);
  } catch (error) {
    signal.throwIfAborted();
    if (error instanceof Error) throw error;
    throw new Error('Failed to decode audio: ' + label);
  }
  signal.throwIfAborted();
  if (!isUsable(buffer)) throw new Error('Decoded audio is empty: ' + label);
  return buffer;
};
