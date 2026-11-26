// #848 PR 2: tracks enter the editor's arrangement as soon as there is an
// engine, with a loading clip per audio clip; the arrangement loads them,
// and the editor's load events are read from it.
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { isLoadingClip } from '@waveform-playlist/core';
import {
  makeAudioBuffer,
  makeAudioFile,
  makeFakeAdapter,
  mountEditor,
  restoreFetch,
  settle,
  stubFetch,
  stubPeakPipeline,
  tick,
} from './helpers/editor-harness';
import type { FakeAdapter } from './helpers/editor-harness';

vi.mock('../workers/waveformDataUtils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../workers/waveformDataUtils')>();
  return {
    ...actual,
    extractPeaks: vi.fn(() => ({ data: [new Int16Array(4)], length: 4, bits: 16 })),
  };
});

beforeAll(async () => {
  await import('../index');
});

afterEach(() => {
  restoreFetch();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const MIDI_TRACK =
  '<daw-track name="Keys" kind="midi"><daw-clip duration="1"></daw-clip></daw-track>';

function audioTrack(name: string, src: string, extra = ''): string {
  return `<daw-track name="${name}"><daw-clip src="${src}" duration="2" ${extra}></daw-clip></daw-track>`;
}

function names(editor: any): string[] {
  return editor._arrangement.getTracks().map((t: { name: string }) => t.name);
}

function events(editor: HTMLElement, types: string[]) {
  const seen: Array<{ type: string; detail: any }> = [];
  for (const type of types) {
    editor.addEventListener(type, (e) => seen.push({ type, detail: (e as CustomEvent).detail }));
  }
  return seen;
}

async function mount(fake: FakeAdapter, html: string): Promise<any> {
  return mountEditor({ adapter: fake.adapter, html, before: (e) => stubPeakPipeline(e) });
}

describe('daw-editor: tracks enter the arrangement and load through it', () => {
  it('a declared track enters the arrangement at once with a loading clip, before its audio', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok' });
    const held = fake.holdDecode('/a.wav');
    const editor = await mount(fake, audioTrack('A', '/a.wav', 'start="1.5"'));
    const clipEl = editor.querySelector('daw-clip');
    const clip = editor._arrangement.getTracks()[0].clips[0];
    expect(isLoadingClip(clip)).toBe(true);
    expect(clip).toMatchObject({ id: clipEl.clipId, src: '/a.wav', start: 1.5, duration: 2 });
    held.resolve();
    await settle(editor);
    const loaded = editor._arrangement.getTracks()[0].clips[0];
    expect(isLoadingClip(loaded)).toBe(false);
    expect(loaded.id).toBe(clipEl.clipId);
  });

  it('loading does not clear the undo history', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/b.wav': 'ok' });
    const editor = await mount(fake, MIDI_TRACK);
    const keys = editor._arrangement.getTracks()[0].id;
    editor._arrangement.setTrackVolume(keys, 0.5);
    const held = fake.holdDecode('/b.wav');
    editor.insertAdjacentHTML('beforeend', audioTrack('B', '/b.wav'));
    await tick(2);
    expect(names(editor)).toEqual(['Keys', 'B']);
    held.resolve();
    await settle(editor);
    expect(editor._arrangement.canUndo).toBe(true);
    editor._arrangement.undo();
    expect(names(editor)).toEqual(['Keys']);
    expect(editor._arrangement.getMixer().get(keys).volume).toBe(0.5);
    editor._arrangement.undo();
    expect(editor._arrangement.getMixer().get(keys).volume).toBe(1);
  });

  it('the page tracks are not undo steps', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const editor = await mount(
      fake,
      MIDI_TRACK + audioTrack('A', '/a.wav') + audioTrack('B', '/b.wav')
    );
    await settle(editor);
    expect(names(editor)).toEqual(['Keys', 'A', 'B']);
    expect(editor._arrangement.canUndo).toBe(false);
  });

  it('page tracks appended after an edit are undo steps', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const editor = await mount(fake, MIDI_TRACK);
    editor._arrangement.setTrackVolume(editor._arrangement.getTracks()[0].id, 0.5);
    editor.insertAdjacentHTML('beforeend', audioTrack('A', '/a.wav') + audioTrack('B', '/b.wav'));
    await tick(2);
    await settle(editor);
    editor._arrangement.undo();
    editor._arrangement.undo();
    expect(names(editor)).toEqual(['Keys']);
    expect(editor._arrangement.canUndo).toBe(true);
  });

  it('page tracks keep DOM order whatever order their audio loads in', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok', '/c.wav': 'ok' });
    const holds = ['/a.wav', '/b.wav', '/c.wav'].map((src) => fake.holdDecode(src));
    const editor = await mount(
      fake,
      audioTrack('A', '/a.wav') + audioTrack('B', '/b.wav') + audioTrack('C', '/c.wav')
    );
    holds[2].resolve();
    await tick(2);
    holds[0].resolve();
    await tick(2);
    holds[1].resolve();
    await settle(editor);
    expect(names(editor)).toEqual(['A', 'B', 'C']);
    expect(editor.engine.getState().tracks.map((t: { name: string }) => t.name)).toEqual([
      'A',
      'B',
      'C',
    ]);
  });

  it('a <daw-track> inserted between two others lands at its DOM position', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok', '/c.wav': 'ok' });
    const editor = await mount(fake, audioTrack('A', '/a.wav') + audioTrack('C', '/c.wav'));
    await settle(editor);
    editor
      .querySelectorAll('daw-track')[0]
      .insertAdjacentHTML('afterend', audioTrack('B', '/b.wav'));
    await tick(2);
    expect(names(editor)).toEqual(['A', 'B', 'C']);
  });

  it('a failed track stays, with daw-clip-error and daw-track-error, and loads after a retry', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/gone.wav': 404 });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const editor = document.createElement('daw-editor') as any;
    const seen = events(editor, ['daw-clip-error', 'daw-track-error', 'daw-track-ready']);
    editor.adapter = fake.adapter;
    stubPeakPipeline(editor);
    editor.innerHTML = audioTrack('Gone', '/gone.wav');
    document.body.appendChild(editor);
    await tick(2);
    await settle(editor);
    expect(seen.map((e) => e.type)).toEqual(['daw-clip-error', 'daw-track-error']);
    expect(seen[0].detail.error.message).toMatch(/404/);
    expect(names(editor)).toEqual(['Gone']);
    expect(editor.tracks.map((t: { name: string }) => t.name)).toEqual(['Gone']);

    stubFetch({ '/gone.wav': 'ok' });
    editor._arrangement.retry('/gone.wav');
    await settle(editor);
    expect(seen.map((e) => e.type)).toEqual([
      'daw-clip-error',
      'daw-track-error',
      'daw-track-ready',
    ]);
    expect(isLoadingClip(editor._arrangement.getTracks()[0].clips[0])).toBe(false);
    warn.mockRestore();
  });

  it('a track of two clips, one failed, is ready', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok', '/gone.wav': 404 });
    const editor = document.createElement('daw-editor') as any;
    const seen = events(editor, ['daw-clip-error', 'daw-track-error', 'daw-track-ready']);
    editor.adapter = fake.adapter;
    stubPeakPipeline(editor);
    editor.innerHTML =
      '<daw-track name="T"><daw-clip src="/a.wav" duration="1"></daw-clip>' +
      '<daw-clip src="/gone.wav" start="2" duration="1"></daw-clip></daw-track>';
    document.body.appendChild(editor);
    await tick(2);
    await settle(editor);
    expect(seen.map((e) => e.type).sort()).toEqual(['daw-clip-error', 'daw-track-ready']);
  });

  it('tracks wait for the adapter, without a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const editor = (await mountEditor({
      adapter: null,
      html: audioTrack('A', '/a.wav') + audioTrack('B', '/b.wav'),
    })) as any;
    expect(editor.tracks.map((t: { name: string }) => t.name)).toEqual(['A', 'B']);
    expect(names(editor)).toEqual([]);
    // Maintainer, #917: no warning; play() throws the no-adapter error.
    expect(warn).not.toHaveBeenCalled();
    stubPeakPipeline(editor);
    editor.adapter = makeFakeAdapter().adapter;
    expect(names(editor)).toEqual(['A', 'B']);
  });

  it('a control moved before a track loads is an undo step on the arrangement', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok' });
    fake.holdDecode('/a.wav');
    const editor = await mount(fake, audioTrack('A', '/a.wav'));
    const trackId = editor._arrangement.getTracks()[0].id;
    editor.dispatchEvent(
      new CustomEvent('daw-track-control', {
        detail: { trackId, prop: 'volume', value: 0.25 },
        bubbles: true,
        composed: true,
      })
    );
    expect(editor._arrangement.getMixer().get(trackId).volume).toBe(0.25);
    expect(editor._arrangement.canUndo).toBe(true);
    expect(editor.tracks[0].volume).toBe(0.25);
  });

  it('removing a track while it loads removes it; the late audio changes nothing', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok' });
    const held = fake.holdDecode('/a.wav');
    const editor = document.createElement('daw-editor') as any;
    const seen = events(editor, ['daw-track-error', 'daw-track-ready']);
    editor.adapter = fake.adapter;
    stubPeakPipeline(editor);
    editor.innerHTML = audioTrack('A', '/a.wav');
    document.body.appendChild(editor);
    await tick(2);
    expect(names(editor)).toEqual(['A']);
    editor.querySelector('daw-track').remove();
    await tick();
    expect(names(editor)).toEqual([]);
    held.resolve();
    await tick(3);
    expect(names(editor)).toEqual([]);
    expect(seen).toEqual([]);
  });

  it('a .dat preview is drawn for a loading clip and kept when the audio arrives', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok' });
    const held = fake.holdDecode('/a.wav');
    const buffer = makeAudioBuffer(2);
    fake.setDecoded('/a.wav', buffer);
    const waveformData = { sample_rate: 48000, scale: 256, duration: 2, length: 375, bits: 16 };
    let pipeline: ReturnType<typeof stubPeakPipeline> | null = null;
    const editor = (await mountEditor({
      adapter: fake.adapter,
      html: audioTrack('A', '/a.wav', 'peaks-src="/a.dat"'),
      before: (e: any) => {
        pipeline = stubPeakPipeline(e);
        e._fetchPeaks = vi.fn().mockResolvedValue(waveformData);
      },
    })) as any;
    await tick(2);
    const clipId = editor.querySelector('daw-clip').clipId;
    expect(editor._previewPeaks.has(clipId)).toBe(true);
    held.resolve();
    await settle(editor);
    expect(pipeline!.cacheWaveformData).toHaveBeenCalledWith(buffer, waveformData);
    expect(editor._peaksData.has(clipId)).toBe(true);
    expect(editor._previewPeaks.has(clipId)).toBe(false);
  });

  it('a wrong-kind clip is refused and reported; a track with none left enters empty and reports daw-track-error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok' });
    const editor = document.createElement('daw-editor') as any;
    const seen = events(editor, ['daw-clip-error', 'daw-track-error', 'daw-track-ready']);
    editor.adapter = fake.adapter;
    stubPeakPipeline(editor);
    editor.innerHTML =
      '<daw-track name="M" kind="midi"><daw-clip src="/a.wav"></daw-clip></daw-track>';
    document.body.appendChild(editor);
    await tick(2);
    await settle(editor);
    expect(seen.map((e) => e.type)).toEqual(['daw-clip-error', 'daw-track-error']);
    expect(names(editor)).toEqual(['M']);
    expect(editor._arrangement.getTracks()[0].clips).toEqual([]);
    warn.mockRestore();
  });
});

