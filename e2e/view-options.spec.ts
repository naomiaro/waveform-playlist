import { test, expect, type Page } from '@playwright/test';

/**
 * The options that only affect how a view draws are `<WaveformViewOptions>`
 * (#689): row height, bar style, playhead width, the filled layout. These
 * tests read what is drawn on pages that set them, under both providers.
 */

/** Height in CSS pixels of every track row on the page. */
async function rowHeights(page: Page): Promise<number[]> {
  return page
    .locator('[data-track-row]')
    .evaluateAll((rows) => rows.map((row) => Math.round(row.getBoundingClientRect().height)));
}

/** Width in CSS pixels of every playhead on the page. */
async function playheadWidths(page: Page): Promise<number[]> {
  return page
    .locator('[data-playhead]')
    .evaluateAll((lines) => lines.map((line) => Math.round(line.getBoundingClientRect().width)));
}

test.describe('View options', () => {
  test('one row height set above ten players, and each player its own bars', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/examples/styling`);
    await expect(page.locator('[data-track-row]')).toHaveCount(10, { timeout: 30000 });

    // waveHeight 80 is written once, above all ten providers.
    await expect(async () => {
      expect(await rowHeights(page)).toEqual(Array(10).fill(80));
    }).toPass();

    // The playhead is as wide as a bar and its gap, which each player sets
    // itself: 1+0, 1+1, 2+1, 3+1, 4+2, 4+2, 2+2, 2+1, 2+0, 1+2.
    await expect(page.locator('[data-playhead]')).toHaveCount(10);
    await expect(async () => {
      expect(await playheadWidths(page)).toEqual([1, 2, 3, 4, 6, 6, 4, 3, 2, 3]);
    }).toPass();
  });

  test('three MediaElement players share one set of options', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/media-element`);
    await expect(page.locator('[data-track-row]')).toHaveCount(3, { timeout: 30000 });
    await expect(async () => {
      expect(await rowHeights(page)).toEqual([120, 120, 120]);
    }).toPass();
    await expect(async () => {
      // barWidth 2, barGap 0. Two default playheads: the second player draws
      // its own, which is not given the width.
      expect(await playheadWidths(page)).toEqual([2, 2]);
    }).toPass();
  });

  test('a page with no row height is drawn at the default of 80', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/minimal`);
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
    await expect(async () => {
      const heights = await rowHeights(page);
      expect(heights.length).toBeGreaterThan(0);
      expect(new Set(heights)).toEqual(new Set([80]));
    }).toPass();
    // progressBarWidth 2 on that page.
    await expect(async () => {
      expect(await playheadWidths(page)).toEqual([2]);
    }).toPass();
  });

  test('fillViewport draws an empty timeline as wide as its container', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/examples/recording`);
    const scroll = page.locator('[data-scroll-container]');
    await expect(scroll).toBeVisible({ timeout: 30000 });
    await expect(async () => {
      const { container, content } = await scroll.evaluate((element) => ({
        container: element.clientWidth,
        content: (element.firstElementChild as HTMLElement).getBoundingClientRect().width,
      }));
      expect(container).toBeGreaterThan(300);
      // Sixty seconds of empty timeline at this page's zoom is narrower than
      // the container; the option widens it.
      expect(Math.round(content)).toBeGreaterThanOrEqual(container);
    }).toPass();
  });

  test('a spectrogram is rendered at the height of its canvas, also the half-height one', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/examples/mir-spectrogram`);
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
    const firstRow = page.locator('[data-track-row]').first();
    const menuButton = page.getByRole('button', { name: 'Track menu' }).first();

    /** Bitmap and CSS height of the first canvas in the first row (the spectrogram, once on). */
    const firstCanvas = () =>
      firstRow.locator('canvas').first().evaluate((canvas: HTMLCanvasElement) => ({
        bitmap: canvas.height / window.devicePixelRatio,
        css: Math.round(canvas.getBoundingClientRect().height),
      }));

    // The row is 100 px per channel on this page.
    await menuButton.click();
    await page.getByRole('radio', { name: 'Spectrogram', exact: true }).click();
    await expect(async () => {
      expect(await firstCanvas()).toEqual({ bitmap: 100, css: 100 });
    }).toPass({ timeout: 15000 });

    // In "both" mode the spectrogram has the upper half of the channel. The
    // worker used to be told the full row height for a half-height canvas.
    await menuButton.click();
    await page.getByRole('radio', { name: 'Both', exact: true }).click();
    await expect(async () => {
      expect(await firstCanvas()).toEqual({ bitmap: 50, css: 50 });
    }).toPass({ timeout: 15000 });
    // The canvas is 50 px from the moment React draws it; the worker resizes
    // it when it renders, a moment later. Look again after it has: a retrying
    // assertion alone passes before the render (it did, with the fix removed).
    await page.waitForTimeout(3000);
    expect(await firstCanvas()).toEqual({ bitmap: 50, css: 50 });
  });
});
