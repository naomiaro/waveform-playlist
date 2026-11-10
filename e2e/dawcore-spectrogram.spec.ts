/**
 * dawcore spectrogram render-mode e2e.
 *
 * These tests run against the dawcore-native Vite example, not the
 * Docusaurus site. `playwright.config.ts` starts that server itself (on
 * port 5273 by default) and passes its URL in `DAWCORE_NATIVE_URL`; set that
 * variable, or `DAWCORE_NATIVE_PORT`, to point at a different one.
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.DAWCORE_NATIVE_URL ?? 'http://localhost:5273';

test.describe('dawcore spectrogram render-mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/spectrogram.html`);
  });

  test('renders <daw-spectrogram> for spectrogram tracks and <daw-waveform> for waveform tracks', async ({
    page,
  }) => {
    await page.waitForSelector('daw-editor');
    // Wait for at least one daw-spectrogram-ready event before counting elements
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const editor = document.getElementById('editor');
          editor?.addEventListener('daw-spectrogram-ready', () => resolve(), { once: true });
        })
    );

    await expect(page.locator('daw-spectrogram')).toHaveCount(4); // Kick + Claps + Synth(stereo) = 4
    await expect(page.locator('daw-waveform').first()).toBeAttached();
  });

  test('color map change fires a fresh daw-spectrogram-ready event', async ({ page }) => {
    await page.waitForSelector('daw-spectrogram');
    // Wait for initial readiness
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const editor = document.getElementById('editor');
          editor?.addEventListener('daw-spectrogram-ready', () => resolve(), { once: true });
        })
    );

    // Listen for the next ready event triggered by the color-map change
    const nextReady = page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const editor = document.getElementById('editor');
          editor?.addEventListener(
            'daw-spectrogram-ready',
            (e) => {
              resolve((e as CustomEvent).detail.trackId);
            },
            { once: true }
          );
        })
    );

    await page.selectOption('#colormap', 'viridis');

    const trackId = await Promise.race([
      nextReady,
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
    ]);
    expect(trackId).toBeTruthy();
  });
});