describe('daw-editor: draws loading and failed clips (#848)', () => {
  function box(editor: any, clipId: string): HTMLElement | null {
    return editor.shadowRoot.querySelector(`.clip-container[data-clip-id="${clipId}"]`);
  }

  it('a loading clip with a duration is a placeholder of that width', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok' });
    fake.holdDecode('/a.wav');
    const editor = await mount(fake, audioTrack('A', '/a.wav', 'start="1"'));
    await editor.updateComplete;
    const clipId = editor.querySelector('daw-clip').clipId;
    const placeholder = box(editor, clipId);
    expect(placeholder).not.toBeNull();
    expect(placeholder!.classList.contains('placeholder')).toBe(true);
    expect(placeholder!.classList.contains('failed')).toBe(false);
    const spp = editor.samplesPerPixel;
    expect(placeholder!.style.width).toBe(`${Math.round((2 * 48000) / spp)}px`);
    expect(placeholder!.style.left).toBe(`${Math.floor(48000 / spp)}px`);
    expect(editor.duration).toBe(3);
  });

  it('a failed clip is drawn failed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fake = makeFakeAdapter();
    stubFetch({ '/gone.wav': 404 });
    const editor = await mount(fake, audioTrack('Gone', '/gone.wav'));
    await settle(editor);
    await editor.updateComplete;
    const placeholder = box(editor, editor.querySelector('daw-clip').clipId);
    expect(placeholder!.classList.contains('failed')).toBe(true);
    warn.mockRestore();
  });

  it('a loading clip of unknown length is not drawn, but its row and controls are', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok' });
    fake.holdDecode('/a.wav');
    const editor = await mount(
      fake,
      '<daw-track name="A"><daw-clip src="/a.wav"></daw-clip></daw-track>'
    );
    await editor.updateComplete;
    expect(box(editor, editor.querySelector('daw-clip').clipId)).toBeNull();
    expect(editor.shadowRoot.querySelectorAll('.track-row')).toHaveLength(1);
    expect(editor.shadowRoot.querySelectorAll('daw-track-controls')).toHaveLength(1);
  });

  it('rows follow the arrangement order without a DOM move', async () => {
    const fake = makeFakeAdapter();
    const editor = await mount(fake, MIDI_TRACK + MIDI_TRACK.replace('Keys', 'Bass'));
    await editor.updateComplete;
    const [keys, bass] = editor._arrangement.getTracks().map((t: { id: string }) => t.id);
    editor._arrangement.reorderTrack(bass, 0);
    await editor.updateComplete;
    const rows = [...editor.shadowRoot.querySelectorAll('.track-row')].map(
      (row: any) => row.dataset.trackId
    );
    expect(rows).toEqual([bass, keys]);
  });
});

