import { test, expect, type Page } from '@playwright/test';

/**
 * The drop page (/examples/newtracks): one track per file given to the file
 * input, which the arrangement loads (#812). A file whose audio cannot be
 * loaded is removed again and listed in an alert; what plays keeps playing.
 */

const SAMPLE_RATE = 48000;

/** A mono 16-bit PCM WAV: a 220 Hz sine at `amplitude` (0 is silence). */
function wav(seconds: number, amplitude: number): Buffer {
  const frames = Math.round(seconds * SAMPLE_RATE);
  const buffer = Buffer.alloc(44 + frames * 2);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + frames * 2, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(frames * 2, 40);
  for (let i = 0; i < frames; i++) {
    const sample = Math.sin((2 * Math.PI * 220 * i) / SAMPLE_RATE) * amplitude;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buffer;
}

/** Taps whatever is connected to an audio destination. Must run before the page loads. */
async function tapOutput(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = window as unknown as { __outputTaps?: AnalyserNode[] };
    state.__outputTaps = [];
    const originalConnect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
      if (args[0] instanceof AudioDestinationNode && this.context instanceof AudioContext) {
        // A page that imports Tone has more than one context; tap them all.
        const tap = this.context.createAnalyser();
        state.__outputTaps?.push(tap);
        (originalConnect as (destination: AudioNode) => AudioNode).call(this, tap);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (originalConnect as any).apply(this, args);
    } as typeof AudioNode.prototype.connect;
  });
}

/** RMS of the loudest signal reaching an audio destination now. */
function outputRms(page: Page): Promise<number> {
  return page.evaluate(() => {
    const taps = (window as unknown as { __outputTaps?: AnalyserNode[] }).__outputTaps ?? [];
    let loudest = 0;
    for (const tap of taps) {
      const samples = new Float32Array(tap.fftSize);
      tap.getFloatTimeDomainData(samples);
      let sum = 0;
      for (const sample of samples) sum += sample * sample;
      loudest = Math.max(loudest, Math.sqrt(sum / samples.length));
    }
    return loudest;
  });
}

const fileInput = (page: Page) => page.locator('input[type="file"]');
const timeDisplay = (page: Page) => page.getByText(/^\d{2}:\d{2}:\d{2}\.\d{3}$/);
const rows = (page: Page) => page.locator('[data-track-row]');

/** Adds one file, waits for its track to load and the playlist to be ready, presses Play. */
async function playOneFile(page: Page, name: string, audio: Buffer) {
  await fileInput(page).setInputFiles({ name, mimeType: 'audio/wav', buffer: audio });
  await expect(rows(page)).toHaveCount(1, { timeout: 30000 });
  await expect(page.locator('[data-playlist-state="ready"]')).toHaveCount(1, { timeout: 30000 });
  await expect(page.locator('[data-clip-placeholder="true"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expectTimeAdvancing(page);
}

/** The time display moves on between two reads. */
async function expectTimeAdvancing(page: Page) {
  const before = await timeDisplay(page).textContent();
  await expect(async () => {
    expect(await timeDisplay(page).textContent()).not.toBe(before);
  }).toPass({ timeout: 10000 });
}

test.describe('New Tracks Example (drop page)', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    await tapOutput(page);
    await page.goto(`${baseURL}/examples/newtracks`);
    await expect(fileInput(page)).toHaveCount(1, { timeout: 30000 });
  });

  test('two files that cannot be decoded are removed and listed, and the playing track keeps playing', async ({
    page,
  }) => {
    await playOneFile(page, 'tone.wav', wav(30, 0.3));

    // Text with audio names and types: the input takes them, decoding fails.
    await fileInput(page).setInputFiles([
      { name: 'notes.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('not audio at all') },
      { name: 'memo.wav', mimeType: 'audio/wav', buffer: Buffer.from('not a wav either') },
    ]);

    const alert = page.getByRole('alert').filter({ hasText: 'Failed to load' });
    await expect(alert).toContainText('Failed to load "notes": ', { timeout: 10000 });
    await expect(alert).toContainText('Failed to load "memo": ');
    await expect(alert.locator('div')).toHaveCount(2);
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByText('tone', { exact: true })).toBeVisible();

    // Playback went on through the failures.
    await expectTimeAdvancing(page);
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
  });

  test('a file dropped while playing does not stop playback and plays when it arrives', async ({
    page,
  }) => {
    // A silent file plays: nothing reaches the output.
    await playOneFile(page, 'silence.wav', wav(30, 0));
    await page.waitForTimeout(300);
    expect(await outputRms(page)).toBeLessThan(0.001);

    await fileInput(page).setInputFiles({
      name: 'tone.wav',
      mimeType: 'audio/wav',
      buffer: wav(30, 0.3),
    });
    await expect(rows(page)).toHaveCount(2);
    await expect(page.locator('[data-clip-placeholder="true"]')).toHaveCount(0, {
      timeout: 10000,
    });

    // Still playing, and the new file is heard.
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeEnabled();
    await expectTimeAdvancing(page);
    await expect(async () => {
      expect(await outputRms(page)).toBeGreaterThan(0.05);
    }).toPass({ timeout: 10000 });
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
  });
});
