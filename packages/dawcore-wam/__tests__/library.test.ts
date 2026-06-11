import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchWamLibrary } from '../src/library';

const MANIFEST_URL = 'https://plugins.example.com/collection/library.json';

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
 * Faithful copy of the first four entries of the WAM community registry
 * (burns-audio plugin pack). Source (fetched 2026-06-10):
 * https://www.webaudiomodules.com/community/plugins.json
 *
 * Note the shape: top-level array, plugin URL in "path" (relative), relative
 * "thumbnail", plus extra fields ("identifier", "website", "category",
 * "thumbnailDimensions") that the parser must tolerate.
 */
const COMMUNITY_PLUGINS_JSON = [
  {
    identifier: 'com.sequencerParty.audioInput',
    name: 'Audio Input',
    vendor: 'Sequencer Party',
    website: 'https://sequencer.party',
    description: 'Provides audio from external sound card input or microphone.',
    keywords: ['utility', 'input'],
    category: ['Effect', 'Utility'],
    thumbnail: 'burns-audio/audio_input/screenshot.png',
    thumbnailDimensions: { width: 642, height: 482 },
    path: 'burns-audio/audio_input/index.js',
  },
  {
    identifier: 'com.sequencerParty.simpleDistortion',
    name: 'Simple Distortion',
    vendor: 'Sequencer Party',
    website: 'https://sequencer.party',
    description: 'Simple waveshaper-based distortion with variable curve and gain',
    keywords: ['effect', 'distortion'],
    category: ['Effect', 'Distortion'],
    thumbnail: 'burns-audio/distortion/screenshot.png',
    thumbnailDimensions: { width: 316, height: 260 },
    path: 'burns-audio/distortion/index.js',
  },
  {
    identifier: 'com.sequencerParty.envmod',
    name: 'Envelope Follower',
    vendor: 'Sequencer Party',
    website: 'https://sequencer.party',
    description: 'Modulate a destination parameter with an audio signal.',
    keywords: ['modulator', 'envelope', 'follower'],
    category: ['Modulation', 'Modulator'],
    thumbnail: 'burns-audio/envmod/screenshot.png',
    thumbnailDimensions: { width: 580, height: 202 },
    path: 'burns-audio/envmod/index.js',
  },
  {
    identifier: 'com.sequencerParty.functionSeq',
    name: 'Function Sequencer',
    vendor: 'Sequencer Party',
    website: 'https://sequencer.party',
    description: 'Collaborative live-coding javascript sequencer.',
    keywords: ['sequencer', 'javascript', 'midi'],
    category: ['MIDI', 'Sequencer'],
    thumbnail: 'burns-audio/functionseq/screenshot.png',
    thumbnailDimensions: { width: 1870, height: 586 },
    path: 'burns-audio/functionseq/index.js',
  },
];

const COMMUNITY_MANIFEST_URL = 'https://www.webaudiomodules.com/community/plugins.json';

/**
 * Faithful copy of wam-studio's Pedalboard2 library manifest, which lists
 * plugins from both webaudiomodules/wam-examples (wimmics, mainline.i3s
 * builds) and the burns-audio pack. Source:
 * https://github.com/Brotherta/wam-studio/blob/master/bank/pedalboard2/static/wamstudio_library.t.json
 *
 * Note the shape: top-level object with a "plugins" array of bare URL
 * strings, plus extra fields ("$schema", "id", "version", "permissive",
 * "presets", "includes") that the parser must tolerate. The "{{BANKURL}}"
 * placeholders are part of the upstream template and live only in fields
 * the parser ignores.
 */
