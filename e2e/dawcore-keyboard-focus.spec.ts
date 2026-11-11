/**
 * dawcore: keyboard shortcuts and controls inside shadow DOM.
 *
 * The M/S buttons and sliders of <daw-track-controls> live in a shadow root.
 * At the `document` listener of <daw-keyboard-shortcuts> the event target is
 * the shadow host, so the shared handler must read the real target from the
 * composed path. Unit tests cannot show this (happy-dom does not retarget).
 *
 * Runs against the dawcore-native Vite example (see dawcore-spectrogram.spec.ts).
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.DAWCORE_NATIVE_URL ?? 'http://localhost:5273';

const isPlaying = (page: Page) =>
  page.evaluate(
    () => (document.querySelector('daw-editor') as unknown as { isPlaying: boolean }).isPlaying
  );

/** The first track's controls: locators pierce open shadow roots. */
const firstControls = (page: Page) => page.locator('daw-track-controls').first();

test.describe('dawcore shortcuts and focused shadow-DOM controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/multiclip.html`);
    await page.waitForFunction(
      () => {
        const editor = document.querySelector('daw-editor') as unknown as {
          tracks?: unknown[];
          shadowRoot: ShadowRoot | null;
        } | null;
        return (
          !!editor &&
          (editor.tracks?.length ?? 0) >= 4 &&
          !!editor.shadowRoot?.querySelector('daw-track-controls')
        );
      },
      null,
      { timeout: 30000 }
    );
  });

  test('Space is play/pause when focus is on the page', async ({ page }) => {
    // Positive control: the shortcut is live on this page.
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Space');
    await expect.poll(() => isPlaying(page), { timeout: 10000 }).toBe(true);
    await page.keyboard.press('Space');
    await expect.poll(() => isPlaying(page)).toBe(false);
  });

  test('Space on the focused Mute button toggles mute and does not play', async ({ page }) => {
    const mute = firstControls(page).getByRole('button', { name: 'M', exact: true });
    await expect(mute).toBeVisible();
    await expect(mute).not.toHaveClass(/muted-active/);
    await mute.focus();
    await expect(mute).toBeFocused();

    await page.keyboard.press('Space');
    await expect(mute).toHaveClass(/muted-active/);
    await page.waitForTimeout(800);
    expect(await isPlaying(page)).toBe(false);
  });

  test('Space on a focused slider does not play', async ({ page }) => {
    const slider = firstControls(page).locator('input[type="range"]').first();
    await expect(slider).toBeVisible();
    await slider.focus();
    await expect(slider).toBeFocused();

    await page.keyboard.press('Space');
    await page.waitForTimeout(800);
    expect(await isPlaying(page)).toBe(false);
  });
});
