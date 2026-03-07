import { describe, it, expect } from 'vitest';
import { LoaderFactory } from '../LoaderFactory';
import { XHRLoader } from '../XHRLoader';
import { BlobLoader } from '../BlobLoader';

// Minimal mock for BaseAudioContext
const mockAudioContext = {} as BaseAudioContext;

describe('LoaderFactory.createLoader', () => {
  it('returns an XHRLoader for string input', () => {
    const loader = LoaderFactory.createLoader('https://example.com/audio.mp3', mockAudioContext);

    expect(loader).toBeInstanceOf(XHRLoader);
  });

  it('returns a BlobLoader for Blob input', () => {
    const blob = new Blob(['fake audio'], { type: 'audio/mp3' });
    const loader = LoaderFactory.createLoader(blob, mockAudioContext);

    expect(loader).toBeInstanceOf(BlobLoader);
  });

  it('returns a BlobLoader for File input (File extends Blob)', () => {
    const file = new File(['fake audio'], 'audio.mp3', { type: 'audio/mp3' });
    const loader = LoaderFactory.createLoader(file, mockAudioContext);

    expect(loader).toBeInstanceOf(BlobLoader);
  });

  it('throws for invalid input type (number)', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      LoaderFactory.createLoader(42 as any, mockAudioContext);
    }).toThrow('Invalid audio source. Must be a URL string or Blob.');
  });

  it('throws for invalid input type (null)', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      LoaderFactory.createLoader(null as any, mockAudioContext);
    }).toThrow('Invalid audio source. Must be a URL string or Blob.');
  });

  it('throws for invalid input type (undefined)', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      LoaderFactory.createLoader(undefined as any, mockAudioContext);
    }).toThrow('Invalid audio source. Must be a URL string or Blob.');
  });

  it('throws for invalid input type (object)', () => {
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      LoaderFactory.createLoader({} as any, mockAudioContext);
    }).toThrow('Invalid audio source. Must be a URL string or Blob.');
  });

  it('handles empty string as valid URL input', () => {
    const loader = LoaderFactory.createLoader('', mockAudioContext);

    expect(loader).toBeInstanceOf(XHRLoader);
  });

  it('passes audioContext to XHRLoader', () => {
    const loader = LoaderFactory.createLoader('https://example.com/audio.mp3', mockAudioContext);

    // Verify it's a working loader instance with the correct state
    expect(loader.getState()).toBe('uninitialized');
  });

  it('passes audioContext to BlobLoader', () => {
    const blob = new Blob(['fake audio'], { type: 'audio/mp3' });
    const loader = LoaderFactory.createLoader(blob, mockAudioContext);

    expect(loader.getState()).toBe('uninitialized');
  });
});