const WAMSTUDIO_LIBRARY_JSON = {
  $schema: '../../bank/pedalboard2/static/library_schema.json',
  name: 'Wamstudio Official Pedalboard2 Library',
  id: 'wamstudio.base',
  version: [0, 0],
  permissive: true,
  plugins: [
    'https://mainline.i3s.unice.fr/PedalEditor/Back-End/functional-pedals/published/clarinetMIDI/indexGUIStandard.js',
    'https://mainline.i3s.unice.fr/PedalEditor/Back-End/functional-pedals/published/JUNO6v2/indexGUIStandard.js',
    'https://wam-4tt.pages.dev/Pro54/index.js',
    'https://mainline.i3s.unice.fr/WAMViktorNV1/viktorNV1/index.js',
    'https://wam-4tt.pages.dev/TX81Z/index.js',
    'https://mainline.i3s.unice.fr/WAMChorusMB/index.js',
    'https://mainline.i3s.unice.fr/WAMAutoWahMB/index.js',
    'https://mainline.i3s.unice.fr/WAMfreeverbMB/index.js',
    'https://mainline.i3s.unice.fr/WAMCollisionDriveMB/index.js',
    'https://mainline.i3s.unice.fr/PedalEditor/Back-End/functional-pedals/published/fluteForIS2/index.js',
    'https://mainline.i3s.unice.fr/wam2/packages/faustPingPongDelay/plugin/index.js',
    'https://mainline.i3s.unice.fr/wam2/packages/obxd/index.js',
    'https://mainline.i3s.unice.fr/wam2/packages/pingpongdelay/dist/index.js',
    'https://mainline.i3s.unice.fr/wam2/packages/quadrafuzz/dist/index.js',
    'https://mainline.i3s.unice.fr/WamSampler/src/index.js',
    'https://www.webaudiomodules.com/community/plugins/burns-audio/distortion/index.js',
    'https://www.webaudiomodules.com/community/plugins/burns-audio/drumsampler/index.js',
    'https://www.webaudiomodules.com/community/plugins/burns-audio/envmod/index.js',
    'https://www.webaudiomodules.com/community/plugins/burns-audio/jx3p_editor/index.js',
    'https://www.webaudiomodules.com/community/plugins/burns-audio/modal/index.js',
    'https://www.webaudiomodules.com/community/plugins/burns-audio/soundfont/index.js',
    'https://www.webaudiomodules.com/community/plugins/burns-audio/synth101/index.js',
    'https://www.webaudiomodules.com/community/plugins/wimmics/csoundPitchShifter/dist/index.js',
    'https://mainline.i3s.unice.fr/PedalEditor/Back-End/functional-pedals/published/untitled6/index.js',
  ],
  presets: {
    'Piano Echo': {
      description: 'A MIDI Piano with an echo effect',
      category: 'instrument',
      state: {
        plugins: [
          {
            wam_id: 'com.sequencerParty.soundfont',
            state: { instrument: 'acoustic_grand_piano' },
          },
          {
            wam_id: 'Shihong Ren.Faust PingPongDelay',
            state: {
              '/PingPongDelayFaust/bypass': 0,
              '/PingPongDelayFaust/mix': 0.5,
              '/PingPongDelayFaust/time': 0.10000000149011612,
              '/PingPongDelayFaust/feedback': 0.30000001192092896,
            },
          },
        ],
      },
    },
    'Wam API Library': {
      description: 'A library fetching its WAM from the WAM API',
      category: 'library',
      state: { library: '{{BANKURL}}/wam_api_library.json', plugins: [] },
    },
    'Legacy Library': {
      description: 'A library of the plugins hosted in the wam bank',
      category: 'library',
      state: { library: '{{BANKURL}}/plugins/library.json', plugins: [] },
    },
  },
  includes: [
    { id: 'wamstudio.pedalboard2.legacy', version: [0, 0], url: '{{BANKURL}}/local_library.json' },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchWamLibrary — manifest shapes', () => {
  it('parses a top-level array of entry objects', async () => {
    const fetchFn = makeFetchFn([
      { name: 'Reverb', url: 'https://plugins.example.com/reverb/index.js' },
      { name: 'Delay', url: 'https://plugins.example.com/delay/index.js' },
    ]);

    const { entries, warnings } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(fetchFn).toHaveBeenCalledWith(MANIFEST_URL);
    expect(warnings).toEqual([]);
    expect(entries).toEqual([
      { name: 'Reverb', url: 'https://plugins.example.com/reverb/index.js' },
      { name: 'Delay', url: 'https://plugins.example.com/delay/index.js' },
    ]);
  });

  it('parses an object with a "plugins" array (pedalboard2 library shape)', async () => {
    const fetchFn = makeFetchFn({
      name: 'My Library',
      plugins: [{ name: 'Chorus', url: 'https://plugins.example.com/chorus/index.js' }],
    });

    const { entries, warnings } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(warnings).toEqual([]);
    expect(entries).toEqual([
      { name: 'Chorus', url: 'https://plugins.example.com/chorus/index.js' },
    ]);
  });

  it('accepts bare URL strings as entries, deriving a name from the URL', async () => {
    const fetchFn = makeFetchFn({
      plugins: [
        'https://plugins.example.com/synth101/index.js',
        'https://plugins.example.com/quadrafuzz/dist/index.js',
      ],
    });

    const { entries, warnings } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(warnings).toEqual([]);
    expect(entries).toEqual([
      { name: 'synth101', url: 'https://plugins.example.com/synth101/index.js' },
      { name: 'quadrafuzz', url: 'https://plugins.example.com/quadrafuzz/dist/index.js' },
    ]);
  });

  it('accepts "path" as the plugin URL field (community registry shape)', async () => {
    const fetchFn = makeFetchFn([{ name: 'Distortion', path: 'burns-audio/distortion/index.js' }]);

    const { entries } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(entries).toEqual([
      {
        name: 'Distortion',
        url: 'https://plugins.example.com/collection/burns-audio/distortion/index.js',
      },
    ]);
  });
});

