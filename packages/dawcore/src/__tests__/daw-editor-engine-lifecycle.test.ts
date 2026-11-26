// #848 PR 2: the editor owns an arrangement from construction and builds its
// engine as soon as it is connected with an adapter.
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import { makeFakeAdapter, mountEditor, restoreFetch, tick } from './helpers/editor-harness';

beforeAll(async () => {
  await import('../index');
});

afterEach(() => {
  restoreFetch();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function midiTrack(id: string) {
  const clip = createClip({
    startSample: 0,
    durationSamples: 48000,
    offsetSamples: 0,
    sampleRate: 48000,
    sourceDurationSamples: 48000,
    midiNotes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
  });
  return { ...createTrack({ name: id, kind: 'midi', clips: [clip] }), id };
}

describe('daw-editor: the arrangement and the engine', () => {
  it('the editor has an arrangement before it has an adapter', () => {
    const editor = document.createElement('daw-editor') as any;
    expect(editor._arrangement.getTracks()).toEqual([]);
    expect(editor.engine).toBeNull();
  });

  it('setting the adapter on a connected editor builds the engine at once', async () => {
    const editor = await mountEditor({ adapter: null });
    expect(editor.engine).toBeNull();
    const fake = makeFakeAdapter({ sampleRate: 44100 });
    editor.adapter = fake.adapter as any;
    expect(editor.engine).not.toBeNull();
    expect(editor.engine!.getState().sampleRate).toBe(44100);
  });

  it('an adapter set before connect builds the engine at connect', () => {
    const editor = document.createElement('daw-editor') as any;
    editor.adapter = makeFakeAdapter().adapter;
    expect(editor.engine).toBeNull();
    document.body.appendChild(editor);
    expect(editor.engine).not.toBeNull();
  });

  it('the engine plays the editor arrangement', async () => {
    const editor = (await mountEditor()) as any;
    editor._arrangement.addTrack(midiTrack('keys'));
    expect(editor.engine.getState().tracks.map((t: { id: string }) => t.id)).toEqual(['keys']);
  });

  it('after a disconnect editor.adapter is null and a fresh adapter builds a new engine on the same arrangement', async () => {
    const first = makeFakeAdapter();
    const editor = (await mountEditor({ adapter: first.adapter })) as any;
    editor._arrangement.addTrack(midiTrack('keys'));
    const firstEngine = editor.engine;
    editor.remove();
    expect(editor.adapter).toBeNull();
    expect(editor.engine).toBeNull();
    expect(first.adapter.dispose).toHaveBeenCalledTimes(1);

    document.body.appendChild(editor);
    await tick(2);
    const second = makeFakeAdapter();
    editor.adapter = second.adapter;
    expect(editor.engine).not.toBeNull();
    expect(editor.engine).not.toBe(firstEngine);
    expect(editor.engine.getState().tracks.map((t: { id: string }) => t.id)).toEqual(['keys']);
    expect(editor.engine.canUndo).toBe(true);
  });

  it('sampleRate is the adapter context rate', async () => {
    const editor = await mountEditor({ adapter: makeFakeAdapter({ sampleRate: 44100 }).adapter });
    expect(editor.sampleRate).toBe(44100);
    expect((editor as any).effectiveSampleRate).toBe(44100);
  });

  it('_ensureEngine rejects without an adapter', async () => {
    const editor = (await mountEditor({ adapter: null })) as any;
    await expect(editor._ensureEngine()).rejects.toThrow('No PlayoutAdapter set');
  });
});
