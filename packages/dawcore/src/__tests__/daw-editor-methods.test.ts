/**
 * The editor's methods are arrangement calls (#848 PR 3, P18): addTrack and
 * addClip make no element, updateTrack / updateClip write no element, and
 * removeTrack / removeClip remove the element when there is one.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import {
  makeFakeAdapter,
  mountEditor,
  settle,
  stubFetch,
  stubPeakPipeline,
  tick,
} from './helpers/editor-harness';
import type { Arrangement } from '@waveform-playlist/engine';

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

type Editor = HTMLElement & {
  _arrangement: Arrangement;
  adapter: unknown;
  addTrack(config: object): Promise<string>;
  addClip(trackId: string, config: object): Promise<string>;
  updateTrack(trackId: string, partial: object): void;
  removeTrack(trackId: string): void;
  loadMidi(source: string): Promise<unknown>;
};

const editors: HTMLElement[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.remove();
  vi.restoreAllMocks();
});

async function setup(html = ''): Promise<Editor> {
  stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
  const mounted = await mountEditor({
    adapter: makeFakeAdapter().adapter,
    before: (e) => stubPeakPipeline(e),
    html,
  });
  editors.push(mounted);
  await settle(mounted);
  return mounted as unknown as Editor;
}

const trackOf = (editor: Editor, id: string) =>
  editor._arrangement.getTracks().find((t) => t.id === id);

describe('<daw-editor> methods call the arrangement (#848)', () => {
  it('addTrack creates no element and resolves with an id the arrangement holds', async () => {
    const editor = await setup();
    const id = await editor.addTrack({ name: 'Keys', volume: 0.5, midi: { notes: [] } });
    expect(editor.querySelectorAll('daw-track')).toHaveLength(0);
    expect(trackOf(editor, id)?.name).toBe('Keys');
    expect(editor._arrangement.getMixer().get(id)?.volume).toBe(0.5);
  });

  it('addClip on an element-less track loads the clip, creating no <daw-clip>', async () => {
    const editor = await setup();
    const id = await editor.addTrack({ name: 'A' });
    const clipId = await editor.addClip(id, { src: '/a.wav', start: 1 });
    expect(editor.querySelectorAll('daw-clip')).toHaveLength(0);
    const clip = trackOf(editor, id)?.clips.find((c) => c.id === clipId);
    expect(clip && 'startSample' in clip ? clip.startSample : null).toBe(48000);
  });

  it('updateTrack on an element-backed track changes trackEl.volume and not its attribute', async () => {
    const editor = await setup('<daw-track name="A" volume="0.8"></daw-track>');
    const el = editor.querySelector('daw-track') as HTMLElement & {
      trackId: string;
      volume: number;
    };
    editor.updateTrack(el.trackId, { volume: 0.3, name: 'Renamed' });
    expect(el.volume).toBe(0.3);
    expect(el.getAttribute('volume')).toBe('0.8');
    expect(el.getAttribute('name')).toBe('A');
    expect(trackOf(editor, el.trackId)?.name).toBe('Renamed');
  });

  it('removeTrack removes the element; undo brings the track back with no element', async () => {
    const editor = await setup('<daw-track name="A"></daw-track><daw-track name="B"></daw-track>');
    const b = editor.querySelectorAll('daw-track')[1] as HTMLElement & { trackId: string };
    editor.removeTrack(b.trackId);
    await tick();
    expect(editor.querySelectorAll('daw-track')).toHaveLength(1);
    editor._arrangement.undo();
    expect(trackOf(editor, b.trackId)?.name).toBe('B');
    expect(editor.querySelectorAll('daw-track')).toHaveLength(1);
  });

  it('a failed engine build rejects the addTrack calls waiting to enter', async () => {
    const mounted = await mountEditor({ adapter: null, before: (e) => stubPeakPipeline(e) });
    editors.push(mounted);
    const editor = mounted as unknown as Editor;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const waiting = editor.addTrack({ name: 'Late', midi: { notes: [] } });
    const broken = makeFakeAdapter().adapter;
    broken.setTempo = () => {
      throw new Error('adapter broken');
    };
    editor.adapter = broken;
    await expect(waiting).rejects.toThrow('adapter broken');
  });

  it('an addClip made before a disconnect settles after a fresh adapter loads it', async () => {
    const fake = makeFakeAdapter();
    const held = fake.holdDecode('/b.wav');
    stubFetch({ '/b.wav': 'ok' });
    const mounted = await mountEditor({
      adapter: fake.adapter,
      before: (e) => stubPeakPipeline(e),
    });
    editors.push(mounted);
    const editor = mounted as unknown as Editor;
    const id = await editor.addTrack({ name: 'A' });
    const pending = editor.addClip(id, { src: '/b.wav' });
    await tick();
    editor.remove();
    held.resolve();
    document.body.appendChild(editor);
    editor.adapter = makeFakeAdapter().adapter;
    await expect(pending).resolves.toEqual(expect.any(String));
  });
});