describe("daw-editor's methods on the arrangement (#848)", () => {
  it('addTrack resolves with the track id once the track has entered, before its audio', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok' });
    fake.holdDecode('/a.wav');
    const editor = await mount(fake, '');
    const id = await editor.addTrack({ name: 'A', clips: [{ src: '/a.wav', duration: 2 }] });
    expect(typeof id).toBe('string');
    expect(editor._arrangement.getTracks().map((t: { id: string }) => t.id)).toEqual([id]);
    expect(isLoadingClip(editor._arrangement.getTracks()[0].clips[0])).toBe(true);
  });

  it('addTrack before the adapter resolves once the adapter is set', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch({ '/a.wav': 'ok' });
    const editor = (await mountEditor({ adapter: null })) as any;
    let id: string | null = null;
    const pending = editor.addTrack({ name: 'A', clips: [{ src: '/a.wav' }] }).then((v: string) => {
      id = v;
    });
    await tick(2);
    expect(id).toBeNull();
    stubPeakPipeline(editor);
    editor.adapter = makeFakeAdapter().adapter;
    await pending;
    expect(names(editor)).toEqual(['A']);
  });

  it('addClip adds a loading clip as one undo step and resolves on daw-clip-ready', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const editor = await mount(fake, audioTrack('A', '/a.wav'));
    await settle(editor);
    const trackId = editor._arrangement.getTracks()[0].id;
    const held = fake.holdDecode('/b.wav');
    const pending = editor.addClip(trackId, { src: '/b.wav', start: 3, duration: 1 });
    await tick();
    const clips = editor._arrangement.getTracks()[0].clips;
    expect(clips).toHaveLength(2);
    expect(isLoadingClip(clips[1])).toBe(true);
    expect(editor._arrangement.canUndo).toBe(true);
    held.resolve();
    const clipId = await pending;
    expect(clipId).toBe(clips[1].id);
  });

  it('addClip of a source that is already loaded resolves', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok' });
    const editor = await mount(fake, audioTrack('A', '/a.wav'));
    await settle(editor);
    const trackId = editor._arrangement.getTracks()[0].id;
    const clipId = await editor.addClip(trackId, { src: '/a.wav', start: 3, duration: 1 });
    expect(typeof clipId).toBe('string');
  });

  it("an edit of a loaded clip keeps the track's loading clips", async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    fake.holdDecode('/b.wav');
    const editor = await mount(
      fake,
      '<daw-track name="T"><daw-clip src="/a.wav" duration="1"></daw-clip>' +
        '<daw-clip src="/b.wav" start="2" duration="1"></daw-clip></daw-track>'
    );
    await vi.waitFor(() =>
      expect(isLoadingClip(editor._arrangement.getTracks()[0].clips[0])).toBe(false)
    );
    const trackId = editor._arrangement.getTracks()[0].id;
    const [loadedId, loadingId] = [...editor.querySelectorAll('daw-clip')].map(
      (c: any) => c.clipId
    );
    editor.updateClip(trackId, loadedId, { start: 0.5 });
    await tick();
    const clips = editor._arrangement.getTracks()[0].clips;
    expect(clips.map((c: { id: string }) => c.id)).toEqual([loadedId, loadingId]);
    expect(clips[0].startSample).toBe(24000);
    expect(isLoadingClip(clips[1])).toBe(true);
  });

  it('removing a loading clip removes it from the arrangement', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok' });
    fake.holdDecode('/a.wav');
    const editor = await mount(fake, audioTrack('A', '/a.wav'));
    const trackId = editor._arrangement.getTracks()[0].id;
    editor.removeClip(trackId, editor.querySelector('daw-clip').clipId);
    await tick();
    expect(editor._arrangement.getTracks()[0].clips).toEqual([]);
  });

  it('a dropped file enters as an element-less track; a failed one is removed and cannot be brought back by undo', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fake = makeFakeAdapter();
    fake.setDecoded('bad.wav', new Error('cannot decode'));
    const editor = await mount(fake, MIDI_TRACK);
    editor._arrangement.setTrackVolume(editor._arrangement.getTracks()[0].id, 0.5);
    const good = makeAudioFile('good.wav');
    const bad = makeAudioFile('bad.wav');
    const result = await editor.loadFiles([good, bad]);
    expect(result.loaded).toHaveLength(1);
    expect(result.failed.map((f: { file: File }) => f.file)).toEqual([bad]);
    expect(editor.querySelectorAll('daw-track')).toHaveLength(1);
    expect(names(editor)).toEqual(['Keys', 'good']);
    editor._arrangement.undo();
    expect(names(editor)).toEqual(['Keys']);
    editor._arrangement.redo();
    expect(names(editor)).toEqual(['Keys', 'good']);
    expect(editor.tracks.map((t: { name: string }) => t.name)).toEqual(['Keys', 'good']);
  });

  it('retryTrack loads a failed track', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fake = makeFakeAdapter();
    stubFetch({ '/gone.wav': 503 });
    const editor = await mount(fake, audioTrack('Gone', '/gone.wav'));
    await settle(editor);
    const trackId = editor._arrangement.getTracks()[0].id;
    stubFetch({ '/gone.wav': 'ok' });
    editor.retryTrack(trackId);
    await settle(editor);
    expect(isLoadingClip(editor._arrangement.getTracks()[0].clips[0])).toBe(false);
  });
});

