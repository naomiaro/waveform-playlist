/**
 * #848 PR 3 in Chromium: element properties read the arrangement live,
 * `:state(detached)` (happy-dom has no ElementInternals, so only here),
 * a handed-in `editor.arrangement`, and an outside change cancelling a drag
 * in both editors.
 *
 * The dawcore tests run against the dawcore-native Vite example (see
 * dawcore-spectrogram.spec.ts); the React test against /examples/multi-clip.
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.DAWCORE_NATIVE_URL ?? 'http://localhost:5273';
const TRACK_COUNT = 7;
const SPP = 1024; // samples-per-pixel of multiclip.html
const TRACK = 'HiHat'; // one clip, room to its right

interface Clip {
  id: string;
  startSample?: number;
  durationSamples?: number;
}
interface Arrangement {
  getTracks(): ReadonlyArray<{ id: string; name?: string; clips: readonly Clip[] }>;
  undo(): void;
  setTrackVolume(id: string, v: number): void;
  sources: { getSnapshot(): { isLoading: boolean } };
}
interface Editor extends HTMLElement {
  arrangement: Arrangement | null;
  tracks: Array<{ name: string }>;
  engine: { getState(): { isPlaying: boolean } } | null;
}

/** The named track's first clip, as the arrangement holds it. */
const arrangementClip = (page: Page, name = TRACK) =>
  page.evaluate((trackName) => {
    const editor = document.querySelector('daw-editor') as unknown as Editor;
    const clip = editor.arrangement!.getTracks().find((t) => t.name === trackName)?.clips[0];
    return clip ? { ...clip } : null;
  }, name);

const startPx = async (page: Page) =>
  Math.round(((await arrangementClip(page))!.startSample ?? 0) / SPP);

async function pressAt(page: Page, selector: string) {
  const el = page.locator(selector).first();
  await expect(el).toBeVisible();
  await el.scrollIntoViewIfNeeded();
  let box: { x: number; y: number; width: number; height: number } | null = null;
  await expect(async () => {
    box = await el.boundingBox();
    expect(box).toBeTruthy();
  }).toPass({ timeout: 5000 });
  const x = box!.x + Math.min(40, box!.width / 2);
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  return { x, y };
}

async function pressHeader(page: Page) {
  const id = (await arrangementClip(page))!.id;
  return pressAt(page, `daw-editor .clip-header[data-clip-id="${id}"]`);
}

test.describe('dawcore: the arrangement and the elements (#848 PR 3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/multiclip.html`);
    await page.waitForFunction(
      (count) => {
        const editor = document.querySelector('daw-editor') as unknown as Editor | null;
        return (
          !!editor?.engine &&
          (editor.arrangement?.getTracks().length ?? 0) === count &&
          (editor.shadowRoot?.querySelectorAll('daw-track-controls').length ?? 0) === count &&
          !editor.arrangement!.sources.getSnapshot().isLoading
        );
      },
      TRACK_COUNT,
      { timeout: 30000 }
    );
  });

  test('after a clip drag, clipEl.start is where the clip is; the start attribute is unchanged', async ({
    page,
  }) => {
    const before = await page.evaluate(
      (name) => document.querySelector(`daw-track[name="${name}"] daw-clip`)!.getAttribute('start'),
      TRACK
    );
    const start = await startPx(page);
    const p = await pressHeader(page);
    await page.mouse.move(p.x + 40, p.y, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => startPx(page)).toBe(start + 40);
    const after = await page.evaluate((name) => {
      const clip = document.querySelector(`daw-track[name="${name}"] daw-clip`) as HTMLElement & {
        start: number;
      };
      return { start: clip.start, attribute: clip.getAttribute('start') };
    }, TRACK);
    expect(after.attribute).toBe(before);
    expect(Math.round((after.start * 48000) / SPP)).toBeCloseTo(start + 40, -1);
  });

  test('undo of a <daw-track> arrival detaches it (:state(detached)); redo makes it live', async ({
    page,
  }) => {
    await page.evaluate(() => {
      const editor = document.querySelector('daw-editor') as unknown as Editor;
      // An edit first: a page track that enters into an empty history is not an undo step.
      editor.arrangement!.setTrackVolume(editor.arrangement!.getTracks()[0].id, 0.5);
      const late = document.createElement('daw-track');
      late.setAttribute('name', 'Late');
      late.setAttribute('kind', 'midi');
      editor.appendChild(late);
    });
    await page.waitForFunction(
      (count) =>
        (document.querySelector('daw-editor') as unknown as Editor).arrangement!.getTracks()
          .length === count,
      TRACK_COUNT + 1
    );
    const detached = () =>
      page.evaluate(() =>
        document.querySelector('daw-track[name="Late"]')!.matches(':state(detached)')
      );
    expect(await detached()).toBe(false);
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(detached).toBe(true);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect.poll(detached).toBe(false);
  });

  test('a handed-in arrangement plays alone; null brings the page tracks back', async ({
    page,
  }) => {
    const enginePath = `${process.cwd()}/packages/engine/src/index.ts`;
    await page.evaluate(async (path) => {
      const { createArrangement } = await import(/* @vite-ignore */ `/@fs${path}`);
      const editor = document.querySelector('daw-editor') as unknown as Editor;
      const src = (editor.arrangement!.getTracks()[0].clips[0] as { src?: string }).src;
      editor.arrangement = createArrangement({
        tracks: [
          {
            id: 'handed',
            name: 'Handed',
            kind: 'audio',
            volume: 1,
            pan: 0,
            muted: false,
            soloed: false,
            clips: [{ id: 'handed-clip', src, start: 0, duration: 4 }],
          },
        ],
      });
    }, enginePath);
    await expect
      .poll(() =>
        page.evaluate(() =>
          (document.querySelector('daw-editor') as unknown as Editor).tracks.map((t) => t.name)
        )
      )
      .toEqual(['Handed']);
    expect(
      await page.evaluate(() => document.querySelector('daw-track')!.matches(':state(detached)'))
    ).toBe(true);
    await page.locator('daw-play-button').first().click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (document.querySelector('daw-editor') as unknown as Editor).engine?.getState().isPlaying
        )
      )
      .toBe(true);
    await page.evaluate(() => {
      (document.querySelector('daw-editor') as unknown as Editor).arrangement = null;
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => (document.querySelector('daw-editor') as unknown as Editor).tracks.length
        )
      )
      .toBe(TRACK_COUNT);
    expect(
      await page.evaluate(() => document.querySelector('daw-track')!.matches(':state(detached)'))
    ).toBe(false);
  });

  test('arrangement.undo() during a clip drag cancels it; the clip stays where the undo put it', async ({
    page,
  }) => {
    const start = await startPx(page);
    let p = await pressHeader(page);
    await page.mouse.move(p.x + 40, p.y, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => startPx(page)).toBe(start + 40);

    p = await pressHeader(page);
    await page.mouse.move(p.x + 60, p.y, { steps: 8 });
    await page.evaluate(() =>
      (document.querySelector('daw-editor') as unknown as Editor).arrangement!.undo()
    );
    await expect.poll(() => startPx(page)).toBe(start);
    await page.mouse.move(p.x + 120, p.y, { steps: 8 });
    await page.mouse.up();
    expect(await startPx(page)).toBe(start);
  });
});

