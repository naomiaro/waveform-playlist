import { describe, it, expect, vi, afterEach } from 'vitest';
import { Midi } from '@tonejs/midi';
import { createArrangement } from '@waveform-playlist/engine';
import { loadMidiTracks } from '../src/loadMidiTracks';

const SAMPLE_RATE = 48000;

/** A fresh ArrayBuffer: `.buffer` of a Uint8Array is ArrayBufferLike (TS2345). */
function twoTrackBytes(): Uint8Array<ArrayBuffer> {
  const midi = new Midi();
  midi.header.setTempo(120);
  const lead = midi.addTrack();
  lead.name = 'Lead';
  lead.channel = 0;
  lead.addNote({ midi: 72, time: 0, duration: 1 });
  lead.addNote({ midi: 74, time: 1, duration: 1.5 });
  const bass = midi.addTrack();
  bass.name = 'Bass';
  bass.channel = 1;
  bass.addNote({ midi: 36, time: 0, duration: 2 });
  const bytes = midi.toArray();
  const copy = new Uint8Array(new ArrayBuffer(bytes.length));
  copy.set(bytes);
  return copy;
}

function midiBlob(): Blob {
  return new Blob([twoTrackBytes()], { type: 'audio/midi' });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadMidiTracks', () => {
  it('a multi-track file gives one track per MIDI track with ids from this call', async () => {
    const first = await loadMidiTracks(midiBlob(), { sampleRate: SAMPLE_RATE });
    const second = await loadMidiTracks(midiBlob(), { sampleRate: SAMPLE_RATE });

    expect(first).toHaveLength(2);
    expect(first.map((t) => t.name)).toEqual(['Lead', 'Bass']);
    expect(first.every((t) => t.kind === 'midi')).toBe(true);
    const ids = [...first, ...second].flatMap((t) => [t.id, ...t.clips.map((c) => c.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('flatten gives one track', async () => {
    const tracks = await loadMidiTracks(midiBlob(), { sampleRate: SAMPLE_RATE, flatten: true });
    expect(tracks).toHaveLength(1);
    expect(tracks[0].clips[0].midiNotes).toHaveLength(3);
  });

  it('name names the track and its clip when the file gives one track', async () => {
    const midi = new Midi();
    const only = midi.addTrack();
    only.name = 'Original';
    only.addNote({ midi: 60, time: 0, duration: 1 });
    const bytes = midi.toArray();
    const copy = new Uint8Array(new ArrayBuffer(bytes.length));
    copy.set(bytes);
    const blob = new Blob([copy]);
    const [track, ...rest] = await loadMidiTracks(blob, {
      sampleRate: SAMPLE_RATE,
      name: 'Renamed',
    });
    expect(rest).toHaveLength(0);
    expect(track.name).toBe('Renamed');
    expect(track.clips[0].name).toBe('Renamed');
  });

  it('name is ignored when the file gives several tracks: each keeps its MIDI name', async () => {
    const tracks = await loadMidiTracks(midiBlob(), { sampleRate: SAMPLE_RATE, name: 'Renamed' });
    expect(tracks.map((t) => t.name)).toEqual(['Lead', 'Bass']);
    expect(tracks.map((t) => t.clips[0].name)).toEqual(['Lead', 'Bass']);
  });

  it('name with flatten names the single track and its clip', async () => {
    const [track, ...rest] = await loadMidiTracks(midiBlob(), {
      sampleRate: SAMPLE_RATE,
      flatten: true,
      name: 'Merged',
    });
    expect(rest).toHaveLength(0);
    expect(track.name).toBe('Merged');
    expect(track.clips[0].name).toBe('Merged');
  });

  it('start and duration in seconds become samples at sampleRate', async () => {
    const [track] = await loadMidiTracks(midiBlob(), {
      sampleRate: SAMPLE_RATE,
      flatten: true,
      start: 2,
      duration: 10,
    });
    expect(track.clips[0].startSample).toBe(2 * SAMPLE_RATE);
    expect(track.clips[0].durationSamples).toBe(10 * SAMPLE_RATE);
  });

  it('a Blob is read, a string is fetched', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(twoTrackBytes(), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const fromBlob = await loadMidiTracks(midiBlob(), { sampleRate: SAMPLE_RATE });
    expect(fetchMock).not.toHaveBeenCalled();

    const fromUrl = await loadMidiTracks('/song.mid', { sampleRate: SAMPLE_RATE });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/song.mid');
    expect(fromUrl.map((t) => t.name)).toEqual(fromBlob.map((t) => t.name));
  });

  it('an abort before the parse rejects with an AbortError', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      loadMidiTracks(midiBlob(), { sampleRate: SAMPLE_RATE, signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('an abort while the Blob is being read rejects and returns nothing', async () => {
    const controller = new AbortController();
    const pending = loadMidiTracks(midiBlob(), {
      sampleRate: SAMPLE_RATE,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('an aborted signal starts no fetch', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(twoTrackBytes(), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(
      loadMidiTracks('/song.mid', { sampleRate: SAMPLE_RATE, signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('the signal reaches the fetch, and an abort during it rejects with the signal reason', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        })
    );
    vi.stubGlobal('fetch', fetchMock);
    const pending = loadMidiTracks('/song.mid', {
      sampleRate: SAMPLE_RATE,
      signal: controller.signal,
    });
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
    controller.abort();
    await expect(pending).rejects.toBe(controller.signal.reason);
  });

  it('the result passes createArrangement({ tracks }) without throwing', async () => {
    const tracks = await loadMidiTracks(midiBlob(), { sampleRate: SAMPLE_RATE });
    expect(() => createArrangement({ tracks })).not.toThrow();
  });
});
