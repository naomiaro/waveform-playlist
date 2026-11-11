import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';

/**
 * A custom effect registered with registerEffect() (an AudioWorkletNode, see
 * website/src/components/examples/demoTremoloEffect.ts) in the React effects
 * hooks: master chain, track chain, parameters, bypass, remove, WAV export.
 *
 * The page runs in native-context mode, which custom effects need.
 */

const TREMOLO = 'Tremolo (custom AudioWorklet)';

/** RMS of the sample-by-sample difference between two 16-bit PCM WAV files. */
function differenceRms(a: Buffer, b: Buffer): number {
  expect(a.length).toBe(b.length);
  let sum = 0;
  let count = 0;
  for (let i = 44; i + 1 < a.length; i += 2) {
    const d = (a.readInt16LE(i) - b.readInt16LE(i)) / 32768;
    sum += d * d;
    count++;
  }
  return Math.sqrt(sum / count);
}

async function exportMix(page: Page): Promise<Buffer> {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 120_000 }),
    page.getByRole('button', { name: 'Export Mix' }).click(),
  ]);
  return readFileSync(await download.path());
}

test.describe('Custom effects (registerEffect) in the React hooks', () => {
  test.setTimeout(180_000);

  test.beforeEach(async ({ page, baseURL }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(`${baseURL}/examples/wam-effects`);
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 60_000 });
    expect(errors).toEqual([]);
  });

  test('master chain: add, set a parameter, bypass and remove', async ({ page }) => {
    const rack = page.getByRole('group', { name: 'Master chain' });
    await rack.getByLabel('Effect to add').selectOption({ label: TREMOLO });
    await rack.getByRole('button', { name: 'Add', exact: true }).click();

    const entry = rack.getByRole('group', { name: TREMOLO });
    await expect(entry).toBeVisible();

    // Defaults from the registered definition.
    const rate = entry.getByLabel('Rate');
    await expect(rate).toHaveValue('6');
    await expect(entry.getByLabel('Depth')).toHaveValue('0.8');

    await rate.fill('12');
    await expect(rate).toHaveValue('12');
    await expect(entry).toContainText('12.0Hz');

    await entry.getByRole('button', { name: 'On', exact: true }).click();
    await expect(entry.getByRole('button', { name: 'Bypassed', exact: true })).toBeVisible();
    await entry.getByRole('button', { name: 'Bypassed', exact: true }).click();
    await expect(entry.getByRole('button', { name: 'On', exact: true })).toBeVisible();

    await entry.getByRole('button', { name: 'Remove' }).click();
    await expect(entry).toHaveCount(0);
    await expect(rack).toContainText('No master effects');
  });

  test('track chain: add and remove on the selected track', async ({ page }) => {
    const rack = page.getByRole('group', { name: /^(?!Master).* chain$/ });
    await rack.getByLabel('Effect to add').selectOption({ label: TREMOLO });
    await rack.getByRole('button', { name: 'Add', exact: true }).click();

    const entry = rack.getByRole('group', { name: TREMOLO });
    await expect(entry).toBeVisible();
    // The master chain did not get it.
    await expect(
      page.getByRole('group', { name: 'Master chain' }).getByRole('group', { name: TREMOLO })
    ).toHaveCount(0);

    await entry.getByRole('button', { name: 'Remove' }).click();
    await expect(entry).toHaveCount(0);
  });

  test('plays with the effect in the chain', async ({ page }) => {
    const rack = page.getByRole('group', { name: 'Master chain' });
    await rack.getByLabel('Effect to add').selectOption({ label: TREMOLO });
    await rack.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(rack.getByRole('group', { name: TREMOLO })).toBeVisible();

    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.getByRole('button', { name: 'Play' }).click();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeEnabled({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Stop' }).click();

    expect(errors).toEqual([]);
  });

  test('WAV export renders the effect, on the master chain and on a track; a bypassed one is left out', async ({
    page,
  }) => {
    const dry = await exportMix(page);

    // Master chain.
    const master = page.getByRole('group', { name: 'Master chain' });
    await master.getByLabel('Effect to add').selectOption({ label: TREMOLO });
    await master.getByRole('button', { name: 'Add', exact: true }).click();
    const masterEntry = master.getByRole('group', { name: TREMOLO });
    await expect(masterEntry).toBeVisible();

    const withMaster = await exportMix(page);
    expect(differenceRms(withMaster, dry)).toBeGreaterThan(0.05);

    await masterEntry.getByRole('button', { name: 'On', exact: true }).click();
    const bypassed = await exportMix(page);
    expect(differenceRms(bypassed, dry)).toBeLessThan(0.0001);

    await masterEntry.getByRole('button', { name: 'Remove' }).click();

    // One track's chain: a smaller change to the mix than the master's, but
    // well above the noise floor measured between two dry exports.
    const track = page.getByRole('group', { name: /^(?!Master).* chain$/ });
    await track.getByLabel('Effect to add').selectOption({ label: TREMOLO });
    await track.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(track.getByRole('group', { name: TREMOLO })).toBeVisible();

    const withTrack = await exportMix(page);
    expect(differenceRms(withTrack, dry)).toBeGreaterThan(0.005);
    expect(differenceRms(withTrack, withMaster)).toBeGreaterThan(0.005);
  });
});
