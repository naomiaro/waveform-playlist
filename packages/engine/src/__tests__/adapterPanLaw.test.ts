/**
 * The engine brings its adapter in step with a track's pan law (#684): the
 * law travels in the track the adapter is sent, and a change of the law
 * alone is one `setTrackPanLaw` call (or the track again, for an adapter
 * without that method).
 */
import { describe, it, expect, vi } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import type { ArrangementTrack, AudioClip, PlayoutTrack } from '@waveform-playlist/core';
import { PlaylistEngine, createArrangement } from '../index';
import { recordingAdapter } from './helpers/recordingAdapter';
import type { RecordingAdapterOptions } from './helpers/recordingAdapter';

const RATE = 48000;

function audio(id: string, channels: number, startSample = 0): AudioClip {
  return {
    ...createClip({
      audioBuffer: {
        sampleRate: RATE,
        length: 4 * RATE,
        duration: 4,
        numberOfChannels: channels,
      } as AudioBuffer,
      startSample,
      durationSamples: RATE,
      offsetSamples: 0,
    }),
    id,
  };
}

function track(
  id: string,
  clips: ArrangementTrack['clips'] = [],
  extra: Partial<ArrangementTrack> = {}
): ArrangementTrack {
  return { ...createTrack({ name: id, clips: [] }), id, clips, ...extra };
}

function setup(tracks: ArrangementTrack[], options: RecordingAdapterOptions = {}) {
  const adapter = recordingAdapter(options);
  const arrangement = createArrangement({ tracks });
  const engine = new PlaylistEngine({ arrangement, adapter, sampleRate: RATE });
  adapter.reset();
  return { adapter, arrangement, engine };
}

/** The pan law of each track in the last call of `method`, by track id. */
function lawsSent(adapter: ReturnType<typeof recordingAdapter>, method: string) {
  const call = [...adapter.rawCalls].reverse().find((c) => c.method === method);
  if (!call) throw new Error(`no ${method} call`);
  const tracks = (
    method === 'setTracks' ? call.args[0] : [call.args[call.args.length - 1]]
  ) as PlayoutTrack[];
  return Object.fromEntries(tracks.map((t) => [t.id, t.panLaw]));
}

describe('the track an adapter is sent carries the law', () => {
  it('the first send: the law of each track, auto as no field or auto', () => {
    const adapter = recordingAdapter();
    const arrangement = createArrangement({
      tracks: [track('mono', [audio('a', 1)]), track('stereo', [audio('b', 2)]), track('empty')],
    });
    const engine = new PlaylistEngine({ arrangement, adapter, sampleRate: RATE });

    const laws = lawsSent(adapter, 'setTracks');
    expect(laws.mono).toBe('mono');
    expect(laws.stereo).toBe('stereo');
    expect(laws.empty ?? 'auto').toBe('auto');
    expect(engine.getState().tracks.map((t) => t.panLaw ?? 'auto')).toEqual([
      'mono',
      'stereo',
      'auto',
    ]);
    engine.dispose();
  });

  it("the track's own field never shows through an entry that has another law", () => {
    const { adapter, arrangement, engine } = setup([track('t', [audio('a', 1)])]);
    // The id keeps its 'mono' entry; the new object carries 'stereo'.
    arrangement.updateTrack('t', (t) => ({ ...t, panLaw: 'stereo' }));
    expect(lawsSent(adapter, 'updateTrack').t).toBe('mono');
    expect(engine.getState().tracks[0].panLaw).toBe('mono');
    engine.dispose();
  });

  it('first audio: the track call carries the law, and there is no setTrackPanLaw call', () => {
    const { adapter, arrangement, engine } = setup([track('t')]);
    arrangement.updateTrack('t', (t) => ({ ...t, clips: [audio('a', 2)] }));

    expect(adapter.calls.map((c) => c.method)).toEqual(['updateTrack']);
    expect(lawsSent(adapter, 'updateTrack').t).toBe('stereo');
    engine.dispose();
  });
});

