import { describe, it, expect, afterEach } from 'vitest';
import {
  makeAudioBuffer,
  makeAudioFile,
  makeFakeAdapter,
  restoreFetch,
  stubFetch,
} from './editor-harness';

afterEach(() => restoreFetch());

async function bytesOf(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  return response.arrayBuffer();
}

describe('editor harness: the fake adapter and fetch', () => {
  it('decodes the bytes of a URL into the buffer chosen for it', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok' });
    const chosen = makeAudioBuffer(3);
    fake.setDecoded('/a.wav', chosen);
    const decoded = await fake.adapter.audioContext.decodeAudioData(await bytesOf('/a.wav'));
    expect(decoded).toBe(chosen);
    expect(fake.decodeCount('/a.wav')).toBe(1);
  });

  it('a URL with no chosen buffer decodes to a 2-second buffer at the context rate', async () => {
    const fake = makeFakeAdapter({ sampleRate: 44100 });
    stubFetch({ '/b.wav': 'ok' });
    const decoded = await fake.adapter.audioContext.decodeAudioData(await bytesOf('/b.wav'));
    expect(decoded.duration).toBe(2);
    expect(decoded.sampleRate).toBe(44100);
  });

  it('a held decode settles in the order the test chooses', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok', '/b.wav': 'ok' });
    const a = fake.holdDecode('/a.wav');
    const b = fake.holdDecode('/b.wav');
    const order: string[] = [];
    const ctx = fake.adapter.audioContext;
    const pa = ctx.decodeAudioData(await bytesOf('/a.wav')).then(() => order.push('a'));
    const pb = ctx.decodeAudioData(await bytesOf('/b.wav')).then(() => order.push('b'));
    b.resolve();
    await pb;
    a.resolve();
    await pa;
    expect(order).toEqual(['b', 'a']);
  });

  it('a held decode can fail', async () => {
    const fake = makeFakeAdapter();
    stubFetch({ '/a.wav': 'ok' });
    const held = fake.holdDecode('/a.wav');
    const decoding = fake.adapter.audioContext.decodeAudioData(await bytesOf('/a.wav'));
    held.reject(new Error('corrupt'));
    await expect(decoding).rejects.toThrow('corrupt');
  });

  it('stubFetch answers a status and an error', async () => {
    stubFetch({ '/missing.wav': 404, '/offline.wav': new TypeError('Failed to fetch') });
    const missing = await fetch('/missing.wav');
    expect(missing.ok).toBe(false);
    expect(missing.status).toBe(404);
    await expect(fetch('/offline.wav')).rejects.toThrow('Failed to fetch');
    await expect(fetch('/unknown.wav')).rejects.toThrow(/not stubbed/);
  });

  it('a file made with makeAudioFile decodes under its tag', async () => {
    const fake = makeFakeAdapter();
    const chosen = makeAudioBuffer(1);
    fake.setDecoded('drum.wav', chosen);
    const file = makeAudioFile('drum.wav');
    const decoded = await fake.adapter.audioContext.decodeAudioData(await file.arrayBuffer());
    expect(decoded).toBe(chosen);
  });
});
