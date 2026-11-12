import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * A press on the tracks selects the track whose row is under the pointer
 * (#762). A track drawn in 'both' mode (spectrogram above waveform) is as tall
 * as it was as a waveform; the press handler once counted it twice as tall,
 * so a press on any row below it selected the row above.
 */

const rows = (page: Page) => page.locator('[data-track-row]');

/** Press inside a row: on its waveform, clear of the clip header at the top. */
async function pressRow(page: Page, row: Locator) {
  await expect(row).toBeVisible();
  let box: { x: number; y: number; width: number; height: number } | null = null;
  await expect(async () => {
    box = await row.boundingBox();
    expect(box).toBeTruthy();
  }).toPass();
  // The tracks on this page are short: stay near the left edge.
  await page.mouse.click(box!.x + 30, box!.y + box!.height * 0.75);
}

async function expectOnlySelected(page: Page, index: number) {
  await expect(rows(page).nth(index)).toHaveAttribute('data-selected', 'true');
  await expect(page.locator('[data-track-row][data-selected="true"]')).toHaveCount(1);
}

test.describe('Selecting a track by pressing on its row', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/mir-spectrogram`);
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
    await expect(rows(page)).toHaveCount(4);
  });

  test('every row selects its own track', async ({ page }) => {
    for (const index of [1, 3, 0, 2]) {
      await pressRow(page, rows(page).nth(index));
      await expectOnlySelected(page, index);
    }
  });

  test("rows below a 'both' track select their own track (#762)", async ({ page }) => {
    const first = rows(page).nth(0);
    const canvasesBefore = await first.locator('canvas').count();

    await page.getByRole('button', { name: 'Track menu' }).first().click();
    await page.getByRole('radio', { name: 'Both' }).check();

    // The first track now draws a spectrogram as well as its waveform.
    await expect(async () => {
      expect(await first.locator('canvas').count()).toBeGreaterThan(canvasesBefore);
    }).toPass({ timeout: 10000 });

    for (const index of [1, 2, 3, 0]) {
      await pressRow(page, rows(page).nth(index));
      await expectOnlySelected(page, index);
    }
  });
});
