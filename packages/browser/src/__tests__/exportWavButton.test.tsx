// @vitest-environment jsdom
//
// `ExportWavButton` (#817): it hands the provider's tracks, the chosen track id
// and the effect functions to `exportWav`, and a failed export reaches
// `onExportError`, or the console when none is given. The hook and the
// provider's contexts are replaced by fakes.
import { describe, it, expect, vi, afterEach } from 'vitest';

const fake = vi.hoisted(() => ({
  calls: [] as unknown[][],
  outcome: 'resolve' as 'resolve' | 'reject',
}));

vi.mock('../hooks/useExportWav', () => ({
  useExportWav: () => ({
    exportWav: (...args: unknown[]) => {
      fake.calls.push(args);
      return fake.outcome === 'resolve'
        ? Promise.resolve({ blob: new Blob(['wav']), audioBuffer: {}, duration: 1 })
        : Promise.reject(new Error('the render failed'));
    },
    isExporting: false,
    progress: 0,
    error: null,
  }),
}));
vi.mock('../contexts/playlistContexts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../contexts/playlistContexts')>()),
  usePlaylistTimeline: () => ({ tracks: [{ id: 'A', clips: [] }] }),
  usePlaylistMixer: () => ({ trackStates: [{ muted: false, soloed: false, volume: 1, pan: 0 }] }),
}));

import { act, cleanup, render } from '@testing-library/react';
import { ExportWavButton } from '../components/ExportControls';

afterEach(() => {
  cleanup();
  fake.calls.length = 0;
  fake.outcome = 'resolve';
  vi.restoreAllMocks();
});

async function click() {
  await act(async () => {
    (document.querySelector('button') as HTMLButtonElement).click();
  });
}

describe('ExportWavButton', () => {
  it('exports the chosen track by id, with the effect functions it was given', async () => {
    const effectsFunction = vi.fn();
    const createOfflineTrackEffects = vi.fn();
    render(
      <ExportWavButton
        trackId="A"
        filename="stem"
        bitDepth={32}
        effectsFunction={effectsFunction}
        createOfflineTrackEffects={createOfflineTrackEffects}
      />
    );
    await click();
    expect(fake.calls).toHaveLength(1);
    const [tracks, trackStates, options] = fake.calls[0];
    expect(tracks).toEqual([{ id: 'A', clips: [] }]);
    expect(trackStates).toHaveLength(1);
    expect(options).toEqual({
      filename: 'stem',
      trackId: 'A',
      bitDepth: 32,
      effectsFunction,
      createOfflineTrackEffects,
      autoDownload: true,
    });
  });

  it('a failed export goes to onExportError and not to the console', async () => {
    fake.outcome = 'reject';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onExportError = vi.fn();
    const onExportComplete = vi.fn();
    render(<ExportWavButton onExportError={onExportError} onExportComplete={onExportComplete} />);
    await click();
    expect(onExportError).toHaveBeenCalledTimes(1);
    expect(onExportError.mock.lastCall?.[0].message).toBe('the render failed');
    expect(onExportComplete).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('a failed export with no onExportError is written to the console with a hint', async () => {
    fake.outcome = 'reject';
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ExportWavButton />);
    await click();
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(consoleError.mock.lastCall?.[0]).toBe(
      '[waveform-playlist] The WAV export failed. ' +
        'Pass `onExportError` to ExportWavButton to show this in your app.'
    );
    // The error itself, so its stack and cause reach the console.
    expect((consoleError.mock.lastCall?.[1] as Error).message).toBe('the render failed');
  });

  it('onExportComplete gets the blob of a finished export', async () => {
    const onExportError = vi.fn();
    const onExportComplete = vi.fn();
    render(<ExportWavButton onExportError={onExportError} onExportComplete={onExportComplete} />);
    await click();
    expect(onExportComplete).toHaveBeenCalledTimes(1);
    expect(onExportComplete.mock.lastCall?.[0]).toBeInstanceOf(Blob);
    expect(onExportError).not.toHaveBeenCalled();
  });
});
