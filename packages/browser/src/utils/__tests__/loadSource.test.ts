import { describe, it, expect, vi, afterEach } from 'vitest';
import { defaultLoadSource } from '../loadSource';

const goodBuffer = { length: 100, sampleRate: 48000, duration: 100 / 48000 } as AudioBuffer;
const bytes = new ArrayBuffer(8);

const contextWith = (decode: ReturnType<typeof vi.fn>) =>
  ({ decodeAudioData: decode }) as unknown as BaseAudioContext;

const okResponse = () => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  arrayBuffer: vi.fn().mockResolvedValue(bytes),
});

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('defaultLoadSource', () => {
  it('fetches a string with the signal and decodes it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const decode = vi.fn().mockResolvedValue(goodBuffer);
    const { signal } = new AbortController();
    const result = await defaultLoadSource('a.mp3', { signal, audioContext: contextWith(decode) });
    expect(fetchMock).toHaveBeenCalledWith('a.mp3', { signal });
    expect(decode).toHaveBeenCalledWith(bytes);
    expect(result).toBe(goodBuffer);
  });

  it('rejects a 404 with the status in the message', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }) as never;
    const decode = vi.fn();
    await expect(
      defaultLoadSource('a.mp3', {
        signal: new AbortController().signal,
        audioContext: contextWith(decode),
      })
    ).rejects.toThrow('Failed to fetch a.mp3: 404 Not Found');
    expect(decode).not.toHaveBeenCalled();
  });

  it('reads a Blob with arrayBuffer() and does not fetch', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as never;
    const decode = vi.fn().mockResolvedValue(goodBuffer);
    const blob = new Blob(['x']);
    const result = await defaultLoadSource(blob, {
      signal: new AbortController().signal,
      audioContext: contextWith(decode),
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(decode).toHaveBeenCalledTimes(1);
    expect(result).toBe(goodBuffer);
  });

  it('rejects with AbortError when aborted before starting', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as never;
    const controller = new AbortController();
    controller.abort();
    await expect(
      defaultLoadSource('a.mp3', {
        signal: controller.signal,
        audioContext: contextWith(vi.fn()),
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects with AbortError when aborted between the fetch and the decode', async () => {
    const controller = new AbortController();
    const response = okResponse();
    response.arrayBuffer = vi.fn().mockImplementation(async () => {
      controller.abort();
      return bytes;
    });
    globalThis.fetch = vi.fn().mockResolvedValue(response) as never;
    const decode = vi.fn().mockResolvedValue(goodBuffer);
    await expect(
      defaultLoadSource('a.mp3', { signal: controller.signal, audioContext: contextWith(decode) })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(decode).not.toHaveBeenCalled();
  });

  it('rejects with AbortError when aborted during the decode', async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse()) as never;
    const decode = vi.fn().mockImplementation(async () => {
      controller.abort();
      return goodBuffer;
    });
    await expect(
      defaultLoadSource('a.mp3', { signal: controller.signal, audioContext: contextWith(decode) })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('propagates a decode Error as it is', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse()) as never;
    const error = new Error('bad data');
    const decode = vi.fn().mockRejectedValue(error);
    await expect(
      defaultLoadSource('a.mp3', {
        signal: new AbortController().signal,
        audioContext: contextWith(decode),
      })
    ).rejects.toBe(error);
  });

  it('wraps a non-Error decode rejection (old Safari rejects with null)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse()) as never;
    const decode = vi.fn().mockRejectedValue(null);
    await expect(
      defaultLoadSource('a.mp3', {
        signal: new AbortController().signal,
        audioContext: contextWith(decode),
      })
    ).rejects.toThrow('Failed to decode audio: a.mp3');
  });

  it.each([
    ['falsy', null],
    ['zero length', { length: 0, sampleRate: 48000 }],
    ['bad sample rate', { length: 10, sampleRate: 0 }],
    ['NaN sample rate', { length: 10, sampleRate: NaN }],
  ])('rejects an empty decode (%s) naming the source', async (_name, buffer) => {
    globalThis.fetch = vi.fn().mockResolvedValue(okResponse()) as never;
    const decode = vi.fn().mockResolvedValue(buffer);
    await expect(
      defaultLoadSource('a.mp3', {
        signal: new AbortController().signal,
        audioContext: contextWith(decode),
      })
    ).rejects.toThrow('Decoded audio is empty: a.mp3');
  });

  it('labels a Blob as Blob and a File by its name', async () => {
    const decode = vi.fn().mockResolvedValue(null);
    const context = { signal: new AbortController().signal, audioContext: contextWith(decode) };
    await expect(defaultLoadSource(new Blob(['x']), context)).rejects.toThrow(
      'Decoded audio is empty: Blob'
    );
    await expect(defaultLoadSource(new File(['x'], 'kick.wav'), context)).rejects.toThrow(
      'Decoded audio is empty: kick.wav'
    );
  });
});