describe('engine.setTrackPanLaw', () => {
  it('is one adapter call, no track call, one statechange', () => {
    const { adapter, arrangement, engine } = setup([track('t', [audio('a', 1)])]);
    const onState = vi.fn();
    engine.on('statechange', onState);

    engine.setTrackPanLaw('t', 'stereo');

    expect(adapter.calls).toEqual([{ method: 'setTrackPanLaw', args: ['t', 'stereo'] }]);
    expect(onState).toHaveBeenCalledTimes(1);
    expect(arrangement.getMixer().get('t')?.panLaw).toBe('stereo');
    expect(engine.getState().tracks[0].panLaw).toBe('stereo');
    engine.dispose();
  });

  it('the arrangement’s own setter reaches the adapter the same way', () => {
    const { adapter, arrangement, engine } = setup([track('t', [audio('a', 1)])]);
    arrangement.setTrackPanLaw('t', 'stereo');
    expect(adapter.calls).toEqual([{ method: 'setTrackPanLaw', args: ['t', 'stereo'] }]);
    engine.dispose();
  });

  it('an undo of a law sends the old one', () => {
    const { adapter, engine } = setup([track('t', [audio('a', 1)])]);
    engine.setTrackPanLaw('t', 'stereo');
    adapter.reset();

    engine.undo();

    expect(adapter.calls).toEqual([{ method: 'setTrackPanLaw', args: ['t', 'mono'] }]);
    engine.dispose();
  });

  it('an undo back to auto sends auto', () => {
    const { adapter, engine } = setup([track('t')]);
    engine.setTrackPanLaw('t', 'stereo');
    adapter.reset();

    engine.undo();

    expect(adapter.calls).toEqual([{ method: 'setTrackPanLaw', args: ['t', 'auto'] }]);
    engine.dispose();
  });

  it('an adapter without the method is sent the track', () => {
    const { adapter, engine } = setup([track('t', [audio('a', 1)])], { panLaw: false });

    engine.setTrackPanLaw('t', 'stereo');

    expect(adapter.calls.map((c) => c.method)).toEqual(['updateTrack']);
    expect(lawsSent(adapter, 'updateTrack').t).toBe('stereo');
    engine.dispose();
  });

  it('an adapter with neither method is sent every track', () => {
    const { adapter, engine } = setup([track('t', [audio('a', 1)]), track('u')], {
      panLaw: false,
      incremental: false,
    });

    engine.setTrackPanLaw('t', 'stereo');

    expect(adapter.calls.map((c) => c.method)).toEqual(['setTracks']);
    expect(lawsSent(adapter, 'setTracks').t).toBe('stereo');
    engine.dispose();
  });

  it('an unchanged value or an unknown id makes no adapter call, unlike the other setters', () => {
    const { adapter, engine } = setup([track('t', [audio('a', 1)])]);
    const onState = vi.fn();
    engine.on('statechange', onState);

    engine.setTrackPanLaw('t', 'mono');
    engine.setTrackPanLaw('nope', 'stereo');

    expect(adapter.calls).toEqual([]);
    expect(onState).not.toHaveBeenCalled();
    // The control: pan does pass an unchanged value through.
    engine.setTrackPan('t', 0);
    expect(adapter.calls).toEqual([{ method: 'setTrackPan', args: ['t', 0] }]);
    engine.dispose();
  });

  it('a value that is not mono or stereo throws and calls nothing', () => {
    const { adapter, engine } = setup([track('t', [audio('a', 1)])]);
    expect(() => engine.setTrackPanLaw('t', 'auto' as never)).toThrow(/panLaw must be/);
    expect(() => engine.setTrackPanLaw('t', 'bogus' as never)).toThrow(/panLaw must be/);
    expect(adapter.calls).toEqual([]);
    engine.dispose();
  });

  it('does nothing after dispose', () => {
    const { adapter, arrangement, engine } = setup([track('t', [audio('a', 1)])]);
    engine.dispose();
    adapter.reset();
    arrangement.setTrackPanLaw('t', 'stereo');
    expect(adapter.calls).toEqual([]);
  });
});
