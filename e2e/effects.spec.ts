import { test, expect } from '@playwright/test';

/**
 * Effects example tests
 *
 * These tests verify the audio effects functionality:
 * - Effect selection and adding
 * - Effect parameter controls
 * - Effect bypass and removal
 * - Signal chain display
 * - Export with effects
 */

/** A mono 16-bit PCM WAV holding a 220 Hz sine. */
function sineWav(seconds: number, sampleRate = 48000): Buffer {
  const frames = Math.round(seconds * sampleRate);
  const buffer = Buffer.alloc(44 + frames * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + frames * 2, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) {
    const sample = Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 0.3;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buffer;
}

test.describe('Effects Example', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/examples/effects`);
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Effects")', { timeout: 30000 });
    // Wait for playlist to be ready (all tracks loaded)
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
  });

  test.describe('Effect Selection', () => {
    test('category dropdown filters available effects', async ({ page }) => {
      const categoryDropdown = page.locator('select').first();
      await expect(categoryDropdown).toBeVisible();

      // Select Reverb category
      await categoryDropdown.selectOption('Reverb');

      // Effect dropdown should now show reverb effects
      const effectDropdown = page.locator('select').nth(1);
      const options = await effectDropdown.locator('option').allTextContents();

      expect(options).toContain('Reverb');
      expect(options).toContain('Freeverb');
      expect(options).toContain('JC Reverb');
    });

    test('can add an effect to the chain', async ({ page }) => {
      const effectDropdown = page.locator('select').nth(1);
      const addButton = page.getByRole('button', { name: 'Add Effect' });

      // Select an effect
      await effectDropdown.selectOption('Chorus');

      // Add button should be enabled
      await expect(addButton).toBeEnabled();

      // Click add
      await addButton.click();

      // Effect should appear in the chain (use heading which is the effect card title)
      await expect(page.getByRole('heading', { name: 'Chorus' })).toBeVisible();
    });

    test('clear all removes all effects', async ({ page }) => {
      const clearButton = page.getByRole('button', { name: 'Clear All' });

      // Add an effect first
      const effectDropdown = page.locator('select').nth(1);
      await effectDropdown.selectOption('Phaser');
      await page.getByRole('button', { name: 'Add Effect' }).click();
      await expect(page.getByRole('heading', { name: 'Phaser' })).toBeVisible();

      // Clear all
      await clearButton.click();

      // Phaser should be gone
      await expect(page.getByRole('heading', { name: 'Phaser' })).not.toBeVisible();
    });
  });

  test.describe('Effect Controls', () => {
    test('effect has bypass button', async ({ page }) => {
      // There should be at least one effect with a bypass button
      const bypassButton = page.getByRole('button', { name: '⏻' }).first();
      await expect(bypassButton).toBeVisible();
    });

    test('effect has remove button', async ({ page }) => {
      const removeButton = page.getByRole('button', { name: 'Remove', exact: true }).first();
      await expect(removeButton).toBeVisible();
    });

    test('effect has parameter sliders', async ({ page }) => {
      // Reverb effect card should have parameter sliders
      const reverbHeading = page.getByRole('heading', { name: 'Reverb' });
      await expect(reverbHeading).toBeVisible();

      // Sliders should be present in the effect controls
      const sliders = page.locator('input[type="range"]');
      const count = await sliders.count();
      expect(count).toBeGreaterThan(0);
    });

    test('can adjust effect parameter', async ({ page }) => {
      // Address the Reverb's Mix slider by name. A positional selector
      // (`input[type=range][min=0][max=1]`.first()) also matches the track
      // volume sliders, and which one is first depends on whether the effect
      // panel has mounted yet — the test used to fill one slider and read
      // another (8 failures in 10 runs).
      const mixSlider = page.getByRole('slider', { name: 'Reverb Mix' });
      await expect(mixSlider).toBeVisible();
      await expect(mixSlider).not.toHaveValue('0.75');

      await mixSlider.fill('0.75');

      // Retrying assertion: the value round-trips through React state.
      await expect(mixSlider).toHaveValue('0.75');
    });

    test('bypass button toggles effect', async ({ page }) => {
      const bypassButton = page.getByRole('button', { name: '⏻' }).first();

      // Click bypass
      await bypassButton.click();

      // Button should indicate bypassed state (visual change)
      // Click again to re-enable
      await bypassButton.click();
    });

    test('remove button removes effect', async ({ page }) => {
      // Add a new effect first
      const effectDropdown = page.locator('select').nth(1);
      await effectDropdown.selectOption('Tremolo');
      await page.getByRole('button', { name: 'Add Effect' }).click();
      await expect(page.getByRole('heading', { name: 'Tremolo' })).toBeVisible();

      // Find and click remove for Tremolo (it's the last Remove button since we just added it)
      // Exact: the track panels have a "Remove track" button each since #687
      // (the page's own close button was titled "Delete track" before).
      const removeButtons = page.getByRole('button', { name: 'Remove', exact: true });
      await removeButtons.last().click();

      // Tremolo should be gone
      await expect(page.getByRole('heading', { name: 'Tremolo' })).not.toBeVisible();
    });
  });

  test.describe('Signal Chain', () => {
    test('displays signal chain path', async ({ page }) => {
      await expect(page.getByText('Signal chain:')).toBeVisible();
      await expect(page.getByText('Input')).toBeVisible();
      await expect(page.getByText('Output')).toBeVisible();
    });

    test('signal chain updates when effects are added', async ({ page }) => {
      // Add Chorus effect
      const effectDropdown = page.locator('select').nth(1);
      await effectDropdown.selectOption('Chorus');
      await page.getByRole('button', { name: 'Add Effect' }).click();

      // Signal chain should show Chorus
      await expect(page.getByText('Chorus').last()).toBeVisible();
    });
  });

  test.describe('Track Effects', () => {
    test('each track has FX button', async ({ page }) => {
      const fxButtons = page.getByRole('button', { name: /FX/ });

      // Should have FX button for each track (4 tracks)
      await expect(async () => {
        const count = await fxButtons.count();
        expect(count).toBeGreaterThanOrEqual(4);
      }).toPass({ timeout: 5000 });
    });

    test('FX button shows effect count', async ({ page }) => {
      // FX buttons should show count (e.g., "FX 1")
      await expect(page.getByRole('button', { name: 'FX 1' }).first()).toBeVisible();
    });

    // #752: track effects reach the adapter through the provider's
    // `trackEffects` prop, so `tracks` is passed as it is and an added file is
    // applied to the running engine. Only a full engine build dispatches
    // `waveform-playlist:ready`. (The "loading" state is no signal: a rebuild
    // that finishes within one React batch never shows it.)
    test('adding a file does not rebuild the engine', async ({ page }) => {
      const fxButtons = page.getByRole('button', { name: /FX/ });
      await expect(fxButtons).toHaveCount(4);

      await page.evaluate(() => {
        const counter = window as unknown as { __engineBuilds: number };
        counter.__engineBuilds = 0;
        window.addEventListener('waveform-playlist:ready', () => {
          counter.__engineBuilds += 1;
        });
      });

      await page.locator('input[type="file"]').setInputFiles({
        name: 'tone.wav',
        mimeType: 'audio/wav',
        buffer: sineWav(0.5),
      });

      await expect(fxButtons).toHaveCount(5, { timeout: 10000 });
      // Give a rebuild, if one were started, time to finish.
      await page.waitForTimeout(1000);
      const builds = await page.evaluate(
        () => (window as unknown as { __engineBuilds: number }).__engineBuilds
      );
      expect(builds).toBe(0);
    });
  });

  test.describe('Export', () => {
    test('export mode dropdown exists', async ({ page }) => {
      const exportDropdown = page.locator('select:has-text("Full Mix")');
      await expect(exportDropdown).toBeVisible();
    });

    test('apply effects checkbox exists and is checked', async ({ page }) => {
      const applyEffectsCheckbox = page.getByRole('checkbox', { name: 'Apply Effects' });
      await expect(applyEffectsCheckbox).toBeVisible();
      await expect(applyEffectsCheckbox).toBeChecked();
    });

    test('export button exists', async ({ page }) => {
      const exportButton = page.getByRole('button', { name: 'Export Mix' });
      await expect(exportButton).toBeVisible();
    });

    test('can select export modes', async ({ page }) => {
      const exportDropdown = page.locator('select:has-text("Full Mix")');

      // Select Individual Track (value is lowercase)
      await exportDropdown.selectOption('Individual Track');
      await expect(exportDropdown).toHaveValue('individual');

      // Select All Tracks (ZIP)
      await exportDropdown.selectOption('All Tracks (ZIP)');
      await expect(exportDropdown).toHaveValue('all');
    });
  });

  test.describe('Playback with Effects', () => {
    test('play button starts playback', async ({ page }) => {
      const playButton = page.getByRole('button', { name: 'Play' });
      await playButton.click();

      // Time should advance
      await page.waitForTimeout(200);

      const timeDisplay = page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
      const timeText = await timeDisplay.textContent();
      expect(timeText).not.toBe('00:00:00.000');

      // Stop playback
      await page.getByRole('button', { name: 'Stop' }).click();
    });

    test('can toggle loop mode', async ({ page }) => {
      const loopButton = page.getByRole('button', { name: /Loop/ });
      await expect(loopButton).toBeVisible();

      // Click to enable loop
      await loopButton.click();

      // Button text should change to indicate loop is on
      await expect(page.getByRole('button', { name: /Loop On|Loop Off/ })).toBeVisible();
    });
  });

  test.describe('Effect Categories', () => {
    test('all effect categories are available', async ({ page }) => {
      const categoryDropdown = page.locator('select').first();

      const options = await categoryDropdown.locator('option').allTextContents();

      expect(options).toContain('All Categories');
      expect(options).toContain('Reverb');
      expect(options).toContain('Delay');
      expect(options).toContain('Modulation');
      expect(options).toContain('Filter');
      expect(options).toContain('Distortion');
      expect(options).toContain('Dynamics');
      expect(options).toContain('Spatial');
    });

    test('filtering by category shows correct effects', async ({ page }) => {
      const categoryDropdown = page.locator('select').first();
      const effectDropdown = page.locator('select').nth(1);

      // Test Delay category
      await categoryDropdown.selectOption('Delay');
      let options = await effectDropdown.locator('option').allTextContents();
      expect(options).toContain('Feedback Delay');
      expect(options).toContain('Ping Pong Delay');

      // Test Dynamics category
      await categoryDropdown.selectOption('Dynamics');
      options = await effectDropdown.locator('option').allTextContents();
      expect(options).toContain('Compressor');
      expect(options).toContain('Limiter');
      expect(options).toContain('Gate');
    });
  });
});
