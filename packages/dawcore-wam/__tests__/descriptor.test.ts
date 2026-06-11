import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchWamDescriptor } from '../src/descriptor';

function makeResponse(
  body: unknown,
  init: { ok?: boolean; status?: number; statusText?: string } = {}
) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? 'OK',
    json: async () => body,
  };
}

function makeFetchFn(
  body: unknown,
  init: { ok?: boolean; status?: number; statusText?: string } = {}
) {
  return vi.fn(async () => makeResponse(body, init));
}

/**
 * Faithful copy of Audio Input descriptor from burns-audio plugin pack.
 * Source (fetched 2026-06-11):
 * https://www.webaudiomodules.com/community/plugins/burns-audio/audio_input/descriptor.json
 */
const AUDIO_INPUT_DESCRIPTOR_JSON = {
  identifier: 'com.sequencerParty.audioInput',
  name: 'Audio Input',
  vendor: 'Sequencer Party',
  description: 'Provides audio from external sound card input or microphone.',
  version: '1.0.0',
  sdkVersion: '1.0.0',
  thumbnail: 'screenshot.png',
  keywords: ['utility', 'input'],
  isInstrument: false,
  hasAudioOutput: true,
  hasAudioInput: false,
  hasMidiInput: false,
  hasMidiOutput: false,
  website: 'https://sequencer.party',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchWamDescriptor — URL resolution', () => {
  it('resolves descriptor.json next to the plugin module', async () => {
    const fetchFn = makeFetchFn({});

    await fetchWamDescriptor('https://plugins.example.com/coll/audio_input/index.js', { fetchFn });

    expect(fetchFn).toHaveBeenCalledWith(
      'https://plugins.example.com/coll/audio_input/descriptor.json'
    );
  });

  it('returns null when the plugin URL cannot be parsed', async () => {
    const fetchFn = vi.fn();

    const result = await fetchWamDescriptor('not a url', { fetchFn });

    expect(result).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('resolves inside a directory-style plugin URL with a trailing slash', async () => {
    const fetchFn = makeFetchFn({});

    await fetchWamDescriptor('https://plugins.example.com/coll/reverb/', { fetchFn });

    expect(fetchFn).toHaveBeenCalledWith('https://plugins.example.com/coll/reverb/descriptor.json');
  });

  // Documented URL-spec behavior, not a feature: without a trailing slash the
  // last segment is treated as a file, so the probe hits the PARENT directory
  // and may find a different plugin's descriptor. Registries list module
  // files (".../index.js"), where resolution is correct — this test pins the
  // contract for directory-style URLs so a change in behavior is deliberate.
  it('resolves against the parent directory when a bare URL has no trailing slash', async () => {
    const fetchFn = makeFetchFn({});

    await fetchWamDescriptor('https://plugins.example.com/coll/reverb', { fetchFn });

    expect(fetchFn).toHaveBeenCalledWith('https://plugins.example.com/coll/descriptor.json');
  });
});

describe('fetchWamDescriptor — boolean flags', () => {
  it('returns boolean flags from a realistic descriptor payload', async () => {
    const fetchFn = makeFetchFn(AUDIO_INPUT_DESCRIPTOR_JSON);

    const result = await fetchWamDescriptor(
      'https://plugins.example.com/audio_input/index.js',
      { fetchFn }
    );

    expect(result).toEqual({
      hasAudioInput: false,
      hasAudioOutput: true,
      hasMidiInput: false,
      hasMidiOutput: false,
      isInstrument: false,
    });
  });

  it('drops non-boolean flag values', async () => {
    const fetchFn = makeFetchFn({
      hasAudioInput: 'yes',
      hasAudioOutput: true,
      hasMidiInput: 1,
      hasMidiOutput: false,
      isInstrument: null,
      extraField: 'ignored',
    });

    const result = await fetchWamDescriptor(
      'https://plugins.example.com/effect/index.js',
      { fetchFn }
    );

    expect(result).toEqual({
      hasAudioOutput: true,
      hasMidiOutput: false,
    });
  });

  it('returns empty object when descriptor exists but has no boolean flags', async () => {
    const fetchFn = makeFetchFn({
      identifier: 'some.plugin',
      name: 'Plugin',
      version: '1.0.0',
    });

    const result = await fetchWamDescriptor(
      'https://plugins.example.com/plugin/index.js',
      { fetchFn }
    );

    expect(result).toEqual({});
  });
});

describe('fetchWamDescriptor — error handling', () => {
  it('returns null when HTTP response is not ok', async () => {
    const fetchFn = makeFetchFn(null, { ok: false, status: 404, statusText: 'Not Found' });

    const result = await fetchWamDescriptor(
      'https://plugins.example.com/missing/index.js',
      { fetchFn }
    );

    expect(result).toBeNull();
  });

  it('returns null when fetchFn throws', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    const result = await fetchWamDescriptor(
      'https://plugins.example.com/unreachable/index.js',
      { fetchFn }
    );

    expect(result).toBeNull();
  });

  it('returns null when response.json() throws', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => {
        throw new SyntaxError('Invalid JSON');
      },
    }));

    const result = await fetchWamDescriptor(
      'https://plugins.example.com/invalid/index.js',
      { fetchFn }
    );

    expect(result).toBeNull();
  });

  it('returns null when payload is an array', async () => {
    const fetchFn = makeFetchFn([]);

    const result = await fetchWamDescriptor(
      'https://plugins.example.com/array/index.js',
      { fetchFn }
    );

    expect(result).toBeNull();
  });

  it('returns null when payload is a string', async () => {
    const fetchFn = makeFetchFn('not an object');

    const result = await fetchWamDescriptor(
      'https://plugins.example.com/string/index.js',
      { fetchFn }
    );

    expect(result).toBeNull();
  });

  it('returns null when payload is null', async () => {
    const fetchFn = makeFetchFn(null);

    const result = await fetchWamDescriptor(
      'https://plugins.example.com/null/index.js',
      { fetchFn }
    );

    expect(result).toBeNull();
  });

  it('returns null when payload is a number', async () => {
    const fetchFn = makeFetchFn(42);

    const result = await fetchWamDescriptor(
      'https://plugins.example.com/number/index.js',
      { fetchFn }
    );

    expect(result).toBeNull();
  });
});

describe('fetchWamDescriptor — default fetch', () => {
  it('uses global fetch when no fetchFn is provided', async () => {
    const stub = vi.fn(async () =>
      makeResponse({
        hasAudioOutput: true,
        hasAudioInput: false,
      })
    );
    vi.stubGlobal('fetch', stub);

    const result = await fetchWamDescriptor('https://plugins.example.com/effect/index.js');

    expect(stub).toHaveBeenCalledWith('https://plugins.example.com/effect/descriptor.json');
    expect(result).toEqual({
      hasAudioOutput: true,
      hasAudioInput: false,
    });
  });
});
