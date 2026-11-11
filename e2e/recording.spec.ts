import { test, expect, type Page } from '@playwright/test';

/**
 * The recording example with a synthetic microphone (#695): the meters and the
 * live preview are drawn from subscriptions, not from React state, so these
 * check that they still move, that the take becomes a clip, and that the
 * component hosting the hooks does not render while levels change.
 */

/** Replaces getUserMedia with a tone whose level sweeps once a second. */
function fakeMicrophone() {
  const mediaDevices = navigator.mediaDevices;
  mediaDevices.getUserMedia = async () => {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.29;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
    const destination = ctx.createMediaStreamDestination();
    osc.connect(gain).connect(destination);
    osc.start();
    const track = destination.stream.getAudioTracks()[0];
    const getSettings = track.getSettings.bind(track);
    track.getSettings = () => ({ ...getSettings(), channelCount: 1, sampleRate: ctx.sampleRate });
    return destination.stream;
  };
  mediaDevices.enumerateDevices = async () =>
    [
      { kind: 'audioinput', deviceId: 'fake', label: 'Fake microphone', groupId: 'g' },
    ] as MediaDeviceInfo[];
}

/** Counts React commits on the page (development build). */
function countCommits() {
  const win = window as unknown as { __commits: number; __REACT_DEVTOOLS_GLOBAL_HOOK__: unknown };
  win.__commits = 0;
  win.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject(renderer: unknown) {
      this.renderers.set(this.renderers.size + 1, renderer);
      return this.renderers.size;
    },
    onCommitFiberRoot() {
      win.__commits++;
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
  };
}

/** Lit segments (peak marker excluded) of the first channel of meter `index`. */
async function litSegments(page: Page, index: number): Promise<number> {
  return page.evaluate((meterIndex) => {
    const meter = document.querySelectorAll('[data-meter-orientation]')[meterIndex];
    const channel = meter?.querySelector('[data-channel]');
    if (!channel) return -1;
    return Array.from(channel.querySelectorAll<HTMLElement>('[data-segment]')).filter(
      (segment) => segment.style.opacity === '1' && !segment.hasAttribute('data-peak')
    ).length;
  }, index);
}

/** React commits during the next `ms` milliseconds. */
async function commitsDuring(page: Page, ms: number): Promise<number> {
  await page.evaluate(() => {
    (window as unknown as { __commits: number }).__commits = 0;
  });
  await page.waitForTimeout(ms);
  return page.evaluate(() => (window as unknown as { __commits: number }).__commits);
}

/** React commits and animation frames during the next `ms` milliseconds. */
async function commitsAndFramesDuring(
  page: Page,
  ms: number
): Promise<{ commits: number; frames: number }> {
  return page.evaluate(
    (duration) =>
      new Promise<{ commits: number; frames: number }>((resolve) => {
        const win = window as unknown as { __commits: number };
        win.__commits = 0;
        let frames = 0;
        const started = performance.now();
        const tick = () => {
          if (performance.now() - started >= duration) {
            resolve({ commits: win.__commits, frames });
            return;
          }
          frames++;
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    ms
  );
}

const INPUT_METER = 0;
const OUTPUT_METER = 1;

async function openRecordingPage(page: Page, baseURL: string | undefined) {
  const origin = new URL(baseURL ?? 'http://localhost:3000').origin;
  await page.context().grantPermissions(['microphone'], { origin });
  await page.addInitScript(fakeMicrophone);
  await page.addInitScript(countCommits);
  await page.goto(`${baseURL}/examples/recording`);
  await expect(page.getByRole('button', { name: '+ New Track' })).toBeVisible({ timeout: 30000 });
}

// The synthetic microphone is an oscillator on its own AudioContext, created
// when the page asks for the microphone on load, before any click. Without
// this flag that context sometimes stays suspended (about 1 run in 30) and the
// "microphone" is silent.
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] } });

test.describe('Recording example', () => {
  test('the input meter follows the microphone without rendering React', async ({
    page,
    baseURL,
  }) => {
    await openRecordingPage(page, baseURL);

    // The meter shows signal, and its reading changes as the level sweeps.
    await expect(async () => {
      expect(await litSegments(page, INPUT_METER)).toBeGreaterThan(0);
    }).toPass({ timeout: 15000 });
    const readings = new Set<number>();
    await expect(async () => {
      readings.add(await litSegments(page, INPUT_METER));
      expect(readings.size).toBeGreaterThan(1);
    }).toPass({ timeout: 10000 });

    // Levels arrive ~60 times a second (about 120 in two seconds, which is
    // what this page committed before #695). Nothing may render for them. A
    // window is retried so that an unrelated one-off render (a late effect of
    // page load) does not fail the test; rendering per level fails every window.
    await expect(async () => {
      expect(await commitsDuring(page, 2000)).toBeLessThan(10);
    }).toPass({ timeout: 15000 });
  });

  test('a take shows a growing preview, becomes a clip, and plays back through the output meter', async ({
    page,
    baseURL,
  }) => {
    await openRecordingPage(page, baseURL);
    await page.getByRole('button', { name: '+ New Track' }).click();
    await expect(page.locator('[data-track-row]')).toHaveCount(1);

    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(page.getByRole('button', { name: 'Recording', exact: true })).toBeVisible({
      timeout: 15000,
    });

    // The live preview appears and keeps getting wider.
    const preview = page.locator('[data-clip-container]').last();
    await expect(preview).toBeVisible({ timeout: 10000 });
    let firstWidth = 0;
    await expect(async () => {
      const box = await preview.boundingBox();
      expect(box).toBeTruthy();
      firstWidth = box!.width;
      expect(firstWidth).toBeGreaterThan(0);
    }).toPass({ timeout: 10000 });
    await expect(async () => {
      const box = await preview.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThan(firstWidth + 20);
    }).toPass({ timeout: 10000 });

    // While recording, React renders about once per frame (the preview clip).
    // It was about three commits per frame before #695. Counted against the
    // page's own frames, so the bound holds on a 120 Hz display too.
    await expect(async () => {
      const { commits, frames } = await commitsAndFramesDuring(page, 2000);
      expect(frames).toBeGreaterThan(20);
      expect(commits).toBeGreaterThan(20);
      expect(commits).toBeLessThan(frames * 1.25);
    }).toPass({ timeout: 15000 });

    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible({
      timeout: 30000,
    });
    // The take is now a clip of about the previewed width.
    await expect(page.locator('[data-clip-container]')).toHaveCount(1);
    await expect(async () => {
      const box = await page.locator('[data-clip-container]').first().boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThan(firstWidth);
    }).toPass({ timeout: 10000 });

    // Playing it back lights the output meter.
    await page.getByRole('button', { name: 'Rewind to start' }).click();
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(async () => {
      expect(await litSegments(page, OUTPUT_METER)).toBeGreaterThan(0);
    }).toPass({ timeout: 10000 });
  });
});
