import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'fs';

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

/** A stereo 16-bit PCM WAV holding the same 220 Hz sine on both channels. */
function stereoSineWav(seconds: number, sampleRate = 48000): Buffer {
  const frames = Math.round(seconds * sampleRate);
  const buffer = Buffer.alloc(44 + frames * 4);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + frames * 4, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(2, 22); // stereo
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 4, 28);
  buffer.writeUInt16LE(4, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(frames * 4, 40);
  for (let i = 0; i < frames; i++) {
    const sample = Math.round(Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 0.3 * 32767);
    buffer.writeInt16LE(sample, 44 + i * 4);
    buffer.writeInt16LE(sample, 44 + i * 4 + 2);
  }
  return buffer;
}

/**
 * How much a 16-bit PCM WAV of a steady 220 Hz sine differs from itself a
 * tenth of a second later, as an RMS over 1 s to 2.8 s, the larger of the
 * channels. A tenth of a second is 22 whole periods of the sine at any sample
 * rate that is a multiple of 10, so whatever the effect does to it, an effect
 * that does not change over time gives the same samples again: about 0, up
 * to the 16-bit rounding. Only something that moves gives more.
 */
function changeOverATenthOfASecond(wav: Buffer): { channels: number; change: number } {
  const channels = wav.readUInt16LE(22);
  const sampleRate = wav.readUInt32LE(24);
  expect(wav.readUInt16LE(34)).toBe(16);
  expect(sampleRate % 10).toBe(0);
  const lag = sampleRate / 10;
  const sample = (frame: number, channel: number) =>
    wav.readInt16LE(44 + (frame * channels + channel) * 2) / 32768;
  let change = 0;
  for (let channel = 0; channel < channels; channel++) {
    let sum = 0;
    let level = 0;
    let count = 0;
    for (let frame = sampleRate; frame < 2.8 * sampleRate; frame++) {
      const now = sample(frame, channel);
      const d = now - sample(frame + lag, channel);
      sum += d * d;
      level += now * now;
      count++;
    }
    // The sine reaches the file: a silent export would also read "no change".
    expect(Math.sqrt(level / count)).toBeGreaterThan(0.01);
    change = Math.max(change, Math.sqrt(sum / count));
  }
  return { channels, change };
}

async function exportMix(page: Page): Promise<Buffer> {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 120_000 }),
    page.getByRole('button', { name: 'Export Mix', exact: true }).click(),
  ]);
  return readFileSync(await download.path());
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

    // `waveform-playlist:ready` fires once per provider mount (#812), so it
    // cannot count engine builds any more; that an added track builds no
    // engine is a unit test of the browser package (`engineLifetime.test.tsx`).
    // Here: the added file gets its own track with an FX button, its clip
    // loads, and the playlist is ready with it.
    test('an added file gets a track with an FX button, and the playlist is ready with it', async ({
      page,
    }) => {
      const fxButtons = page.getByRole('button', { name: /FX/ });
      await expect(fxButtons).toHaveCount(4);

      await page.locator('input[type="file"]').setInputFiles({
        name: 'tone.wav',
        mimeType: 'audio/wav',
        buffer: sineWav(0.5),
      });

      await expect(fxButtons).toHaveCount(5, { timeout: 10000 });
      const rows = page.locator('[data-track-row]');
      await expect(rows).toHaveCount(5);
      await expect(rows.nth(4).locator('[data-clip-container]')).toHaveCount(1);
      await expect(rows.nth(4).locator('[data-clip-placeholder="true"]')).toHaveCount(0, {
        timeout: 10000,
      });
      await expect(page.locator('[data-playlist-state="ready"]')).toHaveCount(1);
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

    // Tone's Chorus, Tremolo, AutoPanner and AutoFilter have an LFO that runs
    // only after start(); never started, each is a fixed delay, gain, pan and
    // filter (#820). A steady stereo sine, soloed, is exported through each
    // on the master chain: the file has to change over time.
    test.describe('an LFO effect modulates in an exported WAV', () => {
      test.beforeEach(async ({ page }) => {
        // The page starts with a reverb on the master chain. Its tail is
        // noise that is still dying away in the measured second, so it goes.
        await expect(page.getByRole('heading', { name: 'Reverb', exact: true })).toBeVisible();
        await page.getByRole('button', { name: 'Clear All', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Reverb', exact: true })).toHaveCount(0);

        await page.locator('input[type="file"]').setInputFiles({
          name: 'steady.wav',
          mimeType: 'audio/wav',
          buffer: stereoSineWav(3),
        });
        const rows = page.locator('[data-track-row]');
        await expect(rows).toHaveCount(5, { timeout: 10000 });
        await expect(rows.nth(4).locator('[data-clip-placeholder="true"]')).toHaveCount(0, {
          timeout: 10000,
        });
        const solo = page.getByRole('button', { name: 'Solo', exact: true }).nth(4);
        await solo.click();
        await expect(solo).toHaveAttribute('aria-pressed', 'true');
      });

      test('control: without an effect the exported sine does not change over time', async ({
        page,
      }) => {
        const { channels, change } = changeOverATenthOfASecond(await exportMix(page));
        expect(channels).toBe(2);
        expect(change).toBeLessThan(0.001);
      });

      for (const name of ['Chorus', 'Tremolo', 'Auto Panner', 'Auto Filter']) {
        test(name, async ({ page }) => {
          await page.locator('select').nth(1).selectOption(name);
          await page.getByRole('button', { name: 'Add Effect', exact: true }).click();
          await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();

          const { channels, change } = changeOverATenthOfASecond(await exportMix(page));
          expect(channels).toBe(2);
          expect(change).toBeGreaterThan(0.01);
        });
      }
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
