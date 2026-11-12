/**
 * dawcore track kinds (#756): a <daw-track> holds audio clips or MIDI clips,
 * declared with kind="audio|midi".
 *
 * Runs against the dawcore-native Vite example (started by
 * `playwright.config.ts`, port 5273 by default; see dawcore-spectrogram.spec.ts).
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.DAWCORE_NATIVE_URL ?? 'http://localhost:5273';

const NOTES = [
  { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
  { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.7 },
];

test.describe('dawcore track kinds', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/programmatic.html`);
    await page.waitForSelector('daw-editor');
    await page.waitForFunction(() => {
      const editor = document.getElementById('editor') as unknown as { adapter?: unknown } | null;
      return Boolean(editor?.adapter);
    });
  });

  test('addTrack({ midi }) makes a kind="midi" track drawn as a piano roll', async ({ page }) => {
    const result = await page.evaluate(async (notes) => {
      const editor = document.getElementById('editor') as any;
      const track = await editor.addTrack({ name: 'Keys', midi: { notes } });
      await editor.updateComplete;
      const entry = editor.tracks.find((t: any) => t.trackId === track.trackId);
      return {
        attribute: track.getAttribute('kind'),
        kind: entry.kind,
        renderMode: entry.renderMode,
        engineKind: editor.engine.getState().tracks.find((t: any) => t.id === track.trackId).kind,
      };
    }, NOTES);

    expect(result).toEqual({
      attribute: 'midi',
      kind: 'midi',
      renderMode: 'waveform',
      engineKind: 'midi',
    });
    await expect(page.locator('daw-piano-roll')).toHaveCount(1);
  });

  test('render-mode="piano-roll" without kind="midi" refuses the MIDI clip', async ({ page }) => {
    const result = await page.evaluate(async (notes) => {
      const editor = document.getElementById('editor') as any;
      const clipErrors: string[] = [];
      editor.addEventListener('daw-clip-error', (e: CustomEvent) =>
        clipErrors.push(String(e.detail.error?.message ?? e.detail.error))
      );
      let rejected = false;
      try {
        await editor.addTrack({
          name: 'Lead',
          renderMode: 'piano-roll',
          clips: [{ midiNotes: notes }],
        });
      } catch {
        rejected = true;
      }
      return {
        rejected,
        clipErrors,
        // No track loaded, so the engine may not have been built at all.
        engineClips: (editor.engine?.getState().tracks ?? []).reduce(
          (n: number, t: any) => n + t.clips.length,
          0
        ),
      };
    }, NOTES);

    expect(result.rejected).toBe(true);
    expect(result.clipErrors).toHaveLength(1);
    expect(result.clipErrors[0]).toContain('kind="midi"');
    expect(result.engineClips).toBe(0);
    await expect(page.locator('daw-piano-roll')).toHaveCount(0);
  });

  test('an audio clip is refused on a MIDI track without being fetched', async ({ page }) => {
    const audioRequests: string[] = [];
    page.on('request', (request) => {
      if (/refused-take\.opus/.test(request.url())) audioRequests.push(request.url());
    });

    const result = await page.evaluate(async (notes) => {
      const editor = document.getElementById('editor') as any;
      const track = await editor.addTrack({ name: 'Keys', midi: { notes } });
      let message = 'resolved';
      try {
        await editor.addClip(track.trackId, { src: '/media/audio/refused-take.opus' });
      } catch (err) {
        message = String((err as Error)?.message ?? err);
      }
      const engineTrack = editor.engine.getState().tracks.find((t: any) => t.id === track.trackId);
      return { message, clipCount: engineTrack.clips.length };
    }, NOTES);

    expect(result.message).toContain('audio clip on MIDI track "Keys"');
    expect(result.clipCount).toBe(1);
    expect(audioRequests).toEqual([]);
  });
});
