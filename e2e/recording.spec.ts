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
  // The page starts with no tracks: ready as soon as an engine is attached.
  // Play does nothing before the first ready (#812).
  await expect(page.locator('[data-playlist-state="ready"]')).toHaveCount(1, { timeout: 30000 });
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

  test('a take lands on the track it was started on, even when another track is selected mid-take (#756)', async ({
    page,
    baseURL,
  }) => {
    await openRecordingPage(page, baseURL);
    await page.getByRole('button', { name: '+ New Track' }).click();
    await page.getByRole('button', { name: '+ New Track' }).click();
    const rows = page.locator('[data-track-row]');
    await expect(rows).toHaveCount(2);

    // The track added last is the selected one: the take starts on it.
    const started = rows.nth(1);
    const other = rows.nth(0);
    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(page.getByRole('button', { name: 'Recording', exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(started.locator('[data-clip-container]')).toHaveCount(1, { timeout: 10000 });

    // Select the other track while the take runs (a click on its row, through
    // the overlay that covers the rows): the live preview stays where it is.
    // The page exposes no "selected" attribute to assert on; that this click
    // selects was checked by running the test against the hook from before
    // #756, where the preview follows it to the other row and the test fails.
    let box: { x: number; y: number; width: number; height: number } | null = null;
    await expect(async () => {
      box = await other.boundingBox();
      expect(box).toBeTruthy();
    }).toPass({ timeout: 5000 });
    await page.mouse.click(box!.x + 60, box!.y + box!.height / 2);
    await expect(other).toHaveAttribute('data-track-kind', 'audio');
    await page.waitForTimeout(500);
    await expect(started.locator('[data-clip-container]')).toHaveCount(1);
    await expect(other.locator('[data-clip-container]')).toHaveCount(0);

    await page.getByRole('button', { name: 'Stop' }).click();
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible({
      timeout: 30000,
    });

    // The take became a clip of the track it was started on.
    await expect(started.locator('[data-clip-container]')).toHaveCount(1);
    await expect(other.locator('[data-clip-container]')).toHaveCount(0);
  });
});

/**
 * Holds every decodeAudioData call until `window.__releaseDecodes()`, so a
 * dropped file stays loading as long as a test needs. Counts the calls held.
 */
function holdDecodes() {
  const win = window as unknown as { __decodesHeld: number; __releaseDecodes: () => void };
  win.__decodesHeld = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  win.__releaseDecodes = () => release();
  const original = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (
    this: BaseAudioContext,
    ...args: Parameters<typeof original>
  ) {
    win.__decodesHeld++;
    return gate.then(() => original.apply(this, args));
  } as typeof original;
}

const SAMPLE_RATE = 48000;
const SAMPLES_PER_PIXEL = 1024;
const PX_PER_SECOND = SAMPLE_RATE / SAMPLES_PER_PIXEL;

/** A mono 16-bit PCM WAV holding a 220 Hz sine. */
function sineWav(seconds: number): Buffer {
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
    const sample = Math.sin((2 * Math.PI * 220 * i) / SAMPLE_RATE) * 0.3;
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + i * 2);
  }
  return buffer;
}

async function dropFile(page: Page, name: string, seconds: number) {
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: 'audio/wav',
    buffer: sineWav(seconds),
  });
}

/** Clicks the row at `offsetPx` from its clip's left edge: selects the track, puts the cursor there. */
async function clickRowAt(page: Page, rowIndex: number, offsetPx: number) {
  const clip = page.locator('[data-track-row]').nth(rowIndex).locator('[data-clip-container]');
  let box: { x: number; y: number; width: number; height: number } | null = null;
  await expect(async () => {
    box = await clip.first().boundingBox();
    expect(box).toBeTruthy();
  }).toPass({ timeout: 5000 });
  await page.mouse.click(box!.x + offsetPx, box!.y + (box!.height * 3) / 4);
}

const recordingButton = (page: Page) =>
  page.getByRole('button', { name: 'Recording', exact: true });

async function stopTake(page: Page) {
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible({
    timeout: 30000,
  });
}

