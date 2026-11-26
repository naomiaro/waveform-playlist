/**
 * Findings of the first review round of #848 PR 3 (PR #919), each pinned:
 * the reviewers' probes, made into tests.
 */
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { createArrangement, type Arrangement } from '@waveform-playlist/engine';
import { createTrack } from '@waveform-playlist/core';
import {
  makeFakeAdapter,
  mountEditor,
  settle,
  stubFetch,
  stubPeakPipeline,
  tick,
} from './helpers/editor-harness';

const states = new WeakMap<HTMLElement, Set<string>>();
const proto = HTMLElement.prototype as unknown as { attachInternals?: () => unknown };
const original = proto.attachInternals;
beforeAll(async () => {
  proto.attachInternals = function (this: HTMLElement) {
    const set = new Set<string>();
    states.set(this, set);
    return { states: set };
  };
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
  await import('../elements/daw-track-controls');
  await import('../elements/daw-player');
  await import('../elements/daw-annotation-list');
});
afterAll(() => {
  proto.attachInternals = original;
});

const editors: HTMLElement[] = [];
afterEach(() => {
  for (const e of editors.splice(0)) e.remove();
  vi.restoreAllMocks();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Editor = any;

async function setup(html = '', fake = makeFakeAdapter()): Promise<Editor> {
  stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok', '/c.wav': 'ok' });
  const ed = await mountEditor({ adapter: fake.adapter, before: (e) => stubPeakPipeline(e), html });
  editors.push(ed);
  await settle(ed);
  return ed;
}

function other(): Arrangement {
  return createArrangement({
    tracks: [{ ...createTrack({ name: 'Other', kind: 'midi', clips: [] }), id: 'other-1' }],
  });
}
const clipsOf = (a: Arrangement, i = 0) => a.getTracks()[i].clips.map((c) => c.id);

function outcomeOf(p: Promise<unknown>): { value: string } {
  const o = { value: 'pending' };
  p.then(
    () => (o.value = 'resolved'),
    (e: Error) => (o.value = 'rejected: ' + e.message)
  );
  return o;
}

describe('review round 1 of #848 PR 3', () => {
  it('addClip on a track of a handed-in arrangement loads the clip', async () => {
    const ed = await setup('<daw-track name="P"></daw-track>');
    const h = createArrangement({
      tracks: [{ ...createTrack({ name: 'H', clips: [] }), id: 'h1' }],
    });
    ed.arrangement = h;
    await tick(2);
    const o = outcomeOf(ed.addClip('h1', { src: '/b.wav' }));
    await settle(ed);
    await tick(2);
    expect(o.value).toBe('resolved');
    expect(h.getTracks()[0].clips).toHaveLength(1);
  });

  it('addClip on an element-less track an Undo brought back loads the clip', async () => {
    const ed = await setup();
    const id = await ed.addTrack({ name: 'T', clips: [{ src: '/a.wav' }] });
    await settle(ed);
    ed.removeTrack(id);
    ed.undo();
    const o = outcomeOf(ed.addClip(id, { src: '/b.wav', start: 4 }));
    await settle(ed);
    await tick(2);
    expect(o.value).toBe('resolved');
    expect(ed.arrangement.getTracks()[0].clips).toHaveLength(2);
  });

  it('a <daw-clip> appended to a page track while handed in enters the own arrangement', async () => {
    const ed = await setup('<daw-track name="P"><daw-clip src="/a.wav"></daw-clip></daw-track>');
    const own: Arrangement = ed.arrangement;
    ed.arrangement = other();
    const clip = document.createElement('daw-clip') as HTMLElement & { clipId: string };
    clip.setAttribute('src', '/b.wav');
    ed.querySelector('daw-track').appendChild(clip);
    await tick(3);
    expect(clipsOf(own)).toContain(clip.clipId);
    ed.arrangement = null;
    await settle(ed);
    expect(clipsOf(own)).toContain(clip.clipId);
  });

  it('a <daw-clip> removed while handed in leaves the own arrangement', async () => {
    const ed = await setup(
      '<daw-track name="P"><daw-clip src="/a.wav"></daw-clip><daw-clip src="/b.wav" start="3"></daw-clip></daw-track>'
    );
    const own: Arrangement = ed.arrangement;
    const second = ed.querySelectorAll('daw-clip')[1] as HTMLElement & { clipId: string };
    ed.arrangement = other();
    second.remove();
    await tick(3);
    expect(clipsOf(own)).not.toContain(second.clipId);
  });

  it('a disconnected editor no longer follows the arrangement it was handed; a reconnect follows again', async () => {
    const ed = await setup('<daw-track name="P"></daw-track>');
    const handed = other();
    ed.arrangement = handed;
    ed.remove();
    const spy = vi.spyOn(ed, '_refreshLinkStates');
    handed.addTrack({ ...createTrack({ name: 'X', kind: 'midi', clips: [] }), id: 'x' });
    expect(spy).not.toHaveBeenCalled();
    document.body.appendChild(ed);
    handed.addTrack({ ...createTrack({ name: 'Y', kind: 'midi', clips: [] }), id: 'y' });
    expect(spy).toHaveBeenCalled();
  });

  it("addClip's removal watch is not ended by a change to another track; a swap ends it with an AbortError", async () => {
    // Since the maintainer's D2 (#848) a swap ends the call; before it, a
    // change elsewhere in the arrangement must not reject it (round-1 M2).
    const fake = makeFakeAdapter();
    const ed = await setup(
      '<daw-track name="P"><daw-clip src="/a.wav"></daw-clip></daw-track><daw-track name="Q"></daw-track>',
      fake
    );
    const own: Arrangement = ed.arrangement;
    const p = own.getTracks()[0].id;
    fake.holdDecode('/b.wav');
    const o = outcomeOf(ed.addClip(p, { src: '/b.wav', start: 5 }));
    await tick(2);
    ed.querySelectorAll('daw-track')[1].remove(); // a change to the own arrangement
    await tick(3);
    expect(o.value).toBe('pending');
    ed.arrangement = other();
    await tick(2);
    expect(o.value).toMatch(/^rejected: .*swapped out/);
    expect(own.getTracks()[0].clips.map((c) => c.id)).toHaveLength(2); // the clip stays
  });

  it('a slider held across a swap does not write into the other arrangement (rows are keyed by track)', async () => {
    const ed = await setup('<daw-track name="P" kind="midi"></daw-track>');
    await ed.updateComplete;
    const controls = ed.shadowRoot.querySelector('daw-track-controls');
    await controls.updateComplete;
    const range = controls.shadowRoot.querySelectorAll('input[type=range]')[0] as HTMLInputElement;
    range.value = '0.5';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    const handed = other();
    ed.arrangement = handed;
    await ed.updateComplete;
    await tick(2);
    expect(ed.shadowRoot.querySelector('daw-track-controls')).not.toBe(controls);
    range.value = '0.2';
    range.dispatchEvent(new Event('input', { bubbles: true }));
    expect(handed.getMixer().get('other-1')?.volume).toBe(1);
  });

  it('editor.tracks lists only the arrangement played while one is handed in', async () => {
    const ed = await setup('<daw-track name="P" kind="midi"></daw-track>');
    ed.arrangement = other();
    const late = document.createElement('daw-track');
    late.setAttribute('name', 'Late');
    late.setAttribute('kind', 'midi');
    ed.appendChild(late);
    await tick(3);
    expect(ed.tracks.map((t: { name: string }) => t.name)).toEqual(['Other']);
  });

  it("updateTrack's render mode is not undone by the element's next unrelated update", async () => {
    const ed = await setup('<daw-track name="P"><daw-clip src="/a.wav"></daw-clip></daw-track>');
    const el = ed.querySelector('daw-track');
    ed.updateTrack(el.trackId, { renderMode: 'spectrogram' });
    expect(ed.tracks[0].renderMode).toBe('spectrogram');
    el.volume = 0.5;
    await el.updateComplete;
    await tick();
    expect(ed.tracks[0].renderMode).toBe('spectrogram');
  });

  it('updateTrack on a track waiting to enter keeps its spectrogramConfig', async () => {
    const ed = await setup();
    ed.adapter = null;
    const fresh = await mountEditor({ adapter: null, before: (e) => stubPeakPipeline(e) });
    editors.push(fresh);
    const pending = (fresh as Editor).addTrack({ name: 'T' });
    const [waiting] = (fresh as Editor).tracks;
    const config = { fftSize: 1024 };
    (fresh as Editor).updateTrack(waiting.trackId, { spectrogramConfig: config });
    expect((fresh as Editor).tracks[0].spectrogramConfig).toBe(config);
    (fresh as Editor).adapter = makeFakeAdapter().adapter;
    await pending;
    expect((fresh as Editor).tracks[0].spectrogramConfig).toBe(config);
  });

  it('trackEl.kind reads the kind the track entered with; a refused change keeps the attribute and warns', async () => {
    const ed = await setup('<daw-track name="K" kind="midi"></daw-track>');
    const el = ed.querySelector('daw-track');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    el.setAttribute('kind', 'audio');
    await el.updateComplete;
    await tick();
    expect(el.kind).toBe('midi');
    expect(el.getAttribute('kind')).toBe('audio');
    expect(warn.mock.calls.some(([m]) => String(m).includes('kind cannot change'))).toBe(true);
    el.kind = 'audio';
    expect(el.kind).toBe('midi');
  });

  it('a <daw-track> or <daw-clip> moved with moveBefore keeps its registration (connectedMoveCallback)', async () => {
    const ed = await setup(
      '<daw-track name="A" kind="midi"></daw-track><daw-track name="B" kind="midi"></daw-track>'
    );
    const [, b] = ed.querySelectorAll('daw-track');
    const clip = document.createElement('daw-clip');
    expect(typeof (b as { connectedMoveCallback?: unknown }).connectedMoveCallback).toBe(
      'function'
    );
    expect(typeof (clip as { connectedMoveCallback?: unknown }).connectedMoveCallback).toBe(
      'function'
    );
    // It announces the element again (a real moveBefore() into another place
    // must reach the editor), and the editor keeps the registration: nothing
    // enters twice (daw-editor-clip-rehome.test.ts has the clip's case).
    const events: string[] = [];
    ed.addEventListener('daw-track-connected', (e: Event) => events.push(e.type));
    const count = ed.arrangement.getTracks().length;
    (b as { connectedMoveCallback(): void }).connectedMoveCallback();
    await tick(2);
    expect(events).toEqual(['daw-track-connected']);
    expect(ed.arrangement.getTracks()).toHaveLength(count);
  });

  it(':host([hidden]) hides the elements whose host sets display', () => {
    for (const tag of ['daw-editor', 'daw-track-controls', 'daw-player', 'daw-annotation-list']) {
      const ctor = customElements.get(tag) as unknown as { styles: unknown };
      const css = [ctor.styles]
        .flat(Infinity as 1)
        .map((s) => String((s as { cssText?: string })?.cssText ?? ''))
        .join('\n');
      expect(css, tag).toMatch(/:host\(\[hidden\]\)\s*\{\s*display:\s*none/);
    }
  });

  it('the engine built for a swapped-in arrangement gets the selection', async () => {
    const ed = await setup('<daw-track name="P" kind="midi"></daw-track>');
    ed.setSelection(1, 2);
    ed.arrangement = other();
    expect(ed.engine.getState()).toMatchObject({ selectionStart: 1, selectionEnd: 2 });
  });

  it('a loadFiles() in progress settles when the arrangement is swapped', async () => {
    const fake = makeFakeAdapter();
    const ed = await setup('', fake);
    fake.holdDecode('');
    const file = new File([new Uint8Array(8)], 'take.wav', { type: 'audio/wav' });
    (file as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () =>
      new ArrayBuffer(8);
    const o = outcomeOf(ed.loadFiles([file]));
    await tick(3);
    expect(o.value).toBe('pending');
    ed.arrangement = other();
    await tick(3);
    expect(o.value).toBe('resolved');
  });

  it('addClip on a page track waiting for the own arrangement watches the own arrangement', async () => {
    const fake = makeFakeAdapter();
    const ed = await setup('<daw-track name="P" kind="midi"></daw-track>', fake);
    ed.arrangement = other();
    const late = document.createElement('daw-track') as HTMLElement & { trackId: string };
    late.setAttribute('name', 'Late');
    ed.appendChild(late);
    await tick(3);
    fake.holdDecode('/b.wav');
    const o = outcomeOf(ed.addClip(late.trackId, { src: '/b.wav' }));
    ed.arrangement = null; // the page track enters the own arrangement with the clip
    await tick(3);
    const own: Arrangement = ed.arrangement;
    expect(own.getTracks().find((t) => t.id === late.trackId)?.clips).toHaveLength(1);
    own.updateTrack(late.trackId, (t) => ({ ...t, clips: [] })); // the app takes it away
    await tick(2);
    expect(o.value).toMatch(/rejected: .*removed before its audio loaded/);
  });
});
