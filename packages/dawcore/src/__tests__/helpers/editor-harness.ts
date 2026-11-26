/**
 * One harness for `<daw-editor>` tests that load audio (#848): a complete
 * fake `PlayoutAdapter` whose context decodes tagged bytes into buffers the
 * test chooses, a stubbed `fetch`, and helpers to mount an editor and wait
 * for its arrangement to finish loading.
 *
 * The editor's arrangement loads with its default loader (fetch, then
 * `audioContext.decodeAudioData`), so a test drives loading through these
 * two stubs instead of replacing editor internals.
 */
import { vi } from 'vitest';
import type { Mock } from 'vitest';
import type { DawEditorElement } from '../../elements/daw-editor';

/** The minimal AudioBuffer the editor and the arrangement read. */
export function makeAudioBuffer(seconds = 2, sampleRate = 48000, channels = 1): AudioBuffer {
  const length = Math.round(seconds * sampleRate);
  const data = Array.from({ length: channels }, () => new Float32Array(length));
  return {
    length,
    duration: length / sampleRate,
    sampleRate,
    numberOfChannels: channels,
    getChannelData: (channel: number) => data[channel],
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer;
}

/** Bytes handed out by the stubs, by the tag the fake decoder reads. */
const tags = new WeakMap<ArrayBuffer, string>();

function taggedBytes(tag: string): ArrayBuffer {
  const bytes = new ArrayBuffer(8);
  tags.set(bytes, tag);
  return bytes;
}

interface Held {
  promise: Promise<void>;
  resolve: () => void;
  reject: (error: Error) => void;
}

export interface FakeAdapter {
  adapter: {
    audioContext: AudioContext;
    ppqn: number;
    [method: string]: unknown;
  } & Record<string, Mock | unknown>;
  /** The buffer (or the error) the bytes of `tag` decode to. */
  setDecoded(tag: string, result: AudioBuffer | Error): void;
  /** Hold every later decode of `tag` until the test settles it. */
  holdDecode(tag: string): { resolve: () => void; reject: (error: Error) => void };
  /** How many times the bytes of `tag` were decoded. */
  decodeCount(tag: string): number;
}

export function makeFakeAdapter(options: { sampleRate?: number } = {}): FakeAdapter {
  const sampleRate = options.sampleRate ?? 48000;
  const results = new Map<string, AudioBuffer | Error>();
  const held = new Map<string, Held>();
  const counts = new Map<string, number>();
  const decodeAudioData = vi.fn(async (bytes: ArrayBuffer): Promise<AudioBuffer> => {
    const tag = tags.get(bytes) ?? '';
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
    const wait = held.get(tag);
    if (wait) await wait.promise;
    const result = results.get(tag) ?? makeAudioBuffer(2, sampleRate);
    if (result instanceof Error) throw result;
    return result;
  });
  let position = 0;
  const adapter = {
    audioContext: {
      sampleRate,
      state: 'running',
      outputLatency: 0,
      currentTime: 0,
      decodeAudioData,
      resume: vi.fn().mockResolvedValue(undefined),
    } as unknown as AudioContext,
    ppqn: 960,
    init: vi.fn().mockResolvedValue(undefined),
    setTracks: vi.fn(),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    updateTrack: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn((t: number) => {
      position = t;
    }),
    getCurrentTime: vi.fn(() => position),
    isPlaying: vi.fn().mockReturnValue(false),
    setMasterVolume: vi.fn(),
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    setTrackPan: vi.fn(),
    setTempo: vi.fn(),
    setLoop: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    adapter,
    setDecoded: (tag, result) => results.set(tag, result),
    holdDecode: (tag) => {
      let resolve!: () => void;
      let reject!: (error: Error) => void;
      const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      // A rejection the decoder never reads (the load was aborted) is not unhandled.
      promise.catch(() => {});
      held.set(tag, { promise, resolve, reject });
      return {
        resolve: () => {
          held.delete(tag);
          resolve();
        },
        reject: (error) => {
          held.delete(tag);
          reject(error);
        },
      };
    },
    decodeCount: (tag) => counts.get(tag) ?? 0,
  };
}

/** What a stubbed URL answers: bytes tagged with the URL, an HTTP status, or a rejection. */
export type FetchAnswer = 'ok' | number | Error;

let fetchAnswers: Map<string, FetchAnswer> | null = null;

/**
 * Stub `fetch` for these URLs (and any added later with another call). An
 * unknown URL rejects, so a test notices a fetch it did not expect.
 */
export function stubFetch(answers: Record<string, FetchAnswer>): Mock {
  fetchAnswers = new Map([...(fetchAnswers ?? []), ...Object.entries(answers)]);
  const map = fetchAnswers;
  const fetchStub = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const answer = map.get(url);
    if (answer === undefined) throw new Error('fetch not stubbed for ' + url);
    if (answer instanceof Error) throw answer;
    const ok = answer === 'ok';
    return {
      ok,
      status: ok ? 200 : answer,
      statusText: ok ? 'OK' : 'Error',
      arrayBuffer: async () => taggedBytes(url),
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchStub);
  return fetchStub;
}

export function restoreFetch(): void {
  fetchAnswers = null;
  vi.unstubAllGlobals();
}

/** A `File` whose bytes decode under `tag` (its name by default). */
export function makeAudioFile(name: string, tag: string = name, type = 'audio/wav'): File {
  const file = new File([new Uint8Array(8)], name, { type });
  Object.defineProperty(file, 'arrayBuffer', { value: async () => taggedBytes(tag) });
  return file;
}

/** Let timers of 0 ms (the deferred connects, the entry flush) and microtasks run. */
export async function tick(times = 1): Promise<void> {
  for (let i = 0; i < times; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

interface EditorInternals {
  _arrangement: {
    sources: { getSnapshot(): { isLoading: boolean } };
  };
}

/**
 * Append a `<daw-editor>` holding `html`, with `adapter` set before it
 * connects (a fresh fake by default; `null` for none), and wait for the
 * deferred connects and the entry flush.
 */
export async function mountEditor(
  options: {
    adapter?: FakeAdapter['adapter'] | null;
    html?: string;
    parent?: HTMLElement;
    /** Called with the editor before it connects (stub internals here). */
    before?: (editor: DawEditorElement) => void;
  } = {}
): Promise<DawEditorElement> {
  const editor = document.createElement('daw-editor') as DawEditorElement;
  options.before?.(editor);
  const adapter = options.adapter === undefined ? makeFakeAdapter().adapter : options.adapter;
  if (adapter) (editor as unknown as { adapter: unknown }).adapter = adapter;
  if (options.html) editor.innerHTML = options.html;
  (options.parent ?? document.body).appendChild(editor);
  await tick(2);
  return editor;
}

/** Wait until no source of the editor's arrangement is pending, then one more tick. */
export async function settle(editor: DawEditorElement, maxTicks = 50): Promise<void> {
  const internals = editor as unknown as EditorInternals;
  for (let i = 0; i < maxTicks; i++) {
    await tick();
    if (!internals._arrangement.sources.getSnapshot().isLoading) {
      await tick();
      return;
    }
  }
  throw new Error('settle: sources still loading after ' + maxTicks + ' ticks');
}

/** Peak data with no samples: enough for the editor to draw a clip. */
export function makePeakData() {
  return { data: [new Int16Array(0)], length: 0, bits: 16 as const };
}

/**
 * Replace the editor's peak pipeline (its Web Worker does not run under
 * happy-dom) with stubs that resolve empty peaks at once.
 */
export function stubPeakPipeline(editor: DawEditorElement): Record<string, Mock> {
  const pipeline = {
    generatePeaks: vi.fn().mockResolvedValue(makePeakData()),
    cacheWaveformData: vi.fn(),
    getMaxCachedScale: vi.fn().mockReturnValue(0),
    getCachedScale: vi.fn().mockReturnValue(0),
    reextractPeaks: vi.fn().mockReturnValue(new Map()),
    getBaseScalePeaks: vi.fn().mockReturnValue(null),
    terminate: vi.fn(),
  };
  (editor as unknown as { _peakPipeline: unknown })._peakPipeline = pipeline;
  return pipeline;
}

/** A clip of `appendTrackElement`'s config (the shape `editor.addTrack` takes). */
interface ElementClipConfig {
  src?: string;
  peaksSrc?: string;
  start?: number;
  duration?: number;
  offset?: number;
  gain?: number;
  name?: string;
  fadeIn?: number;
  fadeOut?: number;
  fadeType?: string;
  midiNotes?: unknown[];
  midiChannel?: number;
  midiProgram?: number;
}

/**
 * Append a `<daw-track>` (with `<daw-clip>` children) built from a track
 * config and wait for it to enter the arrangement: the page markup that
 * `editor.addTrack()` made until #848 PR 3 (it makes no element since).
 * Resolves with the element. A page track that enters into an empty history
 * is not an undo step (the page-load rule).
 */
export async function appendTrackElement(
  editor: HTMLElement,
  config: {
    name?: string;
    volume?: number;
    pan?: number;
    muted?: boolean;
    soloed?: boolean;
    kind?: 'audio' | 'midi';
    renderMode?: string;
    clips?: ElementClipConfig[];
    midi?: { notes: unknown[]; channel?: number; program?: number };
  } = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trackEl = document.createElement('daw-track') as any;
  if (config.name !== undefined) trackEl.setAttribute('name', config.name);
  if (config.volume !== undefined) trackEl.setAttribute('volume', String(config.volume));
  if (config.pan !== undefined) trackEl.setAttribute('pan', String(config.pan));
  if (config.muted) trackEl.setAttribute('muted', '');
  if (config.soloed) trackEl.setAttribute('soloed', '');
  const kind = config.kind ?? (config.midi ? 'midi' : undefined);
  if (kind) trackEl.setAttribute('kind', kind);
  if (config.renderMode) trackEl.setAttribute('render-mode', config.renderMode);
  const clips = [...(config.clips ?? [])];
  if (config.midi) {
    clips.push({
      midiNotes: config.midi.notes,
      midiChannel: config.midi.channel,
      midiProgram: config.midi.program,
    });
  }
  for (const c of clips) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clipEl = document.createElement('daw-clip') as any;
    const attrs: [string, unknown][] = [
      ['src', c.src],
      ['peaks-src', c.peaksSrc],
      ['start', c.start],
      ['duration', c.duration],
      ['offset', c.offset],
      ['gain', c.gain],
      ['name', c.name],
      ['fade-in', c.fadeIn],
      ['fade-out', c.fadeOut],
      ['fade-type', c.fadeType],
      ['midi-channel', c.midiChannel],
      ['midi-program', c.midiProgram],
    ];
    for (const [name, value] of attrs) {
      if (value !== undefined) clipEl.setAttribute(name, String(value));
    }
    if (c.midiNotes !== undefined) clipEl.midiNotes = c.midiNotes;
    trackEl.appendChild(clipEl);
  }
  editor.appendChild(trackEl);
  const internals = editor as unknown as {
    _arrangement: { getTracks(): readonly { id: string }[] };
  };
  for (let i = 0; i < 50; i++) {
    if (internals._arrangement.getTracks().some((t) => t.id === trackEl.trackId)) return trackEl;
    await tick();
  }
  throw new Error('appendTrackElement: the track did not enter (no adapter?)');
}
