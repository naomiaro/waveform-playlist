/**
 * The default way an arrangement turns a clip's source into an `AudioBuffer`:
 * fetch and decode for a URL, `arrayBuffer()` and decode for a Blob or File.
 * The abort signal is checked before the work starts and after each await, so
 * a cancelled load never decodes or resolves.
 */

import type { ClipSource } from '@waveform-playlist/core';

export type LoadSource = (
  src: ClipSource,
  context: { signal: AbortSignal; audioContext: BaseAudioContext }
) => Promise<AudioBuffer>;

/** `scheme://user:password@` or `//user@`: the part up to the `@`, when it comes before any `/`. */
const USERINFO = /^((?:[a-z][a-z0-9+.-]*:)?\/\/)[^/@]*@/i;

/**
 * What an error message calls a source. A URL loses its query string and
 * fragment and the user name and password before its host (each can hold a
 * secret, and messages reach the app); a `data:` or `blob:` URL is not echoed
 * at all.
 */
function urlLabel(url: string): string {
  const plain = url.split(/[?#]/)[0];
  const cut = plain.replace(USERINFO, '$1');
  if (cut !== plain) return cut;
  // Forms the pattern does not see but a browser reads as a URL with a user
  // name (white space in front, one slash, backslashes): ask the URL parser.
  try {
    const parsed = new URL(url, 'http://relative.invalid/');
    if (parsed.username !== '' || parsed.password !== '') {
      parsed.username = '';
      parsed.password = '';
      parsed.search = '';
      parsed.hash = '';
      return parsed.href;
    }
  } catch {
    // Not a URL the parser accepts: the text without query and fragment is all there is.
  }
  return plain;
}

function sourceLabel(src: ClipSource): string {
  if (typeof src === 'string') {
    if (/^data:/i.test(src)) return 'data: URL';
    if (/^blob:/i.test(src)) return 'blob: URL';
    return urlLabel(src);
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
  let response: Response;
  try {
    response = await fetch(src, { signal });
  } catch (error) {
    signal.throwIfAborted();
    // fetch reports a network failure or a refused cross-origin request as a
    // bare TypeError ("Failed to fetch", "Load failed"): say which source.
    if (error instanceof TypeError) {
      throw Object.assign(new Error('Failed to fetch ' + label), { cause: error });
    }
    throw error;
  }
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
