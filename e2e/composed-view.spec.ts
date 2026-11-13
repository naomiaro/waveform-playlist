import { test, expect } from '@playwright/test';

/**
 * The view is composed from parts (#685): a part is drawn because its
 * component is rendered. These pages each compose a different set, and what
 * they draw is what they drew when the provider's `timescale` and `controls`
 * props and the props of `<Waveform>` switched the same things: the tests
 * pass against that code too. They guard the compositions of the example
 * pages, not a change of behaviour.
 */
const ruler = '0:00';

test.describe('Composed views: each page draws the parts it renders', () => {
  test('media-element: only the second player has a timescale; none has a controls column', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/examples/media-element`);
    const roots = page.locator('[data-playlist-state="ready"]');
    await expect(roots).toHaveCount(3, { timeout: 30000 });
    await expect(roots.nth(0)).not.toContainText(ruler);
    await expect(roots.nth(1)).toContainText(ruler);
    await expect(roots.nth(2)).not.toContainText(ruler);
    for (let index = 0; index < 3; index++) {
      await expect(roots.nth(index).locator('> *')).toHaveCount(1);
    }
    // The default playhead in the first and the third; the second draws its own.
    await expect(roots.nth(0).locator('[data-playhead]')).toHaveCount(1);
    await expect(roots.nth(1).locator('[data-playhead]')).toHaveCount(0);
    await expect(roots.nth(2).locator('[data-playhead]')).toHaveCount(1);
  });

  test('effects: a timescale and a controls column as wide as its part says (150 px)', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/examples/effects`);
    const root = page.locator('[data-playlist-state="ready"]');
    await expect(root).toHaveCount(1, { timeout: 30000 });
    await expect(root).toContainText(ruler);
    await expect(root.locator('> *')).toHaveCount(2);
    await expect(async () => {
      const box = await root.locator('> *').first().boundingBox();
      expect(box?.width).toBe(150);
    }).toPass({ timeout: 5000 });
  });

  test('mobile-annotations: a timescale, no controls column, and the annotation list below', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/examples/mobile-annotations`);
    const root = page.locator('[data-playlist-state="ready"]');
    await expect(root).toHaveCount(1, { timeout: 30000 });
    await expect(root).toContainText(ruler);
    await expect(root.locator('> *')).toHaveCount(1);
    await expect(root.locator('> [data-scroll-container]')).toHaveCount(1);
  });

  test('multi-clip: clip headers with their trim handles, and a 200 px controls column', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/examples/multi-clip`);
    const root = page.locator('[data-playlist-state="ready"]');
    await expect(root).toHaveCount(1, { timeout: 30000 });
    await expect(async () => {
      expect(await root.locator('[data-clip-id]').count()).toBeGreaterThan(0);
      expect(await root.locator('[data-boundary-edge]').count()).toBeGreaterThan(0);
      const box = await root.locator('> *').first().boundingBox();
      expect(box?.width).toBe(200);
    }).toPass({ timeout: 10000 });
  });

  test('no page logs a misplaced-part warning', async ({ page, baseURL }) => {
    const warnings: string[] = [];
    page.on('console', (message) => {
      if (/\[waveform-playlist\] (<Waveform|A waveform root)/.test(message.text())) {
        warnings.push(message.text());
      }
    });
    for (const route of ['multi-clip', 'recording', 'flexible-api', 'fades', 'stem-tracks']) {
      await page.goto(`${baseURL}/examples/${route}`);
      await expect(page.locator('[data-scroll-container]').first()).toBeVisible({ timeout: 30000 });
      await page.waitForTimeout(500);
    }
    expect(warnings).toEqual([]);
  });
});
