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

/** The rack of the track chosen in the "Track rack" selector. */
async function trackRack(page: Page) {
  const selector = page.getByLabel('Track rack');
  await expect(selector).not.toHaveValue('');
  const name = await selector.locator('option:checked').textContent();
  return page.getByRole('group', { name: `${name} chain`, exact: true });
}

/**
 * Tap two points of the live graph with analysers, so a test can read real
 * signal during playback: the output of the demo tremolo node (what passes
 * through the effect), and whatever is connected to the audio destination
 * (what is heard). Must run before the page loads.
 */
async function tapTremoloOutput(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const state = window as unknown as {
      __tremoloTap?: AnalyserNode;
      __outputTaps?: AnalyserNode[];
    };
    state.__outputTaps = [];
    const originalConnect = AudioNode.prototype.connect;
    const isTremolo = (node: AudioNode): boolean =>
      typeof AudioWorkletNode !== 'undefined' &&
      node instanceof AudioWorkletNode &&
      node.parameters.has('depth') &&
      node.context instanceof AudioContext;
    AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
      if (isTremolo(this) && !(args[0] instanceof AnalyserNode)) {
        // The chain disconnects every output of the node when it rewires, so
        // the tap is made again on each connection the chain makes.
        const tap = state.__tremoloTap ?? this.context.createAnalyser();
        state.__tremoloTap = tap;
        originalConnect.call(this, tap);
      }
      if (args[0] instanceof AudioDestinationNode && this.context instanceof AudioContext) {
        // A page that imports Tone has more than one context; tap them all
        // and read the loudest.
        const tap = this.context.createAnalyser();
        state.__outputTaps?.push(tap);
        originalConnect.call(this, tap);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (originalConnect as any).apply(this, args);
    } as typeof AudioNode.prototype.connect;
  });
}

/** RMS of the signal currently at the tremolo's output (0 when nothing reaches the tap). */
async function tremoloOutputRms(page: Page): Promise<number> {
  return page.evaluate(() => {
    const tap = (window as unknown as { __tremoloTap?: AnalyserNode }).__tremoloTap;
    if (!tap) return 0;
    const samples = new Float32Array(tap.fftSize);
    tap.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const sample of samples) sum += sample * sample;
    return Math.sqrt(sum / samples.length);
  });
}

/**
 * Wait until the audio clock has moved on by more than the analysers hold
 * (2048 samples, about 43 ms), so the next reading contains nothing from
 * before the change that was just made.
 */
async function waitForFreshAudio(page: Page): Promise<void> {
  const start = await page.evaluate(
    () =>
      (window as unknown as { __tremoloTap?: AnalyserNode }).__tremoloTap?.context.currentTime ?? 0
  );
  await page.waitForFunction(
    (since) => {
      const tap = (window as unknown as { __tremoloTap?: AnalyserNode }).__tremoloTap;
      return tap !== undefined && tap.context.currentTime - since > 0.2;
    },
    start,
    { timeout: 10_000 }
  );
}

/** RMS of the loudest signal reaching an audio destination. */
async function outputRms(page: Page): Promise<number> {
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
    const rack = await trackRack(page);
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

  test('during playback the signal passes through the effect, and not while it is bypassed', async ({
    page,
    baseURL,
  }) => {
    await tapTremoloOutput(page);
    await page.goto(`${baseURL}/examples/wam-effects`);
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 60_000 });

    // Uncaught errors, and anything the library itself reports: it prefixes
    // its messages, and reports wiring and dispose problems as warnings. Not
    // every console error: the page also fetches community plugin descriptors
    // from another site, and a failed request there is not this test's
    // business.
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (message) => {
      const reported = message.type() === 'error' || message.type() === 'warning';
      if (reported && message.text().includes('[waveform-playlist]')) {
        errors.push(message.text());
      }
    });

    const rack = page.getByRole('group', { name: 'Master chain' });
    await rack.getByLabel('Effect to add').selectOption({ label: TREMOLO });
    await rack.getByRole('button', { name: 'Add', exact: true }).click();
    const entry = rack.getByRole('group', { name: TREMOLO });
    await expect(entry).toBeVisible();

    // The audio is 16 seconds long and playback stops at its end. Checked
    // first in every block below, so that a run slow enough to get there
    // fails by saying so, not with "no signal".
    const pause = page.getByRole('button', { name: 'Pause' });
    const stillPlaying = () => expect(pause).toBeEnabled({ timeout: 500 });

    await page.getByRole('button', { name: 'Play' }).click();
    // The mix passes through the worklet node while it is in the chain, and
    // on to the destination.
    await expect(async () => {
      await stillPlaying();
      expect(await tremoloOutputRms(page)).toBeGreaterThan(0.01);
      expect(await outputRms(page)).toBeGreaterThan(0.01);
    }).toPass({ timeout: 15_000 });

    // Bypassed: the node is out of the chain, so nothing leaves it, and the
    // dry mix is still heard (the bypass did not cut the chain).
    await entry.getByRole('button', { name: 'On', exact: true }).click();
    await expect(async () => {
      await stillPlaying();
      expect(await tremoloOutputRms(page)).toBe(0);
      expect(await outputRms(page)).toBeGreaterThan(0.01);
    }).toPass({ timeout: 10_000 });

    // Back in the chain, the signal returns: the processor resumes.
    await entry.getByRole('button', { name: 'Bypassed', exact: true }).click();
    await expect(entry.getByRole('button', { name: 'On', exact: true })).toBeVisible();
    await waitForFreshAudio(page);
    await expect(async () => {
      await stillPlaying();
      expect(await tremoloOutputRms(page)).toBeGreaterThan(0.01);
      expect(await outputRms(page)).toBeGreaterThan(0.01);
    }).toPass({ timeout: 15_000 });

    // Removed: nothing leaves the node any more, and the mix is still heard.
    // Read only audio from after the removal.
    await entry.getByRole('button', { name: 'Remove' }).click();
    await expect(entry).toHaveCount(0);
    await waitForFreshAudio(page);
    await expect(async () => {
      await stillPlaying();
      expect(await tremoloOutputRms(page)).toBe(0);
      expect(await outputRms(page)).toBeGreaterThan(0.01);
    }).toPass({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Stop' }).click();
    // Stop has taken effect, and a round trip to the page after it means
    // every console message logged before now has been delivered.
    await expect(page.getByRole('button', { name: 'Play' })).toBeEnabled();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
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
    const track = await trackRack(page);
    await track.getByLabel('Effect to add').selectOption({ label: TREMOLO });
    await track.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(track.getByRole('group', { name: TREMOLO })).toBeVisible();

    const withTrack = await exportMix(page);
    expect(differenceRms(withTrack, dry)).toBeGreaterThan(0.005);
    expect(differenceRms(withTrack, withMaster)).toBeGreaterThan(0.005);
  });
});
