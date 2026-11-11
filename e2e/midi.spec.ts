import { test, expect } from '@playwright/test';

/**
 * MIDI example tests
 *
 * The page loads one .mid file with `useMidiTracks` from
 * `@waveform-playlist/midi` and renders one piano-roll track per MIDI channel.
 */

// Tracks in website/static/media/midi/RedHotChiliPeppers-Otherside.mid
const TRACK_COUNT = 13;

test.describe('MIDI Example', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/midi`);
    // Wait for Docusaurus to hydrate
    await page.waitForSelector('h1:has-text("MIDI Playback")', { timeout: 30000 });
    // Wait for playlist to be ready (all tracks loaded)
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
  });

  test('renders one piano-roll track per MIDI channel', async ({ page }) => {
    await expect(page.locator('[data-track-row]')).toHaveCount(TRACK_COUNT);
    await expect(page.locator('[data-clip-container]')).toHaveCount(TRACK_COUNT);
    // Each track has drawn something: at least one canvas per row.
    await expect(async () => {
      const rowsWithCanvas = await page
        .locator('[data-track-row]')
        .evaluateAll((rows) => rows.filter((row) => row.querySelector('canvas')).length);
      expect(rowsWithCanvas).toBe(TRACK_COUNT);
    }).toPass({ timeout: 5000 });
    await expect(page.getByText(/Loading MIDI tracks/)).toHaveCount(0);
  });

  test('loads the .mid file once and then stays settled', async ({ page, baseURL }) => {
    const midiRequests: string[] = [];
    const errors: string[] = [];
    page.on('request', (request) => {
      if (/\.mid(\?|$)/.test(request.url())) midiRequests.push(request.url());
    });
    page.on('pageerror', (error) => errors.push(String(error)));

    await page.goto(`${baseURL}/examples/midi`);
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
    await expect(page.locator('[data-track-row]')).toHaveCount(TRACK_COUNT);

    // A reload loop in the hook would keep re-fetching or re-rendering the
    // tracks; give it time to show, then check nothing moved.
    await page.waitForTimeout(1500);

    expect(midiRequests).toHaveLength(1);
    await expect(page.locator('[data-track-row]')).toHaveCount(TRACK_COUNT);
    await expect(page.locator('[data-playlist-state="ready"]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('play button starts playback', async ({ page }) => {
    const playButton = page.getByRole('button', { name: 'Play' });
    await expect(playButton).toBeVisible();
    await playButton.click();

    const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
    await expect(async () => {
      expect(await timeDisplay.textContent()).not.toBe('00:00:00.000');
    }).toPass({ timeout: 10000 });

    await page.getByRole('button', { name: 'Stop' }).click();
  });
});
