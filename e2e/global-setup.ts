import { chromium, type FullConfig } from '@playwright/test';

/**
 * Warm the dev server before any test runs.
 *
 * The Docusaurus dev server compiles each route lazily, on its first
 * request. With parallel workers, the first tests to reach a route used to
 * pay that compile inside their own `beforeEach` — and regularly ran out of
 * their 30 s readiness timeout, failing a different handful of tests on
 * every run (most often the first few in `effects.spec.ts`).
 *
 * Visiting every route once here moves the compile out of the tests. A
 * route that fails to warm only logs: the tests themselves are still the
 * judge of whether a page works.
 */
const ROUTES = [
  '/examples/annotations',
  '/examples/effects',
  '/examples/media-element',
  '/examples/midi',
  '/examples/mir-spectrogram',
  '/examples/mobile-annotations',
  '/examples/mobile-multi-clip',
  '/examples/multi-clip',
  '/examples/recording',
  '/examples/stem-tracks',
  '/examples/waveform-data',
];

const WARMUP_TIMEOUT_MS = 180_000;

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) {
    return;
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const route of ROUTES) {
      try {
        await page.goto(baseURL + route, { timeout: WARMUP_TIMEOUT_MS });
        // The page's own <h1> proves the route's bundle compiled and rendered.
        await page.waitForSelector('h1', { timeout: WARMUP_TIMEOUT_MS });
      } catch (err) {
        console.warn('[e2e warmup] ' + route + ' did not warm up: ' + String(err).split('\n')[0]);
      }
    }
  } finally {
    await browser.close();
  }
}
