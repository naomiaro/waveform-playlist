import { test, expect } from '@playwright/test';

/**
 * The MediaElement waveform is drawn by the parts of the multitrack view
 * (#685): its root carries the loading state, its one track is a row, and
 * fades are the clip's.
 */
test.describe('MediaElement view: root, row and fades', () => {
  test('every player becomes ready and holds one selected audio row with its clip', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/examples/media-element`);
    const roots = page.locator('[data-playlist-state]');
    await expect(roots).toHaveCount(3, { timeout: 30000 });
    await expect(page.locator('[data-playlist-state="ready"]')).toHaveCount(3, { timeout: 30000 });

    for (let index = 0; index < 3; index++) {
      const root = roots.nth(index);
      // The scroll area is the root's only child: no controls column.
      await expect(root.locator('> *')).toHaveCount(1);
      await expect(root.locator('> [data-scroll-container]')).toHaveCount(1);
      const rows = root.locator('[data-track-row]');
      await expect(rows).toHaveCount(1);
      await expect(rows).toHaveAttribute('data-track-id', 'media-element-track-0');
      await expect(rows).toHaveAttribute('data-track-kind', 'audio');
      await expect(rows).toHaveAttribute('data-selected', 'true');
      await expect(rows.locator('[data-clip-container]')).toHaveCount(1);
      await expect(rows.locator('canvas').first()).toBeVisible();
    }
  });

  test('a click on the waveform still moves the playhead there', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/media-element`);
    const root = page.locator('[data-playlist-state="ready"]').first();
    await expect(root).toBeVisible({ timeout: 30000 });
    const row = root.locator('[data-track-row]');
    await row.scrollIntoViewIfNeeded();
    let box: { x: number; y: number; width: number; height: number } | null = null;
    await expect(async () => {
      box = await root.locator('[data-scroll-container]').boundingBox();
      expect(box).toBeTruthy();
    }).toPass({ timeout: 5000 });
    await page.mouse.click(box!.x + 200, box!.y + box!.height / 2);
    const playhead = root.locator('[data-playhead]');
    await expect(async () => {
      const playheadBox = await playhead.boundingBox();
      expect(playheadBox).toBeTruthy();
      expect(Math.abs(playheadBox!.x - (box!.x + 200))).toBeLessThanOrEqual(2);
    }).toPass({ timeout: 5000 });
  });

  test('on the fades page each fade-out curve ends exactly where its clip ends', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/examples/fades`);
    const clips = page.locator('[data-track-row] [data-clip-container]');
    await expect(clips).toHaveCount(4, { timeout: 30000 });
    await expect(clips.locator('svg')).toHaveCount(8);

    await expect(async () => {
      const edges = await clips.evaluateAll((elements) =>
        elements.map((clip) => {
          const clipBox = clip.getBoundingClientRect();
          const curves = [...clip.querySelectorAll('svg')].map((svg) =>
            (svg.parentElement as HTMLElement).getBoundingClientRect()
          );
          return {
            fadeInLeft: curves[0].left - clipBox.left,
            fadeOutRight: clipBox.right - curves[1].right,
            fadeOutWidth: curves[1].width,
          };
        })
      );
      for (const edge of edges) {
        expect(edge.fadeInLeft).toBe(0);
        expect(edge.fadeOutRight).toBe(0);
        expect(edge.fadeOutWidth).toBeGreaterThan(0);
      }
    }).toPass({ timeout: 5000 });
  });
});
