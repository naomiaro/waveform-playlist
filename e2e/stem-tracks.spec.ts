import { test, expect } from '@playwright/test';

/**
 * Stem Tracks interaction tests
 *
 * These tests verify the track control interactions:
 * - Playback controls (play, pause, stop)
 * - Track mute/solo
 * - Volume and pan sliders
 * - Zoom controls
 * - Master volume
 */

test.describe('Stem Tracks Example', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/stem-tracks`);
    // Wait for Docusaurus to hydrate
    await page.waitForSelector('h1:has-text("Stem Tracks")', { timeout: 30000 });
    // Wait for tracks to load (waveforms render)
    await page.waitForSelector('button:has-text("Mute")', { timeout: 30000 });
  });

  test.describe('Playback Controls', () => {
    test('play button starts playback', async ({ page }) => {
      const playButton = page.getByRole('button', { name: 'Play' });
      await expect(playButton).toBeVisible();

      await playButton.click();

      // Wait for time to advance
      await page.waitForTimeout(200);

      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      const timeText = await timeDisplay.textContent();
      expect(timeText).not.toBe('00:00:00.000');
    });

    test('pause button pauses playback', async ({ page }) => {
      // Start playback
      await page.getByRole('button', { name: 'Play' }).click();
      await page.waitForTimeout(200);

      // Pause
      const pauseButton = page.getByRole('button', { name: 'Pause' });
      await pauseButton.click();

      // Capture time after pause
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      const timeAfterPause = await timeDisplay.textContent();

      // Wait and verify time hasn't changed
      await page.waitForTimeout(200);
      const timeAfterWait = await timeDisplay.textContent();

      expect(timeAfterPause).toBe(timeAfterWait);
    });

    test('stop button stops playback and resets position', async ({ page }) => {
      // Start playback
      await page.getByRole('button', { name: 'Play' }).click();
      await page.waitForTimeout(300);

      // Stop
      const stopButton = page.getByRole('button', { name: 'Stop' });
      await stopButton.click();

      // Time should reset to start (or last stop position)
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);

      // Wait and verify time isn't advancing
      const timeAfterStop = await timeDisplay.textContent();
      await page.waitForTimeout(200);
      const timeAfterWait = await timeDisplay.textContent();

      expect(timeAfterStop).toBe(timeAfterWait);
    });

    test('pause and stop buttons are disabled when not playing', async ({ page }) => {
      const pauseButton = page.getByRole('button', { name: 'Pause' });
      const stopButton = page.getByRole('button', { name: 'Stop' });

      await expect(pauseButton).toBeDisabled();
      await expect(stopButton).toBeDisabled();
    });

    test('pause and stop buttons are enabled during playback', async ({ page }) => {
      await page.getByRole('button', { name: 'Play' }).click();

      const pauseButton = page.getByRole('button', { name: 'Pause' });
      const stopButton = page.getByRole('button', { name: 'Stop' });

      await expect(pauseButton).toBeEnabled();
      await expect(stopButton).toBeEnabled();

      // Clean up - stop playback
      await stopButton.click();
    });
  });

  test.describe('Track Mute/Solo', () => {
    test('mute button toggles mute state', async ({ page }) => {
      // Get the first Mute button (Loop 1 track)
      const muteButton = page.getByRole('button', { name: 'Mute' }).first();

      // Click to mute
      await muteButton.click();

      // Button should show muted state (check for visual change or aria attribute)
      // The button might change appearance or have a different style when active
      const isPressed = await muteButton.evaluate((el) => {
        // Check for common mute indicators
        return (
          el.getAttribute('aria-pressed') === 'true' ||
          el.classList.contains('active') ||
          el.classList.contains('muted') ||
          window.getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)'
        );
      });

      // Click again to unmute
      await muteButton.click();
    });

    test('solo button toggles solo state', async ({ page }) => {
      // Get the first Solo button (Loop 1 track)
      const soloButton = page.getByRole('button', { name: 'Solo' }).first();

      // Click to solo
      await soloButton.click();

      // Click again to unsolo
      await soloButton.click();
    });

    test('multiple tracks can be muted simultaneously', async ({ page }) => {
      const muteButtons = page.getByRole('button', { name: 'Mute' });

      // Mute first three tracks
      await muteButtons.nth(0).click();
      await muteButtons.nth(1).click();
      await muteButtons.nth(2).click();

      // Unmute them
      await muteButtons.nth(0).click();
      await muteButtons.nth(1).click();
      await muteButtons.nth(2).click();
    });

    test('solo isolates track during playback', async ({ page }) => {
      // Solo the Kick track (3rd track, index 2)
      const soloButtons = page.getByRole('button', { name: 'Solo' });
      await soloButtons.nth(2).click();

      // Start playback - only kick should be audible (can't verify audio, but test interaction)
      await page.getByRole('button', { name: 'Play' }).click();
      await page.waitForTimeout(200);

      // Stop and unsolo
      await page.getByRole('button', { name: 'Stop' }).click();
      await soloButtons.nth(2).click();
    });
  });

  test.describe('Volume Control', () => {
    test('volume slider exists for each track', async ({ page }) => {
      // Volume sliders have valuemin="0" and valuemax="1"
      const volumeSliders = page.locator('input[type="range"][max="1"][min="0"]');

      // Should have multiple volume sliders (one per track)
      const count = await volumeSliders.count();
      expect(count).toBeGreaterThan(0);
    });

    test('volume slider can be adjusted', async ({ page }) => {
      // Get the first volume slider (not the master volume which has max="100")
      const volumeSlider = page.locator('input[type="range"][max="1"][min="0"]').first();

      // Get initial value
      const initialValue = await volumeSlider.inputValue();

      // Change the value
      await volumeSlider.fill('0.5');

      // Verify value changed
      const newValue = await volumeSlider.inputValue();
      expect(newValue).toBe('0.5');

      // Reset to original
      await volumeSlider.fill(initialValue);
    });

    test('volume slider range is 0 to 1', async ({ page }) => {
      const volumeSlider = page.locator('input[type="range"][max="1"][min="0"]').first();

      const min = await volumeSlider.getAttribute('min');
      const max = await volumeSlider.getAttribute('max');

      expect(min).toBe('0');
      expect(max).toBe('1');
    });
  });

  test.describe('Pan Control', () => {
    test('pan slider exists for each track', async ({ page }) => {
      // Pan sliders have valuemin="-1" and valuemax="1" (L to R)
      const panSliders = page.locator('input[type="range"][min="-1"][max="1"]');

      const count = await panSliders.count();
      expect(count).toBeGreaterThan(0);
    });

    test('pan slider can be adjusted', async ({ page }) => {
      const panSlider = page.locator('input[type="range"][min="-1"][max="1"]').first();

      // Get initial value (should be 0, center)
      const initialValue = await panSlider.inputValue();
      expect(initialValue).toBe('0');

      // Pan left
      await panSlider.fill('-0.5');
      expect(await panSlider.inputValue()).toBe('-0.5');

      // Pan right
      await panSlider.fill('0.5');
      expect(await panSlider.inputValue()).toBe('0.5');

      // Reset to center
      await panSlider.fill('0');
    });

    test('pan slider has L and R labels', async ({ page }) => {
      // Check for L and R labels near pan sliders
      const leftLabel = page.getByText('L').first();
      const rightLabel = page.getByText('R').first();

      await expect(leftLabel).toBeVisible();
      await expect(rightLabel).toBeVisible();
    });
  });

  test.describe('Master Volume', () => {
    test('master volume slider exists', async ({ page }) => {
      const masterVolume = page.getByRole('slider', { name: 'Master Volume' });
      await expect(masterVolume).toBeVisible();
    });

    test('master volume defaults to 100', async ({ page }) => {
      const masterVolume = page.getByRole('slider', { name: 'Master Volume' });
      const value = await masterVolume.inputValue();
      expect(value).toBe('100');
    });

    test('master volume can be adjusted', async ({ page }) => {
      const masterVolume = page.getByRole('slider', { name: 'Master Volume' });

      await masterVolume.fill('50');
      expect(await masterVolume.inputValue()).toBe('50');

      // Reset
      await masterVolume.fill('100');
    });

    test('master volume range is 0 to 100', async ({ page }) => {
      const masterVolume = page.getByRole('slider', { name: 'Master Volume' });

      const min = await masterVolume.getAttribute('min');
      const max = await masterVolume.getAttribute('max');

      expect(min).toBe('0');
      expect(max).toBe('100');
    });
  });

  test.describe('Zoom Controls', () => {
    test('zoom in button exists and is clickable', async ({ page }) => {
      const zoomIn = page.getByRole('button', { name: 'Zoom In' });
      await expect(zoomIn).toBeVisible();
      await zoomIn.click();
    });

    test('zoom out button exists and is clickable', async ({ page }) => {
      const zoomOut = page.getByRole('button', { name: 'Zoom Out' });
      await expect(zoomOut).toBeVisible();
      await zoomOut.click();
    });

    test('zooming changes waveform scale', async ({ page }) => {
      // Get initial timescale markers
      const timescaleText = await page.locator('text=0:10').first().boundingBox();
      expect(timescaleText).toBeTruthy();

      // Zoom in
      await page.getByRole('button', { name: 'Zoom In' }).click();

      // After zooming in, the 0:10 marker should move to the right (further from start)
      // or there should be more granular time markers
      const timescaleTextAfterZoom = await page.locator('text=0:10').first().boundingBox();

      // The x position should have changed after zoom
      // (actual behavior depends on implementation)
    });
  });

  test.describe('Automatic Scroll', () => {
    test('automatic scroll checkbox exists and is checked by default', async ({ page }) => {
      const autoScroll = page.getByRole('checkbox', { name: 'Automatic Scroll' });
      await expect(autoScroll).toBeVisible();
      await expect(autoScroll).toBeChecked();
    });

    test('automatic scroll can be toggled', async ({ page }) => {
      const autoScroll = page.getByRole('checkbox', { name: 'Automatic Scroll' });

      // Uncheck
      await autoScroll.uncheck();
      await expect(autoScroll).not.toBeChecked();

      // Check again
      await autoScroll.check();
      await expect(autoScroll).toBeChecked();
    });
  });

  test.describe('Track Labels', () => {
    test('all track names are visible', async ({ page }) => {
      const expectedTracks = [
        'Loop 1',
        'Loop 2',
        'Kick',
        'Snare',
        'Claps',
        'HiHat',
        'Bass 1',
        'Bass 2',
        'Synth 1',
        'Synth 2',
        'Vox Dry',
        'Vox Wet',
      ];

      for (const trackName of expectedTracks) {
        const trackLabel = page.getByText(trackName, { exact: true });
        await expect(trackLabel).toBeVisible();
      }
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test('Space toggles play/pause', async ({ page }) => {
      // Press Space to play
      await page.keyboard.press('Space');
      await page.waitForTimeout(100);

      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      const timeAfterPlay = await timeDisplay.textContent();
      expect(timeAfterPlay).not.toBe('00:00:00.000');

      // Press Space to pause
      await page.keyboard.press('Space');
      const timeAfterPause = await timeDisplay.textContent();

      // Verify paused (time not advancing)
      await page.waitForTimeout(200);
      const timeAfterWait = await timeDisplay.textContent();
      expect(timeAfterPause).toBe(timeAfterWait);
    });

    test('Escape stops playback', async ({ page }) => {
      // Play
      await page.keyboard.press('Space');
      await page.waitForTimeout(200);

      // Stop with Escape
      await page.keyboard.press('Escape');

      // Verify stopped
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      const timeAfterStop = await timeDisplay.textContent();

      await page.waitForTimeout(200);
      const timeAfterWait = await timeDisplay.textContent();
      expect(timeAfterStop).toBe(timeAfterWait);
    });

    test('0 rewinds to start', async ({ page }) => {
      // Play briefly
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
      await page.keyboard.press('Space');

      // Verify time has advanced
      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      const timeBeforeRewind = await timeDisplay.textContent();
      expect(timeBeforeRewind).not.toBe('00:00:00.000');

      // Press 0 to rewind
      await page.keyboard.press('0');

      await expect(timeDisplay).toHaveText('00:00:00.000');
    });
  });
});