// #812: a take carves the clips it overlaps, which only a loaded clip allows,
// and the track it records onto is muted through the arrangement meanwhile.
test.describe('Recording example — the arrangement and a take', () => {
  test('recording is refused over a clip that is still loading', async ({ page, baseURL }) => {
    await page.addInitScript(holdDecodes);
    await openRecordingPage(page, baseURL);
    await dropFile(page, 'tone.wav', 6);
    const rows = page.locator('[data-track-row]');
    await expect(rows).toHaveCount(1);
    await expect
      .poll(() =>
        page.evaluate(() => (window as unknown as { __decodesHeld: number }).__decodesHeld)
      )
      .toBeGreaterThan(0);
    // A dropped file's length is not known before it decodes: no clip is drawn yet.
    await expect(rows.first().locator('[data-clip-container]')).toHaveCount(0);

    // Select its track (a click on the row) and press Record.
    let rowBox: { x: number; y: number; width: number; height: number } | null = null;
    await expect(async () => {
      rowBox = await rows.first().boundingBox();
      expect(rowBox).toBeTruthy();
    }).toPass({ timeout: 5000 });
    await page.mouse.click(rowBox!.x + 60, rowBox!.y + rowBox!.height / 2);
    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(
      page.getByText(
        'Error: Cannot start recording: "tone" holds a clip whose audio is still loading'
      )
    ).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
    await expect(recordingButton(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Start recording' })).toBeVisible();
    await expect(rows.first().locator('[data-clip-container]')).toHaveCount(0);

    // Once the audio has loaded, the same press records.
    await page.evaluate(() =>
      (window as unknown as { __releaseDecodes: () => void }).__releaseDecodes()
    );
    await expect(rows.first().locator('[data-clip-container]')).toHaveCount(1, { timeout: 10000 });
    await expect(rows.first().locator('[data-clip-placeholder="true"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(recordingButton(page)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/Cannot start recording/)).toHaveCount(0);
    await stopTake(page);
  });

  test('punch-in over a clip that loaded and was never edited carves it', async ({
    page,
    baseURL,
  }) => {
    const clipSeconds = 6;
    await openRecordingPage(page, baseURL);
    await dropFile(page, 'tone.wav', clipSeconds);
    const row = page.locator('[data-track-row]').first();
    const clips = row.locator('[data-clip-container]');
    await expect(clips).toHaveCount(1, { timeout: 10000 });
    await expect(row.locator('[data-clip-placeholder="true"]')).toHaveCount(0, { timeout: 10000 });
    const original = await clips.first().boundingBox();
    expect(original).toBeTruthy();

    // The cursor one second into the clip, on its track; a take of about 1.5 s.
    await clickRowAt(page, 0, PX_PER_SECOND);
    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(recordingButton(page)).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500);
    await stopTake(page);

    // Before the take, the take, and after it: the clip was split around it.
    await expect(clips).toHaveCount(3, { timeout: 10000 });
    const boxes = (
      await clips.evaluateAll((els) =>
        els.map((el) => {
          const box = el.getBoundingClientRect();
          return { left: box.left, right: box.right };
        })
      )
    ).sort((a, b) => a.left - b.left);
    expect(Math.abs(boxes[0].left - original!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[0].right - (original!.x + PX_PER_SECOND))).toBeLessThanOrEqual(3);
    expect(Math.abs(boxes[1].left - boxes[0].right)).toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[2].left - boxes[1].right)).toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[2].right - (original!.x + original!.width))).toBeLessThanOrEqual(1);
    await expect(row.locator('[data-clip-placeholder="true"]')).toHaveCount(0);
  });

  test('the take’s track’s mute button is disabled and shows muted during a take', async ({
    page,
    baseURL,
  }) => {
    await openRecordingPage(page, baseURL);
    await page.getByRole('button', { name: '+ New Track' }).click();
    await page.getByRole('button', { name: '+ New Track' }).click();
    await expect(page.locator('[data-track-row]')).toHaveCount(2);
    const mutes = page.getByRole('button', { name: 'Mute', exact: true });
    await expect(mutes).toHaveCount(2);
    const takeTrack = mutes.nth(1); // the track added last is selected
    const other = mutes.nth(0);
    await expect(takeTrack).toBeEnabled();
    await expect(takeTrack).toHaveAttribute('aria-pressed', 'false');

    await page.getByRole('button', { name: 'Start recording' }).click();
    await expect(recordingButton(page)).toBeVisible({ timeout: 15000 });
    await expect(takeTrack).toBeDisabled();
    await expect(takeTrack).toHaveAttribute('aria-pressed', 'true');
    // The take does not record onto the other track: its mute is as it was.
    await expect(other).toBeEnabled();
    await expect(other).toHaveAttribute('aria-pressed', 'false');
    // The control: the other track's Mute still toggles during the take,
    // and the take's track stays muted and disabled meanwhile.
    await other.click();
    await expect(other).toHaveAttribute('aria-pressed', 'true');
    await other.click();
    await expect(other).toHaveAttribute('aria-pressed', 'false');
    await expect(takeTrack).toBeDisabled();
    await expect(takeTrack).toHaveAttribute('aria-pressed', 'true');

    await stopTake(page);
    // The track's own mute, which the take never wrote, shows again.
    await expect(takeTrack).toBeEnabled();
    await expect(takeTrack).toHaveAttribute('aria-pressed', 'false');
    await expect(other).toHaveAttribute('aria-pressed', 'false');
  });
});
