import { test, expect } from '@playwright/test';

/**
 * BBC Waveform Data example tests
 *
 * These tests verify the pre-computed peaks functionality:
 * - Page structure and info display
 * - Track loading with BBC peaks
 * - Playback controls
 * - Track controls (mute, solo, volume, pan)
 * - Documentation display
 */

test.describe('BBC Waveform Data Example', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/waveform-data`);
    // Wait for page to load
    await page.waitForSelector('h1:has-text("BBC Waveform Data")', { timeout: 30000 });
    // Wait for playlist to be ready (all tracks loaded)
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
  });

  test.describe('Page Structure', () => {
    test('displays page title and description', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'BBC Waveform Data Example' })).toBeVisible();
      await expect(page.getByText('pre-computed peaks format')).toBeVisible();
    });

    test('displays size comparison info', async ({ page }) => {
      // Shows BBC Peaks size
      await expect(page.getByText('BBC Peaks (8-bit)')).toBeVisible();
      // Shows Full Audio size
      await expect(page.getByText('Full Audio')).toBeVisible();
      // Shows size ratio
      await expect(page.getByText('smaller')).toBeVisible();
    });

    test('displays KB and MB size units', async ({ page }) => {
      // Specific size values shown in the comparison
      await expect(page.getByText('218 KB')).toBeVisible();
      await expect(page.getByText('1.6 MB')).toBeVisible();
    });
  });

  test.describe('Tracks', () => {
    test('displays all track names', async ({ page }) => {
      // Use exact match to avoid matching track names in code examples
      await expect(page.getByText('Kick', { exact: true })).toBeVisible();
      await expect(page.getByText('Bass', { exact: true })).toBeVisible();
      await expect(page.getByText('Synth 1', { exact: true })).toBeVisible();
      await expect(page.getByText('Synth 2', { exact: true })).toBeVisible();
    });

    test('has 4 tracks loaded', async ({ page }) => {
      const muteButtons = page.getByRole('button', { name: 'Mute' });
      const count = await muteButtons.count();
      expect(count).toBe(4);
    });
  });

  test.describe('Playback Controls', () => {
    test('play, pause, stop buttons exist', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
    });

    test('pause and stop are disabled initially', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Pause' })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'Stop' })).toBeDisabled();
    });

    test('play button starts playback', async ({ page }) => {
      await page.getByRole('button', { name: 'Play' }).click();
      await page.waitForTimeout(200);

      // Time display should advance
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      const time = await timeDisplay.textContent();
      expect(time).not.toBe('00:00:00.000');

      // Clean up
      await page.getByRole('button', { name: 'Stop' }).click();
    });

    test('pause and stop are enabled during playback', async ({ page }) => {
      await page.getByRole('button', { name: 'Play' }).click();

      await expect(page.getByRole('button', { name: 'Pause' })).toBeEnabled();
      await expect(page.getByRole('button', { name: 'Stop' })).toBeEnabled();

      await page.getByRole('button', { name: 'Stop' }).click();
    });
  });

  test.describe('Zoom Controls', () => {
    test('zoom in and out buttons exist', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Zoom In' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Zoom Out' })).toBeVisible();
    });

    test('zoom in button is clickable', async ({ page }) => {
      const zoomIn = page.getByRole('button', { name: 'Zoom In' });
      await zoomIn.click();
      // Should still be functional
      await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    });

    test('zoom out button is clickable', async ({ page }) => {
      const zoomOut = page.getByRole('button', { name: 'Zoom Out' });
      await zoomOut.click();
      // Should still be functional
      await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
    });
  });

  test.describe('Time Display', () => {
    test('time display shows initial time', async ({ page }) => {
      const timeDisplay = page.getByText('00:00:00.000');
      await expect(timeDisplay).toBeVisible();
    });
  });

  test.describe('Master Volume', () => {
    test('master volume slider exists', async ({ page }) => {
      const slider = page.getByRole('slider', { name: 'Master Volume' });
      await expect(slider).toBeVisible();
    });

    test('master volume defaults to 100', async ({ page }) => {
      const slider = page.getByRole('slider', { name: 'Master Volume' });
      await expect(slider).toHaveValue('100');
    });

    test('can adjust master volume', async ({ page }) => {
      const slider = page.getByRole('slider', { name: 'Master Volume' });
      await slider.fill('50');
      await expect(slider).toHaveValue('50');
    });
  });

  test.describe('Automatic Scroll', () => {
    test('automatic scroll checkbox exists and is checked', async ({ page }) => {
      const checkbox = page.getByRole('checkbox', { name: 'Automatic Scroll' });
      await expect(checkbox).toBeVisible();
      await expect(checkbox).toBeChecked();
    });

    test('can toggle automatic scroll', async ({ page }) => {
      const checkbox = page.getByRole('checkbox', { name: 'Automatic Scroll' });

      await checkbox.uncheck();
      await expect(checkbox).not.toBeChecked();

      await checkbox.check();
      await expect(checkbox).toBeChecked();
    });
  });

  test.describe('Track Controls', () => {
    test('each track has mute button', async ({ page }) => {
      const muteButtons = page.getByRole('button', { name: 'Mute' });
      await expect(muteButtons).toHaveCount(4);
    });

    test('each track has solo button', async ({ page }) => {
      const soloButtons = page.getByRole('button', { name: 'Solo' });
      await expect(soloButtons).toHaveCount(4);
    });

    test('can mute a track', async ({ page }) => {
      const muteButton = page.getByRole('button', { name: 'Mute' }).first();
      await muteButton.click();
      // Button should still be functional
      await muteButton.click();
    });

    test('can solo a track', async ({ page }) => {
      const soloButton = page.getByRole('button', { name: 'Solo' }).first();
      await soloButton.click();
      // Button should still be functional
      await soloButton.click();
    });

    test('each track has volume slider', async ({ page }) => {
      // Volume sliders have max="1" min="0"
      const volumeSliders = page.locator('input[type="range"][max="1"][min="0"]');
      await expect(volumeSliders).toHaveCount(4);
    });

    test('each track has pan slider', async ({ page }) => {
      // Pan sliders have max="1" min="-1"
      const panSliders = page.locator('input[type="range"][max="1"][min="-1"]');
      await expect(panSliders).toHaveCount(4);
    });

    test('pan sliders have L and R labels', async ({ page }) => {
      const leftLabels = page.getByText('L');
      const rightLabels = page.getByText('R');

      await expect(async () => {
        expect(await leftLabels.count()).toBeGreaterThanOrEqual(4);
        expect(await rightLabels.count()).toBeGreaterThanOrEqual(4);
      }).toPass({ timeout: 5000 });
    });
  });

  test.describe('Timescale', () => {
    test('displays time markers', async ({ page }) => {
      // Use exact match to avoid matching the time display (00:00:00.000)
      await expect(page.getByText('0:00', { exact: true })).toBeVisible();
      await expect(page.getByText('0:10', { exact: true })).toBeVisible();
    });
  });

  test.describe('Documentation', () => {
    test('about section is visible', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'About BBC Waveform Data' })).toBeVisible();
    });

    test('displays benefits of BBC peaks', async ({ page }) => {
      await expect(page.getByText('Instant waveform display')).toBeVisible();
      await expect(page.getByText('Reduced server load')).toBeVisible();
      await expect(page.getByText('Consistent rendering')).toBeVisible();
      // Use exact match to avoid matching the heading "Fully Progressive Loading"
      await expect(page.getByText('Progressive loading', { exact: true })).toBeVisible();
    });

    test('displays audiowaveform link', async ({ page }) => {
      const link = page.getByRole('link', { name: 'audiowaveform' });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', 'https://github.com/bbc/audiowaveform');
    });

    test('displays code examples', async ({ page }) => {
      // Check for CLI example
      await expect(page.getByText('brew install audiowaveform')).toBeVisible();
      // Check for code example
      await expect(page.getByText('loadWaveformData')).toBeVisible();
    });

    test('generating peaks section exists', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Generating BBC Peaks Files' })).toBeVisible();
    });

    test('progressive loading section exists', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Fully Progressive Loading' })).toBeVisible();
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('Space toggles play/pause', async ({ page }) => {
      await page.keyboard.press('Space');
      await page.waitForTimeout(100);

      // Time should advance
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);

      // Pause
      await page.keyboard.press('Space');
      const timeAfterPause = await timeDisplay.textContent();

      // Wait and verify time stopped
      await page.waitForTimeout(100);
      const timeAfterWait = await timeDisplay.textContent();
      expect(timeAfterPause).toBe(timeAfterWait);
    });

    test('0 rewinds to start', async ({ page }) => {
      // Play briefly
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
      await page.keyboard.press('Space');

      // Press 0 to rewind
      await page.keyboard.press('0');

      const timeDisplay = page.getByText('00:00:00.000');
      await expect(timeDisplay).toBeVisible();
    });
  });

  test.describe('Audio Credits', () => {
    test('displays audio credits', async ({ page }) => {
      await expect(page.getByText('Audio Credits:')).toBeVisible();
      await expect(page.getByText('"Ubiquitous"')).toBeVisible();
    });

    test('credits link to Cambridge Music Technology', async ({ page }) => {
      const link = page.getByRole('link', { name: 'Cambridge Music Technology' });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', 'https://cambridge-mt.com/ms3/mtk/');
    });

    test('displays CC BY 4.0 license', async ({ page }) => {
      const licenseLink = page.getByRole('link', { name: 'CC BY 4.0' });
      await expect(licenseLink).toBeVisible();
    });
  });
});
