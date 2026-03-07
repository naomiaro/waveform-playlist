import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@waveform-playlist/engine', () => ({
  constrainClipDrag: vi.fn(),
}));

// Must import after mock setup
import { ClipCollisionModifier } from '../modifiers/ClipCollisionModifier';
import { constrainClipDrag } from '@waveform-playlist/engine';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';

const mockedConstrainClipDrag = vi.mocked(constrainClipDrag);

/** Helper to build a minimal AudioClip for testing. */
function makeClip(overrides: Partial<AudioClip> & { id: string }): AudioClip {
  return {
    startSample: 0,
    durationSamples: 44100,
    offsetSamples: 0,
    ...overrides,
  } as AudioClip;
}

/** Helper to build a minimal ClipTrack for testing. */
function makeTrack(clips: AudioClip[]): ClipTrack {
  return {
    id: 'track-1',
    name: 'Track 1',
    clips,
    muted: false,
    soloed: false,
  } as ClipTrack;
}

/** Creates a modifier instance with the given options. */
function createModifier(options?: { tracks: ClipTrack[]; samplesPerPixel: number }) {
  // ClipCollisionModifier extends Modifier which requires a manager.
  // We only test apply(), so pass a minimal stub as the manager.
  const manager = {} as ConstructorParameters<typeof ClipCollisionModifier>[0];
  const modifier = new ClipCollisionModifier(manager, options);
  return modifier;
}

/** Builds a DragOperation-like object that apply() consumes. */
function makeOperation(overrides: {
  transform?: { x: number; y: number };
  sourceData?: Record<string, unknown> | null;
}) {
  const { transform = { x: 0, y: 0 }, sourceData } = overrides;
  return {
    transform,
    source: sourceData === null ? null : sourceData ? { data: sourceData } : undefined,
  } as Parameters<ClipCollisionModifier['apply']>[0];
}

