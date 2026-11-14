// @vitest-environment jsdom
//
// #812 review: `useAudioTracks` warned when two configs had the same track id.
// With the hook removed, the provider warns once per set of duplicate ids.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { duplicateTrackIds } from '../utils/duplicateTrackIds';
import { resetPartWarnings } from '../components/partWarnings';
import {
  installProviderHarness,
  mount,
  plainTrack,
  ready,
  track,
  plainClip,
} from './providerHarness';

const MESSAGE = 'Track ids must be unique, but these are used more than once: ';

describe('duplicateTrackIds', () => {
  it('lists each id that is used more than once, once, in order of first repeat', () => {
    expect(
      duplicateTrackIds([{ id: 'a' }, { id: 'b' }, { id: 'a' }, { id: 'b' }, { id: 'a' }])
    ).toEqual(['a', 'b']);
  });

  it('is empty for unique ids and for no tracks', () => {
    expect(duplicateTrackIds([{ id: 'a' }, { id: 'b' }])).toEqual([]);
    expect(duplicateTrackIds([])).toEqual([]);
  });
});

describe('the provider warns about duplicate track ids', () => {
  installProviderHarness();
  afterEach(() => {
    resetPartWarnings();
  });

  const duplicateWarnings = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.filter((call) => String(call[0]).includes(MESSAGE));

  it('warns once for two tracks that share an id, across re-renders', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = mount([track('same', [plainClip('c1')]), track('same', [plainClip('c2')])]);
    await ready();
    view.setTracks([...view.tracks()]);
    view.rerender();
    await ready();

    const warned = duplicateWarnings(warn);
    expect(warned).toHaveLength(1);
    expect(warned[0][0]).toBe('[waveform-playlist] ' + MESSAGE + 'same');
  });

  it('does not warn for unique ids', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const view = mount([plainTrack('a'), plainTrack('b')]);
    await ready();
    view.rerender();

    expect(duplicateWarnings(warn)).toHaveLength(0);
  });
});