describe('editor.tracks follows the arrangement (#848)', () => {
  it('an undone addTrack is not in editor.tracks; a redo brings it back', async () => {
    const fake = makeFakeAdapter();
    const editor = await mount(fake, MIDI_TRACK);
    editor._arrangement.setTrackVolume(editor._arrangement.getTracks()[0].id, 0.5);
    await editor.addTrack({ name: 'Added', midi: { notes: [] } });
    expect(editor.tracks.map((t: { name: string }) => t.name)).toEqual(['Keys', 'Added']);
    editor._arrangement.undo();
    expect(editor.tracks.map((t: { name: string }) => t.name)).toEqual(['Keys']);
    editor._arrangement.redo();
    expect(editor.tracks.map((t: { name: string }) => t.name)).toEqual(['Keys', 'Added']);
  });

  it('lists the tracks in the arrangement order', async () => {
    const editor = await mount(makeFakeAdapter(), MIDI_TRACK + MIDI_TRACK.replace('Keys', 'Bass'));
    const [, bass] = editor._arrangement.getTracks().map((t: { id: string }) => t.id);
    editor._arrangement.reorderTrack(bass, 0);
    expect(editor.tracks.map((t: { name: string }) => t.name)).toEqual(['Bass', 'Keys']);
  });
});

// Behaviour the old tests covered under other rules (#848: they expected a
// rejection and a warning; a track is in the arrangement while it loads).
describe('clips appended while a track loads or waits (#848)', () => {
  it('addClip onto a track whose audio is still loading adds a loading clip and resolves when it loads', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const heldA = fake.holdDecode('/a.wav');
    const editor = await mount(fake, audioTrack('A', '/a.wav'));
    const trackId = editor._arrangement.getTracks()[0].id;
    const pending = editor.addClip(trackId, { src: '/b.wav', start: 3, duration: 1 });
    await tick();
    expect(editor._arrangement.getTracks()[0].clips.map((c: { src?: string }) => c.src)).toEqual([
      '/a.wav',
      '/b.wav',
    ]);
    const clipId = await pending; // /b.wav decodes while /a.wav is still held
    expect(isLoadingClip(editor._arrangement.getTracks()[0].clips[1])).toBe(false);
    expect(clipId).toBe(editor._arrangement.getTracks()[0].clips[1].id);
    heldA.resolve();
    await settle(editor);
  });

  it('a <daw-clip> appended to a track waiting for the adapter enters with it', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const editor = (await mountEditor({ adapter: null, html: audioTrack('A', '/a.wav') })) as any;
    editor
      .querySelector('daw-track')
      .insertAdjacentHTML('beforeend', '<daw-clip src="/b.wav" start="3" duration="1"></daw-clip>');
    await tick(2);
    stubPeakPipeline(editor);
    editor.adapter = makeFakeAdapter().adapter;
    const clips = editor._arrangement.getTracks()[0].clips;
    expect(clips.map((c: { src?: string }) => c.src)).toEqual(['/a.wav', '/b.wav']);
    expect(console.warn).not.toHaveBeenCalledWith(expect.stringContaining('still loading'));
  });
});

