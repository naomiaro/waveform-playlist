import { describe, it, expect, vi } from 'vitest';
import { probeRangeSupport } from '../probeRangeSupport';

/**
 * Minimal fetch stub: resolves to a Response-shaped object with the given
 * status, capturing each call's init so tests can assert the Range header and
 * that the request signal was aborted. No real network.
 */
function fetchReturning(status: number) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const impl = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return { status } as unknown as Response;
  });
  return { impl, calls };
}

describe('probeRangeSupport', () => {
  it('returns "supported" on 206 (host honored Range)', async () => {
    const { impl } = fetchReturning(206);
    await expect(probeRangeSupport('https://host/audio.mp3', impl)).resolves.toBe('supported');
  });

  it('sends a cache-bypassing GET with Range: bytes=0-1, and aborts (206 path)', async () => {
    const { impl, calls } = fetchReturning(206);
    await probeRangeSupport('https://host/audio.mp3', impl);
    expect(calls).toHaveLength(1);
    const init = calls[0].init!;
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Range).toBe('bytes=0-1');
    // Bypass the HTTP cache — a cached full 200 must not be mistaken for the
    // server ignoring Range (RFC 7234 allows satisfying a range from a cached 200).
    expect(init.cache).toBe('no-store');
    // Abort runs on every path (here the 206 / 'supported' path), not just 200.
    expect((init.signal as AbortSignal).aborted).toBe(true);
  });

  it('returns "unsupported" on 200 (host ignored Range, returned full body)', async () => {
    const { impl } = fetchReturning(200);
    await expect(probeRangeSupport('https://host/audio.mp3', impl)).resolves.toBe('unsupported');
  });

  it('aborts the request so a non-range full file is never downloaded', async () => {
    const { impl, calls } = fetchReturning(200);
    await probeRangeSupport('https://host/audio.mp3', impl);
    const signal = calls[0].init!.signal as AbortSignal;
    expect(signal.aborted).toBe(true);
  });

  it('returns "unknown" when fetch throws (network error / CORS-opaque cross-origin)', async () => {
    const impl = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(probeRangeSupport('https://other-origin/audio.mp3', impl)).resolves.toBe(
      'unknown'
    );
  });

  it('returns "unknown" on other statuses (e.g. 404)', async () => {
    const { impl } = fetchReturning(404);
    await expect(probeRangeSupport('https://host/missing.mp3', impl)).resolves.toBe('unknown');
  });
});
