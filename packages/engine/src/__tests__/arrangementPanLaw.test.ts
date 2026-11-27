/**
 * A track's pan law is a mixer value (#684): 'auto' until the track holds
 * decoded audio, then the law of that audio, and from then on only
 * `setTrackPanLaw` (or an undo, a redo, an abort) changes it.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClip, createTrack } from '@waveform-playlist/core';
import type {
  ArrangementTrack,
  AudioClip,
  ClipSource,
  LoadingClip,
  WaveformDataObject,
} from '@waveform-playlist/core';
import { attachDecodeContext, createArrangement } from '../index';
import type { Arrangement, CreateArrangementOptions, LoadSource } from '../index';

const RATE = 48000;
const SECOND = RATE;

const buffer = (numberOfChannels: number): AudioBuffer =>
  ({ sampleRate: RATE, length: 4 * SECOND, duration: 4, numberOfChannels }) as AudioBuffer;

/** A decoded clip of `channels` channels. */
function audio(id: string, channels: number, startSample = 0): AudioClip {
  return {
    ...createClip({
      audioBuffer: buffer(channels),
      startSample,
      durationSamples: SECOND,
      offsetSamples: 0,
    }),
    id,
  };
}

/** A clip that is not loading and has no buffer (made from peaks alone). */
function peaksOnly(id: string): AudioClip {
  return {
    ...createClip({
      startSample: 0,
      durationSamples: SECOND,
      offsetSamples: 0,
      sampleRate: RATE,
      sourceDurationSamples: 4 * SECOND,
      waveformData: { sample_rate: RATE, duration: 4 } as WaveformDataObject,
    }),
    id,
  };
}

function loading(id: string, src: ClipSource, start = 0): LoadingClip {
  return { id, src, start, duration: 1 };
}

function track(
  id: string,
  clips: ArrangementTrack['clips'] = [],
  extra: Partial<ArrangementTrack> = {}
): ArrangementTrack {
  return { ...createTrack({ name: id, clips: [] }), id, clips, ...extra };
}

const withClips = (clips: ArrangementTrack['clips']) => (t: ArrangementTrack) => ({ ...t, clips });
const adding = (clip: AudioClip | LoadingClip) => (t: ArrangementTrack) => ({
  ...t,
  clips: [...t.clips, clip],
});

const law = (arrangement: Arrangement, id: string) => arrangement.getMixer().get(id)?.panLaw;

interface PendingLoad {
  src: ClipSource;
  resolve(buffer: AudioBuffer): void;
}

