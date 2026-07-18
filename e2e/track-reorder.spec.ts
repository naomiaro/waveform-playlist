import { test, expect } from '@playwright/test';

/**
 * Track name lives in a sibling `span` (ellipsis-truncated inline style) inside
 * the same Controls panel as the move buttons: button -> ButtonGroup -> Controls.
 */
function trackNameFromButton(btn: Element): string | null {
  const panel = btn.closest('div')?.parentElement;
  return panel?.querySelector<HTMLElement>('span[style*="ellipsis"]')?.textContent ?? null;
}

test.describe('Track Reordering', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/stem-tracks`);
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
  });

  test('move down button swaps track order', async ({ page }) => {
    const firstPanelName = await page
      .locator('button[aria-label="Move track down"]')
      .first()
      .evaluate(trackNameFromButton);

    await page.getByRole('button', { name: 'Move track down' }).first().click();

    await expect(async () => {
      const nowSecondName = await page
        .locator('button[aria-label="Move track down"]')
        .nth(1)
        .evaluate(trackNameFromButton);
      expect(nowSecondName).toBe(firstPanelName);
    }).toPass({ timeout: 5000 });
  });

  test('move up is disabled on the first track, move down on the last', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Move track up' }).first()).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Move track down' }).last()).toBeDisabled();
  });
});