describe('fetchWamLibrary — URL resolution', () => {
  it('resolves relative plugin URLs against the manifest URL', async () => {
    const fetchFn = makeFetchFn([
      { name: 'Reverb', url: 'reverb/index.js' },
      { name: 'Phaser', url: '../shared/phaser/index.js' },
      { name: 'Flanger', url: '/root/flanger/index.js' },
    ]);

    const { entries } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(entries.map((e) => e.url)).toEqual([
      'https://plugins.example.com/collection/reverb/index.js',
      'https://plugins.example.com/shared/phaser/index.js',
      'https://plugins.example.com/root/flanger/index.js',
    ]);
  });

  it('leaves absolute plugin URLs untouched', async () => {
    const fetchFn = makeFetchFn([{ name: 'Reverb', url: 'https://other.example.org/reverb.js' }]);

    const { entries } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(entries[0].url).toBe('https://other.example.org/reverb.js');
  });

  it('resolves relative URLs against options.baseUrl when provided', async () => {
    const fetchFn = makeFetchFn([{ name: 'Distortion', path: 'burns-audio/distortion/index.js' }]);

    const { entries } = await fetchWamLibrary(COMMUNITY_MANIFEST_URL, {
      fetchFn,
      baseUrl: 'https://www.webaudiomodules.com/community/plugins/',
    });

    expect(entries[0].url).toBe(
      'https://www.webaudiomodules.com/community/plugins/burns-audio/distortion/index.js'
    );
  });

  it('resolves a relative thumbnail against the same base as the plugin URL', async () => {
    const fetchFn = makeFetchFn([
      {
        name: 'Distortion',
        path: 'burns-audio/distortion/index.js',
        thumbnail: 'burns-audio/distortion/screenshot.png',
      },
    ]);

    const { entries } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(entries[0].thumbnail).toBe(
      'https://plugins.example.com/collection/burns-audio/distortion/screenshot.png'
    );
  });
});

