import { test, expect } from '@playwright/test';

/**
 * Flexible API example tests
 *
 * The page builds its own transport and time display from the hooks. Its
 * stopped time display shows `currentTime` from `useCurrentTime()`; it must
 * follow a seek made while nothing is playing (#740), because no other hook
 * re-renders it then.
 */

test.describe('Flexible API Example', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/flexible-api`);
    await page.waitForSelector('h1:has-text("Flexible API Example")', { timeout: 30000 });
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
  });

  test('the time display follows the skip buttons while stopped', async ({ page }) => {
    const time = page.getByTestId('time-display');
    await expect(time).toHaveText('00:00:00.000');

    await page.getByRole('button', { name: 'Skip +5s' }).click();
    await expect(time).toHaveText('00:00:05.000');

    await page.getByRole('button', { name: 'Skip +5s' }).click();
    await expect(time).toHaveText('00:00:10.000');

    await page.getByRole('button', { name: 'Skip -5s' }).click();
    await expect(time).toHaveText('00:00:05.000');
  });

  test('the time display follows a click on the waveform while stopped', async ({ page }) => {
    const time = page.getByTestId('time-display');
    await expect(time).toHaveText('00:00:00.000');

    const row = page.locator('[data-track-row]').first();
    await row.scrollIntoViewIfNeeded();
    await expect(row).toBeVisible();
    let box: { x: number; y: number; width: number; height: number } | null = null;
    await expect(async () => {
      box = await row.boundingBox();
      expect(box).toBeTruthy();
    }).toPass();

    await page.mouse.click(box!.x + 300, box!.y + box!.height - 10);
    await expect(time).not.toHaveText('00:00:00.000');
    const first = await time.textContent();

    await page.mouse.click(box!.x + 500, box!.y + box!.height - 10);
    await expect(time).not.toHaveText(first!);
  });

  // #843: the page's own volume slider (Radix, not an <input>) passes one
  // gesture id per drag and per key press, so one Undo takes the whole move
  // back. Keyboard Undo does not fire while a slider has focus (#730), so a
  // click on the heading moves focus away before Ctrl+Z.
  test('a volume drag and a held arrow key are one undo step each', async ({ page }) => {
    const panel = page.locator('[data-track-controls]').first();
    const slider = panel.getByRole('slider');
    await expect(slider).toHaveAttribute('aria-valuenow', '100');
    await slider.scrollIntoViewIfNeeded();
    const heading = page.locator('h1:has-text("Flexible API Example")');
    const undo = async () => {
      await heading.click();
      await page.keyboard.press('Control+z');
    };

    let box: { x: number; y: number; width: number; height: number } | null = null;
    await expect(async () => {
      box = await panel.locator('.rt-SliderRoot').boundingBox();
      expect(box).toBeTruthy();
    }).toPass({ timeout: 5000 });
    const y = box!.y + box!.height / 2;
    await page.mouse.move(box!.x + box!.width - 2, y);
    await page.mouse.down();
    for (const fraction of [0.8, 0.6, 0.4]) {
      await page.mouse.move(box!.x + box!.width * fraction, y, { steps: 3 });
    }
    await page.mouse.up();
    await expect(async () => {
      expect(Number(await slider.getAttribute('aria-valuenow'))).toBeLessThan(60);
    }).toPass({ timeout: 5000 });
    await undo();
    await expect(slider).toHaveAttribute('aria-valuenow', '100');

    await slider.focus();
    for (let i = 0; i < 5; i++) await page.keyboard.down('ArrowLeft');
    await page.keyboard.up('ArrowLeft');
    await expect(slider).toHaveAttribute('aria-valuenow', '95');
    await undo();
    await expect(slider).toHaveAttribute('aria-valuenow', '100');
  });
});