test.describe('React: an outside change cancels a drag (#848 PR 3)', () => {
  /** The provider's arrangement, reached through React's fiber tree (test code only). */
  const exposeArrangement = (page: Page) =>
    page.evaluate(() => {
      const el = document.querySelector('[data-playlist-state]') as unknown as Record<
        string,
        unknown
      >;
      const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$'))!;
      let fiber = el[key] as { memoizedProps?: { arrangement?: unknown }; return?: unknown } | null;
      while (fiber) {
        const a = fiber.memoizedProps?.arrangement as Arrangement | undefined;
        if (a && typeof a.undo === 'function') {
          (window as unknown as { __arrangement: Arrangement }).__arrangement = a;
          return true;
        }
        fiber = fiber.return as typeof fiber;
      }
      return false;
    });

  const clipStart = (page: Page, clipId: string) =>
    page.evaluate((id) => {
      const a = (window as unknown as { __arrangement: Arrangement }).__arrangement;
      for (const t of a.getTracks()) {
        const c = t.clips.find((x) => x.id === id);
        if (c) return c.startSample ?? null;
      }
      return null;
    }, clipId);

  test('arrangement.undo() during a clip move cancels the drag; the release moves nothing', async ({
    page,
    baseURL,
  }) => {
    await page.goto(`${baseURL}/examples/multi-clip`);
    await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
    expect(await exposeArrangement(page)).toBe(true);
    const header = page.locator('[data-clip-id]').first();
    await expect(header).toBeVisible();
    const clipId = (await header.getAttribute('data-clip-id'))!;
    const start = await clipStart(page, clipId);

    const drag = async (dx: number, during?: () => Promise<void>) => {
      await header.scrollIntoViewIfNeeded();
      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await header.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });
      const x = box!.x + box!.width / 2;
      const y = box!.y + box!.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx / 2, y, { steps: 6 });
      if (during) await during();
      await page.mouse.move(x + dx, y, { steps: 6 });
      await page.mouse.up();
    };

    await drag(100);
    await expect.poll(() => clipStart(page, clipId)).not.toBe(start);
    await drag(100, async () => {
      await page.evaluate(() =>
        (window as unknown as { __arrangement: Arrangement }).__arrangement.undo()
      );
      await expect.poll(() => clipStart(page, clipId)).toBe(start);
    });
    // The drag was cancelled: the release changed nothing, and moving on does nothing.
    expect(await clipStart(page, clipId)).toBe(start);
    await page.mouse.move(600, 300, { steps: 4 });
    expect(await clipStart(page, clipId)).toBe(start);
  });
});
