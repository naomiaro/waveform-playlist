import { test, expect } from '@playwright/test';

/**
 * Flexible API example tests
 *
 * The page builds its own transport and time display from the hooks. Its
 * stopped time display shows `currentTime` from `useCurrentTime()`; it must
 * follow a seek made while nothing is playing (#740), because no other hook
 * re-renders it then.
 */

const TIME = /^\d{2}:\d{2}:\d{2}\.\d{3}$/;

test.describe('Flexible API Example', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/flexible-api`);
    await page.waitForSelector('h1:has-text("Flexible API Example")', { timeout: 30000 });
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
  });

  test('the time display follows the skip buttons while stopped', async ({ page }) => {
    const time = page.locator('span').filter({ hasText: TIME }).first();
    await expect(time).toHaveText('00:00:00.000');

    await page.getByRole('button', { name: 'Skip +5s' }).click();
    await expect(time).toHaveText('00:00:05.000');

    await page.getByRole('button', { name: 'Skip +5s' }).click();
    await expect(time).toHaveText('00:00:10.000');

    await page.getByRole('button', { name: 'Skip -5s' }).click();
    await expect(time).toHaveText('00:00:05.000');
  });

  test('the time display follows a click on the waveform while stopped', async ({ page }) => {
    const time = page.locator('span').filter({ hasText: TIME }).first();
    await expect(time).toHaveText('00:00:00.000');

    const row = page.locator('[data-track-row]').first();
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
});
