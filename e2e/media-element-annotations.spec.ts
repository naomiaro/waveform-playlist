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
    await page.getByRole('checkbox', { name: 'Continuous Play', exact: true }).uncheck();
    const play = page.getByRole('button', { name: 'Play', exact: true });
    const pause = page.getByRole('button', { name: 'Pause', exact: true });

    // Annotation 4 is 2.68 seconds long.
    const box4 = page.locator('[data-scroll-container]').getByText('4', { exact: true });
    await box4.click();
    await expect(pause).toBeEnabled({ timeout: 10000 });

    await expect(play).toBeEnabled({ timeout: 10000 });
    await expect(pause).toBeDisabled();

    // The cursor returns to the start of the annotation (#688), not to 0.
    const container = page.locator('[data-scroll-container]').first();
    const playhead = container.locator('[data-playhead]');
    await expect(async () => {
      // The box is the label's nearest absolutely positioned ancestor.
      const boxLeft = await box4.evaluate((label) => {
        let node: HTMLElement | null = label as HTMLElement;
        while (node && getComputedStyle(node).position !== 'absolute') node = node.parentElement;
        return node ? node.getBoundingClientRect().left : -1;
      });
      const playheadRect = await playhead.boundingBox();
      expect(playheadRect).toBeTruthy();
      expect(boxLeft).toBeGreaterThan(0);
      expect(Math.abs(playheadRect!.x - boxLeft)).toBeLessThanOrEqual(2);
    }).toPass({ timeout: 5000 });
  });

  test('with continuous play on, a clicked box keeps playing past its end', async ({ page }) => {
    const continuousPlay = page.getByRole('checkbox', { name: 'Continuous Play', exact: true });
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
    // The clip itself is a draggable too.
    await expect(handles).toHaveCount(1);

    await page.getByRole('checkbox', { name: 'Editable Annotations', exact: true }).check();

    await expect(handles).toHaveCount(31);
  });

  // The file is 44100 Hz. The drag once converted pixels to seconds with
  // 48000 Hz, so the edge moved about 8% less than the pointer.
  test('a dragged box edge follows the pointer', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Editable Annotations', exact: true }).check();
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

  // Reported by hand: separate two annotations, switch Link endpoints on, drag
  // one into the other. The boxes looked joined but the two times differed by a
  // few milliseconds for the rest of the drag.
  test('with Link endpoints on, annotations dragged into each other share one time', async ({
    page,
  }) => {
    await page.getByRole('checkbox', { name: 'Editable Annotations', exact: true }).check();
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
      const edges = boxes.filter((b) => b.height < 60 && b.x > centre).sort((a, b) => a.x - b.x);
      expect(edges.length).toBeGreaterThan(0);
      return edges[0];
    };
    const drag = async (from: { x: number; y: number }, distance: number, stepSize: number) => {
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      const steps = Math.ceil(Math.abs(distance) / stepSize);
      for (let i = 1; i <= steps; i++) {
        const travelled = Math.min(i * stepSize, Math.abs(distance)) * Math.sign(distance);
        await page.mouse.move(from.x + travelled, from.y);
        await page.waitForTimeout(30);
      }
      await page.mouse.up();
    };
    // "0:09.240 - 0:11.920" from the list row of an annotation.
    const timesOf = async (id: string) => {
      const row = page.getByText(id, { exact: true }).locator('xpath=..');
      // The id runs straight into the first time in the row's text.
      const text = ((await row.textContent()) ?? '').replace(id, '');
      const match = text.match(/(\d+:\d{2}\.\d{3})\s*-\s*(\d+:\d{2}\.\d{3})/);
      expect(match, 'times in "' + text + '"').toBeTruthy();
      return { start: match![1], end: match![2] };
    };

    // Unlinked: pull the end of 4 away from 5. A fraction of a pixel, so that
    // the way back passes within 10 ms of the neighbour without reaching it.
    const start = await rightEdgeOfBox4();
    await drag(start, -40.3, 5);
    await expect(async () => {
      expect((await timesOf('f000004')).end).not.toBe((await timesOf('f000005')).start);
    }).toPass({ timeout: 5000 });

    // Linked: drag it back into 5 and beyond, one pixel at a time.
    await page.getByRole('checkbox', { name: 'Link Endpoints', exact: true }).check();
    const separated = await rightEdgeOfBox4();
    await drag(separated, 55, 1);

    await expect(async () => {
      const four = await timesOf('f000004');
      const five = await timesOf('f000005');
      expect(four.end).toBe(five.start);
      // 5's start moved from where it was: the drag went past the join.
      expect(five.start).not.toBe('0:11.920');
    }).toPass({ timeout: 5000 });
  });
});