describe('fetchWamLibrary — optional fields', () => {
  it('passes through description, vendor, thumbnail, and keywords', async () => {
    const fetchFn = makeFetchFn([
      {
        name: 'Reverb',
        url: 'https://plugins.example.com/reverb/index.js',
        description: 'A lush hall reverb',
        vendor: 'Example Audio',
        thumbnail: 'https://plugins.example.com/reverb/thumb.png',
        keywords: ['effect', 'reverb'],
      },
    ]);

    const { entries } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(entries[0]).toEqual({
      name: 'Reverb',
      url: 'https://plugins.example.com/reverb/index.js',
      description: 'A lush hall reverb',
      vendor: 'Example Audio',
      thumbnail: 'https://plugins.example.com/reverb/thumb.png',
      keywords: ['effect', 'reverb'],
    });
  });

  it('drops malformed optional fields without skipping the entry', async () => {
    const fetchFn = makeFetchFn([
      {
        name: 'Reverb',
        url: 'https://plugins.example.com/reverb/index.js',
        description: 42,
        vendor: { name: 'nested' },
        thumbnail: false,
        keywords: 'effect',
      },
    ]);

    const { entries, warnings } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(warnings).toEqual([]);
    expect(entries).toEqual([
      { name: 'Reverb', url: 'https://plugins.example.com/reverb/index.js' },
    ]);
  });

  it('filters non-string items out of keywords', async () => {
    const fetchFn = makeFetchFn([
      {
        name: 'Reverb',
        url: 'https://plugins.example.com/reverb/index.js',
        keywords: ['effect', 5, 'reverb', null],
      },
    ]);

    const { entries } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(entries[0].keywords).toEqual(['effect', 'reverb']);
  });
});

describe('fetchWamLibrary — invalid entries', () => {
  it('skips entries missing a name with a per-entry warning, keeping valid ones', async () => {
    const fetchFn = makeFetchFn([
      { url: 'https://plugins.example.com/anonymous/index.js' },
      { name: 'Delay', url: 'https://plugins.example.com/delay/index.js' },
    ]);

    const { entries, warnings } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(entries).toEqual([{ name: 'Delay', url: 'https://plugins.example.com/delay/index.js' }]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('[waveform-playlist] ');
    expect(warnings[0]).toContain('entry 0');
    expect(warnings[0]).toContain('name');
  });

  it('skips entries missing a plugin URL with a per-entry warning', async () => {
    const fetchFn = makeFetchFn([
      { name: 'No URL Here' },
      { name: 'Delay', url: 'https://plugins.example.com/delay/index.js' },
    ]);

    const { entries, warnings } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(entries).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('entry 0');
    expect(warnings[0]).toContain('"No URL Here"');
  });

  it('skips entries that are neither strings nor objects', async () => {
    const fetchFn = makeFetchFn([
      42,
      null,
      { name: 'Delay', url: 'https://plugins.example.com/delay/index.js' },
    ]);

    const { entries, warnings } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(entries).toHaveLength(1);
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toContain('entry 0');
    expect(warnings[1]).toContain('entry 1');
  });

  it('skips entries whose plugin URL cannot be resolved', async () => {
    const fetchFn = makeFetchFn([
      { name: 'Broken', url: 'https://' },
      { name: 'Delay', url: 'https://plugins.example.com/delay/index.js' },
    ]);

    const { entries, warnings } = await fetchWamLibrary(MANIFEST_URL, { fetchFn });

    expect(entries).toHaveLength(1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('entry 0');
  });
});

describe('fetchWamLibrary — manifest errors', () => {
  it('rejects with a clear error when the manifest is unreachable', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(fetchWamLibrary(MANIFEST_URL, { fetchFn })).rejects.toThrow(
      new RegExp('\\[waveform-playlist\\][\\s\\S]*could not fetch[\\s\\S]*plugins\\.example\\.com')
    );
  });

  it('rejects with the HTTP status when the manifest request fails', async () => {
    const fetchFn = makeFetchFn(null, { ok: false, status: 404, statusText: 'Not Found' });

    await expect(fetchWamLibrary(MANIFEST_URL, { fetchFn })).rejects.toThrow(/HTTP 404/);
  });

  it('rejects with a clear error when the manifest is not valid JSON', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    }));

    await expect(fetchWamLibrary(MANIFEST_URL, { fetchFn })).rejects.toThrow(/not valid JSON/);
  });

  it('rejects when the manifest has an unrecognized shape', async () => {
    const fetchFn = makeFetchFn({ unexpected: true });

    await expect(fetchWamLibrary(MANIFEST_URL, { fetchFn })).rejects.toThrow(
      /top-level array|"plugins" array/
    );
  });

  it('rejects when no entries are valid, mentioning how many were skipped', async () => {
    const fetchFn = makeFetchFn([{ name: 'No URL' }, 42]);

    await expect(fetchWamLibrary(MANIFEST_URL, { fetchFn })).rejects.toThrow(
      /no valid plugin entries[\s\S]*2/
    );
  });

  it('rejects an empty manifest array as having no valid entries', async () => {
    const fetchFn = makeFetchFn([]);

    await expect(fetchWamLibrary(MANIFEST_URL, { fetchFn })).rejects.toThrow(
      /no valid plugin entries/
    );
  });
});

