export type RangeSupport = 'supported' | 'unsupported' | 'unknown';

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Probe whether an audio host honors HTTP range requests, so an on-demand
 * player can decide its seeking policy. Range *detection* lives here; range
 * *policy* (disable the scrubber, surface an error, play from start) stays with
 * the consuming component — the detection is generic, the UX is per-component.
 *
 * Sends `GET` with `Range: bytes=0-1` and reads only the status line, aborting
 * the body immediately: on a non-range host the `200` carries the entire
 * (possibly hours-long) file, which must never be downloaded just to detect the
 * failure.
 *
 * - `206` → `'supported'`
 * - `200` (host ignored Range, returned full body) → `'unsupported'`
 * - any throw (network error / CORS-opaque cross-origin) or other status → `'unknown'`
 *
 * **Positive-failure only:** only an observed `200` asserts a failure. A
 * CORS-opaque probe is `'unknown'`, NOT a failure — native `<audio>` seeking
 * works cross-origin *without* CORS, so seeking should stay enabled. A naive
 * "no 206 ⇒ failure" would false-positive on every CORS-opaque host.
 *
 * @param url       The audio URL to probe.
 * @param fetchImpl Injectable fetch (defaults to the global `fetch`) — pass a
 *                  stub in tests so no real network is hit, and pass an explicit
 *                  implementation on runtimes without a global `fetch`.
 */
export async function probeRangeSupport(
  url: string,
  fetchImpl: FetchLike = fetch
): Promise<RangeSupport> {
  const controller = new AbortController();
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-1' },
      // Bypass the HTTP cache: RFC 7234 lets a UA satisfy a range request from a
      // cached full 200, which would falsely read as the server ignoring Range.
      cache: 'no-store',
      signal: controller.signal,
    });
    if (res.status === 206) return 'supported';
    if (res.status === 200) return 'unsupported';
    return 'unknown';
  } catch {
    return 'unknown';
  } finally {
    // Never consume the body — abort the moment we have the status line.
    controller.abort();
  }
}
