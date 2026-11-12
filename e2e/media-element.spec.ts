import { test, expect } from '@playwright/test';

/**
 * Media Element Playout tests
 *
 * The Media Element example renders two independent players:
 * 1. Default playhead (simple vertical line)
 * 2. Custom playhead (PlayheadWithMarker) + Timescale
 *
 * The custom playhead exercises the hook isolation pattern
 * (CustomMediaElementPlayhead wrapper) that prevents
 * "Rendered more hooks" errors.
 */

test.describe('Media Element Example', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/media-element`);
    await page.waitForSelector('h1:has-text("Media Element")', { timeout: 30000 });
  });

  test.describe('Selection', () => {
    // The drag is followed on the window: the pointer may leave the waveform and
    // the button may be released anywhere.
    test('a drag keeps following the pointer outside the waveform', async ({ page }) => {
      const container = page.locator('[data-scroll-container]').first();
      await expect(container).toBeVisible();
      await expect(container.locator('canvas').first()).toBeVisible({ timeout: 30000 });
      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await container.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });

      const y = box!.y + box!.height / 2;
      const anchorX = box!.x + 100;
      const selection = page.locator('[data-selection]').first();
      const expectSelection = async (left: number, width: number) => {
        await expect(async () => {
          const selectionBox = await selection.boundingBox();
          expect(selectionBox).toBeTruthy();
          expect(Math.abs(selectionBox!.x - left)).toBeLessThanOrEqual(2);
          expect(Math.abs(selectionBox!.width - width)).toBeLessThanOrEqual(2);
        }).toPass({ timeout: 5000 });
      };
      const heading = await page.locator('h1').first().boundingBox();
      expect(heading).toBeTruthy();
      const outsideY = heading!.y + heading!.height / 2;

      await page.mouse.move(anchorX, y);
      await page.mouse.down();
      await page.mouse.move(anchorX + 40, y, { steps: 4 });
      // Leave upwards, then keep dragging right while outside.
      await page.mouse.move(anchorX + 40, outsideY, { steps: 5 });
      await page.mouse.move(anchorX + 200, outsideY, { steps: 8 });
      await expectSelection(anchorX, 200);

      // Released outside: the range is kept and the drag is over.
      await page.mouse.up();
      await expectSelection(anchorX, 200);
      for (let i = 0; i <= 5; i++) {
        await page.mouse.move(anchorX + 300 + i * 20, y);
      }
      await page.waitForTimeout(200);
      await expectSelection(anchorX, 200);

      // Dragging over the page did not select its text.
      expect(await page.evaluate(() => window.getSelection()?.toString() ?? '')).toBe('');
    });

    test('a drag past the left edge of the waveform selects from the start', async ({ page }) => {
      const container = page.locator('[data-scroll-container]').first();
      await expect(container).toBeVisible();
      await expect(container.locator('canvas').first()).toBeVisible({ timeout: 30000 });
      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await container.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });

      const y = box!.y + box!.height / 2;
      const anchorX = box!.x + 100;
      const selection = page.locator('[data-selection]').first();
      const expectSelection = async (left: number, width: number) => {
        await expect(async () => {
          const selectionBox = await selection.boundingBox();
          expect(selectionBox).toBeTruthy();
          expect(Math.abs(selectionBox!.x - left)).toBeLessThanOrEqual(2);
          expect(Math.abs(selectionBox!.width - width)).toBeLessThanOrEqual(2);
        }).toPass({ timeout: 5000 });
      };
      const heading = await page.locator('h1').first().boundingBox();
      expect(heading).toBeTruthy();
      const outsideY = heading!.y + heading!.height / 2;

      await page.mouse.move(anchorX, y);
      await page.mouse.down();
      // One jump from inside to well left of the waveform, as a fast drag does.
      await page.mouse.move(Math.max(box!.x - 150, 1), outsideY);
      await expectSelection(box!.x, 100);
      await page.mouse.up();
      await expectSelection(box!.x, 100);
    });
  });

  test.describe('Custom Playhead (PlayheadWithMarker)', () => {
    test('playback with custom playhead produces no console errors', async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // The second player has the custom playhead (PlayheadWithMarker)
      // Find its Play button — there are two sets of controls
      const playButtons = page.getByRole('button', { name: /Play/ });
      await expect(playButtons.nth(1)).toBeVisible();

      // Start playback on the custom playhead player
      await playButtons.nth(1).click();

      // Let it play briefly
      await page.waitForTimeout(1000);

      // Stop playback
      const stopButtons = page.getByRole('button', { name: /Stop/ });
      await stopButtons.nth(1).click();

      // Check for hook-related errors
      const hookErrors = consoleErrors.filter(
        (e) => e.includes('Rendered more hooks') || e.includes('Rendered fewer hooks')
      );
      expect(hookErrors).toHaveLength(0);
    });
  });

  test.describe('Playback Controls', () => {
    test('play and stop work on default playhead player', async ({ page }) => {
      const playButtons = page.getByRole('button', { name: /Play/ });
      const stopButtons = page.getByRole('button', { name: /Stop/ });

      await expect(playButtons.first()).toBeVisible();

      // Start playback
      await playButtons.first().click();
      await page.waitForTimeout(500);

      // Stop playback
      await stopButtons.first().click();
    });

    // #769: the provider's one animation loop draws the playhead and the
    // progress overlay; they run no loop of their own. The page's own time
    // display is the second request per frame.
    test('one provider loop moves the playhead and the progress overlay', async ({ page }) => {
      const player = page.locator('[data-scroll-container]').first();
      await expect(player.locator('canvas').first()).toBeVisible({ timeout: 30000 });
      const playhead = player.locator('[data-playhead]');
      const play = page.getByRole('button', { name: /Play/ }).first();
      const stop = page.getByRole('button', { name: /Stop/ }).first();
      await expect(play).toBeEnabled();

      // Count animation-frame requests and distinct frames from here on.
      await page.evaluate(() => {
        const counter = { calls: 0, frames: 0, last: -1 };
        (window as unknown as { __raf: typeof counter }).__raf = counter;
        const original = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) =>
          original((t) => {
            counter.calls++;
            if (t !== counter.last) {
              counter.frames++;
              counter.last = t;
            }
            cb(t);
          });
      });

      const playheadX = () =>
        playhead.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
      const progressScale = () =>
        player.evaluate((el) => {
          const overlay = Array.from(el.querySelectorAll<HTMLElement>('div')).find((d) =>
            d.style.transform.startsWith('scaleX')
          );
          return overlay ? Number(overlay.style.transform.slice(7, -1)) : -1;
        });

      expect(await playheadX()).toBe(0);
      expect(await progressScale()).toBe(0);

      await play.click();
      await expect(async () => {
        expect(await playheadX()).toBeGreaterThan(5);
        expect(await progressScale()).toBeGreaterThan(0);
      }).toPass({ timeout: 10000 });

      const first = await playheadX();
      await expect(async () => {
        expect(await playheadX()).toBeGreaterThan(first + 5);
      }).toPass({ timeout: 10000 });

      const raf = await page.evaluate(
        () => (window as unknown as { __raf: { calls: number; frames: number } }).__raf
      );
      expect(raf.frames).toBeGreaterThan(10);
      // Two per frame: the provider's loop and the example's time display.
      // (Four before #769: the playhead and the overlay had their own.)
      expect(raf.calls / raf.frames).toBeLessThan(2.5);

      await stop.click();
      await expect(async () => {
        expect(await playheadX()).toBe(0);
        expect(await progressScale()).toBe(0);
      }).toPass({ timeout: 5000 });
    });

    test('speed controls are visible', async ({ page }) => {
      await expect(page.getByRole('button', { name: '0.5x' }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: '1x' }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: '2x' }).first()).toBeVisible();
    });
  });
});
