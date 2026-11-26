/**
 * dawcore: tracks load through the editor's arrangement (#848 PR 2).
 *
 * Loading no longer clears the undo history, and the page's own tracks are
 * not undo steps. A track whose audio failed stays in the editor, drawn
 * failed, until retryTrack loads it.
 *
 * Runs against the dawcore-native Vite example (see dawcore-spectrogram.spec.ts).
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.DAWCORE_NATIVE_URL ?? 'http://localhost:5273';
const TRACK_COUNT = 7;
const KICK = '/media/audio/AlbertKader_Ubiquitous/01_Kick.opus';

interface EditorProbe {
  canUndo: boolean;
  tracks: Array<{ trackId: string; name: string; volume: number }>;
  shadowRoot: ShadowRoot | null;
  engine: { getState(): { tracks: ReadonlyArray<{ id: string; name: string }> } } | null;
  _arrangement: { sources: { getSnapshot(): { isLoading: boolean } } };
  addTrack(config: unknown): Promise<string>;
  updateTrack(trackId: string, partial: unknown): void;
  retryTrack(trackId: string): void;
}

const names = (page: Page) =>
  page.evaluate(() =>
    (document.querySelector('daw-editor') as unknown as EditorProbe).tracks.map((t) => t.name)
  );

const canUndo = (page: Page) =>
  page.evaluate(() => (document.querySelector('daw-editor') as unknown as EditorProbe).canUndo);

const volumeOf = (page: Page, name: string) =>
  page.evaluate(
    (trackName) =>
      (document.querySelector('daw-editor') as unknown as EditorProbe).tracks.find(
        (t) => t.name === trackName
      )?.volume,
    name
  );

/** Undo with the keyboard, focus on the page body (the shortcuts listen on document). */
async function pressUndo(page: Page) {
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ControlOrMeta+z');
}

test.describe('dawcore loading through the arrangement (#848)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/multiclip.html`);
    // Every page track entered and every source settled.
    await page.waitForFunction(
      (count) => {
        const editor = document.querySelector('daw-editor') as unknown as EditorProbe | null;
        return (
          !!editor?.engine &&
          editor.engine.getState().tracks.length === count &&
          !editor._arrangement.sources.getSnapshot().isLoading
        );
      },
      TRACK_COUNT,
      { timeout: 30000 }
    );
  });

  test('Undo right after load changes nothing', async ({ page }) => {
    const before = await names(page);
    expect(before).toHaveLength(TRACK_COUNT);
    expect(await canUndo(page)).toBe(false);
    await pressUndo(page);
    expect(await names(page)).toEqual(before);
  });

  test('after a volume change and an added track, Undo takes back the track, then the volume', async ({
    page,
  }) => {
    await page.evaluate(() => {
      const editor = document.querySelector('daw-editor') as unknown as EditorProbe;
      const kick = editor.tracks.find((t) => t.name === 'Kick')!;
      editor.updateTrack(kick.trackId, { volume: 0.5 });
    });
    await page.evaluate(
      (src) =>
        (document.querySelector('daw-editor') as unknown as EditorProbe).addTrack({
          name: 'Added',
          clips: [{ src, duration: 2 }],
        }),
      KICK
    );
    expect(await names(page)).toContain('Added');
    expect(await volumeOf(page, 'Kick')).toBe(0.5);

    await pressUndo(page);
    await expect.poll(() => names(page)).not.toContain('Added');
    expect(await volumeOf(page, 'Kick')).toBe(0.5);

    await pressUndo(page);
    await expect.poll(() => volumeOf(page, 'Kick')).toBe(1);
  });

  test('a track whose audio failed stays, drawn failed, and retryTrack loads it', async ({
    page,
  }) => {
    let serve = false;
    let hits = 0;
    await page.route('**/missing.opus', async (route) => {
      hits++;
      if (!serve) {
        await route.fulfill({ status: 404, body: 'not here' });
        return;
      }
      const response = await route.fetch({ url: new URL(KICK, BASE).href });
      await route.fulfill({ response });
    });
    const trackId = await page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          const editor = document.querySelector('daw-editor') as unknown as HTMLElement;
          editor.addEventListener(
            'daw-track-error',
            (e) => resolve((e as CustomEvent<{ trackId: string }>).detail.trackId),
            { once: true }
          );
          editor.insertAdjacentHTML(
            'beforeend',
            '<daw-track name="Missing"><daw-clip src="/missing.opus" start="1" duration="3"></daw-clip></daw-track>'
          );
        })
    );
    expect(hits).toBeGreaterThan(0);
    expect(await names(page)).toContain('Missing');
    const failedBox = (id: string) =>
      page.evaluate(
        (trackId) =>
          !!(
            document.querySelector('daw-editor') as unknown as EditorProbe
          ).shadowRoot?.querySelector(
            `.track-row[data-track-id="${trackId}"] .clip-container.placeholder.failed`
          ),
        id
      );
    await expect.poll(() => failedBox(trackId)).toBe(true);

    serve = true;
    const ready = page.evaluate(
      (id) =>
        new Promise<void>((resolve) => {
          const editor = document.querySelector('daw-editor') as unknown as HTMLElement;
          editor.addEventListener('daw-track-ready', (e) => {
            if ((e as CustomEvent<{ trackId: string }>).detail.trackId === id) resolve();
          });
          (editor as unknown as EditorProbe).retryTrack(id);
        }),
      trackId
    );
    await ready;
    await expect.poll(() => failedBox(trackId)).toBe(false);
  });
});
