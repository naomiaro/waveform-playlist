/**
 * `<daw-track pan-law>` and the live `panLaw` property (#684). The attribute
 * is the page's declaration (the law the track enters with); the property
 * reads the arrangement's mixer value while the track is in it. The editor
 * writes no attribute: a law the first audio decided shows in the property.
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import {
  makeAudioBuffer,
  makeFakeAdapter,
  mountEditor,
  settle,
  stubFetch,
  stubPeakPipeline,
  tick,
} from './helpers/editor-harness';
import type { DawEditorElement } from '../elements/daw-editor';
import type { DawTrackElement } from '../elements/daw-track';
import type { Arrangement } from '@waveform-playlist/engine';
import { loadedTrack } from '../interactions/arrangement-view';
import { DEFAULT_TRACK_MIX } from '../utils/track-mix';

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

type Editor = DawEditorElement & { _arrangement: Arrangement };

const editors: HTMLElement[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.remove();
  vi.restoreAllMocks();
});

/** An editor whose `/mono.wav` decodes to one channel and `/stereo.wav` to two. */
async function setup(html: string): Promise<Editor> {
  stubFetch({ '/mono.wav': 'ok', '/stereo.wav': 'ok' });
  const fake = makeFakeAdapter();
  fake.setDecoded('/mono.wav', makeAudioBuffer(2, 48000, 1));
  fake.setDecoded('/stereo.wav', makeAudioBuffer(2, 48000, 2));
  const mounted = await mountEditor({
    adapter: fake.adapter,
    before: (e) => stubPeakPipeline(e),
    html,
  });
  editors.push(mounted);
  await settle(mounted);
  return mounted as Editor;
}

const clip = (src: string) => `<daw-clip src="${src}" start="0" duration="1"></daw-clip>`;
const trackEl = (editor: Editor, index = 0) =>
  editor.querySelectorAll('daw-track')[index] as DawTrackElement;
const law = (editor: Editor, index = 0) => {
  const [id] = [editor._arrangement.getTracks()[index].id];
  return editor._arrangement.getMixer().get(id)?.panLaw;
};

describe('<daw-track pan-law>', () => {
  it('the declared law is the law the track enters with, whatever its audio', async () => {
    const editor = await setup(`<daw-track pan-law="stereo">${clip('/mono.wav')}</daw-track>`);
    expect(law(editor)).toBe('stereo');
    expect(trackEl(editor).panLaw).toBe('stereo');
  });

  it('with no attribute the first audio decides, and the editor writes no attribute', async () => {
    const editor = await setup(
      `<daw-track>${clip('/mono.wav')}</daw-track><daw-track>${clip('/stereo.wav')}</daw-track>`
    );
    expect(trackEl(editor, 0).panLaw).toBe('mono');
    expect(trackEl(editor, 1).panLaw).toBe('stereo');
    expect(trackEl(editor, 0).hasAttribute('pan-law')).toBe(false);
    expect(trackEl(editor, 1).hasAttribute('pan-law')).toBe(false);
  });

  it("a track without audio reads 'auto', also when the attribute says auto", async () => {
    const editor = await setup('<daw-track></daw-track><daw-track pan-law="auto"></daw-track>');
    expect(trackEl(editor, 0).panLaw).toBe('auto');
    expect(trackEl(editor, 1).panLaw).toBe('auto');
    expect(law(editor, 1)).toBe('auto');
  });

  it('a value that is not a law is not declared, with one warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const editor = await setup(`<daw-track pan-law="bogus">${clip('/stereo.wav')}</daw-track>`);
    expect(trackEl(editor).panLaw).toBe('stereo');
    const about = warn.mock.calls.filter(([message]) => String(message).includes('pan-law'));
    expect(about).toHaveLength(1);
    expect(String(about[0][0])).toContain('"bogus"');
  });

  it('setting the property on an entered track is a request: one undo step, no attribute', async () => {
    const editor = await setup(`<daw-track>${clip('/mono.wav')}</daw-track>`);
    editor._arrangement.clearHistory();
    const el = trackEl(editor);

    el.panLaw = 'stereo';
    await tick();

    expect(law(editor)).toBe('stereo');
    expect(el.panLaw).toBe('stereo');
    expect(el.hasAttribute('pan-law')).toBe(false);
    expect(editor._arrangement.canUndo).toBe(true);

    editor._arrangement.undo();
    expect(el.panLaw).toBe('mono');
    expect(editor._arrangement.canUndo).toBe(false);
  });

  it('changing the attribute of an entered track is a request too', async () => {
    const editor = await setup(`<daw-track>${clip('/mono.wav')}</daw-track>`);
    trackEl(editor).setAttribute('pan-law', 'stereo');
    await tick();
    expect(law(editor)).toBe('stereo');
  });

  it("'auto' or a value that is not a law, set on a decided track, changes nothing and does not throw", async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const editor = await setup(`<daw-track>${clip('/mono.wav')}</daw-track>`);
    editor._arrangement.clearHistory();
    const el = trackEl(editor);

    expect(() => {
      el.panLaw = 'auto';
      (el as unknown as { panLaw: string }).panLaw = 'bogus';
    }).not.toThrow();
    await tick();

    expect(law(editor)).toBe('mono');
    expect(el.panLaw).toBe('mono');
    expect(editor._arrangement.canUndo).toBe(false);
    expect(warn.mock.calls.some(([message]) => String(message).includes('"bogus"'))).toBe(true);
  });

  it('a pan and a law set together on an entered track are one undo step', async () => {
    const editor = await setup(`<daw-track>${clip('/mono.wav')}</daw-track>`);
    editor._arrangement.clearHistory();
    const el = trackEl(editor);

    el.pan = -0.5;
    el.panLaw = 'stereo';
    await tick();
    editor._arrangement.undo();

    expect(el.pan).toBe(0);
    expect(el.panLaw).toBe('mono');
    expect(editor._arrangement.canUndo).toBe(false);
  });
});