describe('fetchWamLibrary — default fetch', () => {
  it('uses global fetch when no fetchFn is provided', async () => {
    const stub = vi.fn(async () =>
      makeResponse([{ name: 'Reverb', url: 'https://plugins.example.com/reverb/index.js' }])
    );
    vi.stubGlobal('fetch', stub);

    const { entries } = await fetchWamLibrary(MANIFEST_URL);

    expect(stub).toHaveBeenCalledWith(MANIFEST_URL);
    expect(entries).toHaveLength(1);
  });
});

describe('fetchWamLibrary — real-world manifests', () => {
  it('parses the webaudiomodules.com community registry (burns-audio pack)', async () => {
    const fetchFn = makeFetchFn(COMMUNITY_PLUGINS_JSON);

    const { entries, warnings } = await fetchWamLibrary(COMMUNITY_MANIFEST_URL, {
      fetchFn,
      baseUrl: 'https://www.webaudiomodules.com/community/plugins/',
    });

    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(4);
    expect(entries[1]).toEqual({
      name: 'Simple Distortion',
      url: 'https://www.webaudiomodules.com/community/plugins/burns-audio/distortion/index.js',
      description: 'Simple waveshaper-based distortion with variable curve and gain',
      vendor: 'Sequencer Party',
      thumbnail:
        'https://www.webaudiomodules.com/community/plugins/burns-audio/distortion/screenshot.png',
      keywords: ['effect', 'distortion'],
    });
  });

  it('parses the wam-studio pedalboard2 library (wam-examples + burns-audio plugins)', async () => {
    const fetchFn = makeFetchFn(WAMSTUDIO_LIBRARY_JSON);

    const { entries, warnings } = await fetchWamLibrary(
      'https://wam-bank.example.com/wamstudio_library.json',
      { fetchFn }
    );

    expect(warnings).toEqual([]);
    expect(entries).toHaveLength(24);
    // Bare URL strings get names derived from the URL path.
    expect(entries[21]).toEqual({
      name: 'synth101',
      url: 'https://www.webaudiomodules.com/community/plugins/burns-audio/synth101/index.js',
    });
    // Generic segments like dist/src/plugin are skipped when deriving names.
    expect(entries[13].name).toBe('quadrafuzz');
    expect(entries[14].name).toBe('WamSampler');
    expect(entries[10].name).toBe('faustPingPongDelay');
    // index-prefixed filenames (indexGUIStandard.js) are generic too — the
    // name must come from the plugin's directory, and must not collide
    // across different plugins sharing the same entry filename.
    expect(entries[0].name).toBe('clarinetMIDI');
    expect(entries[1].name).toBe('JUNO6v2');
  });
});
