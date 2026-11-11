import { test, expect, type Page } from '@playwright/test';

/**
 * Keyboard shortcuts must not take a key that the focused control uses itself
 * (#710): Escape closes a modal dialog, and Space activates a button that was
 * reached with the keyboard.
 */

const timeDisplay = (page: Page) => page.getByText(/\d{2}:\d{2}:\d{2}\.\d{3}/).first();

async function expectNotPlaying(page: Page) {
  const before = await timeDisplay(page).textContent();
  await page.waitForTimeout(400);
  expect(await timeDisplay(page).textContent()).toBe(before);
}

async function expectPlaying(page: Page) {
  const before = await timeDisplay(page).textContent();
  await expect(async () => {
    expect(await timeDisplay(page).textContent()).not.toBe(before);
  }).toPass({ timeout: 10000 });
}

test.describe('Shortcuts and focused controls', () => {
  test('Escape closes the spectrogram settings modal', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/mir-spectrogram`);
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });

    await page.getByRole('button', { name: /menu/i }).first().click();
    await page.getByText('Spectrogram Settings...').first().click();
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    // Focus lands on a <select> inside the dialog.
    await expect(dialog.locator('select').first()).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test.describe('multi-clip', () => {
    test.beforeEach(async ({ page, baseURL }) => {
      await page.goto(`${baseURL}/examples/multi-clip`);
      await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
    });

    test('Space activates a button that was focused with the keyboard', async ({ page }) => {
      const mute = page.getByRole('button', { name: 'Mute' }).first();
      await mute.focus();
      // Arrive by keyboard so the button is :focus-visible.
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await expect(mute).toBeFocused();
      await expect(mute).toHaveAttribute('aria-pressed', 'false');

      await page.keyboard.press('Space');
      await expect(mute).toHaveAttribute('aria-pressed', 'true');
      await expectNotPlaying(page);
    });

    test('Space is still play/pause after clicking a button with the pointer', async ({ page }) => {
      const mute = page.getByRole('button', { name: 'Mute' }).first();
      await mute.click();
      await expect(mute).toHaveAttribute('aria-pressed', 'true');

      await page.keyboard.press('Space');
      await expectPlaying(page);
      // The click's mute is untouched by the shortcut.
      await expect(mute).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
