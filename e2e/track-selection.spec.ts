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
  // The lower rows are below the fold, and a raw mouse click does not scroll.
  await row.scrollIntoViewIfNeeded();
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
    const menuButton = page.getByRole('button', { name: 'Track menu' }).first();
    const both = page.getByRole('radio', { name: 'Both' });

    // Choosing a mode closes the menu.
    await menuButton.click();
    await both.click();
    await expect(both).toHaveCount(0);

    // Open it again to see that the first track is in 'both' mode, then close
    // it with its own button (Escape would also reach the Stop shortcut).
    await menuButton.click();
    await expect(both).toBeChecked();
    await menuButton.click();
    await expect(both).toHaveCount(0);

    for (const index of [1, 2, 3, 0]) {
      await pressRow(page, rows(page).nth(index));
      await expectOnlySelected(page, index);
    }
  });
});
