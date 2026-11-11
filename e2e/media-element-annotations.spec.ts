import { test, expect } from '@playwright/test';

/**
 * Media Element Annotations example: MediaElementPlaylistProvider (streamed
 * audio, pre-computed peaks) with annotation boxes and the annotation list.
 */

test.describe('Media Element Annotations Example', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/media-element-annotations`);
    await page.waitForSelector('h1:has-text("Media Element Annotations")', { timeout: 30000 });
    await expect(page.locator('[data-scroll-container] canvas').first()).toBeVisible({
      timeout: 30000,
    });
  });

  test('shows a box and a list entry for every annotation', async ({ page }) => {
    const boxes = page.locator('[data-scroll-container]');
    for (const label of ['1', '8', '15']) {
      await expect(boxes.getByText(label, { exact: true })).toHaveCount(1);
    }
    await expect(page.getByText('From fairest creatures we desire increase,')).toBeVisible();
    await expect(page.getByText('f000015').first()).toBeAttached();
  });

  test('plays and stops', async ({ page }) => {
    const play = page.getByRole('button', { name: 'Play', exact: true });
    const pause = page.getByRole('button', { name: 'Pause', exact: true });

    await play.click();
    await expect(pause).toBeEnabled({ timeout: 10000 });

    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await expect(play).toBeEnabled();
    await expect(pause).toBeDisabled();
  });

  test('with continuous play off, a clicked box plays to its end and stops', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Continuous play' }).uncheck();
    const play = page.getByRole('button', { name: 'Play', exact: true });
    const pause = page.getByRole('button', { name: 'Pause', exact: true });

    // Annotation 4 is 2.68 seconds long.
    await page.locator('[data-scroll-container]').getByText('4', { exact: true }).click();
    await expect(pause).toBeEnabled({ timeout: 10000 });

    await expect(play).toBeEnabled({ timeout: 10000 });
    await expect(pause).toBeDisabled();
  });

  test('with continuous play on, a clicked box keeps playing past its end', async ({ page }) => {
    const continuousPlay = page.getByRole('checkbox', { name: 'Continuous play' });
    await expect(continuousPlay).toBeChecked();
    const play = page.getByRole('button', { name: 'Play', exact: true });
    const pause = page.getByRole('button', { name: 'Pause', exact: true });
    const box4 = page.locator('[data-scroll-container]').getByText('4', { exact: true });

    // First show that time advances on this page: with continuous play off the
    // same box (annotation 4, 2.68 seconds long) stops by itself. Without this, "still playing" below would also
    // hold for audio that never started.
    await continuousPlay.uncheck();
    await box4.click();
    await expect(pause).toBeEnabled({ timeout: 10000 });
    await expect(play).toBeEnabled({ timeout: 10000 });

    await continuousPlay.check();
    await box4.click();
    await expect(pause).toBeEnabled({ timeout: 10000 });
    await page.waitForTimeout(4000);

    await expect(pause).toBeEnabled();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
  });

  test('Editable adds drag handles to both edges of every box', async ({ page }) => {
    const handles = page.locator('[data-scroll-container] [aria-roledescription="draggable"]');
    const linkEndpoints = page.getByRole('checkbox', { name: 'Link endpoints' });
    await expect(linkEndpoints).toBeDisabled();
    // The clip itself is a draggable too.
    await expect(handles).toHaveCount(1);

    await page.getByRole('checkbox', { name: 'Editable' }).check();

    await expect(handles).toHaveCount(31);
    await expect(linkEndpoints).toBeEnabled();
  });

  // The file is 44100 Hz. The drag once converted pixels to seconds with
  // 48000 Hz, so the edge moved about 8% less than the pointer.
  test('a dragged box edge follows the pointer', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Editable' }).check();
    const container = page.locator('[data-scroll-container]');
    const handles = container.locator('[aria-roledescription="draggable"]');
    await expect(handles).toHaveCount(31);
    const label = container.getByText('4', { exact: true });
    await expect(label).toBeVisible();

    // The right edge of box 4: the first handle to the right of its label.
    const rightEdgeOfBox4 = async () => {
      const labelBox = await label.boundingBox();
      expect(labelBox).toBeTruthy();
      const centre = labelBox!.x + labelBox!.width / 2;
      const boxes = await handles.evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, height: rect.height };
        })
      );
      // The clip is a draggable too, and much taller than a handle.
      const edges = boxes.filter((b) => b.height < 60 && b.x > centre).sort((a, b) => a.x - b.x);
      expect(edges.length).toBeGreaterThan(0);
      return edges[0];
    };

    const start = await rightEdgeOfBox4();
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(start.x - i * 5, start.y);
      await page.waitForTimeout(30);
    }
    await page.mouse.up();

    await expect(async () => {
      const end = await rightEdgeOfBox4();
      expect(Math.abs(start.x - end.x - 60)).toBeLessThanOrEqual(2);
    }).toPass({ timeout: 5000 });
  });
});