// Review of #917: each test reproduces a finding of the first round.
describe('review fixes (#917)', () => {
  it('M1: a track that connects during a drag enters when the drag ends, not inside it', async () => {
    const editor = await mount(makeFakeAdapter(), MIDI_TRACK);
    let dragging = true;
    Object.defineProperty(editor, '_dragInProgress', { get: () => dragging, configurable: true });
    editor.insertAdjacentHTML('beforeend', MIDI_TRACK.replace('Keys', 'Late'));
    await tick(2);
    expect(names(editor)).toEqual(['Keys']);
    dragging = false;
    window.dispatchEvent(new Event('pointerup'));
    await tick(2);
    expect(names(editor)).toEqual(['Keys', 'Late']);
  });

  it('M2: a DOM reorder with an element-less track in between reorders the rows', async () => {
    const editor = await mount(
      makeFakeAdapter(),
      MIDI_TRACK.replace('Keys', 'A') +
        MIDI_TRACK.replace('Keys', 'B') +
        MIDI_TRACK.replace('Keys', 'C')
    );
    editor.querySelectorAll('daw-track')[1].remove();
    await tick();
    editor._arrangement.undo(); // B comes back without an element, in the middle
    expect(names(editor)).toEqual(['A', 'B', 'C']);
    const c = editor._arrangement.getTracks()[2].id;
    editor.reorderTrack(c, 0);
    await tick();
    expect(names(editor)).toEqual(['C', 'B', 'A']);
  });

  it('M3: a reparent with the adapter set at once does not add an undone track again', async () => {
    const editor = await mount(makeFakeAdapter(), MIDI_TRACK);
    editor._arrangement.setTrackVolume(editor._arrangement.getTracks()[0].id, 0.5);
    await editor.addTrack({ name: 'B', midi: { notes: [] } });
    editor._arrangement.undo();
    expect(names(editor)).toEqual(['Keys']);
    const other = document.createElement('div');
    document.body.appendChild(other);
    other.appendChild(editor);
    editor.adapter = makeFakeAdapter().adapter;
    await tick(2);
    expect(names(editor)).toEqual(['Keys']);
    expect(editor._arrangement.canRedo).toBe(true);
  });

  it('M4: loadFiles resolves when the editor is disconnected; the file loading then is kept and reported loaded', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fake = makeFakeAdapter();
    const editor = await mount(fake, '');
    const held = fake.holdDecode('f2.wav');
    const files = [makeAudioFile('f1.wav'), makeAudioFile('f2.wav'), makeAudioFile('f3.wav')];
    const result = editor.loadFiles(files);
    await vi.waitFor(() => expect(fake.decodeCount('f2.wav')).toBe(1));
    editor.remove();
    const settled = await Promise.race([result, tick(20).then(() => 'still pending')]);
    expect(settled).not.toBe('still pending');
    const { loaded, failed } = settled as { loaded: string[]; failed: Array<{ file: File }> };
    expect(loaded).toHaveLength(2);
    expect(failed.map((f) => f.file)).toEqual([files[2]]);
    expect(names(editor)).toEqual(['f1', 'f2']);
    held.resolve();
  });

  it('L1: addClip rejects when its clip is removed before its audio loads', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const editor = await mount(fake, audioTrack('A', '/a.wav'));
    await settle(editor);
    const trackId = editor._arrangement.getTracks()[0].id;
    fake.holdDecode('/b.wav');
    const pending = editor.addClip(trackId, { src: '/b.wav', start: 3, duration: 1 });
    const outcome = pending.then(
      () => 'resolved',
      (err: Error) => err.message
    );
    await tick();
    editor.removeClip(trackId, editor._arrangement.getTracks()[0].clips[1].id);
    expect(await outcome).toMatch(/removed before/);
  });

  it('L2: a clip removed or changed while its track waits for the adapter enters as it is then', async () => {
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const editor = (await mountEditor({
      adapter: null,
      html:
        '<daw-track name="T"><daw-clip src="/a.wav" duration="1"></daw-clip>' +
        '<daw-clip src="/b.wav" start="2" duration="1"></daw-clip></daw-track>',
    })) as any;
    const [keep, gone] = [...editor.querySelectorAll('daw-clip')] as any[];
    gone.remove();
    keep.start = 5;
    await keep.updateComplete;
    await tick(2);
    stubPeakPipeline(editor);
    editor.adapter = makeFakeAdapter().adapter;
    const clips = editor._arrangement.getTracks()[0].clips;
    expect(clips.map((c: { id: string }) => c.id)).toEqual([keep.clipId]);
    expect(clips[0].start).toBe(5);
  });

  it('L3: reorderTrack of an element-less track on a detached editor reorders the arrangement', async () => {
    const editor = await mount(
      makeFakeAdapter(),
      MIDI_TRACK.replace('Keys', 'A') + MIDI_TRACK.replace('Keys', 'B')
    );
    editor.querySelectorAll('daw-track')[1].remove();
    await tick();
    editor._arrangement.undo();
    const b = editor._arrangement.getTracks()[1].id;
    editor.remove();
    expect(() => editor.reorderTrack(b, 0)).not.toThrow();
    expect(names(editor)).toEqual(['B', 'A']);
  });

  it('L4: removeTrack on a detached editor removes the track too', async () => {
    const editor = await mount(makeFakeAdapter(), MIDI_TRACK.replace('Keys', 'A') + MIDI_TRACK);
    const a = editor._arrangement.getTracks()[0].id;
    editor.remove();
    editor.removeTrack(a);
    expect(names(editor)).toEqual(['Keys']);
    expect(editor.querySelectorAll('daw-track')).toHaveLength(1);
  });
});

