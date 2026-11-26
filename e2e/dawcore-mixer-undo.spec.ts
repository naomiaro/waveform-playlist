/**
 * dawcore: a mixer move is an undo step, one per gesture (#843).
 *
 * A pointer drag on a range input fires many native `input` events and one
 * `change` on release. `<daw-track-controls>` sends every `input` with its
 * slider's gesture id, so the whole drag is one step and one Undo brings the
 * volume back to where the drag started. Unit tests drive the events by hand;
 * this runs a real drag in Chromium.
 *
 * Runs against the dawcore-native Vite example (see dawcore-spectrogram.spec.ts).
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = process.env.DAWCORE_NATIVE_URL ?? 'http://localhost:5273';
const TRACK_COUNT = 7;
const TRACK_NAME = 'Kick';

interface EditorProbe {
  canUndo: boolean;
  shadowRoot: ShadowRoot | null;
  engine: {
    getState(): { tracks: ReadonlyArray<{ name: string; volume: number }> };
  } | null;
}

/** The engine's volume of the named track, or null before it has loaded. */
const engineVolume = (page: Page, name: string) =>
  page.evaluate((trackName) => {
    const editor = document.querySelector('daw-editor') as unknown as EditorProbe;
    const track = editor.engine?.getState().tracks.find((t) => t.name === trackName);
    return track ? track.volume : null;
  }, name);

const canUndo = (page: Page) =>
  page.evaluate(() => (document.querySelector('daw-editor') as unknown as EditorProbe).canUndo);

test.describe('dawcore mixer undo (#843)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/multiclip.html`);
    // Every track in and its controls drawn: the page's tracks are not undo
    // steps, so the first step is the drag below (#848).
    await page.waitForFunction(
      (count) => {
        const editor = document.querySelector('daw-editor') as unknown as EditorProbe | null;
        return (
          !!editor?.engine &&
          editor.engine.getState().tracks.length === count &&
          (editor.shadowRoot?.querySelectorAll('daw-track-controls').length ?? 0) === count
        );
      },
      TRACK_COUNT,
      { timeout: 30000 }
    );
  });

  test('a dawcore volume drag is one undo step', async ({ page }) => {
    // One track's controls, found by the name they show.
    const controls = page
      .locator('daw-track-controls')
      .filter({ has: page.locator('.name', { hasText: TRACK_NAME }) });
    await expect(controls).toHaveCount(1);
    // The range inputs have no accessible name; the volume row's class names
    // the slider inside this one track's controls.
    const volume = controls.locator('.vol-row input[type="range"]');
    await volume.scrollIntoViewIfNeeded();
    await expect(volume).toBeVisible();

    const startValue = await volume.inputValue();
    expect(Number(startValue)).toBe(1);
    expect(await engineVolume(page, TRACK_NAME)).toBe(1);
    expect(await canUndo(page)).toBe(false);

    // A real pointer drag from the right end (volume 1) to the left third:
    // many input events, one change on release.
    let box: { x: number; y: number; width: number; height: number } | null = null;
    await expect(async () => {
      box = await volume.boundingBox();
      expect(box).toBeTruthy();
    }).toPass();
    const { x, y, width, height } = box!;
    const midY = y + height / 2;
    await page.mouse.move(x + width - 2, midY);
    await page.mouse.down();
    await page.mouse.move(x + width * 0.6, midY, { steps: 8 });
    await page.mouse.move(x + width * 0.3, midY, { steps: 8 });
    await page.mouse.up();

    await expect.poll(() => engineVolume(page, TRACK_NAME)).toBeLessThan(0.5);
    expect(Number(await volume.inputValue())).toBeLessThan(0.5);
    expect(await canUndo(page)).toBe(true);

    // Focus off the slider: a focused range input keeps every key (#730).
    await page.locator('h1').click();
    await expect(volume).not.toBeFocused();
    await page.keyboard.press('ControlOrMeta+z');

    // One Undo takes back the whole drag, and the slider follows the engine.
    await expect.poll(() => engineVolume(page, TRACK_NAME)).toBe(1);
    await expect(volume).toHaveValue(startValue);
    expect(await canUndo(page)).toBe(false);
  });
});