/** Let promise callbacks run: a load starts, or a settled load is applied. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** An arrangement whose loads stay pending until the test settles them. */
async function withLoads(
  tracks: ArrangementTrack[],
  options: Omit<CreateArrangementOptions, 'tracks' | 'loadSource'> = {}
) {
  const calls: PendingLoad[] = [];
  const loadSource: LoadSource = (src) =>
    new Promise<AudioBuffer>((resolve) => {
      calls.push({ src, resolve });
    });
  const arrangement = createArrangement({ ...options, tracks, loadSource });
  attachDecodeContext(arrangement, async () => ({}) as BaseAudioContext);
  await flush();
  const settle = async (src: ClipSource, channels: number) => {
    const call = calls.find((c) => c.src === src);
    if (!call) throw new Error(`no load was started for ${String(src)}`);
    call.resolve(buffer(channels));
    await flush();
  };
  return { arrangement, settle };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('the law a track enters with', () => {
  it('an empty track enters with auto', () => {
    const arrangement = createArrangement();
    arrangement.addTrack(track('t'));
    expect(law(arrangement, 't')).toBe('auto');
  });

  it('a track enters with the law of its audio, the highest channel count deciding', () => {
    const arrangement = createArrangement({
      tracks: [
        track('mono', [audio('a', 1)]),
        track('mixed', [audio('b', 1), audio('c', 2, SECOND)]),
      ],
    });
    expect(law(arrangement, 'mono')).toBe('mono');
    expect(law(arrangement, 'mixed')).toBe('stereo');
    arrangement.addTrack(track('later', [audio('d', 2)]));
    expect(law(arrangement, 'later')).toBe('stereo');
  });

  it("the track's own field wins at entry", () => {
    const arrangement = createArrangement();
    arrangement.addTrack(track('t', [audio('a', 2)], { panLaw: 'mono' }));
    expect(law(arrangement, 't')).toBe('mono');
    arrangement.addTrack(track('u', [], { panLaw: 'stereo' }));
    expect(law(arrangement, 'u')).toBe('stereo');
  });

  it('a field that is not a law enters as auto', () => {
    const arrangement = createArrangement();
    for (const [id, bad] of [
      ['a', 'bogus'],
      ['b', null],
      ['c', 2],
    ] as const) {
      expect(() => arrangement.addTrack(track(id, [], { panLaw: bad as never }))).not.toThrow();
      expect(law(arrangement, id)).toBe('auto');
    }
  });

  it('a clip without a buffer is not audio: the track stays auto until a buffer arrives', () => {
    const arrangement = createArrangement({ tracks: [track('t', [peaksOnly('p')])] });
    expect(law(arrangement, 't')).toBe('auto');
    arrangement.updateTrack('t', adding(audio('a', 2, SECOND)));
    expect(law(arrangement, 't')).toBe('stereo');
  });

  it('a MIDI track stays auto, whatever it carries, and ignores the setter', () => {
    const midi = {
      ...createTrack({ name: 'm', kind: 'midi', clips: [] }),
      id: 'm',
      panLaw: 'stereo',
    } as ArrangementTrack;
    const arrangement = createArrangement({ tracks: [midi] });
    expect(law(arrangement, 'm')).toBe('auto');

    arrangement.setTrackPanLaw('m', 'stereo');

    expect(law(arrangement, 'm')).toBe('auto');
    expect(arrangement.canUndo).toBe(false);
  });
});

describe('first audio decides', () => {
  it('in the same undo step as the audio', () => {
    const arrangement = createArrangement({ tracks: [track('t')] });
    arrangement.updateTrack('t', adding(audio('a', 1)));
    expect(law(arrangement, 't')).toBe('mono');

    arrangement.undo();
    expect(law(arrangement, 't')).toBe('auto');
    expect(arrangement.canUndo).toBe(false);

    arrangement.redo();
    expect(law(arrangement, 't')).toBe('mono');
  });

  it('counts as a mixer change for whoever follows mixerVersion', () => {
    const arrangement = createArrangement({ tracks: [track('t')] });
    const before = arrangement.mixerVersion;
    arrangement.updateTrack('t', adding(audio('a', 1)));
    expect(arrangement.mixerVersion).toBe(before + 1);
  });

  it('needs no history', () => {
    const arrangement = createArrangement({ tracks: [track('t')], undoLimit: 0 });
    arrangement.updateTrack('t', adding(audio('a', 2)));
    expect(law(arrangement, 't')).toBe('stereo');
  });

  it('is taken back by an abort of the transaction that brought the audio', () => {
    const arrangement = createArrangement({ tracks: [track('t')] });
    arrangement.beginTransaction();
    arrangement.updateTrack('t', adding(audio('a', 2)));
    expect(law(arrangement, 't')).toBe('stereo');
    arrangement.abortTransaction();
    expect(law(arrangement, 't')).toBe('auto');
  });
});

describe('the clips never change a decided law', () => {
  it('a clip of the other kind changes nothing', () => {
    const arrangement = createArrangement({ tracks: [track('t', [audio('a', 1)])] });
    const before = arrangement.mixerVersion;
    arrangement.updateTrack('t', adding(audio('b', 2, SECOND)));
    expect(law(arrangement, 't')).toBe('mono');
    expect(arrangement.mixerVersion).toBe(before);
  });

  it('the last stereo clip leaving changes nothing', () => {
    const arrangement = createArrangement({
      tracks: [track('t', [audio('a', 1), audio('b', 2, SECOND)])],
    });
    arrangement.removeClip('t', 'b');
    expect(law(arrangement, 't')).toBe('stereo');
  });

  it('an emptied track keeps its law', () => {
    const arrangement = createArrangement({ tracks: [track('t', [audio('a', 1)])] });
    arrangement.updateTrack('t', withClips([]));
    expect(law(arrangement, 't')).toBe('mono');
    arrangement.updateTrack('t', adding(audio('b', 2)));
    expect(law(arrangement, 't')).toBe('mono');
  });

  it('setTracks with the same id and other clips keeps the law', () => {
    const arrangement = createArrangement({ tracks: [track('t', [audio('a', 1)])] });
    arrangement.setTracks([track('t', [audio('b', 2)])]);
    expect(law(arrangement, 't')).toBe('mono');
  });

  it('the law follows the track to a new id', () => {
    const arrangement = createArrangement({ tracks: [track('t', [audio('a', 1)])] });
    arrangement.setTrackPanLaw('t', 'stereo');
    arrangement.updateTrack('t', (t) => ({ ...t, id: 'u' }));
    expect(law(arrangement, 'u')).toBe('stereo');
    expect(law(arrangement, 't')).toBeUndefined();
  });
});

describe('setTrackPanLaw', () => {
  it('is a mixer move: an undo step, no track replaced', () => {
    const arrangement = createArrangement({ tracks: [track('t', [audio('a', 1)])] });
    const tracks = arrangement.getTracks();
    const { tracksVersion, mixerVersion } = arrangement;

    arrangement.setTrackPanLaw('t', 'stereo');

    expect(law(arrangement, 't')).toBe('stereo');
    expect(arrangement.getTracks()).toBe(tracks);
    expect(arrangement.tracksVersion).toBe(tracksVersion);
    expect(arrangement.mixerVersion).toBe(mixerVersion + 1);
    expect(arrangement.canUndo).toBe(true);

    arrangement.undo();
    expect(law(arrangement, 't')).toBe('mono');
    arrangement.redo();
    expect(law(arrangement, 't')).toBe('stereo');
  });

  it('an undo of a law is announced as a mixer change', () => {
    const arrangement = createArrangement({ tracks: [track('t', [audio('a', 1)])] });
    arrangement.setTrackPanLaw('t', 'stereo');
    const { mixerVersion, tracksVersion } = arrangement;
    const listener = vi.fn();
    arrangement.subscribe(listener);

    arrangement.undo();

    expect(arrangement.mixerVersion).toBe(mixerVersion + 1);
    expect(arrangement.tracksVersion).toBe(tracksVersion);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('set before any audio pins the law', () => {
    const arrangement = createArrangement({ tracks: [track('t')] });
    arrangement.setTrackPanLaw('t', 'stereo');
    arrangement.updateTrack('t', adding(audio('a', 1)));
    expect(law(arrangement, 't')).toBe('stereo');
  });

  it('an unchanged value or an unknown id does nothing', () => {
    const arrangement = createArrangement({ tracks: [track('t', [audio('a', 1)])] });
    const { mixerVersion } = arrangement;
    const listener = vi.fn();
    arrangement.subscribe(listener);

    arrangement.setTrackPanLaw('t', 'mono');
    arrangement.setTrackPanLaw('nope', 'stereo');

    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.mixerVersion).toBe(mixerVersion);
    expect(listener).not.toHaveBeenCalled();
  });

  it('a value that is not mono or stereo throws before anything changes', () => {
    const arrangement = createArrangement({ tracks: [track('t', [audio('a', 1)])] });
    const { mixerVersion } = arrangement;
    for (const bad of ['auto', 'bogus', undefined, null, 2]) {
      expect(() => arrangement.setTrackPanLaw('t', bad as never)).toThrow(TypeError);
    }
    // Also for an id it does not hold: the value is checked first.
    expect(() => arrangement.setTrackPanLaw('nope', 'auto' as never)).toThrow(TypeError);
    expect(law(arrangement, 't')).toBe('mono');
    expect(arrangement.canUndo).toBe(false);
    expect(arrangement.mixerVersion).toBe(mixerVersion);
  });

  it('calls with one gesture id are one step', () => {
    const arrangement = createArrangement({ tracks: [track('t', [audio('a', 1)])] });
    arrangement.setTrackPanLaw('t', 'stereo', { gesture: 'g' });
    arrangement.setTrackPan('t', 0.5, { gesture: 'g' });
    arrangement.undo();
    expect(law(arrangement, 't')).toBe('mono');
    expect(arrangement.getMixer().get('t')?.pan).toBe(0);
    expect(arrangement.canUndo).toBe(false);
  });

  it('undoable: false is no step, and no undo brings the old law back', () => {
    const arrangement = createArrangement({ tracks: [track('t', [audio('a', 1)])] });
    arrangement.setTrackVolume('t', 0.5);
    arrangement.setTrackPanLaw('t', 'stereo', { undoable: false });
    arrangement.undo();
    expect(arrangement.getMixer().get('t')?.volume).toBe(1);
    expect(law(arrangement, 't')).toBe('stereo');
    expect(arrangement.canUndo).toBe(false);
  });
});

describe('a clip that finishes loading', () => {
  it('decides the law in every state, and is no undo step', async () => {
    const { arrangement, settle } = await withLoads([
      track('t', [loading('L', 's.opus')]),
      track('other'),
    ]);
    arrangement.updateTrack('other', (t) => ({ ...t, name: 'renamed' }));
    expect(law(arrangement, 't')).toBe('auto');
    const { mixerVersion } = arrangement;

    await settle('s.opus', 2);

    expect(law(arrangement, 't')).toBe('stereo');
    expect(arrangement.mixerVersion).toBe(mixerVersion + 1);
    arrangement.undo();
    expect(law(arrangement, 't')).toBe('stereo');
    expect(arrangement.canUndo).toBe(false);
  });

  it('two loads on one track: the first to resolve decides', async () => {
    const { arrangement, settle } = await withLoads([
      track('t', [loading('M', 'm.opus'), loading('S', 's.opus', 2)]),
    ]);
    await settle('m.opus', 1);
    expect(law(arrangement, 't')).toBe('mono');
    await settle('s.opus', 2);
    expect(law(arrangement, 't')).toBe('mono');
  });

  it('a saved state is given the law of its own tracks', async () => {
    const { arrangement, settle } = await withLoads([track('t', [loading('S', 's.opus')])]);
    // The step before this holds only the loading clip.
    arrangement.updateTrack('t', adding(audio('m', 1, 2 * SECOND)));
    expect(law(arrangement, 't')).toBe('mono');

    await settle('s.opus', 2);

    expect(law(arrangement, 't')).toBe('mono');
    arrangement.undo();
    expect(law(arrangement, 't')).toBe('stereo');
    arrangement.redo();
    expect(law(arrangement, 't')).toBe('mono');
  });

  it('a step the load makes a no-op is dropped', async () => {
    const { arrangement, settle } = await withLoads([track('t', [loading('S', 's.opus')])]);
    arrangement.setTrackPanLaw('t', 'stereo');
    expect(arrangement.canUndo).toBe(true);

    await settle('s.opus', 2);

    expect(law(arrangement, 't')).toBe('stereo');
    expect(arrangement.canUndo).toBe(false);
  });

  it('a gesture whose step the load dropped pushes a new step with its next change', async () => {
    const { arrangement, settle } = await withLoads([track('t', [loading('S', 's.opus')])]);
    arrangement.setTrackPanLaw('t', 'stereo', { gesture: 'g' });
    await settle('s.opus', 2);
    expect(arrangement.canUndo).toBe(false);

    arrangement.setTrackPan('t', 0.5, { gesture: 'g' });

    expect(arrangement.canUndo).toBe(true);
    arrangement.undo();
    expect(arrangement.getMixer().get('t')?.pan).toBe(0);
    expect(law(arrangement, 't')).toBe('stereo');
  });

  it('a redo step the load makes a no-op is dropped too', async () => {
    const { arrangement, settle } = await withLoads([track('t', [loading('S', 's.opus')])]);
    arrangement.setTrackPanLaw('t', 'stereo');
    arrangement.undo();
    expect(law(arrangement, 't')).toBe('auto');
    expect(arrangement.canRedo).toBe(true);

    await settle('s.opus', 2);

    // The current state got the law the redo step holds: a redo would change nothing.
    expect(law(arrangement, 't')).toBe('stereo');
    expect(arrangement.canRedo).toBe(false);
    expect(arrangement.canUndo).toBe(false);
  });

  it('a redo step that still differs after the load is kept', async () => {
    const { arrangement, settle } = await withLoads([track('t', [loading('S', 's.opus')])]);
    arrangement.setTrackPanLaw('t', 'mono');
    arrangement.undo();

    await settle('s.opus', 2);

    expect(law(arrangement, 't')).toBe('stereo');
    expect(arrangement.canRedo).toBe(true);
    arrangement.redo();
    expect(law(arrangement, 't')).toBe('mono');
  });

  it('a gesture goes on as one step when the load drops a step below its own', async () => {
    const { arrangement, settle } = await withLoads([
      track('t', [loading('S', 's.opus')]),
      track('u'),
    ]);
    arrangement.setTrackPanLaw('t', 'stereo');
    arrangement.setTrackPan('u', 0.3, { gesture: 'g' });

    // The step from before the law now equals the gesture's step, and is dropped.
    await settle('s.opus', 2);
    arrangement.setTrackPan('u', 0.7, { gesture: 'g' });

    arrangement.undo();
    expect(arrangement.getMixer().get('u')?.pan).toBe(0);
    expect(law(arrangement, 't')).toBe('stereo');
    expect(arrangement.canUndo).toBe(false);
  });

  it('a step that still differs after the load is kept', async () => {
    const { arrangement, settle } = await withLoads([track('t', [loading('S', 's.opus')])]);
    arrangement.setTrackPanLaw('t', 'mono');

    await settle('s.opus', 2);

    expect(law(arrangement, 't')).toBe('mono');
    expect(arrangement.canUndo).toBe(true);
    arrangement.undo();
    expect(law(arrangement, 't')).toBe('stereo');
  });

  it('an open transaction is aborted to a base that has the law of its own tracks', async () => {
    const { arrangement, settle } = await withLoads([track('t', [loading('S', 's.opus')])]);
    arrangement.beginTransaction();
    arrangement.setTrackVolume('t', 0.5);

    await settle('s.opus', 2);
    arrangement.abortTransaction();

    expect(arrangement.getMixer().get('t')?.volume).toBe(1);
    expect(law(arrangement, 't')).toBe('stereo');
  });
});
