import { test, expect } from '@playwright/test';

/**
 * How fast the first player's position advances against the clock, over about
 * a second. Both readings of each pair are taken inside the page, so runner
 * delays between calls do not enter the ratio.
 */
async function playbackSpeed(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(async () => {
    const element = document.querySelector('[aria-label="Audio position"]');
    const read = () => {
      const [hours, minutes, rest] = (element?.textContent ?? '').split(':');
      return {
        position: Number(hours) * 3600 + Number(minutes) * 60 + Number(rest),
        clock: performance.now() / 1000,
      };
    };
    const before = read();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const after = read();
    return (after.position - before.position) / (after.clock - before.clock);
  });
}
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
    // progress overlay; they run no loop of their own. Since #688 the time
    // display is the library's AudioPosition, on the same loop.
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
      // One per frame: the provider's loop. (Four before #769: the playhead
      // and the overlay had their own; two until #688: the page's own time
      // display.)
      expect(raf.calls / raf.frames).toBeLessThan(1.5);

      await stop.click();
      await expect(async () => {
        expect(await playheadX()).toBe(0);
        expect(await progressScale()).toBe(0);
      }).toPass({ timeout: 5000 });
    });

    // #769: a position asked for before the player has loaded (`?t=8` on this
    // page, from a child's effect) is stored, shown, and is where Play starts.
    // The real media element must not report 0 over it while it loads.
    test('a start position set before the player is ready is kept, and Play starts there', async ({
      page,
      baseURL,
    }) => {
      await page.goto(`${baseURL}/examples/media-element?t=8`);
      const player = page.locator('[data-scroll-container]').first();
      await expect(player.locator('canvas').first()).toBeVisible({ timeout: 30000 });
      const playhead = player.locator('[data-playhead]');
      const timeDisplay = page.getByLabel('Audio position').first();
      const play = page.getByRole('button', { name: /Play/ }).first();
      const stop = page.getByRole('button', { name: /Stop/ }).first();
      const playheadX = () =>
        playhead.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
      const shownSeconds = async () => {
        // hh:mm:ss.uuu, whole seconds
        const [hours, minutes, seconds] = ((await timeDisplay.textContent()) ?? '').split(':');
        return Number(hours) * 3600 + Number(minutes) * 60 + Math.floor(Number(seconds));
      };

      // At rest, before any Play: the cursor and the time display are at 8 s (of 16).
      await expect(timeDisplay).toHaveText('00:00:08.000', { timeout: 10000 });
      let restingX = 0;
      await expect(async () => {
        restingX = await playheadX();
        expect(restingX).toBeGreaterThan(100);
      }).toPass({ timeout: 5000 });

      // Still there after the media element has had time to load and report.
      await page.waitForTimeout(1500);
      expect(await playheadX()).toBe(restingX);
      expect(await shownSeconds()).toBe(8);

      await play.click();
      await expect(async () => {
        expect(await playheadX()).toBeGreaterThan(restingX + 5);
      }).toPass({ timeout: 10000 });
      // It went on from 8 s; it did not start again from 0.
      expect(await shownSeconds()).toBeGreaterThanOrEqual(8);

      // Stop returns the cursor to where playback started (#688): 8 s, not 0.
      await stop.click();
      await expect(async () => {
        expect(Math.abs((await playheadX()) - restingX)).toBeLessThanOrEqual(1);
        expect(await shownSeconds()).toBe(8);
      }).toPass({ timeout: 5000 });
    });

    // #688: the MediaElement provider follows the WebAudio provider's rules.
    test('Stop returns the cursor to where playback started; a seek while stopped stays put', async ({
      page,
    }) => {
      const player = page.locator('[data-scroll-container]').first();
      await expect(player.locator('canvas').first()).toBeVisible({ timeout: 30000 });
      const playhead = player.locator('[data-playhead]');
      const play = page.getByRole('button', { name: /Play/ }).first();
      const stop = page.getByRole('button', { name: /Stop/ }).first();
      const playheadX = () =>
        playhead.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await player.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });
      const y = box!.y + box!.height / 2;

      // A click while stopped moves the cursor there.
      await page.mouse.click(box!.x + 120, y);
      await expect(async () => {
        expect(Math.abs((await playheadX()) - 120)).toBeLessThanOrEqual(1);
      }).toPass({ timeout: 5000 });

      await play.click();
      await expect(async () => {
        expect(await playheadX()).toBeGreaterThan(140);
      }).toPass({ timeout: 10000 });

      await stop.click();
      await expect(async () => {
        expect(Math.abs((await playheadX()) - 120)).toBeLessThanOrEqual(1);
      }).toPass({ timeout: 5000 });
      // It rests there: the media element does not report another position.
      await page.waitForTimeout(600);
      expect(Math.abs((await playheadX()) - 120)).toBeLessThanOrEqual(1);

      // Play again starts from the same place.
      await play.click();
      await expect(async () => {
        expect(await playheadX()).toBeGreaterThan(140);
      }).toPass({ timeout: 10000 });
      expect(await playheadX()).toBeLessThan(400);
      await stop.click();
    });

    test('a press during playback moves playback there at once, and a drag selects nothing', async ({
      page,
    }) => {
      const player = page.locator('[data-scroll-container]').first();
      await expect(player.locator('canvas').first()).toBeVisible({ timeout: 30000 });
      const playhead = player.locator('[data-playhead]');
      const play = page.getByRole('button', { name: /Play/ }).first();
      const pause = page.getByRole('button', { name: /Pause/ }).first();
      const stop = page.getByRole('button', { name: /Stop/ }).first();
      const playheadX = () =>
        playhead.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await player.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });
      const y = box!.y + box!.height / 2;

      await play.click();
      await expect(async () => {
        expect(await playheadX()).toBeGreaterThan(5);
      }).toPass({ timeout: 10000 });

      // Press far ahead and hold: playback is already there before the release.
      await page.mouse.move(box!.x + 300, y);
      await page.mouse.down();
      await expect(async () => {
        expect(await playheadX()).toBeGreaterThanOrEqual(300);
      }).toPass({ timeout: 5000 });
      await page.mouse.move(box!.x + 200, y, { steps: 5 });
      await expect(page.locator('[data-selection]')).toHaveCount(0);
      await page.mouse.up();

      await expect(page.locator('[data-selection]')).toHaveCount(0);
      await expect(pause).toBeEnabled();
      expect(await playheadX()).toBeGreaterThanOrEqual(300);

      // Stop returns to where this play began: the press.
      await stop.click();
      await expect(async () => {
        expect(Math.abs((await playheadX()) - 300)).toBeLessThanOrEqual(1);
      }).toPass({ timeout: 5000 });
    });

    test('a source that cannot be loaded is reported', async ({ page, baseURL }) => {
      const warnings: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'warning') warnings.push(msg.text());
      });
      await page.route('**/*.opus', (route) => route.abort());
      await page.goto(`${baseURL}/examples/media-element`);
      await expect(async () => {
        expect(warnings.some((text) => text.includes('Media failed to load'))).toBe(true);
      }).toPass({ timeout: 30000 });
    });

    // #688, part 2: the page's transport is the library's, on the shared hooks.
    test('the speed dropdown lists the speeds and changes the playback rate', async ({ page }) => {
      const speed = page.getByRole('combobox', { name: 'Playback speed' }).first();
      await expect(speed).toBeVisible();
      await expect(speed).toHaveValue('1');
      expect(
        await speed.evaluate((el) => [...(el as HTMLSelectElement).options].map((o) => o.value))
      ).toEqual(['0.5', '0.75', '1', '1.25', '1.5', '2']);

      // The media element is not in the document, so the rate is read from
      // what it does: how fast the position advances against the clock.
      const position = page.getByLabel('Audio position').first();
      await page.getByRole('button', { name: 'Play' }).first().click();
      await expect(position).not.toHaveText('00:00:00.000', { timeout: 10000 });
      await page.waitForTimeout(200);
      const normal = await playbackSpeed(page);
      expect(normal).toBeGreaterThan(0.8);
      expect(normal).toBeLessThan(1.2);

      await speed.selectOption('2');
      await expect(speed).toHaveValue('2');
      await page.waitForTimeout(200);
      const doubled = await playbackSpeed(page);
      expect(doubled).toBeGreaterThan(1.7);
      expect(doubled).toBeLessThan(2.3);
      await page.getByRole('button', { name: 'Stop' }).first().click();
    });

    // Review of #688 part 2: a replaced player (here: the Preserve Pitch
    // toggle recreates it) runs at the speed the user chose, which is what
    // the dropdown goes on showing. Before, it ran at the provider's prop.
    test('the chosen speed survives a replaced player', async ({ page }) => {
      const speed = page.getByRole('combobox', { name: 'Playback speed' }).first();
      const position = page.getByLabel('Audio position').first();
      await speed.selectOption('2');
      await page.getByRole('button', { name: 'Off', exact: true }).first().click();
      await expect(speed).toHaveValue('2');

      await page.getByRole('button', { name: 'Play' }).first().click();
      await expect(position).not.toHaveText('00:00:00.000', { timeout: 10000 });
      await page.waitForTimeout(200);
      const replaced = await playbackSpeed(page);
      expect(replaced).toBeGreaterThan(1.7);
      expect(replaced).toBeLessThan(2.3);
      await page.getByRole('button', { name: 'Stop' }).first().click();
    });

    test('Stop is disabled unless playing; after Pause the cursor stays where it paused', async ({
      page,
    }) => {
      const play = page.getByRole('button', { name: 'Play' }).first();
      const pause = page.getByRole('button', { name: 'Pause' }).first();
      const stop = page.getByRole('button', { name: 'Stop' }).first();
      const position = page.getByLabel('Audio position').first();

      await expect(play).toBeEnabled();
      await expect(pause).toBeDisabled();
      await expect(stop).toBeDisabled();

      await play.click();
      await expect(stop).toBeEnabled();
      await expect(position).not.toHaveText('00:00:00.000', { timeout: 10000 });
      await pause.click();
      await expect(stop).toBeDisabled();
      await expect(play).toBeEnabled();
      const paused = await position.textContent();
      expect(paused).not.toBe('00:00:00.000');
      await page.waitForTimeout(300);
      await expect(position).toHaveText(paused ?? '');
    });

    // The library Play button plays a highlighted range and stops at its end
    // with the cursor back at its start (#688; unit tests only until the page
    // had a button that passes a duration).
    test('Play plays a dragged selection and returns the cursor to its start', async ({ page }) => {
      const player = page.locator('[data-scroll-container]').first();
      await expect(player.locator('canvas').first()).toBeVisible({ timeout: 30000 });
      await player.scrollIntoViewIfNeeded();
      const play = page.getByRole('button', { name: 'Play' }).first();
      const position = page.getByLabel('Audio position').first();
      const playhead = player.locator('[data-playhead]');
      const playheadX = () =>
        playhead.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);

      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await player.boundingBox();
        expect(box).toBeTruthy();
      }).toPass();
      const y = box!.y + box!.height / 2;
      // Left to right, about one second of audio wide.
      await page.mouse.move(box!.x + 100, y);
      await page.mouse.down();
      await page.mouse.move(box!.x + 130, y, { steps: 5 });
      await page.mouse.move(box!.x + 160, y, { steps: 5 });
      await page.mouse.up();

      let startX = 0;
      await expect(async () => {
        startX = await playheadX();
        expect(Math.abs(startX - 100)).toBeLessThanOrEqual(2);
      }).toPass({ timeout: 5000 });
      const startText = await position.textContent();
      expect(startText).not.toBe('00:00:00.000');

      await play.click();
      await expect(async () => {
        expect(await playheadX()).toBeGreaterThan(startX + 5);
      }).toPass({ timeout: 10000 });

      // It stops by itself at the end of the range: Play is enabled again and
      // the cursor is back at the start of the selection, not at its end.
      await expect(play).toBeEnabled({ timeout: 15000 });
      await expect(async () => {
        expect(Math.abs((await playheadX()) - startX)).toBeLessThanOrEqual(1);
      }).toPass({ timeout: 5000 });
      await expect(position).toHaveText(startText ?? '');
    });
  });
});