describe('review fixes, round 1 fuzz (#917)', () => {
  it('L1: addClip rejects when an Undo takes its clip out before its audio loads', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const editor = await mount(fake, audioTrack('A', '/a.wav'));
    await settle(editor);
    const trackId = editor._arrangement.getTracks()[0].id;
    fake.holdDecode('/b.wav');
    const outcome = editor.addClip(trackId, { src: '/b.wav', start: 3, duration: 1 }).then(
      () => 'resolved',
      (err: Error) => err.message
    );
    await vi.waitFor(() => expect(editor._arrangement.getTracks()[0].clips).toHaveLength(2));
    editor._arrangement.undo();
    expect(await Promise.race([outcome, tick(10).then(() => 'still pending')])).toMatch(
      /removed before/
    );
  });

  it('L1: addClip rejects when its track is removed before its audio loads', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const editor = await mount(fake, audioTrack('A', '/a.wav'));
    await settle(editor);
    const trackId = editor._arrangement.getTracks()[0].id;
    fake.holdDecode('/b.wav');
    const outcome = editor.addClip(trackId, { src: '/b.wav', start: 3, duration: 1 }).then(
      () => 'resolved',
      (err: Error) => err.message
    );
    await vi.waitFor(() => expect(editor._arrangement.getTracks()[0].clips).toHaveLength(2));
    editor.removeTrack(trackId);
    expect(await Promise.race([outcome, tick(10).then(() => 'still pending')])).toMatch(
      /removed before/
    );
  });
});