describe('editor.addTrack and editor.updateTrack', () => {
  it('addTrack takes the law the track enters with', async () => {
    const editor = await setup('');
    const id = await editor.addTrack({ name: 'T', panLaw: 'stereo' });
    expect(editor._arrangement.getMixer().get(id)?.panLaw).toBe('stereo');
    expect(editor.tracks[0].panLaw).toBe('stereo');
  });

  it('updateTrack sets the law of an entered track, and ignores auto', async () => {
    const editor = await setup(`<daw-track>${clip('/mono.wav')}</daw-track>`);
    const id = editor._arrangement.getTracks()[0].id;

    editor.updateTrack(id, { panLaw: 'stereo' });
    expect(law(editor)).toBe('stereo');

    expect(() => editor.updateTrack(id, { panLaw: 'auto' })).not.toThrow();
    expect(law(editor)).toBe('stereo');
  });
});

describe('editor.updateTrack on a track that has not entered', () => {
  /** An editor with no adapter: its tracks wait to enter. */
  async function pendingEditor(html: string): Promise<Editor> {
    const mounted = await mountEditor({
      adapter: null,
      before: (e) => stubPeakPipeline(e),
      html,
    });
    editors.push(mounted);
    return mounted as Editor;
  }

  it('a declared track: the law becomes part of its declaration', async () => {
    const editor = await pendingEditor('<daw-track name="A"></daw-track>');
    const el = trackEl(editor);
    expect(editor._arrangement.getTracks()).toHaveLength(0);

    editor.updateTrack(el.trackId, { panLaw: 'stereo' });

    expect(el.panLaw).toBe('stereo');
    expect(editor.tracks[0].panLaw).toBe('stereo');
  });

  it('a track added with addTrack: the law it will enter with', async () => {
    const editor = await pendingEditor('');
    void editor.addTrack({ name: 'T' }).catch(() => {});
    await tick();
    const [listed] = editor.tracks;
    expect(listed.panLaw).toBe('auto');
    expect(editor._arrangement.getTracks()).toHaveLength(0);

    editor.updateTrack(listed.trackId, { panLaw: 'mono' });

    expect(editor.tracks[0].panLaw).toBe('mono');
  });
});

describe('the track as it is played', () => {
  it('loadedTrack carries the law, and a change of the law alone is a new view', () => {
    const track = {
      id: 't',
      kind: 'audio' as const,
      name: 't',
      clips: [],
      muted: false,
      soloed: false,
      volume: 1,
      pan: 0,
    };
    const mono = loadedTrack(track, { ...DEFAULT_TRACK_MIX, panLaw: 'mono' }, false);
    expect(mono.panLaw).toBe('mono');
    expect(loadedTrack(track, { ...DEFAULT_TRACK_MIX, panLaw: 'mono' }, false)).toBe(mono);

    const stereo = loadedTrack(track, { ...DEFAULT_TRACK_MIX, panLaw: 'stereo' }, false);
    expect(stereo).not.toBe(mono);
    expect(stereo.panLaw).toBe('stereo');
  });

  it('the default mix has the auto law', () => {
    expect(DEFAULT_TRACK_MIX.panLaw).toBe('auto');
  });
});
