/**
 * dawcore: undo during a drag does nothing, and Escape cancels the drag and
 * does nothing else (#848). Real pointer input in Chromium; the unit tests
 * (daw-editor-drag-guard.test.ts) drive the handlers directly.
 *
 * Runs against the dawcore-native Vite example (see dawcore-spectrogram.spec.ts).
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.DAWCORE_NATIVE_URL ?? 'http://localhost:5273';
const TRACK_COUNT = 7;
const SPP = 1024; // samples-per-pixel of multiclip.html
const TRACK = 'HiHat'; // one clip, room to its right

interface EngineClip {
  id: string;
  startSample: number;
  durationSamples: number;
}
interface EditorProbe {
  shadowRoot: ShadowRoot | null;
  canUndo: boolean;
  tracks: Array<{ name: string }>;
  engine: {
    getState(): {
      isPlaying: boolean;
      tracks: ReadonlyArray<{ name: string; clips: readonly EngineClip[] }>;
    };
  } | null;
}

/** The track's first clip as the engine holds it. */
const engineClip = (page: Page, name = TRACK) =>
  page.evaluate((trackName) => {
    const editor = document.querySelector('daw-editor') as unknown as EditorProbe;
    const clip = editor.engine?.getState().tracks.find((t) => t.name === trackName)?.clips[0];
    return clip ? { ...clip } : null;
  }, name);

const startPx = async (page: Page) => Math.round((await engineClip(page))!.startSample / SPP);
const widthPx = async (page: Page) => Math.round((await engineClip(page))!.durationSamples / SPP);

const isPlaying = (page: Page) =>
  page.evaluate(
    () =>
      (document.querySelector('daw-editor') as unknown as EditorProbe).engine?.getState()
        .isPlaying ?? false
  );

const trackNames = (page: Page) =>
  page.evaluate(() =>
    (document.querySelector('daw-editor') as unknown as EditorProbe).tracks.map((t) => t.name)
  );

/** Press the centre of an element (locators pierce the editor's shadow root). */
async function pressAt(page: Page, selector: string, at: 'centre' | 'right' = 'centre') {
  const el = page.locator(selector).first();
  await expect(el).toBeVisible();
  // page.mouse does not scroll, and clicking Play can scroll the page.
  await el.scrollIntoViewIfNeeded();
  let box: { x: number; y: number; width: number; height: number } | null = null;
  await expect(async () => {
    box = await el.boundingBox();
    expect(box).toBeTruthy();
  }).toPass({ timeout: 5000 });
  const x = at === 'right' ? box!.x + box!.width - 2 : box!.x + Math.min(40, box!.width / 2);
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  return { x, y };
}

async function pressHeader(page: Page) {
  const id = (await engineClip(page))!.id;
  return pressAt(page, `daw-editor .clip-header[data-clip-id="${id}"]`);
}

/** Move the held pointer to `x + dx` in small steps. */
const moveTo = (page: Page, x: number, y: number, dx: number) =>
  page.mouse.move(x + dx, y, { steps: 8 });

test.describe('dawcore: undo and Escape during a drag (#848)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/multiclip.html`);
    await page.waitForFunction(
      (count) => {
        const editor = document.querySelector('daw-editor') as unknown as EditorProbe | null;
        return (
          !!editor?.engine &&
          editor.engine.getState().tracks.length === count &&
          (editor.shadowRoot?.querySelectorAll('daw-track-controls').length ?? 0) === count &&
          // Tracks enter before their audio has loaded (#848): wait for every source.
          !(
            editor as unknown as {
              _arrangement: { sources: { getSnapshot(): { isLoading: boolean } } };
            }
          )._arrangement.sources.getSnapshot().isLoading
        );
      },
      TRACK_COUNT,
      { timeout: 30000 }
    );
  });

  test('undo during a clip move does nothing; the clip lands where the pointer put it', async ({
    page,
  }) => {
    const warnings: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'warning') warnings.push(m.text());
    });
    const start = await startPx(page);

    // One drop 40 px to the right: one undo step.
    let p = await pressHeader(page);
    await moveTo(page, p.x, p.y, 40);
    await page.mouse.up();
    await expect.poll(() => startPx(page)).toBe(start + 40);

    // Again: 60 px, Cmd/Ctrl+Z with the button held, on to 120 px, release.
    p = await pressHeader(page);
    await moveTo(page, p.x, p.y, 60);
    await page.keyboard.press('ControlOrMeta+z');
    await moveTo(page, p.x, p.y, 120);
    await page.mouse.up();
    await expect.poll(() => startPx(page)).toBe(start + 160);

    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => startPx(page)).toBe(start + 40);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => startPx(page)).toBe(start);
    expect(warnings.filter((w) => w.includes('no active transaction'))).toEqual([]);
  });

  test('undo during a press that has not moved: the drag that follows is one undo step', async ({
    page,
  }) => {
    const warnings: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'warning') warnings.push(m.text());
    });
    const start = await startPx(page);

    // One drop 40 px to the right: one undo step.
    let p = await pressHeader(page);
    await moveTo(page, p.x, p.y, 40);
    await page.mouse.up();
    await expect.poll(() => startPx(page)).toBe(start + 40);

    // Press (no move), Cmd/Ctrl+Z: the drop is undone and the press stays live.
    p = await pressHeader(page);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => startPx(page)).toBe(start);
    await moveTo(page, p.x, p.y, 60);
    await page.mouse.up();
    await expect.poll(() => startPx(page)).toBe(start + 60);

    // One undo takes the whole drag back.
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(() => startPx(page)).toBe(start);
    expect(warnings.filter((w) => w.includes('no active transaction'))).toEqual([]);
  });

  test('Escape during a clip move puts the clip back and keeps playing', async ({ page }) => {
    const start = await startPx(page);
    const canUndoBefore = await page.evaluate(
      () => (document.querySelector('daw-editor') as unknown as EditorProbe).canUndo
    );
    await page.locator('daw-play-button button').click();
    await expect.poll(() => isPlaying(page), { timeout: 10000 }).toBe(true);

    const p = await pressHeader(page);
    await moveTo(page, p.x, p.y, 60);
    await expect.poll(() => startPx(page)).toBe(start + 60);
    await page.keyboard.press('Escape');
    await expect.poll(() => startPx(page)).toBe(start);
    await page.mouse.up();

    expect(await isPlaying(page)).toBe(true);
    expect(
      await page.evaluate(
        () => (document.querySelector('daw-editor') as unknown as EditorProbe).canUndo
      )
    ).toBe(canUndoBefore);

    // With no drag left, Escape is Stop again.
    await page.keyboard.press('Escape');
    await expect.poll(() => isPlaying(page)).toBe(false);
  });

  test('Escape during a trim and during a track-reorder drag cancels each', async ({ page }) => {
    const width = await widthPx(page);
    const id = (await engineClip(page))!.id;
    const t = await pressAt(
      page,
      `daw-editor .clip-boundary[data-clip-id="${id}"][data-boundary-edge="right"]`
    );
    await moveTo(page, t.x, t.y, -80);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(await widthPx(page)).toBe(width);

    const order = await trackNames(page);
    const g = await pressAt(page, 'daw-editor daw-track-controls .grip');
    await page.mouse.move(g.x, g.y + 200, { steps: 10 });
    await page.keyboard.press('Escape');
    await page.mouse.up();
    await page.waitForTimeout(300);
    expect(await trackNames(page)).toEqual(order);
  });
});
