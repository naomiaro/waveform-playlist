import { test, expect, type Page } from '@playwright/test';

/**
 * #687: the control panel of a track is composed from pieces bound to that
 * track, and the mixer state is kept by track id.
 */

async function ready(page: Page, baseURL: string | undefined, route: string) {
  await page.goto(`${baseURL}/examples/${route}`);
  await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
}

/** Name, mute and volume of every panel, top to bottom. */
async function panels(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-track-controls]')].map((slot) => ({
      id: slot.getAttribute('data-track-controls'),
      name: slot.querySelector('[data-track-name]')?.textContent ?? null,
      muted: slot.querySelector('button[aria-pressed]')?.getAttribute('aria-pressed') ?? null,
      volume: slot.querySelector<HTMLInputElement>('input[aria-label="Volume"]')?.value ?? null,
    }))
  );
}

test.describe('Track controls', () => {
  test('removing a track leaves the other tracks as they were set', async ({ page, baseURL }) => {
    await ready(page, baseURL, 'mir-spectrogram');
    const main = page.locator('main');
    await expect(main.getByRole('button', { name: 'Mute', exact: true })).toHaveCount(4);
    const before = await panels(page);

    await main.getByRole('slider', { name: 'Volume', exact: true }).nth(1).fill('0.3');
    await main.getByRole('button', { name: 'Mute', exact: true }).nth(2).click();
    await expect(async () => {
      const now = await panels(page);
      expect(now[1].volume).toBe('0.3');
      expect(now[2].muted).toBe('true');
    }).toPass({ timeout: 5000 });

    // The remove button of the FIRST track.
    await main.getByTitle('Remove track').first().click();

    await expect(async () => {
      const after = await panels(page);
      expect(after.map((panel) => panel.id)).toEqual(before.slice(1).map((panel) => panel.id));
      expect(after.map((panel) => panel.name)).toEqual(before.slice(1).map((panel) => panel.name));
      // Until #687 every remaining panel came back unmuted at volume 1.
      expect(after[0].volume).toBe('0.3');
      expect(after[1].muted).toBe('true');
      expect(after[2].muted).toBe('false');
      expect(after[2].volume).toBe('1');
    }).toPass({ timeout: 10000 });
  });

  test('the remove button removes its own track and does not select another', async ({
    page,
    baseURL,
  }) => {
    await ready(page, baseURL, 'mir-spectrogram');
    const main = page.locator('main');
    await expect(main.getByTitle('Remove track')).toHaveCount(4);
    const before = await panels(page);

    await main.getByTitle('Remove track').nth(2).click();

    await expect(main.getByTitle('Remove track')).toHaveCount(3);
    const after = await panels(page);
    expect(after.map((panel) => panel.id)).toEqual(
      before.filter((_, index) => index !== 2).map((panel) => panel.id)
    );
    // Nothing is selected. (The removed track's row is gone either way: that
    // a click on the button does not select is the unit test's to show.)
    await expect(page.locator('[data-track-row][data-selected="true"]')).toHaveCount(0);
  });

  test('a click in a panel of the page selects that track', async ({ page, baseURL }) => {
    // The flexible-api page draws its own panel (Radix buttons) with useTrack().
    await ready(page, baseURL, 'flexible-api');
    const slots = page.locator('[data-track-controls]');
    await expect(slots.nth(2)).toBeVisible();
    const id = await slots.nth(2).getAttribute('data-track-controls');

    // On the track's name: not a button, so nothing else happens.
    await slots.nth(2).locator('span').first().click();

    await expect(page.locator('[data-track-row][data-selected="true"]')).toHaveAttribute(
      'data-track-id',
      id!
    );
  });

  test('the pieces of a panel of the page change their own track', async ({ page, baseURL }) => {
    await ready(page, baseURL, 'flexible-api');
    const slots = page.locator('[data-track-controls]');
    await expect(slots.nth(1)).toBeVisible();
    const mute = (index: number) =>
      slots.nth(index).getByRole('button', { name: 'M', exact: true });
    const before0 = await mute(0).getAttribute('data-accent-color');

    await mute(1).click();

    // Radix draws the muted button in red; the first track's button is untouched.
    await expect(mute(1)).toHaveAttribute('data-accent-color', 'red');
    await expect(mute(0)).toHaveAttribute('data-accent-color', before0 ?? 'gray');
  });

  test('the effects page draws the built-in pieces with its own button, per track', async ({
    page,
    baseURL,
  }) => {
    await ready(page, baseURL, 'effects');
    const slots = page.locator('[data-track-controls]');
    // The page loads four stems; wait for all four panels before looping.
    await expect(slots).toHaveCount(4);
    const count = 4;
    for (let index = 0; index < count; index++) {
      const slot = slots.nth(index);
      await expect(slot.getByRole('button', { name: 'Mute', exact: true })).toHaveCount(1);
      await expect(slot.getByRole('button', { name: 'Solo', exact: true })).toHaveCount(1);
      await expect(slot.getByRole('slider', { name: 'Volume', exact: true })).toHaveCount(1);
      await expect(slot.getByRole('button', { name: /FX/ })).toHaveCount(1);
      await expect(slot.getByTitle('Remove track')).toHaveCount(1);
      // This page's panel has no pan slider.
      await expect(slot.getByRole('slider', { name: 'Pan', exact: true })).toHaveCount(0);
    }
    // Mute is the built-in piece: it reports its state.
    const mute = slots.nth(1).getByRole('button', { name: 'Mute', exact: true });
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    await expect(slots.nth(0).getByRole('button', { name: 'Mute', exact: true })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });
});
