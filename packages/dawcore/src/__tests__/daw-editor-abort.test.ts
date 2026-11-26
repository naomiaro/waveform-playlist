/**
 * Cancellation in `<daw-editor>` (#848, the maintainer's design D1-D5): an
 * AbortError DOMException for every abort; a swap aborts the waits of the
 * arrangement swapped out; `signal` options on addClip, addTrack, loadFiles.
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

const proto = HTMLElement.prototype as unknown as { attachInternals?: () => unknown };
const original = proto.attachInternals;
beforeAll(async () => {
  proto.attachInternals = function () {
    return { states: new Set<string>() };
  };
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});
afterAll(() => {
  proto.attachInternals = original;
});

const editors: HTMLElement[] = [];
afterEach(() => {
  for (const e of editors.splice(0)) e.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Editor = any;

function outcomeOf(p: Promise<unknown>): { value: string; error?: unknown } {
  const o: { value: string; error?: unknown } = { value: 'pending' };
  p.then(
    () => (o.value = 'resolved'),
    (e: unknown) => {
      o.value = 'rejected';
      o.error = e;
    }
  );
  return o;
}
const isAbortError = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

async function setup(html = '<daw-track name="P"></daw-track>', fake = makeFakeAdapter()) {
  stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok', '/c.wav': 'ok' });
  const ed: Editor = await mountEditor({
    adapter: fake.adapter,
    before: (e) => stubPeakPipeline(e),
    html,
  });
  editors.push(ed);
  await settle(ed);
  return { ed, fake };
}
const handed = (): Arrangement =>
  createArrangement({ tracks: [{ ...createTrack({ name: 'H', clips: [] }), id: 'h1' }] });
const clipIdsOf = (a: Arrangement, trackId: string) =>
  a
    .getTracks()
    .find((t) => t.id === trackId)
    ?.clips.map((c) => c.id) ?? [];

describe('a swap (D2)', () => {
  it('rejects a pending addClip() on the arrangement swapped out; its loading clip stays there', async () => {
    const { ed, fake } = await setup();
    const h = handed();
    ed.arrangement = h;
    await tick(2);
    fake.holdDecode('/b.wav');
    const o = outcomeOf(ed.addClip('h1', { src: '/b.wav' }));
    await tick(2);
    ed.arrangement = null;
    await tick(2);
    expect(o.value).toBe('rejected');
    expect(isAbortError(o.error)).toBe(true);
    expect(String((o.error as Error).message)).toMatch(/swapped out/);
    expect(h.getTracks()[0].clips).toHaveLength(1);
  });

  it('does not reject an addClip() into a page track waiting while handed in, when the page arrangement comes back', async () => {
    const { ed } = await setup();
    ed.arrangement = handed();
    const late = document.createElement('daw-track') as HTMLElement & { trackId: string };
    late.setAttribute('name', 'Late');
    ed.appendChild(late);
    await tick(3);
    const o = outcomeOf(ed.addClip(late.trackId, { src: '/b.wav' }));
    ed.arrangement = null;
    await settle(ed);
    await tick(3);
    expect(o.value).toBe('resolved');
  });

  it('aborts a peaks fetch for the arrangement swapped out, quietly', async () => {
    const { ed } = await setup();
    const signals = new Map<string, AbortSignal | undefined>();
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        signals.set(String(url), init?.signal ?? undefined);
        return new Promise((_, reject) =>
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))
        );
      })
    );
    const h = handed();
    ed.arrangement = h;
    await tick(2);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    void ed.addClip('h1', { src: '/x.wav', peaksSrc: '/x.dat' }).catch(() => {});
    await tick(3);
    expect(signals.get('/x.dat')?.aborted).toBe(false);
    ed.arrangement = null;
    await tick(3);
    expect(signals.get('/x.dat')?.aborted).toBe(true);
    expect(warn.mock.calls.some(([m]) => /peaks/i.test(String(m)))).toBe(false);
  });
});

describe('a swap back (D2)', () => {
  it('an arrangement swapped out and back gets a new signal: the next swap away ends a later addClip()', async () => {
    const { ed, fake } = await setup();
    const own = ed.arrangement;
    const trackId = own.getTracks()[0].id;
    fake.holdDecode('/b.wav');
    fake.holdDecode('/c.wav');
    const first = outcomeOf(ed.addClip(trackId, { src: '/b.wav' }));
    await tick(2);
    ed.arrangement = handed(); // ends the first call
    await tick(2);
    expect(first.value).toBe('rejected');
    ed.arrangement = null;
    await tick(4); // the first clip's decode is held: nothing to settle
    const o = outcomeOf(ed.addClip(trackId, { src: '/c.wav' }));
    await tick(3);
    expect(o.value).toBe('pending');
    ed.arrangement = handed();
    await tick(2);
    expect(o.value).toBe('rejected');
    expect(isAbortError(o.error)).toBe(true);
  });
});

describe('addClip(trackId, config, { signal }) (D3)', () => {
  it('an already aborted signal rejects with its reason and adds nothing', async () => {
    const { ed } = await setup();
    const trackId = ed.arrangement.getTracks()[0].id;
    const c = new AbortController();
    const reason = new DOMException('stop', 'AbortError');
    c.abort(reason);
    const canUndo = ed.canUndo;
    await expect(ed.addClip(trackId, { src: '/b.wav' }, { signal: c.signal })).rejects.toBe(reason);
    expect(clipIdsOf(ed.arrangement, trackId)).toEqual([]);
    expect(ed.canUndo).toBe(canUndo);
  });

  it('an abort before the clip loads rejects with the reason and removes the clip for good', async () => {
    const { ed, fake } = await setup();
    const trackId = ed.arrangement.getTracks()[0].id;
    ed.arrangement.setTrackVolume(trackId, 0.5); // a step before
    fake.holdDecode('/b.wav');
    const c = new AbortController();
    const o = outcomeOf(ed.addClip(trackId, { src: '/b.wav' }, { signal: c.signal }));
    await tick(3);
    expect(clipIdsOf(ed.arrangement, trackId)).toHaveLength(1);
    c.abort();
    await tick(2);
    expect(o.value).toBe('rejected');
    expect(isAbortError(o.error)).toBe(true);
    expect(clipIdsOf(ed.arrangement, trackId)).toEqual([]);
    ed.undo(); // the volume, not the clip: the aborted add left no step
    expect(clipIdsOf(ed.arrangement, trackId)).toEqual([]);
    expect(ed.arrangement.getMixer().get(trackId)?.volume).toBe(1);
  });

  it('an abort after the clip loaded changes nothing', async () => {
    const { ed } = await setup();
    const trackId = ed.arrangement.getTracks()[0].id;
    const c = new AbortController();
    const id = await ed.addClip(trackId, { src: '/b.wav' }, { signal: c.signal });
    c.abort();
    await tick(2);
    expect(clipIdsOf(ed.arrangement, trackId)).toEqual([id]);
  });

  it('an abort on a track waiting to enter takes the clip out of what it enters with', async () => {
    stubFetch({ '/b.wav': 'ok' });
    const ed: Editor = await mountEditor({ before: (e) => stubPeakPipeline(e) }); // no adapter
    editors.push(ed);
    const trackPromise = ed.addTrack({ name: 'W' });
    const [waiting] = ed.tracks;
    const c = new AbortController();
    const o = outcomeOf(ed.addClip(waiting.trackId, { src: '/b.wav' }, { signal: c.signal }));
    c.abort();
    await tick(2);
    expect(o.value).toBe('rejected');
    ed.adapter = makeFakeAdapter().adapter;
    const trackId = await trackPromise;
    expect(clipIdsOf(ed.arrangement, trackId)).toEqual([]);
  });
});

describe('addTrack(config, { signal }) (D4)', () => {
  it('an already aborted signal rejects and queues nothing', async () => {
    const { ed } = await setup();
    const c = new AbortController();
    c.abort();
    const count = ed.arrangement.getTracks().length;
    await expect(ed.addTrack({ name: 'X' }, { signal: c.signal })).rejects.toSatisfy(isAbortError);
    await tick(2);
    expect(ed.arrangement.getTracks()).toHaveLength(count);
    expect(ed.tracks).toHaveLength(count);
  });

  it('an abort before the track enters takes it out of the queue: it never enters', async () => {
    stubFetch({});
    const ed: Editor = await mountEditor({ before: (e) => stubPeakPipeline(e) }); // no adapter
    editors.push(ed);
    const c = new AbortController();
    const o = outcomeOf(ed.addTrack({ name: 'W' }, { signal: c.signal }));
    expect(ed.tracks).toHaveLength(1);
    c.abort();
    await tick(2);
    expect(o.value).toBe('rejected');
    expect(isAbortError(o.error)).toBe(true);
    expect(ed.tracks).toHaveLength(0);
    ed.adapter = makeFakeAdapter().adapter;
    await settle(ed);
    expect(ed.arrangement.getTracks()).toHaveLength(0);
  });

  it('an abort after it entered changes nothing', async () => {
    const { ed } = await setup('');
    const c = new AbortController();
    const id = await ed.addTrack({ name: 'X' }, { signal: c.signal });
    c.abort();
    await tick(2);
    expect(ed.arrangement.getTracks().map((t: { id: string }) => t.id)).toContain(id);
  });
});

describe('loadFiles(files, { signal }) (D5)', () => {
  const file = (name: string) => {
    const f = new File([new Uint8Array(8)], name, { type: 'audio/wav' });
    (f as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () =>
      new ArrayBuffer(8);
    return f;
  };

  it('an abort rejects, skips the files not started and removes the tracks it added for good', async () => {
    const { ed, fake } = await setup('');
    fake.holdDecode('');
    ed.arrangement.addTrack({ ...createTrack({ name: 'Before', clips: [] }), id: 'before' });
    const canUndo = ed.canUndo;
    const c = new AbortController();
    const o = outcomeOf(ed.loadFiles([file('one.wav'), file('two.wav')], { signal: c.signal }));
    await tick(4);
    expect(ed.arrangement.getTracks().map((t: { name: string }) => t.name)).toEqual([
      'Before',
      'one',
    ]);
    c.abort();
    await tick(4);
    expect(o.value).toBe('rejected');
    expect(isAbortError(o.error)).toBe(true);
    expect(ed.arrangement.getTracks().map((t: { name: string }) => t.name)).toEqual(['Before']);
    expect(ed.canUndo).toBe(canUndo);
  });

  it('an abort while the first track is entering takes it out once it has', async () => {
    const { ed, fake } = await setup('');
    fake.holdDecode('');
    const c = new AbortController();
    const o = outcomeOf(ed.loadFiles([file('one.wav')], { signal: c.signal }));
    c.abort(); // before the track has entered
    await settle(ed);
    await tick(4);
    expect(o.value).toBe('rejected');
    expect(ed.arrangement.getTracks()).toHaveLength(0);
  });

  it('an already aborted signal rejects and adds nothing', async () => {
    const { ed } = await setup('');
    const removed: unknown[] = [];
    ed.addEventListener('daw-track-removed', (e: Event) => removed.push(e));
    const c = new AbortController();
    c.abort();
    await expect(ed.loadFiles([file('one.wav')], { signal: c.signal })).rejects.toSatisfy(
      isAbortError
    );
    expect(ed.arrangement.getTracks()).toHaveLength(0);
    await tick(3);
    expect(removed).toEqual([]); // nothing entered, so nothing was taken out
  });
});

describe('review round 3', () => {
  const file = (name: string) => {
    const f = new File([new Uint8Array(8)], name, { type: 'audio/wav' });
    (f as unknown as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer = async () =>
      new ArrayBuffer(8);
    return f;
  };

  it('a swap ends loadFiles() as a disconnect does: the file loading stays, the rest fail and enter nowhere', async () => {
    const { ed, fake } = await setup('');
    const own = ed.arrangement;
    fake.holdDecode('');
    const o = ed.loadFiles([file('one.wav'), file('two.wav')]);
    await tick(4);
    expect(own.getTracks().map((t: { name: string }) => t.name)).toEqual(['one']);
    const h = handed();
    ed.arrangement = h;
    const result = await o;
    expect(result.loaded).toHaveLength(1);
    expect(result.failed.map((f: { file: File }) => f.file.name)).toEqual(['two.wav']);
    await tick(4);
    expect(h.getTracks().map((t) => t.name)).toEqual(['H']);
    expect(own.getTracks().map((t: { name: string }) => t.name)).toEqual(['one']);
  });

  it('a swap before the first file has entered: it fails and enters nowhere', async () => {
    const { ed } = await setup('');
    const own = ed.arrangement;
    const o = ed.loadFiles([file('one.wav')]);
    const h = handed();
    ed.arrangement = h; // before the entry flush
    const result = await o;
    expect(result.failed.map((f: { file: File }) => f.file.name)).toEqual(['one.wav']);
    await tick(4);
    expect(h.getTracks().map((t) => t.name)).toEqual(['H']);
    expect(own.getTracks()).toHaveLength(0);
  });

  it('a signal aborted with a reason that is not an Error rejects with that reason, as fetch() does', async () => {
    const { ed, fake } = await setup();
    const trackId = ed.arrangement.getTracks()[0].id;
    fake.holdDecode('/b.wav');
    const c = new AbortController();
    const p = ed.addClip(trackId, { src: '/b.wav' }, { signal: c.signal });
    c.abort('user');
    await expect(p).rejects.toBe('user');
    const pre = new AbortController();
    pre.abort('early');
    await expect(ed.addTrack({}, { signal: pre.signal })).rejects.toBe('early');
  });
});

describe('addTrack() targets the arrangement played when it is called (capture-it)', () => {
  it('a swap before the track enters rejects with an AbortError; it enters neither arrangement', async () => {
    stubFetch({});
    const ed: Editor = await mountEditor({ before: (e) => stubPeakPipeline(e) }); // no adapter: it waits
    editors.push(ed);
    const own = ed.arrangement;
    const o = outcomeOf(ed.addTrack({ name: 'Queued' }));
    const x = handed();
    ed.arrangement = x;
    await tick(2);
    expect(o.value).toBe('rejected');
    expect(isAbortError(o.error)).toBe(true);
    ed.adapter = makeFakeAdapter().adapter;
    await settle(ed);
    expect(x.getTracks().map((t) => t.name)).toEqual(['H']);
    expect(own.getTracks()).toHaveLength(0);
  });

  it('with an adapter, a swap in the same task, before the entry flush, rejects too', async () => {
    const { ed } = await setup('');
    const own = ed.arrangement;
    const x = handed();
    const o = outcomeOf(ed.addTrack({ name: 'Now' }));
    ed.arrangement = x;
    await tick(3);
    expect(o.value).toBe('rejected');
    expect(x.getTracks().map((t) => t.name)).toEqual(['H']);
    expect(own.getTracks()).toHaveLength(0);
  });

  it('a call made while a handed-in arrangement plays adds to it, and a swap back rejects one not entered', async () => {
    const { ed } = await setup('');
    const x = handed();
    ed.arrangement = x;
    await tick(2);
    const id = await ed.addTrack({ name: 'InX' });
    expect(x.getTracks().map((t) => t.id)).toContain(id);
    const o = outcomeOf(ed.addTrack({ name: 'Late' }));
    ed.arrangement = null;
    await tick(3);
    expect(o.value).toBe('rejected');
    expect(ed.arrangement.getTracks().map((t: { name: string }) => t.name)).not.toContain('Late');
  });
});

describe('review round 4', () => {
  it.each([[''], [0], [null], [false]])(
    'an abort with the falsy reason %j rejects addTrack() with it; the track never enters',
    async (reason) => {
      const { ed } = await setup('');
      const c = new AbortController();
      const o = outcomeOf(ed.addTrack({ name: 'X' }, { signal: c.signal }));
      c.abort(reason);
      await tick(3);
      expect(o.value).toBe('rejected');
      expect(o.error).toBe(reason);
      expect(ed.arrangement.getTracks()).toHaveLength(0);
    }
  );
});