describe('ClipCollisionModifier', () => {
  beforeEach(() => {
    mockedConstrainClipDrag.mockReset();
  });

  describe('boundary trim operations', () => {
    it('returns zero transform when boundary is "left"', () => {
      const clip = makeClip({ id: 'c1' });
      const track = makeTrack([clip]);
      const modifier = createModifier({
        tracks: [track],
        samplesPerPixel: 1000,
      });

      const op = makeOperation({
        transform: { x: 50, y: 10 },
        sourceData: { boundary: 'left', trackIndex: 0, clipIndex: 0 },
      });

      const result = modifier.apply(op);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('returns zero transform when boundary is "right"', () => {
      const clip = makeClip({ id: 'c1' });
      const track = makeTrack([clip]);
      const modifier = createModifier({
        tracks: [track],
        samplesPerPixel: 1000,
      });

      const op = makeOperation({
        transform: { x: -30, y: 5 },
        sourceData: { boundary: 'right', trackIndex: 0, clipIndex: 0 },
      });

      const result = modifier.apply(op);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('does not call constrainClipDrag for boundary operations', () => {
      const clip = makeClip({ id: 'c1' });
      const track = makeTrack([clip]);
      const modifier = createModifier({
        tracks: [track],
        samplesPerPixel: 1000,
      });

      const op = makeOperation({
        transform: { x: 100, y: 0 },
        sourceData: { boundary: 'left', trackIndex: 0, clipIndex: 0 },
      });

      modifier.apply(op);
      expect(mockedConstrainClipDrag).not.toHaveBeenCalled();
    });
  });

  describe('clip move operations', () => {
    it('converts pixel delta to samples and back', () => {
      const clip = makeClip({ id: 'c1', startSample: 0 });
      const track = makeTrack([clip]);
      const samplesPerPixel = 500;

      // constrainClipDrag returns exactly what we give it (unconstrained)
      mockedConstrainClipDrag.mockReturnValue(25000); // 50px * 500spp

      const modifier = createModifier({
        tracks: [track],
        samplesPerPixel,
      });

      const op = makeOperation({
        transform: { x: 50, y: 10 },
        sourceData: { trackIndex: 0, clipIndex: 0 },
      });

      const result = modifier.apply(op);

      // deltaSamples = 50 * 500 = 25000
      expect(mockedConstrainClipDrag).toHaveBeenCalledWith(clip, 25000, expect.any(Array), 0);

      // result.x = 25000 / 500 = 50
      expect(result.x).toBe(50);
      // y is always locked to 0 for clip moves
      expect(result.y).toBe(0);
    });

    it('constrains movement and converts back to pixels', () => {
      const clip = makeClip({ id: 'c1', startSample: 1000 });
      const track = makeTrack([clip]);
      const samplesPerPixel = 100;

      // Constrain: requested -2000 samples, but limited to -1000
      mockedConstrainClipDrag.mockReturnValue(-1000);

      const modifier = createModifier({
        tracks: [track],
        samplesPerPixel,
      });

      const op = makeOperation({
        transform: { x: -20, y: 5 },
        sourceData: { trackIndex: 0, clipIndex: 0 },
      });

      const result = modifier.apply(op);

      expect(mockedConstrainClipDrag).toHaveBeenCalledWith(
        clip,
        -2000, // -20 * 100
        expect.any(Array),
        0
      );

      // Constrained: -1000 / 100 = -10
      expect(result.x).toBe(-10);
      expect(result.y).toBe(0);
    });

    it('sorts clips by startSample before passing to constrainClipDrag', () => {
      const clipA = makeClip({ id: 'a', startSample: 88200 });
      const clipB = makeClip({ id: 'b', startSample: 0 });
      const clipC = makeClip({ id: 'c', startSample: 44100 });

      // Track has clips in non-sorted order
      const track = makeTrack([clipA, clipB, clipC]);

      mockedConstrainClipDrag.mockReturnValue(0);

      const modifier = createModifier({
        tracks: [track],
        samplesPerPixel: 100,
      });

      // Drag clipA (index 0 in the track's clips array)
      const op = makeOperation({
        transform: { x: 10, y: 0 },
        sourceData: { trackIndex: 0, clipIndex: 0 },
      });

      modifier.apply(op);

      // Sorted order: B(0), C(44100), A(88200)
      const sortedClips = mockedConstrainClipDrag.mock.calls[0][2];
      expect(sortedClips[0].id).toBe('b');
      expect(sortedClips[1].id).toBe('c');
      expect(sortedClips[2].id).toBe('a');

      // clipA is at sortedIndex 2
      const sortedIndex = mockedConstrainClipDrag.mock.calls[0][3];
      expect(sortedIndex).toBe(2);
    });

    it('passes correct sortedIndex when dragging a middle clip', () => {
      const clipA = makeClip({ id: 'a', startSample: 0, durationSamples: 10000 });
      const clipB = makeClip({ id: 'b', startSample: 20000, durationSamples: 10000 });
      const clipC = makeClip({ id: 'c', startSample: 40000, durationSamples: 10000 });

      const track = makeTrack([clipA, clipB, clipC]);
      mockedConstrainClipDrag.mockReturnValue(0);

      const modifier = createModifier({
        tracks: [track],
        samplesPerPixel: 100,
      });

      // Drag clipB (index 1)
      const op = makeOperation({
        transform: { x: 5, y: 0 },
        sourceData: { trackIndex: 0, clipIndex: 1 },
      });

      modifier.apply(op);

      // clipB is at sorted index 1 (clips are already sorted)
      const sortedIndex = mockedConstrainClipDrag.mock.calls[0][3];
      expect(sortedIndex).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('returns original transform when source is null', () => {
      const modifier = createModifier({
        tracks: [],
        samplesPerPixel: 100,
      });

      const op = makeOperation({
        transform: { x: 42, y: 7 },
        sourceData: null,
      });

      const result = modifier.apply(op);
      expect(result).toEqual({ x: 42, y: 7 });
      expect(mockedConstrainClipDrag).not.toHaveBeenCalled();
    });

    it('returns original transform when source.data is missing', () => {
      const modifier = createModifier({
        tracks: [],
        samplesPerPixel: 100,
      });

      // source exists but data is falsy
      const op = {
        transform: { x: 42, y: 7 },
        source: { data: undefined },
      } as unknown as Parameters<ClipCollisionModifier['apply']>[0];

      const result = modifier.apply(op);
      expect(result).toEqual({ x: 42, y: 7 });
    });

    it('returns original transform when options are not set', () => {
      const modifier = createModifier(undefined);

      const op = makeOperation({
        transform: { x: 10, y: 3 },
        sourceData: { trackIndex: 0, clipIndex: 0 },
      });

      const result = modifier.apply(op);
      expect(result).toEqual({ x: 10, y: 3 });
      expect(mockedConstrainClipDrag).not.toHaveBeenCalled();
    });

    it('returns original transform when trackIndex is out of bounds', () => {
      const clip = makeClip({ id: 'c1' });
      const track = makeTrack([clip]);

      const modifier = createModifier({
        tracks: [track],
        samplesPerPixel: 100,
      });

      const op = makeOperation({
        transform: { x: 15, y: 2 },
        sourceData: { trackIndex: 5, clipIndex: 0 },
      });

      const result = modifier.apply(op);
      expect(result).toEqual({ x: 15, y: 2 });
      expect(mockedConstrainClipDrag).not.toHaveBeenCalled();
    });

    it('returns original transform when clipIndex is out of bounds', () => {
      const clip = makeClip({ id: 'c1' });
      const track = makeTrack([clip]);

      const modifier = createModifier({
        tracks: [track],
        samplesPerPixel: 100,
      });

      const op = makeOperation({
        transform: { x: 15, y: 2 },
        sourceData: { trackIndex: 0, clipIndex: 99 },
      });

      const result = modifier.apply(op);
      expect(result).toEqual({ x: 15, y: 2 });
      expect(mockedConstrainClipDrag).not.toHaveBeenCalled();
    });

    it('handles zero pixel transform', () => {
      const clip = makeClip({ id: 'c1', startSample: 1000 });
      const track = makeTrack([clip]);

      mockedConstrainClipDrag.mockReturnValue(0);

      const modifier = createModifier({
        tracks: [track],
        samplesPerPixel: 256,
      });

      const op = makeOperation({
        transform: { x: 0, y: 0 },
        sourceData: { trackIndex: 0, clipIndex: 0 },
      });

      const result = modifier.apply(op);

      expect(mockedConstrainClipDrag).toHaveBeenCalledWith(clip, 0, [clip], 0);
      expect(result).toEqual({ x: 0, y: 0 });
    });

    it('handles fractional pixel result from sample conversion', () => {
      const clip = makeClip({ id: 'c1', startSample: 0 });
      const track = makeTrack([clip]);
      const samplesPerPixel = 300;

      // Return a value that does not divide evenly by samplesPerPixel
      mockedConstrainClipDrag.mockReturnValue(1000);

      const modifier = createModifier({
        tracks: [track],
        samplesPerPixel,
      });

      const op = makeOperation({
        transform: { x: 10, y: 0 },
        sourceData: { trackIndex: 0, clipIndex: 0 },
      });

      const result = modifier.apply(op);

      // 1000 / 300 = 3.333...
      expect(result.x).toBeCloseTo(1000 / 300);
      expect(result.y).toBe(0);
    });
  });
});
