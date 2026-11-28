/**
 * dawcore: a mixer move is an undo step, one per gesture (#843).
 *
 * The native sliders are also exposed by control and track name (#910).
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
    getState(): { tracks: ReadonlyArray<{ name: string; volume: number; pan: number }> };
  } | null;
}

/** The engine's mixer value for the named track, or null before it has loaded. */
const engineMixerValue = (page: Page, trackName: string, control: 'volume' | 'pan') =>
  page.evaluate(
    ({ trackName, control }) => {
      const editor = document.querySelector('daw-editor') as unknown as EditorProbe;
      const track = editor.engine?.getState().tracks.find((t) => t.name === trackName);
      return track ? track[control] : null;
    },
    { trackName, control }
  );

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

  test('track controls have distinct accessible names and accept arrow keys', async ({ page }) => {
    const volume = page.getByRole('slider', { name: 'Volume, Kick', exact: true });
    const pan = page.getByRole('slider', { name: 'Pan, Kick', exact: true });
    await expect(volume).toHaveValue('1');
    await expect(pan).toHaveValue('0');
    await expect(page.getByRole('slider', { name: 'Volume, HiHat', exact: true })).toHaveCount(1);
    await expect(page.getByRole('slider', { name: 'Pan, HiHat', exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Mute, Kick', exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Solo, Kick', exact: true })).toHaveCount(1);

    await volume.press('ArrowLeft');
    await expect(volume).toHaveValue('0.99');
    await expect.poll(() => engineMixerValue(page, TRACK_NAME, 'volume')).toBe(0.99);
    await pan.press('ArrowRight');
    await expect(pan).toHaveValue('0.01');
    await expect.poll(() => engineMixerValue(page, TRACK_NAME, 'pan')).toBe(0.01);
  });

  test('the app can format accessible names for the editor mixer', async ({ page }) => {
    await page.evaluate(() => {
      Object.assign(document.querySelector('daw-editor')!, {
        formatTrackControlLabel: (control: string, trackName: string) => {
          if (control === 'volume') return `${trackName} : niveau sonore`;
          if (control === 'pan') return `${trackName} : balance`;
          return undefined;
        },
      });
    });

    await expect(
      page.getByRole('slider', { name: 'Kick : niveau sonore', exact: true })
    ).toHaveCount(1);
    await expect(page.getByRole('slider', { name: 'HiHat : balance', exact: true })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Mute, Kick', exact: true })).toHaveCount(1);
  });

  test('standalone track controls without a track name use the default names', async ({ page }) => {
    await page.evaluate(() => {
      const controls = document.createElement('daw-track-controls');
      controls.id = 'standalone-mixer';
      controls.style.height = '128px';
      document.body.prepend(controls);
    });

    const controls = page.locator('#standalone-mixer');
    await expect(controls.getByRole('slider', { name: 'Volume', exact: true })).toHaveCount(1);
    await expect(controls.getByRole('slider', { name: 'Pan', exact: true })).toHaveCount(1);
  });

  test('a dawcore volume drag is one undo step', async ({ page }) => {
    const volume = page.getByRole('slider', { name: `Volume, ${TRACK_NAME}`, exact: true });
    await volume.scrollIntoViewIfNeeded();
    await expect(volume).toBeVisible();

    const startValue = await volume.inputValue();
    expect(Number(startValue)).toBe(1);
    expect(await engineMixerValue(page, TRACK_NAME, 'volume')).toBe(1);
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

    await expect.poll(() => engineMixerValue(page, TRACK_NAME, 'volume')).toBeLessThan(0.5);
    expect(Number(await volume.inputValue())).toBeLessThan(0.5);
    expect(await canUndo(page)).toBe(true);

    // Focus off the slider: a focused range input keeps every key (#730).
    await page.locator('h1').click();
    await expect(volume).not.toBeFocused();
    await page.keyboard.press('ControlOrMeta+z');

    // One Undo takes back the whole drag, and the slider follows the engine.
    await expect.poll(() => engineMixerValue(page, TRACK_NAME, 'volume')).toBe(1);
    await expect(volume).toHaveValue(startValue);
    expect(await canUndo(page)).toBe(false);
  });
});
