/**
 * The fields of a track that say how it is drawn (core's `TRACK_VIEW_FIELDS`:
 * name, colour, height, render mode, spectrogram config and colour map) are
 * not playback. The adapter is never given them, and a change of only those
 * fields makes no adapter call: on the native transport an `updateTrack`
 * stops the sources of the track it is given, so a render-mode choice during
 * playback silenced the track (review of #930). The change is still an undo
 * step and a `statechange`, and `getState().tracks` still has the fields.
 */
import { describe, it, expect } from 'vitest';
import { createClip, createTrack, TRACK_VIEW_FIELDS } from '@waveform-playlist/core';
import type { ArrangementTrack, ClipTrack } from '@waveform-playlist/core';
import { PlaylistEngine } from '../PlaylistEngine';
import { createArrangement } from '../arrangement';
import { recordingAdapter } from './helpers/recordingAdapter';
import type { RecordingAdapterOptions } from './helpers/recordingAdapter';

const SAMPLE_RATE = 48000;

function track(id: string): ClipTrack {
  const clip = {
    ...createClip({
      startSample: 0,
      durationSamples: SAMPLE_RATE,
      offsetSamples: 0,
      sampleRate: SAMPLE_RATE,
      sourceDurationSamples: SAMPLE_RATE,
    }),
    id: `${id}-clip`,
  };
  return {
    ...createTrack({ name: `Track ${id}`, clips: [clip] }),
    id,
    color: '#123456',
    height: 90,
    renderMode: 'spectrogram',
    spectrogramConfig: { fftSize: 4096 },
    spectrogramColorMap: 'magma',
  };
}

function setup(options: RecordingAdapterOptions = {}) {
  const adapter = recordingAdapter(options);
  const arrangement = createArrangement();
  const engine = new PlaylistEngine({ adapter, arrangement, sampleRate: SAMPLE_RATE });
  engine.setTracks([track('A'), track('B')]);
  let statechanges = 0;
  engine.on('statechange', () => statechanges++);
  return { adapter, arrangement, engine, statechanges: () => statechanges };
}

/** Every track object the adapter was given, in every call. */
function tracksGiven(adapter: ReturnType<typeof recordingAdapter>): ClipTrack[] {
  return adapter.rawCalls.flatMap(({ method, args }) => {
    if (method === 'setTracks') return [...(args[0] as ClipTrack[])];
    if (method === 'addTrack') return [args[0] as ClipTrack];
    if (method === 'updateTrack') return [args[1] as ClipTrack];
    return [];
  });
}

const viewChanges: Array<[string, Partial<ArrangementTrack>]> = [
  ['name', { name: 'Renamed' }],
  ['color', { color: '#abcdef' }],
  ['height', { height: 120 }],
  ['renderMode', { renderMode: 'both' }],
  ['spectrogramConfig', { spectrogramConfig: { fftSize: 1024 } }],
  ['spectrogramColorMap', { spectrogramColorMap: 'inferno' }],
];

describe('the fields that say how a track is drawn do not reach the adapter', () => {
  it('lists exactly the six view fields', () => {
    expect([...TRACK_VIEW_FIELDS].sort()).toEqual(
      ['color', 'height', 'name', 'renderMode', 'spectrogramColorMap', 'spectrogramConfig'].sort()
    );
  });

  it('setTracks, addTrack and updateTrack give the adapter tracks without them', () => {
    const { adapter, arrangement, engine } = setup();
    engine.addTrack(track('C'));
    arrangement.updateTrack('A', (t: ArrangementTrack) => ({ ...t, clips: [] }));

    const given = tracksGiven(adapter);
    expect(given.map((t) => t.id)).toEqual(['A', 'B', 'C', 'A']);
    for (const t of given) {
      for (const field of TRACK_VIEW_FIELDS) expect(t).not.toHaveProperty(field);
    }
  });

  it('an adapter without updateTrack is given the full set without them too', () => {
    const { adapter, engine } = setup({ incremental: false });
    engine.addTrack(track('C'));
    const given = tracksGiven(adapter);
    expect(given.length).toBeGreaterThan(0);
    for (const t of given) {
      for (const field of TRACK_VIEW_FIELDS) expect(t).not.toHaveProperty(field);
    }
  });

  it('getState().tracks keeps them', () => {
    const { engine } = setup();
    expect(engine.getState().tracks[0]).toMatchObject({
      name: 'Track A',
      color: '#123456',
      height: 90,
      renderMode: 'spectrogram',
      spectrogramConfig: { fftSize: 4096 },
      spectrogramColorMap: 'magma',
    });
  });

  it.each(viewChanges)(
    'a change of %s alone makes no adapter call, and is an undo step and a statechange',
    (_field, change) => {
      const { adapter, arrangement, engine, statechanges } = setup();
      adapter.reset();

      arrangement.updateTrack('A', (t: ArrangementTrack) => ({ ...t, ...change }));

      expect(adapter.calls).toEqual([]);
      expect(statechanges()).toBe(1);
      expect(engine.getState().tracks[0]).toMatchObject(change);
      expect(engine.canUndo).toBe(true);

      engine.undo();
      expect(adapter.calls).toEqual([]);
      engine.redo();
      expect(adapter.calls).toEqual([]);
    }
  );

  it('a change of a view field and a clip together is one adapter call', () => {
    const { adapter, arrangement } = setup();
    adapter.reset();

    arrangement.updateTrack('A', (t: ArrangementTrack) => ({
      ...t,
      renderMode: 'both',
      clips: [],
    }));

    expect(adapter.calls.map((c) => c.method)).toEqual(['updateTrack']);
  });

  it('a playback field still reaches the adapter (kind)', () => {
    const { adapter, arrangement } = setup();
    adapter.reset();

    arrangement.updateTrack('A', (t: ArrangementTrack) => ({ ...t, kind: 'midi', clips: [] }));

    expect(adapter.calls.map((c) => c.method)).toEqual(['updateTrack']);
  });
});