describe('review fixes, round 2 (#917)', () => {
  it('N1: a <daw-track> removed while the editor is detached removes its track at reconnect', async () => {
    const editor = await mount(makeFakeAdapter(), MIDI_TRACK.replace('Keys', 'A') + MIDI_TRACK);
    editor.remove();
    editor.querySelectorAll('daw-track')[1].remove();
    document.body.appendChild(editor);
    editor.adapter = makeFakeAdapter().adapter;
    await tick(2);
    expect(names(editor)).toEqual(['A']);
    expect(editor.tracks.map((t: { name: string }) => t.name)).toEqual(['A']);
  });

  it('N2: addClip onto a track whose arrival an Undo took out rejects', async () => {
    const editor = await mount(makeFakeAdapter(), MIDI_TRACK);
    editor._arrangement.setTrackVolume(editor._arrangement.getTracks()[0].id, 0.5);
    const id = await editor.addTrack({ name: 'Added', clips: [] });
    editor._arrangement.undo();
    stubFetch({ '/a.wav': 'ok' });
    const outcome = editor.addClip(id, { src: '/a.wav', duration: 1 }).then(
      () => 'resolved',
      (err: Error) => err.message
    );
    expect(await Promise.race([outcome, tick(10).then(() => 'still pending')])).toMatch(
      /not in the editor/
    );
  });

  it('addClip onto a track waiting for the adapter rejects when that track is removed first', async () => {
    stubFetch({ '/a.wav': 'ok' });
    const editor = (await mountEditor({
      adapter: null,
      html: MIDI_TRACK.replace('kind="midi"', '').replace('<daw-clip duration="1"></daw-clip>', ''),
    })) as any;
    const trackId = editor.tracks[0].trackId;
    const outcome = editor.addClip(trackId, { src: '/a.wav', duration: 1 }).then(
      () => 'resolved',
      (err: Error) => err.message
    );
    await tick(2);
    editor.removeTrack(trackId);
    expect(await Promise.race([outcome, tick(10).then(() => 'still pending')])).toMatch(
      /removed before/
    );
  });

  it('N3: a rejected addClip leaves no listener on the editor', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const editor = await mount(fake, audioTrack('A', '/a.wav'));
    await settle(editor);
    const trackId = editor._arrangement.getTracks()[0].id;
    fake.holdDecode('/b.wav');
    const added = vi.spyOn(editor, 'addEventListener');
    const removed = vi.spyOn(editor, 'removeEventListener');
    const outcome = editor.addClip(trackId, { src: '/b.wav', duration: 1 }).catch(() => 'rejected');
    await vi.waitFor(() => expect(editor._arrangement.getTracks()[0].clips).toHaveLength(2));
    editor.removeClip(trackId, editor._arrangement.getTracks()[0].clips[1].id);
    expect(await outcome).toBe('rejected');
    const types = (spy: typeof added) =>
      spy.mock.calls
        .map((c) => c[0])
        .filter((t) => t === 'daw-clip-ready' || t === 'daw-clip-error');
    expect(types(removed).sort()).toEqual(types(added).sort());
  });
});

