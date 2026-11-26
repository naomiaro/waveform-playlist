/**
 * `<daw-editor>` draws and reports what its arrangement holds, with no copy
 * of the tracks of its own (#848 PR 3, Task 3).
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  makeFakeAdapter,
  mountEditor,
  settle,
  stubFetch,
  stubPeakPipeline,
  tick,
} from './helpers/editor-harness';
import type { DawEditorElement } from '../elements/daw-editor';
import type { Arrangement } from '@waveform-playlist/engine';

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

type Editor = DawEditorElement & { _arrangement: Arrangement };

const editors: HTMLElement[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.remove();
});

async function setup(html: string): Promise<Editor> {
  stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
  const mounted = await mountEditor({
    adapter: makeFakeAdapter().adapter,
    before: (e) => stubPeakPipeline(e),
    html,
  });
  editors.push(mounted);
  await settle(mounted);
  return mounted as Editor;
}

const ONE =
  '<daw-track name="A"><daw-clip src="/a.wav" start="0" duration="1"></daw-clip></daw-track>';
const TWO =
  ONE + '<daw-track name="B"><daw-clip src="/b.wav" start="0" duration="1"></daw-clip></daw-track>';

describe('<daw-editor> reads its arrangement (#848)', () => {
  it('editor.tracks lists clips as the arrangement holds them, after a moveClip', async () => {
    const editor = await setup(ONE);
    const [track] = editor._arrangement.getTracks();
    const clipId = track.clips[0].id;
    editor._arrangement.moveClip(track.id, clipId, 48000);
    const listed = editor.tracks[0].clips.find((c) => c.clipId === clipId);
    expect(listed?.start).toBe(1);
    expect(listed?.duration).toBe(1);
  });

  it('an undo-restored track is listed with its name and kind, and drawn', async () => {
    const editor = await setup(TWO);
    const b = editor._arrangement.getTracks()[1].id;
    editor.removeTrack(b);
    await tick();
    expect(editor.tracks.map((t) => t.name)).toEqual(['A']);
    editor._arrangement.undo();
    await (editor as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    expect(editor.tracks.map((t) => [t.name, t.kind])).toEqual([
      ['A', 'audio'],
      ['B', 'audio'],
    ]);
    expect(editor.shadowRoot!.querySelectorAll('.track-row')).toHaveLength(2);
  });

  it('the mix shown on a detached editor follows an undo made on its arrangement', async () => {
    const editor = await setup(ONE);
    const id = editor._arrangement.getTracks()[0].id;
    editor._arrangement.setTrackVolume(id, 0.25);
    editor.remove();
    editor._arrangement.undo();
    expect(editor.tracks[0].volume).toBe(1);
  });

  it('a name attribute change renames the track in the arrangement, one undo step', async () => {
    const editor = await setup(ONE);
    const el = editor.querySelector('daw-track')!;
    el.setAttribute('name', 'Renamed');
    await tick(3);
    expect(editor._arrangement.getTracks()[0].name).toBe('Renamed');
    expect(editor.tracks[0].name).toBe('Renamed');
    editor._arrangement.undo();
    expect(editor._arrangement.getTracks()[0].name).toBe('A');
  });
});