describe('review fixes, round 3 (#917)', () => {
  const pending = (p: Promise<unknown>) =>
    Promise.race([
      p.then(
        () => 'resolved',
        (err: Error) => err.message
      ),
      tick(10).then(() => 'still pending'),
    ]);

  it('L-a: addClip on a queued track rejects when its clip is removed before the track enters', async () => {
    stubFetch({ '/a.wav': 'ok' });
    const editor = (await mountEditor({
      adapter: null,
      html: '<daw-track name="T"></daw-track>',
    })) as any;
    const trackId = editor.tracks[0].trackId;
    const outcome = pending(editor.addClip(trackId, { src: '/a.wav', duration: 1 }));
    await tick(2);
    editor.querySelector('daw-clip').remove();
    expect(await outcome).toMatch(/removed before/);
  });

  it('L-b: addClip then its entered track removed in the same task rejects', async () => {
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const editor = await mount(makeFakeAdapter(), audioTrack('A', '/a.wav'));
    await settle(editor);
    const trackId = editor._arrangement.getTracks()[0].id;
    const outcome = pending(editor.addClip(trackId, { src: '/b.wav', duration: 1 }));
    editor.removeTrack(trackId);
    expect(await outcome).toMatch(/removed before/);
  });

  it('L-b: addClip then its queued track removed in the same task rejects', async () => {
    stubFetch({ '/a.wav': 'ok' });
    const editor = (await mountEditor({
      adapter: null,
      html: '<daw-track name="T"></daw-track>',
    })) as any;
    const trackId = editor.tracks[0].trackId;
    const outcome = pending(editor.addClip(trackId, { src: '/a.wav', duration: 1 }));
    editor.removeTrack(trackId);
    expect(await outcome).toMatch(/removed before/);
  });

  it('L-c: removing a queued track an addClip waits on sends no daw-clip-error', async () => {
    stubFetch({ '/a.wav': 'ok' });
    const editor = (await mountEditor({
      adapter: null,
      html: '<daw-track name="T"></daw-track>',
    })) as any;
    const errors: unknown[] = [];
    editor.addEventListener('daw-clip-error', (e: Event) => errors.push(e));
    const trackId = editor.tracks[0].trackId;
    const outcome = pending(editor.addClip(trackId, { src: '/a.wav', duration: 1 }));
    await tick(2);
    editor.removeTrack(trackId);
    expect(await outcome).toMatch(/removed before/);
    expect(errors).toEqual([]);
  });
});
